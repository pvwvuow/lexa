"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  ArrowDownCircle, HelpCircle, Lightbulb, ClipboardList, StickyNote,
  ListOrdered, ListChecks, Scale, Plus, Trash2, Send, RotateCcw, BookMarked, Sparkles, ArrowLeft, MessageSquareWarning,
  MoreHorizontal, CheckCircle2, AlertCircle, Loader2,
} from "lucide-react";
import type { Course, LessonSection } from "@/lib/law/types";
import { builtinCourses } from "@/lib/law/courses";
import { useApp } from "@/lib/store";
import { mergeAll } from "@/lib/books";
import { fa } from "@/lib/fa";
import { navigate } from "@/lib/router";
import { askAi } from "@/lib/aiClient";
import { AIThinking, SECTION_META, SectionHead, SectionBody, LawBox } from "./common";
import { lessonToContextText } from "@/lib/law/lessonText";
import { ensureLessonContent, isLazyLesson, useLessonContent } from "@/lib/law/texts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FeedbackDialog } from "./FeedbackDialog";

interface AiNote { sectionId: string; text: string }
const EMPTY_NOTES: { id: string; text: string; quote?: string; createdAt: number }[] = [];

export function LearnView({ id }: { id: string }) {
  const custom = useApp((s) => s.customCourses);
  const tBooks = useApp((s) => s.tBooks);
  const upsertCourse = useApp((s) => s.upsertCourse);
  const openLesson = useApp((s) => s.openLesson);
  const seen = useApp((s) => s.setSectionSeen);
  const complete = useApp((s) => s.completeLesson);
  const prog = useApp((s) => s.progress[id]);
  const notesAll = useApp((s) => s.notes);
  const notes = notesAll[id] ?? EMPTY_NOTES;
  const addNote = useApp((s) => s.addNote);
  const removeNote = useApp((s) => s.removeNote);

  // ── یافتن جلسه و دوره ──
  let ctx: { lesson: any; chapter: any; course: Course; index: number; total: number } | null = null;
  for (const c of mergeAll({ customCourses: custom, tBooks })) {
    for (let ci = 0; ci < c.chapters.length; ci++) {
      const li = c.chapters[ci].lessons.findIndex((l) => l.id === id);
      if (li >= 0) ctx = { lesson: c.chapters[ci].lessons[li], chapter: c.chapters[ci], course: c, index: li, total: 0 };
    }
  }

  const [aiPendingBusy, setAiPendingBusy] = React.useState(false);
  const [aiErr, setAiErr] = React.useState("");
  const [aiNotes, setAiNotes] = React.useState<AiNote[]>([]);
  const [loadingFor, setLoadingFor] = React.useState<string | null>(null); // نوع دکمه فعال
  const [questionInput, setQuestionInput] = React.useState("");
  const [showTocMobile, setShowTocMobile] = React.useState(false);
  const [askOpen, setAskOpen] = React.useState(false); // فرم شناور پرسش در موبایل
  // چرخهٔ دکمهٔ «از استاد بپرس»: برچسب یک‌بار کامل دیده می‌شود، بعد زیر دکمه جمع و
  // خود دکمه کم‌رنگ می‌شود تا حواس کاربر هنگام خواندن پرت نشود (هاور = برمی‌گردد)
  const [fabDim, setFabDim] = React.useState(false);
  React.useEffect(() => {
    if (askOpen) return;
    setFabDim(false);
    const t = setTimeout(() => setFabDim(true), 3400);
    return () => clearTimeout(t);
  }, [askOpen, id]);
  const [tab, setTab] = React.useState<"teach" | "toc" | "laws">("teach");
  const [feedbackOpen, setFeedbackOpen] = React.useState(false);

  React.useEffect(() => {
    if (ctx?.lesson && ctx.lesson.status !== "ai-pending") openLesson(id);
     
  }, [id]);

  // ── گیت لود تنبل محتوا: متن جلسه‌های داخلی به‌محض باز شدن از شبکه می‌آید ──
  const textState = useLessonContent(ctx?.lesson);

  if (!ctx) return <p className="p-10 text-center text-muted-foreground">جلسه پیدا نشد.</p>;

  const { lesson, chapter, course } = ctx;
  const sections: LessonSection[] = lesson.sections ?? [];
  const laws = sections.flatMap((s) => s.law ?? []);

  // فصل بعدیِ همین درس (برای دکمهٔ پایان جلسه)
  const chaptersOrdered = [...course.chapters].sort((a, b) => a.order - b.order);
  const chiIdx = chaptersOrdered.findIndex((ch) => ch.id === chapter.id);
  const nextChapter = chiIdx >= 0 ? chaptersOrdered[chiIdx + 1] ?? null : null;

  /** تولید جلسه برای جلسات وارداتی (ai-pending) */
  async function generateAiLesson() {
    setAiPendingBusy(true);
    setAiErr("");
    try {
      const res = await askAi<{ lesson: { title: string; sections: LessonSection[]; quiz?: never[] } }>({
        task: "generate_lesson",
        question: lesson.title,
        content: lesson.sourceSlice ?? "",
        context: { courseTitle: course.title, chapterTitle: chapter.title },
      });
      const generated = res.lesson;
      generated.title = lesson.title;
      const updatedCourse: Course = {
        ...course,
        chapters: course.chapters.map((ch) => ({
          ...ch,
          lessons: ch.lessons.map((l) =>
            l.id === id
              ? { ...l, status: "ready", sections: generated.sections, quiz: normalizeQuiz(generated.quiz) }
              : l,
          ),
        })),
      };
      upsertCourse(updatedCourse);
    } catch (e) {
      setAiErr(e instanceof Error ? e.message : "تولید جلسه ناموفق بود.");
    } finally {
      setAiPendingBusy(false);
    }
  }

  function normalizeQuiz(q: unknown[] | undefined): never[] {
    if (!Array.isArray(q)) return [] as never[];
    return q.filter((x) => x && typeof x === "object") as never[];
  }

  const visibleCount = Math.min(prog?.sectionsSeen ?? 1, sections.length);
  const atEnd = visibleCount >= sections.length;

  async function handleAction(kind: "simple" | "examples" | "ask" | "free", textOverride?: string) {
    const lastVisible = sections[Math.max(0, visibleCount - 1)];
    setLoadingFor(kind + (textOverride ?? ""));
    setAiErr("");
    // متن واقعی همان بخش‌هایی که دانشجو دیده + فهرست مواد معتبر — منبع پاسخ استاد
    const ground = lessonToContextText(sections.slice(0, visibleCount));
    try {
      const res = await askAi<{ text: string }>({
        task: "free",
        mode: kind === "simple" ? "QA" : kind === "examples" ? "TEACH" : "QA",
        modeDirective:
          kind === "simple"
            ? "دانشجو گفت متوجه نشد؛ مفهوم را با یک تشبیه ساده و مثال روزمره دوباره توضیح بده، نه با تکرار متن."
            : kind === "examples"
              ? "دانشجو مثال بیشتر می‌خواهد؛ دو مثال تازه با اعداد فرضی ارائه کن و ماده مرتبط را یادآوری کن."
              : undefined,
        question: kind === "free" || kind === "ask" ? textOverride : `درباره «${lesson.title}» توضیح بیشتر`,
        context: {
          courseTitle: course.title,
          chapterTitle: chapter.title,
          lessonTitle: lesson.title,
          seenSections: sections.slice(0, visibleCount).map((s) => s.title ?? ""),
          extra: ground.text,
          lawRegistry: ground.lawRegistry,
        },
      });
      setAiNotes((n) => [{ sectionId: lastVisible.id, text: res.text }, ...n]);
    } catch (e) {
      setAiErr(e instanceof Error ? e.message : "پاسخی دریافت نشد.");
    } finally {
      setLoadingFor(null);
    }
  }

  function revealNext() {
    seen(id, visibleCount + 1);
    setTimeout(() => {
      document.getElementById(`sec-${visibleCount}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }

  const Sidebar = (
    <aside className="hidden lg:block">
      <div className="sticky top-24 space-y-4">
        <nav className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="mb-3 flex items-center gap-2 border-b border-dashed border-border pb-2.5 text-sm font-bold"><ListOrdered className="h-4 w-4 text-bronze" /> فهرست مطالب جلسه</p>
          <ol className="space-y-0.5 text-[13px]">
            {sections.map((s, i) => (
              <li key={s.id}>
                {i < visibleCount ? (
                  <button onClick={() => document.getElementById(`sec-${i}`)?.scrollIntoView({ behavior: "smooth" })} className={`w-full rounded-lg px-2.5 py-1.5 text-start transition-colors ${i === visibleCount - 1 ? "bg-bronze/10 font-semibold text-bronze" : "text-muted-foreground hover:bg-muted hover:text-primary"}`}>
                    <span className="me-1.5 inline-block w-5 text-left text-[11px] opacity-60" dir="ltr">{fa(i + 1)}</span>
                    {SECTION_META[s.type].title}
                  </button>
                ) : (
                  <span className="block px-2.5 py-1.5 text-muted-foreground/35">{fa(i + 1)}. ▒▒▒</span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        {/* پرسش آزاد از استاد — دسکتاپ: کارت در سایدبار به‌جای نوار شناور */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold"><Send className="h-4 w-4 -scale-x-100 text-bronze" /> از استاد بپرس</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!questionInput.trim()) return;
              handleAction("free", questionInput.trim());
              setQuestionInput("");
            }}
            className="flex items-center gap-2"
          >
            <input
              value={questionInput}
              onChange={(e) => setQuestionInput(e.target.value)}
              placeholder="سوالی از استاد داری؟ بپرس…"
              className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-bronze"
              aria-label="سؤال آزاد از استاد"
            />
            <button type="submit" disabled={!!loadingFor} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40" aria-label="ارسال سوال">
              <Send className="h-4 w-4 -scale-x-100" />
            </button>
          </form>
        </div>
        {laws.length > 0 && (
          <div className="max-h-[46vh] space-y-2.5 overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-card">
            <p className="flex items-center gap-2 border-b border-dashed border-border pb-2.5 text-sm font-bold"><Scale className="h-4 w-4 text-bronze" /> مواد قانونی مرتبط</p>
            {laws.map((l, i) => (
              <p key={i} className="law-text rounded-lg border-s-2 border-bronze/60 bg-gradient-to-l from-bronze/[0.07] to-transparent px-3 py-2 text-[15px] leading-relaxed">
                <span className="font-display font-bold text-bronze">مادهٔ {l.no}</span> — {l.text.slice(0, 110)}…
              </p>
            ))}
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold"><StickyNote className="h-4 w-4 text-bronze" /> یادداشت من</p>
          <NoteBox onSave={(t) => addNote(id, t)} />
          <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto text-xs">
            {notes.map((n) => (
              <li key={n.id} className="group rounded-lg bg-muted px-3 py-2">
                {n.text}
                <button onClick={() => removeNote(id, n.id)} aria-label="حذف یادداشت" className="float-left opacity-0 transition-opacity group-hover:opacity-100">
                  <Trash2 className="h-3 w-3 text-danger" />
                </button>
              </li>
            ))}
            {notes.length === 0 && <li className="text-muted-foreground/60">هنوز یادداشتی نداری؛ اولین نکته مهم را ثبت کن.</li>}
          </ul>
        </div>
      </div>
    </aside>
  );

  // ─── حالت تولید هوشمند جلسه وارداتی ───
  if (lesson.status === "ai-pending") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <BookMarked className="mx-auto mb-4 h-10 w-10 text-bronze" />
        <h1 className="mb-2 text-xl font-bold">{lesson.title}</h1>
        <p className="mx-auto mb-6 max-w-md text-sm leading-loose text-muted-foreground">
          این جلسه از کتاب وارداتی استخراج شده و هنوز محتوای کامل ندارد. دکمه زیر را بزن تا «استاد حقوقی هوشمند» بر اساس متن اصلی همین کتاب، جلسه را طبق الگوی هشت‌بخشی تدریس کند.
        </p>
        {aiPendingBusy ? (
          <AIThinking label="در حال تحلیل متن کتاب و تنظیم طرح درس" />
        ) : (
          <button onClick={generateAiLesson} className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition-transform active:scale-[.98]">
            <Sparkles className="h-5 w-5" /> تدریس این جلسه توسط استاد
          </button>
        )}
        {aiErr && <p className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{aiErr}</p>}
      </div>
    );
  }

  // ─── لود تنبل: متن هنوز از شبکه نرسیده ───
  if (isLazyLesson(lesson) && lesson.sections.length === 0 && textState !== "ready") {
    return (
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 pt-6 pb-[186px] sm:px-6 lg:grid-cols-[1fr_320px] lg:pb-12">
        <main className="min-w-0">
          <header className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
            <p className="text-xs font-medium text-bronze">{course.title} · فصل {fa(chapter.order)}</p>
            <h1 className="mt-1.5 text-xl font-bold leading-relaxed sm:text-2xl">{lesson.title}</h1>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              {textState === "error" ? (
                <>
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span>دریافت متن جلسه ناموفق بود — اتصال اینترنت را بررسی کن.</span>
                  <button
                    onClick={() => void ensureLessonContent(lesson)}
                    className="ms-auto inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 font-semibold text-bronze hover:border-bronze"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> تلاش دوباره
                  </button>
                </>
              ) : (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-bronze" />
                  <span>در حال دریافت متن جلسه…</span>
                </>
              )}
            </div>
          </header>
          {/* اسکلت بخش‌ها — تا متن برسد؛ شکل‌ها همان بخش‌های هشت‌گانهٔ تدریس است */}
          <div className="space-y-6" aria-busy="true" aria-label="در حال بارگذاری متن جلسه">
            {[92, 78, 64].map((w, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-border bg-card p-5 shadow-card sm:p-7">
                <div className="mb-4 flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-muted" />
                  <div className="h-3.5 rounded bg-muted" style={{ width: `${w * 0.45}%` }} />
                </div>
                <div className="space-y-2.5">
                  <div className="h-3 rounded bg-muted" style={{ width: `${w}%` }} />
                  <div className="h-3 rounded bg-muted" style={{ width: `${Math.max(30, w - 14)}%` }} />
                  <div className="h-3 rounded bg-muted/70" style={{ width: `${Math.max(24, w - 28)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  const bodyTabContent =
    tab === "toc" ? (
      <nav className="space-y-1 lg:hidden">
        {sections.map((s, i) => (
          <button key={s.id} disabled={i >= visibleCount} onClick={() => setTab("teach")} className={`block w-full rounded-lg px-3 py-2 text-start text-sm ${i < visibleCount ? "bg-muted" : "opacity-40"}`}>
            {fa(i + 1)}. {SECTION_META[s.type].title}
          </button>
        ))}
      </nav>
    ) : tab === "laws" ? (
      <LawBox laws={laws} />
    ) : null;

  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 pt-6 pb-[186px] sm:px-6 lg:grid-cols-[1fr_320px] lg:pb-12">
      {/* ستون اصلی */}
      <main className="min-w-0">
        {/* نوار پیشرفت جلسه */}
        <header className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
          <p className="text-xs font-medium text-bronze">{course.title} · فصل {fa(chapter.order)}</p>
          <h1 className="mt-1.5 text-xl font-bold leading-relaxed sm:text-2xl">{lesson.title}</h1>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-border/80">
            <motion.div
              className="progress-sheen h-full rounded-full"
              style={{ background: "linear-gradient(to left, var(--bronze), color-mix(in srgb, var(--primary) 82%, var(--bronze)))" }}
              animate={{ width: `${(visibleCount / Math.max(1, sections.length)) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">بخش {fa(visibleCount)} از {fa(sections.length)} — هر بار یکی را با دقت بخوان، استاد ادامه می‌دهد.</p>

          {/* تب‌های موبایل */}
          <div className="mt-3 flex gap-2 lg:hidden">
            {[["teach", "تدریس"], ["toc", "فهرست"], ["laws", `مواد (${fa(laws.length)})`]].map(([k, t]) => (
              <button key={k} onClick={() => setTab(k as never)} className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${tab === k ? "border-bronze bg-bronze/10 text-bronze" : "border-border text-muted-foreground"}`}>
                {t}
              </button>
            ))}
          </div>
          {tab !== "teach" && <div className="lg:hidden">{bodyTabContent}</div>}
        </header>

        {/* بخش‌های تدریس */}
        <article className="space-y-6" style={{ display: tab === "teach" ? undefined : "none" }}>
          {sections.slice(0, visibleCount).map((s, i) => {
            const meta = SECTION_META[s.type];
            return (
              <motion.section
                key={s.id}
                id={`sec-${i}`}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="scroll-mt-28 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-7"
              >
                <SectionHead n={i + 1} type={s.type} title={s.title ?? meta.title} />

                {/* موتور رندر مشترک — همان المان‌هایی که مطالب اساتید هم استفاده می‌کنند */}
                <SectionBody s={s} />

                {/* پاسخ‌های AI پیوست‌شده — مستندهای 📜 در باکس جدا رندر می‌شوند */}
                {aiNotes.filter((a) => a.sectionId === s.id).map((a, k) => (
                  <div key={k} className="relative mt-4 rounded-xl border border-dashed border-bronze/50 bg-bronze/5 p-4">
                    <Sparkles aria-hidden className="absolute -top-2.5 end-4 grid h-5 w-5 place-items-center rounded-full bg-card text-bronze" />
                    <p className="mb-1 flex items-center gap-1 text-xs font-bold text-bronze"><HelpCircle className="h-3.5 w-3.5" /> تکمیل استاد</p>
                    <AiAnswerRich text={a.text} />
                  </div>
                ))}
              </motion.section>
            );
          })}

          <AnimatePresence>
            {loadingFor && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <AIThinking label={loadingFor.startsWith("simple") ? "در حال بازتعریف ساده‌تر" : loadingFor.startsWith("examples") ? "در حال طراحی مثال‌های تازه" : "در حال بررسی پرسش شما"} />
              </motion.div>
            )}
          </AnimatePresence>

          {aiErr && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{aiErr}</p>}

          {/* نوار کنش جلسه — مینیمال: یک کنش اصلی + منوی بیشتر برای بقیه */}
          <div className="flex flex-wrap items-center gap-2.5">
            {!atEnd ? (
              <button onClick={revealNext} className="inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-3 font-semibold text-primary-foreground shadow-card transition-all duration-200 hover:-translate-y-px hover:brightness-110 active:scale-[.98]">
                <ArrowDownCircle className="h-5 w-5" /> ادامه بده
              </button>
            ) : (
              <>
                <button
                  onClick={() => { complete(id); navigate({ view: "quiz", id }); }}
                  className="inline-flex items-center gap-2 rounded-xl bg-success px-6 py-3 font-semibold text-white shadow-card transition-transform active:scale-[.98]"
                >
                  <ClipboardList className="h-5 w-5" /> برو به تست
                </button>
                {nextChapter && nextChapter.lessons[0] && (
                  <button
                    onClick={() => {
                      complete(id);
                      const first = nextChapter.lessons[0];
                      window.scrollTo({ top: 0, behavior: "smooth" });
                      setTimeout(() => navigate({ view: "learn", id: first.id }), 120);
                    }}
                    title={`رفتن به ${nextChapter.title}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-bronze/50 bg-bronze/10 px-5 py-3 text-sm font-bold text-bronze transition-colors hover:bg-bronze/20 active:scale-[.99]"
                  >
                    <ArrowLeft className="h-4 w-4 shrink-0" />
                    فصل بعدی
                    <span className="hidden max-w-[140px] truncate opacity-75 md:inline">· {nextChapter.title}</span>
                  </button>
                )}
                {!nextChapter && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-success" /> این آخرین فصل این درس است
                  </span>
                )}
              </>
            )}

            {/* همهٔ کنش‌های فرعی فقط داخل منوی بیشتر — بدون شلوغی پایین صفحه */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  disabled={!!loadingFor}
                  aria-label="کنش‌های بیشتر"
                  title="موارد کمکی و تکمیلی"
                  className="inline-flex h-[46px] items-center gap-1.5 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-muted-foreground shadow-card transition-colors hover:border-bronze/60 hover:text-bronze disabled:opacity-45"
                >
                  <MoreHorizontal className="h-5 w-5" /> بیشتر
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={10} className="w-72 rounded-xl p-1.5">
                <DropdownMenuItem
                  onClick={() => handleAction("simple")}
                  disabled={!!loadingFor}
                  className="cursor-pointer rounded-lg gap-2.5 py-2.5"
                >
                  <HelpCircle className="h-4 w-4 shrink-0 text-bronze" /> متوجه نشدم؛ ساده‌تر توضیح بده
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleAction("examples")}
                  disabled={!!loadingFor}
                  className="cursor-pointer rounded-lg gap-2.5 py-2.5"
                >
                  <Lightbulb className="h-4 w-4 shrink-0 text-bronze" /> مثال بیشتر بده
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setFeedbackOpen(true)}
                  disabled={!!loadingFor}
                  title="انتقاد از تدریس این جلسه؛ تحلیل با جزوه و ارسال به مدیر"
                  className="cursor-pointer rounded-lg gap-2.5 py-2.5"
                >
                  <MessageSquareWarning className="h-4 w-4 shrink-0 text-bronze" /> نقد تدریس این جلسه…
                </DropdownMenuItem>
                {atEnd && (
                  <DropdownMenuItem onClick={() => navigate({ view: "case", id })} className="cursor-pointer rounded-lg gap-2.5 py-2.5">
                    <Scale className="h-4 w-4 shrink-0 text-bronze" /> تمرین کیس واقعی
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ view: "course", id: course.id })} className="cursor-pointer rounded-lg gap-2.5 py-2.5">
                  <RotateCcw className="h-4 w-4 shrink-0 text-bronze" /> بازگشت به فهرست درس
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </article>
      </main>

      {Sidebar}

      {/* گفت‌وگوی بازخورد: انتقاد → تحلیل AI نسبت به جزوه → ثبت پیشنهاد برای مدیر */}
      <FeedbackDialog
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        courseId={course.id}
        chapterTitle={chapter.title}
        lessonId={id}
        lessonTitle={lesson.title}
        getContext={() => {
          const ground = lessonToContextText(sections.slice(0, visibleCount));
          return {
            courseTitle: course.title,
            chapterTitle: chapter.title,
            lessonTitle: lesson.title,
            seenSections: sections.slice(0, visibleCount).map((s) => s.title ?? ""),
            extra: ground.text,
            lawRegistry: ground.lawRegistry,
          };
        }}
      />

      {/* ورودی پرسش آزاد — فقط موبایل/تبلت: دکمهٔ فشرده‌ای چسبیده به داک پایین، نه معلق وسط صفحه */}
      <div className="fixed inset-x-0 bottom-[calc(4.6rem+env(safe-area-inset-bottom))] z-30 px-3 sm:px-6 lg:hidden">
        {askOpen ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!questionInput.trim()) return;
              handleAction("free", questionInput.trim());
              setQuestionInput("");
            }}
            className="mx-auto flex max-w-3xl items-center gap-1.5 rounded-2xl border border-bronze/40 bg-card/95 p-1.5 shadow-lg backdrop-blur"
          >
            <input
              autoFocus
              value={questionInput}
              onChange={(e) => setQuestionInput(e.target.value)}
              placeholder="سوالی از استاد داری؟ بپرس…"
              className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground/70"
              aria-label="سؤال آزاد از استاد"
            />
            <button type="submit" disabled={!!loadingFor} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40" aria-label="ارسال سوال">
              <Send className="h-4 w-4 -scale-x-100" />
            </button>
            <button type="button" onClick={() => setAskOpen(false)} aria-label="بستن پرسش سریع" className="grid h-10 w-8 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted">
              ×
            </button>
          </form>
        ) : (
          <div className="flex max-w-7xl">
            <button
              onClick={() => setAskOpen(true)}
              title="سؤال آزاد از استاد هوشمند همین جلسه"
              aria-label="از استاد بپرس"
              className={`inline-flex items-center gap-2 rounded-full border border-bronze/45 bg-card/95 p-1.5 pe-4 shadow-lg backdrop-blur transition-all duration-500 hover:border-bronze ${
                fabDim ? "pe-1.5 opacity-45 hover:pe-4 hover:opacity-100 focus-visible:opacity-100" : ""
              }`}
            >
              <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground">
                <Send className="h-4 w-4 -scale-x-100" />
              </span>
              <span
                aria-hidden={fabDim}
                className={`overflow-hidden whitespace-nowrap text-[12.5px] font-bold transition-all duration-500 ${
                  fabDim ? "max-w-0 opacity-0" : "max-w-[120px] opacity-100"
                }`}
              >
                از استاد بپرس
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** پاسخ استاد: متن Markdown + خطوط 📜 (مستند قانونی) در باکس‌های جدا */
function AiAnswerRich({ text }: { text: string }) {
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
        <div className="teach-body prose-p:leading-[1.85] text-[15.5px] [&_p]:my-1 [&_strong]:text-foreground">
          <ReactMarkdown>{prose}</ReactMarkdown>
        </div>
      )}
      {laws.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] font-bold text-muted-foreground">مستند قانونی پاسخ:</p>
          {laws.map((l, i) => (
            <p key={i} className="law-text flex gap-2 rounded-lg border-s-2 border-bronze/60 bg-background/70 px-3 py-2.5 text-[15.5px] leading-[1.9]">
              <Scale className="mt-1.5 h-3.5 w-3.5 shrink-0 text-bronze" />
              <span>{l}</span>
            </p>
          ))}
        </div>
      )}
    </>
  );
}

function NoteBox({ onSave }: { onSave: (t: string) => void }) {
  const [v, setV] = React.useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!v.trim()) return; onSave(v.trim()); setV(""); }}>
      <textarea
        value={v}
        onChange={(e) => setV(e.target.value)}
        rows={2}
        placeholder="یک نکته برای خودت بنویس…"
        className="w-full resize-none rounded-lg border border-input bg-background p-2 text-xs outline-none focus:border-bronze"
      />
      <button type="submit" className="mt-1 inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
        <Plus className="h-3 w-3" /> افزودن
      </button>
    </form>
  );
}
