/**
 * Produces deterministic JWT-shaped fixtures for mocked playback browser tests.
 * The signature is deliberately synthetic; these tests intercept every CDN
 * request and never exercise Cloudflare's cryptographic token verification.
 */
export function createMockPlaybackGrant(
  customerHost: string,
  expiresAt: Date,
  fixtureId: string,
) {
  const expirySeconds = Math.floor(expiresAt.getTime() / 1000);
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  const header = encode({ alg: "RS256", kid: `mock-${fixtureId}` });
  const payload = encode({ exp: String(expirySeconds), jti: fixtureId });
  const signature = encode({ mock: true, fixtureId });
  const token = `${header}.${payload}.${signature}`;

  return {
    protocol: "hls" as const,
    manifestUrl: `${customerHost}/${token}/manifest/video.m3u8`,
    expiresAt: new Date(expirySeconds * 1000).toISOString(),
  };
}
