# Creator Work/Version Rights-Evidence Review Workflow — C3-I4

- **Checkpoint:** C3-I4 — Exact Work/Version Rights-Evidence Review
- **Date:** 2026-11-28 (Asia/Kolkata)
- **Repository:** `Prakash7920/movieshub`
- **Branch:** `phase-5/consolidated-security-ops`
- **PR:** #15 — OPEN / UNMERGED
- **Scope:** Independent, admin-only rights evidence and decision workflow bound to one immutable `CreatorSubmissionRevision`, plus exact territory/media-role/language/term checks in UploadIntent creation.
- **Safety boundary:** No document bytes, signed upload URL, provider API, media transfer, cloud resource, payment, playback enablement, Preview/Production database mutation, PR merge or Production operation.

## 1. Review record and exact work/version binding

The new `CreatorRightsReview` is separate from the catalogue `License` record and Creator metadata approval. Each record is attached by foreign key to one exact immutable `CreatorSubmissionRevision`. A revision can have numbered review sequences; the newest sequence is authoritative. A new PENDING or REJECTED sequence closes an older approval rather than inheriting it.

The record stores a restricted legal-store reference and normalized lowercase SHA-256 for the exact signed evidence file; separate owner-authorization and legal-review references; rights holder; effective dates; ISO alpha-2 territories; ISO 639 languages; and permitted media roles. The contract itself is not uploaded to NexaFilm, committed to GitHub or returned to creator APIs. Upload, private hosting, processing/transcoding/packaging and OTT/VOD streaming scopes are explicit. Download permission is forced false and outside this checkpoint.

The database enforces initial PENDING state, restricted-reference/checksum formats, unique review sequence, date ordering, non-empty unique scope arrays, required approval attestations, two-person review, forward-only terminal decision and immutable evidence/scope after submission.

## 2. Admin-only human review and dual control

Only ADMIN/SUPERADMIN sessions can create or decide records. The API re-checks role and banned state in the database, applies IP/user rate limits, requires same-origin bounded JSON, uses serializable transactions and writes transaction-coupled append-only audit events.

A reviewer cannot approve or reject a record they submitted. Approval requires explicit attestation that the reviewer inspected the actual signed evidence, confirmed exact rights scope, and checked referenced owner authorization and legal review in the restricted systems. Approval is rejected if any required scope is false, the revision's original language is not covered, the rights term has expired, or the revision is no longer metadata-approved. Rejection requires a reason.

Audit metadata contains review identity, evidence hash and scope summary, not confidential evidence or owner/legal vault references.

## 3. UploadIntent rights gate

Creator POST requires an explicit ISO alpha-2 `territoryCode`. Within the same serializable transaction as intent creation, the resolver reads the latest rights-review sequence for the exact revision and checks: metadata approval on the revision and parent; latest review APPROVED; valid evidence/owner/legal references and SHA-256; a current unbanned admin reviewer distinct from the submitter; all four human attestations; upload, private hosting, processing and OTT/VOD scope; requested country; revision original language; requested media role; and an effective term (start inclusive, expiry exclusive).

Missing, pending, rejected, newer-pending, expired, wrong-territory, wrong-language, wrong-media-role or structurally invalid decisions return `RIGHTS_REVIEW_REQUIRED` and create no UploadIntent. Country is persisted on the intent and included in idempotency comparison. Opening a new review sequence cancels outstanding PENDING/AUTHORIZED intents for the exact revision and logs each cancellation.

A successful gate can create only a short-lived PENDING UploadIntent. No upload URL, provider credential, transfer capability or file-transfer route is created.

## 4. Evidence and legal boundary

SHA-256 verifies file identity/integrity only. It does not verify signatory, ownership, chain of title, document authenticity, legal enforceability or actual rights granted. A vault reference and checkboxes do not substitute for the underlying instrument. Responsible owner and qualified legal reviewers must inspect the actual agreement and record their approvals out-of-band before an admin can attest.

The existing title inventory records inspected catalogue titles as unverified/not cleared, and the synthetic test asset's rights remain blocked. This increment does not create or approve a real rights record. Until genuine signed evidence and owner/legal approvals are supplied and independently reviewed, no real work can pass this gate.

## 5. Validation

Automated integration coverage includes admin-only access, restricted-reference validation, PENDING state, independent reviewer, required attestations, rejection, audit secrecy, exact territory/media-role, expiry, language and streaming-scope failures, sequence supersession, cancellation of open intents and immutable terminal decisions. The fresh-migration workflow runs this suite after all migrations on a disposable PostgreSQL 16 database. Full PR CI continues to run integration/unit tests, typecheck, production build and browser suites.

**Validation:** PASS on implementation commit `a9c1613e0533a9a6ee253c69259aab891bd18771`. Fresh Prisma Migration Validation [#128](https://github.com/Prakash7920/movieshub/actions/runs/46126263588) passed on a disposable PostgreSQL 16 database, including migration ledger and `prisma migrate status` checks. Full Vercel build validation [#737](https://github.com/Prakash7920/movieshub/actions/runs/46126263634) passed: database integration, unit tests, typecheck, Next.js production build and browser E2E. No Neon Preview or Production migration was performed.
