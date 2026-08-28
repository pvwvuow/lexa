#!/usr/bin/env python3
# کاوش ویکی‌نبشته: کدام قوانین با متن کامل موجودند؟
import json, urllib.request, urllib.parse, re, sys

API = "https://fa.wikisource.org/w/api.php"
UA = {"User-Agent": "HamyarHoquqQA/1.0 (educational law app; contact: local)"}

def api(params):
    params = dict(params, format="json")
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.load(r)

def search(q, limit=10):
    d = api({"action": "query", "list": "search", "srsearch": q, "srlimit": limit, "srnamespace": 0})
    return [h["title"] for h in d.get("query", {}).get("search", [])]

queries = [
    "قانون مدنی",
    "قانون تجارت",
    "قانون مجازات اسلامی",
    "قانون آیین دادرسی مدنی",
    "قانون آیین دادرسی کیفری",
    "قانون اساسی",
    "قانون کار",
    "قانون حمایت خانواده",
]
out = {}
for q in queries:
    titles = search(q, 8)
    out[q] = titles
    print(f"\n== {q}")
    for t in titles:
        print("  -", t)

with open("/tmp/wikisource-search.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
