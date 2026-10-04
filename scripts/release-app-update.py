#!/usr/bin/env python3
# ═══ ریلیز خودکار Lexa با آپدیت درون‌برنامه‌ای دلتا ═══════════════════════════
#
#   python3 scripts/release-app-update.py
#   (نسخه و یادداشت را از CONFIG پایین تنظیم کن — یا از آرگومان)
#
#   پیش‌نیاز قبل از اجرا:
#     ۱) version داخل package.json را به نسخهٔ جدید تغییر بده
#     ۲) bun run build            ← بیلد وب/استاندالون
#     ۳) bun run electron:build   ← خروجی AppImage + win zip
#
#   کاری که این اسکریپت می‌کند:
#     ۱) ساخت مانیفست جدید + استیج فایل‌های تغییریافته (دلتا) در updates/app/f/
#     ۲) commit + push مخزن + تگ app-vX.Y.Z (منبع jsDelivr برای دلتاها)
#     ۳) purge کش jsDelivr برای مانیفست
#     ۴) ساخت ریلیز گیت‌هاب vX.Y.Z + آپلود فایل‌های کامل (نصب جدید)
#
#   نتیجه: کاربران فعلی فقط دلتا (چند مگابایت) داخل برنامه دانلود می‌کنند؛
#          کاربران جدید فایل کامل را از ریلیز می‌گیرند.
# ═════════════════════════════════════════════════════════════════════════════

import json, os, re, subprocess, sys, time, urllib.request

# ─── CONFIG ──────────────────────────────────────────────────────────────────
VERSION = os.environ.get("LEXA_VERSION") or (sys.argv[1] if len(sys.argv) > 1 else "0.5.1")
TAG = f"v{VERSION}"
APP_TAG = f"app-v{VERSION}"
NOTES = os.environ.get("LEXA_NOTES") or """نسخهٔ **{v}** — به‌روزرسانی درون‌برنامه‌ای

- از این نسخه، آپدیت‌های بعدی داخل خود برنامه نصب می‌شوند (فقط فایل‌های تغییرکرده)
- دیگر لازم نیست برای هر نسخهٔ جدید، کل برنامه را از گیت‌هاب دانلود کنی""".replace("{v}", VERSION)
# ─────────────────────────────────────────────────────────────────────────────

REPO = "pvwvuow/lexa"
OUT_DIR = "download/electron"

url = subprocess.check_output(["git", "remote", "get-url", "origin"], text=True).strip()
m = re.match(r"https://([^@]+)@github\.com/", url)
if not m:
    print("NO_TOKEN در remote"); sys.exit(1)
TOKEN = m.group(1)

def api(path, data=None, method=None, raw=None, ctype="application/json"):
    body = raw if raw is not None else (json.dumps(data).encode() if data else None)
    req = urllib.request.Request("https://api.github.com" + path if not str(path).startswith("http") else path,
        data=body,
        headers={"Authorization": "token " + TOKEN, "Accept": "application/vnd.github+json", "Content-Type": ctype},
        method=method or ("POST" if body else "GET"))
    return urllib.request.urlopen(req, timeout=60 if not raw else 1800)

# ۱) نسخهٔ package.json باید همان VERSION باشد
pkg = json.load(open("package.json"))
if pkg["version"] != VERSION:
    print(f"✗ package.json نسخه‌اش «{pkg['version']}» است ولی ریلیز «{VERSION}» — اول version را عوض کن")
    sys.exit(1)

# ۲) فایل‌های خروجی باید موجود باشند
assets = [
    (f"{OUT_DIR}/Lexa-{VERSION}.AppImage", f"Lexa-{VERSION}-linux.AppImage", "application/x-appimage"),
    (f"{OUT_DIR}/Lexa-{VERSION}-win.zip", f"Lexa-{VERSION}-win.zip", "application/zip"),
    (f"{OUT_DIR}/checksums.txt", f"checksums-{VERSION}.txt", "text/plain"),
    (f"download/android/Lexa-{VERSION}.apk", f"Lexa-{VERSION}-android.apk", "application/vnd.android.package-archive"),
]
assets = [a for a in assets if os.path.exists(a[0])]
missing_check = [a for a in assets if not os.path.exists(a[0])]
if len(assets) < 3:
    print("✗ فایل‌های کافی برای ریلیز نیست:", [a[0] for a in assets]); sys.exit(1)
apk_present = any(a[1].endswith(".apk") for a in assets)
print("assetها:", [a[1] for a in assets], "| APK:", apk_present)

# ۳) مانیفست + استیج دلتا
print("\n── ساخت مانیفست و دلتا ──")
prev_flag = "--prev updates/app/manifest.json --stage " if os.path.exists("updates/app/manifest.json") else ""
subprocess.run(
    f'bun scripts/build-app-update.mjs --dir {OUT_DIR}/win-unpacked/resources/app '
    f'--version {VERSION} --tag {APP_TAG} --notes "{NOTES}" {prev_flag}',
    shell=True, check=True,
)

# ۳ب) APK در مخزن هم استیج می‌شود — منبع دانلود درون‌برنامه‌ای (jsDelivr CDN)
apk_path = f"download/android/Lexa-{VERSION}.apk"
if os.path.exists(apk_path):
    import hashlib, shutil
    print("\n── استیج APK برای دانلود درون‌برنامه‌ای ──")
    os.makedirs("updates/app", exist_ok=True)
    shutil.copyfile(apk_path, "updates/app/lexa-latest.apk")
    h = hashlib.sha256()
    with open(apk_path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    apk_sha = h.hexdigest()
    mpath = "updates/app/manifest.json"
    mjson = json.load(open(mpath))
    mjson["apk"] = {"file": "lexa-latest.apk", "sha256": apk_sha, "size": os.path.getsize(apk_path)}
    json.dump(mjson, open(mpath, "w"), ensure_ascii=False, indent=2)
    print(f"  ✓ lexa-latest.apk استیج شد — sha256 {apk_sha[:16]}…")

# ۴) commit + push + تگ
print("\n── push مخزن + تگ ──")
subprocess.run("git add updates/app", shell=True, check=True)
r = subprocess.run(f'git commit -m "app update {VERSION} (delta feed)"', shell=True, capture_output=True, text=True)
if r.returncode == 0:
    subprocess.run("git push origin main", shell=True, check=True)
else:
    print("  (چیزی برای commit نبود)")
subprocess.run(f"git tag -f {APP_TAG} && git push origin {APP_TAG} -f", shell=True, check=True)

# ۵) purge کش jsDelivr برای مانیفست + APK
print("\n── purge jsDelivr ──")
for purge_path in ("updates/app/manifest.json", "updates/app/lexa-latest.apk"):
    try:
        urllib.request.urlopen(
            f"https://purge.jsdelivr.net/gh/{REPO}@main/{purge_path}", timeout=30)
        print(f"  ✓ purge شد — {purge_path}")
    except Exception as e:
        print(f"  ⚠ purge ناموفق ({purge_path}) — مهم نیست (raw همیشه تازه است):", e)

# ۶) ریلیز گیت‌هاب
print("\n── ریلیز گیت‌هاب ──")
try:
    old = json.loads(api(f"/repos/{REPO}/releases/tags/{TAG}").read())
    api(f"/repos/{REPO}/releases/{old['id']}", method="DELETE")
    print("  ریلیز قدیمی همین تگ حذف شد")
except Exception:
    print("  ریلیز قدیمی نبود")

rel = json.loads(api(f"/repos/{REPO}/releases", {
    "tag_name": TAG, "target_commitish": "main",
    "name": f"Lexa {TAG}", "body": NOTES, "draft": False, "prerelease": False,
}).read())
print("  release id:", rel["id"])

for path, name, ctype in assets:
    size = os.path.getsize(path)
    print(f"  آپلود {name} ({size/1048576:.1f} MB)…", flush=True)
    api(f"https://uploads.github.com/repos/{REPO}/releases/{rel['id']}/assets?name={name}",
        raw=open(path, "rb").read(), ctype=ctype)
    print(f"  ✓ {name}", flush=True)

print(f"""
════════════════════════════════════════════════════
✓ ریلیز {VERSION} کامل شد
  • کاربران فعلی: با زدن «بررسی به‌روزرسانی» داخل برنامه، فقط فایل‌های تغییرکرده را می‌گیرند
  • کاربران جدید: فایل کامل از https://github.com/{REPO}/releases/tag/{TAG}
  • فید دلتا: https://cdn.jsdelivr.net/gh/{REPO}@{APP_TAG}/updates/app/
════════════════════════════════════════════════════""")
