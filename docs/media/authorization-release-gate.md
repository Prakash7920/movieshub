# Media Authorization Security Audit & Release Gate

- **Checkpoint:** Phase 5.25
- **Audit date:** 2026-11-21
- **Reviewed branch:** `phase-5/consolidated-security-ops`
- **Source snapshot:** `ba43e34c693dfddd05debbf97fa3a49ebafbefb3`
- **Decision:** Authorization and fail-closed controls are verified; provider-backed playback remains disabled and is **not approved for release**.
- **Scope:** Current media route, playback service, policy, Cloudflare Stream adapter, signed-grant parser, browser player, tests, branch-scoped Preview configuration, and the operator-supplied anonymous Preview response.

This checkpoint supersedes the *current-state conclusions* in the earlier Phase 5.20 source snapshot. The Phase 5.20 document remains a historical record of the earlier implementation state; this file is the current consolidated media gate.

## Current implementation verified

1. **Server-side route and session boundary**
   - `app/api/media/[slug]/route.ts` uses `getServerSession(authOptions)`, obtains the movie slug and Vercel viewer-country header, and delegates to `authorizePlaybackRequest`.
   - The route is Node.js and force-dynamic. All JSON responses use `Cache-Control: private, no-store, max-age=0`.
   - Unexpected route failures return a generic 503 response and do not serialize provider credentials or underlying error details.

2. **Authorization order and fail-closed behavior**
   - `lib/media/playback-service.ts` rejects anonymous requests before account/database lookup (401), rejects blocked accounts (403), and rejects invalid slugs (400).
   - When the provider adapter is absent, the service returns `503 MEDIA_DELIVERY_NOT_CONFIGURED` before querying a Movie or attempting provider token issuance.
   - With a provider adapter supplied, the service checks account status, publication state, active licence window, Vercel-injected country, licensed territory, Premium entitlement, and the Cloudflare asset UID before requesting a grant.
   - The licence start boundary is inclusive; the expiry boundary is exclusive.

3. **Provider-side private-asset checks**
   - `lib/media/cloudflare-stream.ts` requires both `CLOUDFLARE_STREAM_ENABLED=true` and `CLOUDFLARE_PLAYBACK_ENABLED=true`, plus a valid Account ID, API token, and customer code.
   - Before token creation, it verifies the returned asset UID, `requireSignedURLs=true`, and `readyToStream=true`.
   - Token requests use a short lifetime (default 300 seconds; accepted range 60–900), `downloadable=false`, and a country allow rule followed by a block-any rule.
   - The returned JWT-shaped token must declare `RS256`, a non-empty `kid`, and an `exp` that exactly matches the requested expiry.

4. **Client-side grant and player contract**
   - `lib/media/playback-grant.ts` accepts only an HTTPS Cloudflare customer manifest URL with the expected HLS path; it rejects credentials, query strings, fragments, malformed JWT claims, mismatched expiry metadata, and grants outside the permitted lifetime.
   - Grant expiry is exclusive: a grant is invalid at the exact `exp` boundary and after it.
   - The parser checks JWT header/payload consistency; it does **not** cryptographically verify the JWT signature. The intended signature enforcement is at Cloudflare's delivery edge. This checkpoint does not claim that a real Cloudflare token or edge request has been tested.
   - `VideoPlayer` no longer accepts a caller-provided `src` or `manifestUrl` prop. It obtains a grant from the server route and removes the active source on fatal playback/refresh errors. The Watch page renders a disabled shell when the provider configuration is absent.

5. **Raw-source exposure**
   - The current playback route queries `cloudflareStreamUid`, not the legacy `Movie.videoUrl`, and returns only a short-lived grant or generic error body.
   - Existing targeted raw-media source audit and service tests cover the reviewed catalogue, detail, admin, collection, recommendation and playback response paths. This is a targeted source review, not a formal proof over every serializer in the repository.

## Evidence and checkpoint status

| Gate | Evidence | Status |
|---|---|---|
| Anonymous Preview denial | Operator screenshot shows the deployed Preview media route returning `{"error":"Sign in to request playback.","code":"AUTHENTICATION_REQUIRED"}`. The route/service contract maps this denial to HTTP 401; the screenshot shows the JSON body, not a network-status panel. | **PASS** |
| Server-side policy and denial ordering | `tests/media-playback-service.test.ts` covers anonymous, blocked, missing account/title, default-off, missing territory, unlicensed/wrong territory, Premium denial, missing asset UID, generic provider error and raw-source non-disclosure cases. | **PASS — automated** |
| Licence expiry boundary | `tests/media-access-policy.test.ts` covers one millisecond before, exact expiry, and one millisecond after. | **PASS — automated** |
| Signed-grant expiry consistency | `tests/playback-grant.test.ts` covers malformed/untrusted URLs, expected algorithm/key ID/expiry claims, metadata mismatch, lifetime cap and the exact expiry boundary. | **PASS — deterministic fixtures** |
| Cloudflare adapter constraints | `tests/cloudflare-stream.test.ts` covers private/ready asset checks, country restrictions, download disabled, provider errors, token expiry equality, and default-off flags. Provider calls are mocked. | **PASS — mocked** |
| Watch page remains disabled by default | `e2e/playback-disabled.spec.ts` checks no video/source element and no media-grant request when playback is disabled. | **PASS — browser test** |
| Browser grant/player lifecycle | Current-head GitHub Actions run [#547](https://github.com/Prakash7920/movieshub/actions/runs/44885183365) completed successfully, including browser E2E. These playback-enabled scenarios use synthetic JWT-shaped fixtures and mocked provider/CDN requests. | **PASS — mocked E2E** |
| Preview deployment | Vercel Preview deployment `dpl_5BBgnudJuz6RnjEA48Wkqjkot28R` was READY for source snapshot `ba43e34`. | **PASS — deployment state** |
| Preview provider configuration | Read-only branch-scoped Vercel environment metadata listed no `CLOUDFLARE_*` variables for this Preview branch. Values were not decrypted or disclosed. | **PASS — provider remains unconfigured** |
| Cloudflare Stream cost-model approval | Owner explicitly approved the planned non-production POC's usage-based storage/delivery charges and acknowledged that budget alerts are not a hard cap (2026-11-22). Account/resource/payment-method setup and test window/alert threshold remain pending. Preview has no `CLOUDFLARE_*` configuration. | **PASS — COST APPROVAL ONLY; SETUP PENDING** |
| Rights-evidence verification method | Admin approval requires a confirmation and signed-agreement reference, but the `License` schema stores no agreement attachment/hash; actual contract inspection must remain a human-controlled off-platform review. | **MANUAL CONTROL REQUIRED** |
| Authenticated Preview grant issuance | No live authenticated request against a configured Cloudflare Stream asset was performed. | **NOT TESTED** |
| Real Cloudflare signature/edge validation | No real token, HLS manifest, segment request, token-expiry-at-edge, country-denial, or public-ID-denial test has been run. | **BLOCKED** |
| Non-production test asset and rights evidence | Phase 5.28 isolated DB query found 0 Movie rows, 0 `License` rows and 0 asset UIDs. Phase 5.29 intake confirms no asset or underlying signed rights document has been supplied; a free-text reference is not independent proof. | **BLOCKED — NOT READY** |
| New asset UID migration on target DB | Phase 5.27 read-only verification on isolated Neon `nexafilm-e2e-isolated/test/movieshub_test`: successful ledger row, matching SHA-256, nullable `text` column and unique index; 14/14 migrations successful, 0 unresolved, 0 rolled back. | **PASS — Phase 5.27** |
| Media-grant rate limiting | Phase 5.26 implemented 10 requests per authenticated user per 5 minutes using the existing HMAC-hashed PostgreSQL bucket; `429` + `Retry-After`, fail-closed `503` on limiter errors; CI run #44931742994 passed. | **PASS — Phase 5.26** |

## Enablement gates — all required before playback activation

- Phase 5.29 cost-model approval is recorded (2026-11-22): usage-based storage/delivery charges accepted and no-hard-cap limitation acknowledged. Before setup, separately record authorization for account/Stream resource/payment-method operations and agree the test window and informational alert threshold in the Phase 5.29 intake.
- Use only a non-production test asset with documented rights to upload and stream. Confirm the asset is private (`requireSignedURLs=true`) and its licence/territory metadata is accurate.
- The nullable asset-UID migration is already applied and verified on the isolated Preview/E2E database (Phase 5.27); no further migration run is required for this target.
- Implement per-user (and, as appropriate, per-asset) rate limiting for media-grant requests; fail closed on rate-limit infrastructure errors and cover limit/exhaustion behavior in route tests.
- Run a live authenticated Preview grant request against the approved test asset, then validate Cloudflare's signature enforcement, HLS manifest and segment access, country allow/block behavior, expiry denial at the edge, and denial of public-ID playback.
- Keep download access disabled and retain a tested rollback that returns the Watch page to its disabled state.

## Release decision and safety boundary

**Media authorization source controls: PASS. Anonymous Preview denial: PASS. Provider-backed playback: BLOCKED / NOT APPROVED.**

Do not add Cloudflare credentials, enable either playback flag, upload media, apply a Preview database migration, change deployment protection, or activate Production playback as part of this audit. No Production settings, secrets, databases, payments, or deployment targets were changed. PR #15 remains a separate OPEN/UNMERGED release candidate; its payment/webhook, deployed security-header, current-head independent-review and other operational gates remain independent of this media audit.

**Phase 5.25 result:** PASS for the security audit and release-gate consolidation artifact. The outstanding enablement gates above remain open; this PASS is not approval to stream content.


## Phase 5.26–5.27 release-gate updates (2026-11-21)

- **Phase 5.26:** per-user playback grant request throttling is implemented and tested; see [playback-grant-rate-limit.md](playback-grant-rate-limit.md). Implementation CI [#44931742994](https://github.com/Prakash7920/movieshub/actions/runs/44931742994) passed database integration (25/25), unit tests (77/77), browser E2E (13/13), playback browser E2E (10/10), type-check and Next.js build.
- **Phase 5.27:** the `20261121100000_add_cloudflare_stream_asset_uid` migration was confirmed already applied to the isolated Preview/E2E database. The migration ledger row is successful with no rollback, its SHA-256 matches the repository file, the nullable `text` column exists, and the expected unique index exists. The ledger aggregate showed 14 successful rows, 0 unresolved and 0 rolled back.
- Detailed database evidence: [asset-uid-migration-verification.md](asset-uid-migration-verification.md).
- Both checkpoints used read-only verification or application code/test changes on the existing Phase 5 PR branch. No Production resources were accessed or modified. Provider-backed playback remains blocked pending rights-cleared test asset and real Cloudflare edge validation.

## Phase 5.28 test-asset readiness and rights audit (2026-11-21)

- Read-only verification identified the Preview/E2E database as Neon `nexafilm-e2e-isolated/test/movieshub_test`. It contains 0 Movie rows, 0 License rows, 0 Cloudflare asset UIDs and 0 active/rights-approved catalogue rows.
- README confirms all movie metadata/media references are demo placeholders and requires documented distribution rights before publishing or streaming.
- Admin licence API saves new/edited records as PENDING, unpublishes previously published content, and requires explicit admin confirmation plus a signed-agreement reference to approve. The reference is stored in `License.notes`; no agreement attachment/hash field exists, so a reviewer must inspect the actual signed agreement outside the API.
- Vercel Preview environment metadata contains no `CLOUDFLARE_*` variables. The provider decision remains recommendation-only and no owner acceptance of usage-based charges is recorded.
- Current Cloudflare official docs state videos are public by ID by default unless `requireSignedURLs=true`; official pricing describes storage capacity in $5/month per 1,000-minute increments and $1 per 1,000 delivered minutes. See [Cloudflare secure playback](https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/) and [Cloudflare pricing](https://developers.cloudflare.com/stream/pricing/).
- Detailed evidence and upload preconditions: [non-production-test-asset-rights-readiness.md](non-production-test-asset-rights-readiness.md).
- **Phase 5.28 result: PASS for the audit only. Test-asset readiness remains BLOCKED / NOT READY.** No asset was supplied or uploaded; no provider account, paid resource, credentials, flags, database data, or Production resource was changed.

## Phase 5.29 owner approval and rights-evidence intake (2026-11-21)

- Prepared [Cloudflare Stream Owner Approval & Rights Evidence Intake](cloudflare-stream-owner-approval-intake.md). Generic start instruction is not recorded as payment/usage approval.
- Current official pricing is US$5/month per 1,000 minutes of storage capacity and US$1 per 1,000 minutes delivered. Delivery counts segment requests, including preloading/buffering.
- Cloudflare Budget Alerts are informational and do not pause, block or cap Stream usage. Cloudflare documents product spending limits for Workers/ Durable Objects, not Stream. The owner must explicitly acknowledge that the alert threshold is not a guaranteed maximum invoice.
- Approval checkboxes and owner/date/window/budget-alert acknowledgement fields remain NOT RECORDED. No Cloudflare account, paid resource, payment method, credential or signing key was created.
- Rights-evidence intake requires the actual signed agreement or written rights statement to be inspected out-of-band for upload, hosting, encoding, VOD streaming, platform/language scope, territories, term, and all embedded audio/visual/performance rights. The current admin API stores only a text reference; it does not inspect the underlying document.
- **Phase 5.29 result:** intake prepared; owner approval **PENDING**; rights-cleared test asset **NOT PROVIDED**. No asset upload, environment change, database write or Production operation was performed.
- Official sources: [Stream pricing](https://developers.cloudflare.com/stream/pricing/), [Budget alerts](https://developers.cloudflare.com/billing/manage/budget-alerts/), [Spend management](https://developers.cloudflare.com/billing/manage/spend-management/), [Secure Stream playback](https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/).
### Phase 5.29 owner decision update (2026-11-22)

- The owner explicitly approved the usage-based storage and delivery cost model for the planned non-production POC and acknowledged that Cloudflare Budget Alerts are informational, not a hard spend cap.
- This records cost-model approval only. Cloudflare account/Stream resource creation, payment-method setup, test-window selection and alert-threshold selection remain pending; no provider account or paid resource was created.
- The separate lawful-asset gate remains **BLOCKED**: no test asset or underlying signed agreement/rights statement has been supplied or inspected. The cost approval does not authorize upload or Production use.
- Preview provider flags remain off; no `CLOUDFLARE_*` variables, secrets, database rows, media assets or Production resources were changed.
- **Decision: PASS — owner cost-model approval recorded; provider setup and provider-backed playback remain BLOCKED pending operational authorization and rights evidence.**
