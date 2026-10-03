#!/usr/bin/env python3
# ═══ بستهٔ تدریس مدنی ۷ غایبی — نسخهٔ 1.0.3 ═══════════════════════════════════
# ۱) فیکس غلط‌های املایی/نگارشی (مرحن→راهن، مسیوط→مستأجر، اداء→ادا، شش‌تا→شش عقد،
#    معین→معیّن در متن غیرمستقیم، افزودن «سفه» جامانده در بازگویی مادهٔ ۹۵۴)
# ۲) بازچینی «هدف جلسه» — اهداف فشردهٔ (۱)(۲)(۳)(۴) → خط‌به‌خط برای پنل GoalSheet
# ۳) فایل جدید برای cache-busting کش jsDelivr (الگوی v1.0.2) + به‌روزرسانی مانیفست
import json, re, shutil, datetime, os

SRC = "updates/packs/course-tadris-madani7-ghayebi-02.json"
DST = "updates/packs/course-tadris-madani7-ghayebi-03.json"

d = json.load(open(SRC, encoding="utf-8"))
p = d["payload"]

def fix_text(t: str) -> str:
    # غلط‌های قطعی
    t = t.replace("مرحن", "راهن")
    t = t.replace("شخصِ مسیوط (مستأجر/مستعیر)", "شخصِ مستأجر (یا مستعیر)")
    t = t.replace("دین او را اداء کند", "دین او را ادا کند")
    t = t.replace("هر شش‌تا عقود تملیکی‌اند", "هر شش عقد تملیکی‌اند")
    # بازگویی مادهٔ ۹۵۴ — «سفه» جامانده بود (دو خط پایین‌تر، خود ماده آن را دارد)
    t = t.replace("تمام عقود اذنی به فوت و جنون و سفر (در مواردی که معتبر است) منفسخ می‌شوند",
                  "تمام عقود اذنی به فوت و جنون و سفه و سفر (در مواردی که معتبر است) منفسخ می‌شوند")
    # یکدست‌سازی تشدید: معین/نامعین → معیّن/نامعیّن (خارج از متن مستقیم قانون؛ «معینه» عنوان باب است و دست نمی‌خورد)
    t = re.sub(r"معین(?!ه)", "معیّن", t)
    return t

def fix_section(s: dict) -> dict:
    for k in ("body", "questionText", "suggestedAnswer", "title"):
        if k in s and isinstance(s[k], str):
            s[k] = fix_text(s[k])
    for k in ("bullets",):
        if k in s and isinstance(s[k], list):
            s[k] = [fix_text(x) for x in s[k]]
    # متن مستقیم مواد قانونی دست‌نخورده می‌ماند (جز «مرحن» که غلط تایپی قطعی است و «اداء»)
    if "law" in s and isinstance(s["law"], list):
        for lw in s["law"]:
            if isinstance(lw.get("text"), str):
                lw["text"] = lw["text"].replace("مرحن", "راهن").replace("اداء کند", "ادا کند")
    return s

# ── ۱) فیکس همهٔ بخش‌ها + متادیتای دوره ──
for ch in p["chapters"]:
    for l in ch["lessons"]:
        l["sections"] = [fix_section(s) for s in l.get("sections", [])]
        if isinstance(l.get("quiz"), list):
            for q in l["quiz"]:
                for k in ("q", "question", "text", "explanation", "topic"):
                    if isinstance(q.get(k), str):
                        q[k] = fix_text(q[k])
                if isinstance(q.get("options"), list):
                    q["options"] = [fix_text(o) if isinstance(o, str) else o for o in q["options"]]
                for k in ("choices", "answers"):
                    if isinstance(q.get(k), list):
                        q[k] = [fix_text(a) if isinstance(a, str) else a for a in q[k]]

# عنوان/زیرعنوان فصل‌ها هم مرتب شود
for ch in p["chapters"]:
    for k in ("title", "subtitle"):
        if isinstance(ch.get(k), str):
            ch[k] = fix_text(ch[k])

p["tagline"] = fix_text(p.get("tagline", ""))
p["description"] = fix_text(p.get("description", ""))

# ── ۲) بازچینی «هدف جلسه» ──
intro = p["chapters"][0]["lessons"][0]["sections"][0]
assert intro["type"] == "intro", intro["type"]
OLD_LEAD = "در پایان این جلسه باید بتوانی:"
body = intro["body"]
start = body.find(OLD_LEAD)
assert start != -1, "پاراگراف اهداف پیدا نشد"
intro["body"] = (
    body[:start]
    + "در پایان این جلسه باید بتوانی:\n"
    + "۱) عقد معیّن را از نامعیّن تشخیص دهی و بدانی هر کدام به کدام مواد احاله می‌شوند.\n"
    + "۲) تعریف عقد اذنی و سه مصداق قطعی آن (وکالت، عاریه و ودیعه) را بیان کنی.\n"
    + "۳) دو اثر «وابستگی اذن به اراده» را با مستند آن یعنی مادهٔ ۹۵۴ توضیح دهی.\n"
    + "۴) وثیقهٔ شخصی را از وثیقهٔ عینی جدا کنی و «حق عینی تبعی» را با مثال رهن توضیح دهی."
)

# ── ۳) نوشتن فایل جدید + مانیفست ──
payload = {"payload": p}
json.dump(payload, open(DST, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
size = os.path.getsize(DST)

mpath = "updates/manifest.json"
m = json.load(open(mpath, encoding="utf-8"))
m["version"] = "1.1.1"
m["generatedAt"] = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
m["notes"] = "تدریس مدنی ۷ غایبی (جلسهٔ ۱) نسخهٔ ۱.۰.۳ — اصلاح غلط‌های املایی و چیدمان تازهٔ «هدف جلسه»"
for pack in m["packs"]:
    if pack["id"] == "content-pack-tadris-madani7-ghayebi-01":
        pack["version"] = "1.0.3"
        pack["file"] = "packs/course-tadris-madani7-ghayebi-03.json"
        pack["size"] = size
        pack["courseId"] = p["id"]
        pack["notes"] = ("• اصلاح غلط‌های املایی و نگارشی (از جمله «راهن» در مادهٔ ۷۷۱)\n"
                         "• «هدف جلسه» با چیدمان تازه و مرتب — هدف‌ها یکی‌یکی و شماره‌دار\n"
                         "• افزودن «سفه» جامانده در بازگویی مادهٔ ۹۵۴ و یکدست‌سازی «معیّن»")
    elif pack["kind"] == "course" and "courseId" not in pack:
        # شناسهٔ دوره برای بسته‌های course دیگر — از فایل خودشان
        try:
            f = json.load(open("updates/" + pack["file"], encoding="utf-8"))
            pl = f.get("payload", f)
            if isinstance(pl, dict) and isinstance(pl.get("id"), str):
                pack["courseId"] = pl["id"]
        except Exception as e:
            print("کورس‌آی‌دی:", pack["id"], e)
json.dump(m, open(mpath, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("OK — فایل:", DST, f"({size} bytes) | مانیفست: v{m['version']}")
