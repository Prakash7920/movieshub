import assert from "node:assert/strict";
import { test } from "node:test";
import {
  evaluatePlaybackAccess,
  type PlaybackAccessInput,
} from "../lib/media/access-policy";

const now = new Date("2026-11-20T12:00:00.000Z");

function validInput(overrides: Partial<PlaybackAccessInput> = {}): PlaybackAccessInput {
  return {
    authenticated: true,
    accountAllowed: true,
    moviePublished: true,
    contentStatus: "PUBLISHED",
    movieType: "FREE",
    mediaSource: "private-object-key/example.mp4",
    license: {
      status: "ACTIVE",
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      expiryDate: new Date("2027-01-01T00:00:00.000Z"),
      allowedCountries: ["IN", "SG"],
    },
    viewerCountry: "IN",
    hasPremiumEntitlement: false,
    storageConfigured: true,
    signingSecretConfigured: true,
    now,
    ...overrides,
  };
}

test("licensed free playback is allowed only when all delivery gates are ready", () => {
  assert.deepEqual(evaluatePlaybackAccess(validInput()), { allowed: true });
});

test("viewer country and licensed territories are normalized as ISO country codes", () => {
  assert.deepEqual(
    evaluatePlaybackAccess(validInput({
      viewerCountry: " in ",
      license: {
        status: "ACTIVE",
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        expiryDate: new Date("2027-01-01T00:00:00.000Z"),
        allowedCountries: ["in", "sg"],
      },
    })),
    { allowed: true },
  );
});

test("anonymous viewers are denied", () => {
  assert.deepEqual(
    evaluatePlaybackAccess(validInput({ authenticated: false })),
    { allowed: false, reason: "AUTHENTICATION_REQUIRED" },
  );
});

test("blocked accounts are denied", () => {
  assert.deepEqual(
    evaluatePlaybackAccess(validInput({ accountAllowed: false })),
    { allowed: false, reason: "ACCOUNT_BLOCKED" },
  );
});

test("unpublished content is denied", () => {
  assert.deepEqual(
    evaluatePlaybackAccess(validInput({ moviePublished: false })),
    { allowed: false, reason: "CONTENT_UNAVAILABLE" },
  );
  assert.deepEqual(
    evaluatePlaybackAccess(validInput({ contentStatus: "DRAFT" })),
    { allowed: false, reason: "CONTENT_UNAVAILABLE" },
  );
});

test("missing or malformed viewer territory is denied", () => {
  for (const viewerCountry of [null, "", "IND", "1N"]) {
    assert.deepEqual(
      evaluatePlaybackAccess(validInput({ viewerCountry })),
      { allowed: false, reason: "TERRITORY_UNVERIFIED" },
    );
  }
});

test("missing or inactive licence is denied", () => {
  assert.deepEqual(
    evaluatePlaybackAccess(validInput({ license: null })),
    { allowed: false, reason: "LICENSE_UNAVAILABLE" },
  );

  const inactive = validInput();
  assert.deepEqual(
    evaluatePlaybackAccess(validInput({
      license: { ...inactive.license!, status: "PENDING" },
    })),
    { allowed: false, reason: "LICENSE_INACTIVE" },
  );
});

test("licence must have valid dates and be within its active window", () => {
  assert.deepEqual(
    evaluatePlaybackAccess(validInput({
      license: {
        status: "ACTIVE",
        startDate: new Date("2026-12-01T00:00:00.000Z"),
        expiryDate: new Date("2027-01-01T00:00:00.000Z"),
        allowedCountries: ["IN"],
      },
    })),
    { allowed: false, reason: "LICENSE_NOT_STARTED" },
  );

  assert.deepEqual(
    evaluatePlaybackAccess(validInput({
      license: {
        status: "ACTIVE",
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        expiryDate: now,
        allowedCountries: ["IN"],
      },
    })),
    { allowed: false, reason: "LICENSE_EXPIRED" },
  );

  assert.deepEqual(
    evaluatePlaybackAccess(validInput({
      license: {
        status: "ACTIVE",
        startDate: new Date("2027-01-01T00:00:00.000Z"),
        expiryDate: new Date("2026-12-01T00:00:00.000Z"),
        allowedCountries: ["IN"],
      },
    })),
    { allowed: false, reason: "LICENSE_UNAVAILABLE" },
  );
});

test("country outside the licence territory is denied", () => {
  assert.deepEqual(
    evaluatePlaybackAccess(validInput({ viewerCountry: "US" })),
    { allowed: false, reason: "TERRITORY_NOT_LICENSED" },
  );
});

test("premium playback requires a server-confirmed premium entitlement", () => {
  assert.deepEqual(
    evaluatePlaybackAccess(validInput({ movieType: "PREMIUM", hasPremiumEntitlement: false })),
    { allowed: false, reason: "PREMIUM_REQUIRED" },
  );

  assert.deepEqual(
    evaluatePlaybackAccess(validInput({ movieType: "PREMIUM", hasPremiumEntitlement: true })),
    { allowed: true },
  );
});

test("missing media source, storage configuration, or signing secret fails closed", () => {
  assert.deepEqual(
    evaluatePlaybackAccess(validInput({ mediaSource: null })),
    { allowed: false, reason: "MEDIA_SOURCE_UNAVAILABLE" },
  );

  assert.deepEqual(
    evaluatePlaybackAccess(validInput({ storageConfigured: false })),
    { allowed: false, reason: "STORAGE_NOT_CONFIGURED" },
  );

  assert.deepEqual(
    evaluatePlaybackAccess(validInput({ signingSecretConfigured: false })),
    { allowed: false, reason: "SIGNING_SECRET_NOT_CONFIGURED" },
  );
});

test("licence expiry is exclusive at the exact millisecond boundary", () => {
  const expiry = new Date(now.getTime() + 5_000);
  const license = {
    status: "ACTIVE",
    startDate: new Date(now.getTime() - 5_000),
    expiryDate: expiry,
    allowedCountries: ["IN"],
  };

  assert.deepEqual(
    evaluatePlaybackAccess(validInput({
      license,
      now: new Date(expiry.getTime() - 1),
    })),
    { allowed: true },
  );

  assert.deepEqual(
    evaluatePlaybackAccess(validInput({
      license,
      now: expiry,
    })),
    { allowed: false, reason: "LICENSE_EXPIRED" },
  );

  assert.deepEqual(
    evaluatePlaybackAccess(validInput({
      license,
      now: new Date(expiry.getTime() + 1),
    })),
    { allowed: false, reason: "LICENSE_EXPIRED" },
  );
});
