"use client";

// ─── دکمهٔ دانلود تکی برای مطالعهٔ آفلاین + نشان «به‌روز شده» ───────────────────
// کنار هر مطلب و هر دوره سوار می‌شود؛ وضعیتش بین همهٔ جاهای برنامه همگام است.
import * as React from "react";
import { Download, CheckCircle2, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import {
  useOfflineItem, useOnlineStatus, downloadPostOffline, downloadCourseOffline,
  isServerNewer, type OfflineKind, type OfflineCardPost, type OfflineCardCourse,
} from "@/lib/offline";

export type OfflineCardInput = OfflineCardPost | OfflineCardCourse;

/** دکمهٔ دانلود/به‌روزرسانی آفلاین — حالت‌ها: دانلود / در حال ذخیره / ذخیره شد / به‌روزرسانی */
export function OfflineDownloadButton({
  kind, id, card, serverUpdatedAt, labeled = false, className = "",
}: {
  kind: OfflineKind;
  id: string;
  card: OfflineCardInput;
  /** updatedAt نسخهٔ سرور (اگر در دسترس باشد) — برای حالت «به‌روزرسانی» */
  serverUpdatedAt?: string;
  labeled?: boolean;
  className?: string;
}) {
  const online = useOnlineStatus();
  const item = useOfflineItem(kind, id);
  const [fail, setFail] = React.useState(false);

  const outdated = item.status === "saved" && isServerNewer(serverUpdatedAt, item.savedUpdatedAt);
  const interactive = online && item.status !== "busy" && (item.status === "none" || outdated);

  const title = !online
    ? "برای دانلود نسخهٔ آفلاین، به اینترنت نیاز داری"
    : item.status === "busy"
      ? "در حال ذخیره…"
      : outdated
        ? "به‌روزرسانی نسخهٔ آفلاین این مورد"
        : item.status === "saved"
          ? "ذخیره شد — بدون اینترنت هم قابل مطالعه است"
          : "دانلود برای مطالعهٔ آفلاین";

  async function act(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!interactive) return;
    const ok =
      kind === "post"
        ? await downloadPostOffline(card as OfflineCardPost)
        : await downloadCourseOffline(card as OfflineCardCourse);
    if (!ok) {
      setFail(true);
      setTimeout(() => setFail(false), 3500);
    }
  }

  const Icon = fail ? TriangleAlert : item.status === "busy" ? Loader2 : outdated ? RefreshCw : item.status === "saved" ? CheckCircle2 : Download;
  const tone = fail
    ? "border-destructive/40 bg-destructive/10 text-destructive"
    : item.status === "saved" && !outdated
      ? "border-success/40 bg-success/10 text-success"
      : outdated
        ? "border-amber-500/50 bg-amber-400/10 text-amber-600 dark:text-amber-400"
        : "border-bronze/40 bg-bronze/10 text-bronze";

  const stateCls = item.status === "busy" ? "cursor-wait opacity-80" : !interactive ? "cursor-default opacity-60" : "cursor-pointer hover:brightness-110 active:scale-95";

  return (
    <button
      type="button"
      onClick={act}
      aria-label={title}
      title={title}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border font-bold transition-all ${tone} ${stateCls} ${className} ${
        labeled ? "px-2.5 py-1.5 text-[11px]" : "h-7 w-7"
      }`}
    >
      <Icon className={`h-3.5 w-3.5 ${item.status === "busy" ? "animate-spin" : ""}`} />
      {labeled && (
        <span>
          {fail ? "دانلود ناموفق بود" : item.status === "busy" ? "در حال ذخیره…" : outdated ? "به‌روزرسانی نسخهٔ آفلاین" : item.status === "saved" ? "ذخیره شد" : "دانلود آفلاین"}
        </span>
      )}
    </button>
  );
}

/** نشان کهربایی «به‌روز شده» — وقتی نسخهٔ سرور از نسخهٔ ذخیره‌شدهٔ دستگاه جدیدتر است */
export function OfflineUpdatedPill({
  kind, id, serverUpdatedAt, className = "",
}: {
  kind: OfflineKind;
  id: string;
  serverUpdatedAt?: string;
  className?: string;
}) {
  const item = useOfflineItem(kind, id);
  const outdated = item.status === "saved" && isServerNewer(serverUpdatedAt, item.savedUpdatedAt);
  if (!outdated) return null;
  return (
    <span
      title="این مورد در سایت به‌روز شده است؛ برای آپدیت نسخهٔ آفلاین، دوباره دانلودش کن"
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/50 bg-amber-400/15 px-2 py-0.5 text-[9.5px] font-bold text-amber-600 dark:text-amber-400 ${className}`}
    >
      <RefreshCw className="h-3 w-3" /> به‌روز شده
    </span>
  );
}
