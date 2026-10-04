"use client";

/* ─── Lexa — نوار به‌روزرسانی خودکار دسکتاپ ──────────────────────────────────
 * «به‌روزرسانی باید خودکار باشد»: بررسی بی‌صدای استارتاپ نسخهٔ جدید را کشف
 * می‌کند و همین‌جا دانلود و نصب خودکار شروع می‌شود (دلتای کوچک، بدون مزاحمت).
 * کاربر فقط یک قرص کوچک گوشهٔ صفحه می‌بیند؛ پس از نصب، برنامه خودش کار می‌کند
 * و نسخهٔ تازه دفعهٔ بعد که باز شود فعال است — راه‌اندازی مجدد همیشه اختیاری.
 * ─────────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { Loader2, CheckCircle2, RotateCcw, Sparkles, X } from "lucide-react";
import { fa as faNum } from "@/lib/fa";
import { useAppUpdate } from "@/lib/app-updater";

const GRACE_MS = 4_000; // فرصت کوتاه پس از بوت تا دانلود خودکار شروع شود
const AUTO_DISMISS_HOURS = 6;

export function UpdateBanner() {
  const { desktop, phase, check, progress, applyNow, restart } = useAppUpdate();
  const startedRef = React.useRef(false);
  const [dismissed, setDismissed] = React.useState(false);

  // نصب خودکار: به‌محض کشف نسخهٔ جدید (از بررسی بی‌صدا یا دستی)، دانلود خودکار
  React.useEffect(() => {
    if (!desktop || phase !== "available" || startedRef.current) return;
    startedRef.current = true;
    const t = setTimeout(() => { void applyNow(); }, GRACE_MS);
    return () => clearTimeout(t);
  }, [desktop, phase, applyNow]);

  // پس از نصب، قرص تا چند ساعت نشان داده می‌شود؛ بعداً خودش جمع می‌شود
  React.useEffect(() => {
    if (phase !== "done") return;
    const t = setTimeout(() => setDismissed(true), AUTO_DISMISS_HOURS * 3600_000);
    return () => clearTimeout(t);
  }, [phase]);

  if (!desktop || dismissed) return null;
  if (phase !== "available" && phase !== "downloading" && phase !== "done") return null;

  const pct =
    progress?.phase === "download" && progress.bytesTotal
      ? Math.min(100, Math.round(((progress.bytesDone ?? 0) / progress.bytesTotal) * 100))
      : undefined;

  return (
    <div
      role="status"
      className="fixed bottom-4 start-4 z-50 max-w-xs rounded-2xl border border-border bg-card/95 p-3.5 shadow-card backdrop-blur-md"
    >
      <button
        onClick={() => setDismissed(true)}
        aria-label="بستن"
        className="absolute end-2 top-2 rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {phase === "available" && (
        <p className="flex items-center gap-2 pe-5 text-[12px] font-bold text-foreground">
          <Sparkles className="h-4 w-4 shrink-0 text-bronze" />
          نسخهٔ تازهٔ Lexa آماده است — خودکار نصب می‌شود…
        </p>
      )}

      {phase === "downloading" && (
        <p className="flex items-center gap-2 pe-5 text-[12px] font-bold text-foreground">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-bronze" />
          در حال دریافت نسخهٔ تازه{typeof pct === "number" ? ` — ${faNum(pct)}٪` : ""} — مطالعه‌ات ادامه بده، مزاحم نیستیم.
        </p>
      )}

      {phase === "done" && (
        <div className="space-y-2 pe-5">
          <p className="flex items-center gap-2 text-[12px] font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            به‌روزرسانی نصب شد{check?.remoteVersion ? ` (نسخهٔ ${check.remoteVersion})` : ""} — دفعهٔ بعد که برنامه باز شود، نسخهٔ تازه است.
          </p>
          <button
            onClick={() => void restart()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <RotateCcw className="h-3.5 w-3.5" /> راه‌اندازی مجدد الان
          </button>
        </div>
      )}
    </div>
  );
}
