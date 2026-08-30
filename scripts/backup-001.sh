#!/bin/bash
# بکاپ شمارهٔ ۱ از کل پروژه — منبع + گیت + دیتابیس (بدون node_modules/.next)
set -e
cd /home/z/my-project
STAMP=$(date +%Y%m%d-%H%M)
OUT="download/backup-001/hamyar-backup-001-$STAMP.tar.gz"
tar --exclude='node_modules' --exclude='.next' --exclude='download/backup-*' \
    --exclude='.zscreenshots' --exclude='tool-results' \
    -czf "$OUT" -C /home/z/my-project .
git bundle create "download/backup-001/hamyar-git-001-$STAMP.bundle" --all
ls -lh download/backup-001/ | tail -3
echo "BACKUP_DONE: $OUT"
