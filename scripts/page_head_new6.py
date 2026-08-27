#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""نمایش دو خط نخست هر صفحه برای درک ساختار جزوه‌ها"""
import re, os, sys

BASE = "/home/z/my-project/assets/new2025"
slug = sys.argv[1]
path = os.path.join(BASE, slug + ".txt")
cur_page = 0
buf = []
def flush(cur):
    if buf:
        joined = " | ".join(x[:60] for x in buf[:3])
        print(f"p{cur:>4}: {joined}")

with open(path, encoding="utf-8") as f:
    for ln in f:
        m = re.match(r"###+ \[صفحهٔ (\d+)\]", ln)
        if m:
            flush(cur_page)
            cur_page = int(m.group(1))
            buf = []
            continue
        s = ln.strip()
        if s and len(s) > 3 and not s.isdigit():
            buf.append(s)
flush(cur_page)
