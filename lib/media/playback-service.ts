import {
  evaluatePlaybackAccess,
  type PlaybackLicensePolicy,
  type PlaybackAccessDenialReason,
} from "@/lib/media/access-policy";
import type { CloudflarePlaybackGrant } from "@/lib/media/cloudflare-stream";

export type PlaybackGrantRateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export type PlaybackAccountRecord = {
  isBanned: boolean;
};

export type PlaybackMovieRecord = {
  isPublished: boolean;
  contentStatus: string;
  movieType: "FREE" | "PREMIUM";
  cloudflareStreamUid: string | null;
  license: PlaybackLicensePolicy | null;
};

type PlaybackErrorBody = { error: string; code: string };

export type PlaybackServiceResult = {
  status: number;
  body: PlaybackErrorBody | CloudflarePlaybackGrant;
  retryAfterSeconds?: number;
};

export type PlaybackServiceDependencies = {
  findAccount(userId: string): Promise<PlaybackAccountRecord | null>;
  findMovie(slug: string): Promise<PlaybackMovieRecord | null>;
  getPremiumEntitlement(userId: string): Promise<boolean>;
  /** A required, user-scoped throttle for every enabled grant request. */
  consumePlaybackGrantRateLimit(userId: string): Promise<PlaybackGrantRateLimitDecision>;
  /**
   * Omit unless the explicit Cloudflare feature flag and complete provider
   * configuration are present. The service never infers readiness from
   * arbitrary storage environment variables.
   */
  createPlaybackGrant?: (
    assetUid: string,
    viewerCountry: string,
  ) => Promise<CloudflarePlaybackGrant>;
};

function unavailable(): PlaybackServiceResult {
  return {
    status: 503,
    body: {
      error: "Secure media delivery is not configured yet.",
      code: "MEDIA_DELIVERY_NOT_CONFIGURED",
    },
  };
}

function denied(reason: PlaybackAccessDenialReason): PlaybackServiceResult {
  switch (reason) {
    case "AUTHENTICATION_REQUIRED":
      return { status: 401, body: { error: "Sign in to request playback.", code: reason } };
    case "ACCOUNT_BLOCKED":
      return { status: 403, body: { error: "Playback is unavailable for this account.", code: reason } };
    case "PREMIUM_REQUIRED":
      return { status: 403, body: { error: "Premium access is required for this title.", code: reason } };
    case "TERRITORY_UNVERIFIED":
      return { status: 503, body: { error: "Your viewing territory could not be verified.", code: reason } };
    case "MEDIA_SOURCE_UNAVAILABLE":
    case "STORAGE_NOT_CONFIGURED":
    case "SIGNING_SECRET_NOT_CONFIGURED":
      return unavailable();
    case "CONTENT_UNAVAILABLE":
    case "LICENSE_UNAVAILABLE":
    case "LICENSE_INACTIVE":
    case "LICENSE_NOT_STARTED":
    case "LICENSE_EXPIRED":
    case "TERRITORY_NOT_LICENSED":
      return { status: 404, body: { error: "This title is not available for playback in your territory.", code: "TITLE_UNAVAILABLE" } };
  }
}

/**
 * Server-side playback authorization and grant issuance.
 *
 * The provider adapter is optional and the production route supplies it only
 * when CLOUDFLARE_STREAM_ENABLED=true and all required credentials are valid.
 * When disabled, this function exits before looking up a Movie, so a Preview
 * database without the new asset-UID column remains safely fail-closed.
 */
export async function authorizePlaybackRequest(
  input: { userId: string | null; slug: string; viewerCountry: string | null },
  dependencies: PlaybackServiceDependencies,
): Promise<PlaybackServiceResult> {
  if (!input.userId) {
    return { status: 401, body: { error: "Sign in to request playback.", code: "AUTHENTICATION_REQUIRED" } };
  }

  const slug = input.slug.trim();
  if (!slug || slug.length > 120) {
    return { status: 400, body: { error: "A valid movie slug is required.", code: "INVALID_MOVIE_SLUG" } };
  }

  const account = await dependencies.findAccount(input.userId);
  if (!account) {
    return { status: 401, body: { error: "Sign in to request playback.", code: "AUTHENTICATION_REQUIRED" } };
  }
  if (account.isBanned) {
    return denied("ACCOUNT_BLOCKED");
  }

  // Explicit default-OFF gate. Do not query the Movie model or call Cloudflare
  // until a separately configured provider adapter is supplied by the route.
  if (!dependencies.createPlaybackGrant) {
    return unavailable();
  }

  // Apply one shared per-user budget across titles so changing slugs cannot
  // bypass the grant-issuance throttle. Limiter failures must fail closed.
  let rateLimit: PlaybackGrantRateLimitDecision;
  try {
    rateLimit = await dependencies.consumePlaybackGrantRateLimit(input.userId);
  } catch {
    return {
      status: 503,
      body: {
        error: "Playback authorization is temporarily unavailable.",
        code: "PLAYBACK_RATE_LIMIT_UNAVAILABLE",
      },
    };
  }

  if (!rateLimit.allowed) {
    const retryAfterSeconds =
      Number.isFinite(rateLimit.retryAfterSeconds) && rateLimit.retryAfterSeconds > 0
        ? Math.ceil(rateLimit.retryAfterSeconds)
        : 60;
    return {
      status: 429,
      body: {
        error: "Too many playback requests. Please try again shortly.",
        code: "PLAYBACK_RATE_LIMITED",
      },
      retryAfterSeconds,
    };
  }

  const movie = await dependencies.findMovie(slug);
  if (!movie) {
    return { status: 404, body: { error: "This title is not available for playback.", code: "TITLE_UNAVAILABLE" } };
  }

  const hasPremiumEntitlement = await dependencies.getPremiumEntitlement(input.userId);

  const decision = evaluatePlaybackAccess({
    authenticated: true,
    accountAllowed: true,
    moviePublished: movie.isPublished,
    contentStatus: movie.contentStatus,
    movieType: movie.movieType,
    mediaSource: movie.cloudflareStreamUid,
    license: movie.license,
    viewerCountry: input.viewerCountry,
    hasPremiumEntitlement,
    storageConfigured: true,
    // The provider API credential authorizes Cloudflare's managed token
    // issuance endpoint. No local signing key is required by this adapter.
    signingSecretConfigured: true,
  });

  if (!decision.allowed) {
    return denied(decision.reason);
  }

  // The policy has established a valid country and non-empty provider UID.
  const viewerCountry = input.viewerCountry!.trim().toUpperCase();
  try {
    return {
      status: 200,
      body: await dependencies.createPlaybackGrant(movie.cloudflareStreamUid!, viewerCountry),
    };
  } catch {
    // Provider responses and credentials are deliberately not surfaced.
    return {
      status: 503,
      body: {
        error: "Secure media delivery is temporarily unavailable.",
        code: "MEDIA_PROVIDER_UNAVAILABLE",
      },
    };
  }
}
