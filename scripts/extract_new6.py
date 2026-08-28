#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""استخراج متن ۶ جزوهٔ جدید ملاکریمی + فهرست سرفصل‌ها"""
import fitz, re, os, unicodedata

BASE = "/home/z/my-project/assets/new2025"
FILES = {
    "Private-Criminal-law.pdf": "keifari-khasosi",
    "Public-Criminal-law.pdf": "keifari-omumi",
    "Public-International-Law-1.pdf": "beynolmelal-omumi-1",
    "Public-International-Law-2.pdf": "beynolmelal-omumi-2",
    "Public-International-Law-3.pdf": "beynolmelal-omumi-3",
    "Private-International-Law-1.pdf": "beynolmelal-khososi-1",
}

skip_pat = re.compile(r"(Telegram Channel|جهت دریافت|رسان|mollakarimi\.ir|www\.)", re.I)

for fname, slug in FILES.items():
    src = os.path.join(BASE, fname)
    out = os.path.join(BASE, slug + ".txt")
    doc = fitz.open(src)
    lines = []
    for pno in range(len(doc)):
        lines.append(f"\n########## [صفحهٔ {pno+1}] ##########")
        t = unicodedata.normalize("NFKC", doc[pno].get_text("text"))
        for ln in t.split("\n"):
            if skip_pat.search(ln):
                continue
            lines.append(ln)
    with open(out, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"{fname}: pages={len(doc)} -> {slug}.txt ({sum(len(x) for x in lines)} chars)")
