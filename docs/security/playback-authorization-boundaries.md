# Playback Authorization & Signed-Grant Expiry Boundary Verification

## Scope

This checkpoint adds a pure, fail-closed policy evaluator and a verifier for compact HMAC-SHA256 playback grants. It does **not** add a grant issuer, media URL generator, playback API, storage/CDN integration, or player activation.

Playback remains disabled until documented distribution rights and secure media delivery are independently verified.

## Grant verification contract

- Token format: `v1.<base64url-json>.<base64url-hmac>`.
- HMAC: SHA-256, computed over `v1.<base64url-json>`.
- Signing secret: at least 32 UTF-8 bytes.
- Claims: `sub`, `movieId`, `countryCode`, `iat`, and `exp`; timestamps are integer Unix seconds.
- Issued-at must not be in the future.
- Maximum grant lifetime is five minutes.
- Expiry is exclusive: a grant is valid only while `exp * 1000 > now.getTime()`. At exact equality it is expired.
- Signature comparisons use a constant-time comparison after checking equal lengths.

The token fixture signer exists only inside the automated test file. No production grant can be minted by this change.

## Authorization policy contract

The evaluator denies unless all of the following hold:

1. The caller is authenticated and is not banned.
2. A cryptographically verified grant matches the user, movie, and country in the request context, and has not expired.
3. The movie is published and has `PUBLISHED` content status.
4. The licence is `ACTIVE`, its start is inclusive (`startsAt <= now`), and its expiry is exclusive (`expiresAt > now`).
5. The request country appears in the licence's permitted-country list.
6. Premium titles have a current premium-catalogue entitlement.

The caller must load user, movie, licence, and entitlement values from trusted server-side sources. Client-provided policy data must never be used as authorization evidence.

## Verification

Run:

```bash
npm run test:security
```

The suite covers valid/tampered/malformed signatures, weak secrets, future issuance, maximum lifetime, one-millisecond-before/exact/after expiry, user/movie/country binding, publication state, licence activation and expiry boundaries, permitted territory, and premium entitlement.

## Release boundary

This helper is not yet wired to a playback route. Do not enable playback or return media URLs until a separate reviewed integration proves server-side session loading, authoritative database reads, rights/territory policy, secure media delivery, secret management, logging controls, and end-to-end expiry enforcement.
