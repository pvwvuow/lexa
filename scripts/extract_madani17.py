#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""استخراج کامل متن مدنی ۱ و مدنی ۷ با PyMuPDF + شماره صفحه"""
import fitz, re, os

JOBS = [
    ("/home/z/my-project/assets/Madani-1.pdf", "/home/z/my-project/assets/madani1/madani1-fit.txt"),
    ("/home/z/my-project/assets/Madani-7.pdf", "/home/z/my-project/assets/madani7/madani7-fit.txt"),
]
skip_pat = re.compile(r"(Telegram Channel|جهت دریافت|رسان|mollakarimi\.ir|@omidmollakarimi|www\.MollaKarimi)", re.I)

for SRC, OUT in JOBS:
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    doc = fitz.open(SRC)
    out_lines = []
    for pno in range(len(doc)):
        out_lines.append(f"\n########## [صفحهٔ PDF {pno+1}] ##########")
        t = doc[pno].get_text("text")
        for ln in t.split("\n"):
            if skip_pat.search(ln):
                continue
            out_lines.append(ln)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(out_lines))
    print("saved", OUT, len(out_lines), "lines,", len(doc), "pages")

# سرفصل‌های احتمالی هر فایل برای نقشهٔ محتوا
for _, OUT in JOBS:
    with open(OUT, encoding="utf-8") as f:
        lines = f.read().split("\n")
    print("\n==== سرفصل‌های", OUT, "====")
    for i, ln in enumerate(lines):
        s = ln.strip()
        if not s:
            continue
        if (re.match(r"^فصل\s+", s) or re.match(r"^(مبحث|گفتار|بخش)\s+", s)) and len(s) < 100:
            print(f"{i}: {s}")
