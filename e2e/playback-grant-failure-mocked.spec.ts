import { expect, test, type Page } from "@playwright/test";

type NativeFailureState = {
  source: string;
  sourceAssignments: string[];
  currentTime: number;
  paused: boolean;
  pauseCalls: number;
  playCalls: number;
  loadCalls: number;
};

declare global {
  interface Window {
    __nexafilmNativeFailureMock?: NativeFailureState;
  }
}

async function installNativeFailureMock(page: Page) {
  await page.addInitScript(() => {
    const state: NativeFailureState = {
      source: "",
      sourceAssignments: [],
      currentTime: 0,
      paused: true,
      pauseCalls: 0,
      playCalls: 0,
      loadCalls: 0,
    };
    window.__nexafilmNativeFailureMock = state;

    // Force the native HLS fallback while preventing real media decoding/network.
    Reflect.deleteProperty(window, "ManagedMediaSource");
    const originalCanPlayType = HTMLMediaElement.prototype.canPlayType;
    HTMLMediaElement.prototype.canPlayType = function (type: string) {
      if (type === "application/vnd.apple.mpegurl") return "probably";
      return originalCanPlayType.call(this, type);
    };
    if (window.MediaSource) {
      Object.defineProperty(window.MediaSource, "isTypeSupported", {
        configurable: true,
        value: () => false,
      });
    }

    Object.defineProperty(HTMLMediaElement.prototype, "src", {
      configurable: true,
      get: () => state.source,
      set: (value: string) => {
        state.source = value;
        state.sourceAssignments.push(value);
      },
    });
    Object.defineProperty(HTMLMediaElement.prototype, "currentTime", {
      configurable: true,
      get: () => state.currentTime,
      set: (value: number) => {
        state.currentTime = value;
      },
    });
    Object.defineProperty(HTMLMediaElement.prototype, "paused", {
      configurable: true,
      get: () => state.paused,
    });

    const originalRemoveAttribute = HTMLMediaElement.prototype.removeAttribute;
    HTMLMediaElement.prototype.removeAttribute = function (name: string) {
      if (name.toLowerCase() === "src") {
        state.source = "";
        state.sourceAssignments.push("");
      }
      return originalRemoveAttribute.call(this, name);
    };
    HTMLMediaElement.prototype.load = function () {
      state.loadCalls += 1;
    };
    HTMLMediaElement.prototype.play = () => {
      state.paused = false;
      state.playCalls += 1;
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = () => {
      state.paused = true;
      state.pauseCalls += 1;
    };
  });
}

test("rejects an expired initial grant without assigning or requesting a media manifest", async ({ page }) => {
  const clockStart = new Date();
  const customerHost = "https://customer-mockcustomer.cloudflarestream.com";
  let grantRequests = 0;
  const manifestRequests: string[] = [];

  await page.clock.install({ time: clockStart });
  await installNativeFailureMock(page);

  await page.route("**/api/media/mocked-expired-grant", async (route) => {
    grantRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        protocol: "hls",
        manifestUrl: `${customerHost}/header.expired.signature/manifest/video.m3u8`,
        expiresAt: new Date(clockStart.getTime() - 1_000).toISOString(),
      }),
    });
  });
  await page.route(`${customerHost}/**`, async (route) => {
    manifestRequests.push(route.request().url());
    await route.fulfill({ status: 200, contentType: "application/vnd.apple.mpegurl", body: ["#EXTM3U", "#EXT-X-ENDLIST"].join("\n") });
  });

  await page.goto("/watch/mocked-expired-grant");
  const video = page.locator("video[aria-label='Mocked Expired Grant video player']");
  await expect(video).toBeVisible();
  await expect.poll(() => grantRequests, { timeout: 10_000 }).toBe(1);
  await expect(page.getByText("Secure playback could not be started.", { exact: false })).toBeVisible();

  const state = await page.evaluate(() => ({
    source: window.__nexafilmNativeFailureMock?.source ?? "",
    sourceAssignments: window.__nexafilmNativeFailureMock?.sourceAssignments ?? [],
    loadCalls: window.__nexafilmNativeFailureMock?.loadCalls ?? 0,
    playCalls: window.__nexafilmNativeFailureMock?.playCalls ?? 0,
  }));
  expect(state.source).toBe("");
  expect(state.sourceAssignments).toHaveLength(0);
  expect(state.loadCalls).toBe(0);
  expect(state.playCalls).toBe(0);
  expect(manifestRequests).toHaveLength(0);
  expect(grantRequests).toBe(1);
});

test("stops playback and clears the old source when a renewal request fails", async ({ page }) => {
  const clockStart = new Date();
  const customerHost = "https://customer-mockcustomer.cloudflarestream.com";
  const initialGrant = {
    protocol: "hls",
    manifestUrl: `${customerHost}/header.valid.signature/manifest/video.m3u8`,
    expiresAt: new Date(clockStart.getTime() + 36_000).toISOString(),
  };
  let grantRequests = 0;

  await page.clock.install({ time: clockStart });
  await installNativeFailureMock(page);

  await page.route("**/api/media/mocked-refresh-failure", async (route) => {
    grantRequests += 1;
    if (grantRequests === 1) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Cache-Control": "private, no-store, max-age=0" },
        body: JSON.stringify(initialGrant),
      });
      return;
    }

    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ code: "MOCK_REFRESH_UNAVAILABLE" }),
    });
  });
  await page.route(`${customerHost}/**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/vnd.apple.mpegurl",
      body: ["#EXTM3U", "#EXT-X-ENDLIST"].join("\n"),
    });
  });

  await page.goto("/watch/mocked-refresh-failure");
  const video = page.locator("video[aria-label='Mocked Refresh Failure video player']");
  await expect(video).toBeVisible();
  await expect.poll(() => grantRequests, { timeout: 10_000 }).toBe(1);
  await expect(page.getByText("Secure stream ready.", { exact: false })).toBeVisible();

  const initialSource = await page.evaluate(() => window.__nexafilmNativeFailureMock?.source ?? "");
  expect(initialSource).toContain("header.valid.signature");

  await page.evaluate(() => {
    const state = window.__nexafilmNativeFailureMock;
    if (!state) throw new Error("Native failure mock was not initialized");
    state.currentTime = 67.25;
    state.paused = false;
  });

  // The grant is refreshed six seconds before expiry.
  await page.clock.fastForward(7_000);

  await expect.poll(() => grantRequests, { timeout: 10_000 }).toBe(2);
  await expect(page.getByText("Secure playback could not be started.", { exact: false })).toBeVisible();

  const failedState = await page.evaluate(() => ({
    source: window.__nexafilmNativeFailureMock?.source ?? "",
    sourceAssignments: window.__nexafilmNativeFailureMock?.sourceAssignments ?? [],
    currentTime: window.__nexafilmNativeFailureMock?.currentTime ?? 0,
    paused: window.__nexafilmNativeFailureMock?.paused ?? false,
    pauseCalls: window.__nexafilmNativeFailureMock?.pauseCalls ?? 0,
    playCalls: window.__nexafilmNativeFailureMock?.playCalls ?? 0,
    loadCalls: window.__nexafilmNativeFailureMock?.loadCalls ?? 0,
  }));

  expect(failedState.source).toBe("");
  expect(failedState.sourceAssignments[0]).toContain("header.valid.signature");
  expect(failedState.sourceAssignments[failedState.sourceAssignments.length - 1]).toBe("");
  expect(failedState.currentTime).toBe(67.25);
  expect(failedState.paused).toBe(true);
  expect(failedState.pauseCalls).toBe(1);
  expect(failedState.playCalls).toBe(0);
  expect(failedState.loadCalls).toBe(1);

  await page.clock.fastForward(60_000);
  expect(grantRequests).toBe(2);
  await expect(page.getByText("Secure playback could not be started.", { exact: false })).toBeVisible();
});


test("recovers from an initial grant failure with one guarded retry and a fresh grant", async ({ page }) => {
  const clockStart = new Date();
  const customerHost = "https://customer-mockcustomer.cloudflarestream.com";
  let grantRequests = 0;
  const manifestRequests: string[] = [];
  const recoveredGrant = {
    protocol: "hls",
    manifestUrl: `${customerHost}/header.retry-recovered.signature/manifest/video.m3u8`,
    expiresAt: new Date(clockStart.getTime() + 5 * 60_000).toISOString(),
  };

  await page.clock.install({ time: clockStart });
  await installNativeFailureMock(page);

  await page.route("**/api/media/mocked-retry-recovery", async (route) => {
    grantRequests += 1;
    if (grantRequests === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ code: "MOCK_INITIAL_GRANT_UNAVAILABLE" }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Cache-Control": "private, no-store, max-age=0" },
      body: JSON.stringify(recoveredGrant),
    });
  });
  await page.route(`${customerHost}/**`, async (route) => {
    manifestRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/vnd.apple.mpegurl",
      body: ["#EXTM3U", "#EXT-X-ENDLIST"].join("\n"),
    });
  });

  await page.goto("/watch/mocked-retry-recovery");
  const video = page.locator("video[aria-label='Mocked Retry Recovery video player']");
  await expect(video).toBeVisible();
  await expect.poll(() => grantRequests, { timeout: 10_000 }).toBe(1);
  await expect(page.getByText("Secure playback could not be started.", { exact: false })).toBeVisible();

  const retryButton = page.getByRole("button", { name: "Retry playback" });
  await expect(retryButton).toBeVisible();

  // Dispatch two clicks in one browser task to exercise the retry latch.
  await retryButton.evaluate((button) => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  await expect.poll(() => grantRequests, { timeout: 10_000 }).toBe(2);
  await expect(page.getByText("Secure stream ready.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry playback" })).toHaveCount(0);

  const recoveredState = await page.evaluate(() => ({
    source: window.__nexafilmNativeFailureMock?.source ?? "",
    sourceAssignments: window.__nexafilmNativeFailureMock?.sourceAssignments ?? [],
    paused: window.__nexafilmNativeFailureMock?.paused ?? true,
    loadCalls: window.__nexafilmNativeFailureMock?.loadCalls ?? 0,
  }));
  expect(recoveredState.source).toContain("header.retry-recovered.signature");
  expect(recoveredState.sourceAssignments).toContain(recoveredGrant.manifestUrl);
  expect(recoveredState.paused).toBe(true);
  expect(recoveredState.loadCalls).toBeGreaterThan(0);
  expect(grantRequests).toBe(2);
  expect(manifestRequests.length).toBeLessThanOrEqual(1);

  await page.clock.fastForward(60_000);
  expect(grantRequests).toBe(2);
});
