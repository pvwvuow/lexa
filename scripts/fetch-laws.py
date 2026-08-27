#!/usr/bin/env python3
# دریافت متن قوانین از ویکی‌نبشته (fa.wikisource.org) و استخراج مواد
# خروجی: /tmp/laws/<id>.json  ← [{"no": "۱", "text": "..."}] به‌علاوه گزارش
import json, os, re, subprocess, sys, time, urllib.parse

API = "https://fa.wikisource.org/w/api.php"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36"
OUT = "/tmp/laws"
os.makedirs(OUT, exist_ok=True)

FA_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")

def curl_json(params, retries=3):
    qs = urllib.parse.urlencode(params)
    for i in range(retries):
        r = subprocess.run(
            ["curl", "-sL", "--max-time", "40", "-H", f"User-Agent: {UA}",
             f"{API}?{qs}&format=json"],
            capture_output=True, text=True)
        if r.returncode == 0 and r.stdout.strip():
            try:
                return json.loads(r.stdout)
            except json.JSONDecodeError:
                pass
        time.sleep(2 + i * 2)
    return None

def get_wikitext(title):
    d = curl_json({"action": "parse", "page": title, "prop": "wikitext"})
    if not d or "parse" not in d:
        return None
    return d["parse"]["wikitext"]["*"]

def get_subpages(prefix):
    """همهٔ زیرصفحه‌های یک عنوان (list=allpages&apprefix)"""
    pages, cont = [], {}
    while True:
        params = {"action": "query", "list": "allpages", "apprefix": prefix,
                  "apnamespace": 0, "aplimit": "max"}
        params.update(cont)
        d = curl_json(params)
        if not d:
            break
        for p in d.get("query", {}).get("allpages", []):
            pages.append(p["title"])
        cont = {"apcontinue": d["continue"]["apcontinue"]} if "continue" in d else {}
        if not cont:
            break
        time.sleep(1.2)
    return pages

WIKI_JUNK = [
    (re.compile(r"<ref[^>]*/>"), ""), (re.compile(r"<ref[^>]*>.*?</ref>", re.S), ""),
    (re.compile(r"\{\{[^{}]*\}\}"), ""), (re.compile(r"<[^>]+>"), " "),
    (re.compile(r"'{2,}"), ""), (re.compile(r"\[\[([^|\]]*\|)?([^\]]*)\]\]"), r"\2"),
    (re.compile(r"\{\{"), ""), (re.compile(r"\}\}"), ""),
    (re.compile(r"[ \t]+"), " "),
]

def clean(txt):
    for rx, rep in WIKI_JUNK:
        txt = rx.sub(rep, txt)
    return re.sub(r"\n{3,}", "\n\n", txt).strip()

NUM_MAP = {"۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
           "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9"}

def fa_num_to_int(s):
    s = s.translate(FA_DIGITS)
    try:
        return int(s)
    except ValueError:
        return None

ART_RX = re.compile(r"^\s*(?:''')?\s*(?:ماده|اصل)\s*ٔ?\s*([۰-۹0-9]+)\s*(?:مکرر)?\s*[-–—ـ:.：]?\s*", re.M)

def extract_articles(wikitext):
    """مواد را از ویکیتکست می‌کَند؛ خروجی [(num:int, text:str)]"""
    txt = wikitext
    # عنوان‌های بخش را جدا کن تا داخل متن مواد نیفتند
    txt = re.sub(r"^\{\{.*?\}\}\s*$", "", txt, flags=re.M | re.S)
    found = []
    matches = list(ART_RX.finditer(txt))
    for i, m in enumerate(matches):
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(txt)
        body = txt[start:end]
        # بریدن سرصفحه‌های ویکی در انتهای بلوک
        body = re.split(r"\n==+[^=]*==+\s*$", body)[0]
        body = re.split(r"\n\[\[?", body)[0]
        body = clean(body).strip().strip("-–—ـ:.").strip()
        # شماره تکراری ماده‌های «مکرر» را حفظ کن: به شکل no-ب suffix
        head = txt[m.start():m.end()]
        suffix = "مکرر" if "مکرر" in head else ""
        num = fa_num_to_int(m.group(1))
        if num is None:
            continue
        if len(body) < 25:  # خیلی کوتاه = شبه‌ماده
            continue
        found.append((num, suffix, body))
    return found

def to_fa(n):
    return str(n).translate(str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹"))

PROBE = sys.argv[1] if len(sys.argv) > 1 else ""
if PROBE:
    # حالت پروب: یک صفحه بگیر و ساختار را نشان بده
    wt = get_wikitext(PROBE)
    if not wt:
        print("NO PAGE", PROBE); sys.exit(1)
    arts = extract_articles(wt)
    print(f"== {PROBE}: {len(wt)} chars, {len(arts)} articles")
    for num, suf, body in arts[:2]:
        print(f"--- ماده {to_fa(num)}{suf}: {body[:180]}…")
    if arts:
        nums = [a[0] for a in arts]
        print("first/last num:", nums[0], nums[-1], "| sorted:", nums == sorted(nums))
    sys.exit(0)
