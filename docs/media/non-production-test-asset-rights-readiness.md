# Non-Production Test Asset & Rights Readiness

- **Checkpoint:** Phase 5.28
- **Verification date:** 2026-11-21
- **Branch:** `phase-5/consolidated-security-ops`
- **Result:** Audit complete; test-asset readiness is **BLOCKED / NOT READY**
- **Scope:** Isolated Preview/E2E database contents, repository rights policy, admin licence workflow, Cloudflare provider decision, and current published Stream prerequisites/pricing.
- **Safety boundary:** Read-only database/provider-configuration inspection and documentation only. No media upload, provider account creation, credentials, paid resource, feature-flag change, or database mutation.

## 1. Isolated Preview/E2E catalogue inspection

The Vercel Preview branch environment metadata labels `DATABASE_URL` as the isolated NexaFilm E2E test database for this branch. Its matching Neon target is:
- Project: `nexafilm-e2e-isolated` (`autumn-surf-26965712`)
- Branch: `test` (`br-delicate-breeze-b3s9x6pu`)
- Database: `movieshub_test`

Read-only aggregate queries returned:

| Indicator | Rows |
|---|---:|
| Movie records | 0 |
| Movies with `cloudflareStreamUid` | 0 |
| Movies with legacy `videoUrl` | 0 |
| Licence records | 0 |
| Movie/licence joined records | 0 |
| Current, date-valid ACTIVE licences | 0 |
| ACTIVE licences with verified-agreement marker | 0 |

The database is empty of catalogue and licence fixtures. No candidate test video or its rights metadata is present in this isolated Preview/E2E target. These counts describe this target only; they are not a claim about every external file or account that may exist outside the project.

## 2. Repository rights policy

The README states that the repository contains sample metadata only, that movie metadata and media references are demo placeholders, and that content should be published or streamed only with documented distribution rights. It also says playback remains disabled until distribution rights and secure media delivery are verified.

The provider decision record dated 2026-11-20 says Cloudflare Stream is only a recommendation, provider adoption is not authorized, and no provider account, paid resource, secret, domain, database or media asset was created or changed.

## 3. What the current licence workflow does — and does not do

Source inspected:
- `app/api/admin/licenses/route.ts`
- `components/admin/admin-licenses.tsx`
- `prisma/schema.prisma`
- `tests/admin-license-api-routes.integration.test.ts`

Observed workflow:
1. An administrator can record rights owner, start/end dates, permitted ISO country codes, and notes. New or edited records are saved as `PENDING`; if a movie was published, it is unpublished until fresh approval and a manual publish action.
2. Approval requires an explicit confirmation flag and a non-empty signed-agreement reference string (at least three characters). The UI asks the administrator to confirm they checked the actual signed agreement, platform/language rights, territories, term and usage rights.
3. The backend stores the agreement reference as a text marker in `License.notes`, writes a `LICENSE_APPROVED` audit event, copies the approved territory/owner/date fields to the Movie, and keeps downloads disabled.
4. The `License` model has a notes field but no agreement-file attachment or evidence-document hash field. The API validates the reference string and explicit admin confirmation; it does not independently inspect or authenticate the underlying signed contract.

Therefore, legal rights evidence must be reviewed by the responsible NexaFilm owner/admin outside this API before approval. A reference string alone is not proof that rights exist. For this test asset, the approval record should point to a controlled, access-restricted signed agreement or rights statement, and the reviewer must confirm that it covers the intended upload, hosting, encoding, streaming, language/platform, territory and term/usage scope. Keep any confidential agreement outside the public repository.

## 4. Provider readiness and cost approval

Read-only branch-scoped Vercel Preview environment metadata listed these keys only:
`RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_KEY_ID`, `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_URL`, and `NEXT_PUBLIC_APP_URL`.

No `CLOUDFLARE_*` variables are configured for this Preview branch. No Cloudflare-specific connected tools/account credentials are available through the current project integration. The repository's recorded decision says adoption is not authorized.

Current official Cloudflare Stream pricing documentation (last updated 2026-10-27) describes:
- Storage capacity prepaid in $5/month increments per 1,000 minutes of stored video capacity.
- Video delivery at $1 per 1,000 minutes delivered, usage-based.
- Ingress and encoding included; no separate bandwidth/egress charge.
- Actual usage depends on capacity purchased and minutes delivered.

This is a published rate reference, not a quote or an approval to incur charges. Cloudflare documentation also says videos are public by ID by default unless `requireSignedURLs=true`; the signed-token `/token` endpoint is intended for low-volume/testing use (documented as fewer than 1,000 tokens/day) and is subject to API rate limits. A private test asset must be verified as private before any grant is created.

Official sources:
- Secure Stream playback: https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/
- Stream pricing: https://developers.cloudflare.com/stream/pricing/

## 5. Gate decision

| Gate | Current evidence | Status |
|---|---|---|
| Isolated target identified | Preview metadata labels the DB as isolated E2E; matched to Neon project/branch/database above | **PASS** |
| Preview catalogue candidate exists | 0 Movie rows | **BLOCKED** |
| Provider asset UID assigned | 0 Movie rows with `cloudflareStreamUid` | **BLOCKED** |
| Rights-cleared candidate registered | 0 License rows | **BLOCKED** |
| Actual signed rights evidence reviewed | No agreement or rights statement supplied/recorded in this target | **BLOCKED** |
| Cloudflare adoption approval | Provider decision is recommendation only; no owner approval recorded | **BLOCKED** |
| Cloudflare Preview credentials/configuration | No `CLOUDFLARE_*` variables | **BLOCKED — remains default-off** |
| Private asset delivery contract | Code verifies `requireSignedURLs=true` and `readyToStream=true`; provider tests are mocked | **PASS — implementation only; no live asset** |

**Phase 5.28 result:** PASS for the readiness/rights audit and evidence report. **Test-asset readiness remains BLOCKED / NOT READY.** No asset is authorized for upload today.

## 6. Conditions before any test-asset upload

Do not upload until all of the following are satisfied:

1. The NexaFilm owner explicitly approves Cloudflare Stream adoption and accepts the usage-based storage/delivery billing model.
2. One test asset is identified, and the responsible rights owner supplies a signed agreement or written rights statement that permits the intended upload, hosting/processing and streaming use for the required platform/language, territories and time period. A synthetic asset authored for this project is also acceptable only after its ownership and intended use are recorded.
3. An authorized administrator reviews that actual evidence outside the API, saves the pending licence metadata, records a controlled agreement reference, and explicitly approves the licence. The project should not treat a free-text reference as a substitute for the underlying evidence.
4. The test asset is uploaded only to the approved non-production Stream account, with `requireSignedURLs=true`, downloads disabled, and the asset verified `readyToStream=true` before the app assigns its UID.
5. The team tests private-ID denial, signed HLS manifest/segment access, token expiry, territory restrictions and download denial. The app's explicit playback approval flag remains off until the test report is reviewed and separately approved.

No steps above were executed in this checkpoint. No provider account, paid resource, API token, signing key, media asset, Preview/Production environment variable or database record was created or changed. No Production system was accessed or modified.

## 7. Decision

**Do not upload a film or enable playback as a result of this audit.** The next required decision is owner approval for the provider/cost model and identification of one asset with documented rights. Until that evidence exists, keep the Watch page and Cloudflare flags fail-closed.
