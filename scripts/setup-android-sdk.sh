#!/bin/bash
# Android SDK setup — در پس‌زمینه اجرا می‌شود
set -e
SDK=/home/z/android-sdk
cd /tmp
echo "[sdk] downloading cmdline-tools..."
curl -sSLo cmdtools.zip "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
rm -rf cmdline-tools && unzip -q cmdtools.zip
mkdir -p $SDK/cmdline-tools
mv cmdline-tools $SDK/cmdline-tools/latest
export ANDROID_HOME=$SDK
export PATH=$SDK/cmdline-tools/latest/bin:$PATH
echo "[sdk] accepting licenses..."
yes | sdkmanager --licenses > /dev/null 2>&1 || true
echo "[sdk] installing platform-tools, android-35, build-tools..."
yes | sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0" > /tmp/sdkmanager-install.log 2>&1
echo "[sdk] DONE"
