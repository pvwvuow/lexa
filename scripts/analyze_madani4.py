#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""تحلیل ساختار جزوه مدنی ۴ برای فصل‌بندی"""
import re

SRC = "/home/z/my-project/assets/madani4/madani4-raw.txt"

with open(SRC, encoding="utf-8") as f:
    raw = f.read()

# حذف کاراکترهای کنترل RTL/LTR جهت خوانایی بهتر
clean = re.sub(r'[\u200e\u200f\u202a-\u202e\u2066-\u2069]', '', raw)

lines = clean.split('\n')
print(f"تعداد خطوط: {len(lines)}")

# الگوهای احتمالی سرفصل
patterns = [
    (r'^\s*فصل\s+[-ـ]?\s*(\S+)', 'فصل'),
    (r'مبحث', 'مبحث'),
    (r'گفتار', 'گفتار'),
    (r'^\s*ماده\s*[ـ\-]?\s*(\d{1,4})', 'ماده'),
]
for i, ln in enumerate(lines[:120]):
    s = ln.strip()
    if s:
        print(f"{i}: {s[:100]}")
print("\n===== جستجوی «فصل ...» =====")
for i, ln in enumerate(lines):
    if 'فصل' in ln and i < 500:
        print(f"{i}: {ln.strip()[:110]}")
