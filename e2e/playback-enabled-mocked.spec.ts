import { createMockPlaybackGrant } from "./playback-grant-fixture";
import { expect, test } from "@playwright/test";

type MockPlaybackState = {
  currentTime: number;
  paused: boolean;
  playCalls: number;
  currentTimeAssignments: number[];
};

declare global {
  interface Window {
    __nexafilmMockPlayback?: MockPlaybackState;
  }
}

test("renews a mocked HLS grant and restores playback position without contacting a provider", async ({ page }) => {
  const clockStart = new Date();
  const firstGrantExpiry = new Date(clockStart.getTime() + 36_000);
  const secondGrantExpiry = new Date(clockStart.getTime() + 5 * 60_000);
  const customerHost = "https://customer-mockcustomer.cloudflarestream.com";
  const manifestUrls: string[] = [];
  let segmentRequests = 0;
  let grantRequests = 0;

  const grants = [
    createMockPlaybackGrant(customerHost, firstGrantExpiry, "initial"),
    createMockPlaybackGrant(customerHost, secondGrantExpiry, "refreshed"),
  ];

  await page.clock.install({ time: clockStart });
  await page.addInitScript(() => {
    const state: MockPlaybackState = {
      currentTime: 0,
      paused: true,
      playCalls: 0,
      currentTimeAssignments: [],
    };
    window.__nexafilmMockPlayback = state;

    Object.defineProperty(HTMLMediaElement.prototype, "currentTime", {
      configurable: true,
      get: () => state.currentTime,
      set: (value: number) => {
        state.currentTime = value;
        state.currentTimeAssignments.push(value);
      },
    });
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
    Object.defineProperty(HTMLMediaElement.prototype, "paused", {
      configurable: true,
      get: () => state.paused,
    });
    HTMLMediaElement.prototype.play = () => {
      state.paused = false;
      state.playCalls += 1;
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = () => {
      state.paused = true;
    };
  });

  await page.route("**/api/media/mocked-hls-refresh", async (route) => {
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
      manifestUrls.push(url.toString());
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

  await page.goto("/watch/mocked-hls-refresh");
  await expect(page.locator("video[aria-label='Mocked Hls Refresh video player']")).toBeVisible();
  await expect.poll(() => grantRequests, { timeout: 10_000 }).toBe(1);
  await expect.poll(() => manifestUrls.length, { timeout: 10_000 }).toBe(1);
  await expect(page.getByText("Secure stream ready.", { exact: false })).toBeVisible();
  expect(segmentRequests).toBe(0);

  await page.evaluate(() => {
    const state = window.__nexafilmMockPlayback;
    if (!state) throw new Error("Mock media state was not initialized");
    state.currentTime = 42.5;
    state.paused = false;
  });

  // The first grant expires in 36 seconds, so the client should refresh at +6s.
  await page.clock.fastForward(7_000);

  await expect.poll(() => grantRequests, { timeout: 10_000 }).toBe(2);
  await expect.poll(() => manifestUrls.length, { timeout: 10_000 }).toBe(2);
  expect(manifestUrls[0]).toBe(grants[0].manifestUrl);
  expect(manifestUrls[1]).toBe(grants[1].manifestUrl);

  await expect.poll(
    () =>
      page.evaluate(() =>
        window.__nexafilmMockPlayback?.currentTimeAssignments.some(
          (value) => Math.abs(value - 42.5) < 0.001,
        ) ?? false,
      ),
    { timeout: 10_000 },
  ).toBe(true);

  const restoredState = await page.evaluate(() => ({
    currentTime: window.__nexafilmMockPlayback?.currentTime ?? 0,
    playCalls: window.__nexafilmMockPlayback?.playCalls ?? 0,
  }));
  expect(restoredState.currentTime).toBe(42.5);
  expect(restoredState.playCalls).toBeGreaterThan(0);
  expect(segmentRequests).toBe(0);
  expect(grantRequests).toBe(2);
  expect(manifestUrls).toHaveLength(2);
});
