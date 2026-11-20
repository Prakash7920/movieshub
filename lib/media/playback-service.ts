import {
  evaluatePlaybackAccess,
  type PlaybackLicensePolicy,
  type PlaybackAccessDenialReason,
} from "@/lib/media/access-policy";

export type PlaybackAccountRecord = {
  isBanned: boolean;
};

export type PlaybackMovieRecord = {
  isPublished: boolean;
  contentStatus: string;
  movieType: "FREE" | "PREMIUM";
  videoUrl: string | null;
  license: PlaybackLicensePolicy | null;
};

export type PlaybackServiceResult = {
  status: number;
  body: { error: string; code: string };
};

export type PlaybackServiceDependencies = {
  findAccount(userId: string): Promise<PlaybackAccountRecord | null>;
  findMovie(slug: string): Promise<PlaybackMovieRecord | null>;
  getPremiumEntitlement(userId: string): Promise<boolean>;
};

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
      return { status: 503, body: { error: "Secure media delivery is not configured yet.", code: "MEDIA_DELIVERY_NOT_CONFIGURED" } };
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
 * Server-side playback authorization preflight.
 * It deliberately never returns the source URL. Until a reviewed storage
 * signer is integrated, every otherwise-authorized request fails closed.
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

  const movie = await dependencies.findMovie(slug);
  if (!movie) {
    return { status: 404, body: { error: "This title is not available for playback.", code: "TITLE_UNAVAILABLE" } };
  }

  const hasPremiumEntitlement = await dependencies.getPremiumEntitlement(input.userId);

  // Intentionally false: no storage provider/signing adapter has been
  // selected or reviewed. Environment variables alone must never enable it.
  const storageSignerAdapterReady = false;

  const decision = evaluatePlaybackAccess({
    authenticated: true,
    accountAllowed: true,
    moviePublished: movie.isPublished,
    contentStatus: movie.contentStatus,
    movieType: movie.movieType,
    mediaSource: movie.videoUrl,
    license: movie.license,
    viewerCountry: input.viewerCountry,
    hasPremiumEntitlement,
    storageConfigured: storageSignerAdapterReady,
    signingSecretConfigured: Boolean(process.env.MEDIA_SIGNING_SECRET?.trim()),
  });

  if (!decision.allowed) {
    return denied(decision.reason);
  }

  // This remains unreachable until a real, reviewed storage signer replaces
  // the explicit false gate above. Never return movie.videoUrl to the client.
  return {
    status: 503,
    body: { error: "Secure media delivery is not configured yet.", code: "MEDIA_DELIVERY_NOT_CONFIGURED" },
  };
}
