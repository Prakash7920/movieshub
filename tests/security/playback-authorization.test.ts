import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  evaluatePlaybackAuthorization,
  MAX_PLAYBACK_GRANT_TTL_SECONDS,
  verifySignedPlaybackGrant,
  type PlaybackAuthorizationInput,
  type PlaybackGrantClaims,
  type PlaybackGrantVerification,
} from "../../lib/media/playback-security";

const SECRET = "unit-test-only-signing-secret-at-least-32-bytes";
const NOW = new Date("2026-01-01T00:00:00.000Z");
const NOW_SECONDS = Math.floor(NOW.getTime() / 1000);

function signFixture(claims: PlaybackGrantClaims, secret = SECRET): string {
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  const input = `v1.${payload}`;
  const signature = createHmac("sha256", secret).update(input).digest("base64url");
  return `${input}.${signature}`;
}

function validClaims(overrides: Partial<PlaybackGrantClaims> = {}): PlaybackGrantClaims {
  return {
    sub: "user-1",
    movieId: "movie-1",
    countryCode: "IN",
    iat: NOW_SECONDS,
    exp: NOW_SECONDS + 120,
    ...overrides,
  };
}

function validGrant() {
  return verifySignedPlaybackGrant(signFixture(validClaims()), SECRET, NOW);
}

function authorizationInput(
  overrides: Partial<PlaybackAuthorizationInput> = {},
): PlaybackAuthorizationInput {
  return {
    userId: "user-1",
    isBanned: false,
    movieId: "movie-1",
    countryCode: "IN",
    movie: {
      isPublished: true,
      contentStatus: "PUBLISHED",
      movieType: "FREE",
    },
    license: {
      status: "ACTIVE",
      startsAt: new Date(NOW.getTime()),
      expiresAt: new Date(NOW.getTime() + 60_000),
      allowedCountries: ["IN"],
    },
    hasPremiumCatalogEntitlement: false,
    grant: validGrant(),
    now: NOW,
    ...overrides,
  };
}

test("accepts a correctly signed grant before its expiry boundary", () => {
  const claims = validClaims();
  const token = signFixture(claims);
  const result = verifySignedPlaybackGrant(token, SECRET, NOW);
  assert.equal(result.valid, true);
});

test("accepts a grant one millisecond before expiry", () => {
  const exp = NOW_SECONDS + 60;
  const token = signFixture(validClaims({ exp }));
  const result = verifySignedPlaybackGrant(token, SECRET, new Date(exp * 1000 - 1));
  assert.equal(result.valid, true);
});

test("rejects a grant at the exact expiry instant", () => {
  const exp = NOW_SECONDS + 60;
  const token = signFixture(validClaims({ exp }));
  const result = verifySignedPlaybackGrant(token, SECRET, new Date(exp * 1000));
  assert.deepEqual(result, { valid: false, reason: "EXPIRED" });
});

test("rejects a grant one millisecond after expiry", () => {
  const exp = NOW_SECONDS + 60;
  const token = signFixture(validClaims({ exp }));
  const result = verifySignedPlaybackGrant(token, SECRET, new Date(exp * 1000 + 1));
  assert.deepEqual(result, { valid: false, reason: "EXPIRED" });
});

test("rejects a payload changed after signing", () => {
  const token = signFixture(validClaims());
  const parts = token.split(".");
  const changedPayload = Buffer.from(
    JSON.stringify(validClaims({ movieId: "another-movie" })),
    "utf8",
  ).toString("base64url");
  const tampered = `${parts[0]}.${changedPayload}.${parts[2]}`;
  const result = verifySignedPlaybackGrant(tampered, SECRET, NOW);
  assert.deepEqual(result, { valid: false, reason: "BAD_SIGNATURE" });
});

test("rejects malformed tokens and undersized signing secrets", () => {
  assert.deepEqual(
    verifySignedPlaybackGrant("not-a-token", SECRET, NOW),
    { valid: false, reason: "MALFORMED" },
  );
  assert.deepEqual(
    verifySignedPlaybackGrant(signFixture(validClaims()), "short", NOW),
    { valid: false, reason: "INVALID_SECRET" },
  );
});

test("rejects grants issued in the future", () => {
  const token = signFixture(validClaims({ iat: NOW_SECONDS + 1, exp: NOW_SECONDS + 30 }));
  assert.deepEqual(
    verifySignedPlaybackGrant(token, SECRET, NOW),
    { valid: false, reason: "ISSUED_IN_FUTURE" },
  );
});

test("rejects grants whose lifetime exceeds the five-minute cap", () => {
  const token = signFixture(
    validClaims({ exp: NOW_SECONDS + MAX_PLAYBACK_GRANT_TTL_SECONDS + 1 }),
  );
  assert.deepEqual(
    verifySignedPlaybackGrant(token, SECRET, NOW),
    { valid: false, reason: "LIFETIME_EXCEEDED" },
  );
});

test("allows a signed, in-scope grant when every authorization condition passes", () => {
  assert.deepEqual(evaluatePlaybackAuthorization(authorizationInput()), {
    allowed: true,
    reason: "AUTHORIZED",
  });
});

test("denies unauthenticated and banned users", () => {
  assert.deepEqual(
    evaluatePlaybackAuthorization(authorizationInput({ userId: null })),
    { allowed: false, reason: "UNAUTHENTICATED" },
  );
  assert.deepEqual(
    evaluatePlaybackAuthorization(authorizationInput({ isBanned: true })),
    { allowed: false, reason: "USER_BANNED" },
  );
});

test("denies invalid and context-mismatched grants", () => {
  assert.deepEqual(
    evaluatePlaybackAuthorization(
      authorizationInput({
        grant: { valid: false, reason: "BAD_SIGNATURE" },
      }),
    ),
    { allowed: false, reason: "GRANT_INVALID" },
  );
  assert.deepEqual(
    evaluatePlaybackAuthorization(
      authorizationInput({ userId: "another-user" }),
    ),
    { allowed: false, reason: "GRANT_CONTEXT_MISMATCH" },
  );
  assert.deepEqual(
    evaluatePlaybackAuthorization(
      authorizationInput({ movieId: "another-movie" }),
    ),
    { allowed: false, reason: "GRANT_CONTEXT_MISMATCH" },
  );
  assert.deepEqual(
    evaluatePlaybackAuthorization(
      authorizationInput({ countryCode: "SG" }),
    ),
    { allowed: false, reason: "GRANT_CONTEXT_MISMATCH" },
  );
});

test("denies an expired verified grant at the exact expiry boundary", () => {
  const exp = NOW_SECONDS + 30;
  const grant = verifySignedPlaybackGrant(
    signFixture(validClaims({ exp })),
    SECRET,
    new Date(exp * 1000 - 1),
  );
  assert.equal(grant.valid, true);
  assert.deepEqual(
    evaluatePlaybackAuthorization({
      ...authorizationInput(),
      grant,
      now: new Date(exp * 1000),
    }),
    { allowed: false, reason: "GRANT_EXPIRED" },
  );
});

test("denies unpublished or non-published content", () => {
  assert.deepEqual(
    evaluatePlaybackAuthorization(
      authorizationInput({
        movie: {
          isPublished: false,
          contentStatus: "PUBLISHED",
          movieType: "FREE",
        },
      }),
    ),
    { allowed: false, reason: "CONTENT_UNAVAILABLE" },
  );
  assert.deepEqual(
    evaluatePlaybackAuthorization(
      authorizationInput({
        movie: {
          isPublished: true,
          contentStatus: "UNPUBLISHED",
          movieType: "FREE",
        },
      }),
    ),
    { allowed: false, reason: "CONTENT_UNAVAILABLE" },
  );
});

test("treats licence start as inclusive and expiry as exclusive", () => {
  const atStart = authorizationInput({
    license: {
      status: "ACTIVE",
      startsAt: NOW,
      expiresAt: new Date(NOW.getTime() + 60_000),
      allowedCountries: ["IN"],
    },
  });
  assert.equal(evaluatePlaybackAuthorization(atStart).allowed, true);

  const atExpiry = authorizationInput({
    license: {
      status: "ACTIVE",
      startsAt: new Date(NOW.getTime() - 60_000),
      expiresAt: NOW,
      allowedCountries: ["IN"],
    },
  });
  assert.deepEqual(evaluatePlaybackAuthorization(atExpiry), {
    allowed: false,
    reason: "LICENSE_INACTIVE",
  });
});

test("denies inactive licences and unlicensed territories", () => {
  assert.deepEqual(
    evaluatePlaybackAuthorization(
      authorizationInput({
        license: {
          status: "PENDING",
          startsAt: new Date(NOW.getTime() - 60_000),
          expiresAt: new Date(NOW.getTime() + 60_000),
          allowedCountries: ["IN"],
        },
      }),
    ),
    { allowed: false, reason: "LICENSE_INACTIVE" },
  );
  assert.deepEqual(
    evaluatePlaybackAuthorization(
      authorizationInput({
        license: {
          status: "ACTIVE",
          startsAt: new Date(NOW.getTime() - 60_000),
          expiresAt: new Date(NOW.getTime() + 60_000),
          allowedCountries: ["SG"],
        },
      }),
    ),
    { allowed: false, reason: "TERRITORY_DENIED" },
  );
});

test("requires premium catalogue entitlement only for premium titles", () => {
  const premiumMovie = {
    isPublished: true,
    contentStatus: "PUBLISHED",
    movieType: "PREMIUM" as const,
  };
  assert.deepEqual(
    evaluatePlaybackAuthorization(
      authorizationInput({ movie: premiumMovie, hasPremiumCatalogEntitlement: false }),
    ),
    { allowed: false, reason: "PREMIUM_ENTITLEMENT_REQUIRED" },
  );
  assert.deepEqual(
    evaluatePlaybackAuthorization(
      authorizationInput({ movie: premiumMovie, hasPremiumCatalogEntitlement: true }),
    ),
    { allowed: true, reason: "AUTHORIZED" },
  );
});

test("denies authorization when a caller forges an unverified claims object", () => {
  const forgedGrant = {
    valid: true,
    grant: { claims: validClaims() },
  } as unknown as PlaybackGrantVerification;
  assert.deepEqual(
    evaluatePlaybackAuthorization(authorizationInput({ grant: forgedGrant })),
    { allowed: false, reason: "GRANT_INVALID" },
  );
});
