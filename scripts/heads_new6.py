#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""پیدا کردن سرفصل‌های بالقوه در هر جزوهٔ جدید"""
import re, os

BASE = "/home/z/my-project/assets/new2025"
FILES = ["keifari-khasosi", "keifari-omumi", "beynolmelal-omumi-1",
         "beynolmelal-omumi-2", "beynolmelal-omumi-3", "beynolmelal-khososi-1"]

HEAD_PAT = re.compile(r"^\s*(?:[:.،]*)(جلسه\s+|بخش\s+(?:[اآ]ول|دوم|سوم|چهارم|پنجم|ششم|هفتم|هشتم|نهم|دهم)|فصل\s+(?:[اآ]ول|دوم|سوم|چهارم|پنجم|ششم|هفتم|هشتم|نهم|دهم)|درس\s+|مبحث\s+)")

for slug in FILES:
    path = os.path.join(BASE, slug + ".txt")
    print(f"\n══════════ {slug} ══════════")
    cur_page = 0
    with open(path, encoding="utf-8") as f:
        for i, ln in enumerate(f):
            m = re.match(r"###+ \[صفحهٔ (\d+)\]", ln)
            if m:
                cur_page = int(m.group(1))
                continue
            s = ln.strip()
            if len(s) < 4 or len(s) > 90:
                continue
            if HEAD_PAT.search(s):
                print(f"p{cur_page:>4} L{i:>6}: {s[:85]}")
