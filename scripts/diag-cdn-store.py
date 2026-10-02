#!/usr/bin/env python3
"""بررسی موازی وجود فایل‌های دلتای 0.6.0→0.7.0 روی CDN"""
import json, urllib.request, sys
from concurrent.futures import ThreadPoolExecutor

REPO = "pvwvuow/lexa"

def fetch(url, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": "lexa-diag"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

m060 = json.loads(fetch(f"https://cdn.jsdelivr.net/gh/{REPO}@app-v0.6.0/updates/app/manifest.json"))
m070 = json.load(open("/tmp/feed-main.json"))

local = {}
for p, e in m060["files"].items():
    local[p] = str(e[0])

check = []
for p, e in m070["files"].items():
    h = str(e[0])
    if h.startswith("link:"):
        continue
    if local.get(p) != h:
        check.append((p, h, e[1]))
print("delta files to verify:", len(check))

def probe(item):
    p, h, s = item
    name = h[:12] + ".bin"
    for base in [f"https://cdn.jsdelivr.net/gh/{REPO}@app-v0.7.0/updates/app/f/"]:
        try:
            req = urllib.request.Request(base + name, method="HEAD", headers={"User-Agent": "lexa-diag"})
            r = urllib.request.urlopen(req, timeout=30)
            if r.status == 200:
                return None
        except urllib.error.HTTPError as ex:
            if ex.code == 404:
                return (p, name, "404")
        except Exception as ex:
            return (p, name, str(ex)[:60])
    return (p, name, "all-sources-failed")

missing = []
with ThreadPoolExecutor(max_workers=16) as pool:
    for i, res in enumerate(pool.map(probe, check)):
        if res:
            missing.append(res)
        if (i + 1) % 100 == 0:
            print(f"  ...{i+1}/{len(check)}")

print("MISSING:", len(missing))
for m in missing[:20]:
    print("  ", m)
over = [(p, s) for p, h, s in check if s > 24 * 1024 * 1024]
print("files over 24MB cap:", over)
print("VERDICT:", "delta store کامل است" if not missing else "delta store ناقص!")
