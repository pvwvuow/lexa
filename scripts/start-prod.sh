#!/bin/bash
# سرو استندالون تولیدی روی ۳۰۰۰ — کانال پیش‌نمایش
pkill -f "next dev" 2>/dev/null
pkill -f "standalone/server.js" 2>/dev/null
# next عنوان پروسه را به «next-server (vX)» تغییر می‌دهد؛ با پورت هم بکش
pkill -f "next-server" 2>/dev/null
fuser -k 3000/tcp 2>/dev/null
sleep 1
cd /home/z/my-project
cp -r public .next/standalone/public 2>/dev/null
cp -r .next/static .next/standalone/.next/static 2>/dev/null
nohup setsid env PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/server.js >> /home/z/my-project/prod.log 2>&1 < /dev/null &
disown
for i in $(seq 1 20); do
  sleep 1
  if curl -s -o /dev/null -m 2 http://localhost:3000; then echo "PROD_READY"; exit 0; fi
done
echo "PROD_FAILED" >&2
exit 1
