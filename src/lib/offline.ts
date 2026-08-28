"use client";

/* ─── مدیریت حالت آفلاین — ثبت Service Worker، بستهٔ مطالب، وضعیت نصب ────────── */
import * as React from "react";

const PACK_KEY = "hh-offline-pack-v1";

export interface OfflinePackPost {
  id: string;
  title: string;
  summary: string;
  category?: string;
  categories?: string[];
  thumbnail?: string;
  createdAt: string;
  commentsCount: number;
  author: { id: string; username: string; displayName: string; avatarUrl?: string | null };
}

export interface OfflinePackCourse {
  id: string;
  title: string;
  tagline: string;
  description: string;
  icon?: string;
  lessonsCount: number;
  teacher: { id: string; username: string; displayName: string };
}

export interface OfflinePack {
  savedAt: number;
  posts: OfflinePackPost[];
  courses: OfflinePackCourse[];
}

/** ثبت سرویس‌ورکر — یک بار در سطح برنامه */
export function useServiceWorkerRegistration() {
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const url = "/sw.js";
    if (navigator.serviceWorker.controller?.scriptURL.endsWith(url)) return;
    navigator.serviceWorker.register(url).catch(() => {
      /* بی‌صدا — محیط بدون SW (مثل file://) نباید خطا بدهد */
    });
  }, []);
}

/** آیا برنامه به‌صورت PWA نصب‌شده اجرا می‌شود؟ */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** هوک وضعیت آنلاین بودن */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = React.useState(true);
  React.useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

/** وضعیت نصب + رویداد نصب (اندروید/دسکتاپ) */
export function usePwaInstall() {
  const [prompt, setPrompt] = React.useState<{ prompt: () => Promise<void> } | null>(null);
  const [installed, setInstalled] = React.useState(false);

  React.useEffect(() => {
    setInstalled(isStandalone());
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setPrompt(e as unknown as { prompt: () => Promise<void> });
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = React.useCallback(async () => {
    if (!prompt) return false;
    await prompt.prompt();
    const choice = await (prompt as unknown as { userChoice: Promise<{ outcome: string }> }).userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPrompt(null);
    return choice.outcome === "accepted";
  }, [prompt]);

  return { canInstall: !!prompt, installed, install };
}

/** پیش‌بارگذاری «بستهٔ طراحی» — پیام به سرویس‌ورکر برای کش‌کردن پوسته */
export function precacheDesignAssets(): Promise<number> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return resolve(-1);
    navigator.serviceWorker.ready
      .then((reg) => {
        const fonts = [
          "/fonts/Vazirmatn-Regular.woff2", "/fonts/Vazirmatn-Medium.woff2", "/fonts/Vazirmatn-Bold.woff2",
          "/fonts/Vazirmatn-SemiBold.woff2", "/fonts/MarkaziText-arabic-var.woff2", "/fonts/MarkaziText-latin-var.woff2",
          "/fonts/NotoNaskhArabic-var.woff2", "/fonts/Estedad-Regular.woff2", "/fonts/Estedad-Medium.woff2",
          "/fonts/Estedad-SemiBold.woff2", "/fonts/Estedad-Bold.woff2",
        ];
        const media = ["/media/hero-law.png", "/logo.svg", "/robots.txt"];
        const urls = [...fonts, ...media];
        const channel = new MessageChannel();
        channel.port1.onmessage = (e) => {
          if (e.data?.type === "PRECACHE_DONE") resolve(e.data.count as number);
        };
        reg.active?.postMessage({ type: "PRECACHE_SHELL", urls }, [channel.port2]);
        // اگر SW پاسخ نداد (نسخهٔ قدیمی) بعد از ۱۰ ثانیه رها کن
        setTimeout(() => resolve(-2), 10_000);
      })
      .catch(() => resolve(-1));
  });
}

/** برآورد حجم مصرفی کش و ذخیره‌سازی (بایت) */
export function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return Promise.resolve(null);
  return navigator.storage.estimate().then((e) => ({ usage: e.usage ?? 0, quota: e.quota ?? 0 }));
}

/** ── بستهٔ مطالب آفلاین ── */
export function getOfflinePack(): OfflinePack | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PACK_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OfflinePack;
  } catch {
    return null;
  }
}

export function saveOfflinePack(pack: OfflinePack): boolean {
  try {
    localStorage.setItem(PACK_KEY, JSON.stringify(pack));
    return true;
  } catch {
    return false;
  }
}

export function clearOfflinePack(): void {
  try {
    localStorage.removeItem(PACK_KEY);
  } catch {}
}

/** دانلود و ساخت بستهٔ مطالب: فید اساتید دنبال‌شده + دوره‌های کتابخانهٔ من */
export async function buildOfflinePack(): Promise<{ posts: number; courses: number }> {
  const posts: OfflinePackPost[] = [];
  const courses: OfflinePackCourse[] = [];

  try {
    const r = await fetch("/api/social/feed", { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      for (const p of (j.items ?? j.posts ?? []) as Record<string, unknown>[]) {
        posts.push({
          id: String(p.id),
          title: String(p.title ?? ""),
          summary: String(p.summary ?? ""),
          category: p.category as string | undefined,
          categories: p.categories as string[] | undefined,
          thumbnail: p.thumbnail as string | undefined,
          createdAt: String(p.createdAt ?? ""),
          commentsCount: Number(p.commentsCount ?? 0),
          author: p.author as OfflinePackPost["author"],
        });
      }
    }
  } catch {}

  try {
    const r = await fetch("/api/tcourses", { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      for (const c of (j.courses ?? []) as Record<string, unknown>[]) {
        if (c.inLibrary === false) continue; // فقط دوره‌های کتابخانهٔ من
        courses.push({
          id: String(c.id),
          title: String(c.title ?? ""),
          tagline: String(c.tagline ?? ""),
          description: String(c.description ?? ""),
          icon: c.icon as string | undefined,
          lessonsCount: Number(c.lessonsCount ?? 0),
          teacher: c.teacher as OfflinePackCourse["teacher"],
        });
      }
    }
  } catch {}

  // اگر هیچ داده‌ای گرفته نشد (مثلاً آفلاین بودیم) و بستهٔ قبلی داریم، همان را نگه دار
  if (posts.length === 0 && courses.length === 0) {
    const old = getOfflinePack();
    if (old) return { posts: old.posts.length, courses: old.courses.length };
  }

  saveOfflinePack({ savedAt: Date.now(), posts, courses });
  return { posts: posts.length, courses: courses.length };
}

export function formatBytes(n: number): string {
  if (!n) return "۰";
  if (n < 1024) return faDigits(n) + " بایت";
  if (n < 1024 * 1024) return faDigits(Math.round(n / 1024)) + " کیلوبایت";
  return faDigits(Math.round((n / (1024 * 1024)) * 10) / 10) + " مگابایت";
}

function faDigits(n: number | string): string {
  return String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

export function faDateTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString("fa-IR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}
