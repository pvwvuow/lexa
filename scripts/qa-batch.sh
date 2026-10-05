#!/bin/bash
# ─── اجرای دسته‌ای QA روی سرور standalone — الگو: pkill + استارت + curl 200 + QA ───
# استفاده: bash scripts/qa-batch.sh <group>
#   group A: qa090-web qa090-table qa-more-sheet qa105 qa106
#   group B: qa103 qa108-lawsearch-ime qa-drawer-live qa109
set -u
cd /home/z/my-project
GROUP=${1:-A}

pkill -9 -f next-server 2>/dev/null; pkill -9 -f "standalone/server.js" 2>/dev/null; sleep 1

cd .next/standalone
(HOSTNAME=127.0.0.1 PORT=3210 NODE_ENV=production nohup node server.js > /tmp/standalone-qa.log 2>&1 &)
cd /home/z/my-project

UP=0
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3210/ 2>/dev/null || echo 000)
  if [ "$code" = "200" ]; then UP=1; break; fi
  sleep 0.5
done
if [ $UP -ne 1 ]; then echo "SERVER DID NOT COME UP"; tail -20 /tmp/standalone-qa.log; exit 1; fi
echo "server up (HTTP 200)"

FAILED=0
run_qa() {
  local f="$1"
  echo "── $f ──"
  if bun "scripts/$f" > "/tmp/qa-${f%.mjs}.log" 2>&1; then
    tail -2 "/tmp/qa-${f%.mjs}.log"
  else
    echo "✗✗ $f FAILED:"; tail -25 "/tmp/qa-${f%.mjs}.log"; FAILED=1
  fi
}

if [ "$GROUP" = "C" ]; then
  for f in qa110-law-nav-marks.mjs; do run_qa "$f"; done
elif [ "$GROUP" = "B2" ]; then
  for f in qa109-mark-handles.mjs; do run_qa "$f"; done
elif [ "$GROUP" = "A" ]; then
  for f in qa090-web.js qa090-table.js qa-more-sheet.mjs qa105-theme-progress.mjs qa106-auto-simple.mjs; do run_qa "$f"; done
else
  for f in qa103-bugfix.js qa108-lawsearch-ime.mjs qa-drawer-live.mjs qa109-mark-handles.mjs; do run_qa "$f"; done
fi

pkill -9 -f next-server 2>/dev/null; pkill -9 -f "standalone/server.js" 2>/dev/null
exit $FAILED
