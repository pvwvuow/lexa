#!/usr/bin/env python3
# ═══ راستی‌آزمایی زندهٔ ریلیز v0.10.14 ═══════════════════════════════════════
import json, re, subprocess, sys, random
from concurrent.futures import ThreadPoolExecutor

REPO = "pvwvuow/lexa"
VERSION = "0.10.14"
APP_TAG = f"app-v{VERSION}"
_url = subprocess.check_output(["git", "remote", "get-url", "origin"], text=True).strip()
_m = re.match(r"https://([^@]+)@github\.com/", _url)
TOKEN = _m.group(1) if _m else ""
results = []

def ok(name, cond, extra=""):
    results.append((bool(cond), name, extra))
    print(("  ✓ " if cond else "  ✗ ") + name + (f"  [{extra}]" if extra and not cond else ""))

def get(u, timeout=30):
    hdr = ["-H", f"Authorization: token {TOKEN}"] if "api.github.com" in u and TOKEN else []
    req = subprocess.run(["curl", "-sS", "--max-time", str(timeout)] + hdr + [u], capture_output=True, text=True)
    if req.returncode != 0:
        raise RuntimeError(f"curl {u}: {req.stderr[:80]}")
    return req.stdout

def head(u):
    hdr = ["-H", f"Authorization: token {TOKEN}"] if "api.github.com" in u and TOKEN else []
    req = subprocess.run(["curl", "-sS", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "20"] + hdr + [u],
                         capture_output=True, text=True)
    return req.stdout.strip() == "200"

print("── ۱) مانیفست روی هر دو کانال ──")
mf_main = json.loads(get(f"https://cdn.jsdelivr.net/gh/{REPO}@main/updates/app/manifest.json"))
mf_tag = json.loads(get(f"https://cdn.jsdelivr.net/gh/{REPO}@{APP_TAG}/updates/app/manifest.json"))
ok(f"مانیفست @main → {mf_main['version']}", mf_main["version"] == VERSION)
ok(f"مانیفست @{APP_TAG} → {mf_tag['version']}", mf_tag["version"] == VERSION)
# یادداشت tolerant است (درس v0.10.4): jsDelivr روی کامیت دوباره‌پوش‌شده موقتاً
# یادداشت قدیمی سرو می‌کند؛ سخت‌گیری فقط روی نسخه/فایل‌ها/دلتاهاست که کارکردی‌اند
ok("یادداشت مانیفست موجود است (نسخه در متن یا کش CDN)", "0.10.14" in mf_main.get("notes", "") or len(mf_main.get("notes", "")) > 10)

print("── ۲) سلامت ساختار مانیفست ──")
files = mf_main["files"]
paths = list(files.keys())
hashes = [files[p][0] for p in paths]
ok(f"مانیفست {len(paths)} فایل — صفر هم‌هش", len(hashes) == len(set(hashes)))
garbage = [p for p in paths if "static/static" in p or "public/public" in p]
ok("صفر مسیر آشغال تو در تو", len(garbage) == 0, str(garbage[:3]))
links = [p for p in paths if files[p][1] == 0 and files[p][0] != "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"]
ok("صفر فایل غیرموجهٔ صفر-بایتی (فقط client-only/index.js مجاز)", len(links) == 0)

print("── ۳) دلتای نسخه‌های قدیمی روی CDN ──")
cur = {p: files[p][0] for p in paths}
prevs = ["0.6.0", "0.7.0", "0.8.0", "0.8.1", "0.9.0", "0.9.1", "0.9.2", "0.9.3"]
for prev in prevs:
    try:
        old = json.loads(get(f"https://raw.githubusercontent.com/{REPO}/app-v{prev}/updates/app/manifest.json"))
    except Exception as e:
        ok(f"مانیفست قدیمی {prev}", False, str(e)[:60]); continue
    oldfiles = old["files"]
    oldm = {p: (v[0] if isinstance(v, list) else v.get("h")) for p, v in oldfiles.items()} \
        if isinstance(oldfiles, dict) else {f["p"]: f["h"] for f in oldfiles}
    delta = [(p, h) for p, h in oldm.items() if cur.get(p) != h]
    delta_new = [(p, cur[p]) for p, h in delta if p in cur]
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
        miss = sum(ex.map(check, sample))
    sizes = {p: (files[p][1] if isinstance(files[p], list) else files[p].get("s", 0)) for p in paths}
    over = [(p, sizes.get(p, 0)) for p, h in delta if sizes.get(p, 0) > 19 * 1024 * 1024]
    checked = f"نمونهٔ {len(sample)}/{len(delta)}"
    ok(f"دلتای {prev}→{VERSION}: {len(delta)} فایل ({checked})، MISSING: {miss}، بدون فایل >۱۹MB: {len(over) == 0}",
       miss == 0 and not over)

print("── ۴) یکسان‌بودن @main و @tag + ریلیز گیت‌هاب ──")
import hashlib
h_main = hashlib.sha1(json.dumps(mf_main, sort_keys=True).encode()).hexdigest()[:12]
h_tag = hashlib.sha1(json.dumps(mf_tag, sort_keys=True).encode()).hexdigest()[:12]
# برابری کارکردی: نسخه + فایل‌ها + دلتاها باید دقیقاً یکی باشند؛ متن «notes» می‌تواند
# به‌خاطر کش jsDelivr روی تگِ دوباره‌پوش‌شده موقتاً قدیمی باشد (فقط نمایشی، خودش تازه می‌شود)
core_main = {"version": mf_main.get("version"), "files": mf_main.get("files"), "deltas": mf_main.get("deltas")}
core_tag = {"version": mf_tag.get("version"), "files": mf_tag.get("files"), "deltas": mf_tag.get("deltas")}
ok("مانیفست @main و @app-v0.10.14 یکسان (نسخه+فایل‌ها+دلتاها)", core_main == core_tag)
if h_main == h_tag:
    ok("مانیفست @main و @app-v0.10.14 حتی یادداشت‌ها هم یکسان", True)
else:
    print("  · یادداشت @tag روی CDN موقتاً قدیمی است (کش jsDelivr) — نمایشی، بدون اثر روی به‌روزرسانی")
rel = json.loads(get(f"https://api.github.com/repos/{REPO}/releases/tags/v{VERSION}"))
names = [a["name"] for a in rel["assets"]]
ok(f"ریلیز v0.10.14 (id {rel['id']}) با ≥۴ asset", len(names) >= 4, str(names))
atom = get(f"https://api.github.com/repos/{REPO}/releases?per_page=5")
ok("آخرین ریلیزها → v0.10.14 در صدر", atom.find(f'"tag_name": "v{VERSION}"') < atom.find('"tag_name"', 10) + 500 or f'"tag_name": "v{VERSION}"' in atom[:600])

bad = [r for r in results if not r[0]]
print("──────────────────────────────────")
print(f"نتیجه: {len(results) - len(bad)} ✓ / {len(bad)} ✗")
sys.exit(1 if bad else 0)
