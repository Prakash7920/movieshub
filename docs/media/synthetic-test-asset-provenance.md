# Synthetic Test Asset Provenance — NexaFilm

- **Checkpoints:** Phase 5.30 — Synthetic test-asset provenance; Phase 5.31 — asset metadata and integrity verification
- **Recorded / verified:** 2026-11-22
- **Branch:** `phase-5/consolidated-security-ops`
- **Asset:** Original synthetic video created specifically for a non-production playback test
- **Generation model:** MiniMax H3
- **Requested duration / shape:** 10 seconds, vertical portrait
- **Generation resolution setting:** 768p
- **Generator job:** `job_8f9301cf-b9ed-4c12-8df0-e8b930e1bddb`
- **Generator project:** `22548b59-4f8d-4ddf-b62f-66aae77afe9c`
- **vidIQ import ID:** `4ee5f235-8624-46cd-8376-92b17b507dd8`
- **Latest import status:** Ready
- **Asset SHA-256:** Not computed — raw MP4 bytes could not be retrieved into the inspection runtime
- **Stream provider upload / asset UID:** Not performed

## Creation details

The clip was generated with an original prompt describing a serene futuristic environment made of translucent glass arches and softly glowing blue-white light, subtle floating particles and volumetric rays, a smooth forward camera dolly, shimmering reflections and subtle lighting shifts. Premium cinematic realism, no people, text, captions, logos, brands, recognizable copyrighted characters or references to existing films/franchises. Ambient sound only; no speech or music.

## Scope and provenance

The clip was generated from a text prompt, not copied from an existing movie, trailer, stock clip, music recording, or third-party video. This is a synthetic test asset created for this project's isolated proof-of-concept workflow. This record documents generation, import and metadata inspection only; it is not a legal review of all model-generated components or a cryptographic content-integrity verification.

## Phase 5.31 — independent metadata inspection

The existing imported asset was rechecked by upload ID (read-only status refresh; no new render and no credits consumed). Import status returned `ready`.

The media metadata inspector returned:

| Property | Observed value |
|---|---:|
| Container/source classification | file |
| Duration | 10.144 seconds |
| Width | 768 pixels |
| Height | 1,344 pixels |
| File size | 1,180,190 bytes (about 1.18 MB) |
| Overall bitrate | 930,749 bits/second |
| Stream count | 2 |

The file is portrait as intended. The reported dimensions are 768 × 1,344 pixels; this measured dimension pair is recorded rather than assuming an exact 9:16 raster.

The content bytes could not be downloaded into the inspection runtime because network name resolution failed. Therefore a local file hash (SHA-256), codec-level inspection, and byte-for-byte verification against the generated source could not be performed. No hash has been invented or inferred from the job or upload ID.

## Gate result

- Synthetic creation completed: **PASS**
- Import to vidIQ completed: **PASS**
- Import status Ready on recheck: **PASS**
- Independent media metadata inspection: **PASS**
- Portrait dimensions confirmed: **PASS**
- Duration confirmed (10.144 seconds): **PASS**
- SHA-256 fingerprint: **BLOCKED — raw bytes unavailable to inspection runtime**
- Codec-level / byte-level integrity: **NOT VERIFIED**
- Cloudflare Stream upload / provider-side signed playback: **NOT PERFORMED**
- Preview playback integration: **NOT PERFORMED**
- Production changes: **NONE**

Keep Cloudflare account/resource setup and playback flags off until remaining operational approval and verification steps are separately approved. This checkpoint does not authorize provider upload, credentials, payment-method setup, or Production changes.
