# Cloudflare Stream — Non-Production POC Operational Plan

- **Checkpoint:** Phase 5.38 — Non-production Cloudflare Stream operational approval plan
- **Prepared:** 2026-11-23
- **Branch:** `phase-5/consolidated-security-ops`
- **Target:** Existing NexaFilm Preview deployment for branch `phase-5/consolidated-security-ops`
- **Status:** **PLAN PREPARED — OPERATIONAL EXECUTION NOT AUTHORIZED**
- **Owner-approved parameters:** Usage-based Stream cost model (2026-11-22); restricted internal non-commercial Preview test scope (2026-11-23); 60-minute test-window duration and US$5/US$10 account-wide alert thresholds (2026-11-23).
- **Not approved:** Cloudflare account/resource setup, payment-method setup/change, credentials, asset upload, playback activation, Production changes
- **Account note:** Project owner reports that a Cloudflare account already exists and no bill has been issued/paid so far. Account identity, Pay-as-you-go eligibility, billing profile, payment method, active subscriptions and current usage have **not** been independently verified.

## 1. Approved asset and purpose

Use exactly one existing procedural test asset:
- Filename: `nexafilm-original-test.mp4`
- Duration: 10 seconds
- Resolution / codec: 1280×720, H.264, 24 fps
- SHA-256: `f28ec6979199bed58194759b5664f4ec13285980e456b910b82e545fda3f7c13`
- Generator source SHA-256: `535912e23fb67bb5a7141ab021cfad0b1534e1690516d726dba0d69904e3ad79`

The project owner approved use of this exact asset solely as a non-public, non-commercial technical fixture in an isolated Preview/test environment. It must not be placed in the public movie catalogue, exposed to general customers, monetised, used in advertisements, or promoted as commercial content. This approval does not authorise upload by itself.

## 2. Cost model — existing owner approval

The owner has already accepted the published usage-based pricing model and acknowledged the lack of a hard spending cap. The current official Cloudflare Stream pricing page describes:
- **Storage capacity:** prepaid in increments of **US$5 per month per 1,000 minutes of storage capacity**. A 10-second file consumes approximately 0.167 minutes of capacity; however, the billing increment is a 1,000-minute capacity block, not a per-file fraction of US$5. If the account has sufficient purchased capacity remaining, an additional block may not be required; verify the actual account billing state before proceeding.
- **Delivery:** **US$1 per 1,000 minutes delivered**, post-paid. HLS/DASH delivery is measured from segment/part HTTP requests; client preloading and buffering count. The simple 10-second duration is not a guaranteed billed-delivery ceiling.
- Ingress and encoding are included; bandwidth/egress is included in delivery pricing.
- Taxes, currency conversion, existing account usage, and final account billing state may affect the final invoice.

Official pricing: https://developers.cloudflare.com/stream/pricing/ (the current indexed rate card reviewed 2026-11-23; page identifies update 2026-10-27).

**Important:** Deleting the asset releases storage usage, but this plan does not assume deletion reverses, refunds, or immediately cancels any prepaid capacity charge. Confirm the account's actual billable usage/invoice.

## 3. Operational controls — current approval state

The project owner approved the 60-minute duration and the US$5 early-warning / US$10 escalation threshold values on 2026-11-23. These are parameter approvals only; no Cloudflare dashboard settings or alert rules have been configured. The precise test start date/time and alert recipients remain pending. Other rows marked proposed are not approvals.

| Control | Proposed value | State |
|---|---|---|
| Cloudflare account | Existing account reported by owner; confirm correct account and whether Pay-as-you-go billing is enabled | **EXISTS — USER-REPORTED; BILLING STATE UNVERIFIED** |
| Stream scope | One non-production Stream test asset only | **PROPOSED** |
| Preview origin | Only the exact branch Preview alias: `movieshub-git-phase-5-consolidated-security-ops-nexa-cead.vercel.app` | **PROPOSED** |
| Asset count | 1; no retries that create duplicate assets without owner review | **PROPOSED** |
| Upload duration limit | `maxDurationSeconds=15` for the 10-second source | **PROPOSED** |
| Direct-upload URL lifetime | 15 minutes from creation; one upload only | **PROPOSED** |
| Test window | 60 consecutive minutes | **DURATION APPROVED — START DATE/TIME PENDING** |
| Tester group | Project owner only; one authenticated operator | **PROPOSED** |
| Playback allowance | At most 10 successful full-play attempts; no external testers | **PROPOSED — SOFT OPERATIONAL LIMIT, NOT A BILLING CAP** |
| Budget alerts | US$5 early warning and US$10 escalation, account-wide | **VALUES APPROVED — CONFIGURATION PENDING** |
| Alert recipients | Cloudflare billing owner and nominated project owner, selected inside the dashboard | **PENDING** |
| Cleanup | Manually delete the single test asset immediately after the test; verify deletion and billable usage | **PROPOSED** |
| Public playback / downloads | No public ID playback; downloads remain disabled | **MANDATORY** |

Cloudflare Budget Alerts are available for Pay-as-you-go accounts, aggregate account-wide usage-based spend, and send a single notification when a threshold is crossed. They reset each billing period and do **not** pause, block, or cap Stream usage. A US$5/US$10 threshold is therefore only a warning signal, not a maximum invoice or per-Stream cap. Check existing account usage before choosing the values.

Official billing references:
- https://developers.cloudflare.com/billing/manage/budget-alerts/
- https://developers.cloudflare.com/billing/manage/spend-management/

## 4. Proposed secure upload settings

Only after separate operational authorization:
1. Confirm the account identity, Pay-as-you-go status, existing Stream storage-capacity balance and current account-wide billable usage in the Cloudflare Dashboard.
2. Create one direct-upload URL using the official Stream API. Include:
   - `requireSignedURLs: true` at upload creation;
   - `allowedOrigins` restricted to the exact Preview branch origin only;
   - `maxDurationSeconds: 15`;
   - a 15-minute `expiry` for the one-time upload URL;
   - non-secret `meta` identifying Phase 5.38 and the MP4 SHA-256;
   - `scheduledDeletion` no earlier than 30 days after upload, as a safety net only.
3. The current Direct Upload API documents a minimum 30-day lead time for `scheduledDeletion`. Therefore, the short test window requires **manual deletion after testing**; the 30-day scheduled deletion is only a fallback safety net.
4. Upload only the named 10-second asset. Do not upload film, trailer, music, poster, subtitle, or any other media.
5. Wait until `readyToStream=true`; independently verify `requireSignedURLs=true`, the asset UID, origin restriction, and no download permission before any playback test.

Official API references:
- https://developers.cloudflare.com/api/resources/stream/subresources/direct_upload/methods/create/
- https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/

## 5. Proposed signed-playback checks

Cloudflare documents the Stream `/token` endpoint as a low-volume/testing option, with default one-hour expiry and support for an explicit `exp` claim (maximum 24 hours). For the controlled test, use one authenticated operator and request a deliberately short-lived token (proposed 5 minutes) without the `downloadable` option. The API is rate-limited; keep token requests minimal.

Run only these checks:
1. A request using the bare video UID without a signed token is denied.
2. A valid short-lived signed token plays the HLS manifest and segments in the allowed Preview origin.
3. The same token is denied after its expiry.
4. A request from a non-allowed origin is denied where the provider/browser path enforces origin restrictions.
5. Download access remains disabled.
6. The user-facing Watch page remains fail-closed after the test; no general-customer path is enabled.

A signing key is not proposed for this first low-volume test; use the provider's low-volume token endpoint if permitted by the final application integration. Never put an API token, signed token, signing key, account ID paired with credentials, or upload URL in GitHub, screenshots, chat, or client-visible source.

## 6. Operational credential boundary

No Cloudflare connector is available in the current project tools. Any eventual provider setup must be performed through the owner's Cloudflare Dashboard or a separately authorized integration.

If authorized later:
- Use a dedicated API token with the minimum Stream permissions required for the exact upload/read/delete operations; verify the current permission selector rather than using a Global API Key.
- Keep the token server-side only in the isolated Preview environment.
- Do not add any `CLOUDFLARE_*` variable to Production.
- Do not generate or expose a signing key unless the final implementation actually requires it and a separate approval is recorded.
- Do not commit credentials, account secrets, upload URLs or signed tokens.

## 7. Stop conditions and cleanup

Stop the POC immediately if any of the following occurs:
- wrong Cloudflare account, wrong environment, unexpected payment/subscription change, or unexpected spend;
- more than one media asset is created or uploaded;
- asset is accessible by bare public UID or from a non-approved origin;
- an unauthenticated user can obtain or use a playback token;
- download is enabled;
- playback is accessible outside the approved Preview test;
- the 60-minute test window or 10-successful-play limit is reached.

At the end of the test:
1. Manually delete the one Stream asset and verify deletion / released storage usage.
2. Revoke the dedicated temporary API token if it was created solely for this POC.
3. Allow any issued short-lived token to expire; do not share it.
4. Confirm all Preview playback flags remain off and the Watch page remains fail-closed.
5. Record the final billable-usage observation and any invoice effect; do not assume alerts or deletion cap/reverse charges.

## 8. Outstanding approvals before execution

| Approval / prerequisite | Current state |
|---|---|
| Usage-based cost model and no-hard-cap acknowledgement | **APPROVED — 2026-11-22** |
| Restricted internal test purpose for this exact asset | **APPROVED — 2026-11-23** |
| Confirm existing account identity, Pay-as-you-go eligibility and billing profile status | **PENDING — account existence user-reported** |
| Authorise use/create Stream resource in that account | **PENDING** |
| Authorise payment-method setup/change, if required | **PENDING — do not change without explicit approval** |
| Confirm 60-minute test window start date/time | **PENDING — duration approved 2026-11-23** |
| Approve US$5 / US$10 account-wide threshold values | **APPROVED — 2026-11-23; configuration not applied** |
| Select alert recipients | **PENDING** |
| Authorise dedicated Stream API token creation and Preview secret storage | **PENDING** |
| Confirm the exact Preview origin and upload/cleanup operator | **PENDING** |

## 9. Decision

**Phase 5.38 result: PLAN PREPARED; 60-MINUTE DURATION AND US$5/US$10 ALERT VALUES OWNER-APPROVED. AN EXISTING CLOUDFLARE ACCOUNT IS USER-REPORTED, BUT PAY-AS-YOU-GO/BILLING PROFILE/PAYMENT METHOD STATE IS UNVERIFIED. OPERATIONAL EXECUTION REMAINS BLOCKED PENDING ACCOUNT/BILLING VERIFICATION, RESOURCE, PAYMENT, RECIPIENT, START-TIME AND CREDENTIAL APPROVALS.** This checkpoint is documentation-only. No Cloudflare account/resource, paid subscription, payment method, API token, signing key, upload URL, media upload, Preview/Production environment variable, database row, playback flag, or Production resource was created or changed.

The cost-model approval, restricted internal test-scope approval, 60-minute test-window duration approval and US$5/US$10 alert-value approval are recorded. These approvals do not substitute for the outstanding operational approvals listed above.
