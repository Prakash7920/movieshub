import { expect, test, type Page } from "@playwright/test";

type LifecycleState = {
  source: string;
  sourceAssignments: string[];
  paused: boolean;
  pauseCalls: number;
  loadCalls: number;
};

declare global {
  interface Window {
    __nexafilmLifecycleMock?: LifecycleState;
  }
}

async function installNativeLifecycleMock(page: Page) {
  await page.addInitScript(() => {
    const state: LifecycleState = {
      source: "",
      sourceAssignments: [],
      paused: true,
      pauseCalls: 0,
      loadCalls: 0,
    };
    window.__nexafilmLifecycleMock = state;

    // Force the native HLS branch while keeping all media behavior local.
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
    const originalRemoveAttribute = HTMLMediaElement.prototype.removeAttribute;
    HTMLMediaElement.prototype.removeAttribute = function (name: string) {
      if (name.toLowerCase() === "src") {
        state.source = "";
        state.sourceAssignments.push("");
      }
      return originalRemoveAttribute.call(this, name);
    };
    Object.defineProperty(HTMLMediaElement.prototype, "paused", {
      configurable: true,
      get: () => state.paused,
    });
    HTMLMediaElement.prototype.pause = () => {
      state.paused = true;
      state.pauseCalls += 1;
    };
    HTMLMediaElement.prototype.play = () => {
      state.paused = false;
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.load = function () {
      state.loadCalls += 1;
    };
  });
}

function validGrant(expiresAt: Date) {
  return {
    protocol: "hls",
    manifestUrl:
      "https://customer-mockcustomer.cloudflarestream.com/header.lifecycle.signature/manifest/video.m3u8",
    expiresAt: expiresAt.toISOString(),
  };
}

test("unmount clears native media source and cancels the scheduled refresh timer", async ({ page }) => {
  const clockStart = new Date();
  let grantRequests = 0;

  await page.clock.install({ time: clockStart });
  await installNativeLifecycleMock(page);
  await page.route("**/api/media/mocked-lifecycle-timer", async (route) => {
    grantRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Cache-Control": "private, no-store, max-age=0" },
      body: JSON.stringify(validGrant(new Date(clockStart.getTime() + 36_000))),
    });
  });
  await page.route("https://customer-mockcustomer.cloudflarestream.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/vnd.apple.mpegurl",
      body: ["#EXTM3U", "#EXT-X-ENDLIST"].join("\n"),
    });
  });

  await page.goto("/watch/mocked-lifecycle-timer");
  const video = page.locator("video[aria-label='Mocked Lifecycle Timer video player']");
  await expect(video).toBeVisible();
  await expect.poll(() => grantRequests, { timeout: 10_000 }).toBe(1);
  await expect(page.getByText("Secure stream ready.", { exact: false })).toBeVisible();

  const configuredSource = await page.evaluate(
    () => window.__nexafilmLifecycleMock?.source ?? "",
  );
  expect(configuredSource).toContain("header.lifecycle.signature");

  await page.getByRole("link", { name: "NexaFilm home" }).click();
  await expect(page.locator("video")).toHaveCount(0);

  const cleanupState = await page.evaluate(() => ({
    source: window.__nexafilmLifecycleMock?.source ?? "",
    sourceAssignments: window.__nexafilmLifecycleMock?.sourceAssignments ?? [],
    paused: window.__nexafilmLifecycleMock?.paused ?? false,
    pauseCalls: window.__nexafilmLifecycleMock?.pauseCalls ?? 0,
    loadCalls: window.__nexafilmLifecycleMock?.loadCalls ?? 0,
  }));
  expect(cleanupState.source).toBe("");
  expect(cleanupState.sourceAssignments[cleanupState.sourceAssignments.length - 1]).toBe("");
  expect(cleanupState.paused).toBe(true);
  expect(cleanupState.pauseCalls).toBe(1);
  expect(cleanupState.loadCalls).toBe(1);

  await page.clock.fastForward(60_000);
  expect(grantRequests).toBe(1);
});

test("unmount aborts a pending initial playback-grant request", async ({ page }) => {
  const customerHost = "https://customer-mockcustomer.cloudflarestream.com";
  let grantRequestStarted!: () => void;
  let releaseGrantResponse!: () => void;
  const started = new Promise<void>((resolve) => {
    grantRequestStarted = resolve;
  });
  const release = new Promise<void>((resolve) => {
    releaseGrantResponse = resolve;
  });
  const manifestRequests: string[] = [];

  await installNativeLifecycleMock(page);
  await page.route("**/api/media/mocked-lifecycle-initial-pending", async (route) => {
    grantRequestStarted();
    await release;
    try {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          protocol: "hls",
          manifestUrl: `${customerHost}/header.pending.signature/manifest/video.m3u8`,
          expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        }),
      });
    } catch {
      // The browser request was intentionally aborted by component unmount.
    }
  });
  await page.route(`${customerHost}/**`, async (route) => {
    manifestRequests.push(route.request().url());
    await route.fulfill({ status: 200, contentType: "application/vnd.apple.mpegurl", body: "#EXTM3U" });
  });

  await page.goto("/watch/mocked-lifecycle-initial-pending");
  const requestAborted = page.waitForEvent(
    "requestfailed",
    (request) => request.url().endsWith("/api/media/mocked-lifecycle-initial-pending"),
  );
  await started;
  await page.getByRole("link", { name: "NexaFilm home" }).click();
  const failedRequest = await requestAborted;
  expect(failedRequest.failure()).not.toBeNull();

  releaseGrantResponse();
  await page.waitForTimeout(100);
  expect(manifestRequests).toHaveLength(0);
  await expect(page.locator("video")).toHaveCount(0);
});

test("unmount aborts an in-flight refresh request and prevents further refreshes", async ({ page }) => {
  const clockStart = new Date();
  let grantRequests = 0;
  let refreshRequestStarted!: () => void;
  let releaseRefreshResponse!: () => void;
  const refreshStarted = new Promise<void>((resolve) => {
    refreshRequestStarted = resolve;
  });
  const releaseRefresh = new Promise<void>((resolve) => {
    releaseRefreshResponse = resolve;
  });

  await page.clock.install({ time: clockStart });
  await installNativeLifecycleMock(page);
  await page.route("**/api/media/mocked-lifecycle-refresh-pending", async (route) => {
    grantRequests += 1;
    if (grantRequests === 1) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Cache-Control": "private, no-store, max-age=0" },
        body: JSON.stringify(validGrant(new Date(clockStart.getTime() + 36_000))),
      });
      return;
    }

    refreshRequestStarted();
    await releaseRefresh;
    try {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(validGrant(new Date(clockStart.getTime() + 5 * 60_000))),
      });
    } catch {
      // The browser request was intentionally aborted by component unmount.
    }
  });
  await page.route("https://customer-mockcustomer.cloudflarestream.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/vnd.apple.mpegurl",
      body: ["#EXTM3U", "#EXT-X-ENDLIST"].join("\n"),
    });
  });

  await page.goto("/watch/mocked-lifecycle-refresh-pending");
  const video = page.locator("video[aria-label='Mocked Lifecycle Refresh Pending video player']");
  await expect(video).toBeVisible();
  await expect.poll(() => grantRequests, { timeout: 10_000 }).toBe(1);
  await expect(page.getByText("Secure stream ready.", { exact: false })).toBeVisible();

  await page.clock.fastForward(7_000);
  await refreshStarted;
  expect(grantRequests).toBe(2);

  const requestAborted = page.waitForEvent(
    "requestfailed",
    (request) => request.url().endsWith("/api/media/mocked-lifecycle-refresh-pending"),
  );
  await page.getByRole("link", { name: "NexaFilm home" }).click();
  const failedRequest = await requestAborted;
  expect(failedRequest.failure()).not.toBeNull();

  releaseRefreshResponse();
  await page.clock.fastForward(60_000);
  expect(grantRequests).toBe(2);

  const cleanupState = await page.evaluate(() => ({
    source: window.__nexafilmLifecycleMock?.source ?? "",
    paused: window.__nexafilmLifecycleMock?.paused ?? false,
    pauseCalls: window.__nexafilmLifecycleMock?.pauseCalls ?? 0,
    loadCalls: window.__nexafilmLifecycleMock?.loadCalls ?? 0,
  }));
  expect(cleanupState.source).toBe("");
  expect(cleanupState.paused).toBe(true);
  expect(cleanupState.pauseCalls).toBe(1);
  expect(cleanupState.loadCalls).toBe(1);
});
