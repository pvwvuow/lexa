#!/usr/bin/env python3
# ─── راستی‌آزمایی زندهٔ ریلیز 0.9.2 ──────────────────────────────────────────
import json, sys, urllib.request

REPO = "pvwvuow/lexa"
VERSION = "0.9.2"
APP_TAG = f"app-v{VERSION}"
TOKEN = None
url = __import__("subprocess").check_output(["git", "remote", "get-url", "origin"], text=True).strip()
import re
m = re.match(r"https://([^@]+)@github\.com/", url)
TOKEN = m.group(1) if m else None

pass_n = 0, 
pass_ = 0; fail_ = 0
def ok(name, cond, extra=""):
    global pass_, fail_
    if cond: pass_ += 1; print(f"  ✓ {name}")
    else: fail_ += 1; print(f"  ✗ {name} {extra}")

def get(u, timeout=30):
    req = urllib.request.Request(u, headers={"Authorization": f"token {TOKEN}"} if TOKEN and "api.github" in u else {})
    return urllib.request.urlopen(req, timeout=timeout).read()

def head(u):
    try:
        req = urllib.request.Request(u, method="HEAD", headers={"Authorization": f"token {TOKEN}"} if TOKEN and "api.github" in u else {})
        return urllib.request.urlopen(req, timeout=20).status == 200
    except Exception:
        return False

# ۱) مانیفست روی هر دو کانال
mf_main = json.loads(get(f"https://cdn.jsdelivr.net/gh/{REPO}@main/updates/app/manifest.json"))
mf_tag = json.loads(get(f"https://cdn.jsdelivr.net/gh/{REPO}@{APP_TAG}/updates/app/manifest.json"))
ok(f"مانیفست @main → {mf_main['version']}", mf_main["version"] == VERSION)
ok(f"مانیفست @{APP_TAG} → {mf_tag['version']}", mf_tag["version"] == VERSION)
ok(f"یادداشت مانیفست شامل «پنل مات» است", "پنل مات" in mf_main.get("notes", ""))

# ۲) سلامت ساختار مانیفست: صفر هم‌هش، صفر آشغال static/static و public/public
files = mf_main["files"]  # { path: [hash, size] }
paths = list(files.keys())
hashes = [files[p][0] for p in paths]
ok(f"مانیفست {len(paths)} فایل — صفر هم‌هش", len(hashes) == len(set(hashes)))
garbage = [p for p in paths if "static/static" in p or "public/public" in p]
ok("صفر مسیر آشغال تو در تو", len(garbage) == 0, str(garbage[:3]))

# ۳) دلتای هر نسخهٔ قدیمی → همهٔ فایل‌ها روی CDNِ تگ جدید
import base64
gh_api = f"https://api.github.com/repos/{REPO}/releases/tags"
prevs = ["0.6.0", "0.7.0", "0.8.0", "0.8.1", "0.9.0", "0.9.1"]
# هش‌های نسخهٔ فعلی برای مقایسهٔ «هم‌هش = بی‌نیاز از دانلود»
cur = {p: files[p][0] for p in paths}
for prev in prevs:
    try:
        old = json.loads(get(f"https://raw.githubusercontent.com/{REPO}/app-v{prev}/updates/app/manifest.json"))
    except Exception as e:
        ok(f"مانیفست قدیمی {prev}", False, str(e)[:60]); continue
    oldfiles = old["files"]
    oldm = {p: (v[0] if isinstance(v, list) else v.get("h")) for p, v in oldfiles.items()} if isinstance(oldfiles, dict) else {f["p"]: f["h"] for f in oldfiles}
    delta = [(p, h) for p, h in oldm.items() if cur.get(p) != h]
    from concurrent.futures import ThreadPoolExecutor
    import random
    # آپدیتر برای فایل تغییرکرده، binِ هشِ «جدید» (مخصول مانیفست تازه) را می‌گیرد
    delta_new = [(p, cur[p]) for p, h in delta if p in cur]  # حذف‌شده‌ها bin نمی‌خواهند
    sample = delta_new if len(delta_new) <= 40 else random.sample(delta_new, 40)
    def check(item):
        p, h = item
        for attempt in range(2):
            if head(f"https://cdn.jsdelivr.net/gh/{REPO}@{APP_TAG}/updates/app/f/{h[:12]}.bin"):
                return False
            if head(f"https://raw.githubusercontent.com/{REPO}/{APP_TAG}/updates/app/f/{h[:12]}.bin"):
                return False
        return True
    with ThreadPoolExecutor(4) as ex:
        results = list(ex.map(check, sample))
    miss = sum(results)
    sizes = {p: (files[p][1] if isinstance(files[p], list) else files[p].get("s", 0)) for p in paths}
    over = [(p, sizes.get(p, 0)) for p, h in delta if sizes.get(p, 0) > 19 * 1024 * 1024]
    checked = f"نمونهٔ {len(sample)}/{len(delta)}"
    ok(f"دلتای {prev}→{VERSION}: {len(delta)} فایل ({checked})، MISSING: {miss}، بدون فایل >۱۹MB: {len(over) == 0}",
       miss == 0 and not over)

# ۳ب) مانیفست @main و تگ جدید یکسان‌اند
import hashlib
h_main = hashlib.sha1(json.dumps(mf_main, sort_keys=True).encode()).hexdigest()[:12]
h_tag = hashlib.sha1(json.dumps(mf_tag, sort_keys=True).encode()).hexdigest()[:12]
ok("مانیفست @main و @app-v0.9.2 یکسان", h_main == h_tag)

# ۴) ریلیز گیت‌هاب + assetها
rel = json.loads(get(f"https://api.github.com/repos/{REPO}/releases/tags/v{VERSION}"))
assets = {a["name"]: a["size"] for a in rel["assets"]}
need = [f"Lexa-{VERSION}-linux.AppImage", f"Lexa-{VERSION}-win.zip", f"Lexa-{VERSION}-android.apk", f"checksums-{VERSION}.txt"]
ok(f"ریلیز v{VERSION} با ۴ asset", all(a in assets for a in need), str(list(assets)))
ok("ریلیز draft/prerelease نیست", not rel["draft"] and not rel["prerelease"])

# ۵) کش سرویس‌ورکر پرود (اختیاری — فقط گزارش)
try:
    sw = get("https://cdn.jsdelivr.net/gh/pvwvuow/lexa@app-v0.9.2/public/sw.js", 10)[:0]
except Exception:
    pass

print(f"\nنتیجه: {pass_} ✓ / {fail_} ✗")
sys.exit(1 if fail_ else 0)
