# -*- coding: utf-8 -*-
"""ساخت بستهٔ محتوایی «تدریس مدنی ۷ — استاد غایبی، جلسهٔ ۱»
۱) نوشتن updates/packs/course-tadris-madani7-ghayebi-01.json
۲) افزودن ردیف بسته به updates/manifest.json (بامپ نسخهٔ مانیفست)
۳) آینه‌سازی به public/updates/ (کپی همان پوشه)
۴) اعتبارسنجی شبیه به validCourse در src/lib/updater.ts
اجرا: python3 scripts/build-tadris-md7-pack.py"""
import json, os, shutil, sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tadris_md7_s1_content import SECTIONS, QUIZ

ROOT = "/home/z/my-project"
PACK_DIR = os.path.join(ROOT, "updates/packs")
MIRROR_DIR = os.path.join(ROOT, "public/updates")
PACK_FILE = "packs/course-tadris-madani7-ghayebi-02.json"
PACK_PATH = os.path.join(PACK_DIR, os.path.basename(PACK_FILE))

COURSE_ID = "course-tadris-madani7-ghayebi"
PACK_ID = "content-pack-tadris-madani7-ghayebi-01"
PACK_VERSION = "1.0.2"

payload = {
    "id": COURSE_ID,
    "title": "تدریس مدنی ۷ — استاد غایبی",
    "tagline": "پیاده‌سازی کلاس حضوری عقود معین — عقود اذنی، وثیقه‌ای و مشارکتی، جلسه‌به‌جلسه",
    "description": (
        "دورهٔ تدریس حقوق مدنی ۷ (عقود معین: اذنی، وثیقه‌ای و مشارکتی) از کلاس حضوری استاد غایبی — "
        "ضبط کلاس با هوش مصنوعی به متن تبدیل، حاشیه‌های غیردرسی حذف و مطالب بازآرایی و ویرایش شده است.\n\n"
        "سرفصل دوره:\n"
        "• عقود اذنی — وکالت، عاریه و ودیعه؛ شرکت و مضاربه (اختلافی)\n"
        "• عقود وثیقه‌ای — ضمان، رهن، حواله و کفالت؛ وثیقهٔ شخصی و عینی\n"
        "• وابستگی اذن به اراده و مستند آن، مادهٔ ۹۵۴ قانون مدنی\n\n"
        "هر جلسه شامل:\n"
        "• متن درس مرتب با مثال‌های خودِ کلاس\n"
        "• جدول مقایسه و مستندات ماده‌به‌ماده\n"
        "• کوئیز ۱۰ سؤالی با پاسخ تشریحی"
    ),
    "icon": "BookOpen",
    "accent": "green",
    "origin": "imported",
    "sourceLabel": "ضبط کلاس حضوری استاد غایبی — پیاده‌سازی و ویرایش با هوش مصنوعی (Lexa)",
    "chapters": [
        {
            "id": "ch-md7g-01",
            "order": 1,
            "title": "جلسهٔ ۱ — مدخل مدنی ۷",
            "subtitle": "معین و نامعین؛ وکالت، عاریه و ودیعه؛ اذن و اراده (مادهٔ ۹۵۴)؛ وثیقهٔ شخصی و عینی",
            "lessons": [
                {
                    "id": "ls-md7g-01",
                    "title": "جلسهٔ ۱ — نقشهٔ مدنی ۷؛ عقود اذنی و وثیقه‌ای",
                    "minutes": 40,
                    "sections": SECTIONS,
                    "quiz": QUIZ,
                }
            ],
        }
    ],
}

# ─── اعتبارسنجی شبیه validCourse + قوام داده‌ها ───
assert isinstance(payload["id"], str) and isinstance(payload["title"], str) and isinstance(payload["chapters"], list)
assert len(QUIZ) == 10, "کوئیز باید ۱۰ سؤال باشد"
valid_types = {"intro", "concept", "law", "notes", "example", "compare", "summary", "question"}
for s in SECTIONS:
    assert s["type"] in valid_types, f"type نامعتبر: {s['type']}"
for q in QUIZ:
    assert [o["key"] for o in q["options"]] == ["a", "b", "c", "d"]
    assert q["answer"] in "abcd"
    assert len(q["explanation"]) > 40
# یکتایی شناسه‌ها
sids = [s["id"] for s in SECTIONS]
assert len(sids) == len(set(sids)), "id بخش‌ها تکراری است"

os.makedirs(PACK_DIR, exist_ok=True)
body = {"payload": payload}
with open(PACK_PATH, "w", encoding="utf8") as f:
    json.dump(body, f, ensure_ascii=False, indent=1)
size = os.path.getsize(PACK_PATH)

# ─── مانیفست ───
mf_path = os.path.join(ROOT, "updates/manifest.json")
mf = json.load(open(mf_path, encoding="utf8"))
mf["packs"] = [p for p in mf["packs"] if p["id"] != PACK_ID]
row = {
    "id": PACK_ID,
    "kind": "course",
    "version": PACK_VERSION,
    "title": "بستهٔ برخط — تدریس مدنی ۷ (استاد غایبی): جلسهٔ ۱",
    "description": (
        "جلسهٔ اول کلاس حضوری مدنی ۷ استاد غایبی: عقد معین و نامعین، نقشهٔ مدنی ۵ تا ۸، "
        "تعریف و مصادیق عقود اذنی (وکالت، عاریه، ودیعه)، عقود اختلافی (شرکت و مضاربه)، "
        "وابستگی اذن به اراده با نقد مادهٔ ۹۵۴، و مدخل عقود وثیقه‌ای — با مثال‌های خود کلاس و کوئیز."
    ),
    "file": PACK_FILE,
    "size": size,
}
mf["packs"].append(row)
mf["version"] = "1.1.0"
mf["generatedAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
mf["notes"] = "بستهٔ تدریس مدنی ۷ استاد غایبی (جلسهٔ ۱) + دفترچهٔ تستی حقوق مدنی + مینی‌دورهٔ مبانی حقوق"
json.dump(mf, open(mf_path, "w", encoding="utf8"), ensure_ascii=False, indent=1)

# ─── آینهٔ public/updates ───
os.makedirs(os.path.join(MIRROR_DIR, "packs"), exist_ok=True)
shutil.copy2(PACK_PATH, os.path.join(MIRROR_DIR, "packs", os.path.basename(PACK_FILE)))
shutil.copy2(mf_path, os.path.join(MIRROR_DIR, "manifest.json"))

# ─── گزارش ───
words = sum(len(str(s.get("body", "")).split()) + sum(len(b.split()) for b in s.get("bullets", [])) for s in SECTIONS)
print(f"✓ بسته: {PACK_PATH} — {size/1024:.1f} KB")
print(f"  دوره: {payload['title']} | باب: جلسهٔ ۱ | درس: {len(SECTIONS)} بخش + {len(QUIZ)} سؤال کوئیز | ~{words} واژه")
print(f"✓ مانیفست: نسخهٔ {mf['version']} — {len(mf['packs'])} بسته")
for p in mf["packs"]:
    print(f"   • {p['id']} ({p['kind']}, v{p['version']})")
print("✓ آینهٔ public/updates همگام شد")
