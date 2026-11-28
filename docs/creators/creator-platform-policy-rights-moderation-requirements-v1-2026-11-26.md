# NexaFilm — Creator Platform Policy & Rights / Moderation Requirements v1

- **Prepared:** 2026-11-26 (Asia/Kolkata)
- **Roadmap checkpoint:** Phase 5.50 / Creator Economy C1
- **Status:** INTERNAL POLICY SPECIFICATION — draft for owner and qualified Indian legal review; not published terms, a legal opinion, or an operating approval
- **Repository / branch:** `Prakash7920/movieshub` / `phase-5/consolidated-security-ops`
- **Applies to:** Proposed invitation-led creator submission pilot for independent Tamil short films and episodic works.
- **Product model:** A controlled creator submission and viewing service extending the existing NexaFilm platform. It is not an unrestricted public-upload service.
- **Approval boundary:** This document does not authorise creator terms to be published, a creator contract to be signed, a work to be uploaded/published/streamed/monetised, a moderation vendor to be appointed, a grievance officer to be represented as appointed, or any code, database, provider, payment, feature-flag, PR merge or Production change.

> **Legal caution:** NexaFilm's legal classification depends on what each product feature actually does. A service may have intermediary functions for user-submitted material and publisher functions for a curated on-demand catalogue. The IT Rules define online curated content and publisher functions by reference to the nature of the catalogue and the publisher's significant role in determining the content made available. Do not rely on a contractual label alone. Qualified Indian media / technology counsel must give a written, feature-specific classification opinion before the public creator feature is enabled.

## 1. Policy objectives and non-negotiable principles

1. **Rights first:** No work is uploaded to a public or provider-backed environment, promoted, monetised or streamed until its rights owner / authorised licensor, rights chain, exact scope and signed permission are verified.
2. **Private by default:** Every submission is private and unpublished until all rights, content, age, security and release gates pass.
3. **Human accountability:** Automated detection may support triage but cannot be the sole final decision-maker for a serious rights, identity, child-safety, intimate-image or account-ban decision.
4. **No implied rights:** A creator upload, public trailer, social-media post, festival selection, verbal assurance, invoice, hash or platform account does not by itself grant NexaFilm streaming, monetisation, promotional, download, dubbing or editing rights.
5. **Safety before reach:** A credible child-safety, non-consensual intimate imagery, impersonation, credible violence threat or unlawful-content report can trigger immediate restricted access while trained staff follow the legally appropriate response path.
6. **Proportionate enforcement:** Decisions must consider the actual content, context, severity, applicable law, claimant's authority, prior violations and the rights of affected users.
7. **Reasoned decisions and appeal:** Creators and reporters should receive a safe, comprehensible status and reason when disclosure is lawful and does not compromise an investigation or a victim.
8. **Data minimisation:** Collect only information needed for account operation, rights review, safety, complaints, security and approved payments. Keep identity documents, contracts, payout data and sensitive complaint material out of public profiles, GitHub and ordinary support channels.
9. **No retaliation:** Good-faith rights, safety and privacy reports must not trigger retaliation against the reporter.
10. **No commercial override:** Sponsorship value, view counts, creator popularity or revenue never override a rights, safety or legal block.

## 2. Legal classification and scope decision

### 2.1 Two function-specific legal tracks must be assessed

**Track A — Intermediary functions (potentially applicable to creator hosting / user submission):**
- Users submit, store, publish or transmit information through NexaFilm.
- NexaFilm may provide the electronic hosting / transmission resource and user accounts.
- If this function qualifies as an intermediary, the applicable Part II duties under the Information Technology Act and the IT (Intermediary Guidelines and Digital Media Ethics Code) Rules must be implemented, including user terms, prohibited-content rules, grievance handling, lawful-order handling, security and applicable retention.
- The user agreement must not invite users to upload material they do not have the right to provide, infringe copyright or other proprietary rights, harm children, invade privacy, impersonate people, or violate applicable law.

**Track B — Publisher of online curated content functions (potentially applicable to NexaFilm's curated OTT catalogue):**
- The IT Rules define online curated content as a curated on-demand catalogue of audio-visual content that is owned by, licensed to or contracted to be transmitted by a publisher.
- A publisher of online curated content is defined by the significant role it performs in determining what curated content is made available.
- Where NexaFilm licenses, selects, commissions, classifies and presents a curated catalogue, Part III publisher obligations may apply to that function. These include the Code of Ethics, ratings/content descriptors, access controls, India-based Grievance Officer, self-regulatory mechanism and relevant reporting / record duties.

**Required legal deliverable before launch:** Counsel must produce a written feature-by-feature matrix identifying which NexaFilm actions are intermediary functions, publisher functions, both, or neither; which entity is the regulated person; and which rules, grievance timelines, record-retention requirements, classification and registration / reporting steps apply. A creator's terms cannot contract away a statutory classification.

### 2.2 Current law / commencement note reviewed on 2026-11-26

- The MeitY-hosted consolidated IT Rules text is updated as on **10 February 2026** and includes the 2026 amendments and the 26 February 2026 corrigendum.
- For intermediary grievances, the current consolidated text provides a 24-hour acknowledgement and a seven-day resolution period for general grievances; certain specified prohibited-content removal requests have a 36-hour resolution period. A separate two-hour response duty applies to complaints about specified intimate / sexual imagery and electronic impersonation, including artificially morphed images. A separate three-hour removal duty applies to the relevant unlawful-information court-order / authorised-government-intimation process. These are distinct legal routes, not one generic copyright-removal deadline.
- For online curated content publishers, the Part III mechanism includes acknowledgement within 24 hours, a publisher decision within 15 days, and escalation / appeal through the applicable self-regulatory and oversight levels. The current rules also provide content classification, display and age/access-control requirements.
- The Digital Personal Data Protection Act, 2023 and DPDP Rules, 2025 have phased commencement. Under G.S.R. 843(E), dated 13 November 2025, the Consent Manager provisions (including Rule 4 and the specified Act provisions) commenced one year later, on 13 November 2026. The remaining substantive provisions listed in the notification, including Sections 3–17 and the main processing / child-data provisions and Rules 3, 5–16, 22 and 23, are scheduled to commence eighteen months after publication, i.e. **13 May 2027**. The 6 October 2026 Removal of Difficulties Order made textual corrections to Sections 9 and 10; it does not replace the phased commencement dates.
- DPDP commencement timing is not permission to ignore privacy, security, confidentiality, child-safety, IT Act / SPDI or other currently applicable duties. NexaFilm must build the privacy controls now and revalidate the legal position immediately before pilot launch and again before 13 May 2027.

This summary is a planning aid, not a complete statement of Indian law. Counsel must verify current Gazette notifications, later amendments, court orders and applicable state / sector requirements before any public launch.

## 3. Creator eligibility and account verification

### 3.1 Initial pilot eligibility

- Invitation-led applications only; no open, anonymous uploader.
- Contracting creator must be 18 years or older, or the contracting party must be a properly authorised adult legal entity. Do not onboard a minor as a creator / licensor in v1.
- Creator must use a verified NexaFilm account with a working email and strong account security.
- Creator must disclose their role for every work: producer, co-producer, filmmaker, director, writer, performer, rights owner, distributor, agent or another role.
- The person who negotiates may not be the person who owns the rights. Verify the actual contracting licensor and signatory authority separately.
- Creators must accept the approved Creator Terms, Content Standards, Rights Declaration and complaint / takedown process before submitting works.
- The pilot must not promise audience numbers, discovery placement, a sponsor, earnings, minimum guarantee or payment date unless a separately approved signed document expressly provides it.
- A creator profile may use a public stage name. Do not publicly display legal identity, personal phone, home address, identity documents, private contract or payout details.

### 3.2 Identity and authority evidence

Collect only what the chosen verification method needs:
- Legal name / contracting entity and the signatory's role.
- Reliable contact and notice channel.
- Company / partnership authorisation, board resolution, power of attorney or agency / distribution mandate where applicable.
- Evidence that the rights owner controls the relevant digital / OTT rights for the intended territories and term.
- Co-producer, financier, distributor, prior licensee and other consent details.
- Existing exclusive licences, platform windows, holdbacks, liens, disputes, restrictions or encumbrances.
- A safe method to verify documents and confirm authenticity where proportionate.

Do not request government ID, bank information or confidential agreements through a first-contact email, public form or chat. Use an approved restricted channel only when necessary and authorised.

### 3.3 Minors and people appearing in a work

- A minor may appear in an otherwise eligible work only after the creator supplies legally sufficient guardian / parent consent, performer documentation and any required work / location / safeguarding permission. Counsel must review the required form for the actual circumstances.
- No child sexual abuse material, sexualised depiction of a minor, exploitative material or non-consensual intimate imagery involving a minor may be submitted or retained as ordinary content.
- Never ask a creator, reporter or viewer to send, repost or download suspected child sexual abuse material for review. Use the approved legal / child-safety escalation process and make any mandatory report to the appropriate authority as required by law.
- The first pilot does not create child creator profiles, child-targeted behavioural advertising, public comments, direct messages or child-to-adult contact features.
- Any viewer account or processing of children's personal data must be separately assessed and approved under the applicable current law and the DPDP provisions scheduled to take effect on 13 May 2027. Do not assume an age checkbox alone is legally sufficient.

## 4. Title-specific rights declaration and evidence standard

Complete a separate record for every film, episode, materially distinct version and territory. A series-level declaration does not clear each episode automatically.

### 4.1 Minimum rights matrix

The creator must identify whether the licensor controls each right below, with supporting evidence and any limitations:

| Rights area | Evidence / review required |
|---|---|
| Work identity | Exact title, alternate title, year, runtime, cut/version, producer, director, writer, file / checksum after approved secure intake |
| Chain of title | Producer and co-producer agreements, assignments / licences, distribution mandate, authority of signatory, financiers / prior rights holders |
| Underlying work | Story, screenplay, adaptation, remake, sequel, characters, source material and any third-party literary / dramatic works |
| Music | Composition and lyrics rights, sound recording / master rights, synchronisation / online communication rights as applicable, cue sheet and territory / term |
| Performers and contributors | Actor, musician, singer, dancer, voice artist, presenter, writer, director and other contributor agreements / releases |
| Third-party materials | Stock footage, archive footage, photographs, artwork, fonts, logos, graphics, maps, news footage and other incorporated assets |
| Privacy / appearance | Appearance, location, interview, private-property and relevant personal-information permissions |
| Platform exploitation | Explicit right to offer the exact work on NexaFilm by on-demand internet streaming |
| Monetisation | Separate selection for free, sponsorship / advertising-supported, subscription, transactional / pay-per-view or any other model |
| Territory and term | Exact countries, start / end dates, release windows, festival / theatrical / broadcast / platform holdbacks |
| Languages and accessibility | Original and dubbed audio, subtitles, captions, translations, audio description and who owns / approves each version |
| Technical processing | Secure upload, hosting, storage, backup, copying, encoding, transcoding, packaging, HLS, CDN and contracted processor / vendor use |
| Promotional rights | Separate permission for trailers, teasers, clips, posters, stills, thumbnails, key art, logos and social promotion |
| Other uses | Downloads, offline viewing, edits, excerpts, censorship versions, sublicensing and AI / ML use must each be separately granted or expressly excluded |

### 4.2 Default exclusions

Unless separately and expressly granted in the signed title-specific licence, the following are **not granted**:
- Worldwide, perpetual or exclusive rights.
- Download / offline rights, redistribution or public exhibition.
- Broadcast, theatrical, festival, airline, education or third-party syndication.
- Dubbing, translation, subtitles, editing, excerpts, alternate cuts or censorship changes.
- Trailers, stills, posters, thumbnails, artwork, clips, logos or promotional reuse.
- AI / ML training, evaluation, fine-tuning, synthetic voice / likeness generation or other AI exploitation.
- Any commercial model not expressly selected in the signed schedule.

A general statement such as "OTT rights available" is not enough. Blank, unclear, unchecked or conflicting scope fields mean **not granted** until completed by a signed amendment.

### 4.3 Evidence handling and review

1. Receive supporting documents only through an approved restricted legal intake channel.
2. Record a controlled document reference, file hash (SHA-256), document version, review date, reviewer and review outcome where approved.
3. An authorised human reviewer inspects the actual document, verifies signatory authority and checks that the evidence covers the exact work/version, territory, term, monetisation and technical use.
4. A hash identifies a file; it does not establish authorship, authenticity, legal authority or the meaning of a contract.
5. Store contracts and identity evidence in restricted legal storage, not in the source repository, public issue tracker, chat, creator profile or public catalogue.
6. Record unresolved matters as Pending / Failed. Do not allow a creator self-declaration to change a rights status to Approved.
7. Legal review is required where chain of title, music, contributor releases, territorial scope, AI / synthetic likeness, exclusivity, prior windows or a claim is unclear.

## 5. Content standards and prohibited material

### 5.1 Never publish / immediate escalation

The following are prohibited from submission, publication, promotion or monetisation:
- Child sexual abuse / exploitation material, grooming, sexualised depiction of minors or content otherwise prohibited under child-protection law.
- Non-consensual intimate imagery, sexual deepfakes, artificially morphed sexual imagery, revenge pornography or private-area imagery without lawful consent.
- Content that infringes copyright, trade marks, performer rights, privacy, publicity, confidentiality or other third-party rights.
- Impersonation, identity theft, fabricated statements or realistic synthetic depictions that unlawfully misrepresent a real person or event.
- Doxxing, stalking, targeted harassment, credible threats, extortion or incitement to violence.
- Obscene, sexually explicit, exploitative or otherwise unlawful content, including content barred by a competent court / authority.
- Content that promotes or facilitates terrorism, violent extremist activity, weapons / explosives procurement, trafficking, exploitation, unlawful gambling or other prohibited acts.
- Malware, malicious code, credential theft, phishing or content designed to compromise the platform or viewers.
- Defamatory or knowingly false allegations presented as fact, subject to context, lawful expression, due process and legal review.
- Material that violates applicable law or a valid court / competent-authority order.

Where classification or legal status is uncertain, keep the work private and escalate rather than publishing while the question is unresolved.

### 5.2 Restricted / needs careful review

The following require human review, context assessment, accurate descriptors and applicable age controls:
- Violence, gore, horror, self-harm, suicide, dangerous imitation or weapons depiction.
- Sexual themes, nudity, strong language or adult themes.
- Alcohol, tobacco, drugs, gambling references or illegal-substance depiction.
- Caste, race, gender, religion, disability, sexuality or other protected / sensitive characteristics, especially where the content may promote hatred, discrimination or violence.
- Political, public-order, conflict, historical or real-person depictions that may be misleading, defamatory or likely to cause harm.
- Pranks, challenges or stunts that may cause physical or psychological harm.
- Documentary / journalistic material involving vulnerable persons, private individuals, disputed facts or sensitive events.
- AI-generated, AI-altered or synthetic audio / visual material.
- Sponsored material or third-party brand integrations.

A restricted theme is not automatically prohibited. Review context, treatment, artistic / documentary purpose, audience impact and applicable law. Record a reasoned decision and content descriptors.

### 5.3 Synthetic / AI-generated media

- Every creator must declare whether the work uses AI-generated, AI-modified, voice-cloned, face-swapped, synthetic or otherwise materially altered audio / visual material.
- Record the tool / source, affected segments, whether a real person or real-world event is portrayed, and written consent / authority for any recognisable person's voice, likeness or performance.
- Prohibit non-consensual sexual imagery, child sexual abuse material, deceptive impersonation and other unlawful synthetic material.
- If the IT Rules' intermediary provisions apply, implement the required prominent visual label or prefixed audio disclosure and permanent metadata / provenance mechanism to the extent technically feasible; do not enable suppression or removal of the required label or metadata.
- Ordinary technical corrections, colour adjustments, noise reduction, compression, formatting, accessibility improvements and translation that do not materially alter or misrepresent the underlying content are distinguished in the Rules from synthetic information; do not treat that distinction as permission for deceptive alterations.
- Do not train or fine-tune NexaFilm or third-party AI systems on creator content. Any future AI use requires a separate rights grant and privacy / legal assessment.

### 5.4 Sponsored and commercial material

- Clearly identify sponsored / paid placement in a manner viewers can understand before or while viewing.
- Creator must approve the sponsor, brief, category, integration and deliverables in writing.
- Do not disguise paid promotion as an independent review or editorial recommendation.
- Do not accept a sponsor or ad category prohibited by law or NexaFilm's later approved restricted-category list.
- Do not incentivise creators or viewers to fabricate impressions, clicks, views, follows or engagement.
- A sponsor agreement does not replace the creator's title licence or grant NexaFilm additional film / music / performer / promotional rights.

## 6. Content classification, age controls and accessibility

### 6.1 Publisher-track requirements

If counsel determines that NexaFilm is a publisher of online curated content for the relevant service / catalogue, the current IT Rules' Schedule includes the ratings:
- U
- U/A 7+
- U/A 13+
- U/A 16+
- A

The publisher-track requirements include prominent ratings and relevant content descriptors before access; parental / access controls for U/A 13+ or higher; and reliable age verification for A-rated content. The applicable classification considers context, theme, tone, impact, target audience and relevant descriptors.

### 6.2 Pilot policy recommendation

- Do not accept A-rated / adult content in the first creator pilot.
- Use trained human review to assign the proposed rating and content descriptors for each title / episode, subject to counsel's confirmation of the applicable publisher classification rules.
- Do not infer that a creator's own rating is sufficient.
- Do not display a title until the rating, descriptors and access behaviour are configured and tested.
- No viewer-facing comments or direct messages in the first pilot.
- Include captions / subtitles where available and design accessible playback and controls. Where publisher obligations apply, follow the applicable accessibility requirements and take reasonable measures.

### 6.3 Child / family safeguards

- Do not target children with creator recruitment, advertising, behavioural profiling or engagement pressure.
- Do not build child profiles, direct messaging, open comments or child-to-adult contact in v1.
- Before allowing child accounts or processing children's personal data, obtain a specific legal/privacy design review for verifiable parental consent, permitted processing, age assurance, retention, advertising and access controls under the DPDP provisions and rules applicable at the time.
- Do not claim that an 18+ creator rule alone makes the viewer service child-safe.
- If viewer age is unknown, apply the approved default content/access policy; do not expose A-rated or otherwise restricted material without the required controls.

## 7. Submission, review and publication workflow

### 7.1 Required states

`DRAFT → SUBMITTED → RIGHTS_REVIEW → CONTENT_REVIEW → NEEDS_CHANGES / REJECTED / APPROVED_FOR_RELEASE`

After approval, a separate technical and release gate controls `READY_FOR_RELEASE → PUBLISHED`. Ongoing states include `SUSPENDED`, `TAKEDOWN_PENDING`, `REMOVED`, `EXPIRED` and `APPEAL_PENDING`.

### 7.2 Pre-publication gates

A work cannot enter `APPROVED_FOR_RELEASE` unless:
- Creator account and contracting party are verified.
- Actual rights owner / authorised licensor and chain of title are reviewed.
- Signed title-specific licence and exact work/version are matched.
- Territory, term, permitted language / version, monetisation and technical processing rights are complete.
- Music, performer, underlying work and third-party clearances are sufficient for the proposed use.
- Classification, content descriptors, accessibility metadata and access control are approved.
- Human content moderation is complete.
- No unresolved rights, privacy, safety, defamation, court-order or authority issue exists.
- Takedown and operational contacts are known.
- The owner has approved any separate upload/provider/playback/publication scope required by the roadmap.

### 7.3 Creator changes and removal

- A creator can submit a revised version only as a new identifiable version with its own rights / metadata checks.
- A creator cannot replace a reviewed asset silently after approval.
- Material edits, new audio, new subtitles, new music, new promotional assets or a changed cut require fresh rights and review.
- Licence expiry, withdrawal, a credible rights dispute, loss of authority, court order or material policy breach must trigger prompt access suspension / expiry handling.
- Reinstatement requires a recorded decision confirming that the blocking issue is resolved and that all prior release gates still hold.

## 8. Complaints, rights reports and takedown

### 8.1 Public reporting entry points

The product requirements must support a visible route to report:
- Copyright / ownership / licensing concern.
- Privacy, publicity, impersonation or non-consensual imagery.
- Child-safety concern.
- Harassment, threat, hate or other harmful content.
- Illegal content / court or government order.
- Incorrect age rating / content descriptor.
- Sponsored-content disclosure / deceptive commercial practice.
- Security abuse, spam or account compromise.
- General service / grievance issue.

A report must accept a work URL or title / content ID, affected segment / timestamp where relevant, report category, concise description, reporter contact preference, urgency, and supporting information. The form must warn reporters not to upload or transmit illegal imagery or unnecessary sensitive personal data.

### 8.2 Copyright / rights complaint intake

A rights complaint should request, to the extent relevant:
- Claimant's name and contact details.
- Work claimed and NexaFilm item / URL / ID, with exact affected version or time segment.
- Nature of the right and country / territory concerned.
- Basis of ownership or authority to act.
- Description of why the NexaFilm use is outside the grant.
- Good-faith and accuracy declaration.
- Supporting documents through a restricted legal intake channel, not a public form.

The reviewer must assess whether the claimant is the owner / authorised representative and compare the complaint with the signed licence, rights matrix and territory / term. A bare assertion is not automatically proof, but a credible risk can justify temporary access restriction while investigated.

### 8.3 Response clocks — do not merge legal categories

The applicable legal route must be selected by counsel and the Grievance Officer. Current consolidated IT Rules include distinct routes:

| Route (only where legally applicable) | Current rule timing reflected in the 2026 consolidated IT Rules |
|---|---|
| Intermediary general grievance | Acknowledge within 24 hours; resolve within 7 days |
| Intermediary removal request within the specified Rule 3(1)(b) categories, excluding the listed exceptions | Act as expeditiously as possible and resolve within 36 hours |
| Report of specified private-area / nudity / sexual-act content or electronic impersonation, including artificially morphed images | Take reasonable and practicable measures within 2 hours |
| Court order / authorised Government intimation for the specified unlawful information route | Remove / disable access within 3 hours of the relevant actual knowledge |
| Online curated content publisher grievance (Part III) | Acknowledge within 24 hours; publisher decision within 15 days, with the prescribed escalation / appeal structure |

**Important:** the 36-hour intermediary route expressly excludes specified sub-clauses, including the copyright-rights sub-clause. Do not promise every copyright complaint will be resolved in 36 hours under that provision. Copyright reports still require prompt, risk-based review and any other applicable legal action.

### 8.4 Internal operating targets (proposed, not statutory promises)

- Child-safety, non-consensual intimate imagery, credible physical threat or urgent impersonation: immediate queue escalation; trained human triage target within 1 hour, without delaying any shorter statutory response.
- Credible copyright / privacy / identity claim: acknowledgement target within 1 business day; access may be temporarily restricted if the risk is credible and material; target initial decision within 5 business days where evidence is complete.
- Standard policy / metadata complaint: acknowledgement target within 1 business day; target decision within 7 business days.
- Complex or incomplete cases: log the reason, ask for only necessary additional information, set a next review date and keep the complainant updated.
- Statutory deadlines override internal targets whenever the law requires faster action or a different process.

These are service design targets only. They must be resourced, tested and legally approved before NexaFilm publishes them as binding response commitments.

### 8.5 Intake, preservation and action

For each report:
1. Generate a unique case ID and timestamp in the service's applicable local time / UTC audit record.
2. Classify urgency, legal route, content ID, territories and the applicable statutory deadline.
3. Restrict access promptly where required by law or where necessary to protect a person, preserve evidence or prevent continued harm.
4. Preserve the relevant content and associated records only in accordance with the applicable law, privacy / security controls and legal-hold directions; restrict access to authorised personnel.
5. Avoid copying, downloading or circulating illegal sexual imagery, especially suspected child sexual abuse material. Follow approved reporting / preservation procedure.
6. Notify the creator where lawful and safe; do not disclose victim data, reporter identity or investigation-sensitive information without lawful basis.
7. Record action, decision, rationale, reviewer, notice sent, appeal path and reinstatement conditions.
8. Confirm closure or next steps to the complainant where permitted.
9. Escalate mandatory-reporting matters to the appropriate authority as required by law.

### 8.6 Takedown, restoration and counter-information

- NexaFilm may disable access on a credible rights or safety claim while it verifies the issue; the public-facing player must fail closed.
- A creator may submit a reasoned response with permission evidence through the restricted channel. This is an internal review process and does not replace any statutory or court process.
- Do not automatically restore content because a creator disputes a complaint. Require reviewer approval and confirmation that rights / safety risk is resolved.
- Do not keep infringing content publicly available merely because it attracts views or sponsor revenue.
- A malicious or abusive report may be closed with reasons and abuse controls, but repeated-report safeguards must not suppress genuine reports.
- Preserve records and evidence where required, but do not retain more personal data or content copies than lawfully necessary.

## 9. Appeals and fair process

### 9.1 Creator internal appeal

Creators may appeal a Needs Changes, Rejected, Suspended, demonetised, Removed or rights-review decision:
- File through the creator account or an approved written route within 30 calendar days of the decision, unless a shorter legal route or emergency restriction applies.
- Identify the decision / work ID, explain the disputed point and supply additional rights / context evidence through the restricted route.
- A different authorised reviewer should review the appeal where practicable.
- Proposed internal target: acknowledge within 2 business days and decide within 10 business days after receiving complete information.
- Provide the outcome and material reasons, subject to legal, privacy and safety restrictions.
- A creator appeal does not suspend a legal takedown, court order, statutory response deadline or immediate safety restriction.

### 9.2 Reporter / viewer appeal

- A reporter may request reconsideration of a closure decision with material new information.
- A viewer may appeal an account / access action through the displayed support route.
- Do not disclose another person's confidential rights documents, identity details or sanctions.
- Any statutory Grievance Appellate Committee or Part III self-regulatory / oversight process is separate and must be signposted accurately if it applies.

## 10. Privacy, security and data governance

### 10.1 Data categories and purposes

The product must document the purposes and minimum fields for:
- Account and creator profile data.
- Identity / authority verification records.
- Film metadata, rights declarations and controlled evidence references.
- Moderation decisions, reports, appeals and case correspondence.
- Security logs, access / upload records and incident evidence.
- Sponsorship campaign and accounting records, if later authorised.

Do not collect identity cards, full birth dates, bank details, home addresses, biometric information, private messages, family data or unrelated personal data merely because a form can request them.

### 10.2 Data governance requirements

- Provide a clear, accessible, purpose-specific privacy notice and appropriate user / creator terms, in English and Tamil for the pilot, with a privacy contact and complaint route.
- Separate public profile data from private verification, legal, grievance and payout records.
- Use role-based access, least privilege, access logs, encryption in transit and at rest where supported, secure secrets handling and controlled service-provider access.
- Maintain a documented retention schedule by data category and legal role; delete / anonymise data when the purpose and lawful retention period end, subject to legal holds and applicable law.
- Give users a channel for account closure / deletion requests, correction requests and privacy complaints, with identity checks proportionate to the risk.
- Document each processor / video / cloud / analytics / support provider, its access, purpose, security requirements, location and deletion / return obligations before onboarding.
- Do not use creator uploads, complaints or identity documents for AI training or unrelated analytics.
- Do not share complainant identity with a creator unless lawfully necessary and approved.
- Keep an incident register and an escalation path for unauthorised access, leak, account takeover, exposed source media and sensitive complaint data.

### 10.3 DPDP commencement guardrail

As of 26 November 2026, the 13 November 2025 commencement notification brings the Consent Manager provisions (Rule 4 and the specified Act provisions) into force after one year, on 13 November 2026. The main Data Fiduciary processing duties and child-data provisions listed in the same notification, together with Rules 3, 5–16, 22 and 23, are scheduled for 13 May 2027. The 6 October 2026 Removal of Difficulties Order corrects wording in Sections 9 and 10 and does not move those dates.

The product must be designed now for the 13 May 2027 requirements, including the applicable notice, consent, child-data and rights processes. The owner must obtain a current privacy-law review before accepting personal data from minors or launching child-access features. Do not state in public terms that the substantive DPDP processing duties are already fully commenced as of this document date.

## 11. Operator roles and separation of duties

| Role | Minimum responsibility |
|---|---|
| Creator | Accurate declarations; supply evidence; maintain permissions; respond to rights claims |
| Creator onboarding reviewer | Verify account, contracting party and authority; avoid self-approval |
| Rights reviewer | Inspect actual rights documents, chain of title, rights matrix, territory and term |
| Content moderator | Review content, classification, context, descriptors and policy compliance |
| Grievance Officer / complaint owner | Track statutory route and clock, acknowledge, decide, communicate and escalate |
| Privacy / security owner | Restrict sensitive data, processor access, retention and incidents |
| Admin / release approver | Confirm all gates; ensure no rights or moderation block is bypassed |
| Legal counsel | Confirm platform classification, statutory duties, complex rights claims and mandatory reporting |
| Finance / payout approver (later phase) | Verify creator payables, supporting documents, reconciliations and maker-checker payout controls |

One person may perform more than one role at the early stage only where no conflict exists and the decision has an independent check. A creator must never approve their own rights or moderation review. Serious sanctions, high-risk complaints, rights reinstatement and disputed payouts require a second reviewer.

## 12. Enforcement and repeat violations

Possible actions, proportionate to severity and evidence:
1. Request correction or additional evidence.
2. Keep draft private / reject submission.
3. Restrict a territory, version, age group or monetisation function where the rights grant permits only that scope.
4. Remove a promotional asset while leaving a separately cleared film available, or the reverse, as appropriate.
5. Temporarily suspend access while investigating.
6. Remove content or expire the licence.
7. Suspend creator submission privileges.
8. Terminate creator access for serious or repeated violations.
9. Preserve required records and refer / report to the appropriate authority where legally required.

Maintain a repeat-infringer record using reliable case evidence, not unverified allegations. Give a notice and reasonable opportunity to respond where lawful and safe. Serious child-safety / non-consensual imagery / credible immediate-danger matters may require immediate restriction and account action without prior notice. Any later restoration is a new, documented decision.

## 13. Transparency and records

If NexaFilm is found to operate as an intermediary:
- Publish the applicable user rules, privacy policy, user agreement and Grievance Officer details prominently.
- Periodically remind users of the rules and consequences as required by the applicable current IT Rules.
- Maintain complaint tickets, action history and legally required content / associated records. The current intermediary rules include a 180-day preservation requirement for removed / disabled information and associated records in the specified circumstances; retention must be implemented only as legally applicable and balanced with privacy / legal holds.
- Follow lawful court / government orders through a documented verification and response process; preserve the order, legal basis, scope, deadline, action and reviewer.

If NexaFilm is found to operate as a publisher of online curated content:
- Appoint and publish the India-based Grievance Officer details.
- Follow the applicable Level I / II / III grievance structure, including membership of the required self-regulatory body where applicable.
- Furnish entity details to the Ministry within the applicable commencement / start-of-operations period.
- Publish the required monthly grievance compliance information.
- Preserve content records for the period required by the applicable publisher provisions (the current Rules specify a minimum 60-day period in Rule 19), subject to other lawful retention requirements.

These two record regimes are not interchangeable. Counsel must approve a single operational retention matrix that covers every function and does not create conflicting or excessive retention.

## 14. No-go conditions for the first creator pilot

Do not launch the creator submission / viewing pilot if any of the following is true:
- Legal classification of the creator submission and curated catalogue functions has not been reviewed.
- Creator / contracting entity / signatory authority cannot be verified.
- Rights chain, music / performer / underlying work or technical / commercial rights are incomplete.
- A signed title-specific licence is absent, unclear or expired.
- Territory, language, term, monetisation or technical processing is unknown.
- A serious safety, privacy, defamation or court-order issue remains unresolved.
- Age classification, content descriptors or access controls are not configured and tested where required.
- Complaint intake, grievance owner, emergency escalation and statutory deadline tracking are not staffed and tested.
- Privacy notice, retention, access control, processor terms or incident response are not ready.
- Secure private submission, file validation and removal behaviour have not been approved and tested.
- The required owner, legal or operational approvals are missing.

## 15. Approval gates and open decisions

| Decision / gate | Required before | Status |
|---|---|---|
| Written legal classification matrix for intermediary vs online curated content publisher functions | Creator upload / public pilot design finalisation | **Pending counsel** |
| Current Indian media / copyright / IT Rules legal review of this policy | Publish Creator Terms, Content Policy or grievance details | **Pending counsel** |
| DPDP readiness assessment and May 2027 implementation plan | Any child-data or broad viewer-account rollout | **Pending counsel / privacy owner** |
| Named and trained grievance / safety / rights reviewers | Accept public creator submissions or operate any statutory complaint route | **Not appointed** |
| Final creator terms and rights declaration | Invite creators into an operational submission flow | **Not approved** |
| Content classification and age-control design | Publish any work subject to publisher obligations | **Not implemented / not approved** |
| Private upload, evidence storage and retention design | Receive actual video files or sensitive evidence in NexaFilm systems | **Not authorised** |
| Sponsor / advertising disclosure policy | Sell or publish sponsored campaigns | **Pending C0 commercial approvals and counsel** |
| Owner approval and Milestone 5 release gates | Any public launch / Production | **Not approved** |

## 16. C1 acceptance checklist

- [x] Function-specific intermediary / online curated content publisher classification risk identified; legal opinion gate added.
- [x] Creator eligibility and authority verification requirements defined.
- [x] Per-work / per-version rights matrix and evidence standard defined.
- [x] Third-party rights, music, performers, underlying works and ancillary rights addressed.
- [x] Prohibited and restricted content standards defined.
- [x] AI / synthetic media disclosure and provenance controls mapped to the current IT Rules.
- [x] Age classification, parental / access controls and child-safety boundaries defined.
- [x] Complaint intake and differentiated statutory response routes documented.
- [x] Takedown, evidence handling, appeals and repeat-infringer controls defined.
- [x] Privacy, security, processor, retention and DPDP commencement guardrails documented.
- [x] Operator roles, no-go conditions and required approvals defined.

**C1 result:** PASS — consolidated policy and rights / moderation requirements specification complete as a documentation deliverable, informed by the official materials listed below as reviewed on 26 November 2026. This is not a legal sign-off, platform legal classification, public Creator Terms, appointed grievance process, creator agreement, or launch approval.

No application code, tests, schema, database row, Movie / License record, shared database, media, upload, provider, payment, payout, feature flag, playback, environment variable, DNS, PR merge or Production resource was changed.

**Next single task:** C2 — inspect the current NexaFilm codebase and produce one implementation-impact assessment for Creator Studio MVP, identifying which existing account, catalogue, rights-evidence, admin and audit components can be reused and the minimum product/data/API/UI changes required. Assessment only; no code or schema migration until that report is reviewed and approved.

## 17. Official legal and regulatory reference set

Reviewed for this specification on 26 November 2026. Counsel must re-check current amendments and Gazette status before implementation or launch.

1. **MeitY — consolidated Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, updated as on 10 February 2026:**  
   https://www.meity.gov.in/static/uploads/2026/03/0b576f2071694b52e4cd6bb1b6dfab1e.pdf?v=20260915173513
2. **PIB / MeitY — 23 October 2025 amendment to Rule 3(1)(d), effective 15 November 2025:**  
   https://www.pib.gov.in/PressReleasePage.aspx?PRID=2181719&lang=1&reg=3
3. **Copyright Office — Copyright Act, 1957, Chapter XI (including Section 51 and Section 52):**  
   https://copyright.gov.in/Copyright_Act_1957/chapter_xi.html
4. **MeitY — Digital Personal Data Protection Rules, 2025, G.S.R. 846(E), 13 November 2025:**  
   https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf
5. **MeitY — DPDP Act commencement notification, G.S.R. 843(E), 13 November 2025:**  
   https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf
6. **MeitY — DPDP (Removal of Difficulties) Order, 2026, S.O. 5458(E), 6 October 2026:**  
   https://www.meity.gov.in/static/uploads/2026/10/daf495a7b5798a3dfa72a944b51fc176.pdf

These references are included to make future legal review traceable. They do not replace advice from qualified Indian media, copyright, privacy and technology counsel.
