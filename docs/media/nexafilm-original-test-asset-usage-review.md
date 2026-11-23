# NexaFilm Original Test Asset — Usage & Rights Evidence Review

- **Checkpoint:** Phase 5.37 — Original asset usage and rights-evidence review
- **Review date:** 2026-11-23
- **Branch:** `phase-5/consolidated-security-ops`
- **Asset:** `nexafilm-original-test.mp4`
- **MP4 SHA-256:** `f28ec6979199bed58194759b5664f4ec13285980e456b910b82e545fda3f7c13`
- **Generator source SHA-256:** `535912e23fb67bb5a7141ab021cfad0b1534e1690516d726dba0d69904e3ad79`
- **Committed source Git blob SHA-1:** `cb3f2f19eef3a9cb61ca4190b019c41ab1b3620a`
- **Decision:** **TECHNICAL PROVENANCE PASS; RESTRICTED INTERNAL-USE OWNER APPROVAL PENDING**
- **Upload status:** Not uploaded to Cloudflare or another media provider

## 1. Materials reviewed

1. The exact generator used to produce the MP4: `scripts/generate_nexafilm_test_asset.py`.
2. Its source fingerprint and committed Git blob identity. The source is 7,885 bytes; local SHA-256 is recorded above. The checked-in copy was aligned to the exact local execution file and the Git blob SHA returned by GitHub matched the locally calculated Git blob object ID.
3. MP4 metadata from `ffprobe`: MP4 container, H.264 video, 1280×720, 24 fps, 240 frames, 10.000 seconds, 1,487,027 bytes, no audio stream.
4. MP4 SHA-256 and complete FFmpeg decode: `f28ec6979199bed58194759b5664f4ec13285980e456b910b82e545fda3f7c13`; decode exited 0 with no reported errors.
5. A second generation using the same local generator copy: output was byte-for-byte identical to the primary MP4.
6. Sampled still frames at 1s, 5s and 9s, showing the abstract glass-arch/portal composition without visible wording or logos.
7. Repository `README.md`, which describes the repository as sample metadata and says playback remains disabled until distribution rights and secure media delivery are verified.
8. Repository root listing. No top-level `LICENSE` file was present at the reviewed branch head.

## 2. Creation and third-party material assessment

The video frames are drawn procedurally from mathematical geometry, colour gradients, line/curve primitives, and deterministic particle positions. The generator contains no network fetch, external image/video/audio input, stock-footage import, subtitle/font asset, logo or brand input. The resulting MP4 has one H.264 video stream and no audio stream. It does not contain music, speech, third-party soundtrack or a recognisable character.

The generation environment used Python 3.13.5, NumPy 2.3.5, Pillow 12.3.0, and FFmpeg 7.1.5. These are build-time tools/libraries; no library binaries, fonts or media files are bundled into the MP4. This review did not perform a full software-supply-chain or open-source licence audit of the generation environment.

The three-frame visual sample is limited. It is not a frame-by-frame visual audit, an automated similarity search, or a legal determination about every possible visual resemblance.

## 3. What this evidence establishes

- The clip was produced by a deterministic in-house procedural drawing script for this project, rather than by vidIQ, MiniMax, a stock-media site, or an existing film/trailer file.
- The MP4 is silent and has the recorded metadata, fingerprint and complete local decode evidence.
- The source file used for generation is preserved in the existing NexaFilm repository branch and fingerprinted.
- No external content source or third-party media asset was intentionally incorporated by the generator.

## 4. What this evidence does not establish

- It is not a legal opinion or a formal copyright/ownership determination.
- The repository has no top-level `LICENSE` file. This report does not create a licence for repository code or make a grant to third parties.
- It does not independently resolve every possible third-party claim, trademark/design issue, or legal question outside the source and sampled-frame review.
- It does not authorise commercial public distribution, monetisation, use as a catalogue movie, advertising/marketing use, sublicensing, or distribution to paying customers.
- It does not replace an owner sign-off for the proposed internal test purpose.
- It does not authorise any Cloudflare account/resource creation, payment-method setup, API token/signing secret, media upload, playback flag activation, database mutation, or Production change.

## 5. Proposed narrow permitted-use boundary

Pending the explicit owner decision in Section 6, the proposed scope is limited to:

- Retaining the MP4 and its provenance evidence in the project workspace.
- Using it only as a non-public, non-commercial technical fixture to validate media metadata handling, HLS/transcoding behaviour, signed-URL expiry, access denial, and player integration in an isolated Preview/test environment.
- Keeping it out of the public movie catalogue and preventing general customer access.
- Keeping the asset and test credentials separate from Production, and deleting the uploaded test asset after the approved test window if required by the final test plan.

The following uses remain **not approved**: public release, monetised streaming, customer-facing catalogue publication, third-party redistribution, advertising, or any Production upload/playback.

Even for the limited Preview test, Cloudflare/provider upload must remain blocked until the owner explicitly approves this exact narrow use and separately completes the pending operational approvals: account/resource scope, payment method, credentials, test window, alert threshold and secure playback settings. The existing cost-model approval alone is not enough.

## 6. Human owner decision required

The technical and provenance review is complete. The responsible project owner must explicitly confirm or reject the proposed narrow scope above. The review does not infer approval from the earlier request to create the file.

- Owner approval for restricted internal non-production Preview use: **PENDING**
- Cloudflare/provider upload authorisation: **NOT GRANTED**
- Public/commercial/Production use authorisation: **NOT GRANTED**

## 7. Gate result

| Gate | Evidence | Status |
|---|---|---|
| Original procedural generation | Generator source review | **PASS** |
| No intentional third-party media inputs | Source review | **PASS** |
| Local MP4 integrity and complete decode | ffprobe, SHA-256, FFmpeg decode | **PASS** |
| Same-source deterministic regeneration | Byte-identical second output | **PASS** |
| Limited visual sample | Frames at 1s, 5s and 9s only | **PASS — LIMITED** |
| Full frame-by-frame / similarity review | Not performed | **NOT PERFORMED** |
| Repository-wide licence declaration | No top-level LICENSE found | **NOT ESTABLISHED** |
| Formal legal ownership opinion | Not obtained | **NOT PERFORMED** |
| Owner approval for narrow internal Preview use | Awaiting explicit project-owner decision | **PENDING** |
| Cloudflare upload and signed playback | Not performed; separate approvals incomplete | **NOT AUTHORIZED** |
| Commercial distribution / Production use | Outside this review | **NOT AUTHORIZED** |

**Phase 5.37 result: BLOCKED pending explicit owner approval of the restricted internal non-production test scope.** Technical provenance is PASS. No Cloudflare upload, database mutation, playback activation, payment-method change, credential change, or Production operation was performed.
