import { createMockPlaybackGrant } from "./playback-grant-fixture";
import { expect, test } from "@playwright/test";

type NativeMockState = {
  source: string;
  sourceAssignments: string[];
  currentTime: number;
  currentTimeAssignments: number[];
  paused: boolean;
  playCalls: number;
  loadCalls: number;
};

declare global {
  interface Window {
    __nexafilmNativeMock?: NativeMockState;
  }
}

test("native HLS fallback renews a grant and restores playback after loadedmetadata", async ({ page }) => {
  const clockStart = new Date();
  const customerHost = "https://customer-mockcustomer.cloudflarestream.com";
  const grants = [
    createMockPlaybackGrant(
      customerHost,
      new Date(clockStart.getTime() + 36_000),
      "native-initial",
    ),
    createMockPlaybackGrant(
      customerHost,
      new Date(clockStart.getTime() + 5 * 60_000),
      "native-refreshed",
    ),
  ];
  let grantRequests = 0;

  await page.clock.install({ time: clockStart });
  await page.addInitScript(() => {
    const state: NativeMockState = {
      source: "",
      sourceAssignments: [],
      currentTime: 0,
      currentTimeAssignments: [],
      paused: true,
      playCalls: 0,
      loadCalls: 0,
    };
    window.__nexafilmNativeMock = state;

    // Force the browser-native HLS fallback: HLS is advertised by the video
    // element, while Media Source Extensions are unavailable to hls.js.
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
        state.currentTimeAssignments.push(value);
      },
    });
    Object.defineProperty(HTMLMediaElement.prototype, "paused", {
      configurable: true,
      get: () => state.paused,
    });
    HTMLMediaElement.prototype.load = function () {
      state.loadCalls += 1;
      // Simulate the native engine completing the refreshed manifest load.
      this.dispatchEvent(new Event("loadedmetadata"));
    };
    HTMLMediaElement.prototype.play = () => {
      state.paused = false;
      state.playCalls += 1;
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = () => {
      state.paused = true;
    };
  });

  await page.route("**/api/media/mocked-native-hls", async (route) => {
    const index = Math.min(grantRequests, grants.length - 1);
    grantRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Cache-Control": "private, no-store, max-age=0" },
      body: JSON.stringify(grants[index]),
    });
  });

  await page.goto("/watch/mocked-native-hls");
  const video = page.locator("video[aria-label='Mocked Native Hls video player']");
  await expect(video).toBeVisible();
  await expect.poll(() => grantRequests, { timeout: 10_000 }).toBe(1);
  await expect(page.getByText("Secure stream ready.", { exact: false })).toBeVisible();

  const initialState = await page.evaluate(() => ({
    source: window.__nexafilmNativeMock?.source ?? "",
    assignments: window.__nexafilmNativeMock?.sourceAssignments ?? [],
  }));
  expect(initialState.source).toBe(grants[0].manifestUrl);
  expect(initialState.assignments).toHaveLength(1);

  await page.evaluate(() => {
    const state = window.__nexafilmNativeMock;
    if (!state) throw new Error("Native mock media state was not initialized");
    state.currentTime = 88.75;
    state.paused = false;
  });

  // The initial 36-second grant refreshes six seconds before expiry.
  await page.clock.fastForward(7_000);

  await expect.poll(() => grantRequests, { timeout: 10_000 }).toBe(2);
  await expect.poll(
    () =>
      page.evaluate(
        () => window.__nexafilmNativeMock?.sourceAssignments.length ?? 0,
      ),
    { timeout: 10_000 },
  ).toBe(2);

  const recoveredState = await page.evaluate(() => ({
    source: window.__nexafilmNativeMock?.source ?? "",
    assignments: window.__nexafilmNativeMock?.sourceAssignments ?? [],
    currentTime: window.__nexafilmNativeMock?.currentTime ?? 0,
    currentTimeAssignments:
      window.__nexafilmNativeMock?.currentTimeAssignments ?? [],
    playCalls: window.__nexafilmNativeMock?.playCalls ?? 0,
    loadCalls: window.__nexafilmNativeMock?.loadCalls ?? 0,
  }));

  expect(recoveredState.source).toBe(grants[1].manifestUrl);
  expect(recoveredState.assignments[0]).toBe(grants[0].manifestUrl);
  expect(recoveredState.assignments[1]).toBe(grants[1].manifestUrl);
  expect(recoveredState.loadCalls).toBe(1);
  expect(recoveredState.currentTime).toBe(88.75);
  expect(recoveredState.currentTimeAssignments).toContain(88.75);
  expect(recoveredState.playCalls).toBe(1);
  expect(grantRequests).toBe(2);
});
