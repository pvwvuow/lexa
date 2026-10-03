#!/bin/bash
# ─── بیلد کامل APK اندروید Lexa ──────────────────────────────────────────────
# مراحل: پارک مسیرهای API → اکسپورت ایستا → بازگردانی → cap sync → gradle release
# پیش‌نیاز: ANDROID_HOME + JAVA_HOME (JDK کامل) تنظیم باشد.
set -e
cd /home/z/my-project

export ANDROID_HOME=${ANDROID_HOME:-/home/z/android-sdk}
export JAVA_HOME=${JAVA_HOME:-/home/z/jdk-21.0.5+11}
export PATH=$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH

echo "[1/5] پارک موقت مسیرهای API…"
rm -rf .api-parked
mv src/app/api .api-parked
trap 'if [ -d .api-parked ]; then rm -rf src/app/api; mv .api-parked src/app/api; echo "API restored"; fi' EXIT

echo "[2/5] اکسپورت ایستا (NEXT_PUBLIC_APP_MODE=apk)…"
rm -rf out
bun run build:apk

echo "[3/5] بازگردانی API و سینک کاپاسییتور…"
rm -rf src/app/api
mv .api-parked src/app/api
trap - EXIT

bunx cap sync android

echo "[4/5] بیلد گریدل (release)…"
cd android
./gradlew assembleRelease --no-daemon -q

echo "[5/5] آماده‌سازی خروجی…"
APK=app/build/outputs/apk/release/app-release.apk
ls -la $APK
mkdir -p ../download/android
cp $APK "../download/android/Lexa-${VERSION:-0.7.0}.apk"
echo "APK_READY: download/android/Lexa-${VERSION:-0.7.0}.apk"
