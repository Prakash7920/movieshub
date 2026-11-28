export type PlaybackLicensePolicy = {
  status: string;
  startDate: Date;
  expiryDate: Date;
  allowedCountries: readonly string[];
};

export type PlaybackAccessInput = {
  authenticated: boolean;
  accountAllowed: boolean;
  moviePublished: boolean;
  contentStatus: string;
  movieType: "FREE" | "PREMIUM";
  mediaSource: string | null;
  license: PlaybackLicensePolicy | null;
  viewerCountry: string | null;
  hasPremiumEntitlement: boolean;
  storageConfigured: boolean;
  signingSecretConfigured: boolean;
  now?: Date;
};

export type PlaybackAccessDenialReason =
  | "AUTHENTICATION_REQUIRED"
  | "ACCOUNT_BLOCKED"
  | "CONTENT_UNAVAILABLE"
  | "TERRITORY_UNVERIFIED"
  | "LICENSE_UNAVAILABLE"
  | "LICENSE_INACTIVE"
  | "LICENSE_NOT_STARTED"
  | "LICENSE_EXPIRED"
  | "TERRITORY_NOT_LICENSED"
  | "PREMIUM_REQUIRED"
  | "MEDIA_SOURCE_UNAVAILABLE"
  | "STORAGE_NOT_CONFIGURED"
  | "SIGNING_SECRET_NOT_CONFIGURED";

export type PlaybackAccessDecision =
  | { allowed: true }
  | { allowed: false; reason: PlaybackAccessDenialReason };

/**
 * Pure fail-closed playback policy. Call only from a server-side route/service.
 * This function does not sign, return, or expose a media URL.
 */
export function evaluatePlaybackAccess(
  input: PlaybackAccessInput,
): PlaybackAccessDecision {
  if (!input.authenticated) {
    return { allowed: false, reason: "AUTHENTICATION_REQUIRED" };
  }

  if (!input.accountAllowed) {
    return { allowed: false, reason: "ACCOUNT_BLOCKED" };
  }

  if (!input.moviePublished || input.contentStatus !== "PUBLISHED") {
    return { allowed: false, reason: "CONTENT_UNAVAILABLE" };
  }

  const country = input.viewerCountry?.trim().toUpperCase() ?? "";
  if (!/^[A-Z]{2}$/.test(country)) {
    return { allowed: false, reason: "TERRITORY_UNVERIFIED" };
  }

  const license = input.license;
  if (!license) {
    return { allowed: false, reason: "LICENSE_UNAVAILABLE" };
  }

  if (license.status !== "ACTIVE") {
    return { allowed: false, reason: "LICENSE_INACTIVE" };
  }

  const now = input.now ?? new Date();
  const startTime = license.startDate instanceof Date
    ? license.startDate.getTime()
    : Number.NaN;
  const expiryTime = license.expiryDate instanceof Date
    ? license.expiryDate.getTime()
    : Number.NaN;

  if (!Number.isFinite(startTime) || !Number.isFinite(expiryTime) || expiryTime <= startTime) {
    return { allowed: false, reason: "LICENSE_UNAVAILABLE" };
  }

  if (startTime > now.getTime()) {
    return { allowed: false, reason: "LICENSE_NOT_STARTED" };
  }

  if (expiryTime <= now.getTime()) {
    return { allowed: false, reason: "LICENSE_EXPIRED" };
  }

  const permitted = license.allowedCountries.some(
    (allowedCountry) => allowedCountry.trim().toUpperCase() === country,
  );
  if (!permitted) {
    return { allowed: false, reason: "TERRITORY_NOT_LICENSED" };
  }

  if (input.movieType === "PREMIUM" && !input.hasPremiumEntitlement) {
    return { allowed: false, reason: "PREMIUM_REQUIRED" };
  }

  if (!input.mediaSource?.trim()) {
    return { allowed: false, reason: "MEDIA_SOURCE_UNAVAILABLE" };
  }

  if (!input.storageConfigured) {
    return { allowed: false, reason: "STORAGE_NOT_CONFIGURED" };
  }

  if (!input.signingSecretConfigured) {
    return { allowed: false, reason: "SIGNING_SECRET_NOT_CONFIGURED" };
  }

  return { allowed: true };
}
