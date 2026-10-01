"use client";

/* ─── Lexa — لایهٔ رندرر برای به‌روزرسانی درون‌برنامه‌ای برنامهٔ دسکتاپ ──────
 *
 * ارتباط با window.lexaDesktop (پل preload.js):
 *   • status()  → وضعیت دسکتاپ (نسخه، پلتفرم)
 *   • check()   → بررسی مانیفست مخزن و تفاوت با نسخهٔ نصب‌شده
 *   • apply()   → دانلود فقط فایل‌های تغییریافته + اعمال + آمادهٔ ری‌استارت
 *   • onEvent() → رویدادهای بررسی بی‌صدای استارتاپ و پیشرفت دانلود
 *
 * فقط در اپ الکترون فعال است؛ در وب/PWA کاربردی ندارد.
 * ─────────────────────────────────────────────────────────────────────── */

import * as React from "react";

/* ─── تایپ‌ها ─────────────────────────────────────────────────────────────── */

export interface DesktopStatus {
  desktop: boolean;
  platform: string;
  version: string;
  /** اجرا از لایهٔ appdata یعنی قبلاً یک آپدیت درون‌برنامه‌ای نصب شده */
  fromAppdata: boolean;
  feedOverride: boolean;
}

export interface AppUpdateCheck {
  available: boolean;
  currentVersion: string;
  remoteVersion: string;
  notes: string;
  generatedAt: string;
  /** تعداد فایل‌هایی که باید دانلود شوند (دلتا) */
  filesChanged: number;
  /** حجم دلتا به بایت */
  bytesChanged: number;
  deletes: number;
  tag: string;
}

export interface ApplyProgress {
  phase: "prepare" | "base" | "download" | "commit";
  copiedBytes?: number;
  totalBytes?: number;
  filesDone?: number;
  filesTotal?: number;
  bytesDone?: number;
  bytesTotal?: number;
  currentFile?: string;
}

export type LexaUpdateEvent =
  | { type: "check"; check: AppUpdateCheck }
  | { type: "apply:progress"; phase: ApplyProgress["phase"]; [k: string]: unknown }
  | { type: "apply:done"; version: string }
  | { type: "apply:error"; message: string };

declare global {
  interface Window {
    lexaDesktop?: {
      status(): Promise<DesktopStatus>;
      check(): Promise<AppUpdateCheck>;
      apply(): Promise<{ ok: boolean; version: string; changed: number }>;
      restart(): Promise<void>;
      onEvent(cb: (e: LexaUpdateEvent) => void): () => void;
    };
  }
}

/** آیا داخل اپ دسکتاپ الکترون هستیم؟ */
export function isDesktop(): boolean {
  return typeof window !== "undefined" && !!window.lexaDesktop;
}

/* ─── هوک وضعیت ──────────────────────────────────────────────────────────── */

export type AppUpdatePhase =
  | "idle" // هنوز بررسی نشده
  | "checking" // در حال بررسی
  | "uptodate" // به‌روز است
  | "available" // نسخهٔ جدید موجود است
  | "downloading" // در حال دانلود/اعمال
  | "done" // نصب شد — آمادهٔ راه‌اندازی مجدد
  | "error";

export function useAppUpdate() {
  const desktop = isDesktop();
  const [phase, setPhase] = React.useState<AppUpdatePhase>("idle");
  const [status, setStatus] = React.useState<DesktopStatus | null>(null);
  const [check, setCheck] = React.useState<AppUpdateCheck | null>(null);
  const [progress, setProgress] = React.useState<ApplyProgress | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!desktop) return;
    const d = window.lexaDesktop!;
    let alive = true;
    void d.status().then((s) => alive && setStatus(s)).catch(() => {});
    const un = d.onEvent((e) => {
      if (!alive) return;
      if (e.type === "check") {
        setCheck(e.check);
        // اگر کاربر وسط کاری نبود، نتیجهٔ بررسی بی‌صدا را نشان بده
        setPhase((p) => (p === "idle" ? (e.check.available ? "available" : "uptodate") : p));
      } else if (e.type === "apply:progress") {
        setProgress(e as unknown as ApplyProgress);
        setPhase("downloading");
      } else if (e.type === "apply:done") {
        setProgress(null);
        setPhase("done");
      } else if (e.type === "apply:error") {
        setProgress(null);
        setError(e.message || "خطای نامشخص");
        setPhase("error");
      }
    });
    return () => {
      alive = false;
      un?.();
    };
  }, [desktop]);

  const checkNow = React.useCallback(async () => {
    if (!desktop) return;
    setPhase("checking");
    setError("");
    try {
      const c = await window.lexaDesktop!.check();
      setCheck(c);
      setPhase(c.available ? "available" : "uptodate");
    } catch (e) {
      setError(e instanceof Error ? e.message : "بررسی به‌روزرسانی ناموفق بود");
      setPhase("error");
    }
  }, [desktop]);

  const applyNow = React.useCallback(async () => {
    if (!desktop) return;
    setError("");
    setProgress(null);
    setPhase("downloading");
    try {
      await window.lexaDesktop!.apply();
      // رویداد apply:done یا apply:error از سمت فرآیند اصلی می‌آید
    } catch (e) {
      setError(e instanceof Error ? e.message : "نصب به‌روزرسانی ناموفق بود");
      setPhase("error");
    }
  }, [desktop]);

  const restart = React.useCallback(() => {
    void window.lexaDesktop?.restart();
  }, []);

  return { desktop, phase, status, check, progress, error, checkNow, applyNow, restart };
}
