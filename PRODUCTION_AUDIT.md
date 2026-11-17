# NexaFilm Production Readiness Audit

Last reviewed: 2026-11-16
Scope: repository source and CI evidence on `phase-5/consolidated-security-ops`. This is a code/configuration review, not proof of a live Production deployment.

## Executive summary

NexaFilm has a working Next.js application and a Phase 5 security-hardening draft. GitHub Actions has passed dependency installation, Prisma Client generation, TypeScript type-checking, and the Next.js production build for the validated commit. The Phase 5 pull request is still a draft and has not been merged or deployed. Production readiness is **NOT APPROVED**.

## Verified in repository

### Authentication and session controls — implemented, deployment not verified
- NextAuth credentials authentication uses password hashing and server-side user lookup.
- Login attempts use PostgreSQL-backed rate limiting.
- JWT sessions have a bounded lifetime and support server-side revocation checks.
- Registration, password reset/change, email verification, and session-revocation API routes are present.
- Production environment validation requires database URLs, NextAuth secret/URL, and HTTPS application URLs.
- Email delivery depends on valid Resend configuration and has not been proven in Production.

### Admin authorization and audit — implemented for reviewed endpoints
- The admin movie and licence APIs perform server-side session and database role checks for ADMIN/SUPERADMIN users.
- Write endpoints apply same-origin and JSON content-type/body-size guards.
- Movie and licence mutations emit admin audit events.
- The new AdminAuditLog table has an append-only database trigger that rejects UPDATE and DELETE operations.
- Reviewed movie and licence mutation handlers call `writeAdminAuditEvent(tx)` inside the same Prisma transaction as the business mutation (including draft create/update/delete, licence save, approval, and rejection). The `tests/admin-audit-transaction.integration.test.ts` test forces an audit insert failure after a business write and asserts that the business row is rolled back. The admin route integration tests also verify a successful movie mutation persists its matching audit event. This closes the previously identified non-atomic audit-write gap for the reviewed handlers; it does not prove every admin endpoint is covered.
- This review does not establish that every admin page or every API route is protected.

### Application security configuration
- Security response headers are configured in Next.js, including HSTS in production.
- Request guard, rate-limit, token, and safe-log helpers are present.
- These source settings still require verification against the deployed Vercel edge response.

### CI evidence
- GitHub Actions workflow run `43565331476` completed successfully.
- Successful steps: install dependencies, generate Prisma Client, TypeScript type-check, and Next.js build.
- The workflow did not establish that all integration or browser E2E tests pass. Those require their own test execution and suitable isolated test environment.

## Explicitly not implemented or not verified

### Payments — Razorpay foundation added; checkout remains intentionally disabled
- Added an authenticated server-side Premium order endpoint with server-calculated INR pricing, per-user rate limiting, strict request validation, and a client-supplied UUID idempotency key.
- Added Razorpay Orders API integration using server-only key credentials; order amount and currency are checked before the order is stored.
- Added a webhook endpoint that verifies HMAC-SHA256 against the original raw request bytes before parsing, requires the provider event ID, and persists event receipts with a database uniqueness constraint.
- Captured payments are checked against the stored order amount and INR currency before a subscription is created in the same database transaction. Failed payment events cannot regress an already-paid payment. Unknown or mismatched events are durably flagged for review.
- Added isolated integration tests for invalid signatures, duplicate captured events, one-time subscription creation, and amount mismatch.
- This is a code foundation, not a live gateway validation. Test-mode credentials, real Razorpay test checkout, callback signature verification, reconciliation/recovery tooling, alerting, and external webhook delivery are not yet verified. Paid checkout remains disabled.

### Monitoring and incident response
- No production error-tracking/monitoring provider or alert delivery was verified in this code review.
- Operational alert routing, retention, on-call ownership, and a live incident exercise remain unverified.

### Database and backup operations
- The Phase 5 migration is present in the branch but has not been applied to Production.
- Read-only inspection of the Neon `preview` branch confirmed a failed `_prisma_migrations` record for `20261114120000_admin_audit_log` (no `finished_at`, no `rolled_back_at`, `applied_steps_count=0`). Its recorded error is PostgreSQL `42703`: column `resourceType` does not exist. The current checked-in migration uses the legacy physical column names `targetType`/`targetId` and creates its index on those names. The live Preview `AdminAuditLog` table has `targetType`, `targetId`, and `actorEmail`, and the expected `targetType` index exists. This is consistent with a failed attempt using an older/different migration body than the currently checked-in file; the database-recorded Prisma checksum is `cfd7bcaec324b88c03655ec13c6de0cbd4eec95d5c78296f3171119f0d5c458f`. The SHA-256 of the current checked-in migration file is `2a653d9bc6a1d61d0566de3cfea82b74d690e5363a2d9a09fb1447ac4944be8c`, so the current file is definitively not the exact SQL body recorded at the failed attempt. The exact historical body was recovered from commit `cec1ec07f432eb67f66882b2da9ca26aee85ab53` and its SHA-256 matches the database checksum exactly. It attempted to create `AdminAuditLog_resourceType_resourceId_createdAt_idx` on `resourceType`/`resourceId`; because the table already existed with physical columns `targetType`/`targetId`, `CREATE TABLE IF NOT EXISTS` did not reconcile the table and PostgreSQL raised `42703` while creating that index. The later checked-in migration maps the logical Prisma fields to the legacy physical names and uses idempotent index creation.
- On isolated child branch `br-holy-term-aoplcgz4` only, the current checked-in migration SQL was replayed as a transaction. All eight SQL statements completed; verification confirms the expected three indexes and append-only UPDATE/DELETE trigger, with the pre-existing TRUNCATE guard preserved. The failed `_prisma_migrations` row remains untouched and unresolved on the clone; this validates the corrected SQL against the cloned schema, not Prisma's migration-resolution workflow.
- **P3009 remains unresolved.** No `migrate resolve`, migration retry, schema change, or Neon write was performed. Recovery requires a reviewed plan based on the exact failed migration checksum and the live Preview schema, followed by validation on an isolated clone before any Preview repair.
- Neon PITR configuration and a successful isolated restore drill require external evidence.
- Do not run migrations or restore tests against Production as part of this PR validation.

### Media and licensing
- Admin API checks require an active, date-valid licence and territories before publishing.
- Production signed-media URL issuance, storage/CDN access policy, and end-to-end playback authorization remain unverified.

## Production release gates

- [ ] Phase 5 PR independently reviewed and approved.
- [x] Neon Preview P3009 root cause confirmed against exact historical SQL/checksum. Corrected current migration SQL replayed successfully on isolated child branch `br-holy-term-aoplcgz4`; indexes and append-only trigger verified. The failed migration record was not resolved or modified, and the Preview parent and Production were not changed. Remaining: validate Prisma `migrate resolve --rolled-back` plus retry workflow in a disposable environment before any Preview recovery.
- [x] Reviewed movie/licence audit writes are transaction-scoped; isolated rollback and route-level persistence tests are present and passed in CI run #407.
- [ ] Integration and browser E2E suites pass against isolated test services.
- [ ] Validate Razorpay test-mode order creation and checkout with test credentials; implement and test the checkout callback signature flow.
- [ ] Add operational review/reconciliation for webhook events flagged REVIEW and for orders created upstream when the local order update fails.
- [ ] Verify webhook delivery from Razorpay Test mode to the deployed preview endpoint, including duplicate and out-of-order events.
- [ ] Complete independent payment security review before enabling paid checkout.
- [ ] Resend delivery tested with verified sender/domain and production secrets.
- [ ] Monitoring, alert routing, and incident ownership verified.
- [ ] Vercel deployed response headers checked externally.
- [ ] Neon PITR and isolated backup restore drill evidenced.
- [ ] Media signing and authorization verified end-to-end.
- [ ] Final release approval recorded; no Production rollout is authorized by this audit.

## Environment variables

The repository template documents database, NextAuth, rate-limit, cron, email, OAuth, payment, media, AI, and storage settings. Presence in the template does not prove that a corresponding secret is configured or valid in Vercel. Never place secret values in this document or commit them to Git.

## Final status

**NOT PRODUCTION READY.** CI build/type validation is green, but Phase 5 remains a draft. Production secrets, database migration, monitoring, email, payment, backup/restore, media authorization, independent review, and release approval are separate gates.
