#!/usr/bin/env python3
"""Generate an original, deterministic abstract NexaFilm test video.

This script uses only Python, NumPy, and Pillow to draw every frame from
mathematical geometry. It downloads no media and includes no audio, fonts,
logos, people, brands, characters, or third-party footage.

Usage:
  python generate_nexafilm_test_asset.py [output.mp4]
"""
from __future__ import annotations

import hashlib
import math
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Sequence

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

WIDTH = 1280
HEIGHT = 720
FPS = 24
DURATION_SECONDS = 10
FRAME_COUNT = FPS * DURATION_SECONDS


def make_background(width: int, height: int) -> Image.Image:
    """Create a dark blue-green radial/vertical gradient procedurally."""
    y, x = np.mgrid[0:height, 0:width]
    horizon = np.array([7.0, 18.0, 30.0])
    top = np.array([5.0, 13.0, 25.0])
    t = (y / max(height - 1, 1))[..., None]
    arr = top + (horizon - top) * t

    cx, cy = width * 0.51, height * 0.43
    dist = np.sqrt(((x - cx) / (width * 0.67)) ** 2 + ((y - cy) / (height * 0.82)) ** 2)
    glow = np.clip(1.0 - dist, 0.0, 1.0) ** 2
    arr += glow[..., None] * np.array([9.0, 27.0, 43.0])

    # A restrained vertical volumetric wash behind the portal opening.
    beam = np.exp(-(((x - width * 0.505) / (width * 0.16)) ** 2))
    beam *= np.clip(1.0 - np.abs(y - height * 0.43) / (height * 0.62), 0.0, 1.0)
    arr += beam[..., None] * np.array([4.0, 16.0, 25.0])

    floor_t = np.clip((y - height * 0.69) / (height * 0.31), 0.0, 1.0)
    arr += floor_t[..., None] * np.array([1.5, 5.0, 9.0])
    return Image.fromarray(np.uint8(np.clip(arr, 0, 255)), mode="RGB")


def arch_points(cx: float, base: float, rx: float, ry: float, width: int = 180) -> list[tuple[float, float]]:
    pts = []
    for theta in np.linspace(math.pi, 0.0, width):
        pts.append((cx + rx * math.cos(float(theta)), base - ry * math.sin(float(theta))))
    return pts


def draw_frame(base: Image.Image, frame_index: int) -> Image.Image:
    t = frame_index / FPS
    w, h = base.size
    # Slow, restrained forward camera move; deterministic over the 10-second clip.
    zoom = 1.0 + 0.035 * (t / DURATION_SECONDS)
    shift_x = 4.0 * math.sin(t * 0.22)
    shift_y = -1.8 * (t / DURATION_SECONDS)

    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    lines = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    ld = ImageDraw.Draw(lines)

    # Concentric glass arches recede toward a softly lit vanishing point.
    cx = w * 0.505 + shift_x
    base_y = h * 0.765 + shift_y
    for i in range(7):
        depth = i / 6.0
        rx = (w * (0.16 + 0.105 * i)) * zoom
        ry = (h * (0.28 + 0.075 * i)) * zoom
        pts = arch_points(cx, base_y, rx, ry)
        alpha = int(165 - 55 * depth)
        gd.line(pts, fill=(53, 196, 255, int(alpha * 0.72)), width=22 if i > 3 else 15)
        ld.line(pts, fill=(143, 235, 255, min(220, alpha + 55)), width=4 if i < 4 else 3)

        # A secondary inner edge gives each arch a glass-rim impression.
        inner_pts = arch_points(cx, base_y + 5, rx - 12 * zoom, ry - 10 * zoom)
        gd.line(inner_pts, fill=(140, 235, 255, int(alpha * 0.42)), width=12)
        ld.line(inner_pts, fill=(210, 250, 255, min(235, alpha + 45)), width=2)

    # Slim vertical glass reflections along the nearer structures.
    for side in (-1, 1):
        for j in range(3):
            x = cx + side * (w * (0.21 + j * 0.075)) * zoom
            top_y = h * (0.24 + 0.045 * j)
            bot_y = base_y + 8
            gd.line((x, top_y, x + side * 9, bot_y), fill=(71, 205, 248, 62), width=12)
            ld.line((x, top_y, x + side * 9, bot_y), fill=(177, 240, 255, 125), width=3)

    # Perspective floor traces, converging toward the centre of the arches.
    horizon_y = h * 0.735
    for k in range(-8, 9):
        x_end = cx + k * 14
        x_start = cx + k * 112
        gd.line((x_start, h, x_end, horizon_y), fill=(46, 172, 222, 34), width=9)
        ld.line((x_start, h, x_end, horizon_y), fill=(112, 215, 247, 70), width=2)
    for j in range(1, 8):
        y = horizon_y + (h - horizon_y) * (j / 8.0) ** 1.7
        gd.line((w * 0.08, y, w * 0.92, y), fill=(52, 174, 220, 17), width=5)
        ld.line((w * 0.08, y, w * 0.92, y), fill=(120, 219, 247, 30), width=1)

    # Small drifting light particles with deterministic mathematical motion.
    particle_count = 48
    for n in range(particle_count):
        px0 = (n * 97.31 + 31.0) % w
        py0 = (n * 53.77 + 17.0) % (h * 0.72)
        px = (px0 + 13.0 * math.sin(t * 0.42 + n * 0.71)) % w
        py = (py0 - (t * (4.5 + (n % 5)) + 5.0 * math.sin(t * 0.31 + n))) % (h * 0.74)
        r = 1.0 + (n % 3) * 0.45
        a = int(75 + 75 * (0.5 + 0.5 * math.sin(t * 0.8 + n)))
        gd.ellipse((px - r * 3, py - r * 3, px + r * 3, py + r * 3), fill=(86, 213, 255, int(a * 0.45)))
        ld.ellipse((px - r, py - r, px + r, py + r), fill=(204, 247, 255, a))

    # Soft centre light, pulsing very slightly without hard flashes.
    pulse = 0.92 + 0.08 * math.sin(t * math.pi * 0.55)
    cx0, cy0 = int(cx), int(h * 0.405)
    rr = int(58 * pulse)
    gd.ellipse((cx0 - rr * 3, cy0 - rr * 3, cx0 + rr * 3, cy0 + rr * 3), fill=(65, 200, 246, 58))
    gd.ellipse((cx0 - rr * 2, cy0 - rr * 2, cx0 + rr * 2, cy0 + rr * 2), outline=(105, 224, 255, 62), width=20)
    ld.ellipse((cx0 - rr, cy0 - rr, cx0 + rr, cy0 + rr), outline=(205, 249, 255, 185), width=3)

    glow = glow.filter(ImageFilter.GaussianBlur(18))
    frame = Image.alpha_composite(base.convert("RGBA"), glow)
    frame = Image.alpha_composite(frame, lines)
    return frame.convert("RGB")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def generate(output: Path) -> None:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg is required but was not found in PATH")
    output.parent.mkdir(parents=True, exist_ok=True)
    base = make_background(WIDTH, HEIGHT)
    command: Sequence[str] = [
        ffmpeg, "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{WIDTH}x{HEIGHT}", "-r", str(FPS), "-i", "-",
        "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        "-metadata", "title=NexaFilm Original Synthetic Test Asset",
        "-metadata", "comment=Procedurally generated abstract animation; no third-party media",
        str(output),
    ]
    proc = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    assert proc.stdin is not None
    try:
        for index in range(FRAME_COUNT):
            frame = draw_frame(base, index)
            proc.stdin.write(frame.tobytes())
        proc.stdin.close()
        stderr = proc.stderr.read().decode("utf-8", errors="replace") if proc.stderr else ""
        return_code = proc.wait()
        if return_code != 0:
            raise RuntimeError(f"ffmpeg failed with exit code {return_code}: {stderr[-3000:]}")
    except Exception:
        proc.kill()
        proc.wait()
        raise
    if not output.is_file() or output.stat().st_size < 100_000:
        raise RuntimeError("Output MP4 was not created correctly")
    print(f"OUTPUT={output}")
    print(f"SIZE_BYTES={output.stat().st_size}")
    print(f"SHA256={sha256_file(output)}")
    print(f"FRAMES={FRAME_COUNT}")
    print(f"DURATION_SECONDS={DURATION_SECONDS}")
    print(f"RESOLUTION={WIDTH}x{HEIGHT}")


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("nexafilm-original-test.mp4")
    generate(target)
