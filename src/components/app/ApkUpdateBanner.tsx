"use client";

/* ─── Lexa — نوار به‌روزرسانی درون‌برنامه‌ای اندروید (فقط APK) ─────────────────
 * مثل همتای دسکتاپش (UpdateBanner) بی‌صدا در استارتاپ نسخهٔ جدید را چک می‌کند؛
 * اگر نسخهٔ تازه‌ای منتشر شده باشد یک قرص کوچک گوشهٔ صفحه می‌آید: «دانلود و نصب».
 * دانلود با پیشرفت درصدی داخل خود اپ انجام می‌شود و در پایان نصاب رسمی سیستم
 * باز می‌شود — کاربر فقط «نصب» را می‌زند؛ دیگر نیازی به مراجعه به سایت نیست.
 * اجازهٔ «نصب از منابع ناشناس» هم بار اول با صفحهٔ رسمی سیستم گرفته می‌شود.
 * ─────────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { Download, Loader2, Sparkles, X, CheckCircle2, ShieldCheck } from "lucide-react";
import { fa as faNum } from "@/lib/fa";
import {
  APP_VERSION, LexaUpdater, checkApkUpdate, downloadAndInstallApk,
  isApkRuntime, type AppUpdateFeed,
} from "@/lib/apk-updater";

const CHECK_COOLDOWN_MS = 6 * 3600_000; // بررسی بی‌صدا حداکثر هر ۶ ساعت
const LS_LAST_CHECK = "lexa-apk-update-last-check";
const LS_DISMISSED = "lexa-apk-update-dismissed-version";

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n > 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} مگابایت`;
  return `${Math.round(n / 1024)} کیلوبایت`;
}

type Phase = "idle" | "available" | "downloading" | "sent" | "error";

export function ApkUpdateBanner() {
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [feed, setFeed] = React.useState<AppUpdateFeed | null>(null);
  const [pct, setPct] = React.useState<number | undefined>(undefined);
  const [received, setReceived] = React.useState(0);
  const [err, setErr] = React.useState("");
  const [dismissed, setDismissed] = React.useState(false);
  const busyRef = React.useRef(false);

  // بررسی بی‌صدای استارتاپ — با مهار زمانی تا هر بار باز شدن مزاحم نباشد
  React.useEffect(() => {
    if (!isApkRuntime() || !APP_VERSION) return;
    let alive = true;
    try {
      const last = Number(localStorage.getItem(LS_LAST_CHECK) || "0");
      const dismissedV = localStorage.getItem(LS_DISMISSED) || "";
      if (dismissedV === APP_VERSION) return; // همین نسخه را کاربر رد کرده
      if (Date.now() - last < CHECK_COOLDOWN_MS) return;
      localStorage.setItem(LS_LAST_CHECK, String(Date.now()));
    } catch { /* بی‌اثر */ }
    void checkApkUpdate(APP_VERSION).then(({ available, feed: f }) => {
      if (!alive) return;
      if (available && f) {
        setFeed(f);
        setPhase("available");
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  async function startInstall() {
    if (!feed || busyRef.current) return;
    busyRef.current = true;
    setErr("");
    setPct(undefined);
    setReceived(0);
    setPhase("downloading");
    try {
      // اگر اجازهٔ نصب نباشد، صفحهٔ رسمی سیستم باز می‌شود و دکمه‌ها بعد از
      // بازگشت کاربر دوباره کار می‌کنند
      const allowed = await LexaUpdater.canInstall();
      if (!allowed?.allowed) {
        await LexaUpdater.openPermissionSettings();
        setPhase("available");
        setErr("اجازهٔ نصب را در صفحهٔ بازشده بده، بعد دوباره «دانلود و نصب» را بزن.");
        return;
      }
      const res = await downloadAndInstallApk(feed, (done, total) => {
        setReceived(done);
        setPct(total > 0 ? Math.min(100, Math.round((done / total) * 100)) : undefined);
      });
      if (res.ok) {
        setPhase("sent");
      } else {
        setErr(res.error || "دانلود ناموفق بود");
        setPhase("error");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "نصب ناموفق بود");
      setPhase("error");
    } finally {
      busyRef.current = false;
    }
  }

  function dismiss() {
    try { localStorage.setItem(LS_DISMISSED, feed?.version || APP_VERSION); } catch { /* بی‌اثر */ }
    setDismissed(true);
  }

  if (!isApkRuntime() || dismissed) return null;
  if (phase !== "available" && phase !== "downloading" && phase !== "sent" && phase !== "error") return null;

  return (
    <div
      role="status"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+72px)] start-3 end-3 z-50 mx-auto max-w-sm rounded-2xl border border-border bg-card/95 p-3.5 shadow-card backdrop-blur-md sm:start-4 sm:end-auto"
    >
      <button
        onClick={dismiss}
        aria-label="بستن"
        className="absolute end-2 top-2 rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {phase === "available" && feed && (
        <div className="space-y-2 pe-5">
          <p className="flex items-center gap-2 text-[12px] font-bold text-foreground">
            <Sparkles className="h-4 w-4 shrink-0 text-bronze" />
            نسخهٔ تازهٔ Lexa ({faNum(feed.version)}) منتشر شده
          </p>
          {feed.notes && (
            <p className="line-clamp-2 text-[11px] leading-5 text-muted-foreground">{feed.notes}</p>
          )}
          <button
            onClick={() => void startInstall()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[11.5px] font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Download className="h-3.5 w-3.5" /> دانلود و نصب درون‌برنامه‌ای
          </button>
          {err && <p className="text-[10.5px] leading-4 text-danger">{err}</p>}
        </div>
      )}

      {phase === "downloading" && (
        <div className="space-y-2 pe-5">
          <p className="flex items-center gap-2 text-[12px] font-bold text-foreground">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-bronze" />
            در حال دریافت نسخهٔ تازه{typeof pct === "number" ? ` — ${faNum(pct)}٪` : ` — ${formatBytes(received)}`}…
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-bronze transition-all duration-300"
              style={{ width: `${typeof pct === "number" ? pct : 12}%` }}
            />
          </div>
        </div>
      )}

      {phase === "sent" && (
        <div className="space-y-1.5 pe-5">
          <p className="flex items-center gap-2 text-[12px] font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            دانلود کامل شد — پنجرهٔ نصب باز شده؛ فقط «نصب» را بزن.
          </p>
        </div>
      )}

      {phase === "error" && (
        <div className="space-y-2 pe-5">
          <p className="text-[12px] font-bold text-foreground">دانلود ناموفق بود.</p>
          <p className="text-[10.5px] leading-4 text-muted-foreground">{err}</p>
          <button
            onClick={() => void startInstall()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground"
          >
            تلاش دوباره
          </button>
        </div>
      )}

      {/* یادآوری امنیتی کوچک — فقط در حالت آماده */}
      {phase === "available" && (
        <p className="mt-2 flex items-center gap-1 text-[9.5px] text-muted-foreground/80">
          <ShieldCheck className="h-3 w-3 shrink-0" />
          فایل مستقیم از منبع رسمی Lexa دریافت می‌شود.
        </p>
      )}
    </div>
  );
}
