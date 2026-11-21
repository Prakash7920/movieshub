import { createHmac, timingSafeEqual } from "node:crypto";

export const MAX_PLAYBACK_GRANT_TTL_SECONDS = 5 * 60;

export type PlaybackGrantClaims = {
  sub: string;
  movieId: string;
  countryCode: string;
  iat: number;
  exp: number;
};

export type PlaybackGrantFailureReason =
  | "MALFORMED"
  | "UNSUPPORTED_VERSION"
  | "INVALID_SECRET"
  | "BAD_SIGNATURE"
  | "INVALID_CLAIMS"
  | "ISSUED_IN_FUTURE"
  | "EXPIRED"
  | "LIFETIME_EXCEEDED";

export type PlaybackGrantVerification =
  | { valid: true; claims: PlaybackGrantClaims }
  | { valid: false; reason: PlaybackGrantFailureReason };

function invalidGrant(reason: PlaybackGrantFailureReason): PlaybackGrantVerification {
  return { valid: false, reason };
}

/**
 * Verifies a compact v1 HMAC-SHA256 playback grant.
 *
 * The token format is v1.<base64url-json>.<base64url-hmac>. This verifier
 * deliberately does not issue grants or produce media URLs.
 */
export function verifySignedPlaybackGrant(
  token: string,
  signingSecret: string,
  now = new Date(),
): PlaybackGrantVerification {
  if (typeof token !== "string" || token.length === 0 || token.length > 4096) {
    return invalidGrant("MALFORMED");
  }
  if (typeof signingSecret !== "string" || Buffer.byteLength(signingSecret, "utf8") < 32) {
    return invalidGrant("INVALID_SECRET");
  }

  const parts = token.split(".");
  if (parts.length !== 3) return invalidGrant("MALFORMED");

  const [version, payloadPart, signaturePart] = parts;
  if (version !== "v1") return invalidGrant("UNSUPPORTED_VERSION");
  if (
    !payloadPart ||
    !signaturePart ||
    !/^[A-Za-z0-9_-]+$/.test(payloadPart) ||
    !/^[A-Za-z0-9_-]+$/.test(signaturePart)
  ) {
    return invalidGrant("MALFORMED");
  }

  const payloadBytes = Buffer.from(payloadPart, "base64url");
  const suppliedSignature = Buffer.from(signaturePart, "base64url");
  if (
    payloadBytes.length === 0 ||
    payloadBytes.toString("base64url") !== payloadPart ||
    suppliedSignature.toString("base64url") !== signaturePart
  ) {
    return invalidGrant("MALFORMED");
  }

  const signingInput = `${version}.${payloadPart}`;
  const expectedSignature = createHmac("sha256", signingSecret)
    .update(signingInput)
    .digest();

  if (
    suppliedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    return invalidGrant("BAD_SIGNATURE");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(payloadBytes.toString("utf8"));
  } catch {
    return invalidGrant("INVALID_CLAIMS");
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return invalidGrant("INVALID_CLAIMS");
  }

  const record = payload as Record<string, unknown>;
  const expectedKeys = ["countryCode", "exp", "iat", "movieId", "sub"];
  if (Object.keys(record).sort().join(",") !== expectedKeys.join(",")) {
    return invalidGrant("INVALID_CLAIMS");
  }

  const { sub, movieId, countryCode, iat, exp } = record;
  if (
    typeof sub !== "string" ||
    sub.length === 0 ||
    sub.length > 128 ||
    typeof movieId !== "string" ||
    movieId.length === 0 ||
    movieId.length > 128 ||
    typeof countryCode !== "string" ||
    !/^[A-Z]{2}$/.test(countryCode) ||
    typeof iat !== "number" ||
    !Number.isSafeInteger(iat) ||
    iat <= 0 ||
    typeof exp !== "number" ||
    !Number.isSafeInteger(exp) ||
    exp <= iat
  ) {
    return invalidGrant("INVALID_CLAIMS");
  }

  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) return invalidGrant("INVALID_CLAIMS");

  if (iat * 1000 > nowMs) return invalidGrant("ISSUED_IN_FUTURE");
  if (exp * 1000 <= nowMs) return invalidGrant("EXPIRED");
  if (exp - iat > MAX_PLAYBACK_GRANT_TTL_SECONDS) {
    return invalidGrant("LIFETIME_EXCEEDED");
  }

  return {
    valid: true,
    claims: { sub, movieId, countryCode, iat, exp },
  };
}

export type PlaybackAuthorizationFailureReason =
  | "UNAUTHENTICATED"
  | "USER_BANNED"
  | "GRANT_INVALID"
  | "GRANT_EXPIRED"
  | "GRANT_CONTEXT_MISMATCH"
  | "CONTENT_UNAVAILABLE"
  | "LICENSE_INACTIVE"
  | "TERRITORY_DENIED"
  | "PREMIUM_ENTITLEMENT_REQUIRED";

export type PlaybackAuthorizationResult =
  | { allowed: true; reason: "AUTHORIZED" }
  | { allowed: false; reason: PlaybackAuthorizationFailureReason };

export type PlaybackAuthorizationInput = {
  userId: string | null;
  isBanned: boolean;
  movieId: string;
  countryCode: string;
  movie: {
    isPublished: boolean;
    contentStatus: string;
    movieType: "FREE" | "PREMIUM";
  };
  license: {
    status: string;
    startsAt: Date;
    expiresAt: Date;
    allowedCountries: string[];
  };
  hasPremiumCatalogEntitlement: boolean;
  grant: PlaybackGrantVerification;
  now?: Date;
};

/**
 * Evaluates server-side playback policy using already-loaded authoritative
 * user, movie, licence, and entitlement data plus a verified signed grant.
 * License and grant end boundaries are exclusive: expiry must be strictly
 * later than now. Callers must never trust client-supplied policy data.
 */
export function evaluatePlaybackAuthorization(
  input: PlaybackAuthorizationInput,
): PlaybackAuthorizationResult {
  const deny = (reason: PlaybackAuthorizationFailureReason): PlaybackAuthorizationResult => ({
    allowed: false,
    reason,
  });

  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) return deny("GRANT_INVALID");

  if (typeof input.userId !== "string" || input.userId.length === 0) {
    return deny("UNAUTHENTICATED");
  }
  if (input.isBanned) return deny("USER_BANNED");
  if (!input.grant.valid) {
    return deny(input.grant.reason === "EXPIRED" ? "GRANT_EXPIRED" : "GRANT_INVALID");
  }

  const claims = input.grant.claims;
  if (claims.exp * 1000 <= nowMs) return deny("GRANT_EXPIRED");
  if (
    claims.iat * 1000 > nowMs ||
    claims.sub !== input.userId ||
    claims.movieId !== input.movieId ||
    claims.countryCode !== input.countryCode
  ) {
    return deny("GRANT_CONTEXT_MISMATCH");
  }

  if (
    !input.movie.isPublished ||
    input.movie.contentStatus !== "PUBLISHED"
  ) {
    return deny("CONTENT_UNAVAILABLE");
  }

  const startsAtMs = input.license.startsAt.getTime();
  const expiresAtMs = input.license.expiresAt.getTime();
  if (
    input.license.status !== "ACTIVE" ||
    !Number.isFinite(startsAtMs) ||
    !Number.isFinite(expiresAtMs) ||
    startsAtMs > nowMs ||
    expiresAtMs <= nowMs
  ) {
    return deny("LICENSE_INACTIVE");
  }

  if (
    !/^[A-Z]{2}$/.test(input.countryCode) ||
    !input.license.allowedCountries.some(
      (country) => country.toUpperCase() === input.countryCode,
    )
  ) {
    return deny("TERRITORY_DENIED");
  }

  if (input.movie.movieType === "PREMIUM" && !input.hasPremiumCatalogEntitlement) {
    return deny("PREMIUM_ENTITLEMENT_REQUIRED");
  }

  return { allowed: true, reason: "AUTHORIZED" };
}
