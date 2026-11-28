# Playback Authorization & Signed-Grant Expiry Boundary Verification

## Scope

This checkpoint hardens the existing Phase 5 media path. It does not add another playback API, a new token issuer, or a new media provider. Playback remains controlled by the existing explicit-off feature flags and the current release gates.

## Verified authorization boundaries

The existing server-side access policy checks authentication, account state, publication status, territory, active licence dates, premium entitlement, media source, storage configuration, and signing configuration before the Cloudflare grant adapter is called.

Licence start is inclusive: `startDate <= now`. Licence expiry is exclusive: `expiryDate > now`. The test suite now asserts access one millisecond before expiry, denial at the exact instant, and denial one millisecond after.

The subscription entitlement query also uses an exclusive end date (`endDate > now`); no change to subscription or payment state was made.

## Signed-grant consistency

Cloudflare Stream returns a signed HLS JWT. This checkpoint introduces a shared, browser-compatible parser for the token's JWT header and `exp` claim:

- JWT header must use `RS256` and include a non-empty `kid`.
- `exp` must be a positive, safe integer Unix timestamp (numeric or digit-string representation).
- The server rejects a provider token unless its embedded `exp` exactly matches the expiry requested from Cloudflare.
- The client rejects a grant unless its `expiresAt` metadata is a whole-second timestamp and exactly matches the token's embedded `exp`.
- Expiry is exclusive: valid only while `exp * 1000 > now`. At equality or after it, the grant is rejected.
- The client parser only checks claim/metadata consistency. It does not cryptographically verify the JWT signature; the token originates from the authenticated server-to-Cloudflare request and Cloudflare's delivery edge enforces the signed token.

## Automated test coverage

The existing `npm test` suite includes coverage for:
- a grant one millisecond before expiry;
- exact expiry and one millisecond after expiry;
- expiry metadata ahead of, behind, or at sub-second precision relative to JWT `exp`;
- malformed token payloads, unexpected algorithm and missing expiry claim;
- a provider response whose signed `exp` differs from the requested expiry;
- licence expiry one millisecond before, exactly at, and one millisecond after the boundary;
- the existing authorization checks for account status, content publication, territory, licence state, premium entitlement, and feature-flag default-off behavior.

## Release and execution boundary

These are deterministic unit tests with synthetic JWT fixtures and mocked Cloudflare responses. They do not call Cloudflare, create real provider grants, change Vercel variables, update a database, or enable playback. The task is not PASS until the current Phase 5 GitHub Actions run completes successfully. Preview deployment validation and Production activation remain separate gates.
