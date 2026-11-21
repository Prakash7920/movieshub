# Media Delivery Provider Decision

- **Date:** 2026-11-20
- **Project:** NexaFilm
- **Status:** Recommendation recorded; provider adoption is not yet authorized
- **Scope:** Architecture selection for protected video-on-demand playback
- **Safety:** No provider account, paid resource, secret, domain, database, or media asset was created or changed

## Context

NexaFilm currently has:
- A fail-closed playback access policy in `lib/media/access-policy.ts`.
- A server-side preflight endpoint at `app/api/media/[slug]/route.ts`.
- An explicit `MEDIA_DELIVERY_NOT_CONFIGURED` response until a reviewed storage signer exists.
- A legacy nullable `Movie.videoUrl` field, but no provider asset identifier, encoding pipeline, HLS manifest authorization, or media delivery integration.
- Generic storage environment placeholders, but no provider-specific storage variables or SDK in the application.

A direct object-store presigned URL is not enough for adaptive-bitrate HLS: the manifest references multiple segment/variant objects, so each referenced resource needs a compatible authorization strategy. The delivery service must protect the video asset as a whole, not merely the top-level manifest.

## Options reviewed

### 1. Cloudflare Stream — recommended

Cloudflare Stream is a managed video-on-demand and live video service. It ingests, stores, encodes and delivers video as HLS/DASH, and supports signed URLs/tokens for private assets. Its documentation says that setting `requireSignedURLs` prevents access by a public video ID; signed tokens can be generated per request through an API endpoint or locally using a Stream signing key.

Published pricing reviewed on 2026-11-20:
- Storage: $5/month per 1,000 minutes of video storage capacity.
- Delivery: $1 per 1,000 minutes delivered.
- Ingress and encoding: included.
- No separate bandwidth/egress fee is charged; delivery is billed by minutes delivered.

Why it fits: it removes the need for NexaFilm to build and operate transcoding, HLS packaging, segment delivery, and a separate CDN token/cookie layer before playback can be safely enabled.

### 2. Cloudflare R2 — not sufficient as the first playback provider

R2 is S3-compatible object storage with no internet egress charge. Standard storage is published at $0.015/GB-month, with a 10 GB-month free tier and request allowances.

Why it is not selected as the first playback path: R2 is object storage, not a complete video pipeline. NexaFilm would still need encoding/transcoding, HLS/DASH packaging, segment authorization (or an authenticated CDN/Worker layer), and playback delivery observability. R2 may be useful later for source masters, posters, subtitles, or other static media if the operating model supports it.

### 3. Mux Video — managed alternative

Mux provides managed on-demand video ingestion, encoding, HLS playback, analytics, and signed playback policies. Its public pricing page currently advertises a free plan with up to 10 stored videos and 100,000 monthly delivery minutes, and a pay-as-you-go plan with a $20 monthly usage credit. Pricing is usage-based across input, storage, and delivery.

Why it remains an alternative: it also solves the HLS/authorization problem, but the project should compare its current plan and usage model against Cloudflare Stream before committing.

### 4. Amazon S3 / Backblaze B2 — not selected for direct playback

Both have S3-compatible object-storage options (B2 explicitly recommends its S3-compatible API for new integrations). They can store private objects and issue SigV4 presigned URLs through standard tooling. They do not, by themselves, provide the complete adaptive streaming and token-protected HLS pipeline NexaFilm needs. Amazon S3 also has region- and usage-dependent data transfer pricing; Backblaze B2 advertises free egress up to 3x average monthly storage before overage charges.

## Recommendation

Use **Cloudflare Stream as the first managed playback provider**, subject to owner approval and a non-production proof of concept.

The first integration should:
1. Add a dedicated provider asset ID field (do not reuse a public/raw URL as a provider identifier).
2. Require private/signed playback policy for every uploaded asset; public playback IDs must remain disabled.
3. Generate a short-lived signed Stream token only after the existing server-side account, publication, active licence, territory, and Premium checks pass.
4. Return only the tokenized manifest/player URL and a short expiry to the authenticated client; never return provider API credentials or source media URLs.
5. Keep download access disabled unless a separate rights decision authorizes it.
6. Add mocked unit tests and isolated route tests for signing, token expiry, provider errors, unknown asset IDs, and no-token-on-denial.
7. Verify one lawfully controlled test asset in a non-production account before enabling any catalogue title.

## Gates before implementation can be enabled

- Owner approval to use Cloudflare Stream (including acceptance of usage-based charges).
- Cloudflare account and a narrowly scoped API token for Stream asset management.
- A Stream signing key for short-lived playback tokens.
- A non-production test asset that NexaFilm has the right to upload and stream.
- Confirmed content licence and territories for any real catalogue asset.
- A verified test of `requireSignedURLs`, token expiration, HLS manifest and segment access, denial after expiry, and no public-ID playback.
- A reviewed rollback plan that leaves the Watch page fail-closed.

## Current decision status

**NOT CONFIGURED — PLAYBACK REMAINS DISABLED.**

This document is an architecture recommendation, not permission to create a paid account, upload any film, provision credentials, alter Vercel environment variables, migrate a database, or enable playback.

## References

- Cloudflare Stream overview: https://developers.cloudflare.com/stream/
- Cloudflare Stream secure playback: https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/
- Cloudflare Stream pricing: https://developers.cloudflare.com/stream/pricing/
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Mux Video pricing: https://www.mux.com/pricing
- Mux on-demand video: https://www.mux.com/on-demand
- Amazon S3 pricing: https://aws.amazon.com/s3/pricing/
- Backblaze B2 pricing: https://www.backblaze.com/cloud-storage/pricing
