# Raw Media URL Exposure Audit

- **Date:** 2026-11-20
- **Branch:** `phase-5/consolidated-security-ops`
- **Scope:** Application source review of movie catalogue, detail, user collection, recommendation, admin movie and playback authorization responses
- **Status:** No raw `Movie.videoUrl` exposure observed in reviewed responses; playback remains disabled

## Summary

The reviewed HTTP responses do not serialize the legacy `Movie.videoUrl` field. The regular movie and user-facing routes use explicit Prisma selections that omit it. The admin movie route also uses explicit selections that omit it. The playback authorization route reads the value only inside server-side code and returns status/error metadata; it does not return the source URL.

The separate `VideoPlayer` client component accepts a caller-supplied `src` and renders it into a media `<source>`. It must not be connected to the legacy database field. The current Watch page remains a static playback-disabled page and does not import or render the player.

## Reviewed paths and evidence

| Path | Observation |
|---|---|
| `app/api/movies/route.ts` | Catalogue Prisma `select` contains metadata, posters, language, rating and genres; no `videoUrl`. |
| `app/movies/[slug]/page.tsx` | Detail-page Prisma `select` excludes `videoUrl`; page shows a playback-disabled notice. |
| `app/api/recommendations/route.ts` | Recommendation response does not read or include `videoUrl`. |
| `app/api/watchlist/route.ts` | Watchlist nested movie selection contains presentation metadata only; no `videoUrl`. |
| `app/api/watch-history/route.ts` | Watch-history nested movie selection contains presentation metadata only; no `videoUrl`. |
| `app/api/admin/movies/route.ts` | GET, POST and publish PATCH use explicit selections that omit `videoUrl`; draft creation explicitly sets `videoUrl: null`. |
| `app/api/media/[slug]/route.ts` | Reads `videoUrl` server-side for authorization preflight; the response contains only an error/code and is `no-store`. |
| `lib/media/playback-service.ts` | Does not return the source URL. It fails closed with `MEDIA_DELIVERY_NOT_CONFIGURED` while no reviewed signer adapter exists. |
| `tests/media-playback-service.test.ts` | Asserts the private source URL is absent from the authorization response, including when the title otherwise passes access checks. |
| `app/watch/[slug]/page.tsx` | Static “Streaming is not available yet” page; does not import or render the video player. |
| `components/player/video-player.tsx` | Accepts a caller-provided `src` and places it in a media source element. This is a future integration hazard unless its caller supplies only a short-lived, server-authorized playback URL. |

## Findings

1. No raw `videoUrl` field was observed in the reviewed public catalogue, detail, recommendation, watchlist or watch-history responses.
2. The reviewed admin movie API responses also omit `videoUrl`; admin access alone does not currently expose the raw field through these handlers.
3. The media authorization endpoint reads the raw source internally but never sends it back to the client. It remains fail-closed until an actual storage/video-provider signer is implemented and reviewed.
4. The client video player is not an authorization boundary. Its `src` prop must not receive a database-origin URL or a public provider playback ID.
5. This is a targeted source review of the named paths, not a formal proof over every possible response/serializer in the repository. New media endpoints must preserve the same response-field allowlist discipline.

## Acceptance criteria

- [x] Public catalogue and detail responses omit `videoUrl`.
- [x] Watchlist/history and recommendation responses omit `videoUrl`.
- [x] Reviewed admin movie API responses omit `videoUrl`.
- [x] Playback preflight never returns the raw media source.
- [x] Automated service test checks that a private source string is not serialized.
- [x] Watch page remains disabled and does not mount the raw-source player.
- [ ] Replace or constrain the player `src` contract when a provider-specific signed playback adapter is approved.
- [ ] Complete a deployed authenticated/unauthenticated response test once a non-production provider test asset and signer exist.

## Safety boundary

No database, credentials, storage provider, media asset, Vercel environment variable, domain, production deployment or playback state was changed. This audit does not authorize uploading content or enabling playback.

**Result: PASS for the reviewed response paths. Provider-backed playback remains blocked.**
