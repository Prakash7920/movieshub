# Provider-Neutral Creator Media Control Plane v1

- **Checkpoint:** Phase 5.55 — C3-I2
- **Date:** 2026-11-28
- **Branch:** phase-5/consolidated-security-ops
- **Validated source head:** a333a7d125873db609cbc84ee3ca78a8168d2bd7
- **PR:** #15 — OPEN / UNMERGED
- **Result:** **PASS — additive provider-neutral schema/state model, immutable snapshot controls, isolated tests and CI validation completed**
- **Scope:** Creator submission revisions, one-use UploadIntent metadata, quarantined MediaAssetVersion records, database constraints/state transitions, and fresh-PostgreSQL tests.
- **Explicit exclusions:** no API upload route, direct-upload provider adapter, actual file transfer, malware scanner, provider webhook, Cloudflare account/resource, payment method, credential, signed URL, media asset, Preview/Production database migration, playback activation or PR merge.

## 1. Data model delivered

### CreatorSubmissionRevision

A metadata snapshot tied to one existing CreatorSubmission.

- Snapshot fields: title, synopsis, original language, runtime, release year and content type.
- Revision identity: revisionNumber, unique per CreatorSubmission.
- Review fields: state, submitted/reviewed timestamps, reviewer and review notes.
- Snapshot identity and metadata fields are database-immutable after insertion. Changes require a new revision rather than editing a reviewed snapshot in place.
- Status transitions are enforced by a database trigger:
  - DRAFT → SUBMITTED | WITHDRAWN
  - SUBMITTED → NEEDS_CHANGES | REJECTED | APPROVED_FOR_CATALOGUE | WITHDRAWN
  - NEEDS_CHANGES → SUBMITTED | WITHDRAWN
  - APPROVED_FOR_CATALOGUE → SUPERSEDED
  - REJECTED, WITHDRAWN and SUPERSEDED are terminal.

### UploadIntent

Provider-neutral metadata for a future one-use upload authorization. It stores no upload URL, signed capability, provider API token or credential.

- Bound to one submission revision and media role.
- Includes an idempotency key unique within that revision, positive maximum file size, non-empty MIME allowlist, optional positive duration ceiling and expiry.
- Stores only lifecycle timestamps (authorizedAt, completedAt, consumedAt) and status.
- New rows must be PENDING with no lifecycle timestamps.
- Status transitions:
  - PENDING → AUTHORIZED | EXPIRED | CANCELLED | FAILED
  - AUTHORIZED → COMPLETED | EXPIRED | CANCELLED | FAILED
  - COMPLETED → CONSUMED | FAILED
  - CONSUMED, EXPIRED, CANCELLED and FAILED are terminal.
- A unique relation permits at most one MediaAssetVersion per UploadIntent.

### MediaAssetVersion

Provider-neutral facts for one immutable file version, created in quarantine and bound to the exact same revision as its completed UploadIntent.

- Stores a 64-character lowercase SHA-256, positive file-size bytes, detected MIME type, optional positive duration/dimensions, optional provider label and opaque private storage reference.
- No public URL, HLS manifest URL or playback token field exists.
- Storage provider and opaque reference must be both null or both supplied. HTTP(S) URL-like references are rejected.
- The matching UploadIntent must already be COMPLETED or CONSUMED; composite foreign-key and unique constraints prevent cross-revision links.
- New asset versions must start in QUARANTINED; validated/removal timestamps must be unset at insert.
- Source identity and detected file facts are immutable after insertion. A changed source requires a new MediaAssetVersion.
- Status transitions:
  - QUARANTINED → PROCESSING | REJECTED | FAILED | TAKEDOWN_PENDING
  - PROCESSING → TECHNICAL_REVIEW | REJECTED | FAILED | TAKEDOWN_PENDING
  - TECHNICAL_REVIEW → READY_FOR_REVIEW | REJECTED | FAILED | TAKEDOWN_PENDING
  - READY_FOR_REVIEW → REJECTED | TAKEDOWN_PENDING
  - TAKEDOWN_PENDING → REMOVED
  - REJECTED, FAILED and REMOVED are terminal.
- Entry into TECHNICAL_REVIEW or READY_FOR_REVIEW requires validatedAt; entry into REMOVED requires removedAt.

## 2. Migration and tests

- Added additive migration: prisma/migrations/20261128013000_media_control_plane/migration.sql.
- Added schema enums and models to prisma/schema.prisma.
- Added dedicated test: tests/media-control-plane.test.ts.
- The migration workflow explicitly applies every repository migration to a fresh, disposable PostgreSQL 16 service before running the control-plane test. This dedicated test is not placed in the parallel integration-test glob, avoiding shared-database cleanup races with the Creator Studio tests.
- Migration-only negative cases include duplicate revisions/idempotency keys, asset without completed intent, cross-revision link, invalid initial states, illegal backward transitions, mutated metadata/file facts, invalid checksum, public URL-like storage reference, non-positive file size and premature technical-review state.

## 3. Validation evidence

Final tested head: a333a7d125873db609cbc84ee3ca78a8168d2bd7.

| Validation | GitHub Actions evidence | Result |
|---|---|---|
| Fresh PostgreSQL migration validation | Run #91 / job 140728551462 | **PASS** |
| Empty database assertion | Same run | **PASS** |
| Prisma schema validation | Same run | **PASS** |
| Full migration deployment | Same run | **PASS** |
| Media control-plane migration tests | 2 tests, 2 passed, 0 failed | **PASS** |
| Migration ledger exact match | All repository migrations applied once; 0 unresolved | **PASS** |
| Prisma migration status | Database schema up to date | **PASS** |
| Existing integration suite | Run #705 / job 140728271305 — 41 passed, 0 failed | **PASS** |
| Unit tests | 81 passed, 0 failed | **PASS** |
| TypeScript type-check | Same run | **PASS** |
| Next.js production build | Same run | **PASS** |
| Browser E2E | 23 passed, 0 failed | **PASS** |
| Playback browser E2E | 10 passed, 0 failed | **PASS** |

Both CI runs used their own disposable GitHub Actions PostgreSQL containers. The migration was **not** applied to Neon Preview or Production.

## 4. Runtime integration remains a separate task

This commit adds the persistence model and safety constraints only. It does not yet:

- Create a CreatorSubmissionRevision from the existing Creator Studio save/submit API.
- Expose an UploadIntent creation or completion endpoint.
- Generate or return an upload URL/capability.
- Transfer or accept any actual media file.
- Configure Cloudflare Stream or another provider.
- Perform malware scanning, media probing, moderation, rights review, or publication.
- Add provider webhook/reconciliation routes or release assets to the playback API.

The existing playback service remains default-off unless its explicit provider flags and complete configuration are supplied. No playback behavior was changed.

## 5. Safety and release decision

**C3-I2 result: PASS — provider-neutral control-plane schema, additive migration, initial/quarantine gates, one-use intent lifecycle, immutable revision/file facts and isolated database tests are implemented and validated.**

No provider, payment, secret, media asset, external upload, public content, signed playback grant, Neon Preview/Production database, environment variable or deployment protection was changed. PR #15 remains OPEN and UNMERGED.

**Next single task:** C3-I3 — implement the Creator Studio revision lifecycle and authenticated UploadIntent control-plane API in a fail-closed, provider-neutral form, with ownership, creator approval, rights-gate placeholders that fail closed, expiry, idempotency and audit tests. Do not generate provider upload URLs or transfer media in C3-I3; provider-specific upload requires separate owner/resource/rights approval.
