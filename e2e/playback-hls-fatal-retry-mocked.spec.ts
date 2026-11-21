import { expect, test } from "@playwright/test";

type HlsFatalRetryState = {
  createdObjectUrls: number;
  revokedObjectUrls: number;
};

declare global {
  interface Window {
    __nexafilmHlsFatalRetry?: HlsFatalRetryState;
  }
}

test("recovers from a fatal HLS manifest error with a fresh grant and HLS instance", async ({ page }) => {
  const clockStart = new Date();
  const customerHost = "https://customer-mockcustomer.cloudflarestream.com";
  const initialExpiry = new Date(clockStart.getTime() + 36_000).toISOString();
  const recoveredExpiry = new Date(clockStart.getTime() + 5 * 60_000).toISOString();
  const manifestPaths: string[] = [];
  let grantRequests = 0;
  let segmentRequests = 0;

  const grants = [
    {
      protocol: "hls",
      manifestUrl: `${customerHost}/header.fatal.signature/manifest/video.m3u8`,
      expiresAt: initialExpiry,
    },
    {
      protocol: "hls",
      manifestUrl: `${customerHost}/header.recovered.signature/manifest/video.m3u8`,
      expiresAt: recoveredExpiry,
    },
  ];

  await page.clock.install({ time: clockStart });
  await page.addInitScript(() => {
    window.__nexafilmHlsFatalRetry = {
      createdObjectUrls: 0,
      revokedObjectUrls: 0,
    };

    // Force the hls.js Media Source Extensions path in a fully mocked browser.
    Reflect.deleteProperty(window, "ManagedMediaSource");
    const originalCanPlayType = HTMLMediaElement.prototype.canPlayType;
    HTMLMediaElement.prototype.canPlayType = function (type: string) {
      if (type === "application/vnd.apple.mpegurl") return "";
      return originalCanPlayType.call(this, type);
    };
    if (window.MediaSource) {
      Object.defineProperty(window.MediaSource, "isTypeSupported", {
        configurable: true,
        value: (type: string) =>
          type.includes("video/mp4") || type.includes("avc1") || type.includes("mp4a"),
      });
    }

    const state = window.__nexafilmHlsFatalRetry;
    if (!state) throw new Error("HLS fatal retry mock state was not initialized");
    const createdUrls = new Set<string>();
    const originalCreateObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (object: Blob | MediaSource) => {
      const url = originalCreateObjectURL(object);
      createdUrls.add(url);
      state.createdObjectUrls += 1;
      return url;
    };
    const originalRevokeObjectURL = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url: string) => {
      if (createdUrls.has(url)) {
        state.revokedObjectUrls += 1;
        createdUrls.delete(url);
      }
      return originalRevokeObjectURL(url);
    };
  });

  await page.route("**/api/media/mocked-hls-fatal-retry", async (route) => {
    const index = Math.min(grantRequests, grants.length - 1);
    grantRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Cache-Control": "private, no-store, max-age=0" },
      body: JSON.stringify(grants[index]),
    });
  });

  await page.route(`${customerHost}/**`, async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith("/manifest/video.m3u8")) {
      manifestPaths.push(url.pathname);

      if (url.pathname.includes("header.fatal.signature")) {
        // A 200 response with no #EXTM3U header causes hls.js manifest parsing
        // to emit a fatal MANIFEST_PARSING_ERROR.
        await route.fulfill({
          status: 200,
          contentType: "application/vnd.apple.mpegurl",
          body: "this is deliberately not an HLS manifest",
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/vnd.apple.mpegurl",
        body: [
          "#EXTM3U",
          "#EXT-X-VERSION:3",
          "#EXT-X-TARGETDURATION:6",
          "#EXT-X-MEDIA-SEQUENCE:0",
          "#EXTINF:6.0,",
          "segment.ts",
          "#EXT-X-ENDLIST",
          "",
        ].join("\n"),
      });
      return;
    }

    if (url.pathname.endsWith("/segment.ts")) {
      segmentRequests += 1;
      await route.fulfill({ status: 200, contentType: "video/mp2t", body: "" });
      return;
    }

    await route.fulfill({ status: 404, body: "Unexpected mocked CDN request" });
  });

  await page.goto("/watch/mocked-hls-fatal-retry");
  await expect(
    page.locator("video[aria-label='Mocked Hls Fatal Retry video player']"),
  ).toBeVisible();
  await expect.poll(() => grantRequests, { timeout: 10_000 }).toBe(1);
  await expect.poll(() => manifestPaths.length, { timeout: 10_000 }).toBe(1);
  await expect(page.getByRole("button", { name: "Retry playback" })).toBeVisible();
  await expect(
    page.getByText("Secure playback could not be started.", { exact: false }),
  ).toBeVisible();

  const failedEngineState = await page.evaluate(() => ({
    createdObjectUrls: window.__nexafilmHlsFatalRetry?.createdObjectUrls ?? 0,
    revokedObjectUrls: window.__nexafilmHlsFatalRetry?.revokedObjectUrls ?? 0,
  }));
  expect(failedEngineState.createdObjectUrls).toBeGreaterThan(0);
  // The fatal error must destroy the first HLS instance and release its MSE URL.
  expect(failedEngineState.revokedObjectUrls).toBe(failedEngineState.createdObjectUrls);

  // The initial grant's refresh deadline has passed. A cleared timer must not
  // issue another grant request while the player is in the fatal-error state.
  await page.clock.fastForward(60_000);
  expect(grantRequests).toBe(1);
  expect(manifestPaths).toHaveLength(1);

  await page.getByRole("button", { name: "Retry playback" }).click();
  await expect.poll(() => grantRequests, { timeout: 10_000 }).toBe(2);
  await expect.poll(() => manifestPaths.length, { timeout: 10_000 }).toBe(2);
  await expect(page.getByText("Secure stream ready.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry playback" })).toHaveCount(0);

  expect(manifestPaths[0]).toContain("header.fatal.signature");
  expect(manifestPaths[1]).toContain("header.recovered.signature");

  const recoveredEngineState = await page.evaluate(() => ({
    createdObjectUrls: window.__nexafilmHlsFatalRetry?.createdObjectUrls ?? 0,
    revokedObjectUrls: window.__nexafilmHlsFatalRetry?.revokedObjectUrls ?? 0,
  }));
  // A second MSE object URL proves a new HLS instance was attached after retry.
  expect(recoveredEngineState.createdObjectUrls).toBeGreaterThan(
    failedEngineState.createdObjectUrls,
  );
  expect(
    recoveredEngineState.createdObjectUrls - recoveredEngineState.revokedObjectUrls,
  ).toBe(1);
  expect(grantRequests).toBe(2);
  expect(segmentRequests).toBe(0);

  await page.getByRole("link", { name: "NexaFilm home" }).click();
  await expect(page.locator("video")).toHaveCount(0);
  const finalEngineState = await page.evaluate(() => ({
    createdObjectUrls: window.__nexafilmHlsFatalRetry?.createdObjectUrls ?? 0,
    revokedObjectUrls: window.__nexafilmHlsFatalRetry?.revokedObjectUrls ?? 0,
  }));
  expect(finalEngineState.revokedObjectUrls).toBe(finalEngineState.createdObjectUrls);
});
