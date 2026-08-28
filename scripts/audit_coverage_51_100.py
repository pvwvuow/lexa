#!/usr/bin/env python3
"""Coverage audit for pages 51-100 of the Jaza part 3 booklet."""
import re
from pathlib import Path

OCR_DIR = Path("/home/z/my-project/scripts/extracted/ocr")
COURSE_DIR = Path("/home/z/my-project/src/lib/law/courses")

ocr = "\n".join((OCR_DIR / f"p{n:03d}.txt").read_text(encoding="utf-8") for n in range(51, 101))

course_text = "\n".join(
    p.read_text(encoding="utf-8")
    for p in sorted(COURSE_DIR.glob("jaza-g-ch5.ts")) + sorted(COURSE_DIR.glob("jaza-g-ch6.ts")) + sorted(COURSE_DIR.glob("jaza-g-ch7.ts"))
)

notkhe = set()
mesal = set()
test = set()
for m in re.finditer(r"نکته\s*[-–]?\s*([۰-۹0-9]+(?:/[۰-۹0-9]+)?)", ocr):
    notkhe.add(m.group(1))
for m in re.finditer(r"مثال\s*[-–]?\s*([۰-۹0-9]+)", ocr):
    s = m.group(1)
    fa = "۰۱۲۳۴۵۶۷۸۹"
    out = "".join(str(fa.index(c)) if c in fa else c for c in s)
    if out.isdigit():
        mesal.add(int(out))
for m in re.finditer(r"تست\s*[-–]?\s*([۰-۹0-9]+)", ocr):
    s = m.group(1)
    fa = "۰۱۲۳۴۵۶۷۸۹"
    out = "".join(str(fa.index(c)) if c in fa else c for c in s)
    if out.isdigit() and 13 <= int(out) <= 31:
        test.add(int(out))

def fa_num(n):
    fa = "۰۱۲۳۴۵۶۷۸۹"
    return "".join(fa[int(d)] for d in str(n))

missing_notkhe = [n for n in sorted(notkhe) if n not in course_text]
missing_mesal = [n for n in sorted(mesal) if f"مثال {fa_num(n)}" not in course_text]
missing_test = [n for n in sorted(test) if f"تست {fa_num(n)}" not in course_text]

print("نکته‌های ۵۱-۱۰۰:", sorted(notkhe))
print("MISSING نکته:", missing_notkhe if missing_notkhe else "NONE ✓")
print("مثال‌های ۵۱-۱۰۰:", sorted(mesal))
print("MISSING مثال:", missing_mesal if missing_mesal else "NONE ✓")
print("تست‌های ۱۳-۳۱:", sorted(test))
print("MISSING تست:", missing_test if missing_test else "NONE ✓")

statutes = ["مادهٔ ۱۲", "مادهٔ ۱۳", "مادهٔ ۱۴", "مادهٔ ۱۵", "مادهٔ ۱۶", "مادهٔ ۱۷", "مادهٔ ۱۸",
            "مادهٔ ۱۹", "مادهٔ ۲۰", "مادهٔ ۲۱", "مادهٔ ۲۲", "مادهٔ ۲۳", "مادهٔ ۲۴", "مادهٔ ۲۵",
            "مادهٔ ۲۶", "مادهٔ ۲۷", "مادهٔ ۲۸", "مادهٔ ۸۷", "مادهٔ ۹۵", "مادهٔ ۱۴۱", "مادهٔ ۱۴۲",
            "مادهٔ ۱۴۳", "مادهٔ ۲۹۶", "مادهٔ ۴۸۵", "مادهٔ ۴۸۶", "مادهٔ ۵۷۰", "مادهٔ ۶۳۵", "مادهٔ ۶۷۷",
            "مادهٔ ۶۹۴", "مادهٔ ۷۴۷", "مادهٔ ۷۴۸", "رأی وحدت رویهٔ ۷۴۴", "رأی وحدت رویهٔ ۷۵۹"]
missing_statutes = [s for s in statutes if s not in course_text]
print("MISSING مواد/آرا:", missing_statutes if missing_statutes else "NONE ✓")
