#!/usr/bin/env python3
"""راستی‌آزمایی زندهٔ فید 0.8.0 — شبیه‌سازی دقیق کاربران موتور قدیمی (0.6.0/0.7.0 ویندوز)"""
import json, hashlib, urllib.request, sys
from concurrent.futures import ThreadPoolExecutor

REPO = "pvwvuow/lexa"

def fetch(url, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": "lexa-diag"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

m080 = json.loads(fetch(f"https://cdn.jsdelivr.net/gh/{REPO}@app-v0.8.0/updates/app/manifest.json"))
print("manifest 0.8.0 روی CDN تگ: version =", m080["version"], "| files =", len(m080["files"]), "| tag =", m080["tag"])
m080_main = json.loads(fetch(f"https://cdn.jsdelivr.net/gh/{REPO}@main/updates/app/manifest.json"))
print("manifest روی @main: version =", m080_main["version"])

links = [p for p, e in m080["files"].items() if str(e[0]).startswith("link:")]
print("link entries در مانیفست 0.8.0:", len(links), "← باید ۰ باشد")

m060 = json.loads(fetch(f"https://cdn.jsdelivr.net/gh/{REPO}@app-v0.6.0/updates/app/manifest.json"))
m070 = json.loads(fetch(f"https://cdn.jsdelivr.net/gh/{REPO}@app-v0.7.0/updates/app/manifest.json"))

def simulate(local_manifest, label, win_style):
    # شبیه‌سازی محتوای محلی کاربر
    local = {}
    for p, e in local_manifest["files"].items():
        h = str(e[0])
        if h.startswith("link:") and win_style:
            local[p] = hashlib.sha256(h[5:].encode()).hexdigest()  # ویندوز: فایل متنی
        else:
            local[p] = h
    to_download, to_delete = [], []
    for p, e in m080["files"].items():
        h = str(e[0])
        if h.startswith("link:"):
            continue  # موتور جدید: skip | موتور قدیمی: وارد دانلود می‌شد!
        lh = local.get(p)
        if lh is None or lh != h:
            to_download.append((p, h, e[1]))
    for p in local:
        if p not in m080["files"]:
            to_delete.append(p)
    total = sum(s for _, _, s in to_download)
    print(f"\n── {label} (win_style={win_style}) ──")
    print(f"  toDownload: {len(to_download)} ({total/1e6:.1f}MB)  toDelete: {len(to_delete)}")
    over = [(p, s) for p, h, s in to_download if s > 24 * 1024 * 1024]
    print("  فایل‌های بالای سقف ۲۴MB:", len(over))
    # وجود روی CDN
    def probe(item):
        p, h, s = item
        name = h[:12] + ".bin"
        try:
            req = urllib.request.Request(
                f"https://cdn.jsdelivr.net/gh/{REPO}@app-v0.8.0/updates/app/f/{name}",
                method="HEAD", headers={"User-Agent": "lexa-diag"})
            r = urllib.request.urlopen(req, timeout=30)
            return None if r.status == 200 else (p, name, r.status)
        except urllib.error.HTTPError as ex:
            return (p, name, ex.code)
        except Exception as ex:
            return (p, name, str(ex)[:50])
    missing = []
    with ThreadPoolExecutor(max_workers=16) as pool:
        for res in pool.map(probe, to_download):
            if res:
                missing.append(res)
    print("  MISSING روی CDN:", len(missing), missing[:5] if missing else "")
    verdict = "✓ آپدیت کامل می‌شود" if (not missing and not over) else "✗ مشکل!"
    print("  VERDICT:", verdict)
    return not missing and not over

ok1 = simulate(m060, "کاربر 0.6.0", True)   # ویندوز: symlink = فایل متنی
ok2 = simulate(m070, "کاربر 0.7.0", True)   # ویندوز
ok3 = simulate(m060, "کاربر 0.6.0", False)  # لینوکس

# کشف تگ از releases.atom
atom = fetch(f"https://github.com/{REPO}/releases.atom").decode()
import re
mm = re.search(r"releases/tag/(v\d[\w.\-]*)", atom)
print("\nreleases.atom آخرین تگ:", mm.group(1) if mm else "?", "→ app-" + mm.group(1) if mm else "")

print("─" * 50)
print("FINAL:", "✓ همه سبز" if (ok1 and ok2 and ok3 and not links) else "✗ شکست")
sys.exit(0 if (ok1 and ok2 and ok3 and not links) else 1)
