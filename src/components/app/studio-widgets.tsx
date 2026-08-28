"use client";

// ─── ابزارهای مشترک اتاق استاد: سازندهٔ آزمون + انتخاب تصویر شاخص ─────────────
// QuizEditor: ساخت تست چهارگزینه‌ای برای فصل، جلسه یا مطلب — دلخواه ولی حرفه‌ای.
// ThumbnailPicker: تصویر شاخص دلخواه با آپلود یا لینک و پیش‌نمایش زنده.
import * as React from "react";
import {
  ListChecks, Plus, Trash2, ChevronDown, Loader2, ImagePlus, Link2, X, RefreshCcw, HelpCircle,
} from "lucide-react";
import type { QuizQuestion } from "@/lib/law/types";
import { fa } from "@/lib/fa";

/* ─── قالب پیش‌نویس سؤال در ویرایشگر ── */
export interface QuizDraft {
  q: string;
  opts: string[]; // همیشه ۴ خانه؛ خانه‌های خالی ذخیره نمی‌شوند
  answer: number; // ایندکس ۰..۳ یا -1 (انتخاب‌نشده)
  why: string; // پاسخ تشریحی
}

const OPT_KEYS = ["الف", "ب", "ج", "د"];

/** پیش‌نویس → بدنهٔ ارسالی به سرور (فقط سؤال‌های کامل) */
export function draftToQuizPayload(qs: QuizDraft[]) {
  return qs
    .filter((x) => x.q.trim() && x.opts.filter((o) => o.trim()).length >= 2 && x.answer >= 0 && !!x.opts[x.answer]?.trim())
    .map((x) => {
      const filled = x.opts.map((t, i) => ({ t: t.trim(), i })).filter((x2) => x2.t);
      return {
        q: x.q.trim(),
        options: filled.map((f, k) => ({ key: ["a", "b", "c", "d"][k], text: f.t })),
        answer: ["a", "b", "c", "d"][filled.findIndex((f) => f.i === x.answer)] ?? "a",
        explanation: x.why.trim(),
      };
    });
}

/** آزمون ذخیره‌شده → پیش‌نویس ویرایشگر */
export function quizPayloadToDraft(qs: QuizQuestion[]): QuizDraft[] {
  return (qs ?? []).map((q) => {
    const opts = ["", "", "", ""];
    let answer = 0;
    q.options.forEach((o, i) => {
      if (i < 4) opts[i] = o.text;
      if (o.key === q.answer) answer = i;
    });
    return { q: q.q, opts, answer, why: q.explanation ?? "" };
  });
}

export function emptyQuestion(): QuizDraft {
  return { q: "", opts: ["", "", "", ""], answer: -1, why: "" };
}

const inputCls =
  "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-bronze placeholder:text-muted-foreground/50";

/* ═══ سازندهٔ آزمون — برای فصل/جلسهٔ دوره و برای مطلب ═══════════════════════ */
export function QuizEditor({
  label, questions, onChange, accentTone = "bronze",
}: {
  label: string; // مثل «آزمون این جلسه»
  questions: QuizDraft[];
  onChange: (next: QuizDraft[]) => void;
  accentTone?: "bronze" | "primary";
}) {
  const [open, setOpen] = React.useState(false);
  const incomplete = questions.some(
    (x) => !x.q.trim() || x.opts.filter((o) => o.trim()).length < 2 || x.answer < 0 || !x.opts[x.answer]?.trim(),
  );
  const ready = questions.length - questions.filter(
    (x) => !x.q.trim() || x.opts.filter((o) => o.trim()).length < 2 || x.answer < 0 || !x.opts[x.answer]?.trim(),
  ).length;

  const patch = (i: number, p: Partial<QuizDraft>) => onChange(questions.map((x, k) => (k === i ? { ...x, ...p } : x)));

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background/60">
      {/* سربرگ جمع‌شونده */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex w-full items-center gap-2 px-3 py-2.5 text-start transition-colors hover:bg-muted/50 ${open ? "bg-muted/50" : ""}`}
      >
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${accentTone === "bronze" ? "bg-bronze/15 text-bronze" : "bg-primary/10 text-primary"}`}>
          <ListChecks className="h-4 w-4" />
        </span>
        <span className="flex-1 text-[12px] font-bold">{label}</span>
        {questions.length > 0 && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ready === questions.length ? "bg-success/15 text-success" : "bg-amber-400/20 text-amber-600 dark:text-amber-400"}`}>
            {fa(ready)} از {fa(questions.length)} سؤال آماده
          </span>
        )}
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-border p-3">
          {questions.length === 0 && (
            <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[11px] leading-relaxed text-muted-foreground">
              برای این بخش آزمون نساخته‌ای — با «افزودن سؤال» یک تست چهارگزینه‌ای بساز؛ دانشجو بعد از مطالعه آن را می‌بیند.
            </p>
          )}

          {questions.map((x, i) => (
            <div key={i} className="relative rounded-xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-muted font-display text-[11px] font-bold text-muted-foreground">{fa(i + 1)}</span>
                <span className="flex-1 text-[10.5px] font-bold text-muted-foreground">سؤال چهارگزینه‌ای</span>
                <button
                  type="button"
                  aria-label="حذف سؤال"
                  onClick={() => onChange(questions.filter((_, k) => k !== i))}
                  className="rounded-md p-1 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <textarea
                value={x.q}
                onChange={(e) => patch(i, { q: e.target.value })}
                rows={2}
                maxLength={600}
                placeholder="متن سؤال… مثل: ضمان‌اقویه چه تفاوتی با ضمان‌ضعیفه دارد؟"
                className={`${inputCls} resize-y text-[13px]`}
                aria-label={`متن سؤال ${fa(i + 1)}`}
              />

              {/* گزینه‌ها با انتخاب پاسخ صحیح */}
              <div className="mt-2 space-y-1.5">
                {x.opts.map((o, oi) => {
                  const on = x.answer === oi;
                  return (
                    <div key={oi} className="flex items-center gap-1.5">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={on}
                        aria-label={`پاسخ صحیح: گزینهٔ ${OPT_KEYS[oi]}`}
                        title={o.trim() ? `گزینهٔ صحیح: ${OPT_KEYS[oi]}` : "اول گزینه را پر کن"}
                        disabled={!o.trim() && !on}
                        onClick={() => patch(i, { answer: on ? -1 : oi })}
                        className={`grid h-7 w-9 shrink-0 place-items-center rounded-lg text-[10.5px] font-bold transition-all ${
                          on
                            ? "bg-success text-success-foreground shadow-card"
                            : o.trim()
                              ? "border border-border bg-background text-muted-foreground hover:border-success/50 hover:text-success"
                              : "border border-dashed border-border/60 bg-muted/40 text-muted-foreground/40"
                        } disabled:cursor-not-allowed`}
                      >
                        {OPT_KEYS[oi]}
                      </button>
                      <input
                        value={o}
                        onChange={(e) => patch(i, { opts: x.opts.map((v, k) => (k === oi ? e.target.value : v)) })}
                        placeholder={`گزینهٔ ${OPT_KEYS[oi]}${oi < 2 ? " (لازم)" : " — اختیاری"}`}
                        maxLength={300}
                        className="min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 py-1.5 text-[13px] outline-none transition-colors focus:border-bronze"
                        aria-label={`گزینهٔ ${OPT_KEYS[oi]} سؤال ${fa(i + 1)}`}
                      />
                      {oi >= 2 && !o.trim() && x.answer !== oi && (
                        <button
                          type="button"
                          aria-label="حذف گزینه"
                          onClick={() => patch(i, { opts: x.opts.map((v, k) => (k === oi ? "" : v)), answer: x.answer === oi ? -1 : x.answer })}
                          className="shrink-0 rounded-md p-1 text-muted-foreground/50 hover:bg-muted"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <textarea
                value={x.why}
                onChange={(e) => patch(i, { why: e.target.value })}
                rows={2}
                maxLength={1000}
                placeholder="پاسخ تشریحی (بعد از پاسخ دانشجو نمایش داده می‌شود)…"
                className={`${inputCls} mt-2 resize-y text-[12.5px]`}
                aria-label={`پاسخ تشریحی سؤال ${fa(i + 1)}`}
              />
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onChange([...questions, emptyQuestion()])}
              disabled={questions.length >= 30}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-[11.5px] font-bold text-primary disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> افزودن سؤال
            </button>
            {questions.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground"
                title="همهٔ سؤال‌ها را بردار"
              >
                <RefreshCcw className="h-3 w-3" /> پاک کردن همه
              </button>
            )}
            {incomplete && (
              <p className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-amber-600 dark:text-amber-400">
                <HelpCircle className="h-3.5 w-3.5" /> سؤال‌های ناقص (بدون متن، دو گزینه یا پاسخ صحیح) ذخیره نمی‌شوند
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ انتخاب تصویر شاخص — آپلود یا لینک، کاملاً دلخواه ══════════════════════ */
export function ThumbnailPicker({
  value, onChange, label = "تصویر شاخص (دلخواه)",
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}) {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [urlMode, setUrlMode] = React.useState(false);
  const [urlDraft, setUrlDraft] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setErr("");
    if (file.size > 4 * 1024 * 1024) {
      setErr("حجم تصویر باید کمتر از ۴ مگابایت باشد.");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/cover/upload", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "آپلود ناموفق بود.");
      onChange(j.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطایی رخ داد.");
    } finally {
      setBusy(false);
    }
  }

  function commitUrl() {
    const u = urlDraft.trim();
    if (!u) return;
    if (!/^https?:\/\/[\w.-]+/i.test(u) && !(u.startsWith("/") && !u.startsWith("//"))) {
      setErr("لینک باید با https:// شروع شود یا مسیر داخلی باشد.");
      return;
    }
    setErr("");
    onChange(u);
    setUrlMode(false);
  }

  return (
    <div>
      <label className="mb-1 block text-[11.5px] font-bold text-muted-foreground">
        {label} <span className="font-medium text-muted-foreground/70">— اگر نگذاری جلد رنگی خودکار ساخته می‌شود</span>
      </label>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />

      {value ? (
        /* پیش‌نمایش تصویر انتخاب‌شده */
        <div className="group relative overflow-hidden rounded-xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="تصویر شاخص" className="h-32 w-full object-cover sm:h-36" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/45 opacity-0 backdrop-blur-[2px] transition-opacity group-hover:opacity-100">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-[11px] font-bold text-gray-900 hover:bg-white">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />} تغییر
            </button>
            <button
              type="button"
              onClick={() => { setUrlDraft(value); setUrlMode(true); }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-[11px] font-bold text-gray-900 hover:bg-white"
            >
              <Link2 className="h-3.5 w-3.5" /> لینک
            </button>
            <button type="button" onClick={() => onChange("")} aria-label="حذف تصویر" className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-[11px] font-bold text-white hover:brightness-110">
              <Trash2 className="h-3.5 w-3.5" /> حذف
            </button>
          </div>
        </div>
      ) : urlMode ? (
        /* حالت واردکردن لینک */
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Link2 className="absolute end-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <input
              autoFocus
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitUrl(); } if (e.key === "Escape") setUrlMode(false); }}
              placeholder="https://… یا /api/cover/…"
              dir="ltr"
              className={`${inputCls} pe-8 text-start text-[12.5px]`}
              aria-label="آدرس تصویر"
            />
          </div>
          <button type="button" onClick={commitUrl} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">ثبت</button>
          <button type="button" onClick={() => { setUrlMode(false); setErr(""); }} className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground">بی‌خیال</button>
        </div>
      ) : (
        /* حالت خالی — دو راه آپلود یا لینک */
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-bronze/50 bg-bronze/[0.06] px-3 py-3.5 text-[12px] font-bold text-bronze transition-colors hover:bg-bronze/[0.12] disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {busy ? "در حال آپلود…" : "آپلود تصویر"}
          </button>
          <button
            type="button"
            onClick={() => setUrlMode(true)}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background px-3 py-3.5 text-[12px] font-bold text-muted-foreground transition-colors hover:border-bronze/40 hover:text-foreground"
          >
            <Link2 className="h-4 w-4" /> لینک تصویر
          </button>
        </div>
      )}

      {err && <p className="mt-1.5 text-[11px] font-semibold text-destructive">{err}</p>}
      {!err && !value && !urlMode && (
        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/70">PNG، JPG یا WebP تا ۴ مگابایت — نمایش در سربرگ و کارت‌ها.</p>
      )}
    </div>
  );
}
