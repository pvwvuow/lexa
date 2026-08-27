#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""شناسایی سرصفحه‌های واقعی با فونت بزرگ"""
import fitz, re, sys
from collections import Counter

path = sys.argv[1]
doc = fitz.open(path)
sizes = Counter()
page_spans = []
for pno in range(len(doc)):
    d = doc[pno].get_text("dict")
    for b in d["blocks"]:
        if b.get("type") != 0:
            continue
        for l in b["lines"]:
            for s in l["spans"]:
                t = re.sub(r"\s+", "", s["text"])
                if len(t) >= 2:
                    sizes[round(s["size"], 1)] += len(t)
    page_spans.append(d)

big = max(sizes.items(), key=lambda kv: kv[1])[0]
print("dominant size:", big)
skip = re.compile(r"(Telegram|جهت دریافت|mollakarimi|vekalatyar|آزمون های حقوقی|جزوه حقوق|دکتر)", re.I)

for pno, d in enumerate(page_spans):
    rows = []
    for b in d["blocks"]:
        if b.get("type") != 0:
            continue
        for l in b["lines"]:
            for s in l["spans"]:
                sz = round(s["size"], 1)
                t = re.sub(r"\s+", " ", s["text"]).strip()
                if sz > big + 0.5 and t and not skip.search(t):
                    rows.append((round(l["bbox"][1], 0), sz, t))
    if rows:
        rows.sort()
        merged = []
        for y, sz, t in rows:
            if merged and abs(merged[-1][0] - y) < 14:
                merged[-1] = (y, max(sz, merged[-1][1]), merged[-1][2] + " " + t)
            else:
                merged.append((y, sz, t))
        for y, sz, t in merged:
            if len(t) < 90:
                print(f"p{pno+1:>3} y{int(y):>4} [{sz}] {t}")
