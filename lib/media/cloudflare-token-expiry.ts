type JsonRecord = Record<string, unknown>;

function decodeBase64UrlJson(segment: string): JsonRecord | null {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) return null;

  try {
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as JsonRecord;
  } catch {
    return null;
  }
}

function readUnixSeconds(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value)
        ? Number(value)
        : Number.NaN;

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Reads the expiry claim from a Cloudflare Stream signed JWT.
 *
 * This is a consistency check, not signature verification. The grant must
 * originate from the authenticated server-side Cloudflare API call; the
 * Cloudflare delivery edge remains responsible for cryptographic validation.
 */
export function getCloudflareSignedTokenExpirySeconds(
  token: unknown,
): number | null {
  if (typeof token !== "string" || token.length === 0 || token.length > 4096) {
    return null;
  }

  const parts = token.split(".");
  if (
    parts.length !== 3 ||
    parts.some((part) => !part || !/^[A-Za-z0-9_-]+$/.test(part))
  ) {
    return null;
  }

  const header = decodeBase64UrlJson(parts[0]);
  const payload = decodeBase64UrlJson(parts[1]);
  if (
    !header ||
    header.alg !== "RS256" ||
    typeof header.kid !== "string" ||
    header.kid.trim().length === 0 ||
    !payload
  ) {
    return null;
  }

  return readUnixSeconds(payload.exp);
}
