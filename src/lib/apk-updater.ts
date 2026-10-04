"use client";

/* ─── Lexa — به‌روزرسانی درون‌برنامه‌ای نسخهٔ اندروید (APK) ───────────────────
 * کاربر نباید برای گرفتن نسخهٔ جدید به سایت یا تلگرام برود؛ وقتی نسخهٔ تازه
 * منتشر شده، خودِ اپ آن را کشف می‌کند، دانلود می‌کند و نصاب سیستم را باز
 * می‌کند — همهٔ این‌ها درون برنامه‌ای.
 *
 * جریان:
 *   ۱) خوراک نسخه از updates/app/manifest.json (jsDelivr → رَو گیت‌هاب) خوانده
 *      می‌شود و با نسخهٔ همین بیلد مقایسه می‌شود (NEXT_PUBLIC_APP_VERSION).
 *   ۲) فایل APK از asset رسمی گیت‌هاب ریلیز دانلود می‌شود؛ مسیر پشتیبان،
 *      همان فایل در مخزن از مسیر jsDelivr است.
 *   ۳) پلاگین بومی LexaUpdater دانلود را با پیشرفت انجام می‌دهد، امضای فایل
 *      (sha256) را می‌سنجد و نصاب سیستم را باز می‌کند؛ اجازهٔ «نصب از منابع
 *      ناشناس» هم با یک صفحهٔ رسمی سیستم گرفته می‌شود.
 * ─────────────────────────────────────────────────────────────────────────── */

import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

const REPO = "pvwvuow/lexa";
const BRANCH = "main";

/** نسخهٔ همین بیلد — هنگام ساخت APK از env تزریق می‌شود (build-apk.sh) */
export const APP_VERSION: string = process.env.NEXT_PUBLIC_APP_VERSION || "";

/* ─── پلاگین بومی ─────────────────────────────────────────────────────────── */

export interface LexaUpdaterPlugin {
  canInstall(): Promise<{ allowed: boolean }>;
  openPermissionSettings(): Promise<void>;
  installApk(options: { url: string; sha256?: string }): Promise<{ ok: boolean; path: string }>;
  addListener(
    eventName: "progress",
    listener: (data: { bytesDone: number; bytesTotal: number }) => void,
  ): Promise<PluginListenerHandle> & PluginListenerHandle;
}

export const LexaUpdater = registerPlugin<LexaUpdaterPlugin>("LexaUpdater");

/** آیا این بیلد، اپ اندروید است؟ (پلاگین فقط آنجا وجود دارد) */
export function isApkRuntime(): boolean {
  return process.env.NEXT_PUBLIC_APP_MODE === "apk";
}

/* ─── خوراک نسخه ──────────────────────────────────────────────────────────── */

export interface AppUpdateFeed {
  schema?: number;
  version: string;
  tag: string;
  generatedAt: string;
  notes?: string;
  /** بستهٔ APK استیج‌شدهٔ مخزن — امضای رسمی برای سنجش یکپارچگی فایل دانلودی */
  apk?: { file: string; sha256: string; size: number };
}

function feedSources(): string[] {
  return [
    `https://cdn.jsdelivr.net/gh/${REPO}@${BRANCH}/updates/app/manifest.json`,
    `https://raw.githubusercontent.com/${REPO}/${BRANCH}/updates/app/manifest.json`,
  ];
}

async function fetchJsonTimeout(url: string, ms: number): Promise<AppUpdateFeed | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, cache: "no-store" });
    if (!r.ok) return null;
    const d = (await r.json()) as AppUpdateFeed;
    return d && typeof d.version === "string" ? d : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** آخرین خوراک نسخه — اولین منبع زنده برنده است */
export async function fetchAppUpdateFeed(): Promise<AppUpdateFeed | null> {
  for (const url of feedSources()) {
    const d = await fetchJsonTimeout(url, 10_000);
    if (d) return d;
  }
  return null;
}

/** مقایسهٔ semver ساده — مثبت یعنی remote تازه‌تر است */
export function compareVersions(remote: string, current: string): number {
  const pa = String(remote || "").split(/[.+-]/);
  const pb = String(current || "").split(/[.+-]/);
  for (let i = 0; i < 3; i++) {
    const a = parseInt(pa[i] ?? "0", 10) || 0;
    const b = parseInt(pb[i] ?? "0", 10) || 0;
    if (a !== b) return a - b;
  }
  return 0;
}

/** نتیجهٔ بررسی — available یعنی نسخهٔ تازه‌تری منتشر شده */
export async function checkApkUpdate(current: string): Promise<{
  available: boolean;
  feed: AppUpdateFeed | null;
}> {
  if (!current) return { available: false, feed: null };
  const feed = await fetchAppUpdateFeed();
  if (!feed || !feed.version) return { available: false, feed: null };
  return { available: compareVersions(feed.version, current) > 0, feed };
}

/** نشانی‌های دانلود APK به ترتیب اولویت — asset رسمی ریلیز، سپس CDN مخزن */
export function apkDownloadUrls(feed: AppUpdateFeed): string[] {
  const v = feed.version;
  const urls: string[] = [];
  if (feed.tag) {
    urls.push(`https://github.com/${REPO}/releases/download/${feed.tag}/Lexa-${v}-android.apk`);
  }
  urls.push(`https://cdn.jsdelivr.net/gh/${REPO}@${BRANCH}/updates/app/lexa-latest.apk`);
  urls.push(`https://raw.githubusercontent.com/${REPO}/${BRANCH}/updates/app/lexa-latest.apk`);
  return urls;
}

/** دانلود + بازکردن نصاب — روی هر نشانی امتحان می‌شود تا یکی موفق شود */
export async function downloadAndInstallApk(
  feed: AppUpdateFeed,
  onProgress?: (bytesDone: number, bytesTotal: number) => void,
): Promise<{ ok: boolean; error?: string }> {
  const urls = apkDownloadUrls(feed);
  const sha256 = feed.apk?.sha256;
  let lastErr = "دانلود ناموفق بود";
  for (const url of urls) {
    let un: PluginListenerHandle | null = null;
    try {
      un = await LexaUpdater.addListener("progress", (d) => onProgress?.(d.bytesDone, d.bytesTotal));
      await LexaUpdater.installApk({ url, sha256 });
      return { ok: true };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      // اجازهٔ نصب داده نشده؟ کاربر را به صفحهٔ رسمی اجازه می‌بریم و بقیهٔ
      // نشانی‌ها را هم امتحان نمی‌کنیم — بعد از اجازه، دکمهٔ اپ دوباره کار می‌کند.
      if (lastErr.includes("OPEN_SETTINGS_FAILED") || lastErr.includes("REQUEST_INSTALL")) break;
    } finally {
      try { await un?.remove(); } catch { /* بی‌اثر */ }
    }
  }
  return { ok: false, error: lastErr };
}
