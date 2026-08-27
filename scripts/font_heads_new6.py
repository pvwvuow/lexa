#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""استخراج سرفصل‌ها بر اساس اندازهٔ فونت + رسم نقشهٔ فصل‌ها"""
import fitz, re, os, unicodedata, collections

BASE = "/home/z/my-project/assets/new2025"
FILES = {
    "Private-Criminal-law.pdf": "keifari-khasosi",
    "Public-Criminal-law.pdf": "keifari-omumi",
    "Public-International-Law-1.pdf": "beynolmelal-omumi-1",
    "Public-International-Law-2.pdf": "beynolmelal-omumi-2",
    "Public-International-Law-3.pdf": "beynolmelal-omumi-3",
    "Private-International-Law-1.pdf": "beynolmelal-khososi-1",
}

skip_pat = re.compile(r"(Telegram|جهت دریافت|mollakarimi|www\.|Instagram|@Omid)", re.I)

for fname, slug in FILES.items():
    doc = fitz.open(os.path.join(BASE, fname))
    print(f"\n══════════════ {slug} ══════════════")
    # توزیع اندازهٔ فونت برای یافتن آستانهٔ عنوان
    sizes = collections.Counter()
    for pno in range(len(doc)):
        d = doc[pno].get_text("dict")
        for b in d.get("blocks", []):
            for l in b.get("lines", []):
                for s in l.get("spans", []):
                    txt = unicodedata.normalize("NFKC", s["text"]).strip()
                    if len(txt) >= 3:
                        sizes[round(s["size"])] += len(txt)
    common = sorted(sizes.items(), key=lambda kv: -kv[1])[:6]
    print("font-size histogram (size, chars):", common)
    body_size = common[0][0]
    head_min = body_size + 1.0
    for pno in range(len(doc)):
        d = doc[pno].get_text("dict")
        for b in d.get("blocks", []):
            for l in b.get("lines", []):
                spans = l.get("spans", [])
                if not spans:
                    continue
                txt = unicodedata.normalize("NFKC", "".join(s["text"] for s in spans)).strip()
                maxsz = max(s["size"] for s in spans)
                if len(txt) >= 4 and len(txt) <= 110 and maxsz >= head_min:
                    if skip_pat.search(txt):
                        continue
                    print(f"p{pno+1:>4} [{maxsz:.0f}] {txt[:100]}")
