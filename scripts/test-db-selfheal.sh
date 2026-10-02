#!/bin/bash
# ─── تست خودترمیمی اسکیما: سرور استندالون با دیتابیس خالی/بی‌جدول ─────────────
cd /home/z/my-project

TESTDIR=$(mktemp -d /home/z/my-project/qa-dbheal.XXXX)
echo "test dir: $TESTDIR"

# سرور مستقل واقعی (مثل پکیج دسکتاپ) — بدون قالب و با دیتابیس بی‌جدول
cp -r .next/standalone "$TESTDIR/app"
rm -f "$TESTDIR/app/lexa-template.db"
python3 -c "
import sqlite3
c = sqlite3.connect('$TESTDIR/lexa.db')
c.execute('PRAGMA journal_mode=DELETE')
c.commit()
c.close()
print('empty db created (no tables)')
"

PORT=3177
cd "$TESTDIR/app"
DATABASE_URL="file:$TESTDIR/lexa.db" PORT=$PORT HOSTNAME=127.0.0.1 NODE_ENV=production \
  bun server.js > "$TESTDIR/server.log" 2>&1 &
SRV=$!
cd /home/z/my-project

trap 'kill $SRV 2>/dev/null; sleep 0.3; rm -rf "$TESTDIR"' EXIT

for i in $(seq 1 30); do
  sleep 0.5
  curl -s -m 2 "http://127.0.0.1:$PORT/" -o /dev/null 2>/dev/null && break
done

echo "── ۱) ثبت‌نام روی دیتابیس بی‌جدول:"
REG=$(curl -s -m 20 -X POST "http://127.0.0.1:$PORT/api/auth/register" -H "Content-Type: application/json" -d '{"username":"qa_heal_user","password":"heal123456"}')
echo "$REG" | head -c 250; echo
if echo "$REG" | grep -q '"user"'; then echo "PASS: register ok"; else echo "FAIL: register failed"; fi

echo "── ۲) ورود:"
LOGIN=$(curl -s -m 20 -X POST "http://127.0.0.1:$PORT/api/auth/login" -H "Content-Type: application/json" -d '{"username":"qa_heal_user","password":"heal123456"}')
echo "$LOGIN" | head -c 150; echo
if echo "$LOGIN" | grep -q '"user"'; then echo "PASS: login ok"; else echo "FAIL: login failed"; fi

echo "── ۳) sync دادهٔ کاربر:"
COOKIE=$(curl -s -i -m 20 -X POST "http://127.0.0.1:$PORT/api/auth/login" -H "Content-Type: application/json" -d '{"username":"qa_heal_user","password":"heal123456"}' | grep -i "^set-cookie" | sed 's/^[Ss]et-[Cc]ookie: //' | cut -d';' -f1)
SY=$(curl -s -m 20 -X POST "http://127.0.0.1:$PORT/api/user/sync" -H "Content-Type: application/json" -H "Cookie: $COOKIE" -d '{"progress":{"l1":{"status":"completed","sectionsSeen":8}},"quizAttempts":[],"activity":["2026-10-02"],"notes":{},"customCourses":[],"lastLocation":{},"streak":{"count":1,"lastDate":"2026-10-02"},"hiddenBuiltins":[],"marks":{}}')
echo "$SY" | head -c 150; echo
if echo "$SY" | grep -q 'savedAt'; then echo "PASS: sync ok"; else echo "FAIL: sync failed"; fi

echo "── جدول‌های ساخته‌شده:"
python3 -c "
import sqlite3
c = sqlite3.connect('$TESTDIR/lexa.db')
rows = [r[0] for r in c.execute(\"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'\")]
print(len(rows), 'tables:', ', '.join(sorted(rows)[:6]), '…')
"
echo "DONE"
