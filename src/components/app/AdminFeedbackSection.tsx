"use client";

import * as React from "react";
import {
  MessageSquareWarning, Loader2, ChevronDown, CheckCheck, XCircle,
  BadgePercent, Hourglass, ShieldCheck, History,
} from "lucide-react";

const SEV_FA: Record<string, string> = { minor: "اصلاح جزئی", moderate: "اصلاح متوسط", major: "اصلاح اساسی" };
const STATUS_FA: Record<string, { label: string; cls: string }> = {
  pending: { label: "در انتظار بررسی", cls: "bg-bronze/12 text-bronze border-bronze/40" },
  approved: { label: "تاییدشده", cls: "bg-success/12 text-success border-success/40" },
  rejected: { label: "ردشده", cls: "bg-destructive/10 text-destructive border-destructive/40" },
};

function pctTone(v: number) {
  return v >= 70 ? "text-success" : v >= 40 ? "text-bronze" : "text-destructive";
}

export interface AdminFeedbackItem {
  id: string;
  username: string;
  userRole: string;
  courseId: string;
  chapterTitle: string;
  lessonId: string;
  lessonTitle: string;
  matchPercent: number;
  needsChange: boolean;
  severity: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  analysis: string;
  suggestion: string;
  conversationCount: number;
  messages: { role: string; content: string }[];
}

/** عنوان جلسه از شناسه (هم‌تراز با AdminView) */
function prettyLesson(id: string): string {
  const m = id.match(/^(m|t|md7)-l(\d+)-(\d+)$/);
  if (!m) return id;
  const book = m[1] === "t" ? "تجارت ۳" : m[1] === "md7" ? "مدنی ۷" : `مدنی ${m[2]}`;
  return `${book} — جلسهٔ ${m[3]} فصل ${m[2]}`;
}

const faDateTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("fa-IR", {
        year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "—";

// ─── کارت یک پیشنهاد ──────────────────────────────────────────────────────────
function FeedbackCard({ item, onChanged }: { item: AdminFeedbackItem; onChanged: (patched: AdminFeedbackItem) => void }) {
  const [expanded, setExpanded] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState<"" | "approved" | "rejected">("");

  async function decide(status: "approved" | "rejected") {
    if (busy) return;
    setBusy(status);
    try {
      const res = await fetch(`/api/admin/feedback/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNote: note.trim() || undefined }),
      });
      if (res.ok) {
        const d = await res.json();
        onChanged({
          ...item,
          status: d.status ?? status,
          adminNote: d.adminNote ?? null,
          reviewedAt: d.reviewedAt ?? new Date().toISOString(),
        });
      }
    } catch {} finally {
      setBusy("");
    }
  }

  const st = STATUS_FA[item.status] ?? STATUS_FA.pending;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-start transition-colors hover:bg-muted/40"
      >
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
            item.severity === "major"
              ? "bg-destructive/12 text-destructive"
              : item.severity === "moderate"
                ? "bg-bronze/12 text-bronze"
                : "bg-success/12 text-success"
          }`}
        >
          <MessageSquareWarning className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <strong className="font-display text-sm">{item.username}</strong>
            <span className="text-[11px] text-muted-foreground">{prettyLesson(item.lessonId)}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 tabular-nums">
              <BadgePercent className="h-3 w-3 text-bronze" /> تطابق با جزوه:
              <strong className={pctTone(item.matchPercent)}>٪{item.matchPercent.toLocaleString("fa-IR")}</strong>
            </span>
            <span>{SEV_FA[item.severity] ?? item.severity}</span>
            <span>{faDateTime(item.createdAt)}</span>
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-dashed border-border px-4 py-4">
          {/* متریک‌ها */}
          <div className="grid grid-cols-3 gap-2 text-center sm:max-w-sm">
            <div className="rounded-xl bg-muted/50 px-2 py-2">
              <p className={`font-display text-lg font-extrabold tabular-nums ${pctTone(item.matchPercent)}`}>٪{item.matchPercent.toLocaleString("fa-IR")}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">تطابق گفتهٔ کاربر با جزوه</p>
            </div>
            <div className="rounded-xl bg-muted/50 px-2 py-2">
              <p className="font-display text-lg font-extrabold">{item.needsChange ? "بله" : "خیر"}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">نیاز به تغییر</p>
            </div>
            <div className="rounded-xl bg-muted/50 px-2 py-2">
              <p className="font-display text-lg font-extrabold">{SEV_FA[item.severity] ?? item.severity}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">شدت</p>
            </div>
          </div>

          {/* تحلیل و پیشنهاد */}
          <section className="rounded-xl border-s-2 border-bronze/60 bg-background/70 p-3">
            <p className="mb-1 text-[11px] font-bold text-bronze">تحلیل هوش مصنوعی</p>
            <p className="whitespace-pre-line text-[12.5px] leading-loose">{item.analysis}</p>
          </section>
          <section className="rounded-xl border-s-2 border-primary/50 bg-background/70 p-3">
            <p className="mb-1 text-[11px] font-bold text-primary">پیشنهاد اصلاح برای مدیر</p>
            <p className="whitespace-pre-line text-[12.5px] leading-loose">{item.suggestion}</p>
          </section>

          {/* گفت‌وگوی کاربر */}
          <details className="rounded-xl bg-muted/40 p-3">
            <summary className="cursor-pointer select-none text-[11.5px] font-bold text-muted-foreground">
              گفت‌وگوی کامل کاربر با تحلیلگر ({item.conversationCount.toLocaleString("fa-IR")} پیام)
            </summary>
            <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pe-1">
              {item.messages.map((m, i) => (
                <div
                  key={i}
                  dir="rtl"
                  className={`max-w-[92%] rounded-xl px-3 py-2 text-[12px] leading-relaxed ${
                    m.role === "user"
                      ? "ms-auto bg-primary/90 text-primary-foreground"
                      : "me-auto border border-border bg-background"
                  }`}
                >
                  {m.content}
                </div>
              ))}
            </div>
          </details>

          {/* اقدام مدیر */}
          {item.status === "pending" ? (
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="یادداشت اختیاری مدیر برای همین بازخورد…"
                className="mb-2.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-bronze"
                maxLength={1000}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void decide("approved")}
                  disabled={!!busy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-success px-4 py-2 text-xs font-bold text-white transition-transform active:scale-95 disabled:opacity-50"
                >
                  {busy === "approved" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                  تایید پیشنهاد
                </button>
                <button
                  onClick={() => void decide("rejected")}
                  disabled={!!busy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-destructive/85 px-4 py-2 text-xs font-bold text-white transition-transform active:scale-95 disabled:opacity-50"
                >
                  {busy === "rejected" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                  رد پیشنهاد
                </button>
              </div>
            </div>
          ) : (
            <p className="rounded-xl bg-muted/50 px-3 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
              <strong>بررسی شده در {faDateTime(item.reviewedAt)}</strong>
              {item.adminNote && <> — پیام مدیر: «{item.adminNote}»</>}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── سکشن اصلی ────────────────────────────────────────────────────────────────
export function AdminFeedbackSection() {
  const [items, setItems] = React.useState<AdminFeedbackItem[] | null>(null);
  const [error, setError] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | "pending" | "approved" | "rejected">("all");

  const load = React.useCallback(() => {
    setError("");
    fetch("/api/admin/feedback")
      .then((r) => r.json())
      .then((d: { items?: AdminFeedbackItem[]; error?: string }) => {
        if (d.error) setError(d.error);
        else setItems(d.items ?? []);
      })
      .catch(() => setError("ارتباط با سرور برقرار نشد."));
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  function patchItem(patched: AdminFeedbackItem) {
    setItems((prev) => prev?.map((x) => (x.id === patched.id ? patched : x)) ?? prev);
  }

  const pendingCount = items?.filter((i) => i.status === "pending").length ?? 0;
  const filtered = (items ?? []).filter((i) => filter === "all" || i.status === filter);

  return (
    <section className="rounded-3xl border border-border bg-card/60 p-4 shadow-card sm:p-6">
      {/* سرصفحه */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2.5 font-display text-base font-bold">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-bronze text-white shadow-card">
              <MessageSquareWarning className="h-5 w-5" />
            </span>
            پیشنهادهای اصلاح تدریس
            {pendingCount > 0 && (
              <span title="در انتظار بررسی" className="inline-flex items-center gap-1 rounded-full bg-bronze/15 px-2.5 py-1 text-[11px] font-bold text-bronze">
                <Hourglass className="h-3 w-3" /> {pendingCount.toLocaleString("fa-IR")} در انتظار
              </span>
            )}
          </h2>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
            انتقادهای دانشجویان که هوش مصنوعی نسبت به متن جزوه تحلیل کرده است؛ شما تایید یا رد می‌کنید.
          </p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold transition-colors hover:border-bronze">
          <History className="h-3.5 w-3.5" /> تازه‌سازی
        </button>
      </div>

      {/* فیلتر وضعیت */}
      {items != null && items.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {([
            ["all", `همه (${items.length})`],
            ["pending", `در انتظار (${items.filter((i) => i.status === "pending").length})`],
            ["approved", `تاییدشده (${items.filter((i) => i.status === "approved").length})`],
            ["rejected", `ردشده (${items.filter((i) => i.status === "rejected").length})`],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k as never)}
              className={`rounded-full border px-3.5 py-1.5 text-[11.5px] font-bold transition-colors ${
                filter === k ? "border-bronze bg-bronze/12 text-bronze" : "border-border text-muted-foreground hover:border-bronze/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* محتوا */}
      {items == null && !error && (
        <p className="flex items-center justify-center gap-2 py-8 text-sm text-bronze">
          <Loader2 className="h-5 w-5 animate-spin" /> در حال دریافت پیشنهادها…
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      )}
      {items != null && filtered.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border bg-background/60 px-5 py-8 text-center text-sm text-muted-foreground">
          تاکنون هیچ پیشنهادی ثبت نشده است؛ به‌محض ثبت اولین نقد، اینجا با تحلیل و درصد تطابق ظاهر می‌شود.
        </p>
      )}
      <div className="space-y-2.5">
        {filtered.map((f) => (
          <FeedbackCard key={f.id} item={f} onChanged={patchItem} />
        ))}
      </div>

      <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
        رکوردهای بازخورد فقط افزودنی‌اند؛ تصمیم تو (تایید/رد) وضعیت را علامت می‌زند ولی هرگز چیزی حذف نمی‌شود.
      </p>
    </section>
  );
}
