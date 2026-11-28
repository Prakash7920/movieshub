# NexaFilm — Creator Economy MVP Requirements & Revenue Rules v1

- **Prepared:** 2026-11-26 (Asia/Kolkata)
- **Roadmap checkpoint:** Phase 5.49 / Creator Economy C0
- **Status:** PRODUCT REQUIREMENTS AND COMMERCIAL RECOMMENDATION — documentation only
- **Repository / branch:** `Prakash7920/movieshub` / `phase-5/consolidated-security-ops`
- **Product direction:** Extend the existing NexaFilm OTT product with a controlled creator-powered ecosystem. Do not rebuild the platform or introduce a separate product.
- **Approval boundary:** This document does not authorise code changes, creator offers, signed contracts, payment setup, creator payouts, media upload, provider provisioning, database changes, feature flags, publication or Production activity.

## 1. Executive decision

NexaFilm should begin as a **curated, creator-powered streaming platform**, not an unrestricted user-upload site and not a full advertising network on day one.

The recommended low-cost first monetisation route is **creator-specific sponsorship** for clearly identified original short films or episodic works. It can be negotiated and tracked manually for a small pilot, without depending on high advertising volume, an ad network SDK, programmatic ad sales or an immediate platform-wide subscription pool.

The audience experience should initially be free to watch for approved pilot content. Viewers receive product value through discovery, creator follows, series continuity, watchlists, opt-in creator updates and community recognition. Do not pay viewers to click ads, watch ads, inflate views or perform artificial engagement.

The initial commercial proposal for discussion is **70% of eligible net creator revenue to the creator and 30% to NexaFilm** for a directly attributable creator sponsorship. This is a recommendation only, not an approved promise, published rate card, signed commercial term or instruction to pay. It requires owner, finance and legal approval before any creator is offered it or any implementation uses it.

## 2. MVP scope and exclusions

### 2.1 Included in the first creator MVP

1. Invitation-led creator application and profile, linked to the existing NexaFilm customer identity where technically appropriate.
2. Submission of original Tamil short films and episodic series/episodes.
3. A creator-owned channel/profile and a simple series/season/episode structure.
4. Rights declarations and title-specific evidence intake for each work and version.
5. Private submission and manual pre-publication review; creators cannot publish directly to the public catalogue.
6. Viewer discovery, creator follow, watchlist, episode navigation and a next-episode action.
7. A creator-facing status page for draft, submitted, needs-changes, approved, rejected, suspended and removed states.
8. A basic campaign/revenue ledger specification that can be reconciled manually before payout automation exists.
9. A reporting/takedown route and operator audit trail.

### 2.2 Content types

**MVP content types**
- Tamil independent short films, proposed typical runtime 3–20 minutes.
- Episodic independent web series, with a series, season and episode hierarchy; proposed episode runtime up to 15 minutes.
- Original creator-made animation or documentary may be accepted only when the same rights and moderation requirements can be met; do not make these a separate engineering workflow in v1.

**Deferred**
- Commercial feature films and catalogue titles requiring external distributor negotiations.
- Live streams, public comments, direct messages, fan-to-fan uploads, unrestricted public channels, downloads/offline access, user remixes, dubbing/editing tools and AI-generated or AI-trained content.
- Multi-language dubbing marketplace, creator collaboration splits and automated royalty allocation.
- Cash rewards to viewers, referral commissions and redeemable points.

Runtime ranges are product defaults for the pilot, not legal classifications or hard technical guarantees. Admin review may accept an exception without changing the rights requirements.

### 2.3 Creator eligibility

For the first controlled pilot:
- Invitation-led; creator must be an adult (18+) or contract through a properly authorised legal entity. Do not onboard a minor as a contracting creator in the initial pilot.
- Creator must identify whether they are the producer, director, rights owner, distributor or an authorised representative.
- The creator must demonstrate authority for every right requested. Being the director, actor, uploader or social-media account owner alone is not sufficient evidence.
- Creator must accept the platform's approved terms, content standards, privacy notice and takedown process.
- Payment onboarding is separate from content submission and occurs only after commercial terms and lawful payout requirements are approved.

### 2.4 Territory

For the first pilot, target viewers in India only as an operational default, subject to the specific rights grant and geographic controls. This does **not** assume that any creator owns India-wide or worldwide rights. A title can be enabled only for the exact countries and dates evidenced by its signed licence. International expansion is a later decision.

## 3. Monetisation options compared

| Model | Creator earning path | Cost / complexity | Main risks / dependencies | Recommendation |
|---|---|---|---|---|
| Direct sponsorship per creator/work | Sponsor pays for an agreed campaign; attributable eligible net receipts are shared | Low-to-medium if handled manually for a small pilot | Sponsor contract, ad disclosure, brand suitability, receipt reconciliation, creator permission | **First pilot choice** |
| Programmatic / platform advertising | Ad partner pays based on valid monetised impressions/views | Medium-to-high | Audience scale, partner eligibility, invalid traffic, ad operations, reporting and policy compliance | Defer until meaningful audience and controls exist |
| Subscription revenue pool | Part of paid subscription revenue is allocated among creators | High | Subscription entitlement, allocation formula, attribution, churn/refunds, tax and accounting | Defer until subscription product is stable |
| Fan support / memberships | Viewer voluntarily contributes or joins paid creator membership | Medium-to-high | Payment processing, refunds, platform fees, creator payouts, consumer/tax rules and abuse handling | Later phase |
| Transactional episode / pay-per-view | Viewer pays for a specific work or season | Medium-to-high | Checkout, refunds, territory pricing, customer support, piracy and entitlement | Later phase |
| Viewer rewards funded by ads or watch activity | Viewer receives value for engagement | High and risky | Invalid ad traffic, manipulation, fraud, financial/consumer implications | **Do not use in MVP** |

### 3.1 Why sponsorship is the first choice

- A small creator cohort does not need millions of views to have a defined commercial transaction.
- NexaFilm can test whether brands want to support independent Tamil storytelling before building an ad-tech stack.
- Each campaign can be linked to a creator and a work using a simple campaign reference and auditable manual ledger.
- The sponsored placement can be clearly labelled; the creator can approve the brief and brand category.
- Payment is based on actual sponsor funds received, not estimated CPM, unverified views or projected advertising income.

A sponsorship is not guaranteed. The pilot must not promise earnings unless a sponsor agreement is executed and the sponsor's funds have cleared.

## 4. Recommended pilot commercial rules

### 4.1 Proposed revenue share — approval required before use

For a directly attributable creator sponsorship, the recommended discussion starting point is:

- **Creator: 70% of Eligible Net Creator Revenue**
- **NexaFilm: 30% of Eligible Net Creator Revenue**

This is deliberately a share of a defined net-receipt base, not 70% of gross sponsor invoice value. The percentage is **not approved** by this document. It must not appear in outreach, public creator terms, a rate card, a signed agreement or code until the owner approves it after finance/legal review.

For a sponsor campaign that funds several creators, the campaign agreement must define each creator's allocation before the campaign starts. Do not allocate by raw views alone. Use an agreed fixed allocation or an explicitly stated campaign deliverable allocation. The allocation must add up to 100%.

### 4.2 Eligible Net Creator Revenue (ENCR)

For a campaign and a creator:

`ENCR = Cleared Cash Actually Received − Excluded Taxes − Refunds/Chargebacks − Approved Direct Campaign Costs − Payment/Collection Fees`

Definitions:
- **Cleared cash actually received:** sponsor money settled into the NexaFilm-controlled business account. Unpaid invoices, verbal commitments, forecast value and barter value are not cash receipts.
- **Excluded taxes:** indirect taxes collected on behalf of a tax authority, where applicable and properly identified. Tax treatment must be confirmed by a qualified Indian tax adviser.
- **Refunds/chargebacks:** amounts actually refunded, reversed or validly disputed. Only the attributable amount is deducted.
- **Approved direct campaign costs:** costs specifically approved in writing before the campaign, directly attributable to it and supported by records. General company overhead, unrelated salaries, founder time and unrelated software subscriptions are not automatically deductible.
- **Payment/collection fees:** actual documented bank/payment collection charges for that receipt.
- Do not deduct the same amount twice. No unlisted deduction is allowed.
- Creator-specific ENCR is calculated only after applying the agreed campaign allocation where multiple creators are included.

### 4.3 Example calculation (illustrative only)

Assume a single-creator sponsorship receipt of ₹10,000, excluding applicable indirect taxes:
- Cleared sponsor receipt: ₹10,000
- Approved direct campaign cost: ₹800
- Collection fee: ₹200
- Refunds/chargebacks: ₹0
- Eligible Net Creator Revenue: ₹9,000
- Creator's proposed 70% share: ₹6,300
- NexaFilm's proposed 30% share: ₹2,700

This example is arithmetic only. It is not a quote, guaranteed earning, approved split, tax calculation or promise of payment.

### 4.4 Statement and settlement proposal

Subject to owner/finance/legal approval:
- Prepare a creator statement monthly, even when the payable amount is zero.
- Show opening balance, campaign/work reference, cleared receipts, allocation, each permitted deduction, ENCR, creator share, any statutory withholding, prior adjustments, closing balance and payment reference.
- Proposed settlement: within 30 calendar days after month end for amounts that are cleared, undisputed, supported by the signed agreement and complete payout documents.
- Proposed minimum payout threshold: ₹1,000. Balances below the threshold roll forward without forfeiture. The threshold is a proposal and requires approval.
- Disputed, refunded or reversed amounts may be held only to the extent reasonably related to the dispute or reversal; statements must identify the hold and reason.
- No payment is due from projected revenue, unpaid sponsor invoices, unverified traffic or a marketing promise.
- If no sponsor revenue is received, creator share is ₹0. No minimum guarantee or minimum earning is promised.

### 4.5 Identity, tax and payout controls

Before first payout:
- Verify the contracting creator/entity and authorised signatory.
- Collect only necessary identity, address, bank and tax information using a secure, access-controlled process; never collect these details in public chat, DM or email replies.
- Complete applicable tax documentation, invoicing, withholding and reporting requirements with qualified Indian finance/tax counsel.
- Match payee, contract and bank beneficiary; flag mismatches for manual review.
- Require maker-checker approval for payout preparation and release.
- Maintain an immutable or append-only audit record for calculation, adjustment, approval, payout reference and reversal.
- Provide a dispute route and a reasonable query window.
- Do not build automated payouts until the manual calculation and reconciliation process has passed a controlled pilot.

## 5. Creator journey

1. **Discover / invitation:** NexaFilm invites a creator or accepts a creator's request to be considered. An invitation is not acceptance or a rights grant.
2. **Account:** Creator signs in through the existing NexaFilm account system. Avoid creating a second identity store unless code inspection proves it is necessary.
3. **Application:** Creator supplies profile, public portfolio, role in the work and contact preferences. Do not request bank details at this stage.
4. **Verification:** Admin verifies identity/contracting capacity and whether the creator can license the requested rights.
5. **Work submission:** Creator creates a draft entry with title, synopsis, language, runtime, version, credits and rights declarations. File transfer occurs only through a separately approved private ingest route.
6. **Rights evidence:** Creator supplies controlled evidence through the approved secure legal intake process. NexaFilm records only permitted evidence references/hash/reviewer metadata. The actual document is reviewed by an authorised human; a hash alone is not legal verification.
7. **Moderation and review:** Admin checks content, metadata, age/access suitability, rights chain, contributor/music/third-party clearances and platform policy.
8. **Decision:** Creator sees Draft, Submitted, Needs Changes, Approved, Rejected, Suspended or Removed, with a reason and appeal/contact route.
9. **Publication:** Only an approved title with a completed signed licence, title-specific scope and separate media/provider/playback approvals can be published.
10. **Earnings:** If a valid sponsorship campaign exists, creator sees its written terms and campaign status, then a reconciled statement after cleared funds are received.

## 6. Viewer journey and viewer value

1. Viewer discovers a curated creator/channel or a title in the catalogue.
2. Viewer sees transparent synopsis, runtime, language, captions, content suitability and sponsorship disclosures.
3. Viewer can watch approved free pilot content without paying or being asked to click an advertisement.
4. Viewer can follow a creator, save a title, continue a series and move to the next episode.
5. Viewer can opt in to creator updates; notification frequency and unsubscribe controls must be clear.
6. Viewer can report content or a rights/safety concern.
7. Viewer may receive non-cash recognition such as a supporter badge, curated creator updates, moderated polls, Q&A access or early-access windows only when the creator's separate rights grant permits them.

### 6.1 Viewer rewards boundary

For MVP:
- Use non-transferable, non-cash product benefits only.
- Do not create points redeemable for cash, gift cards, crypto or goods.
- Do not reward ad clicks, ad completion, repeated playback, fake accounts, referrals that create artificial traffic or any behaviour that can invalidate advertising.
- Do not make rewards depend on compulsive viewing streaks or pressure users to watch more.
- Any early-access, behind-the-scenes, Q&A or exclusive material needs a separate rights and creator permission check.
- No viewer cash rewards or referral commissions are approved.

## 7. Sponsorship campaign rules

Before promoting a sponsored work:
- Execute a separate sponsor insertion / campaign agreement.
- Record sponsor identity, campaign amount, campaign dates, deliverables, creator allocation, territory, audience, brand-safety category and approval contacts.
- Creator must approve the sponsor brief and the permitted integration in writing.
- Clearly label sponsored content or placements so viewers can distinguish paid promotion from editorial recommendation.
- Do not imply that payment guarantees editorial endorsement or positive reviews.
- Exclude any sponsor category prohibited by platform policy or applicable law; create a reviewed restricted-category list before selling campaigns.
- Define cancellation, non-delivery, refund, make-good and dispute treatment.
- Record actual cleared receipts and permitted deductions; reconcile to the creator statement.
- Do not build an advertising SDK or programmatic ad service as part of this MVP.

## 8. Rights, safety and moderation gates

Every work/version must pass all applicable checks before publication:
- Verified owner or authorised licensor and chain of title.
- Exact film/version, audio, subtitles and territory.
- Term, release windows and permitted monetisation model (including sponsorship/advertising where used).
- Writer, director, producer, performer, voice, music composition, lyrics, sound recording/master, artwork, footage, location and other third-party permissions, as applicable.
- Separate permission for posters, thumbnails, trailers, clips, dubbing, translations, edits, downloads and early-access extras.
- Hosting, storage, backup, encoding, transcoding, packaging, HLS, CDN and service-provider technical processing rights.
- Age suitability, classification, prohibited content, privacy/publicity issues and other applicable legal restrictions.
- Content review by a trained human operator before publication.
- Report/takedown process, escalation owner, response targets, evidence preservation and creator appeal route.
- Repeat-infringer and repeated policy-violation procedures.
- Audit trail for all submission, review, publication, monetisation, suspension and removal decisions.

**Default denial:** if ownership, authority, permitted use or territory is unclear, keep the work unpublished and unplayable. Do not infer permission from a creator's social-media post, YouTube availability, a verbal assurance or a public trailer.

This product requirements document is not a substitute for the separate C1 platform-policy and qualified Indian legal review.

## 9. Proposed pilot shape

Subject to later approvals and readiness:
- **Creators:** 3–5 verified adult creators.
- **Works:** 5–10 original or properly authorised short films / episodes.
- **Territory:** India only, but only where each title's licence expressly permits it.
- **Access:** invitation-led creator cohort, manual pre-publication review, free-to-watch viewer experience.
- **Commercial test:** pursue one small, clearly disclosed sponsorship campaign; if no sponsor signs and pays, run a non-monetised audience-validation pilot and make no earning promise.
- **Duration:** 6–8 weeks after the pilot is lawfully and technically ready.
- **Operations:** manual creator onboarding, rights review, content moderation, campaign ledger, statement reconciliation and customer support.
- **No requirement for:** programmatic ads, paid subscription expansion, cash viewer rewards, open upload, automated royalties or automated payouts.

## 10. Pilot success measures

Measure these with clear event definitions and report the actual sample size; do not claim statistical significance from a small pilot.

### Supply and rights
- 3–5 creators complete onboarding.
- 5–10 works are accepted into the pilot.
- **100%** of published works have verified authority, signed title-specific rights, exact scope and completed human review.
- **Zero** publication of an unverified, expired, out-of-territory or rights-disputed work.
- **100%** of creator submissions receive a recorded decision and reason.

### Viewer experience
- Capture unique viewers, episode starts, 25% / 50% / 75% / 100% completion, next-episode transitions, creator follows, watchlist saves and reports.
- Pilot target: at least **25% of started works reach 75% completion**; treat this as an initial product hypothesis, not a guarantee.
- Pilot target: at least **10% of unique viewers follow one creator**.
- Pilot target: at least **15% of eligible completed episodes lead to a next-episode start** where a next episode exists.
- Report the denominator for each metric and segment by work; do not rank creators on tiny samples.

### Revenue and trust
- If a sponsorship is run, **100%** of sponsor receipts, creator allocations, permitted deductions and statements reconcile to source records.
- **100%** of payouts (if any) require executed terms, verified payee, finance approval and payment evidence.
- Zero creator earning claims unsupported by cleared cash and an executed agreement.
- Zero viewer rewards tied to ad clicks or invalid engagement.
- All content reports, rights claims and takedown requests receive a logged owner and disposition.
- Creator feedback: collect a post-pilot survey; proposed target is an average of at least 4/5 among respondents, with respondent count disclosed.

A pilot may be considered **successful for product validation** if rights and safety measures pass, the platform records the above engagement data, creators can understand the status and earnings statement, and any sponsorship is fully reconciled. Commercial success is not claimed unless real sponsor cash is received and creator payment is lawfully completed.

## 11. Reuse of existing NexaFilm foundations

This is a requirements direction, not an implementation design. During the engineering stage:
- Reuse the existing account/authentication system for creator identity where secure and appropriate.
- Reuse the catalogue/movie and licence-evidence workflow for title metadata and per-work rights; inspect whether episodic grouping needs a minimal extension rather than a parallel catalogue.
- Reuse server-side admin review and audit controls; add explicit creator-submission states and reviewer attribution.
- Reuse existing entitlement and protected-playback checks; creator status must never bypass publication, rights, territory, account or entitlement controls.
- Reuse the existing payment foundation only after a separate review of its suitability for creator payables. Customer subscription payments and creator payouts are different accounting flows; do not assume the existing checkout code supports payouts.
- Reuse existing privacy, rate-limit, access-control and security patterns.
- Do not introduce new tables, migrations, upload services or provider integrations before current-head code inspection and an approved implementation task.

## 12. Dependencies and explicit approval gates

| Gate | Required before | Status |
|---|---|---|
| Owner approval of creator eligibility, pilot content scope and commercial proposal | Public terms, creator offer or implementation | **Pending** |
| Finance and qualified Indian legal/tax review of revenue definition, proposed 70/30, taxes, invoices, withholding, payout threshold and settlement timing | Any commercial promise, contract or payout | **Pending** |
| C1 rights, moderation, privacy, complaints and takedown policy | Creator terms and publication | **Pending** |
| Creator/rights-holder identity and title-specific signed licence | Each work's upload, promotion, monetisation or streaming | **Pending per work** |
| Technical security and provider review, with separate owner approval | Any media ingest, provider subscription/resource or playback | **Not authorised** |
| Data-model and current-code inspection | Any Creator Studio implementation or schema change | **Not started** |
| Creator/payout verification and maker-checker accounting | Any creator payout | **Not authorised** |
| Owner release approval and Milestone 5 gates | Production | **Not approved** |

## 13. Decisions captured versus decisions not approved

### Product recommendation captured in this specification
- Curated creator model; no unrestricted public uploads.
- Initial content: independent Tamil short films and episodic works.
- Invitation-led adult creator pilot.
- Free-to-watch audience validation.
- Sponsorship-first monetisation for a small pilot; programmatic ads, subscription pool, TVOD and fan support later.
- Proposed 70% creator / 30% platform share of Eligible Net Creator Revenue for direct sponsorship, with clear permitted deductions.
- Proposed monthly statement, ₹1,000 payout threshold and settlement within 30 days after month end for cleared, undisputed and documented funds.
- Non-cash viewer value; no cash or ad-engagement rewards.
- Pilot target 3–5 creators, 5–10 works, 6–8 weeks when all gates pass.

### Explicitly not approved by this document
- The 70/30 percentage or any public revenue promise.
- The ₹1,000 minimum payout or settlement deadline as a binding contract term.
- Any creator contract, sponsor deal, minimum guarantee or marketing spend.
- Any payment account, payout rail, payment method, ad network or sponsor billing setup.
- Any viewer cash, redeemable points, referral commission or financial reward.
- Any upload, provider resource/subscription, database/schema change, shared database mutation, feature flag, playback activation, publication, DNS change, PR merge or Production operation.

## 14. C0 acceptance checklist

- [x] MVP content types and creator eligibility defined.
- [x] Creator journey defined from invitation through rights review and earnings statement.
- [x] Viewer journey and non-cash value defined.
- [x] Monetisation options compared and low-cost first choice recommended.
- [x] Revenue formula, illustrative calculation, proposed split and payout controls documented.
- [x] Sponsorship transparency and campaign controls documented.
- [x] Copyright, rights, moderation, takedown and privacy dependencies identified.
- [x] Pilot cohort, duration, success metrics and no-go conditions defined.
- [x] Reuse of existing NexaFilm foundations and no-duplicate-system rule recorded.
- [x] Financial, legal, technical and Production approvals clearly separated from product recommendations.

**C0 result:** PASS — product and revenue-rules specification complete as a documentation deliverable. Commercial rates and payment terms remain proposals pending owner/finance/legal approval. No application code, database, media, provider, payment, payout, feature flag, PR merge or Production resource was changed.

**Next single task:** C1 — draft the Creator Platform Policy and Rights/Moderation Requirements as one consolidated policy specification, using this C0 scope. Do not start Creator Studio implementation until C1 is reviewed and the required owner/legal decisions are recorded.
