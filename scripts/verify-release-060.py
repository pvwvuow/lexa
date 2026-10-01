#!/usr/bin/env python3
"""راستی‌آزمایی نهایی ریلیز 0.6.0 — فایل‌های دلتا روی jsDelivr + وضعیت ریلیز گیت‌هاب"""
import json, os, re, subprocess, urllib.request

# ─── ۱) همهٔ فایل‌های دلتای استیج‌شده روی jsDelivr ───
staged = sorted(os.listdir("updates/app/f"))
ok = bad = 0
for f in staged:
    url = f"https://cdn.jsdelivr.net/gh/pvwvuow/lexa@app-v0.6.0/updates/app/f/{f}"
    try:
        r = urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=25)
        if r.status == 200:
            ok += 1
        else:
            bad += 1
            print("BAD", f, r.status)
    except Exception as e:
        bad += 1
        print("ERR", f, str(e)[:60])
print(f"jsDelivr delta files: {ok} OK / {bad} BAD (از {len(staged)})")

# ─── ۲) گیت‌هاب ریلیز با توکن ───
url = subprocess.check_output(["git", "remote", "get-url", "origin"], text=True).strip()
TOKEN = re.match(r"https://([^@]+)@github\.com/", url).group(1)
req = urllib.request.Request("https://api.github.com/repos/pvwvuow/lexa/releases/latest",
    headers={"Authorization": "token " + TOKEN, "Accept": "application/vnd.github+json"})
rel = json.loads(urllib.request.urlopen(req, timeout=30).read())
print("\nlatest release:", rel["tag_name"], "| draft:", rel["draft"], "| prerelease:", rel["prerelease"])
print("published_at:", rel["published_at"])
for a in rel["assets"]:
    print(f"  {a['name']}  {a['size']/1048576:.1f} MB  state={a['state']}  downloads={a['download_count']}")
print("\nbody (۱۲ خط اول):")
for ln in rel["body"].splitlines()[:12]:
    print("  ", ln)

# ─── ۳) checksums مطابقت با فایل‌های آپلودشده ───
print("\nchecksums محلی:")
print(open("download/electron/checksums.txt").read())
