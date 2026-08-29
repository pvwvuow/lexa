#!/usr/bin/env python3
"""OCR first N pages of the Jaza part 3 PDF (Persian, RTL)."""
import os
import subprocess
import sys
from concurrent.futures import ProcessPoolExecutor

PDF = "/home/z/my-project/upload/جزوه کامل تدریس جزا- احمد غفوری.pdf"
OUT_DIR = "/home/z/my-project/scripts/extracted/ocr"
IMG_DIR = os.path.join(OUT_DIR, "imgs")
TESS_ENV = {**os.environ, "TESSDATA_PREFIX": "/home/z/my-project/scripts/tessdata"}

os.makedirs(IMG_DIR, exist_ok=True)

start = int(sys.argv[1]) if len(sys.argv) > 1 else 1
end = int(sys.argv[2]) if len(sys.argv) > 2 else 50


def ocr_page(p):
    img = os.path.join(IMG_DIR, f"p{p:03d}.png")
    txt_path = os.path.join(OUT_DIR, f"p{p:03d}.txt")
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
    return p, len(r.stdout)


pages = list(range(start, end + 1))
with ProcessPoolExecutor(max_workers=4) as ex:
    for p, n in ex.map(ocr_page, pages):
        print(f"page {p}: {n} chars", flush=True)
print("done")
