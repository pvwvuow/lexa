#!/bin/bash
# ─── آماده‌سازی پیلود دسکتاپ — کپی مطمئن standalone برای electron-builder ───
# electron-builder در نسخه‌های 26.x با glob/filtr پوشه‌های نقطه‌دار و node_modules
# رفتار ناپایدار دارد؛ پس ما خودمان با rsync یک کپی تمیز می‌سازیم و yml فقط
# از همان کپی (بدون فیلتر) استفاده می‌کند.
# استثناها دقیقاً همان سیاست امنیتی قبلی electron-builder.yml است:
#   متون (از CDN گرفته می‌شود)، دیتابیس واقعی، بکاپ، آپلود، .env، کد توسعه
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=.next/standalone
DST=.next/electron-stage
rm -rf "$DST"
mkdir -p "$DST"
rsync -a "$SRC/" "$DST/" \
  --exclude=.next/cache \
  --exclude=public/texts \
  --exclude=db \
  --exclude=data \
  --exclude=backups \
  --exclude=out \
  --exclude=asr-demo \
  --exclude=download \
  --exclude=src \
  --exclude=scripts \
  --exclude=qa \
  --exclude='qa-*' \
  --exclude=shots \
  --exclude=tests \
  --exclude=skills \
  --exclude=tool-results \
  --exclude=upload \
  --exclude=updates \
  --exclude=assets \
  --exclude=prisma \
  --exclude=android \
  --exclude=telegram-bot \
  --exclude=web-landing \
  --exclude=electron-builder.yml \
  --exclude=supabase-schema.sql \
  --exclude='.env*'
echo "STAGED: $(du -sh $DST | cut -f1)"
[ -f "$DST/server.js" ] || { echo "server.js missing"; exit 1; }
[ -d "$DST/.next/static" ] || { echo ".next/static missing"; exit 1; }
[ -d "$DST/node_modules" ] || { echo "node_modules missing"; exit 1; }
echo "STAGE_OK"
