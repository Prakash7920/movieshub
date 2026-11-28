# NexaFilm — Creator Studio MVP Implementation-Impact Assessment v1

- **Assessment date:** 2026-11-27 (Asia/Kolkata)
- **Roadmap checkpoint:** Phase 5.51 / Creator Economy C2
- **Inspected repository:** `Prakash7920/movieshub`
- **Inspected branch:** `phase-5/consolidated-security-ops`
- **Exact inspected commit:** `102a55082b383cd19be88f1c3a75640ff4e8ccff`
- **PR:** #15, open and unmerged at inspection time
- **Assessment mode:** Read-only source / schema / route / test inspection
- **Outcome:** Reuse assessment and minimum implementation recommendation only; no code, schema, database, provider, media, configuration or deployment action is authorised.

## 1. Executive finding

NexaFilm already has a useful OTT foundation for the Creator Studio MVP: verified customer identities, private account settings, an admin-only catalogue draft workflow, a title-level licence review workflow with controlled document reference / SHA-256 / reviewer attestation, atomic admin audit writes, territory-aware catalogue filtering and fail-closed signed playback.

It does **not** yet have a Creator Studio. There is no creator profile/application, creator-owned submission API, submission/review lifecycle, series/season/episode structure, private media-ingest route, creator moderation queue, usable complaint/takedown case workflow, creator revenue ledger or creator payout flow in the inspected branch.

**Recommended direction:** extend the existing NexaFilm account, catalogue, rights, admin, audit and playback system. Keep one canonical streamable catalogue record and preserve all existing customer playback / licensing gates. Add creator ownership and submission state as separate concepts; do not overload the global admin role or mark user submissions published on upload.

The lowest-risk first implementation increment is an invitation-led Creator Application + metadata-only Draft Submission flow. It should not accept video files, publish content, activate playback, make commercial promises or process creator payouts. Those capabilities follow only after policy, rights, private-ingest and owner approval gates.

## 2. Inspected foundations and reuse decision

| Area | Existing implementation inspected | Reuse decision | Material gap for Creator Studio |
|---|---|---|---|
| Identity / authentication | `User` model; NextAuth credentials session; email verification, ban state, password reset/change, session revocation; `getApiSession` helper | **Reuse** the existing User identity and session. Require verified email and non-banned account. | No creator application or separate creator eligibility state. |
| Account profile | `Profile` supports display name and language preference; `app/api/profile/route.ts` scopes changes to the signed-in user | **Reuse** account identity and settings; create a distinct creator-facing profile rather than treating a viewer Profile as a public creator channel. | No creator slug, public bio, creator status, application state or verified-creator marker. |
| Roles / permissions | Prisma `Role` enum is `USER`, `ADMIN`, `SUPERADMIN`; admin routes re-read the database role and ban state | Keep admin roles separate. Creator capability should be a profile / membership state, not a new global admin privilege. | No creator-only authorisation helper, creator-owned row scope or creator APIs. |
| Catalogue | `Movie` holds title, synopsis, poster/backdrop, language, audio/subtitles, runtime, age rating, genre, publication state and playback asset fields. `ContentStatus` is DRAFT / PUBLISHED / UNPUBLISHED / ARCHIVED. | **Reuse as the canonical customer catalogue and playback item** for a standalone short film. Preserve current routes and customer library references. | No creator owner link, submission version, content kind, or series/season/episode relationship. |
| Admin draft workflow | `app/api/admin/movies/route.ts` and `components/admin/admin-movies.tsx` create unpublished DRAFT rows, edit only drafts and audit create/edit/publish/unpublish/delete. | Reuse the admin catalogue editor and publication controls as operator tools after creator submissions are accepted. | Creator cannot submit metadata directly; only ADMIN / SUPERADMIN can create and edit drafts. |
| Rights / licence | `License` is one-to-one with `Movie` (`movieId @unique`) and includes owner, status, dates, permitted countries, download flag, evidence reference, SHA-256, explicit scope attestation, reviewer and review time. | **Reuse the current License as the final title-level playback/publication gate** and keep actual contracts in restricted external legal storage. | One evidence reference/hash and one broad Boolean attestation do not represent the complete C1 rights matrix (per business model, language, audio, promotion, technical processing, version or third-party permission). |
| Licence review | `app/api/admin/licenses/route.ts` saves licences as PENDING, unpublishes an already-published Movie on licence save/rejection, requires reference + SHA-256 + scope attestation for ACTIVE, records reviewer/time and writes an audit event. | Reuse current fail-closed workflow and extend it only after the granular rights requirements are approved. | No creator self-service rights declaration, multi-document evidence set or dedicated rights-case queue. A hash does not verify the underlying contract. |
| Admin audit | `AdminAuditLog`, append-only controls and `writeAdminAuditEvent(tx, ...)` support transaction-coupled records; integration tests assert rollback when audit persistence fails. | **Reuse** for creator application, submission, review, rights and moderation decisions. Keep sensitive contract / identity contents out of audit metadata. | New action names / resource types and reviewer workflows will need tests. |
| Public catalogue | `app/api/movies/route.ts` and `app/movies/[slug]/page.tsx` filter for published content and current ACTIVE licence, date and viewer territory. | Reuse to expose only approved creator content through the same catalogue and geography enforcement. | No creator channel or episodic navigation. |
| Playback | `app/api/media/[slug]/route.ts`, `lib/media/playback-service.ts`, `lib/media/access-policy.ts`, `lib/media/playback-grant.ts`, Cloudflare Stream adapter | **Reuse** the existing signed-grant / entitlement / territory / licence / publication checks. | The inspected Cloudflare adapter creates playback grants; the route is GET-only. No creator upload / ingest / asset-creation endpoint was found. |
| Reports / moderation | Prisma has a minimal `Report` model (`userId`, optional `movieId`, free-text `type` / `description`, `status`, timestamps). | Treat this only as a data-model starting point, not a functioning complaint workflow. | No report API route, report intake page, moderation queue, assigned reviewer, severity, statutory deadline, notice, decision, appeal or case audit workflow was found. Reporter must currently be a User because `userId` is required. |
| Episodic structure | No `CreatorProfile`, `CreatorSubmission`, `Series`, `Season` or `Episode` model / route was found in the inspected schema/tree. | Add the smallest explicit series hierarchy while preserving `Movie` as the streamable item, subject to architecture review. | Current content shape is a flat Movie catalogue. |
| Revenue / payments | `Payment`, `Subscription` and Razorpay order / webhook routes support customer subscription purchases. A basic `Advertisement` model exists. | Reuse authentication, audit and general payment-security patterns only. Keep pilot sponsorship accounting manual outside the product initially. | No sponsor-campaign model, eligible-net-revenue ledger, creator statement, payable, payout, bank/tax verification, creator disbursement or sponsor impression reconciliation exists. Customer payments are not creator payouts. |
| Tests | Admin movie, admin licence, audit transaction, public catalogue and playback tests exist and use the isolated `movieshub_test` database guard. | Reuse the same isolated DB integration, auth negative tests, audit assertions and browser testing conventions. | No creator application/submission/ownership/moderation/series/payout tests exist. |

## 3. Critical boundaries identified

### 3.1 Do not turn a Creator into an Administrator

The current global `Role` enum is used for privileged access. Do not add `CREATOR` to this enum as a shortcut. A creator must remain an ordinary signed-in viewer as well as having a separately approved creator capability.

Recommended rule:
- `User` remains the login identity.
- A one-to-one `CreatorProfile` (or application record before approval) expresses creator onboarding / eligibility.
- Only an approved and active creator profile can create or manage its own submissions.
- Server APIs must query ownership on every read and mutation; client-supplied creator IDs must never establish ownership.
- ADMIN / SUPERADMIN review remains a separate permission.

### 3.2 Keep submission lifecycle separate from publication lifecycle

Do not overload existing `ContentStatus` with every creator review state. It currently represents catalogue publication / archival state. A creator submission needs a distinct workflow such as:

`DRAFT → SUBMITTED → RIGHTS_REVIEW → CONTENT_REVIEW → NEEDS_CHANGES / REJECTED / APPROVED_FOR_RELEASE`

Only after rights and content decisions pass should the operator create / associate the canonical `Movie` catalogue record as an unpublished DRAFT. Publication remains a separate final action subject to the existing current ACTIVE licence and territory checks.

### 3.3 Keep one canonical streamable object

For the MVP, prefer the existing `Movie` row as the canonical playback / catalogue unit for both:
- standalone creator short films; and
- an episode in a creator series.

A small explicit `CreatorSeries` / `CreatorSeason` / `CreatorEpisode` hierarchy can organise episodes, with each Episode linked one-to-one to its canonical Movie. This retains existing Movie slug, territory licence, watchlist/history, entitlement and signed-playback paths. Do not create a second unrelated video asset and playback system.

This recommendation is conditional on an implementation design review and database migration plan. If current product naming or constraints make the Movie-as-streamable-unit approach unsafe, stop and present the alternatives before migration.

### 3.4 Rights evidence must be more granular than the current licence pointer

The current License is a strong final gate but does not yet model every C1 permission independently. Before creator uploads are enabled, the implementation design must decide how to represent at least:
- exact work / version and rights holder / authorised licensor;
- territory and start / expiry / holdback;
- subscription, sponsorship / advertising-supported, transactional and free use separately;
- online streaming and the exact hosting / storage / backup / encoding / transcoding / packaging / HLS / CDN vendor processing rights;
- audio, subtitles, translation, dubbing and accessibility versions;
- promotional assets (poster, still, trailer, clip) separately;
- download / offline, editing / excerpting, sublicensing and AI / ML as separately granted or explicitly excluded;
- multiple supporting documents, reviewers and review history.

Keep the signed documents in restricted legal storage. Store only approved references, hashes, scope records and reviewer metadata in NexaFilm. Never treat a checksum as proof of ownership or permission.

### 3.5 Media ingestion is a distinct missing subsystem

The inspected media route is a playback grant GET endpoint. The Cloudflare Stream adapter is used to issue and validate signed playback grants; no provider upload / asset creation route or Creator Studio file intake was found.

Creator Studio must not:
- accept a public permanent video URL as a substitute for rights / secure ingest;
- expose source files or unrestricted asset URLs;
- call the playback-grant endpoint to upload files;
- enable direct-to-provider uploads before one-time scoped authorisation, private asset creation, file checks, webhook / readiness verification, rights checks and separate owner approval exist.

A secure private ingest pipeline is a later, separately approved C3 task, not part of the first metadata-only Creator Studio increment.

### 3.6 The existing Report model is not a ready moderation feature

A functioning C1 complaint workflow needs a case record and operating process: a report can be filed without an account where legally / operationally required; content and territory identifiers; case category and urgency; claimant contact stored securely; received timestamp and statutory route / deadline; assigned reviewer; action / rationale; notifications; appeal; closure; legal hold and audit trail. Do not store illegal imagery or unnecessary sensitive data in ordinary database fields or logs.

## 4. Recommended minimum data / domain additions (design only)

The following is a proposed design boundary for a later owner-approved implementation. It is not a final Prisma schema and does not authorise a migration.

| Proposed concept | Minimum responsibility | Notes / constraints |
|---|---|---|
| `CreatorProfile` | One creator capability / public profile linked to existing `User`; status such as APPLIED / APPROVED / SUSPENDED / CLOSED | Keep legal identity / contracts out of public profile fields. Do not use global ADMIN role. |
| `CreatorSubmission` | Creator-owned work submission; lifecycle, submitter, review status, revision/version, reviewer and decision metadata | Must enforce one creator's access to only their records. Keep status separate from Movie publication state. |
| `Movie.creatorProfileId` (nullable) | Attribute an accepted canonical Movie to a creator | Existing catalogue titles remain null / unowned unless separately and validly attributed; never infer creator ownership from metadata. |
| `CreatorSeries` / `CreatorSeason` / `CreatorEpisode` | Series, season and ordered episode presentation | Episode links to exactly one Movie as its streamable item; ordering and uniqueness constraints required. |
| Rights scope / evidence records | Normalised permissions and multiple controlled evidence references for a title/version | Define right types, business model, territories, term, language/version, technical processing and ancillary permissions. Preserve current License ACTIVE gate until migration is approved. |
| Moderation / grievance case | Rights, safety, privacy, content and policy reports, case SLA, assigned reviewer, outcome and appeal | Support account and non-account reporters as legally appropriate; sensitive evidence stays in restricted storage. |
| Creator audit events | Application, submission, rights, moderation, publish and removal decisions | Use transaction-coupled append-only audit for privileged decisions. Never put private contracts / ID / bank details in metadata. |

### Explicitly deferred domain areas

- Creator revenue / payable / payout ledger, bank and tax onboarding.
- Automated sponsorship tracking, ad impressions, invalid-traffic computation or programmatic advertising.
- Viewer cash rewards, redeemable points and referral commissions.
- Downloads / offline, public comments, direct messages and open public uploads.
- AI training / voice cloning / likeness generation.
- Public creator self-publishing without admin review.

These may be designed after the controlled creator-submission and rights workflow has been validated.

## 5. Minimum first implementation increment recommended

After this assessment is reviewed and the owner explicitly approves schema/code work, start with **Creator Application + Metadata-only Draft Submission**:

1. Add a creator application/profile linked to the existing User identity; require verified email, non-banned account and adult eligibility flow approved by C1 legal review.
2. Add a Creator Studio route that shows application status and the creator's own draft submissions only.
3. Allow metadata-only submission for an original short film / proposed series shell: title, synopsis, language, runtime, credits, content declarations and rights-declaration status. Do not accept the video master yet.
4. Create a server-side submission API with Zod validation, same-origin + JSON request guards, bounded body size, rate limits, private no-store responses, audit trail and strict creator ownership checks.
5. Add an admin review queue for applications / metadata submissions using existing admin role checks and transaction-coupled audit writes.
6. Keep every submission private and unpublished. The creator cannot set `isPublished`, `ContentStatus.PUBLISHED`, License ACTIVE or a playback asset ID.
7. Add isolated integration / browser tests for unauthenticated, unverified, banned, ordinary viewer, approved creator, cross-creator IDOR, invalid status transitions, audit rollback, and no publication / playback side effects.

**Acceptance:** an approved creator can create and edit only their own metadata draft; a different creator cannot read or mutate it; an admin can inspect and return / reject it with an audited reason; no file is uploaded; no content is public; existing movie catalogue, licence and playback tests remain green.

## 6. Later implementation sequence (not started / not approved)

| Order | Increment | Depends on |
|---|---|---|
| C2-I1 | Creator application/profile + own metadata drafts + admin queue | Owner approval of schema/code work; C1 policy review before real users |
| C2-I2 | Series / season / episode hierarchy and episode navigation using canonical Movie playback items | I1 accepted; final domain model review |
| C2-I3 | Granular title rights declaration / evidence and reviewer workflow | C1 counsel sign-off; rights-store process approved |
| C3 | Secure private media ingest, scanning, provider asset creation, readiness and takedown | Rights model, security review, separate provider / owner approval |
| C4 | Creator pages, viewer follow, series navigation, next episode, reporting UX | C1 complaint / privacy controls and C3 playback readiness where video is involved |
| C5 | Sponsorship campaign, creator earnings statements and payout controls | C0 commercial decisions, finance/tax/legal approval, sponsor contract and payout design |
| C6 | Controlled 3–5 creator / 5–10 work pilot | All rights, legal, moderation, provider, finance, support and release gates pass |

## 7. Existing safety / test constraints to preserve

- Admin APIs already use database-backed role checks, rate limits, same-origin checks, JSON body limits and no-store responses. Creator APIs require analogous protections but a different ownership rule.
- Licence save / rejection automatically unpublishes an already published Movie; approval requires a current PENDING licence, valid dates / countries, controlled evidence reference, a SHA-256 and explicit reviewer attestation.
- Public catalogue filtering requires publication, ACTIVE licence, current term and viewer country. Playback also applies authentication, ban, entitlement, title licence, territory and short-lived signed-grant checks.
- Audit events must be written in the same database transaction as each privileged mutation; if audit insertion fails, the business mutation must roll back.
- Existing database integration tests explicitly refuse non-localhost / non-`movieshub_test` targets. Any new tests must preserve this isolation.
- The current Preview and Production databases must not be used for new test fixtures or exploratory writes.
- PR #15 remains open and unmerged. This assessment does not approve merging it or any other PR.

## 8. Approval gates and owner decisions

| Decision / permission | Needed before | Status |
|---|---|---|
| Approve Creator Application + metadata-only Submission schema and code implementation | C2-I1 code / migration work | **Owner approval required** |
| Approve proposed canonical Movie-as-streamable-item + Series / Season / Episode linkage | Before schema design is finalised | **Owner approval required** |
| Qualified Indian counsel review of C1 policy / legal classification | Live creator terms, real creator submissions, complaints process or publication | **Pending** |
| Approve secure legal evidence-store workflow and reviewer assignments | Real creator rights evidence intake | **Pending** |
| Approve Preview-only schema migration (if needed) | Applying migration to Neon Preview | **Separate owner approval required** |
| Approve provider account/resource, billing or credentials | Secure upload / real provider asset | **Not authorised** |
| Approve any actual creator contract, revenue percentage, sponsorship or payout | External commercial commitment | **Not approved** |
| Approve publication, playback activation or Production action | Public release | **Not approved** |

## 9. C2 acceptance checklist

- [x] Exact PR head / branch inspected.
- [x] Prisma domain schema inspected.
- [x] Authentication, profile and role boundaries inspected.
- [x] Admin movie / licence APIs and UI inspected.
- [x] Rights evidence, approval and audit patterns inspected.
- [x] Catalogue, territory, entitlement and playback paths inspected.
- [x] Report / moderation and episodic data gaps identified.
- [x] Existing payment model distinguished from creator payouts.
- [x] Minimal reuse-first architecture and no-code first increment recommended.
- [x] Explicit approval and safety gates recorded.

**C2 result:** PASS — read-only implementation-impact assessment complete on exact inspected commit `102a55082b383cd19be88f1c3a75640ff4e8ccff`. The inspected source is the state at that commit; any later branch changes require a fresh diff / review before implementation. No code, tests, schema, migration, database row, shared Preview / Production resource, provider, media, payment, payout, environment variable, DNS, feature flag, playback, PR merge or Production operation was changed.

**Next single task:** C2-I1 — after explicit owner approval, implement Creator Application + metadata-only Draft Submission and admin review queue using the existing account, admin and audit foundations. No media upload or publication is included in that increment.
