# NexaFilm — Title-wise Rights Evidence Inventory

- **Checkpoint:** Milestone 2 — title-wise catalogue rights inventory
- **Review date:** 2026-11-26 (Asia/Kolkata)
- **Branch:** `phase-5/consolidated-security-ops`
- **Result:** **INVENTORY COMPLETE FOR THE INSPECTED PREVIEW CATALOGUE; ALL 12 TITLES REMAIN UNVERIFIED / NOT CLEARED**
- **Scope:** Read-only review of the NexaFilm Neon `movieshub` project Preview branch `br-floral-scene-aopb9cme` (`preview`), database `neondb`; repository rights-policy and test-asset evidence documents.
- **Out of scope:** Neon Production branch, data mutation, legal opinion, external rights-holder verification, provider setup, media upload, playback enablement, customer publication, and Production changes.

## 1. Executive result

A read-only query of the inspected Preview database returned **12 Movie rows** and **2 License rows**. All 12 Movie rows are unpublished (`isPublished=false`); 11 are `DRAFT` and one (`96`) is `UNPUBLISHED`. All 12 have `videoUrl=NULL`.

- **0/12 titles are accepted as rights-cleared by this inventory.**
- **10/12 titles have no License row** in the inspected Preview database.
- **1/12 (`96`) has a legacy `ACTIVE` License row**, but only a legacy free-text reference is recorded; the actual signed agreement, independent verification and matching License audit event were not found in the inspected evidence. Do not rely on this status as legal clearance.
- **1/12 (`Dune: Part Two`) has a `PENDING` License row whose term ended on 2026-11-03**. The record is out of date and has no recorded evidence reference/hash or completed review.
- The Preview database's current `License` table does not yet contain the newer typed evidence fields (`evidenceReference`, `evidenceSha256`, `rightsScopeConfirmed`, `reviewedAt`, `reviewedByUserId`) added on the PR branch. The migration passed disposable CI PostgreSQL validation but has **not** been applied to Neon Preview or Production.
- A read-only query found **0 License-related entries** in the Preview `AdminAuditLog` for `LICENSE_APPROVED`, `LICENSE_SAVED_PENDING`, or `LICENSE_REJECTED`.

**Important:** The territory and language values below are catalogue metadata only. They are not proof of distribution rights. The existence of an old `ACTIVE` database status is also not legal evidence.

## 2. Title-by-title inventory

| Title | Year | Primary language | Audio metadata | Subtitle metadata | Movie territory metadata (not rights) | Preview licence record | Inventory decision |
|---|---:|---|---|---|---|---|---|
| 96 | 2018 | Tamil | Tamil | Tamil, English | IN | Legacy ACTIVE; recorded term 2024-11-13 to 2039-11-10; territory IN; legacy reference text only | **UNVERIFIED — do not treat as cleared** |
| Aruvi | 2017 | Tamil | Tamil | Tamil, English | IN | No row | **BLOCKED — no licence/evidence record** |
| Avatar: The Way of Water | 2022 | English | English, Tamil | Tamil, English | US, IN, AU | No row | **BLOCKED — no licence/evidence record** |
| Dune: Part Two | 2024 | English | English, Tamil | Tamil, English | US, IN, AU | PENDING; recorded territory IN; term 2026-11-01 to 2026-11-03 | **BLOCKED — pending and expired** |
| Jailer | 2023 | Tamil | Tamil | Tamil, English | IN, US, MY | No row | **BLOCKED — no licence/evidence record** |
| Kabali | 2016 | Tamil | Tamil | Tamil, English | IN, AU | No row | **BLOCKED — no licence/evidence record** |
| Master | 2021 | Tamil | Tamil, English | Tamil, English | IN, MY, SG | No row | **BLOCKED — no licence/evidence record** |
| Ponniyin Selvan: I | 2022 | Tamil | Tamil, English | Tamil, English | IN, US, AU | No row | **BLOCKED — no licence/evidence record** |
| Sarkar | 2018 | Tamil | Tamil | Tamil, English | IN, SG | No row | **BLOCKED — no licence/evidence record** |
| Soorarai Pottru | 2020 | Tamil | Tamil | Tamil, English | IN, US | No row | **BLOCKED — no licence/evidence record** |
| Theeran Adhigaram Ondru | 2017 | Tamil | Tamil | Tamil, English | IN | No row | **BLOCKED — no licence/evidence record** |
| Vikram | 2022 | Tamil | Tamil | Tamil, English | IN, US, SG | No row | **BLOCKED — no licence/evidence record** |

### Record-specific cautions

**96 — legacy ACTIVE record**
- The database row contains a rights-owner text field, the dates and country above, a legacy reference string, and an old reviewer/timestamp note.
- The underlying signed agreement or rights statement was not present in the reviewed repository evidence; the reference string cannot establish what the agreement grants.
- No matching License audit event was returned by the Preview audit-log query.
- The row predates the typed evidence workflow and cannot satisfy the newer evidence requirements.
- Keep the movie unpublished and treat the rights decision as **UNVERIFIED**, regardless of the legacy `ACTIVE` value.

**Dune: Part Two — expired PENDING record**
- The row's expiry date was 2026-11-03, which is before this inventory date (2026-11-26).
- The Movie row's territory metadata is US/IN/AU, while the License row lists IN only. This mismatch is not an approval to expand the licensed territory.
- No agreement reference/hash or verified rights-scope evidence is recorded.
- Do not approve or publish from this expired record. Any future consideration requires a current signed agreement, fresh dates and a new review.

**Other ten titles**
- No License row exists in the inspected Preview database.
- Their listed territory, audio and subtitle values are sample metadata and must not be copied into a rights approval as if they were granted rights.

## 3. Minimum evidence required before any title can be reviewed for approval

For each title, the rights owner or authorised distributor must provide a signed agreement or legally supportable written rights statement. An authorised reviewer must inspect the actual document in controlled legal storage and record a non-public document reference and SHA-256 fingerprint. The hash proves file identity only; it does not prove ownership or legal permission.

At minimum, the reviewer must identify and check:

1. **Authority and rights chain:** contracting parties, signatory authority, relevant producer/distributor chain, and the rightsholder's authority to grant the rights.
2. **Exploitation rights:** express OTT/VOD/internet streaming rights for NexaFilm's intended service model, including whether the permission covers subscription, ad-supported, transactional or other intended monetisation models.
3. **Territories and term:** exact country list, start/end dates, release windows, exclusivity, holdbacks and any territory-specific restrictions.
4. **Languages and versions:** original-language rights plus each intended dub, audio track, subtitle/translation version and related localisation deliverable. Catalogue metadata alone is insufficient.
5. **Technical processing and hosting:** permission, where required, for digital delivery, server/storage copies, upload, encoding/transcoding, packaging, HLS/segment delivery, CDN distribution and any relevant service-provider/subcontractor processing.
6. **Downloads and offline use:** a separate explicit right where downloads/offline access are intended. Absence of a prohibition is not treated as affirmative download permission; default remains disabled.
7. **Promotional materials:** posters, stills, trailers, clips, artwork, logos and excerpts must have their own applicable permissions; a feature-film streaming licence is not presumed to cover every marketing asset.
8. **Restrictions and obligations:** music/sound recording, performer, underlying-work or third-party clearances as applicable; attribution, edits/censorship, reporting, royalty/payment, takedown and termination provisions.

Escalate unclear scope or chain-of-title questions to qualified legal review. Do not infer rights from the fact that a title is available on another service, is present in sample metadata, or has an old `ACTIVE` flag.

## 4. Separate technical test assets — not catalogue titles

These assets are not part of the 12 Movie rows and must not be mixed into the title inventory:

- **`nexafilm-original-test.mp4`:** technical provenance review PASS and the owner approved a narrow internal, non-public, non-commercial Preview/test purpose on 2026-11-23. This does not authorise Cloudflare/provider upload, public/commercial distribution, Production use or catalogue publication. Provider/resource/payment/credential approvals remain pending.
- **vidIQ / MiniMax synthetic test clip:** rights clearance remains BLOCKED pending provider terms clarification and formal rights review. It is not an authorised substitute for the procedural test asset.

Neither asset is recorded as a cleared Movie in the inspected Preview catalogue. No media was uploaded in this checkpoint.

## 5. Required next actions — in order

1. Obtain the actual signed rights evidence for any intended film from the rights holder/distributor. Keep confidential documents in controlled legal storage, not in GitHub or chat.
2. For each supplied document, record its controlled reference, exact file SHA-256, parties, rights chain, territories, languages, term, allowed exploitation, technical processing and download/promotional scope.
3. Have an authorised reviewer inspect the actual document and resolve any legal ambiguity before a title is marked for approval.
4. Once the owner separately authorises a Preview database change, apply the reviewed additive evidence migration to the correct non-production branch, verify the new schema, and use the evidence-backed admin workflow. Do not change Production.
5. Save or refresh the title's licence metadata only after evidence is available. Confirm the title remains unpublished until all required review and manual publication gates pass.
6. Keep playback, download, provider upload and customer publication disabled until their separate Milestone 2 acceptance and approvals are completed.

## 6. Evidence and safety boundary

- Preview source: Neon project `movieshub` (`bitter-forest-35399153`), branch `preview` (`br-floral-scene-aopb9cme`), database `neondb`.
- Read-only inspection: table schemas for `Movie`, `License`, and `AdminAuditLog`; one Movie/License left-join query (12 rows); one License-related audit query (0 rows).
- The isolated E2E project's previously recorded rights-readiness audit found 0 Movie rows and 0 License rows in that separate target. It is not substituted for the 12-row Preview inventory above.
- Repository evidence reviewed includes `docs/media/non-production-test-asset-rights-readiness.md`, `docs/media/nexafilm-original-test-asset-usage-review.md`, and `docs/media/synthetic-asset-rights-clearance-decision.md`.
- **No data was inserted, updated or deleted.** No schema migration was applied to Neon Preview or Production.
- Production branch was not queried. No secrets, DNS, payment method, subscription, Cloudflare resource, media asset, environment variable, playback flag or Production resource was changed.

**Inventory decision:** This checkpoint is **PASS for enumeration and evidence-gap identification only**. All 12 catalogue titles remain **NOT CLEARED** until a responsible rights holder supplies verifiable title-specific evidence and an authorised reviewer records the review. Milestone 2 remains **BLOCKED**.
