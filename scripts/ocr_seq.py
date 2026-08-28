#!/usr/bin/env python3
"""Sequential (1 worker) OCR for Jaza booklet — skips pages whose .txt already exists.
Usage: python3 ocr_seq.py START END
"""
import os
import subprocess
import sys

PDF = "/home/z/my-project/upload/جزوه کامل تدریس جزا- احمد غفوری.pdf"
OUT_DIR = "/home/z/my-project/scripts/extracted/ocr"
IMG_DIR = os.path.join(OUT_DIR, "imgs")
TESS_ENV = {**os.environ, "TESSDATA_PREFIX": "/home/z/my-project/scripts/tessdata"}

os.makedirs(IMG_DIR, exist_ok=True)

start = int(sys.argv[1])
end = int(sys.argv[2])

for p in range(start, end + 1):
    txt_path = os.path.join(OUT_DIR, f"p{p:03d}.txt")
    if os.path.exists(txt_path) and os.path.getsize(txt_path) > 100:
        print(f"page {p}: exists, skip", flush=True)
        continue
    img = os.path.join(IMG_DIR, f"p{p:03d}.png")
    if not os.path.exists(img):
        subprocess.run(
            ["pdftoppm", "-f", str(p), "-l", str(p), "-r", "300", "-png",
             "-singlefile", PDF, img[:-4]],
            check=True, capture_output=True)
    r = subprocess.run(
        ["tesseract", img, "stdout", "-l", "fas", "--psm", "6"],
        env=TESS_ENV, capture_output=True, text=True)
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(r.stdout)
    print(f"page {p}: {len(r.stdout)} chars", flush=True)

print("done", flush=True)
