#!/usr/bin/env bash
# تست چرخهٔ کامل احراز هویت و همگام‌سازی
BASE=http://localhost:3000
J1=/tmp/user1.jar; J2=/tmp/admin.jar
rm -f $J1 $J2

echo "═══ ۱) ثبت‌نام کاربر جدید ═══"
curl -s -c $J1 -X POST $BASE/api/auth/register -H 'Content-Type: application/json' \
  -d '{"username":"reza_test","password":"test1234"}' | head -c 300; echo

echo "═══ ۲) همگام‌سازی دادهٔ محلی (پیشرفت + تست + یادداشت) ═══"
curl -s -b $J1 -X POST $BASE/api/user/sync -H 'Content-Type: application/json' -d '{
  "progress": {
    "m-l1-1": {"status":"completed","sectionsSeen":8,"quizBest":85},
    "m-l1-2": {"status":"in-progress","sectionsSeen":3}
  },
  "quizAttempts": [
    {"lessonId":"m-l1-1","date":"2026-08-26","score":70},
    {"lessonId":"m-l1-1","date":"2026-08-27","score":85}
  ],
  "activity": ["2026-08-26","2026-08-27"],
  "notes": { "m-l1-1": [ {"id":"n1","text":"نکتهٔ مهم دربارهٔ حق شخصیت","createdAt":1766880000000} ] },
  "customCourses": [],
  "lastLocation": {"lessonId":"m-l1-2"},
  "streak": {"count":2,"lastDate":"2026-08-27"}
}' | head -c 200; echo

echo "═══ ۳) سینک تکراری (نباید تست‌ها را دوبرابر کند) ═══"
curl -s -b $J1 -X POST $BASE/api/user/sync -H 'Content-Type: application/json' \
  -d '{"quizAttempts":[{"lessonId":"m-l1-1","date":"2026-08-27","score":85}],"progress":{},"activity":[],"notes":{}}' | head -c 100; echo

echo "═══ ۴) بازیابی دادهٔ کاربر ═══"
curl -s -b $J1 $BASE/api/user/data | python3 -c "
import json,sys
d=json.load(sys.stdin)['snapshot']
print('progress keys:', sorted(d['progress'].keys()))
print('attempts:', len(d['progress']['m-l1-1']['quizAttempts']), d['progress']['m-l1-1']['quizAttempts'])
print('best:', d['progress']['m-l1-1'].get('quizBest'))
print('notes m-l1-1:', len(d['notes'].get('m-l1-1',[])))
print('activity:', d['activity'])
"

echo "═══ ۵) فرار از گارد ادمین (باید 403) ═══"
curl -s -o /dev/null -w "%{http_code}\n" -b $J1 $BASE/api/admin/users

echo "═══ ۶) ورود مدیر پیش‌فرض ═══"
curl -s -c $J2 -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"hamyar@1404"}' | head -c 200; echo

echo "═══ ۷) فهرست کاربران برای مدیر ═══"
curl -s -b $J2 $BASE/api/admin/users | python3 -c "
import json,sys
d=json.load(sys.stdin)
for u in d['users']:
    print(u['username'], u['role'], '| completed:',u['stats']['completed'],'quizzes:',u['stats']['quizzes'],'avgBest:',u['stats']['avgBest'],'days:',u['stats']['activityDays'])
print('totals:', d['totals'])
UID=$(python3 -c "import json;print([u['id'] for u in json.load(open('/dev/stdin'))['users'] if u['username']=='reza_test'][0])" <<< "$(curl -s -b $J2 $BASE/api/admin/users)")
echo "USER_ID=$UID" > /tmp/uid.sh
"

source /tmp/uid.sh
echo "═══ ۸) جزئیات کاربر reza_test ($USER_ID) ═══"
curl -s -b $J2 $BASE/api/admin/users/$USER_ID | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('lessonStates:', [(l['lessonId'],l['status']) for l in d['lessonStates']])
print('attempts:', [(a['lessonId'],a['score']) for a in d['quizAttempts']])
print('notes:', len(d['notes']), 'customBooks:', d['customCoursesCount'])
"

echo "═══ ۹) رمز اشتباه باید رد شود ═══"
curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"wrong"}' | head -c 150; echo

echo "ALL DONE ✅"
