"use client";

// ثبت سرویس‌ورکر + پرچم آفلاین سراسری + موتور به‌روزرسانی خودکار نسخهٔ آفلاین — بدون رندر بصری
import * as React from "react";
import { useServiceWorkerRegistration, startOfflineAutoUpdate } from "@/lib/offline";

export function SwRegister() {
  useServiceWorkerRegistration();
  startOfflineAutoUpdate();

  // بررسی دوره‌ای نسخهٔ سرویس‌ورکر — تا اپ تازه (مثلاً نصب‌شدهٔ PWA) هم خودش را آپدیت کند
  React.useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const iv = window.setInterval(() => {
      navigator.serviceWorker
        .getRegistration()
        .then((reg) => reg?.update().catch(() => {}))
        .catch(() => {});
    }, 30 * 60 * 1000); // هر ۳۰ دقیقه
    return () => window.clearInterval(iv);
  }, []);

  return null;
}
