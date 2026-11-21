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

type HlsLifecycleState = {
  pauseCalls: number;
  playCalls: number;
  currentTime: number;
  paused: boolean;
  loadCalls: number;
  createdObjectUrls: number;
  revokedObjectUrls: number;
};

declare global {
  interface Window {
    __nexafilmHlsLifecycleMock?: HlsLifecycleState;
  }
}

test("unmount destroys HLS.js media attachment and releases its media object URL", async ({ page }) => {
  const customerHost = "https://customer-mockcustomer.cloudflarestream.com";
  let grantRequests = 0;
  let manifestRequests = 0;

  await page.addInitScript(() => {
    const state: HlsLifecycleState = {
      pauseCalls: 0,
      playCalls: 0,
      currentTime: 0,
      paused: true,
      loadCalls: 0,
      createdObjectUrls: 0,
      revokedObjectUrls: 0,
    };
    window.__nexafilmHlsLifecycleMock = state;

    // Force Hls.js/MSE, not native HLS.
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
    HTMLMediaElement.prototype.play = () => {
      state.paused = false;
      state.playCalls += 1;
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = () => {
      state.paused = true;
      state.pauseCalls += 1;
    };
    const originalLoad = HTMLMediaElement.prototype.load;
    HTMLMediaElement.prototype.load = function () {
      state.loadCalls += 1;
      return originalLoad.call(this);
    };

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
      if (createdUrls.has(url)) state.revokedObjectUrls += 1;
      return originalRevokeObjectURL(url);
    };
  });

  await page.route("**/api/media/mocked-lifecycle-hlsjs", async (route) => {
    grantRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Cache-Control": "private, no-store, max-age=0" },
      body: JSON.stringify({
        protocol: "hls",
        manifestUrl: `${customerHost}/header.hlsjs-lifecycle.signature/manifest/video.m3u8`,
        expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      }),
    });
  });
  await page.route(`${customerHost}/**`, async (route) => {
    manifestRequests += 1;
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
  });

  await page.goto("/watch/mocked-lifecycle-hlsjs");
  const video = page.locator("video[aria-label='Mocked Lifecycle Hlsjs video player']");
  await expect(video).toBeVisible();
  await expect.poll(() => grantRequests, { timeout: 10_000 }).toBe(1);
  await expect.poll(() => manifestRequests, { timeout: 10_000 }).toBe(1);
  await expect(page.getByText("Secure stream ready.", { exact: false })).toBeVisible();

  const beforeUnmount = await page.evaluate(() => ({
    createdObjectUrls: window.__nexafilmHlsLifecycleMock?.createdObjectUrls ?? 0,
  }));
  expect(beforeUnmount.createdObjectUrls).toBeGreaterThan(0);

  await page.getByRole("link", { name: "NexaFilm home" }).click();
  await expect(page.locator("video")).toHaveCount(0);

  const cleanup = await page.evaluate(() => ({
    pauseCalls: window.__nexafilmHlsLifecycleMock?.pauseCalls ?? 0,
    loadCalls: window.__nexafilmHlsLifecycleMock?.loadCalls ?? 0,
    createdObjectUrls: window.__nexafilmHlsLifecycleMock?.createdObjectUrls ?? 0,
    revokedObjectUrls: window.__nexafilmHlsLifecycleMock?.revokedObjectUrls ?? 0,
  }));
  expect(cleanup.pauseCalls).toBeGreaterThan(0);
  expect(cleanup.loadCalls).toBeGreaterThan(0);
  expect(cleanup.revokedObjectUrls).toBe(cleanup.createdObjectUrls);
});
