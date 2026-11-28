# Creator Revision Lifecycle & UploadIntent API v1

- **Checkpoint:** Phase 5.56 — C3-I3
- **Date:** 2026-11-28
- **Branch:** phase-5/consolidated-security-ops
- **Validated source head:** 178390a3fdb6aa287df3bbd58e76eaf13e3068a6
- **PR:** #15 — OPEN / UNMERGED
- **Result:** **PASS — creator revision lifecycle, authenticated UploadIntent status/create API, fail-closed rights gate, audit and isolated tests implemented**
- **Scope:** Existing Creator Studio APIs/UI plus provider-neutral UploadIntent orchestration. No database schema or migration change was needed in this increment.
- **Explicit exclusions:** no upload URL/capability, file transfer, provider API, Cloudflare Stream resource, media asset, malware scan, playback activation, payment/credential change, Neon Preview/Production migration, deployment or PR merge.

## 1. Creator submission revision lifecycle

The existing Creator Studio submission API now persists and exposes immutable revision snapshots.

### Create

- POST /api/creator/submissions creates the existing private CreatorSubmission and its first CreatorSubmissionRevision (revision 1, DRAFT) in one serializable transaction.
- The transaction writes a CreatorSubmission audit event linked to the new revision ID and revision number.
- The response includes both submission and revision.

### Save draft

- PATCH SAVE_DRAFT remains ownership-scoped to the authenticated creator's own CreatorSubmission.
- A changed snapshot creates the next revision number. The previous DRAFT or NEEDS_CHANGES revision transitions to WITHDRAWN; its metadata is not edited.
- A repeated save with metadata identical to the current DRAFT reuses that exact revision ID and number. It does not manufacture an unnecessary new version. A separate audit event records the unchanged save.
- A NEEDS_CHANGES revision can be replaced by a new DRAFT revision; the previous reviewed snapshot remains immutable and is withdrawn.

### Submit and review

- PATCH SUBMIT_FOR_REVIEW transitions the exact current DRAFT / NEEDS_CHANGES revision to SUBMITTED and updates the parent CreatorSubmission in one serializable transaction.
- Legacy metadata submissions without a revision get an initial revision when they are first submitted.
- The Creator Studio list endpoint returns up to the latest 10 revisions per owned submission.
- The admin creator queue includes the latest submitted revision ID/number. Admin review now updates that exact submitted revision's decision, reviewer, timestamp and notes together with the parent submission, and writes transaction-coupled revision and submission audit records.
- Metadata approval remains metadata approval only. It does not create a Movie, activate a licence, publish a title or enable playback.

### Creator Studio UI

- The Creator Studio page displays a revision-history strip for each submission.
- It continues to state that metadata approval is not rights clearance and upload authorisation remains disabled pending an independent work/version rights review.
- Browser E2E now checks the expected revision history: v1 WITHDRAWN and v2 SUBMITTED after a changed draft is submitted.

## 2. Authenticated UploadIntent API

### GET /api/creator/upload-intents

- Requires the authenticated, email-verified, non-banned user to have an APPROVED CreatorProfile.
- Returns only UploadIntents whose submission revision belongs to that creator.
- Optional submissionRevisionId filtering first checks ownership and returns 404 for another creator's revision.
- Lists at most 100 records, newest first. Response includes state, expiry, media role, policy limits and isExpired.
- BigInt maxFileSizeBytes is serialized as a decimal string; response contains no idempotency key, upload URL, provider token or capability.

### POST /api/creator/upload-intents

- Requires same-origin JSON, a bounded 4 KiB body, approved creator context and user/IP rate limits (10 per creator per hour; 30 per resolvable client IP per hour).
- Strict request fields: submissionRevisionId, mediaRole and idempotencyKey. Unknown fields (including caller-supplied uploadUrl) are rejected.
- Revision must belong to the authenticated creator. Both the exact revision and its parent submission must be APPROVED_FOR_CATALOGUE before the rights gate is considered.
- MIME allowlists, byte limits and duration limits are server-defined per media role; callers cannot choose or raise them.
- Intent TTL is 15 minutes and the initial state is PENDING. Idempotency is unique per submission revision: a matching request replays the existing intent; reuse with a different media role/policy returns a conflict; an expired request returns 410 and requires a new idempotency key.
- Creation and expiry transitions write audit events in the same database transaction.

### Current rights gate — intentionally fail closed

The current NexaFilm schema has no independent, reviewer-approved rights record linked to the exact submission revision and signed rights evidence. The policy therefore does **not** infer upload permission from creator approval or metadata approval.

The production API calls a rights-gate resolver that currently returns RIGHTS_REVIEW_NOT_IMPLEMENTED for every revision. Consequently:

- A creator with an approved metadata revision receives HTTP 409 / RIGHTS_REVIEW_REQUIRED.
- The block is audit-logged against the exact revision.
- No UploadIntent row is created through the public API while the gate is closed.
- No upload URL, provider capability or transfer instruction is returned.

The service-level success-path test supplies a clearly synthetic approved rights decision directly to the internal service solely to validate server policy, idempotency, expiry and audit behavior against the isolated test database. This test fixture is not reachable from the API and is not a rights approval for any real work.

## 3. Files changed

- app/api/creator/submissions/route.ts — revision create/save/submit/read lifecycle.
- app/api/admin/creators/route.ts — latest submitted revision in the admin queue and exact-revision decision updates.
- app/api/creator/upload-intents/route.ts — authenticated creator-scoped create/status API.
- lib/creator/creator-access.ts — shared verified active approved-creator context and private response headers.
- lib/creator/upload-intent-service.ts — server media-role policy, 15-minute TTL, idempotent creation/replay/conflict, expiry and audit.
- lib/creator/upload-rights-gate.ts — explicitly fail-closed exact-revision rights gate.
- components/creator/creator-studio.tsx — revision history display and continued upload/rights warning.
- tests/creator-studio.integration.test.ts — revision progression, no-op save, admin review of exact revision, ownership and audit.
- tests/creator-upload-intents.integration.test.ts — authentication, creator ownership, revision gate, rights denial, idempotency, expiry, GET status serialization and audit assertions.
- e2e/creator-studio.spec.ts — browser checks for visible revision-history states.

## 4. Validation evidence

Final tested branch head: 178390a3fdb6aa287df3bbd58e76eaf13e3068a6.

| Validation | GitHub Actions evidence | Result |
|---|---|---|
| Fresh PostgreSQL migration validation | Run #115 / job 140741338384 | **PASS** |
| Prisma schema validation and all migrations | Same run, disposable PostgreSQL 16 | **PASS** |
| Media control-plane migration regression | 2 passed, 0 failed | **PASS** |
| Migration ledger and Prisma status | All repository migrations applied; database up to date | **PASS** |
| Integration tests | Run #729 / job 140741116689 — 43 passed, 0 failed | **PASS** |
| Unit tests | 81 passed, 0 failed | **PASS** |
| TypeScript type-check | Same run | **PASS** |
| Next.js production build | Same run | **PASS** |
| Chromium installation | Same run | **PASS** |
| Browser E2E | 23 passed, 0 failed | **PASS** |
| Playback E2E | 10 passed, 0 failed | **PASS** |

All database validation used disposable GitHub Actions PostgreSQL containers. No migration was applied to Neon Preview or Production.

## 5. Safety and release decision

**C3-I3 result: PASS — revision lifecycle, revision-aware admin review, authenticated creator-scoped UploadIntent create/status API, expiry/idempotency, audit and fail-closed rights gate implemented and validated.**

The UploadIntent API remains unable to create real upload intents until a separate human-reviewed rights workflow is implemented and approved. No provider, payment, credential, media asset, upload capability, file transfer, publication or playback feature was enabled. No Production or Neon database was changed. PR #15 remains OPEN and UNMERGED.

**Next single task:** C3-I4 — design and implement a separate exact-work/version rights-evidence review record and admin-only decision workflow, including restricted evidence reference/hash, scoped rights, reviewer identity, approval/rejection state, expiry/territory conditions and audit. Keep UploadIntent's production resolver fail-closed until that workflow is complete and the relevant signed rights evidence and owner/legal approvals are verified. Do not create upload URLs or transfer media in C3-I4.
