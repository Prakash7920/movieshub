# NexaFilm Original Test Asset — Provenance & Integrity Report

- **Checkpoint:** Phase 5.36 — Original procedurally generated test asset
- **Assessment date:** 2026-11-23
- **Branch:** `phase-5/consolidated-security-ops`
- **Result:** **PASS — local generation, deterministic reproduction, MP4 integrity and full decode**
- **Asset filename:** `nexafilm-original-test.mp4` (delivered as a conversation attachment; binary intentionally not committed to Git)
- **Generation method:** Original Python/NumPy/Pillow procedural frame drawing; FFmpeg H.264 encoding
- **Visual concept:** Abstract futuristic glass arches, softly glowing blue-white portal light, subtle drifting particles, volumetric atmospheric wash and a perspective floor, with a restrained forward camera move
- **Source:** `scripts/generate_nexafilm_test_asset.py`
- **Source SHA-256:** `7c635c4f6c70ecdb9095ecc2603b0d278a9d66c739b6a924be5f816b00bf3230`
- **MP4 SHA-256:** `f28ec6979199bed58194759b5664f4ec13285980e456b910b82e545fda3f7c13`

## 1. Creation and provenance

Every video frame is drawn by the repository's Python generator from mathematical geometry and gradients. The script does not download, import, embed or process any stock footage, existing film clips, third-party images, music, fonts, logos, brands, people or recognisable characters. There is no vidIQ or MiniMax generation step and no external media asset is used. FFmpeg is used only to encode the raw procedurally rendered frames into MP4/H.264.

The output is a silent, abstract technical test asset. No speech, sound recording or music is present. The local generation environment used Python with NumPy 2.3.5 and Pillow 12.3.0, and FFmpeg 7.1.5.

## 2. Media inspection

The final MP4 was inspected with `ffprobe`:

| Property | Verified value |
|---|---|
| Container | MP4 / ISO Base Media |
| Video stream count | 1 |
| Audio stream count | 0 |
| Video codec | H.264 |
| Pixel format | yuv420p |
| Width × height | 1280 × 720 |
| Frame rate | 24/1 fps |
| Frame count | 240 |
| Duration | 10.000 seconds |
| File size | 1,487,027 bytes |
| Overall bitrate | 1,189,621 bits/second |
| SHA-256 | `f28ec6979199bed58194759b5664f4ec13285980e456b910b82e545fda3f7c13` |

## 3. Integrity and reproducibility

- Full decode command: `ffmpeg -v error -i nexafilm-original-test.mp4 -f null -`.
- **Decode result:** PASS; FFmpeg returned exit code 0 and emitted no decode errors (empty stderr log).
- The generator was run a second time in the same environment to a separate output file.
- **Reproduction result:** PASS; the second MP4 had the same byte length (1,487,027 bytes), the same SHA-256, and compared byte-for-byte identical to the delivered MP4.
- Visual spot-checks at 1, 5 and 9 seconds confirmed the intended continuous abstract portal/arch scene; no text or logo content is present in the generated composition.

## 4. Intended use and boundaries

This asset is prepared for a non-production, isolated technical playback proof of concept only. It removes the dependency on the vidIQ Video Generator and the MiniMax H3 generated clip for this test. It does not by itself approve Cloudflare account/resource setup, payment-method changes, credentials, media upload, playback activation or Production operations; those remain separately gated.

This provenance record documents the procedural creation process and observed file integrity. It is not a legal opinion, does not guarantee that every possible downstream use is cleared, and must not be used to infer commercial movie distribution rights for unrelated content. Keep the asset restricted to the approved non-production test purpose until the responsible reviewer completes the separate usage review.

## 5. Gate result

| Gate | Evidence | Status |
|---|---|---|
| Original procedural frame generation | Generator source in repository | **PASS** |
| No third-party source media in generator | Source review; no remote media inputs | **PASS** |
| MP4 metadata | ffprobe report | **PASS** |
| H.264 / 1280×720 / 24 fps / 240 frames / 10 seconds | ffprobe report | **PASS** |
| No audio stream | ffprobe stream list | **PASS** |
| SHA-256 fingerprint | Local hash | **PASS** |
| Full MP4 decode | FFmpeg full decode, exit 0, empty error log | **PASS** |
| Deterministic regeneration | Second run byte-identical | **PASS** |
| vidIQ / MiniMax dependency | Not used for this asset | **NOT APPLICABLE** |
| Cloudflare upload / provider-side signed playback | Not performed | **NOT PERFORMED** |
| Preview playback integration | Not performed | **NOT PERFORMED** |
| Production changes | None | **NONE** |

**Phase 5.36 result: PASS** for original procedural creation, reproducibility, local MP4 metadata, SHA-256 and full decode. Cloudflare/Preview playback and Production release remain separate future gates.
