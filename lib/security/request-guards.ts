function getExpectedRequestOrigin(request: Request): string | null {
  let requestUrl: URL;
  try {
    requestUrl = new URL(request.url);
  } catch {
    return null;
  }

  // Behind a reverse proxy, request.url can contain an internal origin.
  // The Host header is the authority actually addressed by the browser;
  // x-forwarded-proto supplies the original scheme when TLS ends at the proxy.
  const host = request.headers.get("host")?.trim() || requestUrl.host;
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const protocolValue = forwardedProtocol?.replace(/:$/, "") || requestUrl.protocol.replace(/:$/, "");
  if (protocolValue !== "http" && protocolValue !== "https") return null;

  try {
    return new URL(`${protocolValue}://${host}`).origin;
  } catch {
    return null;
  }
}

export function isSameOriginRequest(request: Request): boolean {
  const source = request.headers.get("origin") || request.headers.get("referer");
  if (!source) return false;

  const expectedOrigin = getExpectedRequestOrigin(request);
  if (!expectedOrigin) return false;

  try {
    return new URL(source).origin === expectedOrigin;
  } catch {
    return false;
  }
}

export async function hasValidJsonContentType(request: Request, maxBytes = 16 * 1024): Promise<boolean> {
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (contentType !== "application/json") return false;
  const rawLength = request.headers.get("content-length");
  if (rawLength !== null) {
    const length = Number(rawLength);
    if (!Number.isSafeInteger(length) || length < 0 || length > maxBytes) return false;
  }
  try { return new TextEncoder().encode(await request.clone().text()).byteLength <= maxBytes; }
  catch { return false; }
}
