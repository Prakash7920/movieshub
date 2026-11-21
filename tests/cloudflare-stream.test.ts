import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CloudflareStreamDeliveryError,
  createCloudflareStreamPlaybackGrant,
  getCloudflareStreamConfigFromEnv,
  type CloudflareFetch,
} from "../lib/media/cloudflare-stream";

const config = {
  accountId: "0123456789abcdef0123456789abcdef",
  apiToken: "test-api-token",
  customerCode: "testcustomer123",
};

const assetUid = "abcdef0123456789abcdef0123456789";
const signedToken = "header.payload.signature";
const fixedNow = new Date("2026-11-20T12:00:00.000Z");

function response(
  payload: unknown,
  options: { ok?: boolean; status?: number } = {},
) {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    json: async () => payload,
  };
}

function privateAssetDetails(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    result: {
      uid: assetUid,
      requireSignedURLs: true,
      readyToStream: true,
      ...overrides,
    },
  };
}

function successfulFetcher(options: {
  tokenPayload?: unknown;
  tokenHttp?: { ok?: boolean; status?: number };
  onTokenRequest?: (url: string, init: RequestInit) => void;
  assetPayload?: unknown;
  onAssetRequest?: (url: string, init: RequestInit) => void;
} = {}): CloudflareFetch {
  return async (url, init) => {
    if (init.method === "GET") {
      options.onAssetRequest?.(url, init);
      return response(
        options.assetPayload ?? privateAssetDetails(),
      );
    }

    options.onTokenRequest?.(url, init);
    return response(
      options.tokenPayload ?? { success: true, result: { token: signedToken } },
      options.tokenHttp,
    );
  };
}

test("verifies private ready asset metadata before issuing a short-lived country-bound HLS grant", async () => {
  const calls: Array<{ url: string; method: string | undefined }> = [];
  let tokenRequestInit: RequestInit | undefined;

  const fetcher = successfulFetcher({
    onAssetRequest: (url, init) => calls.push({ url, method: init.method }),
    onTokenRequest: (url, init) => {
      calls.push({ url, method: init.method });
      tokenRequestInit = init;
    },
  });

  const grant = await createCloudflareStreamPlaybackGrant(
    { assetUid, viewerCountry: "in", now: fixedNow },
    config,
    fetcher,
  );

  assert.deepEqual(calls, [
    {
      url: `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/stream/${assetUid}`,
      method: "GET",
    },
    {
      url: `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/stream/${assetUid}/token`,
      method: "POST",
    },
  ]);
  assert.equal(
    (tokenRequestInit?.headers as Record<string, string>).Authorization,
    `Bearer ${config.apiToken}`,
  );
  assert.deepEqual(JSON.parse(String(tokenRequestInit?.body)), {
    exp: Math.floor(fixedNow.getTime() / 1000) + 300,
    downloadable: false,
    accessRules: [
      { action: "allow", country: ["IN"], type: "ip.geoip.country" },
      { action: "block", type: "any" },
    ],
  });
  assert.deepEqual(grant, {
    protocol: "hls",
    manifestUrl:
      `https://customer-${config.customerCode}.cloudflarestream.com/${signedToken}/manifest/video.m3u8`,
    expiresAt: "2026-11-20T12:05:00.000Z",
  });
  assert.equal(grant.manifestUrl.includes(assetUid), false);
});

test("accepts a custom short lifetime within the configured bounds", async () => {
  const grant = await createCloudflareStreamPlaybackGrant(
    { assetUid, viewerCountry: "GB", ttlSeconds: 900, now: fixedNow },
    config,
    successfulFetcher(),
  );

  assert.equal(grant.expiresAt, "2026-11-20T12:15:00.000Z");
});

test("rejects invalid asset identifiers before making a provider request", async () => {
  let called = false;
  const fetcher: CloudflareFetch = async () => {
    called = true;
    return response(privateAssetDetails());
  };

  await assert.rejects(
    () =>
      createCloudflareStreamPlaybackGrant(
        { assetUid: "raw-video-url", viewerCountry: "IN", now: fixedNow },
        config,
        fetcher,
      ),
    (error: unknown) =>
      error instanceof CloudflareStreamDeliveryError &&
      error.code === "INVALID_REQUEST",
  );
  assert.equal(called, false);
});

test("refuses to mint a token unless provider metadata confirms requireSignedURLs is enabled", async () => {
  let tokenCalled = false;
  const fetcher = successfulFetcher({
    assetPayload: privateAssetDetails({ requireSignedURLs: false }),
    onTokenRequest: () => {
      tokenCalled = true;
    },
  });

  await assert.rejects(
    () =>
      createCloudflareStreamPlaybackGrant(
        { assetUid, viewerCountry: "IN", now: fixedNow },
        config,
        fetcher,
      ),
    (error: unknown) =>
      error instanceof CloudflareStreamDeliveryError &&
      error.code === "ASSET_NOT_PRIVATE",
  );
  assert.equal(tokenCalled, false);
});

test("refuses to mint a token until Cloudflare reports the asset ready to stream", async () => {
  let tokenCalled = false;
  const fetcher = successfulFetcher({
    assetPayload: privateAssetDetails({ readyToStream: false }),
    onTokenRequest: () => {
      tokenCalled = true;
    },
  });

  await assert.rejects(
    () =>
      createCloudflareStreamPlaybackGrant(
        { assetUid, viewerCountry: "IN", now: fixedNow },
        config,
        fetcher,
      ),
    (error: unknown) =>
      error instanceof CloudflareStreamDeliveryError &&
      error.code === "ASSET_NOT_READY",
  );
  assert.equal(tokenCalled, false);
});

test("rejects a mismatched provider asset UID", async () => {
  let tokenCalled = false;
  const fetcher = successfulFetcher({
    assetPayload: privateAssetDetails({ uid: "ffffffffffffffffffffffffffffffff" }),
    onTokenRequest: () => {
      tokenCalled = true;
    },
  });

  await assert.rejects(
    () =>
      createCloudflareStreamPlaybackGrant(
        { assetUid, viewerCountry: "IN", now: fixedNow },
        config,
        fetcher,
      ),
    (error: unknown) =>
      error instanceof CloudflareStreamDeliveryError &&
      error.code === "ASSET_NOT_PRIVATE",
  );
  assert.equal(tokenCalled, false);
});

test("rejects an unverified viewer country before making a provider request", async () => {
  let called = false;
  const fetcher: CloudflareFetch = async () => {
    called = true;
    return response(privateAssetDetails());
  };

  await assert.rejects(
    () =>
      createCloudflareStreamPlaybackGrant(
        { assetUid, viewerCountry: "", now: fixedNow },
        config,
        fetcher,
      ),
    (error: unknown) =>
      error instanceof CloudflareStreamDeliveryError &&
      error.code === "INVALID_REQUEST",
  );
  assert.equal(called, false);
});

test("rejects lifetimes below one minute, above fifteen minutes, and non-integers", async () => {
  const fetcher = successfulFetcher();

  for (const ttlSeconds of [59, 901, 60.5]) {
    await assert.rejects(
      () =>
        createCloudflareStreamPlaybackGrant(
          { assetUid, viewerCountry: "IN", ttlSeconds, now: fixedNow },
          config,
          fetcher,
        ),
      (error: unknown) =>
        error instanceof CloudflareStreamDeliveryError &&
        error.code === "INVALID_REQUEST",
    );
  }
});

test("rejects unsafe provider configuration", async () => {
  const fetcher = successfulFetcher();

  await assert.rejects(
    () =>
      createCloudflareStreamPlaybackGrant(
        { assetUid, viewerCountry: "IN", now: fixedNow },
        { ...config, apiToken: "bad\ntoken" },
        fetcher,
      ),
    (error: unknown) =>
      error instanceof CloudflareStreamDeliveryError &&
      error.code === "INVALID_CONFIGURATION",
  );
});

test("fails closed when Cloudflare asset details cannot be retrieved", async () => {
  const fetcher: CloudflareFetch = async () => {
    throw new Error("provider request failed with test-api-token");
  };

  await assert.rejects(
    () =>
      createCloudflareStreamPlaybackGrant(
        { assetUid, viewerCountry: "IN", now: fixedNow },
        config,
        fetcher,
      ),
    (error: unknown) =>
      error instanceof CloudflareStreamDeliveryError &&
      error.code === "PROVIDER_REJECTED" &&
      !error.message.includes(config.apiToken),
  );
});

test("fails closed on token endpoint HTTP errors without exposing provider response content", async () => {
  const fetcher = successfulFetcher({
    tokenPayload: { secret: "do-not-return" },
    tokenHttp: { ok: false, status: 403 },
  });

  await assert.rejects(
    () =>
      createCloudflareStreamPlaybackGrant(
        { assetUid, viewerCountry: "IN", now: fixedNow },
        config,
        fetcher,
      ),
    (error: unknown) =>
      error instanceof CloudflareStreamDeliveryError &&
      error.code === "PROVIDER_REJECTED" &&
      !error.message.includes("do-not-return"),
  );
});

test("fails closed when the provider response is unsuccessful or has no signed token", async () => {
  const invalidPayloads: unknown[] = [
    { success: false, result: { token: signedToken } },
    { success: true, result: {} },
    { success: true, result: { token: "not-a-jwt" } },
  ];

  for (const payload of invalidPayloads) {
    const fetcher = successfulFetcher({ tokenPayload: payload });
    await assert.rejects(
      () =>
        createCloudflareStreamPlaybackGrant(
          { assetUid, viewerCountry: "IN", now: fixedNow },
          config,
          fetcher,
        ),
      (error: unknown) =>
        error instanceof CloudflareStreamDeliveryError &&
        error.code === "INVALID_PROVIDER_RESPONSE",
    );
  }
});

test("does not allow public downloads in the signed token request", async () => {
  let requestBody: Record<string, unknown> | undefined;
  const fetcher = successfulFetcher({
    onTokenRequest: (_url, init) => {
      requestBody = JSON.parse(String(init.body)) as Record<string, unknown>;
    },
  });

  await createCloudflareStreamPlaybackGrant(
    { assetUid, viewerCountry: "IN", now: fixedNow },
    config,
    fetcher,
  );

  assert.equal(requestBody?.downloadable, false);
});

test("Cloudflare Stream configuration is disabled by default even when credentials exist", () => {
  assert.equal(
    getCloudflareStreamConfigFromEnv({
      CLOUDFLARE_ACCOUNT_ID: config.accountId,
      CLOUDFLARE_STREAM_API_TOKEN: config.apiToken,
      CLOUDFLARE_STREAM_CUSTOMER_CODE: config.customerCode,
    }),
    null,
  );
});

test("Cloudflare Stream configuration requires the explicit feature flag and all credentials", () => {
  assert.equal(
    getCloudflareStreamConfigFromEnv({
      CLOUDFLARE_STREAM_ENABLED: "true",
      CLOUDFLARE_ACCOUNT_ID: config.accountId,
      CLOUDFLARE_STREAM_API_TOKEN: config.apiToken,
    }),
    null,
  );
  assert.equal(
    getCloudflareStreamConfigFromEnv({
      CLOUDFLARE_STREAM_ENABLED: "false",
      CLOUDFLARE_ACCOUNT_ID: config.accountId,
      CLOUDFLARE_STREAM_API_TOKEN: config.apiToken,
      CLOUDFLARE_STREAM_CUSTOMER_CODE: config.customerCode,
    }),
    null,
  );
});

test("Cloudflare Stream configuration rejects malformed identifiers and multiline credentials", () => {
  assert.equal(
    getCloudflareStreamConfigFromEnv({
      CLOUDFLARE_STREAM_ENABLED: "true",
      CLOUDFLARE_ACCOUNT_ID: "not-an-account",
      CLOUDFLARE_STREAM_API_TOKEN: config.apiToken,
      CLOUDFLARE_STREAM_CUSTOMER_CODE: config.customerCode,
    }),
    null,
  );
  assert.equal(
    getCloudflareStreamConfigFromEnv({
      CLOUDFLARE_STREAM_ENABLED: "true",
      CLOUDFLARE_ACCOUNT_ID: config.accountId,
      CLOUDFLARE_STREAM_API_TOKEN: "bad\ntoken",
      CLOUDFLARE_STREAM_CUSTOMER_CODE: config.customerCode,
    }),
    null,
  );
});

test("Cloudflare Stream configuration becomes available only with the explicit gate and valid values", () => {
  assert.deepEqual(
    getCloudflareStreamConfigFromEnv({
      CLOUDFLARE_STREAM_ENABLED: "true",
      CLOUDFLARE_ACCOUNT_ID: config.accountId,
      CLOUDFLARE_STREAM_API_TOKEN: config.apiToken,
      CLOUDFLARE_STREAM_CUSTOMER_CODE: config.customerCode,
    }),
    config,
  );
});
