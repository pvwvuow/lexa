#!/usr/bin/env python3
"""Transcribe the Persian demo samples with faster-whisper large-v3-turbo."""
import subprocess
import time

import numpy as np
from faster_whisper import WhisperModel


def load(path: str) -> np.ndarray:
    """Decode audio to 16kHz mono float32 via ffmpeg (bypasses PyAV)."""
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-ar", "16000", "-ac", "1",
         "-f", "s16le", "pipe:1"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0

REPOS = [
    "deepdml/faster-whisper-large-v3-turbo-ct2",
    "mobiuslabsgmbh/faster-whisper-large-v3-turbo-ct2",
    "Systran/faster-whisper-large-v3",
]

model = None
for repo in REPOS:
    try:
        t0 = time.time()
        print(f"loading {repo} ...", flush=True)
        model = WhisperModel(repo, device="cpu", compute_type="int8", cpu_threads=2)
        print(f"loaded in {time.time()-t0:.0f}s", flush=True)
        break
    except Exception as e:  # noqa: BLE001
        print(f"  failed: {e}", flush=True)

if model is None:
    raise SystemExit("ALL-REPOS-FAILED")

with open("/home/z/my-project/asr-demo/ground_truth.txt", encoding="utf-8") as f:
    gt = f.read().strip()

for name in ["clean.wav", "noisy.wav"]:
    path = f"/home/z/my-project/asr-demo/{name}"
    audio = load(path)
    t0 = time.time()
    segments, _ = model.transcribe(audio, language="fa", beam_size=1)
    text = " ".join(s.text.strip() for s in segments)
    dt = time.time() - t0
    print(f"\n=== WHISPER [{name}] (audio {len(audio)/16000:.0f}s, took {dt:.0f}s) ===")
    print(text)
