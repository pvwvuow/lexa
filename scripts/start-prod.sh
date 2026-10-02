#!/bin/bash
# سرو استندالون تولیدی روی ۳۰۰۰ — کانال پیش‌نمایش
pkill -f "next dev" 2>/dev/null
pkill -f "standalone/server.js" 2>/dev/null
# next عنوان پروسه را به «next-server (vX)» تغییر می‌دهد؛ با پورت هم بکش
pkill -f "next-server" 2>/dev/null
fuser -k 3000/tcp 2>/dev/null
sleep 1
cd "$(dirname "$0")/.."
# ⚠️ cp -r داخل پوشهٔ موجود = تو در تو شدن (public/public و static/static) —
# منشأ آشغال مانیفست و کرش آپدیتر. اول پاک، بعد کپی:
rm -rf .next/standalone/public .next/standalone/.next/static
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static
# دیتابیس واقعی سرور — صریح ست می‌شود تا به .env استندالون (که دیگر کپی نمی‌شود) وابسته نباشد
nohup setsid env PORT=3000 HOSTNAME=0.0.0.0 DATABASE_URL="file:$PWD/db/custom.db" node .next/standalone/server.js >> "$HOME/lexa-prod.log" 2>&1 < /dev/null &
disown
for i in $(seq 1 20); do
  sleep 1
  if curl -s -o /dev/null -m 2 http://localhost:3000; then echo "PROD_READY"; exit 0; fi
done
echo "PROD_FAILED" >&2
exit 1
