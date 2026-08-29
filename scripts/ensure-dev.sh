#!/bin/bash
# اطمینان از اینکه سرور توسعه روی پورت ۳۰۰۰ بالا است (برای فراخوانی‌های QA تک‌مرحله‌ای)
if curl -s -o /dev/null -m 2 http://localhost:3000; then
  exit 0
fi
cd /home/z/my-project
setsid bash -c 'exec ./node_modules/.bin/next dev -p 3000 > /home/z/my-project/dev.log 2>&1' < /dev/null > /dev/null 2>&1 &
for i in $(seq 1 40); do
  sleep 1
  if curl -s -o /dev/null -m 2 http://localhost:3000; then
    exit 0
  fi
done
echo "dev server failed to start" >&2
exit 1
