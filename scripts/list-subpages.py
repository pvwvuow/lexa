#!/usr/bin/env python3
# فهرست زیرصفحه‌ها + پروب سریع چند قانون
import sys, time
sys.path.insert(0, "/home/z/my-project/scripts")
from fetch-laws import get_subpages, get_wikitext, extract_articles, to_fa

for prefix in ["قانون مدنی ۱۳۷۶", "قانون مدنی ۱۳۱۳", "قانون اساسی جمهوری اسلامی", "قانون کار", "آیین دادرسی", "حمایت خانواده", "مجازات اسلامی"]:
    pages = get_subpages(prefix)
    print(f"\n== prefix «{prefix}»: {len(pages)} pages")
    for p in pages[:14]:
        print("  ·", p)
    if len(pages) > 14:
        print("  …", len(pages) - 14, "more")
    time.sleep(1.5)
