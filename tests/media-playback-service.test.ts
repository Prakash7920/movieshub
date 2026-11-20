import assert from "node:assert/strict";
import { test } from "node:test";
import {
  authorizePlaybackRequest,
  type PlaybackServiceDependencies,
} from "../lib/media/playback-service";

const now = new Date("2026-11-20T12:00:00.000Z");

function dependencies(
  overrides: Partial<PlaybackServiceDependencies> = {},
): PlaybackServiceDependencies {
  return {
    findAccount: async () => ({ isBanned: false }),
    findMovie: async () => ({
      isPublished: true,
      contentStatus: "PUBLISHED",
      movieType: "FREE",
      videoUrl: "https://private-origin.invalid/secret/master.m3u8",
      license: {
        status: "ACTIVE",
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        expiryDate: new Date("2027-01-01T00:00:00.000Z"),
        allowedCountries: ["IN"],
      },
    }),
    getPremiumEntitlement: async () => false,
    ...overrides,
  };
}

test("anonymous playback request is rejected before database lookup", async () => {
  let accountLookups = 0;
  const result = await authorizePlaybackRequest(
    { userId: null, slug: "sample-title", viewerCountry: "IN" },
    dependencies({ findAccount: async () => { accountLookups += 1; return { isBanned: false }; } }),
  );
  assert.equal(result.status, 401);
  assert.equal(result.body.code, "AUTHENTICATION_REQUIRED");
  assert.equal(accountLookups, 0);
});

test("invalid movie slug is rejected", async () => {
  const result = await authorizePlaybackRequest(
    { userId: "user-1", slug: " ".repeat(2), viewerCountry: "IN" },
    dependencies(),
  );
  assert.equal(result.status, 400);
  assert.equal(result.body.code, "INVALID_MOVIE_SLUG");
});

test("banned account is denied before movie lookup", async () => {
  let movieLookups = 0;
  const result = await authorizePlaybackRequest(
    { userId: "user-1", slug: "sample-title", viewerCountry: "IN" },
    dependencies({
      findAccount: async () => ({ isBanned: true }),
      findMovie: async () => { movieLookups += 1; return null; },
    }),
  );
  assert.equal(result.status, 403);
  assert.equal(result.body.code, "ACCOUNT_BLOCKED");
  assert.equal(movieLookups, 0);
});

test("unknown account and unknown title fail closed", async () => {
  const unknownAccount = await authorizePlaybackRequest(
    { userId: "deleted-user", slug: "sample-title", viewerCountry: "IN" },
    dependencies({ findAccount: async () => null }),
  );
  assert.equal(unknownAccount.status, 401);

  const unknownTitle = await authorizePlaybackRequest(
    { userId: "user-1", slug: "missing-title", viewerCountry: "IN" },
    dependencies({ findMovie: async () => null }),
  );
  assert.equal(unknownTitle.status, 404);
});

test("missing viewer territory is denied without attempting media delivery", async () => {
  const result = await authorizePlaybackRequest(
    { userId: "user-1", slug: "sample-title", viewerCountry: null },
    dependencies(),
  );
  assert.equal(result.status, 503);
  assert.equal(result.body.code, "TERRITORY_UNVERIFIED");
});

test("unlicensed and territory-restricted titles are denied", async () => {
  const inactive = await authorizePlaybackRequest(
    { userId: "user-1", slug: "sample-title", viewerCountry: "IN" },
    dependencies({
      findMovie: async () => ({
        isPublished: true,
        contentStatus: "PUBLISHED",
        movieType: "FREE",
        videoUrl: "private-object",
        license: {
          status: "PENDING",
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          expiryDate: new Date("2027-01-01T00:00:00.000Z"),
          allowedCountries: ["IN"],
        },
      }),
    }),
  );
  assert.equal(inactive.status, 404);
  assert.equal(inactive.body.code, "TITLE_UNAVAILABLE");

  const wrongTerritory = await authorizePlaybackRequest(
    { userId: "user-1", slug: "sample-title", viewerCountry: "US" },
    dependencies(),
  );
  assert.equal(wrongTerritory.status, 404);
  assert.equal(wrongTerritory.body.code, "TITLE_UNAVAILABLE");
});

test("Premium title requires a premium entitlement", async () => {
  const result = await authorizePlaybackRequest(
    { userId: "user-1", slug: "premium-title", viewerCountry: "IN" },
    dependencies({
      findMovie: async () => ({
        isPublished: true,
        contentStatus: "PUBLISHED",
        movieType: "PREMIUM",
        videoUrl: "private-object",
        license: {
          status: "ACTIVE",
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          expiryDate: new Date("2027-01-01T00:00:00.000Z"),
          allowedCountries: ["IN"],
        },
      }),
    }),
  );
  assert.equal(result.status, 403);
  assert.equal(result.body.code, "PREMIUM_REQUIRED");
});

test("even an authorized title fails closed without a reviewed storage signer", async () => {
  const result = await authorizePlaybackRequest(
    { userId: "user-1", slug: "sample-title", viewerCountry: "IN" },
    dependencies(),
  );
  assert.equal(result.status, 503);
  assert.equal(result.body.code, "MEDIA_DELIVERY_NOT_CONFIGURED");
  assert.equal(JSON.stringify(result.body).includes("secret/master.m3u8"), false);
});
