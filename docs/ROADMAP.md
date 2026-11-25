# NexaFilm OTT Platform Roadmap

**Canonical roadmap:** This file is the single source of truth for product milestones, delivery status, evidence, blockers, and final acceptance. Update this file when a milestone changes; do not create parallel checklists for the same work.

- **Last reviewed:** 2026-11-25 (Asia/Kolkata)
- **Repository:** `Prakash7920/movieshub`
- **Active delivery branch:** `phase-5/consolidated-security-ops`
- **Current pull request:** [#15 — Phase 5: consolidated security and operational hardening](https://github.com/Prakash7920/movieshub/pull/15)
- **Current focus:** Milestone 1 — Product experience completion
- **Overall product status:** IN PROGRESS — not production-ready

## Product goal

Deliver a usable, legally operated OTT platform for Indian-language cinema: customers can discover licensed titles, manage an account and personal library, pay for an eligible plan, and watch protected video on supported devices. Operators can manage catalogue metadata and rights safely. The platform must not expose unlicensed titles, public source media, payment secrets, or privileged operations.

A working Preview, a green CI run, or a completed security checklist is not by itself proof that the OTT product is complete.

## Status rules

- **PASS** — the stated acceptance condition has direct, recorded evidence for the relevant commit/environment.
- **PARTIAL** — implementation or tests exist, but a meaningful part of the user-facing or provider-backed flow remains unverified.
- **BLOCKED** — progress depends on an external provider, rights evidence, owner decision, or evidence that is not currently available.
- **IN PROGRESS** — this is the current milestone being implemented.
- **NOT STARTED** — no implementation/evidence has been recorded yet.
- **NOT APPROVED** — a release/production action is not authorized. Never infer authorization from a passing test or earlier approval for a narrower scope.

Every PASS must name its evidence and scope. Test fixtures and mocked provider calls must never be presented as live provider verification.

## Five delivery milestones

### Milestone 1 — Complete the customer product experience
**Status: IN PROGRESS — CURRENT FOCUS**

Deliver the complete usable customer-facing experience around the capabilities that can be safely tested before live media delivery is enabled.

Scope:
- Home page, navigation, catalogue discovery, search, language/genre filters, empty/loading/error states, and responsive layouts.
- Movie detail pages with metadata, audio/subtitle information, territory/licence-aware visibility, and clear playback availability messaging.
- Registration, email verification, login, logout, password recovery/change, and account identity.
- Customer dashboard, profile/settings, language preference, watchlist, and watch-history management.
- Clear subscription/plan status and truthful messaging about which actions are available in Preview.
- Remove dead links, missing routes, non-functional controls, misleading labels, and stale product documentation.

Existing evidence:
- **PASS (source-level):** Home, catalogue, movie detail, registration/authentication, dashboard, watchlist, and watch-history routes/components exist on the active branch.
- **PASS (security boundary):** Catalogue, detail, watchlist, and history queries apply the current publication/licence/territory filters in the reviewed paths.
- **PASS — account settings increment:** The missing `/dashboard/settings` route, profile GET/PATCH API, display-name and language-preference persistence, same-origin/JSON/schema guards, private no-store responses, account-isolation integration tests, and mobile Playwright test were added in commit `4417e433979440b0428bdd0f80ef94429d7cfa58`. GitHub Actions run [#593](https://github.com/Prakash7920/movieshub/actions/runs/45546261296) completed successfully: database integration tests, unit tests, TypeScript check, Next.js production build, and the complete browser E2E job all passed. Vercel reported deployment success for the same code commit. This PASS is limited to the account-settings increment; Milestone 1 remains IN PROGRESS until the other customer-experience criteria pass.
- **PASS — email-verification recovery and honest auth UI increment:** Added the missing `/auth/resend-verification` customer page/form and connected the verification-error path to it; registration now displays the API's actual result and provides a resend route. Removed inert Google/OTP placeholder actions from login, registration, and password-reset pages, updated authentication copy to advertise only supported flows, and corrected the README's stale implementation claims. Commit `df1b6cb15ad9f860d621fba883123763e449903e`; GitHub Actions run [#596](https://github.com/Prakash7920/movieshub/actions/runs/45571369242) completed successfully for isolated DB integration tests, unit tests, TypeScript, Next.js production build, and the full browser E2E job including the new mobile resend-verification and unsupported-CTA checks. Vercel Preview deployment [dpl_BMZTNZgpJPXPKf7xE1Z3Y5vugKUH](https://vercel.com/nexa-cead/movieshub/BMZTNZgpJPXPKf7xE1Z3Y5vugKUH) is READY for the same commit. This PASS covers this auth journey increment only; Milestone 1 remains IN PROGRESS.
- **PASS — cross-browser account language preference sync:** The global language provider now loads an authenticated user's saved profile language, keeps local/browser language as the guest fallback, and refreshes the preference after credentials login so an already-mounted layout adopts the signed-in account's setting. Commit `dc583c07a9794e6cbf3a8c8e2e2d2d1be5c6f87d`; GitHub Actions run [#598](https://github.com/Prakash7920/movieshub/actions/runs/45571959865) completed successfully: database integration, unit tests, TypeScript, Next.js build, and Playwright E2E all PASS. The updated account-settings E2E saves Tamil in one browser, creates a second context without the first context's cookies/localStorage, signs in, and verifies both `html[lang=ta]` and the Tamil navigation label. Vercel Preview deployment [dpl_9i893bAvkuwsQyyNrvagAwaxjgmd](https://vercel.com/nexa-cead/movieshub/9i893bAvkuwsQyyNrvagAwaxjgmd) is READY for the same commit. Milestone 1 remains IN PROGRESS.
- **PASS — customer navigation and account-library journey audit:** Updated watchlist copy to reflect account sync (not device-only storage), made payment return pages explicit that opening them does not validate/decline a transaction, and clarified dashboard plan/settings copy. Added `e2e/customer-journey.spec.ts` with an isolated published/licensed IN fixture and full customer smoke path across home, movies, categories redirect, auth, detail, watchlist, history, settings, plans, payment return pages, disabled playback, protected admin, and mobile/desktop overflow checks. Commit `f58bac910730bfbb59483259d553834ed92cccc4`; GitHub Actions run [#600](https://github.com/Prakash7920/movieshub/actions/runs/45572809394) completed successfully: database integration, unit tests, typecheck, Next.js production build, full Playwright E2E, and cleanup all PASS. Vercel Preview deployment [dpl_9x6E6MfDqEQqgLHbVUoGQwkX1T6H](https://vercel.com/nexa-cead/movieshub/9x6E6MfDqEQqgLHbVUoGQwkX1T6H) is READY for the same commit. Milestone 1 remains IN PROGRESS.
- **PASS — accessible mobile primary navigation:** Added a mobile navigation disclosure with Home/Movies/Dashboard/AI Picks/Admin destinations, `aria-expanded`/`aria-controls`, keyboard Escape-to-close, and automatic close after route selection, while keeping the desktop primary navigation intact. Extended the customer-journey Playwright test to verify guest mobile navigation, signed-in account destinations, Escape close, and desktop navigation visibility. Commit `4033e650a076273e22ff8ae477767ccc00e7852c`; GitHub Actions run [#602](https://github.com/Prakash7920/movieshub/actions/runs/45573419954) completed successfully: isolated database integration, unit tests, TypeScript, production build, full Playwright E2E, and cleanup all PASS. Vercel Preview deployment [dpl_92R6rQUmWHjBegjTaraafcRKjaiQ](https://vercel.com/nexa-cead/movieshub/92R6rQUmWHjBegjTaraafcRKjaiQ) is READY for the same commit. Milestone 1 remains IN PROGRESS.
- **PASS — customer password-change experience:** Added a credential-account password-change form to Account Settings using the existing authenticated, rate-limited API. The UI validates confirmation, clearly rejects an incorrect current password, and sends the customer back to sign-in after the API updates the password hash and invalidates existing sessions. The login screen confirms the password update. E2E verifies incorrect-current-password rejection, forced re-login, old-password rejection, and successful sign-in with the new password. Implementation commit `2f7de4b0e6d01c8f9d45f2a2990e3ed5133a8e4a`; final test-selector correction commit `21c3f250c6986b14a6648f7aae9c04f8bc47647a`. GitHub Actions run [#606](https://github.com/Prakash7920/movieshub/actions/runs/45574903235) completed successfully: database integration, unit tests, TypeScript, Next.js build, full Playwright E2E, and cleanup all PASS. Vercel Preview deployment [dpl_8xvrHJoECGVqNGVw4V6LMry2f7d1](https://vercel.com/nexa-cead/movieshub/8xvrHJoECGVqNGVw4V6LMry2f7d1) is READY for the final exact test commit. Milestone 1 remains IN PROGRESS.
- **PARTIAL:** Watch history is manually/API-recorded preview data; automatic playback progress and resume are not available while playback is disabled.
- **PARTIAL:** The product UI is a Preview experience; full customer acceptance across supported mobile/desktop browsers has not yet been recorded against one final milestone build.

Milestone 1 acceptance:
1. Every visible navigation item, CTA, button, and dashboard link reaches a working destination or is explicitly disabled with an honest explanation.
2. No customer-facing route linked from the app returns an unintended 404/500.
3. A new customer can register, verify email, sign in, sign out, and complete available password-recovery flows in Preview.
4. A signed-in customer can view and update supported account settings; persisted settings load correctly on the next session and cannot affect another account.
5. A customer can browse/search/filter the catalogue, view only currently published and territory-licensed titles, open details, and manage watchlist/history.
6. Empty, loading, validation, authorization, service-error, and success states are understandable and accessible.
7. Responsive checks pass on narrow mobile and desktop layouts; controls are keyboard-operable and have accessible labels.
8. No feature claims that video playback, downloads, payments, or real viewing progress are live when their release gates are closed.
9. Unit/integration tests, TypeScript, production build, and the agreed browser smoke suite pass on the milestone commit.

### Milestone 2 — Rights-cleared catalogue and secure media delivery
**Status: BLOCKED — provider activation and rights evidence pending**

Scope:
- Confirm documentary distribution rights, territories, term, permitted languages, and download permissions per title.
- Ingest approved assets into a managed video pipeline; maintain provider asset IDs separately from source URLs.
- Keep assets private and require short-lived signed playback grants after account, publication, licence, territory, and subscription checks.
- Validate adaptive HLS manifest and segment access, token expiry, denied access, and download restrictions on real non-production provider assets.
- Keep all playback flags off until the provider-backed test and release approval pass.

Existing evidence:
- **PASS (source/tests):** Fail-closed authorization service, territory/licence/entitlement checks, Cloudflare Stream adapter constraints, short-lived grant parsing, and player contract have targeted automated tests.
- **PASS (default safety):** Watch page remains disabled by default; absent provider configuration returns a controlled denial instead of a public/raw video URL.
- **PARTIAL:** Provider-backed Stream integration is implemented in source and tested with mocked provider responses; mocked tests are not proof of real Cloudflare delivery.
- **BLOCKED:** Cloudflare Stream account/resource, payment method, credentials, and provider activation are not configured/authorized for this POC. Owner instruction on 2026-11-24 deferred subscription/payment setup until the build and validation are complete. Do not add a payment method or subscribe now.
- **BLOCKED:** Operational POC execution and actual HLS/segment/expiry/edge-denial verification remain pending. The approved procedural test asset is restricted to the specified non-public Preview/test use; do not upload or expose other content without rights evidence.

Milestone 2 acceptance:
1. Each enabled title has inspected and recorded rights evidence, territories, licence dates, language, and allowed uses.
2. A lawful test asset is ingested into the approved non-production provider account.
3. Real provider responses confirm the asset is private, ready, and signed-playback-only.
4. Authorized users receive a short-lived grant; anonymous, banned, unlicensed, out-of-territory, unpublished, non-entitled, unknown-asset, and expired-token requests are denied.
5. Real HLS manifest and segment requests succeed before expiry and fail after expiry; no public ID, raw URL, download URL, API token, or signing secret is exposed.
6. Playback is verified on agreed mobile/desktop browsers and supported devices.
7. Playback/download flags remain off outside the explicitly approved test scope until all gates pass.

### Milestone 3 — Subscription, payments, and entitlements
**Status: PARTIAL — application foundation passes; provider webhook and production activation remain blocked**

Scope:
- Define Free/Premium plans, prices, billing cycles, eligibility, entitlement rules, and customer-visible subscription states.
- Create orders server-side and verify payments independently with the provider.
- Process provider webhooks using raw-body signature verification, durable unique event receipts, idempotency, and safe transaction boundaries.
- Support successful, failed, duplicate, delayed, mismatched, cancelled, expired, and refunded payment states.
- Add reconciliation, customer support, alerting, and auditable recovery procedures.
- Keep Production credentials and real-money activation separate from Preview Test Mode.

Existing evidence:
- **PASS (automated/code):** Authenticated Razorpay order creation, server-side INR pricing, user-bound idempotency, callback signature checks, captured-payment verification, webhook signature verification, durable event receipts, duplicate handling, and amount/currency mismatch review paths have targeted tests.
- **PASS (manual Preview):** ₹299 Razorpay Test Mode checkout and authenticated Preview callback were reported successful on 2026-11-20. This is checkout/callback evidence, not provider-originated webhook evidence.
- **PASS (Preview correlation):** Captured test payment correlates with a PAID order and active Premium subscription in the isolated Preview E2E database; recorded receipt is callback-prefixed.
- **BLOCKED:** Actual Razorpay-originated webhook delivery, provider-supplied event ID, successful provider HTTP response, and matching durable non-`callback:` receipt remain unverified.
- **PARTIAL:** Monitoring/alert routing, staffed REVIEW reconciliation, and audited data-level recovery remain outstanding.
- **NOT APPROVED:** Production payment credentials, real payments, Production domain testing, and payment activation have not been authorized.

Milestone 3 acceptance:
1. Published plan/pricing/benefit terms match server-side pricing and entitlement rules.
2. Preview Test Mode proves order creation, provider checkout, independent verification, provider-originated webhook delivery, and durable receipt correlation.
3. Duplicate/retried events cannot create duplicate subscriptions or regress paid state.
4. Failed, mismatched, unknown, refunded, and delayed events produce correct customer state and a traceable REVIEW/reconciliation path.
5. Subscription status and expiry are reflected accurately in the customer dashboard and protected playback authorization.
6. Alerting, operational ownership, support/reconciliation runbook, and recovery tests are accepted.
7. Production activation remains a separate explicit owner decision after all Production gates pass.

### Milestone 4 — Admin, catalogue, and operational workflows
**Status: PARTIAL — reviewed foundations pass; end-to-end operator workflows need completion**

Scope:
- Admin/Superadmin access, role management, and safe customer administration.
- Draft creation, metadata editing, review/approval, publishing/unpublishing, archival, and rights/licence lifecycle.
- Catalogue quality, poster/backdrop/trailer metadata, language/subtitle metadata, search discoverability, and territory-aware availability.
- Atomic audit logs for privileged changes, operator visibility, support/reconciliation workflow, and safe operational actions.
- Documented ownership and separation of duties for high-impact actions.

Existing evidence:
- **PASS (reviewed scope):** Server-side ADMIN/SUPERADMIN checks protect the reviewed movie and licence APIs.
- **PASS (reviewed scope):** Reviewed movie/licence mutations write audit records in the same transaction; append-only audit controls and failure rollback tests exist.
- **PARTIAL:** The existing admin UI/API scope covers movie drafts and licence actions. The repository audit does not establish complete coverage of every admin page/API, customer-support workflow, analytics, or publishing operation.
- **PARTIAL:** Audit/backup/security documentation exists; live alert routing and staffed operational processes are not verified.

Milestone 4 acceptance:
1. Admin/Superadmin permissions are server-enforced on every privileged page and API, with negative tests.
2. Operators can create, edit, review, approve/reject, publish, unpublish, and archive titles without bypassing licence checks.
3. Rights, territory, release windows, languages, and asset readiness are visible and validated before publication.
4. Every privileged mutation is attributable and atomically audited; audit history is append-only and queryable by authorized operators.
5. Customer support, payment REVIEW, refund/escalation, and incident workflows have named owners and evidence.
6. All admin workflows pass isolated integration and browser tests.

### Milestone 5 — Production readiness, compliance, and launch
**Status: BLOCKED — Preview readiness is not Production approval**

Scope:
- Complete security review, vulnerability/dependency checks, secrets/environment configuration, least-privilege access, and branch protection.
- Validate database migrations, backup retention, restore/PITR, disaster recovery, and rollback.
- Establish production monitoring, alert routing, incident ownership, log retention, and operational runbooks.
- Complete privacy policy, terms, content-rights evidence, takedown/contact process, payment disclosures, and jurisdiction-specific legal review.
- Verify performance, accessibility, SEO, analytics/privacy controls, and supported device/browser matrix.
- Perform staged Production deployment and post-deployment smoke tests only with explicit owner approval.

Existing evidence:
- **PASS (Preview/CI):** Phase 5 current-head CI and Vercel checks passed; Playwright browser E2E passed 12/12 on the recorded run.
- **PASS (Preview):** Protected Preview health endpoint returned HTTP 200 with database `ok`; security headers and `X-Robots-Tag: noindex` were observed.
- **PASS (migration CI):** A fresh ephemeral PostgreSQL 16 workflow applied the repository migrations and verified the migration ledger with no unresolved rows for the recorded run.
- **PASS (review snapshot):** Independent approval was recorded for PR #15 head `81da4c3d7c2e0d6c98376dd87214feeb2226034c` on 2026-11-25. Any subsequent commit changes the PR head and requires fresh review of that exact head.
- **PARTIAL:** Backup/restore automation and runbooks exist, but a complete Production recovery/PITR drill and operational acceptance are not established by the evidence recorded here.
- **BLOCKED:** Production payment activation, real provider-backed media playback, production monitoring/alert routing, legal/compliance sign-off, and end-to-end Production smoke evidence remain outstanding.
- **NOT APPROVED:** No Production deployment, Production database/environment mutation, Production payment, public media activation, custom DNS change, or provider subscription/payment-method change is authorized by this roadmap.

Milestone 5 acceptance:
1. All Milestones 1–4 are PASS with no unresolved critical/high-severity blockers.
2. Independent security review approves the exact release candidate commit; CI, migration, browser E2E, and deployment checks match that same commit.
3. Production environment variables are configured through approved secret stores, least-privilege roles are verified, and no secret is present in source/history.
4. Backup retention, restore, PITR, rollback, and incident exercises pass with recorded evidence and assigned owners.
5. Monitoring and alert delivery are tested end-to-end; on-call and customer-support escalation are staffed.
6. Legal/privacy/terms, title rights, licensing, payment disclosures, and customer support/takedown contacts are approved.
7. Performance, accessibility, security, and supported-device acceptance tests pass.
8. The owner explicitly approves the production release scope; controlled deployment and post-deploy smoke checks pass.
9. The public platform is safe, usable, legally entitled to deliver every enabled title, and operationally supportable.

## Final platform acceptance — definition of complete

NexaFilm is complete only when **all five milestones are PASS** and the following end-to-end customer journey is demonstrated on the approved Production release:

1. A new customer can register, verify, sign in, and manage their profile securely.
2. The customer can discover and search a catalogue containing only titles licensed for their territory and current date.
3. The customer can view accurate title details, audio/subtitle options, and transparent plan terms.
4. The customer can subscribe through a verified payment flow; payment state and entitlement remain correct under duplicate, failed, delayed, refund, and retry scenarios.
5. The customer can play the entitled title over private adaptive streaming with signed, expiring access; unauthorized or expired access is denied.
6. Watchlist, viewing progress, continue-watching, and history work against the customer's account and recover correctly across sessions/devices.
7. Operators can manage content and rights safely, with complete auditability and support/reconciliation procedures.
8. The service passes production monitoring, backup/restore, security, legal, accessibility, performance, and incident-readiness checks.

**No public launch based on a green build alone.** If any mandatory acceptance item is not evidenced, the platform remains Preview / NOT APPROVED.

## Delivery rules — to prevent endless checklist work

- Work on one milestone at a time. Current milestone: **Milestone 1**.
- Within a milestone, group related changes into a meaningful user-visible product increment; do not split every tiny concern into an independent task.
- Before implementation, state the outcome and acceptance tests. After implementation, run the tests and record PASS/FAIL with evidence here.
- Do not repeat a PASS unless new code or evidence invalidates it.
- Do not start a future milestone while the current milestone has unmet acceptance criteria, except to resolve a true blocking dependency.
- Keep provider setup, subscriptions, payment-method changes, real payments, media upload/activation, Production resources, DNS, and Production database changes behind separate explicit owner approval.
- Never mark a mocked provider test as live provider proof, a Preview test as Production proof, or an old reviewed commit as approval for a newer commit.
- When a milestone passes, record its commit, environment, test evidence, known limitations, and exactly one next milestone.

## Current next implementation

**Completed Milestone 1 increments:** (1) Account settings and persistence — PASS, run #593. (2) Email-verification recovery, removal of inert auth actions, and truthful documentation — PASS, run #596. (3) Cross-browser account language preference sync — PASS, run #598. (4) Customer navigation/account-library journey audit — PASS, run #600. (5) Accessible mobile primary navigation — PASS, run #602. (6) Customer password-change experience — PASS, implementation commit `2f7de4b0e6d01c8f9d45f2a2990e3ed5133a8e4a`, final exact-head test commit `21c3f250c6986b14a6648f7aae9c04f8bc47647a`, run #606, Preview deployment READY. **Next grouped product increment:** make the saved English/Tamil preference meaningful across the core customer experience. Today the setting persists across browsers, but only the shared navigation labels are translated while Home, Catalogue, account screens, and subscription copy remain English. Expand the central translation dictionary and apply it to the main customer screens (Home, Movies/search/filters, Dashboard/library, Account Settings/password actions, and plan/payment-status messages); preserve English as fallback and verify the same key customer journey in English and Tamil mobile/desktop E2E. Do not translate catalogue/movie source metadata or claim additional interface languages until they are actually supported.
