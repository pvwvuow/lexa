"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import {
  MessageSquareWarning, Send, Loader2, BadgePercent,
  CheckCheck, Scale, History, Megaphone,
} from "lucide-react";
import { useAuth } from "@/lib/auth-client";
import { useApp } from "@/lib/store";
import { fa } from "@/lib/fa";

// ─── انواع ────────────────────────────────────────────────────────────────────
export interface FeedbackCtxPayload {
  courseTitle: string;
  chapterTitle: string;
  lessonTitle: string;
  seenSections: string[];
  extra: string;
  lawRegistry: string[];
}

interface Msg { role: "user" | "assistant"; content: string; ts?: number }

interface SubmitResult {
  id: string;
  status: string;
  matchPercent: number;
  needsChange: boolean;
  severity: string;
  analysis: string;
  suggestion: string;
}

interface MineItem {
  id: string;
  matchPercent: number;
  needsChange: boolean;
  severity: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
}

const SEV_FA: Record<string, string> = { minor: "اصلاح جزئی", moderate: "اصلاح متوسط", major: "اصلاح اساسی" };
const STATUS_FA: Record<string, { label: string; cls: string }> = {
  pending: { label: "در انتظار بررسی مدیر", cls: "bg-bronze/12 text-bronze border-bronze/40" },
  approved: { label: "تاییدشده توسط مدیر", cls: "bg-success/12 text-success border-success/40" },
  rejected: { label: "ردشده", cls: "bg-destructive/10 text-destructive border-destructive/40" },
};

function pctTone(v: number) {
  return v >= 70 ? "text-success" : v >= 40 ? "text-bronze" : "text-destructive";
}

/** رندر پاسخ تحلیلگر: خطوط 📜 در باکس ماده، بقیه Markdown */
function FeedbackRich({ text }: { text: string }) {
  const { prose, laws } = React.useMemo(() => {
    const lawLines: string[] = [];
    const proseLines: string[] = [];
    for (const ln of text.split("\n")) {
      const t = ln.trim();
      if (t.startsWith("📜")) lawLines.push(t.replace(/^📜\s*/, ""));
      else proseLines.push(ln);
    }
    return { prose: proseLines.join("\n").replace(/\n{3,}/g, "\n\n").trim(), laws: lawLines };
  }, [text]);
  return (
    <>
      {prose && (
        <div className="text-[14.5px] leading-[1.95] [&_li]:my-0.5 [&_p]:my-1 [&_strong]:font-bold">
          <ReactMarkdown>{prose}</ReactMarkdown>
        </div>
      )}
      {laws.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {laws.map((l, i) => (
            <p key={i} className="law-text flex gap-1.5 rounded-lg border-s-2 border-bronze/60 bg-background/70 px-2.5 py-1.5 text-[13px] leading-relaxed">
              <Scale className="mt-1 h-3 w-3 shrink-0 text-bronze" />
              <span>{l}</span>
            </p>
          ))}
        </div>
      )}
    </>
  );
}

// ─── دیالوگ اصلی ──────────────────────────────────────────────────────────────
export function FeedbackDialog({
  open, onOpenChange,
  courseId, chapterTitle, lessonId, lessonTitle,
  getContext,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  courseId: string;
  chapterTitle: string;
  lessonId: string;
  lessonTitle: string;
  getContext: () => FeedbackCtxPayload;
}) {
  const auth = useAuth();
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [estimate, setEstimate] = React.useState<number | null>(null);
  const [result, setResult] = React.useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitErr, setSubmitErr] = React.useState("");
  const [mine, setMine] = React.useState<MineItem[]>([]);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  const userMsgCount = messages.filter((m) => m.role === "user").length;

  // پاک‌سازی هنگام بازشدن برای جلسهٔ جدید
  React.useEffect(() => {
    if (open) {
      setErr(""); setSubmitErr("");
      // تاریخچهٔ قبلی را نگه نمی‌داریم؛ گفت‌وگوی تازهٔ هر جلسه
      setMessages([]); setEstimate(null); setResult(null);
    }
  }, [open]);

  // فهرست بازخوردهای قبلی کاربر روی همین جلسه
  React.useEffect(() => {
    if (!open || auth.status !== "authed") return;
    let alive = true;
    fetch(`/api/feedback/mine?lessonId=${encodeURIComponent(lessonId)}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: MineItem[] }) => { if (alive) setMine(d.items ?? []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [open, auth.status, lessonId, result?.id]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length, sending]);

  async function send() {
    const text = input.trim();
    if (!text || sending || submitting) return;
    const next = [...messages, { role: "user" as const, content: text.slice(0, 4000), ts: Date.now() }];
    setInput(""); setSending(true); setErr("");
    try {
      const res = await fetch("/api/feedback/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
          context: getContext(),
          ai: useApp.getState().ai,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "تحلیل ناموفق بود.");
      setMessages([...next, { role: "assistant", content: String(data.reply ?? ""), ts: Date.now() }]);
      setEstimate(typeof data.matchEstimate === "number" ? Math.round(data.matchEstimate as number) : null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ارتباط با تحلیلگر برقرار نشد.");
    } finally {
      setSending(false);
    }
  }

  async function submitToAdmin() {
    if (userMsgCount === 0 || submitting || sending) return;
    setSubmitting(true); setSubmitErr("");
    try {
      const res = await fetch("/api/feedback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId, chapterTitle, lessonId, lessonTitle,
          messages,
          context: getContext(),
          ai: useApp.getState().ai,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "ثبت پیشنهاد ناموفق بود.");
      setResult(data as SubmitResult);
      setEstimate((data as SubmitResult).matchPercent);
    } catch (e) {
      setSubmitErr(e instanceof Error ? e.message : "ثبت پیشنهاد برای مدیر ناموفق بود.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const canSubmit = auth.status === "authed" && userMsgCount > 0 && !sending && !submitting;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-3 backdrop-blur-sm sm:p-6"
      onClick={() => onOpenChange(false)}
      role="dialog"
      aria-modal="true"
      aria-label="بازخورد از تدریس"
    >
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl"
      >
        {/* سرصفحه */}
        <div className="border-b border-border bg-card px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 font-display text-base font-bold">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-bronze/12 text-bronze">
                  <MessageSquareWarning className="h-5 w-5" />
                </span>
                نقد و گفت‌وگو دربارهٔ تدریس
              </h3>
              <p className="mt-1.5 truncate text-[11.5px] text-muted-foreground">
                {lessonTitle} · {chapterTitle}
              </p>
            </div>
            <button onClick={() => onOpenChange(false)} className="rounded-lg border border-border px-2.5 py-1 text-xs font-bold hover:border-bronze" aria-label="بستن">✕</button>
          </div>
          <p className="mt-2.5 rounded-lg bg-muted/60 px-3 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
            انتقاد یا پیشنهاد خود دربارهٔ تدریسِ این جلسه را بنویس؛ تحلیلگر همان لحظه آن را با
            متن جزوه می‌سنجد، درصد تطابق گفته‌های تو را می‌گوید و پیشنهاد اصلاح را برای
            مدیر اپلیکیشن ارسال می‌کند تا بررسی و تایید شود.
          </p>
        </div>

        {/* بدنه */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {/* مهمان */}
          {auth.status !== "authed" && (
            <div className="mb-4 rounded-2xl border border-dashed border-bronze/50 bg-bronze/[0.06] p-4 text-center">
              <Megaphone className="mx-auto mb-2 h-7 w-7 text-bronze" />
              <p className="text-sm font-bold">برای ثبت انتقاد وارد حساب خود شوید</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                بازخوردها به نام حساب تو در پایگاه داده ثبت می‌شوند تا مدیر بتواند
                پیشنهادهای هر دانشجو را مستقیم بررسی کند.
              </p>
            </div>
          )}

          {/* گفت‌وگو */}
          {messages.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-sm text-muted-foreground">
                گفت‌وگو هنوز شروع نشده است؛ اولین انتقاد یا مشاهدهٔ خود را بنویس.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="ms-auto max-w-[85%] rounded-2xl rounded-es-md bg-primary px-4 py-2.5 text-[14px] leading-relaxed text-primary-foreground shadow-card">
                    {m.content}
                  </div>
                ) : (
                  <div key={i} className="me-auto max-w-[92%] rounded-2xl rounded-ee-md border border-bronze/30 bg-card px-4 py-3 shadow-card">
                    <p className="mb-1 text-[10.5px] font-bold text-bronze">تحلیلگر بازخورد · مقایسه با جزوه انجام شد</p>
                    <FeedbackRich text={m.content} />
                  </div>
                )
              )}
              {sending && (
                <div className="me-auto flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground shadow-card">
                  <Loader2 className="h-4 w-4 animate-spin text-bronze" />
                  در حال سنجش حرف تو با متن جزوه…
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}

          {/* نشان زندهٔ درصد تطابق */}
          {estimate !== null && !sending && (
            <div className={`mt-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/50 px-4 py-2.5 ${auth.status === "authed" ? "" : "opacity-80"}`}>
              <span className="flex items-center gap-1.5 text-[11.5px] font-bold text-muted-foreground">
                <BadgePercent className="h-4 w-4 text-bronze" />
                تطابق گفته‌های تو با متن جزوه
              </span>
              <strong className={`font-display text-xl font-extrabold tabular-nums ${pctTone(estimate)}`}>
                ٪{fa(estimate)}
              </strong>
            </div>
          )}

          {/* خطاها */}
          {err && <p role="status" className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive">{err}</p>}

          {/* نتیجهٔ ثبت برای مدیر */}
          {result && (
            <div className="mt-4 rounded-2xl border border-success/40 bg-success/[0.06] p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-success">
                <CheckCheck className="h-4.5 w-4.5" /> پیشنهاد برای مدیر ارسال شد
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-background/70 px-2 py-2">
                  <p className={`font-display text-lg font-extrabold tabular-nums ${pctTone(result.matchPercent)}`}>٪{fa(result.matchPercent)}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">تطابق با جزوه</p>
                </div>
                <div className="rounded-xl bg-background/70 px-2 py-2">
                  <p className="font-display text-lg font-extrabold">{SEV_FA[result.severity] ?? result.severity}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">شدت پیشنهادی</p>
                </div>
                <div className="rounded-xl bg-background/70 px-2 py-2">
                  <p className="font-display text-lg font-extrabold">{result.needsChange ? "بله" : "خیر"}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">تغییر لازم؟</p>
                </div>
              </div>
              <details className="mt-3" open>
                <summary className="cursor-pointer select-none text-xs font-bold text-bronze">تحلیل رسمی و پیشنهاد ثبت‌شده</summary>
                <p className="mt-2 rounded-xl bg-background/70 p-3 text-[12.5px] leading-loose text-foreground/90">{result.analysis}</p>
                <p className="mt-2 rounded-xl bg-background/70 p-3 text-[12.5px] leading-loose text-foreground/90"><strong className="text-bronze">پیشنهاد:</strong> {result.suggestion}</p>
              </details>
              <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
                وضعیت فعلی: در انتظار بررسی مدیر — پس از تایید یا رد، وضعیت همین جا نمایش داده می‌شود.
              </p>
            </div>
          )}

          {/* بازخوردهای قبلی همین جلسه */}
          {auth.status === "authed" && mine.length > 0 && (
            <div className="mt-4 rounded-2xl border border-border bg-card p-4">
              <p className="mb-2.5 flex items-center gap-1.5 text-xs font-bold"><History className="h-3.5 w-3.5 text-bronze" /> بازخوردهای قبلی من روی این جلسه ({fa(mine.length)})</p>
              <ul className="max-h-44 space-y-2 overflow-y-auto pe-1">
                {mine.map((f) => {
                  const st = STATUS_FA[f.status] ?? STATUS_FA.pending;
                  return (
                    <li key={f.id} className="rounded-xl border border-border/70 bg-muted/40 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="tabular-nums text-[11.5px] font-bold">
                          تطابق <span className={pctTone(f.matchPercent)}>٪{fa(f.matchPercent)}</span>
                          {" · "}{SEV_FA[f.severity] ?? f.severity}
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {new Date(f.createdAt).toLocaleString("fa-IR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                      {f.adminNote && (
                        <p className="mt-1.5 rounded-lg bg-background/70 px-2.5 py-1.5 text-[11px] leading-relaxed"><strong className="text-bronze">پیام مدیر:</strong> {f.adminNote}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* ورودی پایین */}
        <div className="border-t border-border bg-card px-4 py-3 sm:px-5">
          {submitErr && <p role="status" className="mb-2 rounded-lg bg-destructive/10 px-3 py-1.5 text-[11.5px] text-destructive">{submitErr}</p>}
          <form
            onSubmit={(e) => { e.preventDefault(); void send(); }}
            className="flex items-end gap-2"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
              }}
              rows={2}
              maxLength={4000}
              placeholder={auth.status === "authed" ? "انتقاد یا پیشنهادت دربارهٔ تدریس این جلسه را بنویس…" : "برای گفت‌وگو ابتدا وارد حساب شو…"}
              dir="rtl"
              className="min-h-[46px] flex-1 resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-[13.5px] leading-relaxed outline-none placeholder:text-muted-foreground/70 focus:border-bronze"
              aria-label="متن بازخورد"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending || submitting || auth.status !== "authed"}
              className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-transform active:scale-95 disabled:opacity-40"
              aria-label="ارسال"
            >
              {sending ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Send className="h-4.5 w-4.5 -scale-x-100" />}
            </button>
          </form>

          <button
            onClick={() => void submitToAdmin()}
            disabled={!canSubmit}
            title={userMsgCount === 0 ? "اول حداقل یک انتقاد بنویس" : undefined}
            className="mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-bronze px-5 py-3 text-sm font-bold text-white shadow-card transition-all hover:brightness-110 active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {submitting ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <CheckCheck className="h-4.5 w-4.5" />}
            تحلیل نهایی و ثبت پیشنهاد برای مدیر
          </button>
          <p className="mt-1.5 text-center text-[10.5px] text-muted-foreground">
            هر ثبت، رکورد ابدی می‌سازد و هیچ‌گاه از پایگاه داده پاک نمی‌شود.
          </p>
        </div>
      </div>
    </div>
  );
}
