#!/bin/bash
# ─── آماده‌سازی محیط (JDK + Android SDK cmdtools) + بیلد وب — همهٔ موازی در یک فراخوانی ───
set -u
cd /home/z/my-project

FAIL=0

# ── ۱) JDK 21 ──
if [ ! -x /home/z/jdk-21/bin/javac ]; then
  echo "[jdk] downloading Temurin 21..."
  curl -sSL --retry 3 -o /tmp/jdk21.tar.gz "https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse" &
  JDK_PID=$!
else
  echo "[jdk] already present"
  JDK_PID=""
fi

# ── ۲) Android cmdline-tools ──
if [ ! -d /home/z/android-sdk/cmdline-tools/latest ]; then
  echo "[sdk] downloading cmdline-tools..."
  curl -sSL --retry 3 -o /tmp/cmdtools.zip "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip" &
  CT_PID=$!
else
  echo "[sdk] cmdline-tools already present"
  CT_PID=""
fi

# ── ۳) بیلد وب (standalone) ──
if [ -x .next/standalone/server.js ] && [ -f .next/standalone/package.json ]; then
  # بیلد تازه اگر sw.js یا سورس عوض شده باشد لازم است — همیشه بیلد کن
  echo "[build] rebuilding standalone..."
fi
bun run build > /tmp/next-build.log 2>&1 &
BUILD_PID=$!

# ── انتظار برای همه ──
BUILD_OK=1
wait $BUILD_PID || BUILD_OK=0
if [ $BUILD_OK -eq 1 ] && grep -q "Compiled successfully\|✓" /tmp/next-build.log; then
  echo "[build] DONE: $(ls -d .next/standalone/server.js 2>/dev/null && echo present)"
else
  echo "[build] FAILED — log tail:"; tail -20 /tmp/next-build.log; FAIL=1
fi

if [ -n "$JDK_PID" ]; then
  if wait $JDK_PID && [ -s /tmp/jdk21.tar.gz ]; then
    echo "[jdk] extracting..."
    rm -rf /home/z/jdk-21 /tmp/jdk-21-extract && mkdir -p /tmp/jdk-21-extract
    tar -xzf /tmp/jdk21.tar.gz -C /tmp/jdk-21-extract
    mv /tmp/jdk-21-extract/jdk-* /home/z/jdk-21
    /home/z/jdk-21/bin/javac -version && echo "[jdk] OK"
  else
    echo "[jdk] DOWNLOAD FAILED"; FAIL=1
  fi
fi

if [ -n "$CT_PID" ]; then
  if wait $CT_PID && [ -s /tmp/cmdtools.zip ]; then
    echo "[sdk] unzipping cmdline-tools..."
    rm -rf /tmp/cmdline-tools && unzip -q /tmp/cmdtools.zip -d /tmp
    mkdir -p /home/z/android-sdk/cmdline-tools
    rm -rf /home/z/android-sdk/cmdline-tools/latest
    mv /tmp/cmdline-tools /home/z/android-sdk/cmdline-tools/latest
    echo "[sdk] cmdline-tools OK"
  else
    echo "[sdk] CMDTOOLS DOWNLOAD FAILED"; FAIL=1
  fi
fi

exit $FAIL
