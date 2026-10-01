#!/usr/bin/env python3
# Task 55 — parse madani 1399 (no key; answers authored later) + osool/jaza 98 explained
import re, json

def fa2en(s):
    return s.translate(str.maketrans('۰۱۲۳۴۵۶۷۸۹', '0123456789'))

def parse_numbered(text, start_pat=r'^([۰-۹]{1,3})\s*[\-\.ـ]\s*(.*)$'):
    """Generic parser: questions N-..., options ۱)... ۴)"""
    lines = text.split('\n')
    questions, cur, opt_idx = [], None, None
    for ln in lines:
        s = ln.strip()
        if not s or s in ('*', '*در برخی دفترچه های اشتباها «زوجه» تایپ شده است.'):
            continue
        mq = re.match(start_pat, s)
        mo = re.match(r'^([۱۲۳۴])\s*\)\s*(.*)$', s)
        if mq and not mo:
            n = int(fa2en(mq.group(1)))
            expected = (cur['n'] + 1) if cur else 1
            if n == expected:
                if cur: questions.append(cur)
                cur = {'n': n, 'q': mq.group(2).strip(), 'options': ['', '', '', '']}
                opt_idx = None
                continue
        if mo and cur is not None:
            d = '۱۲۳۴'.index(mo.group(1))
            if (d == 0 and opt_idx is None) or d == (opt_idx if opt_idx is not None else -1) + 1:
                opt_idx = d
                cur['options'][d] = mo.group(2).strip()
                continue
        if cur is not None:
            if opt_idx is None:
                cur['q'] += ' ' + s
            else:
                cur['options'][opt_idx] += ' ' + s
    if cur: questions.append(cur)
    for q in questions:
        q['q'] = re.sub(r'\s+', ' ', q['q']).strip()
        q['options'] = [re.sub(r'\s+', ' ', o).strip() for o in q['options']]
    return questions

# ── madani 1399 ──
t = open('/tmp/extracted/exam/madani1399.txt', encoding='utf-8').read()
q1 = t.find('۱- بر اساس قانون بیمه')
t = t[q1:]
# cut trailing page chrome
for cut_kw in ['دیدگاه', 'نوشته', 'برچسب ها', 'کپی لینک']:
    j = t.find(cut_kw)
    if j > 0: t = t[:j]
qs = parse_numbered(t)
print('madani1399:', len(qs), 'questions')
bad = [q['n'] for q in qs if any(not o.strip() for o in q['options'])]
print('  empty-option questions:', bad)

# ── osool 98 explained (options are الف:/ب:/ج:/د:) ──
t2 = open('/tmp/extracted/exam/osool98-explained.txt', encoding='utf-8').read()
i = t2.find('۱ـ در فرض تزاحم')
t2 = t2[i:]
out2 = []
for blk in re.split(r'\n(?=\s*[۰-۹]{1,3}\s*[\-ـ])', t2):
    blk = blk.strip()
    if not blk: continue
    mq = re.match(r'^([۰-۹]{1,3})\s*[\-ـ]\s*(.*)', blk, flags=re.S)
    if not mq: continue
    body = mq.group(2)
    mp = re.search(r'پاسخ[:\.]\s*(.*)$', body, flags=re.S)
    if not mp: continue
    pre = body[:mp.start()]
    # split options by markers الف/ب/ج/د followed by colon/dot
    parts = re.split(r'(?:^|\s)(الف|ب|ج|د)[:\.]\s*', pre, flags=re.S)
    # parts structure: [qtext, 'الف', opt1, 'ب', opt2, 'ج', opt3, 'د', opt4]
    if len(parts) < 9: continue
    qtext, opts = parts[0].strip(), [parts[2], parts[4], parts[6], parts[8]]
    if any(not o.strip() for o in opts): continue
    ans_txt = mp.group(1).strip()
    m_ans = re.search(r'گزینه\s*«?\s*(الف|ب|ج|د)', ans_txt)
    if not m_ans: continue
    letter = m_ans.group(1)
    ans = {'الف':0,'ب':1,'ج':2,'د':3}[letter]
    out2.append({'n': int(fa2en(mq.group(1))), 'q': re.sub(r'\s+',' ',qtext), 'options': [re.sub(r'\s+',' ',o) for o in opts], 'answer': ans, 'why': re.sub(r'\s+',' ',ans_txt)})
print('osool98:', len(out2), 'questions')

json.dump({'madani1399': qs, 'osool98': out2}, open('/home/z/my-project/scripts/extracted/vokalat-extra.json','w',encoding='utf-8'), ensure_ascii=False, indent=1)
print('saved → vokalat-extra.json')
