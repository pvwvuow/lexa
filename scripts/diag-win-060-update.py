#!/usr/bin/env python3
"""شبیه‌سازی وضعیت کاربر ویندوزی v0.6.0 با مانیفست 0.6.0 — دیف با فید زنده 0.7.0"""
import json, hashlib, urllib.request, sys

REPO = "pvwvuow/lexa"

def fetch(url, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": "lexa-diag"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

m060 = json.loads(fetch(f"https://cdn.jsdelivr.net/gh/{REPO}@app-v0.6.0/updates/app/manifest.json"))
print("0.6.0 manifest version:", m060["version"], "files:", len(m060["files"]))
m070 = json.load(open("/tmp/feed-main.json"))
print("0.7.0 manifest version:", m070["version"], "files:", len(m070["files"]))

# وضعیت محلی کاربر ویندوز 0.6.0:
#  - همهٔ entryها همان‌طور که در مانیفست 0.6.0 هستند (محتوای نصب‌شده)
#  - entryهای link: در ویندوز به‌صورت فایل متنیِ حاوی مسیر هدف استخراج می‌شوند
local = {}
for p, e in m060["files"].items():
    h = str(e[0])
    if h.startswith("link:"):
        local[p] = hashlib.sha256(h[5:].encode()).hexdigest()  # فایل واقعی متنی
    else:
        local[p] = h

to_download, to_delete = [], []
for p, e in m070["files"].items():
    lh = local.get(p)
    if lh is None or lh != e[0]:
        to_download.append((p, e[0], e[1]))
for p in local:
    if p not in m070["files"]:
        to_delete.append(p)

print(f"toDownload: {len(to_download)}  toDelete: {len(to_delete)}")
link_dl = [p for p, h, s in to_download if str(h).startswith("link:")]
print("link: entries in toDownload:", link_dl)
total = sum(s for _, h, s in to_download if not str(h).startswith("link:"))
print("download bytes (بدون link):", round(total / 1e6, 2), "MB")

# آپدیتر برای link entry چه URLی می‌سازد؟
if link_dl:
    h = next(e for p, e in m070["files"].items() if p == link_dl[0])[0]
    print("URL ساخته‌شده برای link entry:", f"https://cdn.jsdelivr.net/gh/{REPO}@app-v0.7.0/updates/app/f/{h[:12]}.bin")

# بررسی وجود همهٔ فایل‌های لازم روی CDN
missing = []
check = [x for x in to_download if not str(x[1]).startswith("link:")]
print("checking", len(check), "delta files on CDN ...")
for i, (p, h, s) in enumerate(check):
    name = str(h)[:12] + ".bin"
    try:
        req = urllib.request.Request(
            f"https://cdn.jsdelivr.net/gh/{REPO}@app-v0.7.0/updates/app/f/{name}",
            method="HEAD", headers={"User-Agent": "lexa-diag"})
        r = urllib.request.urlopen(req, timeout=30)
        if r.status != 200:
            missing.append((p, name, r.status))
    except Exception as ex:
        missing.append((p, name, str(ex)[:60]))
    if (i + 1) % 150 == 0:
        print(f"  ...{i+1}/{len(check)}")

print("MISSING ON CDN:", len(missing))
for m in missing[:10]:
    print("  ", m)

# بررسی حجم فایل دلتاهای بزرگ (سقف 24MB در آپدیتر)
over = [(p, s) for p, h, s in check if s > 24 * 1024 * 1024]
print("files over 24MB cap:", over)

print()
print("VERDICT:", "💥 APPLY FAILS — link entry دانلود می‌شود" if link_dl else "✓ apply content OK")
