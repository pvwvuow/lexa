#!/usr/bin/env bash
# تست سیاست «هرگز پاک نشو» — نوشتن‌های ادغامی
BASE=http://localhost:3000
J1=/tmp/user1.jar

echo "═══ سناریو ۱) کاربر مدعی تکمیل یک جلسهٔ قبلاً نیمه‌کاره است ═══"
curl -s -b $J1 -X POST $BASE/api/user/sync -H 'Content-Type: application/json' \
  -d '{"progress":{"m-l1-2":{"status":"completed","sectionsSeen":8}}}' ; echo
curl -s -b $J1 $BASE/api/user/data | python3 -c "
import json,sys
p=json.load(sys.stdin)['snapshot']['progress']
print('m-l1-2 →', p['m-l1-2']['status'], '| seen:', p['m-l1-2']['sectionsSeen'])
"

echo "═══ سناریو ۲) دستگاه جدید با پیشرفت ضعیف می‌فرستد (نباید افت کند) ═══"
curl -s -b $J1 -X POST $BASE/api/user/sync -H 'Content-Type: application/json' \
  -d '{"progress":{"m-l1-2":{"status":"in-progress","sectionsSeen":1}},"quizAttempts":[],"activity":[],"notes":{}}' >/dev/null
curl -s -b $J1 $BASE/api/user/data | python3 -c "
import json,sys
p=json.load(sys.stdin)['snapshot']['progress']
ok = p['m-l1-2']['status']=='completed' and p['m-l1-2']['sectionsSeen']==8
print('m-l1-2 →', p['m-l1-2']['status'], '| seen:', p['m-l1-2']['sectionsSeen'], '→', '✅ حفظ شد' if ok else '❌ از بین رفت!')
"

echo "═══ سناریو ۳) اسنپ‌شات خالی کامل (شبیه reset) → هیچ چیز نباید پاک شود ═══"
curl -s -b $J1 -X POST $BASE/api/user/sync -H 'Content-Type: application/json' \
  -d '{"progress":{},"quizAttempts":[],"activity":[],"notes":{},"customCourses":[],"lastLocation":{},"streak":{"count":0,"lastDate":""}}' >/dev/null
curl -s -b $J1 $BASE/api/user/data | python3 -c "
import json,sys
d=json.load(sys.stdin)['snapshot']
n_lessons=len(d['progress']); n_att=len(d['progress']['m-l1-1']['quizAttempts']); n_act=len(d['activity'])
print(f'جلسات محفوظ: {n_lessons} | تست‌ها: {n_att} | روزهای فعالیت: {n_act}')
ok = n_lessons==2 and n_att==2 and n_act==2
print('✅ همه چیز ماندگار است' if ok else '❌ داده گم شد!')
"
