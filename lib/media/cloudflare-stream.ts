export type CloudflareStreamConfig = {
  accountId: string;
  apiToken: string;
  customerCode: string;
};

export type CloudflarePlaybackGrantInput = {
  assetUid: string;
  /** Must come from trusted asset metadata showing requireSignedURLs=true. */
  assetRequiresSignedUrls: boolean;
  viewerCountry: string;
  ttlSeconds?: number;
  now?: Date;
};

export type CloudflarePlaybackGrant = {
  protocol: "hls";
  manifestUrl: string;
  expiresAt: string;
};

type FetchResponseLike = Pick<Response, "ok" | "status" | "json">;
export type CloudflareFetch = (
  input: string,
  init: RequestInit,
) => Promise<FetchResponseLike>;

export class CloudflareStreamDeliveryError extends Error {
  constructor(
    message: string,
    readonly code:
      | "INVALID_CONFIGURATION"
      | "INVALID_REQUEST"
      | "PROVIDER_REJECTED"
      | "INVALID_PROVIDER_RESPONSE",
  ) {
    super(message);
    this.name = "CloudflareStreamDeliveryError";
  }
}

const DEFAULT_TTL_SECONDS = 5 * 60;
const MIN_TTL_SECONDS = 60;
const MAX_TTL_SECONDS = 15 * 60;
const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateConfig(config: CloudflareStreamConfig): void {
  if (
    !/^[a-f0-9]{32}$/i.test(config.accountId) ||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(config.customerCode) ||
    !config.apiToken.trim() ||
    /[\r\n]/.test(config.apiToken)
  ) {
    throw new CloudflareStreamDeliveryError(
      "Cloudflare Stream configuration is invalid.",
      "INVALID_CONFIGURATION",
    );
  }
}

/**
 * Creates a short-lived, country-bound HLS grant for a private Stream asset.
 *
 * This adapter never enables public playback, never enables downloads, and
 * never returns the provider asset UID or API credential. Callers must first
 * complete NexaFilm's independent account, entitlement and licence checks.
 */
export async function createCloudflareStreamPlaybackGrant(
  input: CloudflarePlaybackGrantInput,
  config: CloudflareStreamConfig,
  fetcher: CloudflareFetch = fetch,
): Promise<CloudflarePlaybackGrant> {
  validateConfig(config);

  if (!/^[a-f0-9]{32}$/i.test(input.assetUid)) {
    throw new CloudflareStreamDeliveryError(
      "Cloudflare Stream asset identifier is invalid.",
      "INVALID_REQUEST",
    );
  }

  if (input.assetRequiresSignedUrls !== true) {
    throw new CloudflareStreamDeliveryError(
      "The Stream asset is not verified as private.",
      "INVALID_REQUEST",
    );
  }

  const country = typeof input.viewerCountry === "string"
    ? input.viewerCountry.trim().toUpperCase()
    : "";
  if (!/^[A-Z]{2}$/.test(country)) {
    throw new CloudflareStreamDeliveryError(
      "A verified ISO country code is required.",
      "INVALID_REQUEST",
    );
  }

  const ttlSeconds = input.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  if (
    !Number.isInteger(ttlSeconds) ||
    ttlSeconds < MIN_TTL_SECONDS ||
    ttlSeconds > MAX_TTL_SECONDS
  ) {
    throw new CloudflareStreamDeliveryError(
      "Playback grant lifetime is outside the permitted range.",
      "INVALID_REQUEST",
    );
  }

  const now = input.now ?? new Date();
  const issuedAt = Math.floor(now.getTime() / 1000);
  if (!Number.isFinite(issuedAt)) {
    throw new CloudflareStreamDeliveryError(
      "Playback grant clock is invalid.",
      "INVALID_REQUEST",
    );
  }
  const expiresAtSeconds = issuedAt + ttlSeconds;

  const endpoint =
    `${CLOUDFLARE_API}/accounts/${config.accountId}/stream/${input.assetUid}/token`;

  let response: FetchResponseLike;
  try {
    response = await fetcher(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        exp: expiresAtSeconds,
        downloadable: false,
        accessRules: [
          {
            action: "allow",
            country: [country],
            type: "ip.geoip.country",
          },
          {
            action: "block",
            type: "any",
          },
        ],
      }),
      cache: "no-store",
    });
  } catch {
    throw new CloudflareStreamDeliveryError(
      "Cloudflare Stream could not be reached.",
      "PROVIDER_REJECTED",
    );
  }

  if (!response.ok) {
    throw new CloudflareStreamDeliveryError(
      `Cloudflare Stream rejected the playback grant request (HTTP ${response.status}).`,
      "PROVIDER_REJECTED",
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new CloudflareStreamDeliveryError(
      "Cloudflare Stream returned an unreadable response.",
      "INVALID_PROVIDER_RESPONSE",
    );
  }

  const result = isRecord(payload) && payload.success === true && isRecord(payload.result)
    ? payload.result
    : null;
  const token = result?.token;
  if (
    typeof token !== "string" ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
  ) {
    throw new CloudflareStreamDeliveryError(
      "Cloudflare Stream did not return a valid signed token.",
      "INVALID_PROVIDER_RESPONSE",
    );
  }

  const streamHost = `https://customer-${config.customerCode}.cloudflarestream.com`;
  const manifestUrl = new URL(`/${token}/manifest/video.m3u8`, streamHost).toString();

  return {
    protocol: "hls",
    manifestUrl,
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
  };
}
