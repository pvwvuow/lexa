#!/bin/bash
# فقط آماده‌سازی JDK + Android SDK (بدون بیلد وب — بیلد جدا انجام شده)
set -u
FAIL=0

# ── ۱) JDK 21 ──
if [ ! -x /home/z/jdk-21/bin/javac ]; then
  echo "[jdk] downloading Temurin 21..."
  curl -sSL --retry 3 -o /tmp/jdk21.tar.gz "https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse"
  if [ -s /tmp/jdk21.tar.gz ]; then
    echo "[jdk] extracting..."
    rm -rf /home/z/jdk-21 /tmp/jdk-21-extract && mkdir -p /tmp/jdk-21-extract
    tar -xzf /tmp/jdk21.tar.gz -C /tmp/jdk-21-extract
    mv /tmp/jdk-21-extract/jdk-* /home/z/jdk-21
    /home/z/jdk-21/bin/javac -version && echo "[jdk] OK"
  else
    echo "[jdk] DOWNLOAD FAILED"; FAIL=1
  fi
else
  echo "[jdk] already present"
fi

# ── ۲) Android cmdline-tools ──
if [ ! -d /home/z/android-sdk/cmdline-tools/latest ]; then
  echo "[sdk] downloading cmdline-tools..."
  curl -sSL --retry 3 -o /tmp/cmdtools.zip "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
  if [ -s /tmp/cmdtools.zip ]; then
    rm -rf /tmp/cmdline-tools && unzip -q /tmp/cmdtools.zip -d /tmp
    mkdir -p /home/z/android-sdk/cmdline-tools
    rm -rf /home/z/android-sdk/cmdline-tools/latest
    mv /tmp/cmdline-tools /home/z/android-sdk/cmdline-tools/latest
    echo "[sdk] cmdline-tools OK"
  else
    echo "[sdk] CMDTOOLS DOWNLOAD FAILED"; FAIL=1
  fi
else
  echo "[sdk] cmdline-tools already present"
fi

# ── ۳) کامپوننت‌های SDK (پلتفرم/بیلدتولز موردنیاز gradle) ──
export ANDROID_HOME=/home/z/android-sdk
export JAVA_HOME=/home/z/jdk-21
export PATH=$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH
if [ -x $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager ]; then
  yes | sdkmanager --licenses > /tmp/sdk-lic.log 2>&1 || true
  sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0" > /tmp/sdk-pkg.log 2>&1 && echo "[sdk] packages OK" || { echo "[sdk] PACKAGE INSTALL FAILED"; tail -5 /tmp/sdk-pkg.log; FAIL=1; }
fi

exit $FAIL
