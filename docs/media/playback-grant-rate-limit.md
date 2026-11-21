# Playback Grant Rate Limiting

- **Checkpoint:** Phase 5.26
- **Date:** 2026-11-21
- **Branch:** `phase-5/consolidated-security-ops`
- **Policy:** 10 playback-grant requests per authenticated user per 5-minute window
- **Status:** Implemented; validation pending the current-head workflow result

## Enforcement

The media route supplies a required `consumePlaybackGrantRateLimit` dependency to `authorizePlaybackRequest`. It delegates to the existing shared PostgreSQL-backed `consumeRateLimit` helper using:

```ts
consumeRateLimit("media-playback-grant", userId, 10, 5 * 60)
```

The identifier is the authenticated user ID only; movie slug is deliberately excluded. A user therefore shares one budget across movie titles, and changing slugs cannot bypass the limit. The existing helper HMAC-hashes the scope and identifier before persisting the rate-limit bucket key; the raw user ID is not stored in that bucket key.

The limiter runs only after:
1. a valid authenticated user ID is present;
2. the account is found and is not banned; and
3. the explicit Cloudflare provider configuration is present.

When playback is disabled, the existing default-off gate returns before calling the limiter or querying the Movie model. Anonymous requests do not consume an authenticated user's budget.

## Response and failure behavior

- Within the budget: continue to the movie lookup and existing server-side publication/licence/territory/entitlement checks.
- Budget exhausted: return HTTP `429`, code `PLAYBACK_RATE_LIMITED`, and a `Retry-After` response header derived from the bucket expiry.
- Rate-limit storage/helper failure: return generic HTTP `503`, code `PLAYBACK_RATE_LIMIT_UNAVAILABLE`; do not query the Movie model and do not request a provider grant.
- The route retains `Cache-Control: private, no-store, max-age=0` on success and error responses.

## Tests

- `tests/media-playback-service.test.ts` covers the user ID passed to the limiter, exhausted-budget denial before Movie/provider access, Retry-After metadata, and fail-closed behavior on limiter errors.
- The same service tests assert that the provider default-off path skips rate-limit consumption.
- `tests/rate-limit.integration.test.ts` already exercises atomic concurrent consumption and the limit boundary; Phase 5.26 adds coverage for the dedicated `media-playback-grant` scope and per-user isolation against the isolated CI database.

## Boundaries

This is an application request throttle for grant issuance, not a substitute for Cloudflare token expiry, provider-side private-asset enforcement, rights checks, or edge-level signature enforcement. It does not enable playback. No new schema migration is required because the existing `RateLimitBucket` table and shared rate-limit helper are reused. No Preview or Production environment configuration, database migration, provider credential, media asset, payment, or Production resource is changed by this implementation.
