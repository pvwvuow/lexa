"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, XCircle, ChevronDown, Sparkles, RefreshCcw, Scale,
  Timer, Flag, GraduationCap, ClipboardList, ArrowLeft, ArrowRight, Shuffle,
  Library, Target, Filter, House,
} from "lucide-react";
import type { QuizQuestion } from "@/lib/law/types";
import { builtinCourses } from "@/lib/law/courses";
import type { Course, Lesson, Chapter } from "@/lib/law/types";
import { flattenAll } from "@/lib/law/types";
import { useApp, weakTopics } from "@/lib/store";
import { mergeAll } from "@/lib/books";
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

const WEAK_KEY = "hoh_weak_topics";

/** ادغام مبحث‌های ضعیف در مخزن localStorage — بدون ساخت رکورد پیشرفت جعلی */
function mergeWeakTopics(adds: string[]) {
  const set = new Set(weakTopics());
  adds.forEach((t) => t && set.add(t));
  set.delete("");
  try { localStorage.setItem(WEAK_KEY, JSON.stringify([...set])); } catch { /* ignore */ }
}

export function QuizView({ id }: { id?: string }) {
  const custom = useApp((s) => s.customCourses);
  const tBooks = useApp((s) => s.tBooks);
  const recordQuiz = useApp((s) => s.recordQuiz);
  const complete = useApp((s) => s.completeLesson);
  const touchStreak = useApp((s) => s.touchStreak);

  // منبع سؤالات — کل کتابخانه (داخلی + وارداتی)
  const all: Course[] = React.useMemo(() => mergeAll({ customCourses: custom, tBooks }), [custom, tBooks]);

  const ctx = React.useMemo(() => {
    if (!id) return null;
    for (const c of all) for (const ch of c.chapters) {
      const l = ch.lessons.find((x) => x.id === id);
      if (l && l.quiz.length > 0) return { course: c, chapter: ch, lesson: l as Lesson };
    }
    return null;
  }, [id, all]);

  /** حالت «مرکز آزمون»: انتخاب دامنه از کل کتابخانه */
  const [hubActive, setHubActive] = React.useState<boolean>(() => !id);

  // ── انتخاب دامنه در مرکز آزمون ──
  const flatAll = React.useMemo(() => flattenAll(all), [all]);
  const readyFlat = React.useMemo(() => flatAll.filter((f) => f.lesson.status !== "ai-pending" && f.lesson.quiz.length > 0), [flatAll]);

  const [scopeCourse, setScopeCourse] = React.useState<string>("ALL");
  const [picked, setPicked] = React.useState<Set<string>>(() => new Set());
  const [weakOnly, setWeakOnly] = React.useState(false);
  const [weakVer, setWeakVer] = React.useState(0); // با هر ثبت مبحث ضعیف، آمار تازه شود
  const initialized = React.useRef(false);

  // مقدار اولیهٔ دامنه: جلسهٔ فعلی اگر از تدریس آمده، وگرنه همهٔ کتاب‌ها
  React.useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (ctx) setPicked(new Set([ctx.lesson.id]));
    else setPicked(new Set(readyFlat.map((f) => f.lesson.id)));
  }, [ctx, readyFlat]);

  /** درس‌های قابل‌مشاهده در درخت انتخاب — بر اساس درسِ انتخابیِ جاری */
  const visibleLessons = React.useMemo(
    () => readyFlat.filter((f) => scopeCourse === "ALL" || f.course.id === scopeCourse),
    [readyFlat, scopeCourse],
  );

  // استخر سؤال
  const lessonBase: QuizQuestion[] = React.useMemo(() => (ctx ? [...ctx.lesson.quiz] : []), [ctx]);

  const hubStats = React.useMemo(() => {
    let questions = 0;
    let weakQuestions = 0;
    const courses = new Set<string>();
    const chapters = new Set<string>();
    const weakList = weakTopics();
    for (const f of readyFlat) {
      if (!picked.has(f.lesson.id)) continue;
      questions += f.lesson.quiz.length;
      for (const q of f.lesson.quiz) if (q.topic && weakList.includes(q.topic)) weakQuestions += 1;
      courses.add(f.course.id);
      chapters.add(f.chapter.id);
    }
    return { questions, weakQuestions, lessons: picked.size, courses: courses.size, chapters: chapters.size };
    // weakTopics() خواندن مستقیم localStorage است؛ با weakVer دستی تازه می‌شود
  }, [readyFlat, picked, weakVer]);

  const basePool: QuizQuestion[] = React.useMemo(() => {
    if (hubActive) {
      const qs: QuizQuestion[] = [];
      for (const f of readyFlat) {
        if (!picked.has(f.lesson.id)) continue;
        for (const q of f.lesson.quiz) qs.push(q);
      }
      return weakOnly ? qs.filter((q) => q.topic && weakTopics().includes(q.topic)) : qs;
    }
    return lessonBase;
  }, [hubActive, readyFlat, picked, weakOnly, lessonBase, weakVer]);

  /** استخر تولیدشدهٔ استاد — تا وقتی جایگزین نشده، مبنای آزمون است */
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
    setCount(pool.length ? Math.min(5, pool.length) : 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, hubActive, basePool.length]);

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

  // ── عملیات دامنه انتخاب ──
  const toggleLesson = (lessonId: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(lessonId)) n.delete(lessonId); else n.add(lessonId);
      return n;
    });

  const toggleChapter = (lessons: Lesson[]) =>
    setPicked((p) => {
      const ids = lessons.filter((l) => l.status !== "ai-pending" && l.quiz.length > 0).map((l) => l.id);
      const allIn = ids.every((i) => p.has(i));
      const n = new Set(p);
      ids.forEach((i) => (allIn ? n.delete(i) : n.add(i)));
      return n;
    });

  const applyCoursePreset = (cid: string) => {
    setScopeCourse(cid);
    setPicked(new Set(readyFlat.filter((f) => cid === "ALL" || f.course.id === cid).map((f) => f.lesson.id)));
  };

  const pickWeakScope = () => {
    // کل کتابخانه‌ای که سؤال ضعیف دارد؛ بدون توجه به فیلتر درس
    setScopeCourse("ALL");
    setWeakOnly(true);
    const list = weakTopics();
    const target = readyFlat.filter((f) => f.lesson.quiz.some((q) => q.topic && list.includes(q.topic))).map((f) => f.lesson.id);
    setPicked(new Set(target.length ? target : readyFlat.map((f) => f.lesson.id)));
  };

  function startQuiz(poolOverride?: QuizQuestion[]) {
    touchStreak();
    const src = poolOverride ?? pool;
    const shuf = shuffleOn ? shuffle(src) : [...src];
    const qs = poolOverride ? shuf : shuf.slice(0, Math.min(count, src.length));
    setQuestions(qs);
    setAnswers({}); setFlags([]); setIdx(0); setFurthest(0);
    setWrongTopics([]); setExplainOpen(true); setGenErr("");
    setStartedAt(Date.now()); setTick(0);
    setPhase("run");
  }

  async function generateMore() {
    setGenBusy(true); setGenErr("");
    try {
      let content = "";
      let label = "";
      const registry: string[] = [];

      if (!hubActive && ctx) {
        const ground = lessonToContextText(ctx.lesson.sections, 5000);
        content = ground.text;
        registry.push(...ground.lawRegistry);
        label = `${ctx.course.title} · ${ctx.lesson.title}`;
      } else {
        // چند جلسهٔ منتخب به ترتیب کتاب تا سقف ~۷۲۰۰ کاراکتر
        const chosen = readyFlat.filter((f) => picked.has(f.lesson.id));
        if (!chosen.length) throw new Error("جلسهٔ آماده‌ای در دامنه نیست؛ اول جلسه را تدریس کن.");
        for (const f of chosen) {
          if (content.length >= 7200) break;
          const g = lessonToContextText(f.lesson.sections, 2400);
          content += `\n\n### جلسه: ${f.lesson.title} (${f.course.title} / ${f.chapter.title})\n${g.text}`;
          for (const r of g.lawRegistry) if (!registry.includes(r)) registry.push(r);
        }
        if (registry.length > 40) registry.length = 40;
        label = `${hubStats.lessons} جلسه از ${fa(hubStats.courses)} کتاب`;
      }

      const res = await askAi<{ quiz: QuizQuestion[] }>({
        task: "gen_quiz",
        n: 5,
        content: content.trim(),
        context: { courseTitle: label, lawRegistry: registry },
      });
      const clean = (res.quiz ?? []).filter(
        (q) => q?.q && q.options?.length >= 3 && q.options.some((o) => o.key === q.answer) && q.explanation,
      );
      if (!clean.length) throw new Error("سؤال سالمی تولید نشد؛ دوباره تلاش کن.");
      setAiPool(clean);
      setCount(Math.min(5, clean.length));
      setPhase("setup");
    } catch (e) {
      setGenErr(e instanceof Error ? e.message : "تولید تست ناموفق بود.");
    } finally {
      setGenBusy(false);
    }
  }

  function scopeLine(): string {
    if (!hubActive && ctx) return `${ctx.course.title} · ${ctx.lesson.title}`;
    if (weakOnly) return `مباحث ضعیف تو — ${fa(hubStats.lessons)} جلسه`;
    return `${fa(hubStats.lessons)} جلسه · ${fa(hubStats.chapters)} فصل · ${fa(hubStats.courses)} کتاب`;
  }

  if (!pool.length && phase === "setup" && !genBusy)
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          title={hubActive ? "با این دامنه، سؤالی آماده نیست" : "اینجا تستی نیست"}
          desc={hubActive
            ? "دامنهٔ دیگری انتخاب کن یا جلسات بیشتری را تیک بزن؛ بعد از هر جلسه، سؤال‌هایش به همین مرکز اضافه می‌شود."
            : "هنوز برای این مبحث سؤالی آماده نشده است."}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {hubActive && (
                <button
                  onClick={() => { setScopeCourse("ALL"); setWeakOnly(false); setPicked(new Set(readyFlat.map((f) => f.lesson.id))); }}
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  انتخاب کل کتابخانه
                </button>
              )}
              <button onClick={() => navigate({ view: "home" })} className="rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-semibold hover:border-bronze">برگشت به خانه</button>
            </div>
          }
        />
      </div>
    );

  const q = questions[idx];

  function pick(k: Key) {
    if (!q) return;
    if (mode === "train" && answers[idx]) return; // حالت آموزشی: یک انتخاب
    setAnswers((a) => ({ ...a, [idx]: k }));
    if (mode === "train" && k !== q.answer) {
      const t = q.topic ?? (!hubActive && ctx ? ctx.lesson.title : "مبحث نامشخص");
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
      else wrongT.add(qq.topic ?? (!hubActive && ctx ? ctx.lesson.title : "مبحث نامشخص"));
    });
    wrongT.delete("");
    const score = Math.round((correct / Math.max(1, questions.length)) * 100);
    setFinalScore(score);
    finalAt.current = Date.now();
    setWrongTopics([...wrongT]);
    if (!hubActive && ctx) {
      recordQuiz(ctx.lesson.id, score, ctx.lesson.title, [...wrongT]);
      complete(ctx.lesson.id);
    } else {
      mergeWeakTopics([...wrongT]); // مرکز آزمون: مباحث ضعیف ثبت می‌شود، نه رکورد پیشرفت جعلی
    }
    setWeakVer((v) => v + 1); // آمار «مباحث ضعیف» بلافاصله در تنظیمات دیده شود
    setPhase("result");
  }

  /* ═══ صفحهٔ تنظیمات آزمون ═══ */
  if (phase === "setup") {
    const countOptions = [5, 10, 20, pool.length].filter((v, i, arr) => v > 0 && v <= pool.length && arr.indexOf(v) === i);
    return (
      <div className="mx-auto w-full max-w-2xl space-y-5 px-4 pb-24 pt-6 sm:px-6">
        <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-bronze">{hubActive ? "مرکز آزمون — کل کتابخانه" : "آزمون این جلسه"}{aiPool ? " · با سؤال‌های تازهٔ استاد" : ""}</p>
              <h1 className="mt-1.5 font-display text-xl font-bold">تنظیمات آزمون</h1>
            </div>
            {/* جابه‌جایی بین آزمون جلسه و مرکز آزمون */}
            {(ctx || hubActive) && (
              <button
                onClick={() => { setHubActive((v) => !v); setWeakOnly(false); }}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[11.5px] font-bold transition-colors ${
                  hubActive ? "border-border bg-background text-muted-foreground hover:border-bronze/50 hover:text-bronze" : "border-bronze bg-bronze/10 text-bronze hover:bg-bronze/15"
                }`}
              >
                {hubActive ? "فقط این جلسه" : "مرکز آزمون"}
              </button>
            )}
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{fa(pool.length)} سؤال در دامنهٔ «{scopeLine()}» آماده است.</p>
        </motion.header>

        {/* ── دامنهٔ سؤال ── */}
        {hubActive && (
          <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card">
            <p className="text-sm font-bold">۱) از کجا سؤال بدهم؟</p>

            {/* پیش‌تنظیم‌ها: کل کتابخانه یا یک کتاب */}
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              <button
                onClick={() => applyCoursePreset("ALL")}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold transition-colors ${
                  scopeCourse === "ALL" ? "border-bronze bg-bronze/15 text-bronze" : "border-border bg-background text-muted-foreground hover:border-bronze/50"
                }`}
              >
                <Library className="h-3.5 w-3.5" /> همهٔ کتاب‌ها
              </button>
              {all.map((c) => (
                <button
                  key={c.id}
                  onClick={() => applyCoursePreset(c.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold transition-colors ${
                    scopeCourse === c.id ? "border-bronze bg-bronze/15 text-bronze" : "border-border bg-background text-muted-foreground hover:border-bronze/50"
                  }`}
                >
                  {c.title}
                </button>
              ))}
            </div>

            {/* درخت فصل/جلسه */}
            <div className="max-h-[46vh] space-y-2 overflow-y-auto pe-1">
              {groupChapters(visibleLessons).map(({ course, groups }) => (
                <div key={course.id} className="rounded-xl border border-border bg-background">
                  {scopeCourse === "ALL" && (
                    <p className="border-b border-dashed border-border px-4 pt-3 pb-2 text-[12px] font-bold text-primary">{course.title}</p>
                  )}
                  <ul className="p-2">
                    {groups.map(({ chapter, lessons }) => {
                      const ids = lessons.map((l) => l.id);
                      const selN = ids.filter((i) => picked.has(i)).length;
                      const full = selN === ids.length && ids.length > 0;
                      const partial = selN > 0 && !full;
                      return (
                        <li key={chapter.id}>
                          <button
                            onClick={() => toggleChapter(lessons)}
                            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start transition-colors hover:bg-muted/50"
                          >
                            <Tick state={full ? "on" : partial ? "some" : "off"} />
                            <span className="flex-1 truncate text-[13px] font-semibold">فصل {chapter.order}: {chapter.title}</span>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-bold text-muted-foreground">{fa(selN)}/{fa(ids.length)}</span>
                          </button>
                          <ul className="mb-1 ms-7 space-y-0.5 border-s border-dashed border-border ps-3">
                            {lessons.map((l) => {
                              const on = picked.has(l.id);
                              return (
                                <li key={l.id}>
                                  <button
                                    onClick={() => toggleLesson(l.id)}
                                    aria-pressed={on}
                                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-start transition-colors ${on ? "bg-bronze/[0.07]" : "hover:bg-muted/40"}`}
                                  >
                                    <Tick state={on ? "on" : "off"} small />
                                    <span className={`flex-1 truncate text-[12.5px] ${on ? "font-medium text-foreground" : "text-muted-foreground"}`}>{l.title}</span>
                                    <span className="shrink-0 text-[10px] font-bold text-bronze/80">{fa(l.quiz.length)} سؤال</span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">خلاصهٔ دامنه: {fa(hubStats.lessons)} جلسه از {fa(hubStats.courses)} کتاب — {fa(basePool.length)} سؤال پایه</p>
          </section>
        )}

        {/* ── تمرین هوشمند ── */}
        <section className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={pickWeakScope}
            disabled={hubStats.weakQuestions === 0}
            className={`flex items-start gap-3 rounded-xl border p-4 text-start transition-all duration-200 ${
              weakOnly ? "border-bronze bg-bronze/[0.07] shadow-card" : "border-border bg-card hover:border-bronze/50 disabled:opacity-45"
            }`}
          >
            <Target className={`mt-0.5 h-4.5 w-4.5 shrink-0 ${weakOnly ? "text-bronze" : "text-muted-foreground"}`} />
            <span>
              <span className="block text-sm font-bold">تمرین مباحث ضعیف من{weakOnly && " · فعال"}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {hubStats.weakQuestions > 0 ? `${fa(hubStats.weakQuestions)} سؤال از مبحث‌هایی که جایشان را اشتباه زده‌ای` : "هنوز مبحث ضعیفی ثبت نشده؛ اول چند آزمون بده"}
              </span>
            </span>
          </button>
          <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
            <Filter className="mt-0.5 h-4.5 w-4.5 shrink-0 text-muted-foreground" />
            <label className="flex w-full cursor-pointer items-start" onClick={() => hubStats.weakQuestions > 0 && setWeakOnly((v) => !v)}>
              <span>
                <span className="block text-sm font-bold">فقط سؤال‌های مبحث ضعیف</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  {weakOnly ? "روشن — از دامنهٔ انتخابی فقط ضعیف‌ها می‌آیند" : hubStats.weakQuestions > 0 ? `${fa(hubStats.weakQuestions)} سؤال ضعیف داخل همین دامنه پیدا شد` : "در این دامنه سؤال ضعیفی نیست"}
                </span>
              </span>
              <span className={`relative mt-1 ms-auto h-6 w-11 shrink-0 rounded-full transition-colors ${weakOnly && hubStats.weakQuestions > 0 ? "bg-primary" : "bg-border"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${weakOnly && hubStats.weakQuestions > 0 ? "start-[22px]" : "start-0.5"}`} />
              </span>
            </label>
          </div>
        </section>

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
                {v === pool.length && pool.length !== 5 && pool.length !== 10 && pool.length !== 20 ? `همه (${fa(v)})` : fa(v)}
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
          disabled={pool.length === 0}
          className="w-full rounded-2xl bg-primary px-6 py-4 font-display text-base font-bold text-primary-foreground shadow-card transition-all duration-200 hover:-translate-y-px hover:brightness-110 active:scale-[.99] disabled:opacity-50"
        >
          شروع آزمون — {fa(Math.min(count, pool.length))} سؤال
        </button>

        {/* تولید سؤال تازه با هوش مصنوعی */}
        <div className="text-center">
          {genBusy ? <AIThinking label="استاد مشغول طراحی سؤال جدید است" /> : (
            <button onClick={generateMore} disabled={!ctx && hubStats.lessons === 0} className="inline-flex items-center gap-2 text-xs text-bronze underline-offset-4 hover:underline disabled:opacity-40">
              <Sparkles className="h-3.5 w-3.5" /> استاد چند سؤال جدید از دامنهٔ انتخابی بسازد
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
            {!hubActive && ctx ? (
              <button onClick={() => navigate({ view: "learn", id: ctx.lesson.id })} className="rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-semibold hover:border-bronze">
                بازگشت به تدریس
              </button>
            ) : (
              <button onClick={() => navigate({ view: "home" })} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-semibold hover:border-bronze">
                <House className="h-4 w-4" /> خانه
              </button>
            )}
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
                    {qq.topic && <p className="text-[11px] text-muted-foreground">مبحث: {qq.topic}</p>}
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
  const pickedKey = answers[idx];
  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-4 pb-24 pt-6 sm:px-6">
      <header className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 truncate text-xs font-medium text-bronze">{scopeLine()}{aiPool ? " · ساختهٔ استاد" : ""}</p>
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
                const isPicked = k === pickedKey;
                const reveal = mode === "train" && pickedKey;
                let cls = "border-border bg-background hover:-translate-y-px hover:border-bronze/60 hover:bg-bronze/5 hover:shadow-card";
                if (reveal) {
                  if (isRight) cls = "border-success bg-success/[0.08]";
                  else if (isPicked) cls = "border-danger bg-danger/[0.08]";
                  else cls = "border-border opacity-45";
                } else if (mode === "exam" && isPicked) {
                  cls = "border-primary bg-primary/[0.08] shadow-card";
                }
                return (
                  <button key={k} onClick={() => pick(k)} disabled={!!(mode === "train" && pickedKey)} aria-label={`گزینه ${FA_LETTER[k]}`} className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 text-start transition-all duration-200 ${cls}`}>
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
              {mode === "train" && pickedKey && (
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
                    <span className="text-sm font-bold">{pickedKey === q.answer ? "درست بود؛ آفرین!" : "جواب درست: گزینهٔ " + FA_LETTER[q.answer]}</span>
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

/* ── ابزارهای کمکی مرکز آزمون ───────────────────────────────────────────── */

/** گروه‌بندی درس‌های یک دامنه به شکل { دوره ← [فصل ← جلسات] } */
function groupChapters(items: { course: Course; chapter: Chapter; lesson: Lesson }[]) {
  const byCourse = new Map<Course, Map<Chapter, Lesson[]>>();
  for (const f of items) {
    if (!byCourse.has(f.course)) byCourse.set(f.course, new Map());
    const ch = byCourse.get(f.course)!;
    if (!ch.has(f.chapter)) ch.set(f.chapter, []);
    ch.get(f.chapter)!.push(f.lesson);
  }
  return [...byCourse.entries()].map(([course, chMap]) => ({
    course,
    groups: [...chMap.entries()].map(([chapter, lessons]) => ({ chapter, lessons })),
  }));
}

/** چک‌باکس سه‌حالته با لوزی طلایی */
function Tick({ state, small }: { state: "on" | "off" | "some"; small?: boolean }) {
  const size = small ? "h-4.5 w-4.5" : "h-5 w-5";
  if (state === "on")
    return (
      <span aria-hidden className={`${size} grid shrink-0 place-items-center rounded-md border border-bronze bg-bronze text-white`}>
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m4 12.5 5 5L20 6.5" /></svg>
      </span>
    );
  if (state === "some")
    return (
      <span aria-hidden className={`${size} grid shrink-0 place-items-center rounded-md border border-bronze bg-bronze/15 text-bronze`}>
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"><path d="M6 12h12" /></svg>
      </span>
    );
  return <span aria-hidden className={`${size} shrink-0 rounded-md border border-border bg-background`} />;
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

/** فاصلهٔ امن برای eslint — هیچ استفادهٔ مستقیمی ندارد */
export function _weakTopicReader() { return weakTopics(); }
