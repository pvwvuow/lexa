#!/usr/bin/env python3
"""Sidecar: transcribe a WAV (any ffmpeg-readable file) with Whisper large-v3-turbo.
Usage: python3 transcribe.py <audiofile>  ->  prints Persian transcript to stdout."""
import subprocess
import sys

import numpy as np
from faster_whisper import WhisperModel

MODEL_REPO = "deepdml/faster-whisper-large-v3-turbo-ct2"


def load(path: str) -> np.ndarray:
    """Decode audio to 16kHz mono float32 via ffmpeg (bypasses PyAV)."""
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-ar", "16000", "-ac", "1",
         "-f", "s16le", "pipe:1"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0


def main() -> None:
    audio = load(sys.argv[1])
    model = WhisperModel(MODEL_REPO, device="cpu", compute_type="int8", cpu_threads=2)
    try:
        import onnxruntime  # noqa: F401

        kwargs = {"vad_filter": True}
    except ImportError:
        kwargs = {}
    segments, _ = model.transcribe(audio, language="fa", beam_size=1, **kwargs)
    text = " ".join(s.text.strip() for s in segments).strip()
    print(text)


if __name__ == "__main__":
    main()
