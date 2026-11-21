import assert from "node:assert/strict";
import { test } from "node:test";
import {
  authorizePlaybackRequest,
  type PlaybackServiceDependencies,
} from "../lib/media/playback-service";

const validAssetUid = "abcdef0123456789abcdef0123456789";
const expectedGrant = {
  protocol: "hls" as const,
  manifestUrl: "https://customer-testcustomer.cloudflarestream.com/header.payload.signature/manifest/video.m3u8",
  expiresAt: "2026-11-20T12:05:00.000Z",
};

function dependencies(
  overrides: Partial<PlaybackServiceDependencies> = {},
): PlaybackServiceDependencies {
  return {
    findAccount: async () => ({ isBanned: false }),
    findMovie: async () => ({
      isPublished: true,
      contentStatus: "PUBLISHED",
      movieType: "FREE",
      cloudflareStreamUid: validAssetUid,
      license: {
        status: "ACTIVE",
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        expiryDate: new Date("2027-01-01T00:00:00.000Z"),
        allowedCountries: ["IN"],
      },
    }),
    getPremiumEntitlement: async () => false,
    consumePlaybackGrantRateLimit: async () => ({
      allowed: true,
      retryAfterSeconds: 300,
    }),
    ...overrides,
  };
}

function enabledDependencies(
  overrides: Partial<PlaybackServiceDependencies> = {},
): PlaybackServiceDependencies {
  return dependencies({
    createPlaybackGrant: async () => expectedGrant,
    ...overrides,
  });
}

test("anonymous playback request is rejected before database lookup", async () => {
  let accountLookups = 0;
  const result = await authorizePlaybackRequest(
    { userId: null, slug: "sample-title", viewerCountry: "IN" },
    dependencies({
      findAccount: async () => {
        accountLookups += 1;
        return { isBanned: false };
      },
    }),
  );
  assert.equal(result.status, 401);
  assert.equal("code" in result.body && result.body.code, "AUTHENTICATION_REQUIRED");
  assert.equal(accountLookups, 0);
});

test("invalid movie slug is rejected", async () => {
  const result = await authorizePlaybackRequest(
    { userId: "user-1", slug: "  ", viewerCountry: "IN" },
    dependencies(),
  );
  assert.equal(result.status, 400);
  assert.equal("code" in result.body && result.body.code, "INVALID_MOVIE_SLUG");
});

test("banned account is denied before movie lookup", async () => {
  let movieLookups = 0;
  const result = await authorizePlaybackRequest(
    { userId: "user-1", slug: "sample-title", viewerCountry: "IN" },
    enabledDependencies({
      findAccount: async () => ({ isBanned: true }),
      findMovie: async () => {
        movieLookups += 1;
        return null;
      },
    }),
  );
  assert.equal(result.status, 403);
  assert.equal("code" in result.body && result.body.code, "ACCOUNT_BLOCKED");
  assert.equal(movieLookups, 0);
});

test("unknown account and unknown title fail closed", async () => {
  const unknownAccount = await authorizePlaybackRequest(
    { userId: "deleted-user", slug: "sample-title", viewerCountry: "IN" },
    enabledDependencies({ findAccount: async () => null }),
  );
  assert.equal(unknownAccount.status, 401);

  const unknownTitle = await authorizePlaybackRequest(
    { userId: "user-1", slug: "missing-title", viewerCountry: "IN" },
    enabledDependencies({ findMovie: async () => null }),
  );
  assert.equal(unknownTitle.status, 404);
});

test("default-off provider gate returns 503 before querying Movie or calling Cloudflare", async () => {
  let movieLookups = 0;
  let tokenRequests = 0;
  let rateLimitChecks = 0;
  const result = await authorizePlaybackRequest(
    { userId: "user-1", slug: "sample-title", viewerCountry: "IN" },
    dependencies({
      findMovie: async () => {
        movieLookups += 1;
        return null;
      },
      createPlaybackGrant: async () => {
        tokenRequests += 1;
        return expectedGrant;
      },
    }),
  );

  // No adapter is supplied to model the route when its environment flag is off.
  const disabled = await authorizePlaybackRequest(
    { userId: "user-1", slug: "sample-title", viewerCountry: "IN" },
    dependencies({
      findMovie: async () => {
        movieLookups += 1;
        return null;
      },
      consumePlaybackGrantRateLimit: async () => {
        rateLimitChecks += 1;
        return { allowed: true, retryAfterSeconds: 300 };
      },
    }),
  );

  assert.equal(result.status, 404);
  assert.equal(disabled.status, 503);
  assert.equal("code" in disabled.body && disabled.body.code, "MEDIA_DELIVERY_NOT_CONFIGURED");
  assert.equal(movieLookups, 1);
  assert.equal(tokenRequests, 0);
  assert.equal(rateLimitChecks, 1); // the enabled path consumed once; disabled path skipped it
});

test("missing viewer territory is denied without attempting media delivery", async () => {
  let tokenRequests = 0;
  const result = await authorizePlaybackRequest(
    { userId: "user-1", slug: "sample-title", viewerCountry: null },
    enabledDependencies({
      createPlaybackGrant: async () => {
        tokenRequests += 1;
        return expectedGrant;
      },
    }),
  );
  assert.equal(result.status, 503);
  assert.equal("code" in result.body && result.body.code, "TERRITORY_UNVERIFIED");
  assert.equal(tokenRequests, 0);
});

test("unlicensed and territory-restricted titles are denied before Cloudflare token issuance", async () => {
  let tokenRequests = 0;
  const inactive = await authorizePlaybackRequest(
    { userId: "user-1", slug: "sample-title", viewerCountry: "IN" },
    enabledDependencies({
      findMovie: async () => ({
        isPublished: true,
        contentStatus: "PUBLISHED",
        movieType: "FREE",
        cloudflareStreamUid: validAssetUid,
        license: {
          status: "PENDING",
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          expiryDate: new Date("2027-01-01T00:00:00.000Z"),
          allowedCountries: ["IN"],
        },
      }),
      createPlaybackGrant: async () => {
        tokenRequests += 1;
        return expectedGrant;
      },
    }),
  );
  assert.equal(inactive.status, 404);
  assert.equal("code" in inactive.body && inactive.body.code, "TITLE_UNAVAILABLE");

  const wrongTerritory = await authorizePlaybackRequest(
    { userId: "user-1", slug: "sample-title", viewerCountry: "US" },
    enabledDependencies({
      createPlaybackGrant: async () => {
        tokenRequests += 1;
        return expectedGrant;
      },
    }),
  );
  assert.equal(wrongTerritory.status, 404);
  assert.equal("code" in wrongTerritory.body && wrongTerritory.body.code, "TITLE_UNAVAILABLE");
  assert.equal(tokenRequests, 0);
});

test("Premium title requires a premium entitlement before token issuance", async () => {
  let tokenRequests = 0;
  const result = await authorizePlaybackRequest(
    { userId: "user-1", slug: "premium-title", viewerCountry: "IN" },
    enabledDependencies({
      findMovie: async () => ({
        isPublished: true,
        contentStatus: "PUBLISHED",
        movieType: "PREMIUM",
        cloudflareStreamUid: validAssetUid,
        license: {
          status: "ACTIVE",
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          expiryDate: new Date("2027-01-01T00:00:00.000Z"),
          allowedCountries: ["IN"],
        },
      }),
      getPremiumEntitlement: async () => false,
      createPlaybackGrant: async () => {
        tokenRequests += 1;
        return expectedGrant;
      },
    }),
  );
  assert.equal(result.status, 403);
  assert.equal("code" in result.body && result.body.code, "PREMIUM_REQUIRED");
  assert.equal(tokenRequests, 0);
});

test("authorized title returns only the short-lived Cloudflare manifest grant", async () => {
  let requestedAssetUid = "";
  let requestedCountry = "";
  const result = await authorizePlaybackRequest(
    { userId: "user-1", slug: "sample-title", viewerCountry: "in" },
    enabledDependencies({
      createPlaybackGrant: async (assetUid, country) => {
        requestedAssetUid = assetUid;
        requestedCountry = country;
        return expectedGrant;
      },
    }),
  );

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, expectedGrant);
  assert.equal(requestedAssetUid, validAssetUid);
  assert.equal(requestedCountry, "IN");
  assert.equal(JSON.stringify(result.body).includes(validAssetUid), false);
  assert.equal(JSON.stringify(result.body).includes("private-origin"), false);
});

test("legacy raw videoUrl is ignored and never returned to the playback client", async () => {
  const legacyMovieRecord = {
    isPublished: true,
    contentStatus: "PUBLISHED",
    movieType: "FREE" as const,
    cloudflareStreamUid: validAssetUid,
    videoUrl: "https://private-origin.invalid/secret/master.m3u8",
    license: {
      status: "ACTIVE",
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      expiryDate: new Date("2027-01-01T00:00:00.000Z"),
      allowedCountries: ["IN"],
    },
  };

  const result = await authorizePlaybackRequest(
    { userId: "user-1", slug: "sample-title", viewerCountry: "IN" },
    enabledDependencies({
      findMovie: async () => legacyMovieRecord,
      createPlaybackGrant: async (assetUid) => {
        assert.equal(assetUid, validAssetUid);
        return expectedGrant;
      },
    }),
  );

  assert.equal(result.status, 200);
  assert.equal(JSON.stringify(result.body).includes(legacyMovieRecord.videoUrl), false);
  assert.deepEqual(result.body, expectedGrant);
});
test("provider errors return a generic 503 without exposing provider details", async () => {
  const result = await authorizePlaybackRequest(
    { userId: "user-1", slug: "sample-title", viewerCountry: "IN" },
    enabledDependencies({
      createPlaybackGrant: async () => {
        throw new Error("provider rejected test-api-token and private data");
      },
    }),
  );

  assert.equal(result.status, 503);
  assert.deepEqual(result.body, {
    error: "Secure media delivery is temporarily unavailable.",
    code: "MEDIA_PROVIDER_UNAVAILABLE",
  });
  assert.equal(JSON.stringify(result.body).includes("test-api-token"), false);
  assert.equal(JSON.stringify(result.body).includes("private data"), false);
});

test("missing provider asset UID fails closed without requesting a token", async () => {
  let tokenRequests = 0;
  const result = await authorizePlaybackRequest(
    { userId: "user-1", slug: "sample-title", viewerCountry: "IN" },
    enabledDependencies({
      findMovie: async () => ({
        isPublished: true,
        contentStatus: "PUBLISHED",
        movieType: "FREE",
        cloudflareStreamUid: null,
        license: {
          status: "ACTIVE",
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          expiryDate: new Date("2027-01-01T00:00:00.000Z"),
          allowedCountries: ["IN"],
        },
      }),
      createPlaybackGrant: async () => {
        tokenRequests += 1;
        return expectedGrant;
      },
    }),
  );
  assert.equal(result.status, 503);
  assert.equal("code" in result.body && result.body.code, "MEDIA_DELIVERY_NOT_CONFIGURED");
  assert.equal(tokenRequests, 0);
});


test("enabled grant issuance consumes a shared rate-limit bucket for the authenticated user", async () => {
  let limitedUserId = "";
  let movieLookupCount = 0;
  const result = await authorizePlaybackRequest(
    { userId: "user-42", slug: "sample-title", viewerCountry: "IN" },
    enabledDependencies({
      consumePlaybackGrantRateLimit: async (userId) => {
        limitedUserId = userId;
        return { allowed: true, retryAfterSeconds: 300 };
      },
      findMovie: async () => {
        movieLookupCount += 1;
        return {
          isPublished: true,
          contentStatus: "PUBLISHED",
          movieType: "FREE",
          cloudflareStreamUid: validAssetUid,
          license: {
            status: "ACTIVE",
            startDate: new Date("2026-01-01T00:00:00.000Z"),
            expiryDate: new Date("2027-01-01T00:00:00.000Z"),
            allowedCountries: ["IN"],
          },
        };
      },
    }),
  );

  assert.equal(result.status, 200);
  assert.equal(limitedUserId, "user-42");
  assert.equal(movieLookupCount, 1);
});

test("grant rate limit rejects excess requests before movie lookup or provider issuance", async () => {
  let movieLookupCount = 0;
  let grantRequests = 0;
  const result = await authorizePlaybackRequest(
    { userId: "user-42", slug: "another-title", viewerCountry: "IN" },
    enabledDependencies({
      consumePlaybackGrantRateLimit: async (userId) => {
        assert.equal(userId, "user-42");
        return { allowed: false, retryAfterSeconds: 47 };
      },
      findMovie: async () => {
        movieLookupCount += 1;
        return null;
      },
      createPlaybackGrant: async () => {
        grantRequests += 1;
        return expectedGrant;
      },
    }),
  );

  assert.equal(result.status, 429);
  assert.deepEqual(result.body, {
    error: "Too many playback requests. Please try again shortly.",
    code: "PLAYBACK_RATE_LIMITED",
  });
  assert.equal(result.retryAfterSeconds, 47);
  assert.equal(movieLookupCount, 0);
  assert.equal(grantRequests, 0);
});

test("rate-limit infrastructure failure fails closed before movie lookup or provider issuance", async () => {
  let movieLookupCount = 0;
  let grantRequests = 0;
  const result = await authorizePlaybackRequest(
    { userId: "user-42", slug: "sample-title", viewerCountry: "IN" },
    enabledDependencies({
      consumePlaybackGrantRateLimit: async () => {
        throw new Error("database unavailable");
      },
      findMovie: async () => {
        movieLookupCount += 1;
        return null;
      },
      createPlaybackGrant: async () => {
        grantRequests += 1;
        return expectedGrant;
      },
    }),
  );

  assert.equal(result.status, 503);
  assert.deepEqual(result.body, {
    error: "Playback authorization is temporarily unavailable.",
    code: "PLAYBACK_RATE_LIMIT_UNAVAILABLE",
  });
  assert.equal(movieLookupCount, 0);
  assert.equal(grantRequests, 0);
});
