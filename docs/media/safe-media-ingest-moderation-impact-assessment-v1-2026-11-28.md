# Safe Media Ingest & Moderation Pipeline — Implementation-Impact Assessment v1

- **Checkpoint:** Phase 5.54 — C3-I1
- **Assessment date:** 2026-11-28
- **Branch:** `phase-5/consolidated-security-ops`
- **Assessment commit:** `9f46b4d3e8a51e22b8354428b7302f26b83738c9`
- **Application source snapshot:** `337cd45d8efad7cc6ebe0582d65629cfde681a6c`
- **PR:** #15 remains OPEN and UNMERGED
- **Result:** **PASS — read-only impact assessment completed; implementation and operational activation remain separately approval-gated**
- **Scope:** Current Creator Studio workflow, Prisma models, media/playback route and adapter, licence/admin routes, API route inventory, media-provider and rights records, creator policy specification, and branch-specific Preview environment-variable metadata.
- **Safety boundary:** No application code, tests, Prisma schema/migration, database row, provider account/resource, upload URL, media asset, API credential, payment method, Vercel environment variable, feature flag, playback grant, PR merge, DNS or Production resource was created or changed.

## 1. Executive decision

NexaFilm has a useful **playback authorization foundation**, but it does not yet have a safe media-ingest or operational moderation pipeline.

The existing system can keep a catalogue item fail-closed and, when explicitly configured, verify a private/ready Cloudflare Stream asset before issuing a short-lived signed HLS grant. The current Creator Studio accepts metadata only. There is no application upload/ingest endpoint, no quarantine/inspection state machine, no media-version model linked to a CreatorSubmission, and no functional report/moderation/takedown queue.

**Recommendation:** build the control plane and moderation lifecycle first, then add a provider adapter only after a separate owner decision. Keep uploads, provider provisioning, payment-method setup, playback activation and public release disabled. Do not use the legacy `Movie.videoUrl` field as an upload mechanism or client playback source.

## 2. Evidence reviewed

The review used the current branch at assessment commit `9f46b4d3e8a51e22b8354428b7302f26b83738c9`. Comparing that commit with the application snapshot `337cd45d8efad7cc6ebe0582d65629cfde681a6c` shows that the only intervening change is the Phase 5.53 `docs/ROADMAP.md` update; the application source remains the deployed source snapshot.

| Area | Current source/evidence inspected |
|---|---|
| Data model | `prisma/schema.prisma` — Movie, License, CreatorProfile, CreatorSubmission, Report, AdminAuditLog, RateLimitBucket |
| Playback endpoint | `app/api/media/[slug]/route.ts` |
| Playback policy/service | `lib/media/access-policy.ts`, `lib/media/playback-service.ts`, `lib/media/playback-grant.ts` |
| Provider adapter | `lib/media/cloudflare-stream.ts`, `lib/media/cloudflare-token-expiry.ts` |
| Admin controls | `app/api/admin/licenses/route.ts`, `app/api/admin/movies/route.ts`, `app/api/admin/creators/route.ts` |
| Creator submission | `app/api/creator/profile/route.ts`, `app/api/creator/submissions/route.ts` |
| Existing tests | `tests/cloudflare-stream.test.ts`, `tests/media-access-policy.test.ts`, `tests/media-playback-service.test.ts`, `tests/admin-license-api-routes.integration.test.ts` |
| Provider/rights records | `docs/media/storage-provider-decision.md`, `docs/media/cloudflare-stream-owner-approval-intake.md`, `docs/media/cloudflare-stream-nonproduction-poc-operational-plan.md`, `docs/media/nexafilm-original-test-asset-provenance.md`, `docs/media/nexafilm-original-test-asset-usage-review.md`, `docs/media/title-wise-rights-evidence-inventory-2026-11-26.md` |
| Policy requirements | `docs/creators/creator-platform-policy-rights-moderation-requirements-v1-2026-11-26.md` |

A read-only inventory of the current 25 API route handlers found `GET /api/media/[slug]` for playback and the existing admin/creator endpoints, but no upload, direct-upload-intent, ingest callback/webhook, content-moderation, report-intake or takedown route.

## 3. Current-state findings

### 3.1 Playback and private delivery — foundation exists

- The playback route uses the authenticated server session and delegates to the server-side policy service. Responses are `private, no-store`; unexpected failures return generic errors.
- The service fails closed when the provider adapter is absent. Its policy checks account state, publication state, verified viewing territory, ACTIVE licence window and country, Premium entitlement, media identifier and provider/signing readiness before a grant is returned.
- The Cloudflare adapter currently performs a provider asset metadata **GET** and a signed-token **POST**. It verifies that the returned UID matches, `requireSignedURLs=true`, and `readyToStream=true`. It creates short-lived country-bound HLS grants with downloads disabled.
- `getCloudflareStreamConfigFromEnv` requires both `CLOUDFLARE_STREAM_ENABLED=true` and `CLOUDFLARE_PLAYBACK_ENABLED=true`, plus Account ID, API token and customer code. The current branch-specific Vercel Preview environment metadata contains no `CLOUDFLARE_*` keys, so the adapter remains unavailable and the route remains fail-closed.
- Existing tests exercise policy denial ordering, rate limiting, provider-error handling, private/ready asset checks, token-expiry consistency and download denial using deterministic or mocked provider responses. They do not prove a real provider upload or Cloudflare edge enforcement.

**Impact:** reuse the existing auth, licence, territory, entitlement, audit, rate-limit and signed-playback layers. Do not rewrite them as part of the first ingest increment. Real provider-backed playback remains a later release gate.

### 3.2 Upload and ingest — not implemented

- `Movie` has nullable `cloudflareStreamUid` and legacy `videoUrl` fields. The existing provider adapter does not create Direct Upload URLs, upload files, process ingest callbacks or delete provider assets.
- The API route inventory contains no application upload/ingest route or Cloudflare Stream webhook route. There is no provider-neutral `MediaAsset`, immutable `AssetVersion`, `UploadIntent`, quarantine record or creator-to-asset relationship.
- `CreatorSubmission` is metadata-only. Its strict API schema accepts title, synopsis, original language, runtime, release year and content type; it intentionally rejects arbitrary media URL/upload fields.
- No trusted lifecycle currently binds a creator's exact uploaded bytes and checksum to the reviewed metadata/version, or prevents replacement of a reviewed file without a fresh review.
- No repository evidence shows an application malware-scanning, media-probe, quarantine, moderation-sampling or ingest-reconciliation worker. This assessment does not assume that a third-party provider feature substitutes for those controls.

**Impact:** a dedicated upload-intent and immutable asset-version lifecycle is required. Do not pass raw source URLs or long-lived upload credentials to the browser. A provider adapter must be a separate implementation from the playback-token adapter.

### 3.3 Rights and release control — partial foundation; creator-work gap remains

- `License` is one-to-one with `Movie` and stores owner, status, start/end dates, permitted countries, download permission, a controlled evidence reference, SHA-256, a rights-scope confirmation and reviewer/timestamp.
- The admin License API saves records as PENDING and unpublishes an already-published movie. ACTIVE approval requires explicit confirmations, a controlled document reference, a 64-character SHA-256, a current term and allowed countries. The human reviewer must inspect the actual agreement outside the API; a reference or hash alone does not prove that rights were granted.
- This model is tied to an existing Movie. A CreatorSubmission has no creator-side rights declaration, per-right matrix, licensor authority record, evidence reference, file/version binding or separate RIGHTS_REVIEW state.
- The policy specification requires work/version-specific rights-chain checks covering platform/OTT use, territory, term, languages, music, performers, underlying works, third-party material, technical processing and promotional rights. The C1 policy is explicitly an internal draft pending owner and qualified Indian legal review; it is not an operating approval.
- The current title-wise inventory records 0/12 catalogue titles as accepted rights-cleared; the legacy ACTIVE row is not accepted as clearance without the underlying agreement and matching review evidence.

**Impact:** add a pre-release Creator rights review tied to a specific immutable asset version. Reuse the existing License only when a Movie is deliberately created for the approved catalogue stage; do not treat CreatorProfile approval or `APPROVED_FOR_CATALOGUE` as a licence or release decision.

### 3.4 Content review, reporting and takedown — specification exists; operating system does not

- The existing `Report` model contains user ID, optional Movie ID, free-text type/description, a free-text status defaulting to OPEN and timestamps. It lacks a version/segment target, severity/priority, assigned reviewer, legal deadline, action history, appeal state and controlled evidence reference.
- No report-intake route, admin report queue, moderation-case workflow, takedown API or appeal route was found in the current API route inventory.
- The Creator admin queue reviews creator applications and metadata submissions only. Current CreatorSubmission states are `DRAFT`, `SUBMITTED`, `NEEDS_CHANGES`, `REJECTED` and `APPROVED_FOR_CATALOGUE`; they do not represent rights review, content review, technical validation, takedown or public release.
- The C1 policy specification describes a staged workflow, human moderation, complaint intake, priority/legal-route selection, restricted evidence handling, reasoned decisions, appeal and takedown/restoration. Its statutory clocks and internal response targets must not be published as service promises until counsel selects the applicable legal classification and the service is staffed and tested.
- The policy expressly prohibits sending or circulating suspected child sexual abuse material for review. The future reporting UI must warn reporters not to upload illegal imagery or unnecessary sensitive personal data.

**Impact:** distinguish (1) pre-release creator content moderation from (2) post-release viewer/rights complaints. Both need restricted case records, accountable human review, auditable actions and fail-closed access control.

## 4. Gap and priority matrix

| Capability | Current state | Required outcome | Priority / gate |
|---|---|---|---|
| Creator-to-file binding | No asset/version relation | Immutable file version bound to one CreatorSubmission revision | P0 — before any creator upload |
| Upload authorization | No upload intent route | One-use, short-lived authorization only after creator, rights, owner and provider gates | P0 — before ingest |
| Private quarantine | No quarantine lifecycle | No public catalogue/manifest access while ingest or review is incomplete | P0 — before ingest |
| File safety checks | No app-level scanning/probe workflow found | Signature/MIME validation, size/duration/codec limits, malware and parser-risk controls, checksum, failed-upload handling | P0 — before ingest |
| Provider callback/reconciliation | No ingest webhook route found | Authenticated, idempotent callbacks plus trusted status reconciliation | P0 — provider-specific |
| Version/replacement safety | No immutable media version model | Any changed cut/audio/subtitles/media creates a new version and fresh review | P0 — before release |
| Title rights review | Movie License foundation only | Creator-side rights matrix and human review per work/version | P0 — before upload/release |
| Content moderation | Metadata-only admin review | Human review, rating/descriptors, sensitive escalation and documented decision | P0 — before release |
| Complaint/report intake | Minimal Report model only | Secure report intake, urgency routing, case ID, restricted evidence and acknowledgement | P1 — before public content |
| Takedown/restoration | No operating route/queue found | Immediate fail-closed restriction, audit, appeal and controlled reinstatement | P0 — before public content |
| Secure release bridge | No media-version-to-Movie release bridge | Only approved version can be bound to a DRAFT Movie; rights/licence and publication remain separate gates | P0 — before public release |
| Operational governance | Provider/account/credentials absent | Approved owner, budget window, operator, recipients, secret scope, deletion and incident runbook | External owner gate |

## 5. Reuse-first target architecture

### Stage A — control plane before upload

1. Keep `CreatorSubmission` as the creator-owned metadata record. Add a separately modelled submission revision/version so metadata edits after review cannot silently alter an approved submission.
2. Introduce provider-neutral records only after separate schema approval: an `UploadIntent` with owner, submission/version, allowed media role, size/duration constraints, expiry, single-use state and idempotency key; and a `MediaAssetVersion` with immutable checksum, detected media facts, provider reference, ingest status, creator and review linkage.
3. Record rights declarations and controlled evidence references against the exact submission/asset version. Maintain separate review outcomes for RIGHTS_REVIEW, CONTENT_REVIEW and TECHNICAL_REVIEW.
4. Preserve append-only audit for upload authorization, upload completion, scanning, rights decisions, moderation, takedown and release.

### Stage B — private ingest and technical validation

1. Do not select or provision a provider by inference. If Cloudflare Stream is later approved, implement a dedicated direct-upload adapter; the current adapter is a playback/metadata verifier, not an upload client.
2. Create the upload intent server-side only after the exact work, creator, rights declaration, operator approval and provider scope are valid. Return only a narrowly scoped, one-use, short-lived upload capability.
3. Keep source media quarantined/private. Apply allowlisted formats and content signatures, size/duration/resolution limits, checksum, codec/container probe, malware/parser-risk checks, upload quotas, duplicate/idempotency handling and safe failure/retry behavior.
4. Treat provider callbacks as untrusted until request authenticity is verified. Make callbacks idempotent and reconcile terminal provider state through a trusted provider read. Never make an asset public because a browser reports upload completion.
5. Require `requireSignedURLs=true`, download disabled, exact provider UID match and ready state before an approved asset can proceed to the release gate.

### Stage C — rights and human content moderation

1. Run RIGHTS_REVIEW against the exact work/version and the controlled underlying documents. Validate authority, rights chain, territory, term, language/version, music, performer, underlying work, third-party components and technical processing permissions.
2. Run TECHNICAL_REVIEW and CONTENT_REVIEW separately. Human reviewers decide serious rights, identity, child-safety, intimate-image and account-enforcement matters; automation may assist triage but is not the sole decision-maker.
3. Use the C1 policy's proposed workflow as a design input: `DRAFT → SUBMITTED → RIGHTS_REVIEW → CONTENT_REVIEW → NEEDS_CHANGES / REJECTED / APPROVED_FOR_RELEASE`, then a separate `READY_FOR_RELEASE → PUBLISHED` gate. Do not implement statutory deadlines or customer-facing legal claims until counsel and operational owners approve them.
4. A revised cut, new audio/music/subtitle, material edit or promotional asset becomes a new identifiable version and receives the relevant fresh rights and review checks.

### Stage D — complaints, takedown and release

1. Build a restricted report/case workflow distinct from pre-release review. Record case ID, report category, content/version/segment, urgency, applicable legal route/deadline, reviewer, notices, decision, appeal and preservation action without encouraging users to upload illegal imagery.
2. On a credible urgent rights/safety issue, make the playback/release path fail closed while authorised humans review. Keep evidence and identity details in restricted storage; do not expose reporter or victim information to creators.
3. Reinstatement requires an audited human decision that the blocking issue is resolved. Do not restore automatically on creator disagreement.
4. Only after all rights, content, technical and operational approvals should the accepted version be linked to a DRAFT Movie. Existing ACTIVE License, territory/term, entitlement, signed playback and manual publication gates remain independent and must all pass.

## 6. Owner and external gates — current decision remains unchanged

| Gate | Latest recorded evidence | Status |
|---|---|---|
| Cloudflare Stream cost model | Owner accepted the usage-based model and the no-hard-cap limitation for a non-production POC | **APPROVED — cost model only** |
| Exact procedural test asset | Provenance reviewed; owner approved restricted internal/non-commercial Preview test purpose | **APPROVED — purpose only** |
| Cloudflare account/Stream resource | Operational account/resource provisioning is not approved | **PENDING** |
| Payment method / subscription | Owner's later instruction deferred setup until build and validation are complete | **DEFERRED — do not add/subscribe now** |
| API token / Preview secrets | Not approved or configured | **PENDING** |
| Test window start and alert recipients | Duration/threshold values were approved; start time and recipients remain pending | **PENDING** |
| Upload of the exact test asset | Separate upload authorization has not been granted | **NOT AUTHORIZED** |
| Test-asset rights / upload-to-stream grant | Narrow technical test purpose is recorded; it does not itself grant provider upload or commercial/public rights | **INSUFFICIENT FOR UPLOAD** |
| C1 policy/legal review | Internal draft pending owner and qualified Indian counsel review | **PENDING** |
| Creator uploads / public release | No independent owner release decision exists | **NOT AUTHORIZED** |

The original procedural test asset is silent and procedurally generated; its provenance does not itself authorize a provider upload. The vidIQ/MiniMax synthetic clip remains blocked by its separate rights-evidence decision. Do not use either asset to bypass the required owner, provider and rights gates.

## 7. Recommended implementation sequence and acceptance criteria

1. **First implementation increment (requires separate explicit code/schema approval):** provider-neutral submission revision, UploadIntent and MediaAssetVersion control-plane models plus state-transition tests. No provider account, upload endpoint, media transfer or playback activation in this increment.
2. **Second increment (after model review):** authenticated upload-intent API, ownership checks, one-use expiry/idempotency, strict quotas and quarantine; test only in an isolated database with synthetic requests.
3. **Third increment (after provider approval):** provider-specific direct-upload adapter and authenticated callback/reconciliation; no public serving.
4. **Fourth increment:** rights, technical and content review queues with restricted evidence references, human decisions, appeals and append-only audit.
5. **Fifth increment:** complaint/takedown workflow and the separate version-to-Movie release bridge; prove that any failed gate blocks publication and playback.
6. **Final operational proof:** a separately authorised, one-asset, non-production test with current provider billing/credentials approvals, rights evidence, private asset verification, expiry/territory/download denial, takedown and cleanup evidence.

Acceptance requires negative as well as positive tests: no upload authorization for unapproved creator/work/version; no access to quarantined assets; no silent replacement after review; no publication on metadata approval alone; no playback on missing/expired/wrong-territory rights; invalid/forged callbacks ignored; duplicate callbacks idempotent; failed limiter/provider/scan/review dependencies fail closed; takedown denies new grants; and all privileged decisions are audit-recorded.

## 8. Phase result and next single task

**Phase 5.54 / C3-I1 result: PASS — read-only Safe Media Ingest & Moderation Pipeline impact assessment completed.** The assessment identifies the current playback/security foundation, implementation gaps, reuse-first target architecture and separate legal/provider/owner gates. No code, tests, schema, database, provider, media, billing, credentials or Production resource changed.

**Next single task:** C3-I2 — obtain explicit owner approval for the first provider-neutral control-plane implementation increment: submission revision + UploadIntent + MediaAssetVersion schema/state model and isolated tests only. This decision must not be treated as Cloudflare adoption, payment-method setup, provider upload, media transfer, playback activation or Production approval.
