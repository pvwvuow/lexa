#!/usr/bin/env python3
"""دِدوپ مانیفست 0.9.0 — حذف entriesهای هم‌هش از فید به‌روزرسانی
علت: موتور قدیمی (0.6.0) فایل stageشده را با rename مصرف می‌کند؛ اگر دو entry
هم‌هش در دلتا باشند، rename دوم ENOENT می‌دهد (کرش واقعی کاربر).
قواعد حذف:
  ۱) پسوندهای آشغال: .next/standalone/.next/static/static/* و public/public/*
  ۲) هر هشی که در دلتای هر یک از بیس‌های پشتیبانی‌شده (0.6.0/0.7.0/0.8.0/0.8.1)
     بیش از یک بار می‌آید → از جفت/مجموعهٔ هم‌هش فقط مسیر کانونی می‌ماند.
سایر هم‌هش‌های بی‌خطر (هیچ‌گاه در دلتا نمی‌آیند) دست‌نخورده می‌مانند.
"""
import json, subprocess, sys, re
from collections import Counter, defaultdict

BASES = ["app-v0.6.0", "app-v0.7.0", "app-v0.8.0", "app-v0.8.1"]
MF = "updates/app/manifest.json"

def git_show(tag, path):
    r = subprocess.run(["git", "show", f"{tag}:{path}"], capture_output=True, text=True)
    return json.loads(r.stdout) if r.returncode == 0 else None

m = json.load(open(MF))
files = m["files"]
orig_n = len(files)

JUNK = re.compile(r"^\.next/standalone/\.next/static/static/|^\.next/standalone/public/public/")

def canonical_rank(p):
    """مرجحیت نگه‌داشتن: مسیرهای واقعی سرو‌شونده و کوتاه‌تر اول"""
    score = 0
    if JUNK.match(p): score -= 100
    if ".segments/" in p: score -= 10          # کانونی: فایل اصلی rsc/html
    if p.endswith(".segments/_full.segment.rsc"): score -= 10
    if "/pages/404.html" in p or "/pages/500.html" in p: score -= 5  # app/_not-found.html اصلی است
    if "/public/public/" in p: score -= 100
    return score

# ۱) حذف آشغال‌ها
dropped_junk = [p for p in files if JUNK.match(p)]
for p in dropped_junk:
    del files[p]

# ۲) دلتای هر بیس از مانیفستِ همین فید (پس از حذف آشغال)
#    دلتا = entryهایی که هش‌شان با هش بیس فرق دارد (منطق computeDiff موتور قدیمی)
dup_hashes_in_deltas = set()
delta_report = {}
for tag in BASES:
    base = git_show(tag, MF)
    if base is None:
        print(f"⚠ بیس {tag} یافت نشد — رد شد"); continue
    bf = base["files"]
    d = {p: v for p, v in files.items() if p not in bf or bf[p][0] != v[0]}
    c = Counter(v[0] for v in d.values())
    dups = {h for h, n in c.items() if n > 1}
    delta_report[tag] = {"delta": len(d), "dup_hashes": len(dups)}
    dup_hashes_in_deltas |= dups

# ۳) برای هر هش تکراریِ دردسرساز: همهٔ مسیرها را پیدا کن، کانونی را نگه دار
by_hash = defaultdict(list)
for p, v in files.items():
    by_hash[v[0]].append(p)

dropped_alias = []
for h, paths in by_hash.items():
    if len(paths) > 1 and h in dup_hashes_in_deltas:
        keep = max(paths, key=canonical_rank)
        for p in paths:
            if p != keep:
                del files[p]
                dropped_alias.append((h[:12], p))

# ۴) راستی‌آزمایی نهایی: دلتاها باید صفر تکراری باشند
final_fail = []
for tag in BASES:
    base = git_show(tag, MF)
    if base is None: continue
    bf = base["files"]
    d = {p: v for p, v in files.items() if p not in bf or bf[p][0] != v[0]}
    c = Counter(v[0] for v in d.values())
    dups = {h for h, n in c.items() if n > 1}
    if dups:
        final_fail.append((tag, [p for p, v in d.items() if v[0] in dups]))

# پوشش f/: فقط هش‌هایی که در دلتایِ دست‌کم یک بیس می‌آیند باید bin داشته باشند
# (بقیهٔ فایل‌ها از نصب محلی کاربر می‌آیند و bin نداشتن‌شان طبیعی است)
need_bins = set()
for tag in BASES:
    base = git_show(tag, MF)
    if base is None: continue
    bf = base["files"]
    for p, v in files.items():
        if p not in bf or bf[p][0] != v[0]:
            need_bins.add(v[0])
import os
missing_bin = []
for h in sorted(need_bins):
    if not os.path.exists(f"updates/app/f/{h[:12]}.bin"):
        missing_bin.append(h)
print("هش‌های دلتایی نیازمند bin:", len(need_bins))

print(f"entries: {orig_n} → {len(files)} (حذف آشغال: {len(dropped_junk)}، حذف هم‌هش دلتایی: {len(dropped_alias)})")
print("دلتاها:", json.dumps(delta_report))
if missing_bin:
    print("❌ bin گمشده:", missing_bin[:5]); sys.exit(1)
if final_fail:
    for tag, paths in final_fail:
        print(f"❌ هنوز تکراری در دلتای {tag}:"); [print("   ", p) for p in paths[:10]]
    sys.exit(1)

json.dump(m, open(MF, "w"), ensure_ascii=False, separators=(",", ":"))
print("✅ مانیفست دِدوپ و ذخیره شد")
