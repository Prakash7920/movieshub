# Cloudflare Stream Owner Approval & Rights Evidence Intake

- **Checkpoint:** Phase 5.29
- **Prepared:** 2026-11-21
- **Branch:** `phase-5/consolidated-security-ops`
- **State:** **PARTIAL APPROVAL RECORDED — usage-based cost model accepted; account/resource setup and rights evidence remain pending**
- **Purpose:** Capture the explicit owner decision and the minimum legal/operational evidence required before a non-production Cloudflare Stream proof of concept.

## 1. Current decision state

The user's instruction to start Phase 5.29 authorizes preparation of this intake record only. It is not recorded as consent to usage-based billing, Cloudflare account changes, or media upload.

| Decision | State |
|---|---|
| Usage-based cost model for the planned non-production POC (storage + delivery) | **APPROVED — 2026-11-22** |
| Acknowledgement that budget alerts are not a hard spend cap | **ACKNOWLEDGED — 2026-11-22** |
| Cloudflare account / Stream resource creation and payment-method setup | **NOT YET AUTHORIZED** |
| Agreed test window and budget-alert threshold | **NOT SPECIFIED** |
| Rights-cleared non-production test asset identified | **NOT PROVIDED** |
| Actual signed agreement / rights statement inspected | **NOT PROVIDED** |
| Admin licence approval recorded | **NOT PRESENT IN ISOLATED TEST DATABASE** |
| Provider account / API credential / signing key | **NOT CONFIGURED** |
| Preview playback flags | **OFF / NOT CONFIGURED** |

## 2. Current published Cloudflare Stream rates

Official Cloudflare Stream pricing documentation (last updated October 27, 2026) describes two billing dimensions:
- **Storage capacity:** prepaid in increments of **US$5/month per 1,000 minutes of video storage capacity**.
- **Video delivery:** post-paid, usage-based at **US$1 per 1,000 minutes delivered**.
- Ingress and encoding are included; no separate bandwidth/egress fee is charged.
- Delivery is counted from HTTP requests for video segments/parts. Client-side preloading and buffering are billable; cached playback is not billable.

These are published rate-card values, not a quotation or a ceiling. Final charges depend on account billing terms, usage, taxes and any applicable currency conversion.

**Illustrative planning example only:** one 1,000-minute storage-capacity increment held for one month is US$5. If the test session generates 100 billable delivered minutes, the delivery component is US$0.10; the simple subtotal would be US$5.10 before tax/currency conversion. This is not a guaranteed maximum invoice.

Sources:
- https://developers.cloudflare.com/stream/pricing/
- https://developers.cloudflare.com/billing/understand/how-billing-works/

## 3. Spending-alert limitation — must be acknowledged

Cloudflare's account-wide Budget Alerts:
- are available to Pay-as-you-go accounts;
- send an email after account usage-based spend crosses the configured threshold;
- are informational only and **do not pause, block, or cap Stream usage**;
- reset at the next billing period and do not guarantee a maximum invoice amount.

Cloudflare's currently documented product spending limits cover Workers and Durable Objects, not Stream minutes. Therefore, this intake does **not** claim that a Stream-specific hard spending cap is available.

A controlled POC should still limit exposure operationally: one rights-cleared asset only, a small named tester group, no public catalogue or promotion, a short agreed test window, downloads disabled, and immediate manual disablement when the test ends. These measures reduce risk but do not create a contractual or technical invoice ceiling.

Source: https://developers.cloudflare.com/billing/manage/budget-alerts/
Source: https://developers.cloudflare.com/billing/manage/spend-management/

## 4. Owner decision recorded — 2026-11-22

The owner replied **“Approved buddy start”** to the explicit request for approval of Cloudflare Stream's usage-based charges, with the stated understanding that Cloudflare Budget Alerts are not a hard spending cap.

**Recorded as approved:**
- Usage-based storage capacity charges at the published rate of US$5/month per 1,000 minutes of capacity.
- Metered video delivery at the published rate of US$1 per 1,000 minutes delivered.
- The no-hard-cap limitation: actual charges can exceed any alert threshold.
- Cost-model approval is limited to the planned **non-production NexaFilm POC** discussed in this checkpoint.

**Not inferred from that response and still pending:**
- Creation/use of a Cloudflare account or Stream resource and any payment-method setup.
- A specific test window and budget-alert threshold.
- Rights clearance, identification of a test asset, and upload authorization.

This approval is not a guaranteed invoice maximum and does not authorize Production use, public playback, or upload of content without documented rights. No provider account, paid resource, payment method, credential, or asset has been created or changed.

**Owner decision:** `USAGE-BASED COST MODEL APPROVED; OPERATIONAL SETUP PENDING`

**Approval date:** `2026-11-22`

**Agreed test window:** `NOT SPECIFIED`

**Agreed budget-alert threshold (USD):** `NOT SPECIFIED — informational only, not a cap`

**Acknowledgement reference:** `Direct owner approval in project conversation, 2026-11-22`

## 5. Rights-evidence intake required for one test asset

The proposed asset must be either (a) original content whose complete rights are controlled by NexaFilm/the owner, or (b) content covered by a signed agreement / written grant that explicitly permits the intended technical and distribution uses.

Collect and review these fields outside the public Git repository:

| Required evidence | What the reviewer must confirm | Intake state |
|---|---|---|
| Asset identity | Filename, duration, format, file SHA-256; one asset only | **NOT PROVIDED** |
| Rights holder | Legal name of the owner/licensor and authority to grant rights | **NOT PROVIDED** |
| Chain of title | Creator/source and authority to license the recording and all incorporated elements | **NOT PROVIDED** |
| Audio/music rights | Composition, master recording, voice/performance and synchronization rights as applicable | **NOT PROVIDED** |
| Image/appearance rights | Performer, actor, presenter, artwork, location/property releases where applicable | **NOT PROVIDED** |
| Permitted technical uses | Upload, storage, copying, transcoding/encoding, packaging, CDN delivery and temporary caching | **NOT PROVIDED** |
| Permitted distribution | OTT/VOD streaming to intended users; platform and language scope | **NOT PROVIDED** |
| Territory | Exact ISO 3166-1 alpha-2 country allowlist; do not infer global rights | **NOT PROVIDED** |
| Term | Effective date, expiry date, and any renewal/termination conditions | **NOT PROVIDED** |
| Download rights | Explicitly confirm download permission; default remains disabled | **NOT PROVIDED** |
| Restrictions | Exclusivity, attribution, edits, age rating, sublicensing, promo/trailer restrictions, takedown conditions | **NOT PROVIDED** |
| Signed evidence | Signed agreement or written rights statement stored in an access-controlled system | **NOT PROVIDED** |
| Reviewer record | Responsible reviewer, review timestamp, and internal reference to the controlled evidence | **NOT PROVIDED** |

A short synthetic clip created entirely for this POC may be a suitable alternative only when its authorship and rights over visuals, audio, voice, music, and any third-party components are controlled and documented. Do not use copyrighted films, trailers, music, stock footage, or third-party video unless the written licence explicitly permits these uses.

**Confidentiality:** Do not commit the agreement, identity documents, private rights-holder contact details, or credentials to GitHub. Store the actual evidence in an access-controlled legal/compliance location. Only a non-secret evidence reference and SHA-256 may be recorded in the application/audit trail when appropriate.

## 6. Existing NexaFilm licence workflow

The current Admin Licence API creates/updates a record as `PENDING` and unpublishes a previously published movie. Approval requires an explicit administrator confirmation and a signed-agreement reference; it records an audit event, copies the rights owner/dates/territories into the Movie record, and keeps downloads disabled.

The API stores the reference in `License.notes`; the schema has no contract attachment or agreement-hash field, and the API does not inspect the underlying document. Consequently, the responsible reviewer must inspect the real agreement out-of-band before approving. A free-text reference alone is not proof of rights.

The isolated Preview/E2E database currently has no Movie or License records. Do not seed or mark a licence ACTIVE as part of this intake.

## 7. Hard technical gates after owner/rights approval

Only after owner approval and actual rights evidence are accepted:
1. Confirm the Cloudflare account and Pay-as-you-go / billing status with the owner.
2. If supported, configure account-level budget alerts, and record the limitation that alerts are not a cap.
3. Create the narrowest possible Stream API credential only after explicit approval; never expose it in GitHub or chat logs.
4. Upload exactly one rights-cleared asset to the non-production account.
5. Verify `requireSignedURLs=true`, `readyToStream=true`, downloads disabled, and bind the Stream UID only to the matching approved test record.
6. Run private-ID denial, signed HLS manifest/segment, expiry, territory and download-denial tests.
7. Manually disable the POC when complete. Do not change Production flags or accounts.

## 8. Current decision

**Phase 5.29 update (2026-11-22): owner approval of the usage-based storage/delivery cost model and acknowledgement of the no-hard-cap limitation are RECORDED. Operational account/resource/payment-method setup and the test window/alert threshold remain pending; rights evidence and a test asset are NOT PROVIDED.** No account, subscription, payment method, API token, signing key, media asset, database record, or environment variable was created or changed. No Production resource was accessed or modified.

The next gate is a single rights-cleared non-production asset with the underlying agreement or written rights grant inspected by the responsible reviewer. Keep provider flags off and playback fail-closed until that independent gate and the remaining operational approvals are satisfied.


## Phase 5.38 addendum — replacement procedural test asset and operational plan (2026-11-23)

- A new procedural NexaFilm test asset is now available: `nexafilm-original-test.mp4`, 10 seconds, H.264, 1280×720, video-only; SHA-256 `f28ec6979199bed58194759b5664f4ec13285980e456b910b82e545fda3f7c13`.
- Its generator uses in-house Python/NumPy/Pillow procedural frame drawing and FFmpeg encoding, with no vidIQ/MiniMax generation, third-party stock footage, existing movie/trailer footage, music, logos, brands, people or character references. See `docs/media/nexafilm-original-test-asset-provenance.md`.
- The owner explicitly approved this asset for restricted, non-public, non-commercial technical testing in isolated Preview only on 2026-11-23. This is an internal test-scope approval, not a legal opinion, public/commercial distribution grant, or permission to upload it to a provider.
- The operational plan has been prepared at `docs/media/cloudflare-stream-nonproduction-poc-operational-plan.md`. It proposes one asset, one owner-operated test session, a 60-minute window, a maximum of 10 successful playback attempts, a $5 early-warning and $10 escalation account-wide alert proposal, private/signed playback, a single Preview origin, and manual deletion after the test.
- Current Cloudflare docs state storage capacity is prepaid in $5/month increments per 1,000 minutes, delivery is $1 per 1,000 minutes delivered, segment preloading/buffering is billable, and budget alerts are informational, account-wide, and not a usage cap. No hard spend ceiling is represented.
- Cloudflare's Direct Upload API requires any `scheduledDeletion` timestamp to be at least 30 days after upload; therefore, the plan requires immediate manual deletion after the short POC, with scheduled deletion used only as a safety net.
- The prior owner approval of the usage-based cost model and acknowledgement of the no-hard-cap limitation (2026-11-22) remains recorded.
- **Still not authorised:** Cloudflare account/Stream resource setup, payment-method creation/change, API token/signing-key creation, Preview environment secret changes, upload, database row changes, playback activation, or Production operations. Test window start, alert thresholds/recipients, account confirmation, payment/setup and credential approvals remain pending.


## Phase 5.38 owner parameter approval update — 2026-11-23

The project owner explicitly approved the following proposed operational parameters in chat:

- **Test-window duration:** 60 consecutive minutes. The actual start date/time is still to be agreed.
- **Account-wide budget alert threshold values:** US$5 early warning and US$10 escalation. These values are approved for configuration, but no alert rule has yet been created or saved.
- The owner has previously acknowledged that Cloudflare Budget Alerts are informational only and do not stop, pause, or cap Stream usage.

Still pending and not authorized by this parameter approval:
- Confirmation of the exact existing Cloudflare account and its Pay-as-you-go/billing state.
- Creation/use of a Stream resource.
- Payment-method setup or change, if the account requires it.
- Selection of alert recipients in the Cloudflare Dashboard.
- Confirmation of the exact test start date/time.
- Creation and storage of a narrowly scoped API credential.
- Asset upload or playback activation.

**Recorded decision:** `60-MINUTE DURATION APPROVED; US$5/US$10 ALERT VALUES APPROVED; CONFIGURATION AND EXECUTION PENDING`.

No Cloudflare account, resource, alert, payment method, API credential, signing key, upload URL, media upload, database row, environment variable or playback flag was created or changed. Production remains untouched.
