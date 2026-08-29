#!/usr/bin/env python3
"""Coverage audit: every نکته/مثال/تست from pages 1-50 must appear in the course files."""
import re
from pathlib import Path

OCR_DIR = Path("/home/z/my-project/scripts/extracted/ocr")
COURSE_DIR = Path("/home/z/my-project/src/lib/law/courses")

# Concatenate OCR text of pages 1-50
ocr = "\n".join((OCR_DIR / f"p{n:03d}.txt").read_text(encoding="utf-8") for n in range(1, 51))

# Course content
course_text = "\n".join(
    p.read_text(encoding="utf-8")
    for p in sorted(COURSE_DIR.glob("jaza-g-*.ts"))
) + (COURSE_DIR / "tadris-jaza.ts").read_text(encoding="utf-8")

def fa2int(s):
    fa = "۰۱۲۳۴۵۶۷۸۹"
    out = ""
    for c in s:
        if c in fa:
            out += str(fa.index(c))
        elif c.isdigit():
            out += c
    return int(out) if out else -1

# Extract noted items
notkhe = set()
mesal = set()
test = set()
for m in re.finditer(r"نکته\s*[-–]?\s*([۰-۹0-9]+(?:/[۰-۹0-9]+)?)", ocr):
    notkhe.add(m.group(1))
for m in re.finditer(r"مثال\s*[-–]?\s*([۰-۹0-9]+)", ocr):
    mesal.add(fa2int(m.group(1)))
for m in re.finditer(r"تست\s*[-–]?\s*([۰-۹0-9]+)", ocr):
    test.add(fa2int(m.group(1)))

def has_in_course(label, num):
    # course files use both Persian and other forms
    return f"{label} {num}" in course_text or f"{label} {num}" in course_text

def fa_num(n):
    """Convert int to Persian digit string as used in course files (e.g. ۲۲)."""
    fa = "۰۱۲۳۴۵۶۷۸۹"
    return "".join(fa[int(d)] for d in str(n))

missing_notkhe = [n for n in sorted(notkhe) if n not in course_text]
missing_mesal = [n for n in sorted(mesal) if f"مثال {fa_num(n)}" not in course_text]
missing_test = [n for n in sorted(test) if f"تست {fa_num(n)}" not in course_text]

print("نکته‌های جزوه (pages 1-50):", sorted(notkhe))
print("MISSING نکته:", missing_notkhe if missing_notkhe else "NONE ✓")
print()
print("مثال‌های جزوه:", sorted(mesal))
print("MISSING مثال:", missing_mesal if missing_mesal else "NONE ✓")
print()
print("تست‌های جزوه:", sorted(test))
print("MISSING تست:", missing_test if missing_test else "NONE ✓")
print()

# Key statutes check
statutes = ["مادهٔ ۱", "مادهٔ ۲", "مادهٔ ۳", "مادهٔ ۴", "مادهٔ ۵", "مادهٔ ۶", "مادهٔ ۷", "مادهٔ ۸", "مادهٔ ۹",
            "مادهٔ ۱۰", "مادهٔ ۱۱", "مادهٔ ۱۲", "مادهٔ ۲۲۰", "مادهٔ ۲۷۹", "مادهٔ ۳۸", "مادهٔ ۱۴۴", "مادهٔ ۱۴۵",
            "مادهٔ ۵۱۳", "مادهٔ ۶۰۸", "مادهٔ ۶۹۸", "مادهٔ ۴۹۸", "مادهٔ ۴۹۹ مکرر", "مادهٔ ۵۵۴", "مادهٔ ۵۶۰", "مادهٔ ۷۴۵",
            "رأی وحدت رویهٔ ۷۵۶", "رأی وحدت رویهٔ ۸۲۲"]
missing_statutes = [s for s in statutes if s not in course_text]
print("MISSING مواد/آرا:", missing_statutes if missing_statutes else "NONE ✓")
