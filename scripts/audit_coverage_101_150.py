#!/usr/bin/env python3
"""Coverage audit for pages 101-150 of the Jaza booklet (Ghafoori)."""
import re
from pathlib import Path

OCR_DIR = Path("/home/z/my-project/scripts/extracted/ocr")
COURSE_DIR = Path("/home/z/my-project/src/lib/law/courses")
PACK_DIR = Path("/home/z/my-project/src/lib/law/exam-packs")

ocr = "\n".join((OCR_DIR / f"p{n:03d}.txt").read_text(encoding="utf-8") for n in range(101, 151))

course_text = "\n".join(
    (COURSE_DIR / f).read_text(encoding="utf-8")
    for f in ["jaza-g-ch8.ts", "jaza-g-ch9.ts", "jaza-g-ch10.ts", "jaza-g-ch11.ts", "tadris-jaza.ts"]
)
pack_text = "\n".join(
    (PACK_DIR / f).read_text(encoding="utf-8")
    for f in ["mcq-jaza-ghafoori-3.ts", "desc-jaza-ghafoori-3.ts"]
)
all_text = course_text + pack_text

FA = "۰۱۲۳۴۵۶۷۸۹"


def to_en(s):
    return "".join(str(FA.index(c)) if c in FA else c for c in s)


def fa_num(n):
    return "".join(FA[int(d)] for d in str(n))


notkhe = sorted(set(re.findall(r"نکته\s*[-–]?\s*([۰-۹0-9]+)", ocr)), key=int)
mesal = sorted(set(int(to_en(x)) for x in re.findall(r"مثال\s*[-–]?\s*([۰-۹0-9]+)", ocr) if to_en(x).isdigit()))
tast = sorted(set(int(to_en(x)) for x in re.findall(r"تست\s*[-–]?\s*([۰-۹0-9]+)", ocr) if to_en(x).isdigit()))

missing_notkhe = [n for n in notkhe if n not in course_text]
missing_mesal = [n for n in mesal if f"مثال {fa_num(n)}" not in all_text]
missing_tast = [n for n in tast if f"تست {fa_num(n)}" not in all_text]

print("نکته‌های ۱۰۱-۱۵۰:", notkhe)
print("MISSING نکته:", missing_notkhe if missing_notkhe else "NONE ✓")
print("مثال‌های ۱۰۱-۱۵۰:", mesal)
print("MISSING مثال:", missing_mesal if missing_mesal else "NONE ✓")
print("تست‌های ۱۰۱-۱۵۰:", tast)
print("MISSING تست:", missing_tast if missing_tast else "NONE ✓")

statutes = ["مادهٔ ۲۸", "مادهٔ ۲۹", "مادهٔ ۳۰", "مادهٔ ۳۱", "مادهٔ ۳۲", "مادهٔ ۳۳", "مادهٔ ۳۴",
            "مادهٔ ۳۵", "مادهٔ ۳۶", "مادهٔ ۳۷", "مادهٔ ۳۸", "مادهٔ ۳۹", "مادهٔ ۴۰", "مادهٔ ۴۱",
            "مادهٔ ۴۲", "مادهٔ ۴۳", "مادهٔ ۴۵", "مادهٔ ۴۶", "مادهٔ ۴۷", "مادهٔ ۴۸", "مادهٔ ۴۹",
            "مادهٔ ۵۰", "مادهٔ ۵۲", "مادهٔ ۵۳", "مادهٔ ۵۵", "مادهٔ ۵۶", "مادهٔ ۵۷", "مادهٔ ۵۸",
            "مادهٔ ۵۹", "مادهٔ ۶۱", "مادهٔ ۶۲", "مادهٔ ۶۴", "مادهٔ ۶۵", "مادهٔ ۶۶", "مادهٔ ۶۷",
            "مادهٔ ۶۸", "مادهٔ ۶۹", "مادهٔ ۷۰", "مادهٔ ۷۱", "مادهٔ ۷۲", "مادهٔ ۷۳", "مادهٔ ۷۵",
            "مادهٔ ۳۲۷", "مادهٔ ۹۳", "مادهٔ ۱۱۵", "مادهٔ ۵۰۶", "مادهٔ ۵۵۴", "مادهٔ ۷۱۹",
            "مادهٔ ۵۱۵", "مادهٔ ۵۱۶", "مادهٔ ۵۲۹", "مادهٔ ۵۰۱", "مادهٔ ۵۰۲", "مادهٔ ۵۵۲",
            "مادهٔ ۸۱", "مادهٔ ۸۲", "مادهٔ ۶۳۸", "مادهٔ ۶۳۹", "مادهٔ ۶۴۰",
            "وحدت رویهٔ ۷۴۶", "وحدت رویهٔ ۷۷۸", "مادهٔ ۶۰ قانون مبارزه با قاچاق", "مادهٔ ۶۳ قانون مبارزه با قاچاق"]
missing_statutes = [s for s in statutes if s not in all_text]
print("MISSING مواد/آرا:", missing_statutes if missing_statutes else "NONE ✓")

# Lesson coverage: every OCR page range should be cited in some منبع section
for n in range(101, 151):
    fa = fa_num(n)
    if fa not in course_text:
        print(f"MISSING page citation: {fa}")
print("page citation check done")
