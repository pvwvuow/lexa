"use client";

// ثبت سرویس‌ورکر + پرچم آفلاین سراسری + موتور به‌روزرسانی خودکار نسخهٔ آفلاین — بدون رندر بصری
import * as React from "react";
import { useServiceWorkerRegistration, startOfflineAutoUpdate } from "@/lib/offline";
import { initContentPacks } from "@/lib/updater";

export function SwRegister() {
  useServiceWorkerRegistration();
  startOfflineAutoUpdate();
  // بسته‌های محتوایی نصب‌شده (دوره‌ها/دفترچه‌ها) را در استارتاپ در اپ ادغام می‌کند
  void initContentPacks();

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

  // ── خودرفرش پس از آپگرید سرویس‌ورکر ──────────────────────────────────────
  // اگر صفحه با سرویس‌ورکر «کهنه» بالا آمده باشد و سرویس‌ورکر «تازه» کنترل را
  // بگیرد (skipWaiting + clients.claim)، همین بار صفحه رفرش می‌شود تا پوستهٔ
  // جدید بلافاصله دیده شود — کاربر دیگر نسخهٔ کهنهٔ کش‌شده نمی‌بیند.
  React.useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    // اگر صفحه از ابتدا تحت کنترل هیچ SW نبود (اولین بازدید)، رفرش لازم نیست
    let hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    const onControllerChange = () => {
      if (reloading || !hadController) {
        hadController = true;
        return;
      }
      try {
        if (sessionStorage.getItem("lexa-sw-refresh") === "1") return;
        sessionStorage.setItem("lexa-sw-refresh", "1");
      } catch { /* حالت خصوصی مرورگر — بی‌خیال گارد */ }
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  // پرچم گاردِ رفرش پس از چند ثانیه پاک می‌شود تا آپگریدهای بعدیِ همان تب هم کار کنند
  React.useEffect(() => {
    const t = window.setTimeout(() => {
      try { sessionStorage.removeItem("lexa-sw-refresh"); } catch {}
    }, 15_000);
    return () => window.clearTimeout(t);
  }, []);

  return null;
}
