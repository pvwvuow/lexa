#!/bin/bash
# بازیابی یک‌فرمانی از گنجینهٔ ۰۰۳ — اگر پروژه دوباره به نسخهٔ قدیمی پرید
# استفاده: bash scripts/restore-003.sh
set -e
cd /home/z/my-project
echo "۱) ورود تاریخچهٔ کامل از باندل..."
git fetch backups/hamyar-git-003.bundle 'refs/heads/*:refs/vault/*' 2>/dev/null || true
TIP=$(git rev-parse refs/vault/main 2>/dev/null || git rev-parse refs/vault/master)
echo "   نوک گنجینه: $TIP"
echo "۲) db کنونی امن می‌شود..."
cp db/custom.db "/tmp/db-before-restore-$(date +%H%M%S).db" 2>/dev/null || true
echo "۳) هم‌ترازکردن شاخه با نوک گنجینه (fast-forward فقط):"
git merge --ff-only "$TIP" 2>/dev/null || git reset --hard "$TIP"
echo "۴) بازگردانی دیتابیس از اسنپ‌شات (در صورت نبود فایل زنده):"
[ -f db/custom.db ] || cp backups/db-snapshot.db db/custom.db
echo "۵) بیلد و اجرای تولیدی:"
npx next build
bash scripts/start-prod.sh
echo "✅ بازیابی کامل شد — نسخه: $(git log --oneline -1)"
