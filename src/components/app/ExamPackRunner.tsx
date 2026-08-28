"use client";

// ─── اجرای دفترچهٔ آزمون تستی — یکجا، زمان‌دار، نتیجه در پایان (مثل جلسهٔ واقعی) ───
import * as React from "react";
import { motion } from "framer-motion";
import {
  Timer, Flag, RefreshCcw, House, ClipboardList, CheckCircle2, XCircle,
  CircleHelp, ChevronDown, Trophy, Library, AlertTriangle, Eye, EyeOff,
} from "lucide-react";
import type { McqPack, ExamMCQ } from "@/lib/law/examPacks";
import { fa } from "@/lib/fa";
import { navigate } from "@/lib/router";
import { useApp, weakTopics, type ExamAttempt } from "@/lib/store";
import { Donut, EmptyState } from "./common";

const WEAK_KEY = "hoh_weak_topics";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** ادغام مبحث‌های ضعیف در مخزن localStorage (همان الگوی مرکز آزمون) */
function mergeWeakTopics(adds: string[]) {
  const set = new Set(weakTopics());
  adds.forEach((t) => t && set.add(t));
  set.delete("");
  try { localStorage.setItem(WEAK_KEY, JSON.stringify([...set])); } catch { /* ignore */ }
}

/** سؤال با گزینه‌های بُرخورده — پاسخ صحیح هم ایندکس تازه می‌گیرد */
interface PreparedQ {
  q: string;
  options: string[];
  answer: number;
  why: string;
  topic?: string;
}

function prepare(questions: ExamMCQ[], shuffleQ: boolean): PreparedQ[] {
  const base = shuffleQ ? shuffle(questions) : [...questions];
  return base.map((q) => {
    const perm = shuffle(q.options.map((_, i) => i));
    return {
      q: q.q,
      options: perm.map((i) => q.options[i]),
      answer: perm.indexOf(q.answer),
      why: q.why,
      topic: q.topic,
    };
  });
}

function fmtClock(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${fa(m)}:${fa(String(r).padStart(2, "0"))}`;
}

type Phase = "setup" | "run" | "result";

export function ExamPackRunner({ pack }: { pack: McqPack }) {
  const recordExamAttempt = useApp((s) => s.recordExamAttempt);
  const attempts = useApp((s) => s.examAttempts[pack.id]);

  const [phase, setPhase] = React.useState<Phase>("setup");
  const [timerOn, setTimerOn] = React.useState(true);
  const [shuffleQ, setShuffleQ] = React.useState(true);
  const [onlyWrong, setOnlyWrong] = React.useState(false);

  const [prepared, setPrepared] = React.useState<PreparedQ[] | null>(null);
  const [answers, setAnswers] = React.useState<Record<number, number>>({});
  const [flags, setFlags] = React.useState<number[]>([]);
  const [idx, setIdx] = React.useState(0);
  const [startedAt, setStartedAt] = React.useState(0);
  const [now, setNow] = React.useState(0);
  const [autoEnded, setAutoEnded] = React.useState(false);
  const [endConfirm, setEndConfirm] = React.useState(false);

  const totalSec = pack.minutes * 60;
  const usedSec = startedAt ? Math.max(0, Math.floor(((phase === "result" ? now : Date.now()) - startedAt) / 1000)) : 0;
  const remaining = timerOn ? totalSec - usedSec : Number.POSITIVE_INFINITY;

  // زمان‌سنج شمارش معکوس
  React.useEffect(() => {
    if (phase !== "run" || !timerOn) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [phase, timerOn]);

  // اتمام خودکار هنگام رسیدن به صفر
  React.useEffect(() => {
    if (phase === "run" && timerOn && remaining <= 0) finish(true);
  }, [phase, timerOn, remaining]);

  const best = React.useMemo(() => (attempts?.length ? Math.max(...attempts.map((a) => a.score)) : undefined), [attempts]);

  function start() {
    const qs = prepare(pack.questions, shuffleQ);
    setPrepared(qs);
    setAnswers({}); setFlags([]); setIdx(0);
    setAutoEnded(false); setEndConfirm(false);
    setStartedAt(Date.now()); setNow(Date.now());
    setPhase("run");
  }

  function finish(auto = false) {
    if (!prepared) return;
    setAutoEnded(auto);
    setNow(Date.now());
    let correct = 0;
    const wrongTopics: string[] = [];
    prepared.forEach((p, i) => {
      if (answers[i] === p.answer) correct++;
      else {
        const t = p.topic ?? pack.branch;
        if (!wrongTopics.includes(t)) wrongTopics.push(t);
      }
    });
    const score = Math.round((correct / Math.max(1, prepared.length)) * 100);
    const attempt: ExamAttempt = {
      date: new Date().toISOString(),
      score, correct,
      total: prepared.length,
      usedSec: startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0,
    };
    recordExamAttempt(pack.id, attempt);
    if (wrongTopics.length) mergeWeakTopics(wrongTopics);
    setEndConfirm(false);
    setPhase("result");
  }

  /* ═══ صفحهٔ شروع ═══ */
  if (phase === "setup") {
    const last = attempts?.[attempts.length - 1];
    return (
      <div className="mx-auto w-full max-w-2xl space-y-5 px-4 pb-24 pt-6 sm:px-6">
        <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-bronze/10 text-bronze"><ClipboardList className="h-6 w-6" /></span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-bronze">{pack.exam} · {pack.branch}</p>
              <h1 className="mt-0.5 font-display text-lg font-bold leading-snug">{pack.title}</h1>
            </div>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{pack.description}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">{fa(pack.questions.length)} سؤال</span>
            <span className="rounded-full bg-bronze/10 px-3 py-1 text-bronze">زمان پیشنهادی: {fa(pack.minutes)} دقیقه</span>
            {pack.passMark ? <span className="rounded-full bg-success/10 px-3 py-1 text-success">نمرهٔ قبولی {fa(pack.passMark)}٪</span> : null}
            {typeof best === "number" && <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">بهترین نمرهٔ تو: {fa(best)}٪</span>}
            {last && <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">آخرین: {fa(last.correct)} از {fa(last.total)}</span>}
          </div>
        </motion.header>

        <section className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-sm font-bold">تنظیمات برگزاری</p>
          <button onClick={() => setTimerOn((v) => !v)} aria-pressed={timerOn} className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 transition-colors hover:border-bronze/50">
            <span className="flex items-center gap-2 text-[13px] font-medium"><Timer className="h-4 w-4 shrink-0 text-bronze" /> زمان‌سنج {fa(pack.minutes)} دقیقه‌ای <span className="text-[10.5px] text-muted-foreground">(تمام شود، خودکار تصحیح می‌شود)</span></span>
            <Toggle on={timerOn} />
          </button>
          <button onClick={() => setShuffleQ((v) => !v)} aria-pressed={shuffleQ} className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 transition-colors hover:border-bronze/50">
            <span className="flex items-center gap-2 text-[13px] font-medium"><RefreshCcw className="h-4 w-4 shrink-0 text-bronze" /> بُر زدن ترتیب سؤال‌ها <span className="text-[10.5px] text-muted-foreground">(گزینه‌ها همیشه بُر می‌خورند)</span></span>
            <Toggle on={shuffleQ} />
          </button>
          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
            مثل جلسهٔ واقعی: تشریح هر سؤال فقط در پایان نمایش داده می‌شود — برای مرور دوبارهٔ مباحثِ غلط، همه به فهرست مرورت اضافه می‌شوند.
          </p>
        </section>

        <button
          onClick={start}
          className="w-full rounded-2xl bg-primary px-6 py-4 font-display text-base font-bold text-primary-foreground shadow-card transition-all duration-200 hover:-translate-y-px hover:brightness-110 active:scale-[.99]"
        >
          شروع آزمون — {fa(pack.questions.length)} سؤال یکجا
        </button>
        <div className="flex justify-center gap-3">
          <button onClick={() => navigate({ view: "quiz" })} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-semibold hover:border-bronze">
            <Library className="h-4 w-4" /> مرکز آزمون
          </button>
          <button onClick={() => navigate({ view: "home" })} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-semibold hover:border-bronze">
            <House className="h-4 w-4" /> خانه
          </button>
        </div>
      </div>
    );
  }

  if (!prepared) return null;

  /* ═══ صفحهٔ نتیجه ═══ */
  if (phase === "result") {
    const correct = prepared.reduce((n, p, i) => n + (answers[i] === p.answer ? 1 : 0), 0);
    const blank = prepared.length - Object.keys(answers).length;
    const wrong = prepared.length - correct - blank;
    const score = Math.round((correct / Math.max(1, prepared.length)) * 100);
    const passed = pack.passMark ? score >= pack.passMark : score >= 50;
    const rows = prepared.map((p, i) => ({ p, i })).filter(({ p, i }) => !onlyWrong || answers[i] !== p.answer);

    return (
      <div className="mx-auto w-full max-w-2xl space-y-5 px-4 pb-24 pt-6 sm:px-6">
        <motion.section initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 text-center shadow-card">
          <div className="relative mx-auto w-fit"><Donut value={score} size={128} stroke={11} label="نتیجهٔ دفترچه" /></div>
          <h1 className="mt-4 text-xl font-bold">
            {autoEnded ? "زمان تمام شد — دفترچه تصحیح شد" : passed ? "آفرین! دفترچه را قبول شدی" : "دفترچه را تمرین دوباره لازم داری"}
          </h1>
          {pack.passMark && (
            <p className={`mt-1 text-sm font-bold ${passed ? "text-success" : "text-warn"}`}>
              {passed ? "بالاتر از نمرهٔ قبولی" : `زیر نمرهٔ قبولی (${fa(pack.passMark)}٪)`}
            </p>
          )}
          <div className="mx-auto mt-5 grid max-w-md grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              { t: "صحیح", v: fa(correct), cls: "text-success border-success/30 bg-success/[0.06]" },
              { t: "نادرست", v: fa(wrong), cls: "text-danger border-danger/30 bg-danger/[0.06]" },
              { t: "بی‌پاسخ", v: fa(blank), cls: "text-muted-foreground border-border bg-muted/40" },
              { t: "زمان", v: fmtClock(usedSec), cls: "text-primary border-primary/25 bg-primary/[0.06]" },
            ].map((s) => (
              <div key={s.t} className={`rounded-xl border px-2 py-3 ${s.cls}`}>
                <p className="font-display text-lg font-bold">{s.v}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{s.t}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button onClick={start} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition-transform active:scale-[.98]">
              <RefreshCcw className="h-4 w-4" /> آزمون مجدد
            </button>
            <button onClick={() => setPhase("setup")} className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-semibold hover:border-bronze">
              <Trophy className="h-4 w-4" /> اطلاعات دفترچه
            </button>
            <button onClick={() => navigate({ view: "quiz" })} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-semibold hover:border-bronze">
              <Library className="h-4 w-4" /> مرکز آزمون
            </button>
          </div>
        </motion.section>

        {/* پاسخ‌نامهٔ تشریحی */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-2 border-b border-dashed border-border pb-2.5">
            <p className="text-sm font-bold">پاسخ‌نامهٔ تشریحی</p>
            <button
              onClick={() => setOnlyWrong((v) => !v)}
              aria-pressed={onlyWrong}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors ${onlyWrong ? "border-bronze bg-bronze/10 text-bronze" : "border-border bg-background text-muted-foreground hover:border-bronze/50"}`}
            >
              {onlyWrong ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {onlyWrong ? "همهٔ سؤال‌ها" : "فقط غلط‌ها و بی‌پاسخ‌ها"}
            </button>
          </div>
          {rows.length === 0 ? (
            <p className="rounded-xl bg-success/10 px-4 py-3 text-center text-sm text-success">همهٔ پاسخ‌ها درست بود — هیچ غلطی برای مرور نیست!</p>
          ) : (
            <div className="space-y-3">
              {rows.map(({ p, i }) => {
                const chosen = answers[i];
                const isCorrect = chosen === p.answer;
                return (
                  <details key={i} className="group/rev rounded-xl border border-border bg-background" open={!isCorrect}>
                    <summary className="flex cursor-pointer list-none items-start gap-2.5 px-3.5 py-3">
                      <span className={`mt-0.5 grid h-5.5 w-5.5 shrink-0 place-items-center rounded-full ${isCorrect ? "bg-success/15 text-success" : "bg-danger/15 text-danger"}`}>
                        {isCorrect ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1 text-[12.5px] font-semibold leading-relaxed">{p.q}</span>
                      <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open/rev:rotate-180" />
                    </summary>
                    <div className="border-t border-dashed border-border px-3.5 py-3">
                      <ul className="space-y-1.5">
                        {p.options.map((o, oi) => {
                          const chosenHere = chosen === oi;
                          const correctHere = p.answer === oi;
                          return (
                            <li key={oi} className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-[12px] ${
                              correctHere ? "bg-success/10 font-bold text-success" : chosenHere ? "bg-danger/10 text-danger" : "text-muted-foreground"
                            }`}>
                              <span className="mt-0.5 shrink-0 font-bold">{correctHere ? <CheckCircle2 className="h-3.5 w-3.5" /> : chosenHere ? <XCircle className="h-3.5 w-3.5" /> : "•"}</span>
                              <span className="min-w-0">{o}{chosenHere && !correctHere ? " (انتخاب تو)" : ""}</span>
                            </li>
                          );
                        })}
                      </ul>
                      <p className="mt-2.5 rounded-lg bg-warn/[0.07] px-3 py-2 text-[11.5px] leading-relaxed text-foreground/90">
                        <span className="font-bold text-warn">تشریح: </span>{p.why}
                      </p>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>
      </div>
    );
  }

  /* ═══ صفحهٔ اجرای آزمون ═══ */
  const q = prepared[idx];
  const answeredCount = Object.keys(answers).length;
  const blankCount = prepared.length - answeredCount;
  const timeDanger = timerOn && remaining <= 60;
  const timeWarn = timerOn && remaining <= 120 && !timeDanger;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4 sm:px-6">
      {/* نوار بالا — زمان‌سنج و پیشرفت */}
      <div className="sticky top-2 z-10 mb-4 rounded-2xl border border-border bg-card/95 p-3.5 shadow-card backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className={`flex items-center gap-2 rounded-xl px-3 py-1.5 font-display text-base font-bold tabular-nums ${
            !timerOn ? "bg-muted text-muted-foreground" : timeDanger ? "animate-pulse bg-danger/10 text-danger" : timeWarn ? "bg-warn/10 text-warn" : "bg-primary/10 text-primary"
          }`}>
            <Timer className="h-4.5 w-4.5" />
            {timerOn ? fmtClock(remaining) : "بی‌زمان"}
          </div>
          <p className="text-[12px] font-bold text-muted-foreground">سؤال {fa(idx + 1)} از {fa(prepared.length)}</p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFlags((f) => (f.includes(idx) ? f.filter((x) => x !== idx) : [...f, idx]))}
              aria-pressed={flags.includes(idx)}
              title="نشانه‌گذاری برای مرور بعدی"
              className={`grid h-9 w-9 place-items-center rounded-xl border transition-colors ${flags.includes(idx) ? "border-warn bg-warn/10 text-warn" : "border-border bg-background text-muted-foreground hover:border-warn/50"}`}
            >
              <Flag className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1">
          {prepared.map((_, i) => {
            const isAns = answers[i] !== undefined;
            const isFlag = flags.includes(i);
            const isCur = i === idx;
            return (
              <button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`رفتن به سؤال ${fa(i + 1)}`}
                className={`h-6 w-6 rounded-md text-[9.5px] font-bold transition-colors ${
                  isCur ? "ring-2 ring-bronze ring-offset-1 ring-offset-card" : ""
                } ${isAns ? "bg-primary/80 text-white" : "bg-muted text-muted-foreground"} ${isFlag ? "!bg-warn/80 !text-white" : ""}`}
              >
                {fa(i + 1)}
              </button>
            );
          })}
        </div>
      </div>

      {/* سؤال */}
      <motion.div key={idx} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22 }} className="rounded-2xl border border-border bg-card p-5 shadow-card">
        {q.topic && <span className="mb-2.5 inline-block rounded-full bg-bronze/10 px-2.5 py-0.5 text-[10px] font-bold text-bronze">{q.topic}</span>}
        <p className="text-[15px] font-semibold leading-relaxed">{q.q}</p>
        <div className="mt-4 space-y-2.5">
          {q.options.map((o, oi) => {
            const on = answers[idx] === oi;
            return (
              <button
                key={oi}
                onClick={() => setAnswers((a) => ({ ...a, [idx]: oi }))}
                aria-pressed={on}
                className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-start text-[13.5px] leading-relaxed transition-all ${
                  on ? "border-bronze bg-bronze/[0.09] font-semibold shadow-card" : "border-border bg-background hover:border-bronze/40 hover:bg-accent/30"
                }`}
              >
                <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] font-bold ${on ? "border-bronze bg-bronze text-white" : "border-border text-muted-foreground"}`}>
                  {["الف", "ب", "ج", "د"][oi] ?? fa(oi + 1)}
                </span>
                <span className="min-w-0">{o}</span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* ناوبری */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          onClick={() => setIdx((v) => Math.max(0, v - 1))}
          disabled={idx === 0}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold transition-colors hover:border-bronze disabled:opacity-40"
        >
          <span aria-hidden>قبلی</span>
        </button>
        {idx + 1 < prepared.length ? (
          <button onClick={() => setIdx((v) => v + 1)} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-card transition-transform active:scale-[.98]">
            بعدی
          </button>
        ) : (
          <button onClick={() => (blankCount > 0 ? setEndConfirm(true) : finish())} className="inline-flex items-center gap-1.5 rounded-xl bg-bronze px-6 py-2.5 text-sm font-bold text-white shadow-card transition-transform active:scale-[.98]">
            پایان و تصحیح
          </button>
        )}
      </div>

      {/* پایان سریع */}
      {idx + 1 < prepared.length && (
        <button onClick={() => (blankCount > 0 ? setEndConfirm(true) : finish())} className="mt-3 w-full rounded-xl border border-dashed border-border bg-background px-4 py-2.5 text-xs font-bold text-muted-foreground transition-colors hover:border-bronze hover:text-bronze">
          پایان آزمون و مشاهدهٔ نتیجه
        </button>
      )}

      {/* تأیید پایان با سؤال بی‌پاسخ */}
      {endConfirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label="تأیید پایان آزمون">
          <motion.div initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 text-center shadow-card">
            <CircleHelp className="mx-auto h-9 w-9 text-warn" />
            <p className="mt-3 text-sm font-bold">{fa(blankCount)} سؤال بی‌پاسخ است</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">اگر پایان بدهی، سؤال‌های بی‌پاسخ نادرست حساب می‌شوند. برگردی می‌توانی همان‌جا ادامه بدهی.</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setEndConfirm(false)} className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">ادامهٔ آزمون</button>
              <button onClick={() => finish()} className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-bold hover:border-bronze">پایان می‌دهم</button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
        <ClipboardList className="h-3.5 w-3.5" /> {fa(answeredCount)} پاسخ‌داده · {fa(flags.length)} نشانه‌گذاری‌شده
        {blankCount > 0 && <> · {fa(blankCount)} بی‌پاسخ</>}
      </div>
    </div>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-primary" : "bg-border"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "start-[22px]" : "start-0.5"}`} />
    </span>
  );
}

/** حالت نبودن بسته (مسیر اشتباه) */
export function PackNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <EmptyState
        title="این دفترچه پیدا نشد"
        desc="شاید آدرس اشتباه است یا دفترچه جابه‌جا شده؛ از مرکز آزمون فهرست کامل را ببین."
        action={
          <button onClick={() => navigate({ view: "quiz" })} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
            مرکز آزمون
          </button>
        }
      />
    </div>
  );
}
