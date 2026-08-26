"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, XCircle, ChevronDown, Sparkles, RefreshCcw, Scale,
  Timer, Flag, GraduationCap, ClipboardList, ArrowLeft, ArrowRight, Shuffle,
} from "lucide-react";
import type { QuizQuestion } from "@/lib/law/types";
import { builtinCourses } from "@/lib/law/courses";
import type { Course, Lesson } from "@/lib/law/types";
import { useApp, weakTopics } from "@/lib/store";
import { fa } from "@/lib/fa";
import { navigate } from "@/lib/router";
import { askAi } from "@/lib/aiClient";
import { lessonToContextText } from "@/lib/law/lessonText";
import { AIThinking, Donut, ProgressBar, EmptyState } from "./common";

const KEYS = ["a", "b", "c", "d"] as const;
type Key = (typeof KEYS)[number];
const FA_LETTER: Record<string, string> = { a: "الف", b: "ب", c: "ج", d: "د" };

type Phase = "setup" | "run" | "result";
type Mode = "train" | "exam";

export function QuizView({ id }: { id?: string }) {
  const custom = useApp((s) => s.customCourses);
  const recordQuiz = useApp((s) => s.recordQuiz);
  const complete = useApp((s) => s.completeLesson);

  // منبع سؤالات
  const all = [...builtinCourses, ...custom];
  const ctx = React.useMemo(() => {
    if (id) {
      for (const c of all) for (const ch of c.chapters) {
        const l = ch.lessons.find((x) => x.id === id);
        if (l && l.quiz.length > 0) return { course: c, lesson: l as Lesson };
      }
    }
    return null;
  }, [id, custom]);

  const basePool: QuizQuestion[] = React.useMemo(
    () => (ctx ? ctx.lesson.quiz : all.flatMap((c) => c.chapters.flatMap((ch) => ch.lessons.flatMap((l) => l.quiz)))),
    [id, custom],
  );
  /** استخراج تولیدشدهٔ استاد — تا وقتی جایگزین نشده، مبنای آزمون است */
  const [aiPool, setAiPool] = React.useState<QuizQuestion[] | null>(null);
  const pool = aiPool ?? basePool;

  // ── وضعیت آزمون ──
  const [phase, setPhase] = React.useState<Phase>("setup");
  const [mode, setMode] = React.useState<Mode>("train");
  const [count, setCount] = React.useState(5);
  const [shuffleOn, setShuffleOn] = React.useState(true);

  const [questions, setQuestions] = React.useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = React.useState<Record<number, Key>>({});
  const [flags, setFlags] = React.useState<number[]>([]);
  const [idx, setIdx] = React.useState(0);
  const [furthest, setFurthest] = React.useState(0);
  const [explainOpen, setExplainOpen] = React.useState(true);
  const [wrongTopics, setWrongTopics] = React.useState<string[]>([]);
  const [startedAt, setStartedAt] = React.useState(0);
  const [tick, setTick] = React.useState(0);
  const [finalScore, setFinalScore] = React.useState(0);
  const finalAt = React.useRef(0);

  const [genBusy, setGenBusy] = React.useState(false);
  const [genErr, setGenErr] = React.useState("");

  React.useEffect(() => {
    setPhase("setup");
    setAiPool(null);
    setGenErr("");
    setCount(Math.min(5, basePool.length) || 5);
  }, [id, basePool.length]);

  // زمان‌سنج
  React.useEffect(() => {
    if (phase !== "run") return;
    const t = window.setInterval(() => setTick((v) => v + 1), 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  const elapsed = startedAt ? Math.max(0, Math.floor(((phase === "result" ? (finalAt.current || Date.now()) : Date.now()) - startedAt) / 1000)) : 0;
  const answeredCount = Object.keys(answers).length;

  function fmtTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${fa(m)}:${fa(String(s).padStart(2, "0"))}`;
  }

  function startQuiz(poolOverride?: QuizQuestion[]) {
    const src = poolOverride ?? pool;
    const picked = shuffleOn ? shuffle(src) : [...src];
    const qs = poolOverride ? picked : picked.slice(0, Math.min(count, src.length));
    setQuestions(qs);
    setAnswers({}); setFlags([]); setIdx(0); setFurthest(0);
    setWrongTopics([]); setExplainOpen(true); setGenErr("");
    setStartedAt(Date.now()); setTick(0);
    setPhase("run");
  }

  async function generateMore() {
    if (!ctx) return;
    setGenBusy(true); setGenErr("");
    try {
      // منبع غنی: متن کامل تدریس + مواد قانونی (نه فقط بولت‌ها)
      const ground = lessonToContextText(ctx.lesson.sections, 5000);
      const res = await askAi<{ quiz: QuizQuestion[] }>({
        task: "gen_quiz",
        n: 5,
        content: ground.text,
        context: {
          courseTitle: ctx.course.title,
          lessonTitle: ctx.lesson.title,
          lawRegistry: ground.lawRegistry,
        },
      });
      const clean = (res.quiz ?? []).filter(
        (q) => q?.q && q.options?.length >= 3 && q.options.some((o) => o.key === q.answer) && q.explanation,
      );
      if (!clean.length) throw new Error("سؤال سالمی تولید نشد؛ دوباره تلاش کن.");
      setAiPool(clean);
      setQuestions(clean);
      setAnswers({}); setFlags([]); setIdx(0); setFurthest(0);
      setStartedAt(0); setWrongTopics([]);
      setCount(Math.min(5, clean.length));
      setPhase("setup");
    } catch (e) {
      setGenErr(e instanceof Error ? e.message : "تولید تست ناموفق بود.");
    } finally {
      setGenBusy(false);
    }
  }

  if (!pool.length && phase === "setup" && !genBusy)
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          title="اینجا تستی نیست"
          desc="هنوز برای این مبحث سؤالی آماده نشده است."
          action={<button onClick={() => navigate({ view: "home" })} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">برگشت به خانه</button>}
        />
      </div>
    );

  const q = questions[idx];

  function pick(k: Key) {
    if (!q) return;
    if (mode === "train" && answers[idx]) return; // حالت آموزشی: یک انتخاب
    setAnswers((a) => ({ ...a, [idx]: k }));
    if (mode === "train" && k !== q.answer) {
      const t = q.topic ?? ctx?.lesson.title ?? "مبحث نامشخص";
      setWrongTopics((w) => (w.includes(t) ? w : [...w, t]));
    }
  }

  function toggleFlag(i: number) {
    setFlags((f) => (f.includes(i) ? f.filter((x) => x !== i) : [...f, i]));
  }

  function goto(i: number) {
    if (i < 0 || i > furthest) return;
    setIdx(i); setExplainOpen(true);
  }

  function next() {
    if (idx + 1 < questions.length) {
      const ni = idx + 1;
      setIdx(ni); setFurthest((f) => Math.max(f, ni)); setExplainOpen(true);
      return;
    }
    finish();
  }

  function finish() {
    let correct = 0;
    const wrongT = new Set<string>();
    questions.forEach((qq, i) => {
      if (answers[i] === qq.answer) correct++;
      else {
        if (answers[i]) wrongT.add(qq.topic ?? ctx?.lesson.title ?? "مبحث نامشخص");
        else wrongT.add(qq.topic ?? ctx?.lesson.title ?? "مبحث نامشخص");
      }
    });
    const score = Math.round((correct / Math.max(1, questions.length)) * 100);
    setFinalScore(score);
    finalAt.current = Date.now();
    setWrongTopics([...wrongT]);
    recordQuiz(ctx?.lesson.id ?? "mixed-quiz", score, ctx?.lesson.title, [...wrongT]);
    if (ctx) complete(ctx.lesson.id);
    setPhase("result");
  }

  /* ═══ صفحهٔ تنظیمات آزمون ═══ */
  if (phase === "setup") {
    const countOptions = [5, 10, pool.length].filter((v, i, arr) => v <= pool.length && arr.indexOf(v) === i);
    return (
      <div className="mx-auto w-full max-w-2xl space-y-5 px-4 pb-24 pt-6 sm:px-6">
        <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
          <p className="text-xs font-medium text-bronze">{ctx ? ctx.course.title : "آزمون جامع"}{ctx ? ` · ${ctx.lesson.title}` : ""}</p>
          <h1 className="mt-1.5 font-display text-xl font-bold">تنظیمات آزمون{aiPool && <span className="ms-2 inline-flex items-center gap-1 rounded-full bg-bronze/15 px-2.5 py-0.5 align-middle text-[11px] font-bold text-bronze"><Sparkles className="h-3 w-3" /> تازه از استاد رسید</span>}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{fa(pool.length)} سؤال از این مبحث آماده است؛ آزمون را همان‌طور که دوست داری برگزار کن.</p>
        </motion.header>

        {/* حالت برگزاری */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="mb-3 text-sm font-bold">حالت برگزاری</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              { k: "train", Icon: GraduationCap, t: "آموزشی", d: "پاسخ و تشریح فوری بعد از هر انتخاب؛ برای یادگیری" },
              { k: "exam", Icon: ClipboardList, t: "آزمونی", d: "بدون بازخورد تا پایان؛ نتیجه و پاسخ‌نامه در آخر" },
            ] as const).map(({ k, Icon, t, d }) => (
              <button
                key={k}
                onClick={() => setMode(k)}
                className={`rounded-xl border p-4 text-start transition-all duration-200 ${mode === k ? "border-bronze bg-bronze/[0.07] shadow-card" : "border-border bg-background hover:border-bronze/50"}`}
              >
                <span className="mb-1.5 flex items-center gap-2">
                  <Icon className={`h-4.5 w-4.5 ${mode === k ? "text-bronze" : "text-muted-foreground"}`} />
                  <span className="font-display text-sm font-bold">{t}</span>
                  {mode === k && <span className="ms-auto h-2.5 w-2.5 rounded-full bg-bronze" />}
                </span>
                <span className="block text-xs leading-relaxed text-muted-foreground">{d}</span>
              </button>
            ))}
          </div>
        </section>

        {/* تعداد سؤال + بُر زدن */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="mb-3 text-sm font-bold">تعداد سؤال</p>
          <div className="flex flex-wrap gap-2">
            {countOptions.map((v) => (
              <button
                key={v}
                onClick={() => setCount(v)}
                className={`rounded-full border px-5 py-2 font-display text-sm font-bold transition-colors ${count === v ? "border-bronze bg-bronze/15 text-bronze" : "border-border bg-background text-muted-foreground hover:border-bronze/50"}`}
              >
                {v === pool.length && pool.length !== 5 && pool.length !== 10 ? `همه (${fa(v)})` : fa(v)}
              </button>
            ))}
          </div>
          <button onClick={() => setShuffleOn((v) => !v)} className="mt-4 flex w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 transition-colors hover:border-bronze/50">
            <span className="flex items-center gap-2 text-sm font-medium"><Shuffle className="h-4 w-4 text-bronze" /> بُر زدن ترتیب سؤال‌ها</span>
            <span className={`relative h-6 w-11 rounded-full transition-colors ${shuffleOn ? "bg-primary" : "bg-border"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${shuffleOn ? "start-[22px]" : "start-0.5"}`} />
            </span>
          </button>
        </section>

        {/* شروع */}
        <button
          onClick={() => startQuiz()}
          className="w-full rounded-2xl bg-primary px-6 py-4 font-display text-base font-bold text-primary-foreground shadow-card transition-all duration-200 hover:-translate-y-px hover:brightness-110 active:scale-[.99]"
        >
          شروع آزمون — {fa(Math.min(count, pool.length))} سؤال
        </button>

        {/* تولید سؤال تازه با هوش مصنوعی */}
        <div className="text-center">
          {genBusy ? <AIThinking label="استاد مشغول طراحی سؤال جدید است" /> : (
            <button onClick={generateMore} disabled={!ctx} className="inline-flex items-center gap-2 text-xs text-bronze underline-offset-4 hover:underline disabled:opacity-40">
              <Sparkles className="h-3.5 w-3.5" /> استاد چند سؤال جدید از این جلسه بسازد
            </button>
          )}
          {genErr && <p className="mt-2 text-xs text-destructive">{genErr}</p>}
        </div>
      </div>
    );
  }

  /* ═══ صفحهٔ نتیجه ═══ */
  if (phase === "result") {
    const wrongIdx = questions.map((qq, i) => ({ qq, i })).filter(({ qq, i }) => answers[i] !== qq.answer);
    const correctCount = questions.length - wrongIdx.length;
    return (
      <div className="mx-auto w-full max-w-2xl space-y-5 px-4 pb-24 pt-6 sm:px-6">
        <motion.section initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 text-center shadow-card">
          <div aria-hidden className="pattern-quilt absolute inset-x-0 top-0 h-24 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
          <div className="relative mx-auto w-fit"><Donut value={finalScore} size={128} stroke={11} label="امتیاز آزمون" /></div>
          <h1 className="mt-4 text-xl font-bold">
            {wrongIdx.length === 0 ? "عالی! همه پاسخ‌ها درست بود" : `${fa(wrongIdx.length)} سؤال نیاز به مرور دارد`}
          </h1>

          {/* آمار آزمون */}
          <div className="mx-auto mt-5 grid max-w-md grid-cols-3 gap-2.5">
            {[
              { t: "صحیح", v: fa(correctCount), cls: "text-success border-success/30 bg-success/[0.06]" },
              { t: "نادرست", v: fa(wrongIdx.filter((w) => answers[w.i]).length), cls: "text-danger border-danger/30 bg-danger/[0.06]" },
              { t: "زمان", v: fmtTime(elapsed), cls: "text-primary border-primary/25 bg-primary/[0.06]" },
            ].map((s) => (
              <div key={s.t} className={`rounded-xl border px-2 py-3 ${s.cls}`}>
                <p className="font-display text-lg font-bold">{s.v}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{s.t}</p>
              </div>
            ))}
          </div>

          {wrongTopics.length > 0 && (
            <ul className="mx-auto mt-5 max-w-sm space-y-2 text-start">
              {wrongTopics.map((t) => (
                <li key={t} className="flex items-center justify-between rounded-xl border border-warn/40 bg-warn/[0.07] px-4 py-2.5 text-sm">
                  <span className="font-body">{t}</span>
                  <button onClick={() => navigate({ view: "cards" })} className="font-display font-semibold text-bronze hover:underline">مرور کن</button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {wrongIdx.length > 0 && (
              <button
                onClick={() => startQuiz(wrongIdx.map((w) => w.qq))}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition-transform active:scale-[.98]"
              >
                <RefreshCcw className="h-4 w-4" /> تمرین سؤال‌های غلط
              </button>
            )}
            <button onClick={() => setPhase("setup")} className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-semibold hover:border-bronze">
              آزمون مجدد
            </button>
            <button onClick={() => navigate(ctx ? { view: "learn", id: ctx.lesson.id } : { view: "home" })} className="rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-semibold hover:border-bronze">
              {ctx ? "بازگشت به تدریس" : "خانه"}
            </button>
          </div>
        </motion.section>

        {/* پاسخ‌نامهٔ تشریحی */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
          <p className="mb-4 flex items-center gap-2 border-b border-dashed border-border pb-2.5 text-sm font-bold"><Scale className="h-4 w-4 text-bronze" /> پاسخ‌نامهٔ تشریحی</p>
          <div className="space-y-3">
            {questions.map((qq, i) => {
              const mine = answers[i];
              const ok = mine === qq.answer;
              return (
                <details key={i} className={`group rounded-xl border px-4 py-3 ${ok ? "border-border" : "border-warn/40 bg-warn/[0.04]"}`} open={!ok}>
                  <summary className="flex cursor-pointer list-none items-start gap-2.5 text-sm leading-relaxed">
                    <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md font-display text-[11px] font-bold ${ok ? "bg-success/15 text-success" : mine ? "bg-danger/15 text-danger" : "bg-muted text-muted-foreground"}`}>
                      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : mine ? <XCircle className="h-3.5 w-3.5" /> : fa(i + 1)}
                    </span>
                    <span className="font-body flex-1">{qq.q}</span>
                    <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:-rotate-180" />
                  </summary>
                  <div className="mt-3 space-y-2 border-t border-dashed border-border pt-3 text-[13.5px] leading-relaxed">
                    <p><span className="font-display font-bold text-success">پاسخ صحیح:</span> <span className="font-body">{FA_LETTER[qq.answer]}) {qq.options.find((o) => o.key === qq.answer)?.text}</span></p>
                    {mine && !ok && <p><span className="font-display font-bold text-danger">پاسخ شما:</span> <span className="font-body">{FA_LETTER[mine]}) {qq.options.find((o) => o.key === mine)?.text}</span></p>}
                    {!mine && <p className="text-warn">بدون پاسخ</p>}
                    <p className="rounded-lg bg-muted/50 px-3 py-2.5 font-body text-muted-foreground">{qq.explanation}</p>
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  /* ═══ صفحهٔ اجرای آزمون ═══ */
  const picked = answers[idx];
  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-4 pb-24 pt-6 sm:px-6">
      <header className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-bronze">{ctx ? ctx.course.title : "آزمون جامع"}{ctx ? ` · ${ctx.lesson.title}` : ""}</p>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground" dir="ltr"><Timer className="h-3 w-3" /> {fmtTime(elapsed)}</span>
            <span className="rounded-full bg-primary/10 px-3 py-0.5 text-xs font-bold text-primary">سؤال {fa(idx + 1)} از {fa(questions.length)}</span>
          </div>
        </div>
        <ProgressBar value={(answeredCount / questions.length) * 100} className="mt-3" />

        {/* ناوبر سؤال‌ها */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {questions.map((_, i) => {
            const answered = !!answers[i];
            const isCurrent = i === idx;
            const flagged = flags.includes(i);
            return (
              <button
                key={i}
                onClick={() => goto(i)}
                disabled={i > furthest}
                aria-label={`رفتن به سؤال ${fa(i + 1)}`}
                className={`relative grid h-8 w-8 place-items-center rounded-lg border font-display text-[11.5px] font-bold transition-all ${
                  isCurrent ? "border-bronze bg-bronze/15 text-bronze shadow-card"
                  : answered ? "border-primary/30 bg-primary/10 text-primary"
                  : i <= furthest ? "border-border bg-background text-muted-foreground hover:border-bronze/50"
                  : "border-border/60 bg-muted/40 text-muted-foreground/40"
                }`}
              >
                {fa(i + 1)}
                {flagged && <span className="absolute -end-0.5 -top-0.5 h-2 w-2 rounded-full bg-bronze" />}
              </button>
            );
          })}
        </div>
        {mode === "exam" && <p className="mt-2.5 text-[11px] text-muted-foreground">حالت آزمونی — پاسخ‌ها تا پایان نمایش داده نمی‌شوند؛ با ناوبر بالا می‌توانی برگردی و جواب را عوض کنی.</p>}
      </header>

      <AnimatePresence mode="wait">
        {q && (
          <motion.section key={idx} initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 18 }} transition={{ duration: 0.22 }} className="scroll-mt-24 rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <h1 className="font-body flex-1 text-[17px] font-semibold leading-[2]">{q.q}</h1>
              <button
                onClick={() => toggleFlag(idx)}
                title={flags.includes(idx) ? "برداشتن پرچم" : "علامت‌گذاری برای مرور"}
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition-colors ${flags.includes(idx) ? "border-bronze bg-bronze/15 text-bronze" : "border-border bg-background text-muted-foreground hover:border-bronze/50 hover:text-bronze"}`}
              >
                <Flag className={`h-4 w-4 ${flags.includes(idx) ? "fill-bronze/30" : ""}`} />
              </button>
            </div>
            <div className="mt-5 grid gap-3">
              {KEYS.map((k) => {
                const opt = q.options.find((o) => o.key === k);
                if (!opt) return null;
                const isRight = k === q.answer;
                const isPicked = k === picked;
                const reveal = mode === "train" && picked;
                let cls = "border-border bg-background hover:-translate-y-px hover:border-bronze/60 hover:bg-bronze/5 hover:shadow-card";
                if (reveal) {
                  if (isRight) cls = "border-success bg-success/[0.08]";
                  else if (isPicked) cls = "border-danger bg-danger/[0.08]";
                  else cls = "border-border opacity-45";
                } else if (mode === "exam" && isPicked) {
                  cls = "border-primary bg-primary/[0.08] shadow-card";
                }
                return (
                  <button key={k} onClick={() => pick(k)} disabled={!!(mode === "train" && picked)} aria-label={`گزینه ${FA_LETTER[k]}`} className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 text-start transition-all duration-200 ${cls}`}>
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg font-display text-xs font-bold ${
                      reveal && isRight ? "bg-success text-white" : reveal && isPicked ? "bg-danger text-white" : isPicked ? "border border-primary/50 bg-primary/15 text-primary" : "border border-bronze/30 bg-bronze/10 text-bronze"
                    }`}>
                      {reveal && isRight ? <CheckCircle2 className="h-[18px] w-[18px]" /> : reveal && isPicked ? <XCircle className="h-[18px] w-[18px]" /> : FA_LETTER[k]}
                    </span>
                    <span className={`flex-1 pt-1 font-body leading-relaxed ${reveal && (isRight || isPicked) ? (isRight ? "text-success" : isPicked ? "text-danger" : "") : ""}`}>{opt.text}</span>
                  </button>
                );
              })}
            </div>

            {/* بازخورد فوری — فقط حالت آموزشی */}
            <AnimatePresence>
              {mode === "train" && picked && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                  <button onClick={() => setExplainOpen(!explainOpen)} className="mt-5 flex w-full items-center justify-between rounded-t-xl border-s-4 border-bronze bg-accent px-4 py-3 text-sm font-display font-semibold">
                    <span className="flex items-center gap-2"><Scale className="h-4 w-4 text-bronze" /> تشریح پاسخ</span>
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${explainOpen ? "" : "-rotate-180"}`} />
                  </button>
                  {explainOpen && (
                    <p className="font-body rounded-b-xl rounded-se-none border-x border-b border-accent bg-background px-4 py-3.5 text-sm leading-loose text-muted-foreground">
                      {q.explanation}
                    </p>
                  )}
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-sm font-bold">{picked === q.answer ? "درست بود؛ آفرین!" : "جواب درست: گزینهٔ " + FA_LETTER[q.answer]}</span>
                    <NextBtn label={idx + 1 < questions.length ? "سؤال بعدی" : "دیدن نتیجه"} onClick={next} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ناوبری حالت آزمونی */}
            {mode === "exam" && (
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-dashed border-border pt-4">
                <button
                  onClick={() => goto(idx - 1)}
                  disabled={idx === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:border-bronze/60 disabled:opacity-40"
                >
                  <ArrowRight className="h-4 w-4" /> قبلی
                </button>
                {answeredCount < questions.length && idx === questions.length - 1 ? (
                  <span className="text-xs text-muted-foreground">{fa(questions.length - answeredCount)} سؤال بدون پاسخ مانده</span>
                ) : null}
                {idx + 1 < questions.length ? (
                  <NextBtn label="سؤال بعدی" onClick={next} />
                ) : (
                  <button
                    onClick={finish}
                    className="inline-flex items-center gap-2 rounded-xl bg-success px-6 py-2.5 text-sm font-semibold text-white shadow-card transition-transform active:scale-[.98]"
                  >
                    <CheckCircle2 className="h-4 w-4" /> پایان و دیدن نتیجه
                  </button>
                )}
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

function NextBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition-all hover:-translate-y-px active:scale-[.98]">
      {label} <ArrowLeft className="h-4 w-4" />
    </button>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function _weakTopicReader() { return weakTopics(); }
