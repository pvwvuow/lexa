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
