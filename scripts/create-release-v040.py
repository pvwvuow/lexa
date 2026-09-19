#!/usr/bin/env python3
# ═══ ساخت Release v0.4.0 برای pvwvuow/lexa ═══════════════════════════════════
# توکن از متغیر محیطی GITHUB_TOKEN خوانده می‌شود.
# ═════════════════════════════════════════════════════════════════════════════
import json, os, sys, urllib.request

TOKEN = os.environ["GITHUB_TOKEN"]
REPO = "pvwvuow/lexa"
TAG = "v0.4.0"
TARGET = "e75b45406036fb8610ea6e0984fa78c6a6c7f12d"

BODY = """نسخهٔ **۰.۴.۰** — بزرگ‌ترین به‌روزرسانی Lexa تا امروز: باندلِ سبک + متن‌های برخط

## ⚡ چرا این نسخه سبک‌تر است؟
نصب‌کنندهٔ دسکتاپ دیگر متن درس‌ها را حمل نمی‌کند — متون (۴۱۵ جلسه) در همان لحظهٔ باز کردن فصل از گیت‌هاب (jsDelivr/raw) گرفته و در حافظهٔ مرورگر داخلی (IndexedDB) کش می‌شوند. بعد از اولین بار، حتی آفلاین هم کار می‌کند.

| فایل | v0.3.0 | v0.4.0 | صرفهٔ جویی |
|---|---|---|---|
| لینوکس (AppImage) | ‏186MB | **120MB** | ‏-35% |
| ویندوز (zip) | ‏236MB | **193MB** | ‏-18% |

(۵۳ لوکال زبانی بی‌استفادهٔ الکترون هم حذف شد — فقط فارسی و انگلیسی مانده)

## 🔁 بارگیری تنبل متن و سؤال
- باندل فقط «متادیتا» دارد: عنوان‌ها، فصل‌بندی، نسخهٔ محتوا و تعداد سؤال‌ها (~۱۲۲KB)
- به‌محض باز کردن فصل، محتوای همان فصل لود می‌شود — نه دانلود یکجای همهٔ لکسا
- زنجیرهٔ منابع: سرور خود اپ ← jsDelivr CDN ← raw گیت‌هاب؛ با محافظ نسخه (v-mismatch) و کش IndexedDB
- در دسکتاپ نصب‌شده، مستقیم از گیت‌هاب گرفته می‌شود (بدون درخواست اضافه)
- آفلاین: جلسه‌های دیده‌شده از کش می‌آیند؛ ذخیرهٔ آفلاینِ کامل دوره هم قبل از ذخیره، محتوا را کامل می‌کند

## 📝 کوییز‌ها و ابزارهای مطالعه
- شمارندهٔ سؤال‌ها (n/m) از متادیتا؛ سؤال‌های هر جلسه هنگام شروع آزمون گرفته می‌شوند
- فلاش‌کارت‌ها با گرم‌کن تدریجی کتابخانه (همزمانی کم، بدون فشار به شبکه)
- جست‌وجوی سراسری، فهرست مطالعه و کتابخانهٔ عمومی با نشان‌های تعداد سؤال

## 📦 نصب
- **ویندوز:** `Lexa-0.4.0-win.zip` را استخراج کنید و `Lexa.exe` را اجرا کنید (بدون نصب)
- **لینوکس:** `chmod +x Lexa-0.4.0.AppImage` و اجرا
- صحت فایل‌ها: `checksums-v0.4.0.txt` (SHA-256)

## 🛠 فنی
- Electron ‏38.8.6 · Next.js ‏16 · نسخهٔ دیزاین ‏1.9.0 · Service Worker `lexa-pwa-v32`
- کد: `e734316` (بارگیری تنبل) + `e75b454` (باندل سبک دسکتاپ)
"""

def api(url, data=None, headers=None, method=None):
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"token {TOKEN}")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("User-Agent", "lexa-release-script")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    return urllib.request.urlopen(req)

payload = json.dumps({
    "tag_name": TAG,
    "target_commitish": TARGET,
    "name": "Lexa ۰.۴.۰ — باندل سبک + متن‌های برخط",
    "body": BODY,
    "draft": False,
    "prerelease": False,
    "make_latest": "true",
}).encode()

try:
    with api(f"https://api.github.com/repos/{REPO}/releases", payload, {"Content-Type": "application/json"}) as r:
        rel = json.loads(r.read())
except urllib.error.HTTPError as e:
    print("CREATE FAILED:", e.read().decode()[:500]); sys.exit(1)

print(f"✓ release id={rel['id']}  upload_url ok")

ASSETS = [
    ("download/electron/Lexa-0.4.0.AppImage", "application/vnd.appimage"),
    ("download/electron/Lexa-0.4.0-win.zip", "application/zip"),
    ("download/electron/checksums-v0.4.0.txt", "text/plain"),
]
upload_base = rel["upload_url"].split("{")[0]
for path, ctype in ASSETS:
    name = os.path.basename(path)
    size = os.path.getsize(path)
    with open(path, "rb") as f:
        data = f.read()
    req = urllib.request.Request(
        f"{upload_base}?name={name}", data=data, method="POST")
    req.add_header("Authorization", f"token {TOKEN}")
    req.add_header("Content-Type", ctype)
    req.add_header("Content-Length", str(size))
    with urllib.request.urlopen(req) as r:
        a = json.loads(r.read())
    ok = a.get("state") == "uploaded" and a.get("size") == size
    print(f"{'✓' if ok else '✗'} {name}  {size:,} bytes  state={a.get('state')}")
    if not ok:
        sys.exit(1)

print("ALL ASSETS UPLOADED")
