import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePlaybackGrant } from "../lib/media/playback-grant";

const now = Date.parse("2026-11-21T00:00:00.000Z");
const grantExpiry = now + 5 * 60 * 1000;

function base64UrlJson(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}
function signedTokenForExpiry(expiryMs: number): string {
  const header = base64UrlJson({ alg: "RS256", kid: "unit-test-key" });
  const payload = base64UrlJson({ exp: String(expiryMs / 1000) });
  return `${header}.${payload}.mock-signature`;
}

const validGrant = {
  protocol: "hls",
  manifestUrl: `https://customer-testcustomer123.cloudflarestream.com/${signedTokenForExpiry(grantExpiry)}/manifest/video.m3u8`,
  expiresAt: new Date(grantExpiry).toISOString(),
};

test("accepts a valid short-lived Cloudflare signed HLS grant", () => {
  assert.deepEqual(parsePlaybackGrant(validGrant, now), validGrant);
});

test("normalizes an accepted manifest URL and expiry", () => {
  const grant = parsePlaybackGrant(
    {
      ...validGrant,
      manifestUrl: validGrant.manifestUrl.replace(
        "customer-testcustomer123",
        "CUSTOMER-TESTCUSTOMER123",
      ),
    },
    now,
  );

  assert.equal(grant?.manifestUrl, validGrant.manifestUrl);
  assert.equal(grant?.expiresAt, validGrant.expiresAt);
});

test("rejects missing, malformed, and non-HLS grant payloads", () => {
  for (const payload of [
    null,
    undefined,
    {},
    "https://customer-testcustomer123.cloudflarestream.com/token/manifest/video.m3u8",
    { ...validGrant, protocol: "dash" },
    { ...validGrant, manifestUrl: 42 },
    { ...validGrant, expiresAt: "not-a-date" },
  ]) {
    assert.equal(parsePlaybackGrant(payload, now), null);
  }
});

test("rejects non-HTTPS, untrusted, and non-Cloudflare manifest hosts", () => {
  const urls = [
    "http://customer-testcustomer123.cloudflarestream.com/header.payload.signature/manifest/video.m3u8",
    "https://evil.example/header.payload.signature/manifest/video.m3u8",
    "https://customer-testcustomer123.cloudflarestream.com.evil.example/header.payload.signature/manifest/video.m3u8",
    "https://cloudflarestream.com/header.payload.signature/manifest/video.m3u8",
  ];

  for (const manifestUrl of urls) {
    assert.equal(parsePlaybackGrant({ ...validGrant, manifestUrl }, now), null);
  }
});

test("rejects arbitrary, raw-asset, and non-manifest paths", () => {
  const paths = [
    "https://customer-testcustomer123.cloudflarestream.com/asset-uid",
    "https://customer-testcustomer123.cloudflarestream.com/header.payload.signature/download",
    "https://customer-testcustomer123.cloudflarestream.com/header.payload.signature/manifest/video.mpd",
    "https://customer-testcustomer123.cloudflarestream.com/header.payload.signature/manifest/video.m3u8/extra",
  ];

  for (const manifestUrl of paths) {
    assert.equal(parsePlaybackGrant({ ...validGrant, manifestUrl }, now), null);
  }
});

test("rejects URLs containing credentials, query strings, or fragments", () => {
  const unsafeUrls = [
    "https://user:password@customer-testcustomer123.cloudflarestream.com/header.payload.signature/manifest/video.m3u8",
    "https://customer-testcustomer123.cloudflarestream.com/header.payload.signature/manifest/video.m3u8?debug=1",
    "https://customer-testcustomer123.cloudflarestream.com/header.payload.signature/manifest/video.m3u8#fragment",
  ];

  for (const manifestUrl of unsafeUrls) {
    assert.equal(parsePlaybackGrant({ ...validGrant, manifestUrl }, now), null);
  }
});

test("accepts a grant one millisecond before its signed expiry", () => {
  assert.ok(parsePlaybackGrant(validGrant, grantExpiry - 1));
});

test("rejects a grant at the exact signed expiry boundary", () => {
  assert.equal(parsePlaybackGrant(validGrant, grantExpiry), null);
});

test("rejects a grant one millisecond after its signed expiry", () => {
  assert.equal(parsePlaybackGrant(validGrant, grantExpiry + 1), null);
});

test("rejects expiry metadata that does not exactly match the signed JWT exp claim", () => {
  assert.equal(
    parsePlaybackGrant(
      { ...validGrant, expiresAt: new Date(grantExpiry + 1000).toISOString() },
      now,
    ),
    null,
  );
  assert.equal(
    parsePlaybackGrant(
      { ...validGrant, expiresAt: new Date(grantExpiry - 1000).toISOString() },
      now,
    ),
    null,
  );
  assert.equal(
    parsePlaybackGrant(
      { ...validGrant, expiresAt: new Date(grantExpiry + 1).toISOString() },
      now,
    ),
    null,
  );
});

test("rejects malformed tokens, unexpected algorithms, and missing expiry claims", () => {
  const host = "https://customer-testcustomer123.cloudflarestream.com";
  const validHeader = base64UrlJson({ alg: "RS256", kid: "unit-test-key" });
  const invalidHeader = base64UrlJson({ alg: "HS256", kid: "unit-test-key" });
  const missingExpiry = base64UrlJson({ nbf: String(now / 1000) });
  const validPayload = base64UrlJson({ exp: String(grantExpiry / 1000) });
  const malformedTokens = [
    "header.payload.signature",
    `${invalidHeader}.${validPayload}.mock-signature`,
    `${validHeader}.${missingExpiry}.mock-signature`,
  ];

  for (const token of malformedTokens) {
    assert.equal(
      parsePlaybackGrant(
        {
          ...validGrant,
          manifestUrl: `${host}/${token}/manifest/video.m3u8`,
        },
        now,
      ),
      null,
    );
  }
});

test("rejects grants with expiry beyond the short-lived window", () => {
  const expiry = now + 17 * 60 * 1000;
  assert.equal(
    parsePlaybackGrant(
      {
        protocol: "hls",
        manifestUrl: `https://customer-testcustomer123.cloudflarestream.com/${signedTokenForExpiry(expiry)}/manifest/video.m3u8`,
        expiresAt: new Date(expiry).toISOString(),
      },
      now,
    ),
    null,
  );
});

test("accepts the provider's maximum approved fifteen-minute grant lifetime", () => {
  const expiry = now + 15 * 60 * 1000;
  const grant = parsePlaybackGrant(
    {
      protocol: "hls",
      manifestUrl: `https://customer-testcustomer123.cloudflarestream.com/${signedTokenForExpiry(expiry)}/manifest/video.m3u8`,
      expiresAt: new Date(expiry).toISOString(),
    },
    now,
  );
  assert.ok(grant);
});

test("does not mutate or retain extra fields from the server payload", () => {
  const payload = {
    ...validGrant,
    apiToken: "must-not-be-kept",
    rawAssetUid: "must-not-be-kept",
  };
  const parsed = parsePlaybackGrant(payload, now);

  assert.deepEqual(Object.keys(parsed ?? {}).sort(), [
    "expiresAt",
    "manifestUrl",
    "protocol",
  ]);
  assert.equal(JSON.stringify(parsed).includes("must-not-be-kept"), false);
});
