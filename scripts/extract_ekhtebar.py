#!/usr/bin/env python3
# Task 55 — extract question text from ekhtebar HTML pages
import re, html as h, glob, os

os.chdir('/tmp')

def clean(path):
    raw = open(path, encoding='utf-8', errors='ignore').read()
    m = re.search(r'<article.*?</article>', raw, flags=re.S)
    seg = m.group(0) if m else raw
    seg = re.sub(r'<script[^>]*>.*?</script>', ' ', seg, flags=re.S)
    seg = re.sub(r'<style[^>]*>.*?</style>', ' ', seg, flags=re.S)
    seg = re.sub(r'<br\s*/?>', '\n', seg)
    seg = re.sub(r'</p>', '\n', seg)
    seg = re.sub(r'<[^>]+>', ' ', seg)
    seg = h.unescape(seg)
    seg = re.sub(r'[ \t\u200c]+', ' ', seg)
    seg = re.sub(r'\n\s*\n+', '\n', seg)
    return seg.strip()

mapping = {
    'ekh_1': 'vokalat95',
    'ekh_2': 'vokalat94-key',
    'ekh_3': 'vokalat1390',
    'ekh_4': 'vokalat1387',
    'ekh_5': 'vokalat1388',
    'ekh_6': 'vokalat91',
    'ekh_7': 'vokalat1391',
    'ekh_8': 'vokalat-official-answers',
    'ekh_9': 'vokalat1402-unofficial',
    'ekh_10': 'jaza98-explained',
    'ekh_11': 'osool98-explained',
    'page_20635': 'madani1399',
}
os.makedirs('extracted/exam', exist_ok=True)
for f in sorted(glob.glob('ekh_*.html')) + ['page_20635.html']:
    key = f.replace('.html', '')
    name = mapping.get(key, key)
    txt = clean(f)
    m = re.search(r'\n\s*۱[\-\.)]', txt) or re.search(r'\n\s*1[\-\.)]', txt)
    if m:
        txt = txt[m.start():]
    out = f'extracted/exam/{name}.txt'
    open(out, 'w', encoding='utf-8').write(txt)
    qn = len(re.findall(r'(?:^|\n)\s*[۰-۹0-9]{1,3}[\-\.)]', txt))
    opt = len(re.findall(r'[۱۲۳۴1234][\)\-]', txt))
    print(f'{name}: {len(txt)} chars, ~{qn} numbered lines, {opt} option markers')
