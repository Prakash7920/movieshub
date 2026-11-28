# Synthetic Asset Rights Clearance Decision — NexaFilm

- **Checkpoint:** Phase 5.33 — Synthetic Asset Rights Approval & Non-Production Licence Registration
- **Terms clarification follow-up:** Phase 5.34 — Written provider-rights clarification request prepared
- **Assessment date:** 2026-11-22
- **Branch:** `phase-5/consolidated-security-ops`
- **Result:** **BLOCKED — RIGHTS NOT CLEARED; NO LICENCE REGISTERED**
- **Asset:** Original synthetic 10.144-second vertical MP4 for isolated playback testing
- **Generation service/model:** vidIQ Video Generator / MiniMax H3
- **vidIQ import ID:** `4ee5f235-8624-46cd-8376-92b17b507dd8`
- **Generator job:** `job_8f9301cf-b9ed-4c12-8df0-e8b930e1bddb`
- **SHA-256:** `7fc29878ab11990a80460a1b7677f692569a44e6b730a17feaaae1b8aa6a5b13`

## 1. Asset and generation evidence

The clip was created from a text prompt for this NexaFilm proof-of-concept. The prompt describes a futuristic glass-arch environment, luminous blue-white lighting, floating particles, volumetric rays and a slow camera move. It expressly excludes people, text, captions, logos, brands, recognisable copyrighted characters and references to existing films or franchises. The generated asset uses H.264 video and AAC audio; its local MP4 metadata, SHA-256 and full decode are recorded in `synthetic-test-asset-provenance.md`.

A visual spot-check of extracted frames at 1, 5 and 9 seconds showed the same abstract glass-arch setting. No obvious logo, text, person or recognisable character was visible in those sampled frames. This is a limited sample, not a frame-by-frame similarity search, legal clearance, or proof of title.

## 2. vidIQ Terms of Service review

The official vidIQ Terms of Service page reviewed for this checkpoint states an effective date of **August 2, 2026**:

- **Section 2** grants a limited, revocable, non-exclusive and non-transferable right to review, interact with and in some instances print content from the Services for personal and educational purposes. It says vidIQ and its licensors remain owners of the Services.
- **Section 5(t)** prohibits use of the Services or their related content for any revenue-generating endeavour or commercial enterprise. Its application to a generated video file exported from the generator, as distinct from commercial use of the vidIQ service itself, needs written clarification from vidIQ before any NexaFilm use.
- **Section 14** defines generated media, including video and audio, as “Content Artifacts”. It says AI outputs may reflect, incorporate or resemble pre-existing protected works, voices, likenesses or other protected material; the user is responsible for reviewing each artifact before use, publication or distribution; and vidIQ makes no representation or warranty that an artifact is free from third-party-rights claims.
- **Section 14** further states that, except for rights expressly granted in the Terms, vidIQ grants no licence or other right in a Content Artifact and cannot be relied on to clear, license or obtain rights in the artifact on the user's behalf.
- **Section 9** disclaims warranties including title and non-infringement.

Official source: https://vidiq.com/terms/ (Terms of Service, effective August 2, 2026; reviewed 2026-11-22; Sections 2, 5(t), 9 and 14).

The same terms page identifies `support@vidiq.com` as the contact for questions about the Terms (Section 18). A written clarification request was sent to vidIQ Support, and a response from Anna at vidIQ was supplied by the operator on **2026-11-22** (email screenshot; message time shown as 23:25 local). The response explicitly says the available Video Generator documentation does not include written licensing terms that specifically address third-party OTT/VOD distribution, interpretation of Terms Sections 2, 5(t), or 14, or rights granted by the underlying model provider. It says the documented material mainly covers the technical workflow; generated videos can be downloaded for external use, editing must occur in an external editor, and the tool currently has no API for external integrations. It further says formal written legal interpretation for commercial OTT/VOD testing is outside the scope of the available product documentation and that enterprise or partner-level licensing discussions are typically reviewed by the appropriate team when submitted as an enterprise or partner use case.

**This is a response, not an affirmative rights grant, legal interpretation, licence, or confirmation of MiniMax H3 downstream rights.** The phrase "downloaded for external use" describes an available workflow and does not identify permitted commercial OTT/VOD uses or grant the upload, hosting, transcoding, packaging, CDN-delivery or streaming rights required by NexaFilm. The response does not resolve the scope of Sections 2, 5(t), or 14 and does not supply underlying model-provider terms.

These published terms do **not** currently provide sufficient affirmative evidence of the complete rights NexaFilm would need to upload, store, transcode, package, CDN-deliver and stream this generated artifact as part of an OTT/media service. They also do not establish who owns every protectable element in the generated output. The underlying model/provider-specific terms or contractual grants applicable to this MiniMax H3 generation were not supplied or independently verified for this assessment.

This is a rights-evidence decision, not a final legal opinion that the clip necessarily infringes or that every possible use is prohibited. The material point is that the intended NexaFilm streaming licence scope has not been established by the evidence available here, and Sections 2 and 5(t) require provider clarification for a commercial/OTT use case.

## 3. Existing NexaFilm licence workflow

Inspected on the current Phase 5 branch:

- `prisma/schema.prisma`: `License` records require a movie relation, owner, status, start/expiry dates and allowed-country list. Downloads default to disabled.
- `app/api/admin/licenses/route.ts`: POST saves a licence as `PENDING`, unpublishes a previously published movie and writes an admin audit event. PATCH to `ACTIVE` requires an explicit confirmation and a non-empty signed-agreement reference; it checks that the dates include today and that countries are present, then records the reference and admin audit event.
- The API stores a free-text reference in `License.notes`; it does not retrieve, inspect, validate the signature of, or authenticate the underlying rights instrument. The admin UI specifically asks the reviewer to confirm that they personally checked the signed agreement, platform/language rights, territories, term and usage rights.

Therefore the real written rights instrument must be inspected by the responsible owner/admin outside this API. A typed reference or checkbox without that underlying evidence is not sufficient. The API's `ACTIVE` path must not be used as a substitute for the missing rights determination.

## 4. Isolated database observation

Read-only query against the existing isolated E2E database:

- Neon project: `autumn-surf-26965712`
- Branch: `br-delicate-breeze-b3s9x6pu` (`test`)
- Database: `movieshub_test`

| Indicator | Observed rows |
|---|---:|
| Movie records | 0 |
| Licence records | 0 |
| Active licences | 0 |
| Pending licences | 0 |
| Movies with Cloudflare Stream UID | 0 |
| Movies with legacy video URL | 0 |
| Licence-related admin audit events | 0 |

No movie or licence fixture was created for this assessment. No database writes were performed.

## 5. Owner/provider approvals that remain distinct

The previously recorded approval accepts the proposed non-production Cloudflare Stream usage-based cost model and acknowledges that budget alerts are not a hard spend cap. It does **not** authorise Cloudflare account/resource creation, payment-method setup, credentials, media upload or playback activation.

The separate test window and budget-alert threshold remain unspecified. No Cloudflare credentials are configured for this Preview branch, and playback flags remain off. These operational approvals cannot substitute for content rights or vidIQ's clarification of commercial output rights.

## 6. Gate decision

| Gate | Evidence | Status |
|---|---|---|
| Synthetic clip generated for this POC | Generator job and prompt record | **PASS** |
| Local asset integrity | SHA-256, metadata and full decode in Phase 5.31 evidence | **PASS** |
| Limited visual spot-check | Frames at 1s, 5s and 9s; no obvious third-party indicators seen | **PASS — LIMITED ONLY** |
| Terms review | Sections 2, 5(t), 9 and 14 reviewed | **PASS — TERMS REVIEW ONLY** |
| vidIQ written clarification | Support reply received 2026-11-22; it expressly does not address OTT/VOD licensing, Terms interpretation or underlying model-provider rights | **RECEIVED — INSUFFICIENT** |
| Rights holder / chain of title | Not established by current terms or supplied documents | **BLOCKED** |
| Affirmative licence for OTT upload, hosting, processing and streaming | Not established by available vidIQ terms; underlying provider-specific grant not verified | **BLOCKED** |
| Written rights statement / signed instrument | Not supplied or reviewed | **BLOCKED** |
| Responsible human rights review | Not completed | **BLOCKED** |
| Pending application in isolated Movie/License catalogue | No movie or licence fixture created | **NOT REGISTERED** |
| Active licence / admin approval | Not performed | **NOT APPROVED** |
| Cloudflare upload and playback | Not performed; separate operational approvals remain incomplete | **NOT PERFORMED** |
| Production changes | None | **NONE** |

**Phase 5.33 result: BLOCKED / NOT CLEARED.** No `Movie` or `License` record was inserted or updated; no `ACTIVE` licence or admin audit event was created; no Cloudflare upload, provider account/resource, credential, payment-method or environment-variable change was made; and no Production operation was performed.

## 7. Evidence required to unblock

Before any pending or active licence registration for this asset:

1. The initial vidIQ Support clarification request has been answered, but the reply does not provide an affirmative licence or resolve OTT/VOD use. Submit the use case through the enterprise/partner licensing route suggested in that response. The official vidIQ Enterprise Help Center lists `enterprise@vidiq.com` for Enterprise enquiries; ask that team to route the request to the authorised licensing/legal and underlying model-provider contacts. Request an explicit written grant or the exact agreement required, rather than relying on the technical ability to download an output.
2. Obtain confirmation of the rights, if any, granted in the Content Artifact; whether NexaFilm may upload, store, copy, transcode/encode, package, securely deliver, and stream it to authorised testers/end users; and whether a separate commercial/enterprise licence is required.
3. Obtain the applicable MiniMax H3 / underlying model provider terms and determine whether the model/provider permits the intended downstream OTT use, including audio elements.
4. Have the responsible owner/legal reviewer confirm the relevant rights holder and chain of title, audio/visual components, permitted territories, platform/language scope, term, restrictions, and whether the grant can be used by NexaFilm.
5. Store the actual signed instrument or written grant in an access-controlled legal/compliance location. Do not commit confidential contracts or private identity information to GitHub.
6. Only after review, have the authorised administrator create a `PENDING` record with accurate owner, dates, territories and a controlled evidence reference. The administrator must personally inspect the underlying document before using the approval action. Keep downloads disabled.
7. Continue to keep Cloudflare setup and playback flags off until the separately required provider/resource approvals, rights clearance, and signed-playback checks are complete.

Alternative: replace this test asset with a source whose applicable output licence and full downstream OTT rights are clearly documented, then repeat the same human review. Do not infer rights merely from a model name, generation prompt, credit purchase, possession of the MP4, or successful import.


### Phase 5.35 — vidIQ support response assessment & enterprise/partner escalation preparation (2026-11-22)

- Operator supplied a screenshot of a reply from Anna at vidIQ. The response says current Video Generator documentation does not contain written licensing terms specifically addressing third-party OTT/VOD distribution, interpretation of Terms Sections 2, 5(t), or 14, or rights granted by the underlying model provider.
- The response documents only technical workflow points: prompt-generated videos may be downloaded for external use; editing is performed in an external editor; and the tool currently has no API for external integrations.
- vidIQ says a formal written legal interpretation for commercial OTT/VOD testing is outside the scope of available product documentation and suggests enterprise- or partner-level licensing review through the appropriate team.
- **Assessment: the reply is not an affirmative licence, contractual grant, legal interpretation, or confirmation of MiniMax H3 rights.** “Download for external use” does not by itself establish permission for commercial OTT/VOD upload, hosting, copying, transcoding, packaging, secure CDN delivery or streaming.
- The official vidIQ Enterprise Help Center lists `enterprise@vidiq.com` for Enterprise enquiries: https://support.vidiq.com/en/articles/8058473-vidiq-enterprise-introduction. This is a contact route only; neither an Enterprise plan nor an enquiry is evidence of output rights.
- Next action is limited to submitting a written enterprise/partner licensing enquiry requesting referral to the authorised licensing/legal and underlying model-provider contacts and an explicit written rights grant or agreement path. The escalation draft is prepared separately; it has **not** been sent.
- **Phase 5.35 result: BLOCKED — rights evidence remains insufficient; enterprise/partner escalation pending.** No Movie/License record, admin approval, Cloudflare resource/credential/upload, playback flag, Preview/Production database mutation, payment-method change or Production operation was performed.
