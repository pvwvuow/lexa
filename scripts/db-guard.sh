#!/bin/bash
# بکاپ فوریِ یک‌بارهٔ داده‌ها — برای اجرای دستی (نسخهٔ دیمن حذف شد: پلتفرم حلقه‌های bash را جمع می‌کند؛
# بکاپ دوره‌ای حالا داخل خود سرور next است: src/lib/data-guard.ts)
set -e
cd /home/z/my-project
node -e "
const {PrismaClient}=require('@prisma/client');
const fs=require('fs');
const p=new PrismaClient();
(async()=>{
  fs.rmSync('backups/db-snapshot.db',{force:true});
  await p.\$queryRawUnsafe(\"VACUUM INTO '/home/z/my-project/backups/db-snapshot.db'\");
  fs.copyFileSync('backups/db-snapshot.db','backups/db-safety.db');
  const users=await p.user.count(); const posts=await p.post.count();
  console.log('اسنپ‌شات گرفته شد — کاربران:',users,'| مطالب:',posts);
  await p.\$disconnect();
})().catch(e=>{console.error(e.message);process.exit(1)});
"
git add db/custom.db backups/db-snapshot.db backups/db-safety.db data 2>/dev/null || true
if ! git diff --cached --quiet; then
  git commit --quiet -m "db-guard(دستی): اسنپ‌شوت فوری داده‌ها ($(date +%H:%M))"
  echo "کامیت شد ✅"
else
  echo "بدون تغییر — کامیت لازم نبود"
fi
