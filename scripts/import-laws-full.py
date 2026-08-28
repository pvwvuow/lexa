#!/usr/bin/env python3
# وارد کردن متن کامل سه قانون (مدنی/تجارت/اساسی) از ویکی‌نبشته → data/laws-full.json
import importlib.util, json, os, re, time

spec = importlib.util.spec_from_file_location("fl", "/home/z/my-project/scripts/fetch-laws.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

OUT_PATH = "/home/z/my-project/data/laws-full.json"
os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)

HDG = re.compile(r"^={3,6}\s*([^=\n]+?)\s*={3,6}\s*$", re.M)

WORD_NUM = {
    "یک": 1, "یکم": 1, "اول": 1, "اوّل": 1, "دو": 2, "دوم": 2, "سه": 3, "سوم": 3,
    "چهار": 4, "چهارم": 4, "پنج": 5, "پنجم": 5, "شش": 6, "ششم": 6, "هفت": 7,
    "هفتم": 7, "هشت": 8, "هشتم": 8, "نه": 9, "نهم": 9, "ده": 10, "دهم": 10,
    "یازده": 11, "یازدهم": 11, "دوازده": 12, "دوازدهم": 12, "سیزده": 13, "سیزدهم": 13,
    "چهارده": 14, "چهاردهم": 14, "پانزده": 15, "پانزدهم": 15, "شانزده": 16, "شانزدهم": 16,
    "هفده": 17, "هفدهم": 17, "هجده": 18, "هجدهم": 18, "نوزده": 19, "نوزدهم": 19,
    "بیست": 20, "سی": 30, "چهل": 40, "پنجاه": 50, "شصت": 60, "هفتاد": 70,
    "هشتاد": 80, "نود": 90, "صد": 100, "یکصد": 100, "دویست": 200, "سیصد": 300,
    "چهارصد": 400, "پانصد": 500, "ششصد": 600, "هفتصد": 700, "هشتصد": 800, "نهصد": 900,
}

def word2int(s):
    """«صد و هفتاد و هفتم» ← 177؛ «اوّل» ← ۱"""
    s = s.strip().replace("\u200c", "").replace("ّ", "").strip()
    if s.endswith("م") and s not in WORD_NUM:
        s = s[:-1]
    if s in WORD_NUM:
        return WORD_NUM[s]
    total, cur = 0, 0
    for tok in re.split(r"\s+و\s+", s):
        v = WORD_NUM.get(tok)
        if v is None:
            return None
        if v == 100:
            total = (total + cur) * 1 if total else cur
            total = (total if total >= 100 else cur)
            total = v if total == 0 else total
            total = max(total, 100)
            cur = 0
        elif v >= 200:
            total = v
            cur = 0
        else:
            cur += v
    return total + cur

def extract_articles_with_chapters(wikitext):
    """مثل extract_articles ولی مرز فصل‌ها (== عناوین ==) را هم ثبت می‌کند؛
    عناوینی که خودشان ماده/اصل‌اند به نشانگر ماده تبدیل می‌شوند"""
    out = []
    txt = wikitext
    # ۱) عناوینِ ماده‌نما (== ماده ۹۷۶ - تبعه ایران ==) → خط ماده + عنوان به‌عنوان بدنه
    txt = re.sub(
        r"^={2,7}\s*(?:ماده|اصل)\s*ٔ?\s*([۰-۹0-9]+)\s*(مکرر)?\s*[-–—ـ:.：]?\s*([^=\n]*?)\s*={2,7}\s*$",
        lambda mm: f"\nماده {mm.group(1)} {mm.group(2) or ''}\n{mm.group(3).strip()}\n",
        txt, flags=re.M)
    # ۲) سایر عناوین → نشانگر فصل
    marks = []
    def sub_hdg(mm):
        marks.append((mm.start(), mm.group(1).strip()))
        return "\n@@HDG@@\n"
    # ڱ-ب) عناوین اصل با عدد حروفی (=== اصل اوّل ===)
    def repl_word(mm):
        n = word2int(mm.group(1))
        if n is None:
            return mm.group(0)
        return "\n\u0645\u0627\u062f\u0647 " + str(n) + "\n"
    txt = re.sub(r"^={2,7}\s*\u0627\u0635\u0644\s*\u0654?\s*([^=\n0-9\u06f0-\u06f9]+?)\s*={2,7}\s*$", repl_word, txt, flags=re.M)
    txt = re.sub(r"^={2,7}\s*([^=\n]+?)\s*={2,7}\s*$", sub_hdg, txt, flags=re.M)

    ART = re.compile(r"^\s*(?:''')?\s*(?:ماده|اصل)\s*ٔ?\s*([۰-۹0-9]+)\s*(مکرر)?\s*[-–—ـ:.：]?\s*", re.M)
    found = []
    ms = list(ART.finditer(txt))
    for i, mt in enumerate(ms):
        start = mt.end()
        end = ms[i + 1].start() if i + 1 < len(ms) else len(txt)
        body = txt[start:end].split("@@HDG@@")[0]
        body = m.clean(body).strip().strip("-–—ـ:.").strip()
        if len(body) < 25:
            continue
        num = m.fa_num_to_int(mt.group(1))
        if num is None:
            continue
        # فصل جاری = آخرین علامت پیش از این ماده
        cur = ""
        for pos, title in marks:
            if pos < mt.start():
                cur = title
            else:
                break
        found.append({"chapter": cur or "متون", "num": num,
                      "suffix": "مکرر" if mt.group(2) else "",
                      "text": body})
    return found

def fetch_many(titles):
    arts = []
    for t in titles:
        wt = m.get_wikitext(t)
        if not wt:
            print("  !! skip (no page):", t)
            continue
        got = extract_articles_with_chapters(wt)
        print(f"  · {t}: {len(got)} ماده")
        arts.extend(got)
        time.sleep(1.4)
    return arts

def group_books_medani(pages):
    """بر اساس «جلد N - کتاب M - عنوان [- قسمت K]» گروه‌بندی و مرتب می‌کند"""
    FA = str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")
    parsed = []
    for t in pages:
        mt = re.search(r"جلد\s*([۰-۹0-9]+)\s*-\s*کتاب\s*([۰-۹0-9]+)\s*-\s*در\s+(.+?)(?:\s*-\s*قسمت.*)?$", t)
        if "کتاب ۱ - در بیان اموال و مالکیت" in t:
            parsed.append((1, 1, 0, t, "در بیان اموال و مالکیت به طور کلی"))
            continue
        if "جلد ۳ - کتاب ۱ تا ۵ - در ادله اثبات دعوی" in t:
            parsed.append((3, 3, 0, t, "در ادله اثبات دعوی"))
            continue
        if "کتاب ۱ - در بیان اموال و مالکیت" in t:
            parsed.append((1, 1, 0, t, "در بیان اموال و مالکیت به طور کلی"))
            continue
        if "جلد ۳ - کتاب ۱ تا ۵ - در ادله اثبات دعوی" in t:
            parsed.append((3, 3, 0, t, "در ادله اثبات دعوی"))
            continue
        if not mt:
            continue
        j = int(mt.group(1).translate(FA))
        k = int(mt.group(2).translate(FA))
        title = "در " + mt.group(3).strip()
        part = 0
        pm = re.search(r"قسمت\s*([۰-۹0-9]+)", t)
        if pm:
            part = int(pm.group(1).translate(FA))
        parsed.append((j, k, part, t, title))
    parsed.sort()
    return parsed

def build():
    full = {}

    # ─── قانون مدنی ───
    print("== قانون مدنی ۱۳۱۳")
    pages = m.get_subpages("قانون مدنی ۱۳۱۳")
    pages = [p for p in pages if p != "قانون مدنی ۱۳۱۳"]  # صفحهٔ اصلی = مقدمه
    time.sleep(1.2)
    grouped = group_books_medani(pages)
    books = []
    cur_book_key = None
    seen = set()
    for j, k, part, title, btitle in grouped:
        wt = m.get_wikitext(title)
        if not wt:
            continue
        got = extract_articles_with_chapters(wt)
        got = [a for a in got if a["num"] not in seen and not seen.add(a["num"])]
        print(f"  · {title}: {len(got)} ماده")
        if not got:
            continue
        if cur_book_key != (j, k):
            ord_label = to_fa_ord(k)
            books.append({"title": f"کتاب {ord_label} — {btitle}", "chapters": []})
            cur_book_key = (j, k)
        # گروه‌بندی فصل‌ها با حفظ ترتیب
        chapters = {}
        order = []
        for a in got:
            c = a["chapter"] or "عمومی"
            if c not in chapters:
                chapters[c] = []
                order.append(c)
            chapters[c].append({"no": m.to_fa(a["num"]) + a["suffix"], "text": a["text"]})
        books[-1]["chapters"].extend(
            [{"title": c, "articles": chapters[c]} for c in order]
        )
        time.sleep(1.4)
    full["madani"] = {
        "articleWord": "ماده",
        "metaLabel": "متن کامل مصوب ۱۳۰۷–۱۳۱۴ (نسخهٔ ویکی‌نبشته)",
        "sourceUrl": "https://fa.wikisource.org/wiki/قانون_مدنی_۱۳۱۳",
        "books": books,
    }
    n_madani = sum(len(ch["articles"]) for b in books for ch in b["chapters"])
    print("  → مدنی:", n_madani, "ماده در", len(books), "کتاب")

    # ─── قانون تجارت ───
    print("== قانون تجارت")
    arts = fetch_many(["قانون تجارت"])
    chapters, order = {}, []
    for a in arts:
        c = a["chapter"] or "متون"
        if c not in chapters:
            chapters[c] = []
            order.append(c)
        chapters[c].append({"no": m.to_fa(a["num"]) + a["suffix"], "text": a["text"]})
    full["tejarat"] = {
        "articleWord": "ماده",
        "metaLabel": "متن کامل مصوب ۱۳۱۰ (نسخهٔ ویکی‌نبشته)",
        "sourceUrl": "https://fa.wikisource.org/wiki/قانون_تجارت",
        "books": [{"title": "متن مصوب", "chapters": [{"title": c, "articles": chapters[c]} for c in order]}],
    }
    print("  → تجارت:", sum(len(v) for v in chapters.values()), "ماده در", len(order), "فصل")

    # ─── قانون اساسی ───
    print("== قانون اساسی (مصوب ۱۳۶۸)")
    arts = fetch_many(["قانون اساسی جمهوری اسلامی ایران (مصوب ۱۳۶۸)"])
    chapters, order = {}, []
    for a in arts:
        c = a["chapter"] or "متون"
        if c not in chapters:
            chapters[c] = []
            order.append(c)
        chapters[c].append({"no": m.to_fa(a["num"]) + a["suffix"], "text": a["text"]})
    full["asasi"] = {
        "articleWord": "اصل",
        "metaLabel": "متن کامل مصوب ۱۳۵۸ با اصلاحیهٔ ۱۳۶۸ (ویکی‌نبشته)",
        "sourceUrl": "https://fa.wikisource.org/wiki/قانون_اساسی_جمهوری_اسلامی_ایران_(مصوب_۱۳۶۸)",
        "books": [{"title": "فصل‌های قانون اساسی", "chapters": [{"title": c, "articles": chapters[c]} for c in order]}],
    }
    print("  → اساسی:", sum(len(v) for v in chapters.values()), "اصل در", len(order), "فصل")

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(full, f, ensure_ascii=False)
    print("saved →", OUT_PATH, os.path.getsize(OUT_PATH), "bytes")

def to_fa_ord(n):
    words = {1: "اول", 2: "دوم", 3: "سوم", 4: "چهارم", 5: "پنجم", 6: "ششم",
             7: "هفتم", 8: "هشتم", 9: "نهم", 10: "دهم"}
    return words.get(n, m.to_fa(n))

if __name__ == "__main__":
    build()
