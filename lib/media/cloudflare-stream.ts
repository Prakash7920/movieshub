import { getCloudflareSignedTokenExpirySeconds } from "./cloudflare-token-expiry";

export type CloudflareStreamConfig = {
  accountId: string;
  apiToken: string;
  customerCode: string;
};

export type CloudflarePlaybackGrantInput = {
  assetUid: string;
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
      | "INVALID_PROVIDER_RESPONSE"
      | "ASSET_NOT_PRIVATE"
      | "ASSET_NOT_READY",
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

async function readJson(
  response: FetchResponseLike,
): Promise<Record<string, unknown>> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new CloudflareStreamDeliveryError(
      "Cloudflare Stream returned an unreadable response.",
      "INVALID_PROVIDER_RESPONSE",
    );
  }

  if (!isRecord(payload) || payload.success !== true || !isRecord(payload.result)) {
    throw new CloudflareStreamDeliveryError(
      "Cloudflare Stream returned an invalid response.",
      "INVALID_PROVIDER_RESPONSE",
    );
  }

  return payload.result;
}

async function verifyPrivateReadyAsset(
  endpoint: string,
  assetUid: string,
  apiToken: string,
  fetcher: CloudflareFetch,
): Promise<void> {
  let response: FetchResponseLike;
  try {
    response = await fetcher(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
  } catch {
    throw new CloudflareStreamDeliveryError(
      "Cloudflare Stream asset details could not be retrieved.",
      "PROVIDER_REJECTED",
    );
  }

  if (!response.ok) {
    throw new CloudflareStreamDeliveryError(
      `Cloudflare Stream asset verification failed (HTTP ${response.status}).`,
      "PROVIDER_REJECTED",
    );
  }

  const details = await readJson(response);
  if (details.uid !== assetUid || details.requireSignedURLs !== true) {
    throw new CloudflareStreamDeliveryError(
      "The Cloudflare Stream asset is not verified as private.",
      "ASSET_NOT_PRIVATE",
    );
  }

  if (details.readyToStream !== true) {
    throw new CloudflareStreamDeliveryError(
      "The Cloudflare Stream asset is not ready for playback.",
      "ASSET_NOT_READY",
    );
  }
}

/**
 * Creates a short-lived, country-bound HLS grant for a private Stream asset.
 *
 * Before minting a token, this adapter independently reads the provider's
 * asset metadata and requires both requireSignedURLs=true and
 * readyToStream=true. Callers must first complete NexaFilm's own account,
 * entitlement, publication, territory and licence checks.
 *
 * This adapter never enables public playback or downloads and never returns
 * the provider API credential or raw source media URL.
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

  const country = input.viewerCountry.trim().toUpperCase();
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

  const assetEndpoint =
    `${CLOUDFLARE_API}/accounts/${config.accountId}/stream/${input.assetUid}`;
  await verifyPrivateReadyAsset(
    assetEndpoint,
    input.assetUid,
    config.apiToken,
    fetcher,
  );

  let response: FetchResponseLike;
  try {
    response = await fetcher(`${assetEndpoint}/token`, {
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
      "Cloudflare Stream could not issue a playback grant.",
      "PROVIDER_REJECTED",
    );
  }

  if (!response.ok) {
    throw new CloudflareStreamDeliveryError(
      `Cloudflare Stream rejected the playback grant request (HTTP ${response.status}).`,
      "PROVIDER_REJECTED",
    );
  }

  const result = await readJson(response);
  const token = result.token;
  if (
    typeof token !== "string" ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
  ) {
    throw new CloudflareStreamDeliveryError(
      "Cloudflare Stream did not return a valid signed token.",
      "INVALID_PROVIDER_RESPONSE",
    );
  }

  const tokenExpirySeconds = getCloudflareSignedTokenExpirySeconds(token);
  if (tokenExpirySeconds !== expiresAtSeconds) {
    throw new CloudflareStreamDeliveryError(
      "Cloudflare Stream returned a token with an unexpected expiry.",
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

/**
 * Reads Cloudflare Stream settings only when the explicit feature flag is on.
 * Missing or malformed settings keep playback disabled; no default-on path.
 */
export function getCloudflareStreamConfigFromEnv(
  values: Readonly<Record<string, string | undefined>> = process.env,
): CloudflareStreamConfig | null {
  if (
    values.CLOUDFLARE_STREAM_ENABLED !== "true" ||
    values.CLOUDFLARE_PLAYBACK_ENABLED !== "true"
  ) {
    return null;
  }

  const accountId = values.CLOUDFLARE_ACCOUNT_ID?.trim() ?? "";
  const apiToken = values.CLOUDFLARE_STREAM_API_TOKEN?.trim() ?? "";
  const customerCode = values.CLOUDFLARE_STREAM_CUSTOMER_CODE?.trim() ?? "";

  if (
    !/^[a-f0-9]{32}$/i.test(accountId) ||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(customerCode) ||
    !apiToken ||
    /[\r\n]/.test(apiToken)
  ) {
    return null;
  }

  return { accountId, apiToken, customerCode };
}
