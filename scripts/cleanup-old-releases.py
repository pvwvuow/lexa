#!/usr/bin/env python3
# پاکسازی نشتی داده در ریلیزهای قدیمی — حذف AppImage/zip حاوی بکاپ دیتابیس
import json, re, subprocess, urllib.request

REPO = "pvwvuow/lexa"
url = subprocess.check_output(["git", "remote", "get-url", "origin"], text=True).strip()
TOKEN = re.match(r"https://([^@]+)@github\.com/", url).group(1)

def api(path, data=None, method=None):
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request("https://api.github.com" + path,
        data=body,
        headers={"Authorization": "token " + TOKEN, "Accept": "application/vnd.github+json", "Content-Type": "application/json"},
        method=method or ("POST" if body else "GET"))
    return urllib.request.urlopen(req, timeout=60)

rels = json.loads(api("/repos/pvwvuow/lexa/releases?per_page=20").read())
NOTE = "\n\n---\n⚠️ **بسته‌های دانلودی این نسخه حذف شدند** — در آن‌ها فایل‌های دادهٔ سرور (بکاپ دیتابیس) به‌اشتباه قرار داشت. لطفاً [آخرین نسخه](https://github.com/pvwvuow/lexa/releases/latest) را نصب کن؛ به‌روزرسانی درون‌برنامه‌ای هم فعال است."

for r in rels:
    if r["tag_name"] in ("v0.7.0",):
        continue
    if not r["assets"]:
        continue
    print(f"── {r['tag_name']} ──")
    # یادداشت به بدنه
    body = r["body"] or ""
    if "بسته‌های دانلودی این نسخه حذف شدند" not in body:
        api(f"/repos/{REPO}/releases/{r['id']}", {"body": body + NOTE}, method="PATCH")
        print("  یادداشت اضافه شد")
    for a in r["assets"]:
        if a["name"].endswith((".AppImage", ".zip")):
            api(f"/repos/{REPO}/releases/assets/{a['id']}", method="DELETE")
            print(f"  حذف شد: {a['name']}")
        else:
            print(f"  ماند: {a['name']}")
print("cleanup done")
