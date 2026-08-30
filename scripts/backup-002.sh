#!/bin/bash
# بکاپ شمارهٔ ۲ — پس از سه ریست مخرب و فعال‌شدن نگهبان درون‌سروری
# خروجی: download/backup-002/ (دیتابیس + آواتارها/مدیا + سورس tracked + README)
set -e
cd /home/z/my-project
DEST=download/backup-002
mkdir -p "$DEST"

echo "۱) دیتابیس (اسنپ‌شات سازگار VACUUM INTO)..."
node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  await p.\$queryRawUnsafe(\"VACUUM INTO '/home/z/my-project/download/backup-002/db-custom.db'\");
  const u=await p.user.count(); const po=await p.post.count();
  console.log('   کاربران:',u,'| مطالب:',po);
  await p.\$disconnect();
})().catch(e=>{console.error(e.message);process.exit(1)});
"

echo "۲) مدیا و داده‌های حجیم (data/)..."
tar czf "$DEST/data-uploads.tar.gz" data

echo "۳) سورس tracked (بدون node_modules/.next/.git)..."
git archive --format=tar.gz -o "$DEST/source-tracked.tar.gz" HEAD -- src public prisma data package.json next.config.ts tsconfig.json postcss.config.mjs eslint.config.mjs scripts

echo "۴) README..."
cat > "$DEST/README.md" << 'EOF'
# بکاپ شمارهٔ ۲ — ۸ شهریور ۱۴۰۵

سومین ریست محیط نشان داد دیتابیس untracked هر بار پاک می‌شود. این بکاپ بعد از
فعال‌شدن سیستم ضدریست گرفته شده است.

## محتوا
- `db-custom.db` — دیتابیس کامل (اسنپ‌شات سازگار VACUUM INTO): کاربران، مطالب، پیشرفت‌ها
- `data-uploads.tar.gz` — آواتارها و داده‌های `data/`
- `source-tracked.tar.gz` — کل سورس tracked در آخرین کامیت (git archive)
- تاریخچهٔ کامل گیت: در `backups/hamyar-git-003.bundle` (باندل گنجینهٔ ۰۰۳) + خود `.git` که از ریست جان می‌برد

## بازیابی
```bash
cp db-custom.db /home/z/my-project/db/custom.db   # یا: bash scripts/restore-003.sh
cd /home/z/my-project && tar xzf data-uploads.tar.gz -C .
npx next build && bash scripts/start-prod.sh
```
EOF

echo "۵) نتیجه:"
ls -la "$DEST/"
