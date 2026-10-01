"use client";

/* ─── Lexa — کارت «به‌روزرسانی نرم‌افزار» در تنظیمات (فقط دسکتاپ) ───────────
 * کاربر دکمهٔ آپدیت را می‌زند و فقط فایل‌های تغییریافته دانلود می‌شود؛
 * کل برنامه (~۱۷۰ مگابایت) هرگز دوباره دانلود نمی‌شود.
 * ─────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import {
  MonitorSmartphone, RefreshCw, CheckCircle2, Loader2, TriangleAlert,
  Download, RotateCcw, Sparkles, FileDown, HardDriveDownload,
} from "lucide-react";
import { fa as faNum } from "@/lib/fa";
import { formatBytes } from "@/lib/offline";
import { useAppUpdate } from "@/lib/app-updater";

export function AppUpdateCard() {
  const { desktop, phase, status, check, progress, error, checkNow, applyNow, restart } = useAppUpdate();
  const [autoCount, setAutoCount] = React.useState<number | null>(null);

  // پس از نصب موفق: شمارش معکوس راه‌اندازی مجدد خودکار
  React.useEffect(() => {
    if (phase !== "done") {
      setAutoCount(null);
      return;
    }
    setAutoCount(3);
    const t = setInterval(() => {
      setAutoCount((c) => {
        if (c === null) return null;
        if (c <= 1) {
          clearInterval(t);
          restart();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, restart]);

  if (!desktop) return null;

  const currentV = status?.version ?? check?.currentVersion ?? "";
  const platformLabel =
    status?.platform === "win32" ? "ویندوز" : status?.platform === "darwin" ? "مک" : status?.platform === "linux" ? "لینوکس" : "";

  // درصد پیشرفت بر اساس فاز
  let pct = 0;
  let progressText = "";
  if (progress) {
    if (progress.phase === "base" && progress.totalBytes) {
      pct = Math.min(100, Math.round(((progress.copiedBytes ?? 0) / progress.totalBytes) * 100));
      progressText = `آماده‌سازی ساختار آپدیت (فقط بار اول) — ${formatBytes(progress.copiedBytes ?? 0)} از ${formatBytes(progress.totalBytes ?? 0)}`;
    } else if (progress.phase === "download") {
      const bt = progress.bytesTotal ?? 0;
      pct = bt ? Math.min(100, Math.round(((progress.bytesDone ?? 0) / bt) * 100)) : 0;
      progressText = `دانلود فایل ${faNum(progress.filesDone ?? 0)} از ${faNum(progress.filesTotal ?? 0)} — ${formatBytes(progress.bytesDone ?? 0)} از ${formatBytes(bt || 0)}`;
    } else if (progress.phase === "commit") {
      pct = 100;
      progressText = "جایگزینی فایل‌ها…";
    } else if (progress.phase === "prepare") {
      pct = 100;
      progressText = "دریافت فهرست تغییرات…";
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <h2 className="flex items-center gap-2 font-bold">
        <MonitorSmartphone className="h-5 w-5 text-bronze" /> به‌روزرسانی نرم‌افزار
        <span dir="ltr" className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
          v{currentV}
        </span>
        {platformLabel && (
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">{platformLabel}</span>
        )}
      </h2>
      <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
        نسخهٔ جدید به‌صورت درون‌برنامه‌ای نصب می‌شود — <b className="text-foreground">فقط فایل‌های تغییرکرده</b> دانلود
        می‌شوند و نیازی به رفتن به گیت‌هاب و دانلود دوبارهٔ کل برنامه نیست. پس از نصب، برنامه خودکار راه‌اندازی مجدد می‌شود.
      </p>

      {/* وضعیت‌ها */}
      <div className="mt-4 space-y-3">
        {(phase === "idle" || phase === "checking") && (
          <div className="flex items-center justify-between rounded-xl border border-dashed border-border bg-background/60 px-4 py-3">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              {phase === "checking" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> در حال بررسی نسخهٔ جدید…
                </>
              ) : (
                "برای دیدن نسخه‌های جدید بررسی کن."
              )}
            </p>
            {phase === "idle" && (
              <button
                onClick={() => void checkNow()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-bronze/10 px-3.5 py-2 text-xs font-bold text-bronze transition-colors hover:bg-bronze/20"
              >
                <RefreshCw className="h-3.5 w-3.5" /> بررسی به‌روزرسانی
              </button>
            )}
          </div>
        )}

        {phase === "uptodate" && (
          <div className="flex items-center justify-between rounded-xl border border-dashed border-border bg-background/60 px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> برنامه به‌روز است
              {check && <span className="font-normal text-muted-foreground">(آخرین نسخه: {check.remoteVersion})</span>}
            </p>
            <button
              onClick={() => void checkNow()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-bronze/10 px-3.5 py-2 text-xs font-bold text-bronze transition-colors hover:bg-bronze/20"
            >
              <RefreshCw className="h-3.5 w-3.5" /> بررسی دوباره
            </button>
          </div>
        )}

        {phase === "available" && check && (
          <div className="space-y-3 rounded-xl border border-bronze/40 bg-bronze/5 px-4 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-bold text-bronze">
                <Sparkles className="h-4 w-4" /> نسخهٔ {check.remoteVersion} موجود است
              </p>
              <span className="rounded-md bg-background/70 px-2 py-1 text-[11px] font-bold text-muted-foreground" dir="ltr">
                {check.currentVersion} → {check.remoteVersion}
              </span>
            </div>

            {check.notes && (
              <p className="whitespace-pre-line rounded-lg bg-background/60 px-3 py-2.5 text-[12px] leading-relaxed text-foreground/90">
                {check.notes}
              </p>
            )}

            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] font-bold text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <FileDown className="h-3.5 w-3.5 text-bronze" />
                حجم دانلود: {formatBytes(check.bytesChanged)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <HardDriveDownload className="h-3.5 w-3.5 text-bronze" />
                {faNum(check.filesChanged)} فایل تغییرکرده
                {check.deletes > 0 && <> · حذف {faNum(check.deletes)} فایل</>}
              </span>
            </p>

            <button
              onClick={() => void applyNow()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-bronze px-4 py-2.5 text-sm font-bold text-background transition-opacity hover:opacity-90"
            >
              <Download className="h-4 w-4" /> دانلود و نصب آپدیت
            </button>
          </div>
        )}

        {phase === "downloading" && (
          <div className="space-y-2.5 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3.5">
            <p className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" /> {progressText || "در حال آماده‌سازی…"}
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar">
              <div
                className={`h-full rounded-full bg-gradient-to-l from-bronze to-primary transition-[width] duration-300 ${pct === 100 ? "animate-pulse" : ""}`}
                style={{ width: `${Math.max(6, pct)}%` }}
              />
            </div>
            <p className="text-center text-[10.5px] text-muted-foreground">
              در طول دانلود برنامه را نبند؛ اگر اینترنت قطع شد، دوباره «دانلود و نصب» را بزن — از همین‌جا ادامه می‌یابد.
            </p>
          </div>
        )}

        {phase === "done" && (
          <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-4 py-3.5">
            <p className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" /> آپدیت نصب شد — برنامه راه‌اندازی مجدد می‌شود
              {autoCount !== null && autoCount > 0 && (
                <span className="text-xs font-normal text-muted-foreground">({faNum(autoCount)}…)</span>
              )}
            </p>
            <button
              onClick={restart}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-background transition-opacity hover:opacity-90"
            >
              <RotateCcw className="h-3.5 w-3.5" /> راه‌اندازی مجدد
            </button>
          </div>
        )}

        {phase === "error" && (
          <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
            <p className="flex items-start gap-2 text-xs leading-relaxed text-destructive">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error || "به‌روزرسانی ناموفق بود."}</span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => void checkNow()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive transition-colors hover:bg-destructive/20"
              >
                <RefreshCw className="h-3.5 w-3.5" /> تلاش دوباره
              </button>
            </div>
          </div>
        )}
      </div>

      {status?.fromAppdata && (
        <p className="mt-3 text-[10.5px] text-muted-foreground">
          نسخهٔ فعلی از لایهٔ به‌روزرسانی درون‌برنامه‌ای اجرا می‌شود — نسخهٔ اصلی نصب‌شده سر جایش می‌ماند و با حذف لایه،
          برمی‌گردد.
        </p>
      )}
    </section>
  );
}
