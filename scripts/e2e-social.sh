#!/usr/bin/env bash
# تست سرتاسری شبکهٔ اساتید: ادمین→استاد→مطلب→فالو→کامنت→دوره→کتابخانه
set -e
B=http://localhost:3000
J=/tmp/hh-jars
rm -rf $J && mkdir -p $J

echo "== 1) ورود مدیر =="
curl -s -c $J/admin.txt -X POST $B/api/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"hamyar@1404"}' | head -c 120; echo

echo "== 2) ایجاد حساب استاد =="
TEACHER_ID=$(curl -s -b $J/admin.txt -X POST $B/api/admin/teachers -H 'Content-Type: application/json' \
  -d '{"username":"ostad_e2e","password":"pass@1404","displayName":"دکتر آزمون"}' \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("teacher",{}).get("id",""))')
echo "teacherId=$TEACHER_ID"

echo "== 3) ورود استاد و انتشار مطلب با همهٔ المان‌ها =="
curl -s -c $J/t.txt -X POST $B/api/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"ostad_e2e","password":"pass@1404"}' >/dev/null
POST_RES=$(curl -s -b $J/t.txt -X POST $B/api/posts -H 'Content-Type: application/json' -d '{
 "title":"آزمون المان‌ها",
 "summary":"خلاصهٔ مطلب آزمایشی",
 "tags":"آزمون، بیع",
 "blocks":[
  {"type":"concept","body":"متن مفهومی.\nهشدار: این جمله باید به شکل المان هشدار رندر شود."},
  {"type":"law","law":[{"no":"۳۳۸","text":"بیع عبارت است از تملیک عین به عوض معلوم."}]},
  {"type":"notes","bullets":["ثبت سند: شرط صحت نیست","اخذ ثمن: تعلیق ندارد"]},
  {"type":"compare","table":{"headers":["ویژگی","بیع","اجاره"],"rows":[["عوض","ثمن | اجاره‌بها"]]}},
  {"type":"question","questionText":"آیا بیع فضولی صحیح است؟","suggestedAnswer":"با اجازهٔ مالک صحیح می‌شود."}
 ]}')
echo "$POST_RES"
POST_ID=$(echo "$POST_RES" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("id",""))')

echo "== 4) ساخت دوره توسط استاد =="
COURSE_RES=$(curl -s -b $J/t.txt -X POST $B/api/tcourses -H 'Content-Type: application/json' -d '{
 "title":"دورهٔ آزمون مسئولیت مدنی","tagline":"در ده جلسه","icon":"","accent":"bronze",
 "chapters":[{"title":"فصل اول","lessons":[{"title":"جلسهٔ ۱: مفهوم","sections":[{"type":"concept","body":"بدنهٔ جلسهٔ آزمون\n- نکته: تست لیست"},{"type":"notes","bullets":["نکتهٔ طلایی: حفظ کن"]}]}]}]}')
echo "$COURSE_RES"
COURSE_ID=$(echo "$COURSE_RES" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("id",""))')

echo "== 5) ثبت‌نام دانشجو، فالو، کامنت، افزودن دوره به کتابخانه =="
curl -s -c $J/s.txt -X POST $B/api/auth/register -H 'Content-Type: application/json' \
  -d '{"username":"student_e2e","password":"pass@1404"}' >/dev/null
curl -s -b $J/s.txt -X POST $B/api/social/follow -H 'Content-Type: application/json' -d "{\"teacherId\":\"$TEACHER_ID\"}"; echo
curl -s -b $J/s.txt -X POST $B/api/posts/$POST_ID/comments -H 'Content-Type: application/json' -d '{"text":"مطلب خیلی خوب بود"}'; echo
curl -s -b $J/s.txt -X POST $B/api/library -H 'Content-Type: application/json' -d "{\"courseId\":\"$COURSE_ID\"}"; echo

echo "== 6) بررسی فید شخصی دانشجو و کتابخانه =="
curl -s -b $J/s.txt $B/api/social/feed | python3 -c 'import sys,json;d=json.load(sys.stdin);print("feed showingAll:",d["showingAll"],"count:",len(d["posts"]))'
curl -s -b $J/s.txt $B/api/library | python3 -c 'import sys,json;d=json.load(sys.stdin);print("library ids:",d["ids"],"first book title:",d["courses"][0]["title"] if d["courses"] else None)'
FIRST_LESSON=$(curl -s -b $J/s.txt $B/api/library | python3 -c '
import sys,json
d=json.load(sys.stdin)
if d["courses"]:
    ch=d["courses"][0]["chapters"][0]
    print(ch["lessons"][0]["id"])
else: print("")')
echo "lessonId=$FIRST_LESSON"

echo "== 7) گاردها =="
curl -s -o /dev/null -w "guest-post:%{http_code}\n" -X POST $B/api/posts -H 'Content-Type: application/json' -d '{"title":"x","blocks":[{"type":"concept","body":"y"}]}'
STUDENT_CREATE=$(curl -s -b $J/s.txt -o /dev/null -w "%{http_code}" -X POST $B/api/admin/teachers -H 'Content-Type: application/json' -d '{"username":"hack_t","password":"12345678"}'); echo "student-create-teacher:$STUDENT_CREATE"
curl -s -b $J/admin.txt $B/api/admin/teachers | python3 -c 'import sys,json;d=json.load(sys.stdin);print("admin teachers count:",len(d["teachers"]))'

echo "IDS=$TEACHER_ID,$POST_ID,$COURSE_ID,$FIRST_LESSON" > /tmp/hh-e2e-ids
echo "== DONE =="
