#!/usr/bin/env python3
"""راستی‌آزمایی زندهٔ ریلیز 0.9.1 — مانیفست، پوشش دلتا روی CDN، شبیه‌سازی موتور قدیمی"""
import json, subprocess, sys, urllib.request
from collections import Counter

REPO = "pvwvuow/lexa"

def get(url, timeout=30):
    return urllib.request.urlopen(url, timeout=timeout)

def head(url):
    try:
        r = urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=25)
        return r.status == 200
    except Exception:
        return False

passed = failed = 0
def ok(cond, label, extra=""):
    global passed, failed
    if cond: passed += 1; print(f"  ✓ {label}")
    else: failed += 1; print(f"  ✗ {label} {extra}")

# ۱) مانیفست زنده از هر دو کانال
mf_main = json.loads(get(f"https://cdn.jsdelivr.net/gh/{REPO}@main/updates/app/manifest.json").read())
mf_tag = json.loads(get(f"https://cdn.jsdelivr.net/gh/{REPO}@app-v0.9.1/updates/app/manifest.json").read())
for label, m in [("@main", mf_main), ("@app-v0.9.1", mf_tag)]:
    files = m["files"]
    dups = sum(1 for h, n in Counter(v[0] for v in files.values()).items() if n > 1)
    junk = sum(1 for k in files if "/static/static/" in k or "/public/public/" in k)
    ok(m["version"] == "0.9.1" and len(files) == 1691 and dups == 0 and junk == 0,
       f"مانیفست {label}: 0.9.1 / 1691 entry / صفر هم‌هش / صفر آشغال",
       f"(v={m['version']}, n={len(files)}, dups={dups}, junk={junk})")

# ۲) شبیه‌سازی دلتای موتور قدیمی 0.6.0 → 0.9.1 (زنده)
m060 = json.loads(subprocess.run(["git", "show", "app-v0.6.0:updates/app/manifest.json"],
                                 capture_output=True, text=True).stdout)["files"]
live = mf_main["files"]
delta = {p: v for p, v in live.items() if p not in m060 or m060[p][0] != v[0]}
dup_in_delta = {h for h, n in Counter(v[0] for v in delta.values()).items() if n > 1}
ok(len(delta) == 75, f"دلتای 0.6.0→0.9.1 = ۷۵ فایل (واقعی: {len(delta)})")
ok(len(dup_in_delta) == 0, "صفر هش تکراری در دلتا (ایمنی موتور 0.6.0)")
mb = sum(v[1] for v in delta.values()) / 1e6
ok(mb < 5, f"حجم دلتا منطقی = {mb:.2f}MB")

# ۳) همهٔ فایل‌های دلتا باید روی CDN زنده باشند (کانال تگ = منبع اصلی دانلود)
print(f"\nبررسی HEAD برای {len(delta)} فایل دلتا روی @{mf_tag['tag']} …")
miss = 0
for i, (p, v) in enumerate(sorted(delta.items())):
    h = v[0]
    if not head(f"https://cdn.jsdelivr.net/gh/{REPO}@{mf_tag['tag']}/updates/app/f/{h[:12]}.bin"):
        # fallback رسمی موتور
        if not head(f"https://raw.githubusercontent.com/{REPO}/{mf_tag['tag']}/updates/app/f/{h[:12]}.bin"):
            miss += 1
            print("  ✗ MISSING:", p, h[:12])
    if (i + 1) % 25 == 0:
        print(f"  … {i+1}/{len(delta)} بررسی شد")
ok(miss == 0, f"همهٔ {len(delta)} فایل دلتا روی CDN در دسترس‌اند (MISSING: {miss})")

# ۴) دلتاهای دیگر بیس‌ها — فقط شمارش
for tag in ["app-v0.7.0", "app-v0.8.0", "app-v0.8.1", "app-v0.9.0"]:
    base = json.loads(subprocess.run(["git", "show", f"{tag}:updates/app/manifest.json"],
                                     capture_output=True, text=True).stdout)["files"]
    d = {p: v for p, v in live.items() if p not in base or base[p][0] != v[0]}
    dd = sum(1 for h, n in Counter(v[0] for v in d.values()).items() if n > 1)
    ok(dd == 0, f"دلتای {tag}: {len(d)} فایل، صفر هم‌هش")

# ۵) releases.atom — کشف تگ توسط موتورهای 0.8+
atom = get(f"https://github.com/{REPO}/releases.atom").read().decode()
import re as _re
m = _re.search(r"releases/tag/(v\d[\w.\-]*)", atom)
ok(m and m.group(1) == "v0.9.1", "releases.atom → v0.9.1 (کشف تگ)", m.group(1) if m else "؟")

print(f"\nنتیجه: {passed} ✓ / {failed} ✗")
sys.exit(1 if failed else 0)
