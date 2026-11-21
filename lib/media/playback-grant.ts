import { getCloudflareSignedTokenExpirySeconds } from "./cloudflare-token-expiry";

export type PlaybackGrant = {
  protocol: "hls";
  manifestUrl: string;
  expiresAt: string;
};

const MAX_ACCEPTED_GRANT_LIFETIME_MS = 16 * 60 * 1000;
const CLOUDFLARE_CUSTOMER_HOST =
  /^customer-[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflarestream\.com$/i;
const SIGNED_HLS_PATH =
  /^\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\/manifest\/video\.m3u8$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Accept only a currently valid, short-lived Cloudflare signed HLS manifest.
 * This rejects arbitrary origins, HTTP URLs, raw asset UIDs and expired grants.
 */
export function parsePlaybackGrant(
  value: unknown,
  now = Date.now(),
): PlaybackGrant | null {
  if (!isRecord(value) || value.protocol !== "hls") {
    return null;
  }

  if (
    typeof value.manifestUrl !== "string" ||
    typeof value.expiresAt !== "string"
  ) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(value.manifestUrl);
  } catch {
    return null;
  }

  if (
    url.protocol !== "https:" ||
    !CLOUDFLARE_CUSTOMER_HOST.test(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !SIGNED_HLS_PATH.test(url.pathname)
  ) {
    return null;
  }

  const expiry = Date.parse(value.expiresAt);
  const signedToken = url.pathname.split("/")[1] ?? "";
  const tokenExpirySeconds = getCloudflareSignedTokenExpirySeconds(signedToken);
  if (
    !Number.isFinite(expiry) ||
    expiry <= now ||
    expiry > now + MAX_ACCEPTED_GRANT_LIFETIME_MS ||
    expiry % 1000 !== 0 ||
    tokenExpirySeconds === null ||
    tokenExpirySeconds * 1000 !== expiry
  ) {
    return null;
  }

  return {
    protocol: "hls",
    manifestUrl: url.toString(),
    expiresAt: new Date(expiry).toISOString(),
  };
}
