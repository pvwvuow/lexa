#!/bin/bash
# نگهبان دیتابیس — هر ۵ دقیقه وضعیت زندهٔ db/custom.db را در گیت امن می‌کند
# تا هیچ ریست محیطی دیگر دادهٔ کاربران را پاک نکند (سیاست پس از بازیابی دوم، ۳۰ مرداد ۱۴۰۵)
# اجرا: setsid nohup bash scripts/db-guard.sh >/dev/null 2>&1 &
set -u
cd /home/z/my-project
LOCK=/tmp/db-guard.lock
# جلوگیری از اجرای دوباره (اجازهٔ ۱۰ دقیقه تجاوز عمر لاک برای ریکاوری پس از ریست)
if [ -f "$LOCK" ]; then
  AGE=$(( $(date +%s) - $(stat -c %Y "$LOCK" 2>/dev/null || echo 0) ))
  [ "$AGE" -lt 600 ] && exit 0
fi
echo $$ > "$LOCK"
trap 'rm -f "$LOCK"' EXIT

while true; do
  sleep 300
  # ۱) کپی امن دیتابیس زنده (فقط اگر سالم باشد — جدول User باید موجود باشد)
  if [ -f db/custom.db ] && node -e "
    const {PrismaClient}=require('@prisma/client');
    const p=new PrismaClient();
    p.user.count().then(c=>{console.log(c);process.exit(0)}).catch(()=>process.exit(1));
  " >/dev/null 2>&1; then
    cp db/custom.db backups/db-snapshot.db
    cp db/custom.db backups/db-safety.db
    # ۲) کامیت بی‌صدا فقط اگر تغییری باشد
    git add db/custom.db backups/db-snapshot.db backups/db-safety.db 2>/dev/null
    if ! git diff --cached --quiet 2>/dev/null; then
      git commit --quiet -m "db-guard: اسنپ‌شوت خودکار دیتابیس زنده ($(date +%H:%M))" 2>/dev/null
    fi
  fi
done
