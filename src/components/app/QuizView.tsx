"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, ChevronDown, Sparkles, RefreshCcw, Scale } from "lucide-react";
import type { QuizQuestion } from "@/lib/law/types";
import { builtinCourses } from "@/lib/law/courses";
import type { Course, Lesson } from "@/lib/law/types";
import { useApp, weakTopics } from "@/lib/store";
import { fa } from "@/lib/fa";
import { navigate } from "@/lib/router";
import { askAi } from "@/lib/aiClient";
import { AIThinking, Donut, ProgressBar, EmptyState } from "./common";

const KEYS = ["a", "b", "c", "d"] as const;
const FA_LETTER: Record<string, string> = { a: "الف", b: "ب", c: "ج", d: "د" };

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

  const [questions, setQuestions] = React.useState<QuizQuestion[]>([]);
  const [idx, setIdx] = React.useState(0);
  const [picked, setPicked] = React.useState<null | "a" | "b" | "c" | "d">(null);
  const [wrongTopics, setWrongTopics] = React.useState<string[]>([]);
  const [finished, setFinished] = React.useState(false);
  const [explainOpen, setExplainOpen] = React.useState(true);
  const [genBusy, setGenBusy] = React.useState(false);
  const [genErr, setGenErr] = React.useState("");

  const basePool: QuizQuestion[] = ctx ? ctx.lesson.quiz : all.flatMap((c) => c.chapters.flatMap((ch) => ch.lessons.flatMap((l) => l.quiz)));

  React.useEffect(() => {
    setQuestions(shuffle(basePool).slice(0, Math.min(10, basePool.length)));
    reset();
  }, [id]);

  function reset() {
    setIdx(0); setPicked(null); setWrongTopics([]); setFinished(false); setGenErr("");
  }

  async function generateMore() {
    if (!ctx) return;
    setGenBusy(true); setGenErr("");
    try {
      const summary = `${ctx.lesson.title} — ${all.find((c) => c === ctx.course)?.title ?? ""}`;
      const res = await askAi<{ quiz: QuizQuestion[] }>({
        task: "gen_quiz",
        n: 5,
        content: `${summary}\n\nنکات کلیدی جلسه:\n${(ctx.lesson.sections.map((s) => s.bullets ?? []).flat().join("\n")).slice(0, 3000)}\n\nمتن مواد:\n${(ctx.lesson.sections.flatMap((s) => s.law?.map((l) => `ماده ${l.no}: ${l.text}`) ?? []).join("\n"))}`,
        context: { courseTitle: summary, lessonTitle: ctx.lesson.title },
      });
      setQuestions(res.quiz.filter((q) => q.q && q.options?.length >= 3));
      reset();
    } catch (e) {
      setGenErr(e instanceof Error ? e.message : "تولید تست ناموفق بود.");
    } finally {
      setGenBusy(false);
    }
  }

  if (!basePool.length || questions.length === 0)
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

  function pick(k: "a" | "b" | "c" | "d") {
    if (picked) return;
    setPicked(k);
    if (k !== q.answer) {
      const t = q.topic ?? ctx?.lesson.title ?? "مبحث نامشخص";
      setWrongTopics((w) => (w.includes(t) ? w : [...w, t]));
    }
  }

  function next() {
    if (idx + 1 < questions.length) {
      setIdx(idx + 1); setPicked(null); setExplainOpen(true);
      return;
    }
    const score = Math.round(((questions.length - wrongTopics.length) / questions.length) * 100);
    const bestScore = Math.max(0, 100 - wrongTopics.length * Math.ceil(100 / questions.length));
    recordQuiz(ctx?.lesson.id ?? "mixed-quiz", bestScore, q.topic, wrongTopics);
    if (ctx) complete(ctx.lesson.id);
    setFinished(true);
    void score;
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-24 pt-6 sm:px-6">
      {!finished && (
        <>
          <header className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-bronze">{ctx ? ctx.course.title : "آزمون جامع"}{ctx ? ` · ${ctx.lesson.title}` : ""}</p>
              <span className="rounded-full bg-primary/10 px-3 py-0.5 text-xs font-bold text-primary">سؤال {fa(idx + 1)} از {fa(questions.length)}</span>
            </div>
            <ProgressBar value={((idx + (picked ? 1 : 0)) / questions.length) * 100} className="mt-3" />
          </header>

          <AnimatePresence mode="wait">
            <motion.section key={idx + "-" + picked} initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 18 }} transition={{ duration: 0.22 }} className="scroll-mt-24 rounded-2xl border border-border bg-card p-6 shadow-card">
              <h1 className="font-body text-[17px] font-semibold leading-[2]">{q.q}</h1>
              <div className="mt-5 grid gap-3">
                {KEYS.map((k) => {
                  const opt = q.options.find((o) => o.key === k);
                  if (!opt) return null;
                  const isRight = k === q.answer;
                  const isPicked = k === picked;
                  let cls = "border-border bg-background hover:-translate-y-px hover:border-bronze/60 hover:bg-bronze/5 hover:shadow-card";
                  if (picked) {
                    if (isRight) cls = "border-success bg-success/[0.08]";
                    else if (isPicked) cls = "border-danger bg-danger/[0.08]";
                    else cls = "border-border opacity-45";
                  }
                  return (
                    <button key={k} onClick={() => pick(k)} disabled={!!picked} aria-label={`گزینه ${FA_LETTER[k]}`} className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 text-start transition-all duration-200 ${cls}`}>
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg font-display text-xs font-bold ${
                        isRight && picked ? "bg-success text-white" : isPicked && picked ? "bg-danger text-white" : "border border-bronze/30 bg-bronze/10 text-bronze"
                      }`}>
                        {picked && isRight ? <CheckCircle2 className="h-[18px] w-[18px]" /> : picked && isPicked ? <XCircle className="h-[18px] w-[18px]" /> : FA_LETTER[k]}
                      </span>
                      <span className={`flex-1 pt-1 font-body leading-relaxed ${picked && (isRight || isPicked) ? (isRight ? "text-success" : isPicked ? "text-danger" : "") : ""}`}>{opt.text}</span>
                    </button>
                  );
                })}
              </div>

              {/* بازخورد فوری در آکاردئون */}
              <AnimatePresence>
                {picked && (
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
                      <button onClick={next} className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition-all hover:-translate-y-px active:scale-[.98]">
                        {idx + 1 < questions.length ? "سؤال بعدی" : "دیدن نتیجه"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>
          </AnimatePresence>

          {/* تولید سؤال تازه با هوش مصنوعی */}
          <div className="text-center">
            {genBusy ? <AIThinking label="استاد مشغول طراحی سؤال جدید" /> : (
              <button onClick={generateMore} disabled={!ctx} className="inline-flex items-center gap-2 text-xs text-bronze underline-offset-4 hover:underline disabled:opacity-40">
                <Sparkles className="h-3.5 w-3.5" /> استاد چند سؤال جدید از این جلسه بسازد
              </button>
            )}
            {genErr && <p className="mt-2 text-xs text-destructive">{genErr}</p>}
          </div>
        </>
      )}

      {finished && (
        <motion.section initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 text-center shadow-card">
          <div aria-hidden className="pattern-quilt absolute inset-x-0 top-0 h-24 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
          <div className="relative mx-auto w-fit"><Donut value={Math.max(20, 100 - wrongTopics.length * 25)} size={128} stroke={11} label="امتیاز آزمون" /></div>
          <h1 className="mt-4 text-xl font-bold">
            {wrongTopics.length === 0 ? "عالی! همه پاسخ‌ها درست بود" : `${fa(wrongTopics.length)} سؤال نیاز به مرور دارد`}
          </h1>
          {wrongTopics.length > 0 && (
            <ul className="mx-auto mt-4 max-w-sm space-y-2 text-start">
              {wrongTopics.map((t) => (
            <li key={t} className="flex items-center justify-between rounded-xl border border-warn/40 bg-warn/[0.07] px-4 py-2.5 text-sm">
                  <span className="font-body">{t}</span>
                  <button onClick={() => navigate({ view: "cards" })} className="font-display font-semibold text-bronze hover:underline">مرور کن</button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button onClick={reset} className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-semibold hover:border-bronze">
              <RefreshCcw className="h-4 w-4" /> آزمون مجدد
            </button>
            <button onClick={() => navigate(ctx ? { view: "learn", id: ctx.lesson.id } : { view: "home" })} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
              {ctx ? "بازگشت به تدریس" : "خانه"}
            </button>
          </div>
        </motion.section>
      )}
    </div>
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
