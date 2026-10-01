#!/usr/bin/env python3
# ═══ ریلیز v0.5.0 — حساب ابری ساپابیس ═══════════════════════════════════════
# توکن از remote URL خوانده می‌شود (چاپ نمی‌شود). آپلود در پس‌زمینه اجرا شود.
import json, os, re, subprocess, sys, time, urllib.request

REPO = "pvwvuow/lexa"
TAG = "v0.5.0"
url = subprocess.check_output(["git", "remote", "get-url", "origin"], text=True).strip()
m = re.match(r"https://([^@]+)@github\.com/", url)
if not m:
    print("NO_TOKEN"); sys.exit(1)
TOKEN = m.group(1)
ASSETS = [
    ("download/electron/Lexa-0.4.0.AppImage", "Lexa-0.5.0-linux.AppImage", "application/x-appimage"),
    ("download/electron/Lexa-0.4.0-win.zip", "Lexa-0.5.0-win.zip", "application/zip"),
    ("download/electron/checksums.txt", "checksums-v0.5.0.txt", "text/plain"),
]

BODY = """نسخهٔ **۰.۵.۰** — حساب ابری ساپابیس + سینک کامل داده‌ها

## ☁️ حساب ابری و سینک
- ثبت‌نام/ورود با ایمیل روی Supabase (کلید امن RLS — هر کاربر فقط دادهٔ خودش)
- «همگام‌سازی روی ابر»: پیشرفت درس‌ها، کتابخانهٔ شخصی، درس‌های وارداتی، تلاش‌های آزمون، مباحث ضعیف و نشانک‌ها — همه یکجا
- «بازیابی از ابر»: روی هر دستگاه جدید با ورود، همه‌چیز برمی‌گردد
- آفلاین کامل کار می‌کند؛ سینک دستی و بدون فشار به شبکه

## 🖥️ دسکتاپ (الکترون)
- همان نصب‌کنندهٔ سبک v0.4.0 (متون برخط از گیت‌هاب + کش IndexedDB) + کد سینک ابری جدید
- ویندوز: استخراج zip و اجرای Lexa.exe — لینوکس: chmod +x و اجرای AppImage

## 🧹 سایر
- حذف ترازوی اسپلش صفحهٔ بارگذاری
- DESIGN_VERSION 1.9.1 / سرویس‌ورکر lexa-pwa-v33
"""

def api(path, data=None, method=None, ctype="application/json"):
    req = urllib.request.Request("https://api.github.com" + path,
        data=json.dumps(data).encode() if data else None,
        headers={"Authorization": "token " + TOKEN, "Accept": "application/vnd.github+json", "Content-Type": ctype},
        method=method or ("POST" if data else "GET"))
    return urllib.request.urlopen(req, timeout=60)

# 1) delete existing draft/release with same tag if any
try:
    rel = api(f"/repos/{REPO}/releases/tags/{TAG}").read()
    old = json.loads(rel)
    api(f"/repos/{REPO}/releases/{old['id']}", method="DELETE")
    print("deleted old", old["id"])
except Exception as e:
    print("no old release")

# 2) create release
rel = json.loads(api(f"/repos/{REPO}/releases", {
    "tag_name": TAG, "target_commitish": "main", "name": "Lexa v0.5.0 — حساب ابری",
    "body": BODY, "draft": False, "prerelease": False,
}).read())
print("release id:", rel["id"])
open("/tmp/release_id.txt", "w").write(str(rel["id"]))

# 3) upload assets
for path, name, ctype in ASSETS:
    size = os.path.getsize(path)
    print("uploading", name, size, flush=True)
    req = urllib.request.Request(
        f"https://uploads.github.com/repos/{REPO}/releases/{rel['id']}/assets?name={name}",
        data=open(path, "rb").read(),
        headers={"Authorization": "token " + TOKEN, "Content-Type": ctype})
    urllib.request.urlopen(req, timeout=1800)
    print("uploaded", name, flush=True)
print("RELEASE_DONE")
