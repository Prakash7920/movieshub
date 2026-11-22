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
- **Attached MP4 SHA-256:** `7fc29878ab11990a80460a1b7677f692569a44e6b730a17feaaae1b8aa6a5b13`
- **Attached MP4 size:** 1,180,190 bytes
- **Stream provider upload / asset UID:** Not performed

## Creation details

The clip was generated with an original prompt describing a serene futuristic environment made of translucent glass arches and softly glowing blue-white light, subtle floating particles and volumetric rays, a smooth forward camera dolly, shimmering reflections and subtle lighting shifts. Premium cinematic realism, no people, text, captions, logos, brands, recognizable copyrighted characters or references to existing films/franchises. Ambient sound only; no speech or music.

## Scope and provenance

The clip was generated from a text prompt, not copied from an existing movie, trailer, stock clip, music recording, or third-party video. This is a synthetic test asset created for this project's isolated proof-of-concept workflow. The SHA-256 below fingerprints the exact MP4 attached by the user for this verification. It is not a provider-signed attestation or proof that an upstream stored copy is byte-identical; the earlier vidIQ import URL came from this generation output and its reported metadata matches the attached file.

## Phase 5.31 — independent metadata and integrity inspection

The existing imported asset was rechecked by upload ID (read-only status refresh; no new render and no credits consumed). Import status returned `ready`.

The media metadata service returned the following values for the existing import:

| Property | Observed value |
|---|---:|
| Container/source classification | file |
| Duration | 10.144 seconds |
| Width | 768 pixels |
| Height | 1,344 pixels |
| File size | 1,180,190 bytes |
| Overall bitrate | 930,749 bits/second |
| Stream count | 2 |

The attached MP4 was then inspected locally using `ffprobe` and fully decoded with `ffmpeg`:

| Property | Local inspection |
|---|---|
| Container | ISO Base Media / MP4 |
| Video codec | H.264 |
| Video dimensions | 768 × 1,344 |
| Video stream duration | 10.125 seconds |
| Audio codec | AAC |
| Audio format | 32,000 Hz, 2-channel stereo |
| Audio stream duration | 10.144 seconds |
| Overall duration | 10.144 seconds |
| File size | 1,180,190 bytes |
| Full decode | PASS — ffmpeg returned exit code 0 with no decode errors |
| SHA-256 | `7fc29878ab11990a80460a1b7677f692569a44e6b730a17feaaae1b8aa6a5b13` |

The local dimensions, duration, size and bitrate match the metadata returned for the existing vidIQ import. This is strong consistency evidence for the same asset. No independent checksum from the remote generator/import storage was available for a cryptographic remote-to-local byte comparison.

## Gate result

- Synthetic creation completed: **PASS**
- Import to vidIQ completed: **PASS**
- Import status Ready on recheck: **PASS**
- Independent media metadata inspection: **PASS**
- Portrait dimensions confirmed: **PASS**
- Duration confirmed (10.144 seconds): **PASS**
- Local SHA-256 fingerprint computed: **PASS**
- Full local MP4 decode: **PASS**
- Remote generator/import byte-for-byte checksum comparison: **NOT AVAILABLE**
- Cloudflare Stream upload / provider-side signed playback: **NOT PERFORMED**
- Preview playback integration: **NOT PERFORMED**
- Production changes: **NONE**

**Phase 5.31 result:** **PASS for the attached synthetic MP4's local metadata, SHA-256 fingerprint and full decode.** Remote provider byte identity and any Cloudflare/Preview playback validation are separate, uncompleted gates.

Keep Cloudflare account/resource setup and playback flags off until remaining operational approval and verification steps are separately approved. This checkpoint does not authorize provider upload, credentials, payment-method setup, or Production changes.
