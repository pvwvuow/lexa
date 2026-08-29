#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""سرصفحهٔ هر صفحه با ترتیب مکانی درست (اسپن‌ها مرتب بر اساس Y)"""
import fitz, re, sys

def page_headline(doc, pno, n=4):
    d = doc[pno].get_text("dict")
    spans = []
    for b in d["blocks"]:
        if b.get("type") != 0:
            continue
        for l in b["lines"]:
            txt = "".join(s["text"] for s in l["spans"]).strip()
            if txt:
                spans.append((round(l["bbox"][1], 1), round(l["bbox"][0], 1), txt))
    spans.sort(key=lambda t: (t[0], -t[1]))
    out = []
    for y, x, t in spans[:n]:
        t = re.sub(r"\s+", " ", t)
        out.append(t)
    return " | ".join(out)

if __name__ == "__main__":
    path = sys.argv[1]
    doc = fitz.open(path)
    skip = re.compile(r"(Telegram|جهت دریافت|mollakarimi|vekalatyar|آزمون های حقوقی|درخواست تان)", re.I)
    for pno in range(len(doc)):
        h = page_headline(doc, pno)
        h = ";".join(x for x in h.split(" | ") if not skip.search(x))
        print(f"p{pno+1:>3}: {h[:150]}")
