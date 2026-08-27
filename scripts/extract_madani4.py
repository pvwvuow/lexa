#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""استخراج کامل متن مدنی ۴ با PyMuPDF + شماره صفحه"""
import fitz, re

SRC = "/home/z/my-project/assets/madani4/Madani-4.pdf"
OUT = "/home/z/my-project/assets/madani4/madani4-fit.txt"

doc = fitz.open(SRC)
out_lines = []
for pno in range(len(doc)):
    out_lines.append(f"\n########## [صفحهٔ PDF {pno+1}] ##########")
    t = doc[pno].get_text("text")
    # حذف خطوط فوتر تکراری (تبلیغ)
    lines = []
    skip_pat = re.compile(r"(Telegram Channel|جهت دریافت|رسان|mollakarimi\.ir)", re.I)
    buf = []
    for ln in t.split("\n"):
        if skip_pat.search(ln):
            continue
        buf.append(ln)
    out_lines.extend(buf)

with open(OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(out_lines))
print("saved", OUT, len(out_lines), "lines")

# پیدا کردن سرفصل‌های احتمالی
with open(OUT, encoding="utf-8") as f:
    txt = f.read()

pat = re.compile(r"^[\s]*(فصل\s+[اآ]ول|فصل\s+دوم|فصل\s+سوم|فصل\s+چهارم|فصل\s+پنجم|فصل\s+ششم|فصل\s+[1-6])[\sـ\-]*.*$")
for i, ln in enumerate(txt.split("\n")):
    s = ln.strip()
    if re.match(r"^فصل\s+", s) or ("نظریۀ" in s[:20]):
        print(f"{i}: {s[:90]}")
