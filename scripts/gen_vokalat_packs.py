# -*- coding: utf-8 -*-
# Task 55 — generate TS data files for آزمون وکالت packs
import json, sys, os

sys.path.insert(0, '/home/z/my-project/scripts')
from why_1388_a import WHY_A
from why_1388_b import WHY_B
from why_1388_c import WHY_C
from why_1399 import WHY_1399, ANS_1399

OUT = '/home/z/my-project/src/lib/law/exam-packs'
data = json.load(open('/home/z/my-project/scripts/extracted/vokalat-1388.json'))
extra = json.load(open('/home/z/my-project/scripts/extracted/vokalat-extra.json'))
WHY = {**WHY_A, **WHY_B, **WHY_C}

def ts_str(s):
    return json.dumps(s, ensure_ascii=False)

def emit_mcq(name, var, header, items):
    lines = [f'import type {{ ExamMCQ }} from "../examPacks";', '', header, '', f'export const {var}: ExamMCQ[] = [']
    for it in items:
        lines.append('  {')
        lines.append(f'    q: {ts_str(it["q"])},')
        lines.append(f'    options: [{", ".join(ts_str(o) for o in it["options"])}],')
        lines.append(f'    answer: {it["answer"]},')
        lines.append(f'    why: {ts_str(it["why"])},')
        lines.append(f'    topic: {ts_str(it["topic"])},')
        lines.append('  },')
    lines.append('];')
    p = os.path.join(OUT, name)
    open(p, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    print(f'{name}: {len(items)} questions')

def mk(q, why, topic):
    return {'q': q['q'], 'options': q['options'], 'answer': q['answer'], 'why': why, 'topic': topic}

GROUPS = [
    ('mcq-vokalat-1388-madani.ts', 'vokalat1388Madani', 'حقوق مدنی', 1, 20,
     '// ─── آزمون وکالت ۱۳۸۸ (اسکودا) — درس حقوق مدنی (سوالات ۱ تا ۲۰) ───'),
    ('mcq-vokalat-1388-dadresi.ts', 'vokalat1388Dadresi', 'آیین دادرسی مدنی', 21, 40,
     '// ─── آزمون وکالت ۱۳۸۸ (اسکودا) — درس آیین دادرسی مدنی (سوالات ۲۱ تا ۴۰) ───'),
    ('mcq-vokalat-1388-tejarat.ts', 'vokalat1388Tejarat', 'حقوق تجارت', 41, 60,
     '// ─── آزمون وکالت ۱۳۸۸ (اسکودا) — درس حقوق تجارت (سوالات ۴۱ تا ۶۰) ───'),
    ('mcq-vokalat-1388-osool.ts', 'vokalat1388Osool', 'اصول استنباط', 61, 80,
     '// ─── آزمون وکالت ۱۳۸۸ (اسکودا) — درس اصول استنباط حقوق اسلامی (سوالات ۶۱ تا ۸۰) ───'),
    ('mcq-vokalat-1388-jaza.ts', 'vokalat1388Jaza', 'حقوق جزا', 81, 100,
     '// ─── آزمون وکالت ۱۳۸۸ (اسکودا) — درس حقوق جزای عمومی و اختصاصی (سوالات ۸۱ تا ۱۰۰) ───'),
    ('mcq-vokalat-1388-keyfri.ts', 'vokalat1388Keyfri', 'آیین دادرسی کیفری', 101, 120,
     '// ─── آزمون وکالت ۱۳۸۸ (اسکودا) — درس آیین دادرسی کیفری (سوالات ۱۰۱ تا ۱۲۰؛ سوال ۱۱۲ رسماً حذف شده) ───'),
]

qmap = {q['n']: q for q in data['questions']}
total = 0
for fname, var, branch, a, b, header in GROUPS:
    items, missing = [], []
    for n in range(a, b + 1):
        if n == 112:  # officially removed question
            continue
        q = qmap.get(n)
        w = WHY.get(n)
        if not q or not w:
            missing.append(n); continue
        items.append(mk(q, w[0], w[1]))
    if missing:
        print(f'!! {fname} missing: {missing}')
    emit_mcq(fname, var, header, items)
    total += len(items)

# ── 1399 madani (analytical key) ──
items = []
for q in extra['madani1399']:
    n = q['n']
    w = WHY_1399.get(n)
    if not w: print(f'!! 1399 missing why for Q{n}'); continue
    items.append({'q': q['q'], 'options': q['options'], 'answer': ANS_1399[n], 'why': w[0], 'topic': w[1]})
emit_mcq('mcq-vokalat-madani-1399.ts', 'vokalatMadani1399',
         '// ─── آزمون وکالت ۱۳۹۹ (اسکودا) — درس حقوق مدنی (سوالات ۱ تا ۲۰) ───\n// کلید بر اساس تحلیل مواد قانونی تنظیم شده است.',
         items)
total += len(items)

# ── 98 osool (with official explanations by مدرس) ──
items = []
for q in extra['osool98']:
    items.append({'q': q['q'], 'options': q['options'], 'answer': q['answer'], 'why': q['why'], 'topic': 'اصول عملیه و قیاس'})
emit_mcq('mcq-vokalat-osool-98.ts', 'vokalatOsool98',
         '// ─── آزمون وکالت ۱۳۹۸ (اسکودا) — درس اصول استنباط؛ پاسخ‌های تحلیلی (دکتر محمد فرامرزی) ───',
         items)
total += len(items)
print(f'TOTAL NEW QUESTIONS: {total}')
