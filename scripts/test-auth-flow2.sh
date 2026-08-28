#!/usr/bin/env bash
BASE=http://localhost:3000
J2=/tmp/admin.jar
echo "═══ ۷) فهرست کاربران برای مدیر ═══"
curl -s -b $J2 $BASE/api/admin/users > /tmp/users.json
python3 -c "
import json
d=json.load(open('/tmp/users.json'))
for u in d['users']:
    print(u['username'], u['role'], '| completed:',u['stats']['completed'],'quizzes:',u['stats']['quizzes'],'avgBest:',u['stats']['avgBest'],'days:',u['stats']['activityDays'])
print('totals:', d['totals'])
uid=[u['id'] for u in d['users'] if u['username']=='reza_test'][0]
open('/tmp/uid.txt','w').write(uid)
"
TUID=$(cat /tmp/uid.txt)
echo "═══ ۸) جزئیات کاربر reza_test ($TUID) ═══"
curl -s -b $J2 $BASE/api/admin/users/$TUID | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('lessonStates:', [(l['lessonId'],l['status']) for l in d['lessonStates']])
print('attempts:', [(a['lessonId'],a['score']) for a in d['quizAttempts']])
print('notes:', len(d['notes']), '| customBooks:', d['customCoursesCount'])
print('activityDays:', d['activityDays'])
"
echo "═══ ۹) تغییر اطلاعات مدیر (رمز فعلی غلط → رد) ═══"
curl -s -b $J2 -X POST $BASE/api/admin/account -H 'Content-Type: application/json' \
  -d '{"currentPassword":"wrong","newPassword":"newpass99"}' ; echo
echo "DONE ✅"
