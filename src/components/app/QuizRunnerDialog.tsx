"use client";

// ─── اجراکنندهٔ آزمون در گفت‌وگو — برای «آزمون فصل» و «آزمون پایان مبحث» ──────
// سؤال‌به‌سؤال با بازخورد فوری، پاسخ تشریحی استاد و کارنامهٔ پایانی؛
// نتیجه فقط محلی است و در پیشرفت جلسات دست نمی‌زند.
import * as React from "react";
import {
  CheckCircle2, XCircle, ChevronLeft, ChevronRight, ListChecks, RefreshCcw, Lightbulb, X, Award,
} from "lucide-react";
import type { QuizQuestion } from "@/lib/law/types";
import { fa } from "@/lib/fa";

const FA_LETTER: Record<string, string> = { a: "الف", b: "ب", c: "ج", d: "د" };

export function QuizRunnerDialog({
  open, onClose, title, subtitle, questions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  questions: QuizQuestion[];
}) {
  const [idx, setIdx] = React.useState(0);
  const [picked, setPicked] = React.useState<(string | null)[]>(() => questions.map(() => null));
  const [done, setDone] = React.useState(false);

  // با هر باز شدن/تغییر آزمون، صفر شود
  React.useEffect(() => {
    if (open) {
      setIdx(0);
      setPicked(questions.map(() => null));
      setDone(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, questions]);

  if (!open || questions.length === 0) return null;

  const q = questions[idx];
  const sel = picked[idx] ?? null;
  const answered = sel !== null;
  const correct = sel === q.answer;
  const last = idx === questions.length - 1;
  const answeredCount = picked.filter((p) => p !== null).length;
  const score = picked.reduce((n, p, i) => n + (p && p === questions[i].answer ? 1 : 0), 0);

  function pick(k: string) {
    if (picked[idx] !== null) return; // یک‌بار پاسخ
    setPicked((p) => p.map((v, i) => (i === idx ? k : v)));
  }

  function next() {
    if (!last) setIdx((i) => i + 1);
    else setDone(true);
  }

  const tone = correct ? "success" : "destructive";

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-start justify-items-center overflow-y-auto bg-black/50 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="my-4 w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        {/* سربرگ */}
        <div className="flex items-center gap-2.5 border-b border-border bg-gradient-to-l from-bronze/[0.10] to-transparent px-4 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-bronze/15 text-bronze">
            <ListChecks className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold">{title}</p>
            {subtitle && <p className="truncate text-[10.5px] text-muted-foreground">{subtitle}</p>}
          </div>
          {!done && (
            <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[10.5px] font-bold text-muted-foreground" dir="ltr">
              {fa(idx + 1)} / {fa(questions.length)}
            </span>
          )}
          <button onClick={onClose} aria-label="بستن آزمون" className="ms-1 shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* نوار پیشرفت */}
        {!done && (
          <div className="h-1 w-full bg-muted/60">
            <div
              className="h-full bg-gradient-to-l from-bronze to-primary transition-all duration-300"
              style={{ width: `${(answeredCount / questions.length) * 100}%` }}
            />
          </div>
        )}

        {done ? (
          /* ── کارنامهٔ پایانی ── */
          <div className="space-y-4 p-6 text-center">
            <span className={`mx-auto grid h-16 w-16 rotate-45 place-items-center rounded-2xl shadow-card ${score / questions.length >= 0.7 ? "bg-success/15 text-success" : "bg-amber-400/20 text-amber-600 dark:text-amber-400"}`}>
              <Award className="h-7 w-7 -rotate-45" />
            </span>
            <div>
              <p className="font-display text-lg font-extrabold">
                {score / questions.length >= 0.9
                  ? "درخشیدی!"
                  : score / questions.length >= 0.7
                    ? "خوب بود!"
                    : "مرور دوباره لازم است"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {fa(score)} پاسخ درست از {fa(questions.length)} سؤال —
                <span className="font-bold text-bronze"> {fa(Math.round((score / questions.length) * 100))}٪</span>
              </p>
            </div>

            {/* ردیف سؤال‌ها */}
            <div className="flex flex-wrap justify-center gap-1.5">
              {questions.map((qq, i) => {
                const ok = picked[i] === qq.answer;
                return (
                  <button
                    key={i}
                    onClick={() => { setDone(false); setIdx(i); }}
                    title={`سؤال ${fa(i + 1)}`}
                    className={`grid h-8 w-8 place-items-center rounded-lg text-[11px] font-bold transition-transform hover:scale-105 ${
                      ok ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {fa(i + 1)}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-center gap-2 pt-1">
              <button
                onClick={() => { setIdx(0); setPicked(questions.map(() => null)); setDone(false); }}
                className="inline-flex items-center gap-2 rounded-xl border border-bronze/50 bg-bronze/10 px-4 py-2.5 text-sm font-bold text-bronze transition-colors hover:bg-bronze/20"
              >
                <RefreshCcw className="h-4 w-4" /> تمرین دوباره
              </button>
              <button onClick={onClose} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:brightness-110">
                پایان
              </button>
            </div>
          </div>
        ) : (
          /* ── سؤال جاری ── */
          <div className="p-4 sm:p-5">
            <p className="mb-1 text-[11px] font-bold text-bronze">سؤال {fa(idx + 1)}</p>
            <p className="mb-4 text-[15px] font-bold leading-relaxed">{q.q}</p>

            <div className="space-y-2" role="radiogroup" aria-label="گزینه‌ها">
              {q.options.map((o) => {
                const isSel = sel === o.key;
                const isAns = o.key === q.answer;
                const revealed = answered;
                let cls = "border-border bg-background hover:border-bronze/60";
                if (revealed && isAns) cls = "border-success/70 bg-success/10";
                else if (revealed && isSel && !isAns) cls = "border-destructive/70 bg-destructive/10";
                else if (revealed) cls = "border-border bg-muted/40 opacity-70";
                return (
                  <button
                    key={o.key}
                    role="radio"
                    aria-checked={isSel}
                    disabled={revealed}
                    onClick={() => pick(o.key)}
                    className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start text-[13.5px] font-medium leading-relaxed transition-all ${cls}`}
                  >
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[11px] font-bold ${
                      revealed && isAns ? "bg-success text-success-foreground" : revealed && isSel ? "bg-destructive text-white" : "bg-muted text-muted-foreground"
                    }`}>
                      {FA_LETTER[o.key] ?? o.key}
                    </span>
                    <span className="min-w-0 flex-1">{o.text}</span>
                    {revealed && isAns && <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />}
                    {revealed && isSel && !isAns && <XCircle className="h-5 w-5 shrink-0 text-destructive" />}
                  </button>
                );
              })}
            </div>

            {/* بازخورد فوری + پاسخ تشریحی استاد */}
            {answered && (
              <div
                className={`mt-3 rounded-xl border p-3.5 ${
                  tone === "success"
                    ? "border-success/40 bg-success/[0.07]"
                    : "border-destructive/40 bg-destructive/[0.06]"
                }`}
                role="status"
              >
                <p className={`flex items-center gap-1.5 text-[12.5px] font-extrabold ${tone === "success" ? "text-success" : "text-destructive"}`}>
                  {correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {correct ? "درست بود!" : `پاسخ درست: ${FA_LETTER[q.answer] ?? q.answer}`}
                </p>
                {q.explanation && (
                  <p className="mt-2 flex gap-2 text-[12.5px] leading-relaxed text-foreground/90">
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-bronze" />
                    <span>{q.explanation}</span>
                  </p>
                )}
                <button
                  onClick={next}
                  autoFocus
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:brightness-110"
                >
                  {last ? "دیدن کارنامه" : "سؤال بعدی"}
                  {last ? <Award className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </button>
              </div>
            )}

            {/* پیمایش دستی بین سؤال‌های پاسخ‌داده */}
            {!answered && idx > 0 && (
              <button
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-bold text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronRight className="h-3.5 w-3.5" /> سؤال قبلی
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
