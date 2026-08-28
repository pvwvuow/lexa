"use client";

// ─── بسته‌های آزمون — دفترچه‌های تستی (یکجا + زمان‌دار) و تشریحی، برای همهٔ آزمون‌ها ───
import * as React from "react";
import { motion } from "framer-motion";
import {
  ClipboardList, FileText, Clock3, GraduationCap, House, Library,
  CheckCircle2, XCircle, Target, Sparkles, Award, Eye,
} from "lucide-react";
import {
  examPacks, getExamPack, examTypes,
  type ExamPack, type McqPack, type DescPack, type DescPack as DescPackAlias,
} from "@/lib/law/examPacks";
import { fa } from "@/lib/fa";
import { navigate } from "@/lib/router";
import { useApp, weakTopics } from "@/lib/store";
import { ProgressBar, EmptyState } from "./common";
import { ExamPackRunner, PackNotFound } from "./ExamPackRunner";

const WEAK_KEY = "hoh_weak_topics";

function mergeWeakTopics(adds: string[]) {
  const set = new Set(weakTopics());
  adds.forEach((t) => t && set.add(t));
  set.delete("");
  try { localStorage.setItem(WEAK_KEY, JSON.stringify([...set])); } catch { /* ignore */ }
}

/* ═══ کارت یک بسته در مرکز آزمون / کتابخانه ═══ */
export function ExamPackCard({ pack, showExam = true }: { pack: ExamPack; showExam?: boolean }) {
  const attempts = useApp((s) => s.examAttempts[pack.id]);
  const best = attempts?.length ? Math.max(...attempts.map((a) => a.score)) : undefined;
  const isMcq = pack.kind === "mcq";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-card transition-colors hover:border-bronze/50 sm:p-5">
      <span aria-hidden className="absolute -top-[7px] start-1/2 h-px w-16 -translate-x-1/2 rtl:translate-x-1/2 bg-gradient-to-l from-transparent via-bronze/60 to-transparent" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {showExam && <p className="text-[11px] font-bold text-bronze">{pack.exam}</p>}
          <h3 className="mt-0.5 font-display text-[15px] font-bold leading-snug">{pack.title}</h3>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[9.5px] font-extrabold ${
          isMcq ? "bg-bronze/10 text-bronze" : "bg-sky-500/10 text-sky-600"
        }`}>
          {isMcq ? <ClipboardList className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
          {isMcq ? "تستی" : "تشریحی"}
        </span>
      </div>

      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{pack.description}</p>

      <div className="mt-3 flex flex-wrap gap-2 text-[10.5px] font-bold">
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-primary">{fa(pack.questions.length)} سؤال</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-muted-foreground"><Clock3 className="h-3 w-3" /> {fa(pack.minutes)} دقیقه</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-muted-foreground">{pack.branch}</span>
        {typeof best === "number" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-success"><Award className="h-3 w-3" /> بهترین: {fa(best)}٪</span>
        )}
      </div>

      <button
        onClick={() => navigate({ view: "quiz", id: pack.id })}
        className="mt-3.5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:brightness-110"
      >
        <GraduationCap className="h-4 w-4" />
        {isMcq ? `شروع آزمون — ${fa(pack.questions.length)} سؤال یکجا` : "مرور سؤال‌های تشریحی"}
      </button>
    </div>
  );
}

/* ═══ مرکز بسته‌ها — در تب «بسته‌های آزمون» مرکز آزمون ═══ */
export function ExamPackHub({ onUseLibrary }: { onUseLibrary?: () => void }) {
  const [type, setType] = React.useState<string>("ALL");
  const types = React.useMemo(() => examTypes(), []);
  const shown = React.useMemo(() => (type === "ALL" ? examPacks : examPacks.filter((p) => p.examSlug === type)), [type]);

  return (
    <div className="space-y-5">
      {/* معرفی + آزمون دلخواه */}
      <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-bronze/40 bg-gradient-to-l from-bronze/[0.06] to-transparent p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-md text-[12px] leading-relaxed text-muted-foreground">
          <span className="font-bold text-foreground">دفترچه‌های آمادهٔ آزمون</span> — تستی‌ها یکجا با زمان‌سنج مثل جلسهٔ واقعی؛ تشریحی‌ها با پاسخ نمونه و کلیدواژه.
          همهٔ آزمون‌ها به‌مرور اینجا اضافه می‌شوند.
        </p>
        {onUseLibrary && (
          <button onClick={onUseLibrary} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-bronze bg-bronze/10 px-4 py-2 text-xs font-bold text-bronze transition-colors hover:bg-bronze/20">
            <Library className="h-3.5 w-3.5" /> از کتابخانهٔ خودم آزمون بسازم
          </button>
        )}
      </div>

      {/* فیلتر نوع آزمون */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        {[{ slug: "ALL", label: `همه (${fa(examPacks.length)})` }, ...types].map((t) => (
          <button
            key={t.slug}
            onClick={() => setType(t.slug)}
            aria-pressed={type === t.slug}
            className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition-all ${
              type === t.slug
                ? "border-bronze bg-gradient-to-l from-bronze/[0.14] to-transparent text-bronze shadow-card"
                : "border-border bg-card text-muted-foreground hover:border-bronze/40 hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* بسته‌ها به تفکیک نوع آزمون */}
      {types.filter((t) => type === "ALL" || type === t.slug).map((t) => (
        <section key={t.slug} className="space-y-3">
          <h3 className="flex items-center gap-2 text-base font-bold">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-bronze/10 text-bronze"><ClipboardList className="h-4 w-4" /></span>
            {t.label}
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{fa(t.count)} دفترچه</span>
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {shown.filter((p) => p.examSlug === t.slug).map((p) => (
              <ExamPackCard key={p.id} pack={p} showExam={type === "ALL"} />
            ))}
          </div>
        </section>
      ))}

      {shown.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground shadow-card">
          فعلاً دفترچه‌ای برای این نوع آزمون نیست.
        </p>
      )}
    </div>
  );
}

/* ═══ خوانندهٔ دفترچهٔ تشریحی — سؤال‌به‌سؤال با پاسخ نمونه و خودارزیابی ═══ */
export function DescriptiveReader({ pack }: { pack: DescPack }) {
  const [idx, setIdx] = React.useState(0);
  const [revealed, setRevealed] = React.useState<Set<number>>(() => new Set());
  const [self, setSelf] = React.useState<Record<number, boolean>>({});
  const [done, setDone] = React.useState(false);
  const [weakSaved, setWeakSaved] = React.useState(false);

  const qs = pack.questions;
  const q = qs[idx];
  const isRevealed = revealed.has(idx);
  const knownCount = Object.values(self).filter(Boolean).length;
  const unknownCount = Object.values(self).filter((v) => v === false).length;

  function toggleReveal() {
    setRevealed((r) => {
      const n = new Set(r);
      if (n.has(idx)) n.delete(idx); else n.add(idx);
      return n;
    });
  }

  function finish() {
    const unknownTopics = qs.filter((_, i) => self[i] === false).map((q2) => q2.topic ?? pack.branch);
    if (unknownTopics.length) mergeWeakTopics([...new Set(unknownTopics)]);
    setWeakSaved(unknownTopics.length > 0);
    setDone(true);
  }

  if (done) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-5 px-4 pb-24 pt-6 sm:px-6">
        <motion.section initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl border border-border bg-card p-8 text-center shadow-card">
          <Sparkles className="mx-auto h-10 w-10 text-bronze" />
          <h1 className="mt-3 text-xl font-bold">دفترچهٔ «{pack.title}» را مرور کردی</h1>
          <div className="mx-auto mt-5 grid max-w-sm grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-success/30 bg-success/[0.06] px-2 py-3">
              <p className="font-display text-lg font-bold text-success">{fa(knownCount)}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">بلد بودم</p>
            </div>
            <div className="rounded-xl border border-warn/40 bg-warn/[0.07] px-2 py-3">
              <p className="font-display text-lg font-bold text-warn">{fa(unknownCount)}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">نیاز به مرور</p>
            </div>
          </div>
          {weakSaved && (
            <p className="mx-auto mt-4 max-w-sm rounded-xl bg-bronze/10 px-4 py-2.5 text-xs leading-relaxed text-bronze">
              مباحث ناشناخته به فهرست «مباحث ضعیف» اضافه شد — در فلش‌کارت‌ها و تست‌های مرکز آزمون اولویت مرور می‌گیرند.
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => { setIdx(0); setRevealed(new Set()); setSelf({}); setDone(false); setWeakSaved(false); }}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-card"
            >
              مرور دوباره از اول
            </button>
            <button onClick={() => navigate({ view: "quiz" })} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-semibold hover:border-bronze">
              <Library className="h-4 w-4" /> مرکز آزمون
            </button>
            <button onClick={() => navigate({ view: "home" })} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-semibold hover:border-bronze">
              <House className="h-4 w-4" /> خانه
            </button>
          </div>
        </motion.section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-4 sm:px-6">
      {/* سربرگ */}
      <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-card">
        <p className="text-[11px] font-bold text-sky-600">{pack.exam} · {pack.branch}</p>
        <h1 className="mt-0.5 font-display text-base font-bold">{pack.title}</h1>
        <div className="mt-3 flex items-center gap-3">
          <ProgressBar value={Math.round(((idx + 1) / qs.length) * 100)} className="flex-1" />
          <span className="shrink-0 text-[11px] font-bold text-muted-foreground">{fa(idx + 1)}/{fa(qs.length)}</span>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1">
          {qs.map((_, i) => {
            const s = self[i];
            return (
              <button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`سؤال ${fa(i + 1)}`}
                className={`h-6 w-6 rounded-md text-[9.5px] font-bold transition-colors ${
                  i === idx ? "ring-2 ring-bronze ring-offset-1 ring-offset-card" : ""
                } ${s === true ? "bg-success/80 text-white" : s === false ? "bg-warn/80 text-white" : "bg-muted text-muted-foreground"}`}
              >
                {fa(i + 1)}
              </button>
            );
          })}
        </div>
      </div>

      {/* سؤال جاری */}
      <motion.div key={idx} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22 }} className="rounded-2xl border border-border bg-card p-5 shadow-card">
        {q.topic && <span className="mb-2.5 inline-block rounded-full bg-sky-500/10 px-2.5 py-0.5 text-[10px] font-bold text-sky-600">{q.topic}</span>}
        <p className="text-[15px] font-semibold leading-relaxed">{q.q}</p>

        {isRevealed ? (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-3">
            {q.keywords && q.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {q.keywords.map((k) => (
                  <span key={k} className="rounded-full bg-primary/10 px-2.5 py-1 text-[10.5px] font-bold text-primary">{k}</span>
                ))}
              </div>
            )}
            <div className="rounded-xl border border-success/25 bg-success/[0.05] p-4">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-extrabold text-success"><CheckCircle2 className="h-3.5 w-3.5" /> پاسخ نمونه</p>
              <p className="whitespace-pre-line text-[13px] leading-[1.9] text-foreground/95">{q.answer}</p>
            </div>
          </motion.div>
        ) : (
          <p className="mt-3 rounded-xl bg-muted/50 px-4 py-3 text-[11.5px] leading-relaxed text-muted-foreground">
            اول پاسخ را خودت در ذهنت یا روی کاغذ بنویس؛ بعد پاسخ نمونه را باز کن و خودت را بسنج.
          </p>
        )}

        <button
          onClick={toggleReveal}
          className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
            isRevealed ? "border border-border bg-background hover:border-bronze" : "bg-primary text-primary-foreground hover:brightness-110"
          }`}
        >
          <Eye className="h-4 w-4" /> {isRevealed ? "بستن پاسخ نمونه" : "نمایش پاسخ نمونه"}
        </button>

        {/* خودارزیابی */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => setSelf((s) => ({ ...s, [idx]: true }))}
            aria-pressed={self[idx] === true}
            className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[12.5px] font-bold transition-colors ${
              self[idx] === true ? "border-success bg-success/10 text-success" : "border-border bg-background text-muted-foreground hover:border-success/50"
            }`}
          >
            <CheckCircle2 className="h-4 w-4" /> بلد بودم
          </button>
          <button
            onClick={() => setSelf((s) => ({ ...s, [idx]: false }))}
            aria-pressed={self[idx] === false}
            className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[12.5px] font-bold transition-colors ${
              self[idx] === false ? "border-warn bg-warn/10 text-warn" : "border-border bg-background text-muted-foreground hover:border-warn/50"
            }`}
          >
            <XCircle className="h-4 w-4" /> بلد نبودم
          </button>
        </div>
      </motion.div>

      {/* ناوبری */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          onClick={() => setIdx((v) => Math.max(0, v - 1))}
          disabled={idx === 0}
          className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold transition-colors hover:border-bronze disabled:opacity-40"
        >
          قبلی
        </button>
        {idx + 1 < qs.length ? (
          <button onClick={() => setIdx((v) => v + 1)} className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-card transition-transform active:scale-[.98]">
            بعدی
          </button>
        ) : (
          <button onClick={finish} className="inline-flex items-center gap-1.5 rounded-xl bg-bronze px-6 py-2.5 text-sm font-bold text-white shadow-card transition-transform active:scale-[.98]">
            <Target className="h-4 w-4" /> پایان و جمع‌بندی
          </button>
        )}
      </div>
      {idx + 1 < qs.length && (
        <button onClick={finish} className="mt-3 w-full rounded-xl border border-dashed border-border bg-background px-4 py-2.5 text-xs font-bold text-muted-foreground transition-colors hover:border-bronze hover:text-bronze">
          پایان مرور و جمع‌بندی
        </button>
      )}
    </div>
  );
}

/* ═══ ورودی عمومی — بسته را از مسیر باز می‌کند (#/quiz/pack-*) ═══ */
export function ExamPackRoute({ packId }: { packId: string }) {
  const pack = React.useMemo(() => getExamPack(packId), [packId]);
  if (!pack) return <PackNotFound />;
  if (pack.kind === "mcq") return <ExamPackRunner pack={pack as McqPack} />;
  return <DescriptiveReader pack={pack as DescPackAlias} />;
}
