import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CloudflareStreamDeliveryError,
  createCloudflareStreamPlaybackGrant,
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

test("creates a short-lived HLS grant bound to the verified viewer country", async () => {
  let requestedUrl = "";
  let requestInit: RequestInit | undefined;

  const fetcher: CloudflareFetch = async (url, init) => {
    requestedUrl = url;
    requestInit = init;
    return response({ success: true, result: { token: signedToken } });
  };

  const grant = await createCloudflareStreamPlaybackGrant(
    { assetUid, assetRequiresSignedUrls: true, viewerCountry: "in", now: fixedNow },
    config,
    fetcher,
  );

  assert.equal(
    requestedUrl,
    `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/stream/${assetUid}/token`,
  );
  assert.equal(requestInit?.method, "POST");
  assert.equal(
    (requestInit?.headers as Record<string, string>).Authorization,
    `Bearer ${config.apiToken}`,
  );
  assert.deepEqual(JSON.parse(String(requestInit?.body)), {
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
  const fetcher: CloudflareFetch = async () =>
    response({ success: true, result: { token: signedToken } });

  const grant = await createCloudflareStreamPlaybackGrant(
    { assetUid, assetRequiresSignedUrls: true, viewerCountry: "GB", ttlSeconds: 900, now: fixedNow },
    config,
    fetcher,
  );

  assert.equal(grant.expiresAt, "2026-11-20T12:15:00.000Z");
});

test("rejects invalid asset identifiers before making a provider request", async () => {
  let called = false;
  const fetcher: CloudflareFetch = async () => {
    called = true;
    return response({ success: true, result: { token: signedToken } });
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


test("refuses to mint a token unless trusted metadata confirms requireSignedURLs is enabled", async () => {
  let called = false;
  const fetcher: CloudflareFetch = async () => {
    called = true;
    return response({ success: true, result: { token: signedToken } });
  };

  await assert.rejects(
    () =>
      createCloudflareStreamPlaybackGrant(
        {
          assetUid,
          assetRequiresSignedUrls: false,
          viewerCountry: "IN",
          now: fixedNow,
        },
        config,
        fetcher,
      ),
    (error: unknown) =>
      error instanceof CloudflareStreamDeliveryError &&
      error.code === "INVALID_REQUEST",
  );
  assert.equal(called, false);
});

test("rejects an unverified viewer country before making a provider request", async () => {
  let called = false;
  const fetcher: CloudflareFetch = async () => {
    called = true;
    return response({ success: true, result: { token: signedToken } });
  };

  await assert.rejects(
    () =>
      createCloudflareStreamPlaybackGrant(
        { assetUid, assetRequiresSignedUrls: true, viewerCountry: "", now: fixedNow },
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
  const fetcher: CloudflareFetch = async () =>
    response({ success: true, result: { token: signedToken } });

  for (const ttlSeconds of [59, 901, 60.5]) {
    await assert.rejects(
      () =>
        createCloudflareStreamPlaybackGrant(
          { assetUid, assetRequiresSignedUrls: true, viewerCountry: "IN", ttlSeconds, now: fixedNow },
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
  const fetcher: CloudflareFetch = async () =>
    response({ success: true, result: { token: signedToken } });

  await assert.rejects(
    () =>
      createCloudflareStreamPlaybackGrant(
        { assetUid, assetRequiresSignedUrls: true, viewerCountry: "IN", now: fixedNow },
        { ...config, apiToken: "bad\ntoken" },
        fetcher,
      ),
    (error: unknown) =>
      error instanceof CloudflareStreamDeliveryError &&
      error.code === "INVALID_CONFIGURATION",
  );
});

test("fails closed on provider HTTP errors without exposing provider response content", async () => {
  const fetcher: CloudflareFetch = async () =>
    response({ secret: "do-not-return" }, { ok: false, status: 403 });

  await assert.rejects(
    () =>
      createCloudflareStreamPlaybackGrant(
        { assetUid, assetRequiresSignedUrls: true, viewerCountry: "IN", now: fixedNow },
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
    const fetcher: CloudflareFetch = async () => response(payload);
    await assert.rejects(
      () =>
        createCloudflareStreamPlaybackGrant(
          { assetUid, assetRequiresSignedUrls: true, viewerCountry: "IN", now: fixedNow },
          config,
          fetcher,
        ),
      (error: unknown) =>
        error instanceof CloudflareStreamDeliveryError &&
        error.code === "INVALID_PROVIDER_RESPONSE",
    );
  }
});

test("does not leak credentials or provider details when the fetch call fails", async () => {
  const fetcher: CloudflareFetch = async () => {
    throw new Error("provider request failed with test-api-token");
  };

  await assert.rejects(
    () =>
      createCloudflareStreamPlaybackGrant(
        { assetUid, assetRequiresSignedUrls: true, viewerCountry: "IN", now: fixedNow },
        config,
        fetcher,
      ),
    (error: unknown) =>
      error instanceof CloudflareStreamDeliveryError &&
      error.code === "PROVIDER_REJECTED" &&
      !error.message.includes(config.apiToken),
  );
});

test("does not allow public downloads in the signed token request", async () => {
  let requestBody: Record<string, unknown> | undefined;
  const fetcher: CloudflareFetch = async (_url, init) => {
    requestBody = JSON.parse(String(init.body)) as Record<string, unknown>;
    return response({ success: true, result: { token: signedToken } });
  };

  await createCloudflareStreamPlaybackGrant(
    { assetUid, assetRequiresSignedUrls: true, viewerCountry: "IN", now: fixedNow },
    config,
    fetcher,
  );

  assert.equal(requestBody?.downloadable, false);
});
