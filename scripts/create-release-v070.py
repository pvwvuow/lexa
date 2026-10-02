#!/usr/bin/env python3
# ساخت ریلیز v0.7.0 و آپلود assetها (AppImage + win.zip + APK + checksums)
import json, re, subprocess, urllib.request

REPO = "pvwvuow/lexa"
VERSION = "0.7.0"
TAG = f"v{VERSION}"

url = subprocess.check_output(["git", "remote", "get-url", "origin"], text=True).strip()
TOKEN = re.match(r"https://([^@]+)@github\.com/", url).group(1)

def api(path, data=None, method=None, raw=None, ctype="application/json"):
    body = raw if raw is not None else (json.dumps(data).encode() if data else None)
    req = urllib.request.Request("https://api.github.com" + path if not str(path).startswith("http") else path,
        data=body,
        headers={"Authorization": "token " + TOKEN, "Accept": "application/vnd.github+json", "Content-Type": ctype},
        method=method or ("POST" if body else "GET"))
    return urllib.request.urlopen(req, timeout=60 if not raw else 3600)

NOTES = """نسخهٔ **0.7.0** — اولین نسخهٔ اندروید + نشان‌گذاری متن + رفع حساب کاربری

## 🆕 نسخهٔ اندروید (APK)
- فایل `Lexa-0.7.0-android.apk` را نصب کن (اندروید ۶ به بالا — معماری arm64/armeabi/x86)
- کل درس‌ها و قوانین داخل APK است؛ بدون اینترنت هم مطالعه می‌شود
- در نسخهٔ اندروید، حساب کاربری = «حساب ابری» در تنظیمات (ایمیل + رمز)
- استاد هوشمند در اندروید با کلید API شخصی (Gemini یا سازگار با OpenAI) از تنظیمات فعال می‌شود

## ✨ نشان‌گذاری متن (وب/دسکتاپ/اندروید)
- هر جمله‌ای را در درس انتخاب کن و با یکی از ۵ رنگ نشان بزن
- تغییر رنگ یا حذف: روی نشان بزن
- نشان‌ها در حساب کاربری ذخیره و بین دستگاه‌ها همگام می‌شوند

## 🛠 رفع اشکال حساب کاربری در نسخهٔ دسکتاپ
- در نسخه‌های قبلی، ثبت‌نام/ورود در برنامهٔ نصب‌شده کار نمی‌کرد («ارتباط با سرور برقرار نشد»)
- حالا هر نصب دسکتاپ دیتابیس محلی خودش را در پروفایل کاربر دارد و حساب از همان اجرای اول کار می‌کند

## 🔐 نکتهٔ امنیتی
- در نسخه‌های قبلی ویندوز/لینوکس، فایل‌های دادهٔ سرور (بکاپ دیتابیس) به‌اشتباه داخل بستهٔ دانلودی قرار گرفته بود؛ از این نسخه بسته‌ها کاملاً تمیز هستند. توصیه می‌کنیم رمز حساب‌هایی که فقط همین برنامه استفاده می‌کنند را در نهایت تازه کنی.

---
- دلتا آپدیت: کاربران نسخه‌های اخیر با «بررسی به‌روزرسانی» داخل برنامه فقط فایل‌های تغییرکرده را می‌گیرند
- checksums برای اعتبارسنجی دانلود"""

# ریلیز قبلی همین تگ؟ حذف
try:
    old = json.loads(api(f"/repos/{REPO}/releases/tags/{TAG}").read())
    api(f"/repos/{REPO}/releases/{old['id']}", method="DELETE")
    print("ریلیز قبلی حذف شد")
except Exception:
    print("ریلیز قبلی نبود")

rel = json.loads(api(f"/repos/{REPO}/releases", {
    "tag_name": TAG, "target_commitish": "main",
    "name": f"Lexa {TAG} — نسخهٔ اندروید + نشان‌گذاری متن",
    "body": NOTES, "draft": False, "prerelease": False,
}).read())
print("release id:", rel["id"])

assets = [
    ("download/electron/Lexa-0.7.0-linux.AppImage", "Lexa-0.7.0-linux.AppImage", "application/x-appimage"),
    ("download/electron/Lexa-0.7.0-win.zip", "Lexa-0.7.0-win.zip", "application/zip"),
    ("download/electron/Lexa-0.7.0-android.apk", "Lexa-0.7.0-android.apk", "application/vnd.android.package-archive"),
    ("download/electron/checksums.txt", "checksums-0.7.0.txt", "text/plain"),
]
for path, name, ctype in assets:
    size = __import__("os").path.getsize(path)
    print(f"آپلود {name} ({size/1048576:.1f} MB)…", flush=True)
    api(f"https://uploads.github.com/repos/{REPO}/releases/{rel['id']}/assets?name={name}",
        raw=open(path, "rb").read(), ctype=ctype)
    print(f"  ✓ {name}", flush=True)

print(f"DONE — https://github.com/{REPO}/releases/tag/{TAG}")
