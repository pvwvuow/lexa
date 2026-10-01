#!/usr/bin/env python3
# Task 55 — parse real VOKALAT 1388 exam booklet + official answer key from ekhtebar extraction
import re, json

SRC = '/tmp/extracted/exam/vokalat1388.txt'
OUT = '/home/z/my-project/scripts/extracted/vokalat-1388.json'

FA = '۰۱۲۳۴۵۶۷۸۹'
def fa2en(s):
    return s.translate(str.maketrans(FA, '0123456789'))

text = open(SRC, encoding='utf-8').read()

# ── isolate question region: from first "۱." up to "پاسخنامه" ──
q_start = text.find('۱.')
key_start = text.find('پاسخنامه آزمون وکالت ۱۳۸۸')
assert q_start > 0 and key_start > q_start, (q_start, key_start)
qregion = text[q_start:key_start]

# ── parse questions with sequence tracking ──
lines = qregion.split('\n')
questions = []   # list of {n, q, options[]}
cur = None       # current question dict
opt_idx = None   # which option we're on (0..3)

def newq(n, first):
    return {'n': n, 'q': first.strip(), 'options': ['', '', '', '']}

for ln in lines:
    s = ln.strip()
    if not s:
        continue
    s = re.sub(r'^\s*', '', s)
    # question start? e.g. "۱.در عقد رهن..." or "۲-مردی..." or "۱۰-. ..."? allow . - ـ -
    mq = re.match(r'^([۰-۹]{1,3})\s*[.\-ـ]\s*(.*)$', s)
    mo = re.match(r'^([۱۲۳۴])\s*\)\s*(.*)$', s)
    if mq and not mo:
        n = int(fa2en(mq.group(1)))
        expected = (cur['n'] + 1) if cur else 1
        if n == expected:
            if cur: questions.append(cur)
            cur = newq(n, mq.group(2))
            opt_idx = None
            continue
    if mo:
        d = '۱۲۳۴'.index(mo.group(1))
        if cur is not None and d == 0 and opt_idx is None:
            opt_idx = 0
            cur['options'][0] = mo.group(2).strip()
            continue
        elif cur is not None and opt_idx is not None and d == opt_idx + 1:
            opt_idx = d
            cur['options'][d] = mo.group(2).strip()
            continue
        # else fall through (misordered option → treat as continuation)
    # continuation line
    if cur is not None:
        if opt_idx is None:
            cur['q'] += ' ' + s
        else:
            cur['options'][opt_idx] += ' ' + s
if cur: questions.append(cur)

print(f'parsed {len(questions)} questions')
bad = [q['n'] for q in questions if any(not o.strip() for o in q['options'])]
print('questions with empty options:', bad)

# ── parse official answer key ──
kregion = text[key_start:]
sections = {}
cur_subj = None
for ln in kregion.split('\n'):
    s = ln.strip()
    s = re.sub(r'\(.*$', '', s).strip()   # strip annotations
    if not s:
        continue
    m = re.match(r'^([۰-۹]{1,3})\s*[….\-]+[ ]*([۱۲۳۴])$', s)
    if m:
        n = int(fa2en(m.group(1)))
        a = '۱۲۳۴'.index(m.group(2))
        if cur_subj: sections[cur_subj][n] = a
        continue
    for subj in ['حقوق مدنی', 'آیین دادرسی مدنی', 'حقوق تجارت', 'اصول استنباط', 'حقوق جزا', 'آئین دادرسی کیفری', 'آیین دادرسی کیفری']:
        if s == subj or (subj in s and len(s) <= len(subj) + 4):
            cur_subj = subj
            sections.setdefault(cur_subj, {})
            break

total_keys = sum(len(v) for v in sections.values())
print('key sections:', {k: len(v) for k, v in sections.items()}, 'total:', total_keys)

# ── merge ──
all_keys = {}
for v in sections.values():
    all_keys.update(v)
result = []
missing_key = []
for q in questions:
    a = all_keys.get(q['n'])
    if a is None:
        missing_key.append(q['n'])
        continue
    result.append({'n': q['n'], 'q': re.sub(r'\s+', ' ', q['q']).strip(),
                   'options': [re.sub(r'\s+', ' ', o).strip() for o in q['options']],
                   'answer': a})
print(f'final: {len(result)} questions with keys; missing key: {missing_key}')

# subject split
spans = [('حقوق مدنی', 1, 20), ('آیین دادرسی مدنی', 21, 40), ('حقوق تجارت', 41, 60),
         ('اصول استنباط حقوق اسلامی', 61, 80), ('حقوق جزای عمومی و اختصاصی', 81, 100),
         ('آیین دادرسی کیفری', 101, 120)]
for name, a, b in spans:
    cnt = sum(1 for r in result if a <= r['n'] <= b)
    print(f'  {name}: {cnt}')

json.dump({'questions': result, 'spans': spans}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('saved →', OUT)
