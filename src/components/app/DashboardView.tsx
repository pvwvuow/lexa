"use client";

import * as React from "react";
import {
  PlayCircle, Clock3, Sparkles, BookOpen, BookMarked, Flame, ArrowLeft,
  UserPlus, UserCheck, MessageCircle, GraduationCap, Rss, LogIn, Star, Trash2,
  ChevronLeft, ChevronRight, LibraryBig,
} from "lucide-react";
import { builtinCourses } from "@/lib/law/courses";
import type { Course, Lesson } from "@/lib/law/types";
import { useApp } from "@/lib/store";
import { mergeAll } from "@/lib/books";
import { fa, pct } from "@/lib/fa";
import { navigate } from "@/lib/router";
import { Donut, ProgressBar, CourseIcon, StatChip, UserAvatar } from "./common";
import { useAuth, refreshLibrary } from "@/lib/auth-client";
import { useSocial, toggleBuiltinHidden } from "@/lib/social-client";

const faDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fa-IR", { month: "long", day: "numeric" });

const BUILTIN_IDS = new Set(builtinCourses.map((b) => b.id));

function lessonProgressOf(course: Course, progress: Record<string, { status?: string; sectionsSeen?: number; quizBest?: number }>) {
  let completed = 0;
  const flat = course.chapters.flatMap((c) => c.lessons);
  flat.forEach((l) => {
    const p = progress[l.id];
    if (p?.status === "completed") completed += 1;
    else if (p) completed += 0.5;
  });
  return pct(completed, Math.max(1, flat.length));
}

/** تعداد جلسات تمام‌شدهٔ یک درس */
function doneCountOf(course: Course, progress: Record<string, { status?: string }>) {
  return course.chapters.reduce((n, ch) => n + ch.lessons.filter((l) => progress[l.id]?.status === "completed").length, 0);
}

/** اولین جلسهٔ ناتمام درس (برای «ادامه از …») */
function nextPending(course: Course, progress: Record<string, { status?: string }>): Lesson | null {
  for (const ch of [...course.chapters].sort((a, b) => a.order - b.order))
    for (const l of ch.lessons)
      if (!progress[l.id]?.status) return l;
  return null;
}

/* ═══ بخش‌اسلایدر — سرصفحهٔ یکدست با دو دکمهٔ پیمایش + ردیف افقی اسنپ‌دار ═══ */

function SectionSlider({
  icon: Icon, title, hint, action, ariaLabel, children, padEnds = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  ariaLabel: string;
  children: React.ReactNode;
  /** بادسازی اولین و آخرین کارت لبه به لبه در نمایشگر کوچک */
  padEnds?: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [edge, setEdge] = React.useState<{ prev: boolean; next: boolean }>({ prev: false, next: false });

  const measure = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 4) return setEdge({ prev: false, next: false });
    const d = Math.abs(el.scrollLeft);
    setEdge({ prev: d > 4, next: max - d > 4 });
  }, []);

  React.useEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    const t = setTimeout(measure, 400); // پس از نشست فونت‌ها
    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      clearTimeout(t);
    };
  }, [measure]);

  function slide(dir: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.82), behavior: "smooth" });
  }

  const prevDisabled = !edge.prev;
  const nextDisabled = !edge.next;

  return (
    <section className="space-y-3.5" aria-label={ariaLabel}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <h2 className="flex min-w-0 items-center gap-2 text-lg font-bold">
          <Icon className="h-5 w-5 shrink-0 text-bronze" />
          {title}
          {hint && <span className="hidden truncate text-[11px] font-medium text-muted-foreground sm:inline">· {hint}</span>}
        </h2>
        <div className="flex items-center gap-1.5">
          {action}
          <button
            onClick={() => slide(1)}
            disabled={prevDisabled}
            aria-label={`${title} — قبلی`}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-card transition-all hover:border-bronze/60 hover:text-bronze disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => slide(-1)}
            disabled={nextDisabled}
            aria-label={`${title} — بعدی`}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-card transition-all hover:border-bronze/60 hover:text-bronze disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={ref}
        className={`hslider flex gap-3 overflow-x-auto pb-2 ${
          padEnds ? "-mx-4 px-4 sm:-mx-6 sm:px-6" : ""
        }`}
      >
        {children}
      </div>
    </section>
  );
}

export function DashboardView() {
  const progress = useApp((s) => s.progress);
  const last = useApp((s) => s.lastLocation);
  const streak = useApp((s) => s.streak);
  const customCourses = useApp((s) => s.customCourses);
  const tBooks = useApp((s) => s.tBooks);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "صبح بخیر، حق‌جو عزیز";
    if (h < 18) return "وقت بخیر، حق‌جو عزیز";
    return "شب بخیر، برای مرور شبانه آماده‌ای؟";
  })();

  // همهٔ کتاب‌ها: جزوات پایه + دورهٔ استاد + وارداتی
  const allCourses = React.useMemo(() => mergeAll({ customCourses, tBooks }), [customCourses, tBooks]);
  const hidden = useApp((s) => s.hiddenBuiltins);

  // مقصد «ادامه یادگیری»
  let resumeTarget: { courseTitle: string; lesson: Lesson } | null = null;
  if (last.lessonId) {
    for (const c of allCourses)
      for (const ch of c.chapters)
        for (const l of ch.lessons)
          if (l.id === last.lessonId) resumeTarget = { courseTitle: c.title, lesson: l };
  }
  if (!resumeTarget) {
    outer2: for (const m of allCourses) {
      for (const ch of m.chapters)
        for (const l of ch.lessons)
          if (!progress[l.id]?.status) { resumeTarget = { courseTitle: m.title, lesson: l }; break outer2; }
      if (resumeTarget) break;
    }
  }

  const shelfCourses = allCourses.filter(
    (c) =>
      !hidden.includes(c.id) &&
      ((c.chapters?.flatMap?.((ch) => ch.lessons) ?? []).length > 0 || !BUILTIN_IDS.has(c.id)),
  );
  const heroCourse = resumeTarget
    ? allCourses.find((c) => c.title === resumeTarget?.courseTitle) ?? allCourses[0]
    : allCourses[0];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-9 px-4 pb-28 pt-5 sm:px-6">
      {/* ═══ هیرو: سلام + ادامهٔ یادگیری + گیج پیشرفت ═══ */}
      <HeroPanel
        greeting={greeting}
        streak={streak.count}
        books={shelfCourses.length}
        resumeTarget={resumeTarget}
        heroCourse={heroCourse}
        progress={progress}
      />

      {/* پیام وضعیت کتابخانه (حذف/افزودن) */}
      <ToastHost />

      {/* ═══ قفسهٔ کتابخانهٔ من — اسلایدر ═══ */}
      <MyLibraryShelf courses={shelfCourses} progress={progress} />

      {/* ═══ دورتا‌دور مطالعه: کتابخانهٔ عمومی + دوره‌های آماده اپ ═══ */}
      <LibraryBand />

      {/* ═══ مطالب اساتیدی که دنبال می‌کنی — اسلایدر ═══ */}
      <FollowedFeed />

      {/* ═══ اساتید همیار — پیشنهاد اینستاگرامی ═══ */}
      <TeacherSuggestions />

      {/* ═══ نقشهٔ پیشرفت — حلقه‌های افقی ═══ */}
      <ProgressRings courses={allCourses} progress={progress} />

      <section className="flex flex-wrap items-center justify-center gap-2 pt-1">
        <StatChip icon={Sparkles}>برای استریک امروز کافیست یک جلسه را تمام کنی</StatChip>
      </section>
    </div>
  );
}

/* ═══ هیرو ══════════════════════════════════════════════════════════════ */

function HeroPanel({
  greeting, streak, books, resumeTarget, heroCourse, progress,
}: {
  greeting: string;
  streak: number;
  books: number;
  resumeTarget: { courseTitle: string; lesson: Lesson } | null;
  heroCourse?: Course;
  progress: Record<string, { status?: string }>;
}) {
  return (
    <section className="relative overflow-hidden rounded-[24px] bg-primary p-6 text-primary-foreground shadow-card sm:p-8">
      <div aria-hidden className="pattern-quilt absolute inset-0" />
      <div aria-hidden className="absolute -top-24 start-1/3 h-56 w-56 rounded-full bg-bronze/25 blur-3xl" />
      <div className="relative flex flex-col items-start gap-7 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-sm font-medium text-primary-foreground/70">{greeting}</p>
          {resumeTarget ? (
            <>
              <h1 className="text-xl font-extrabold leading-relaxed sm:text-2xl">جلسهٔ بعدی آماده است</h1>
              <p className="-mt-1.5 text-sm leading-relaxed text-primary-foreground/85">
                <span className="font-semibold text-bronze">{resumeTarget.courseTitle}</span> · {resumeTarget.lesson.title}
              </p>
              <button
                onClick={() => navigate({ view: "learn", id: resumeTarget.lesson.id })}
                className="mt-1 inline-flex items-center gap-2 rounded-xl bg-bronze px-5 py-2.5 text-sm font-bold text-bronze-foreground shadow-card transition-transform active:scale-[.98]"
              >
                <PlayCircle className="h-[18px] w-[18px]" />
                ادامه یادگیری
              </button>
            </>
          ) : (
            <>
              <h1 className="text-xl font-extrabold leading-relaxed sm:text-2xl">به استاد حقوقی هوشمند خوش آمدی</h1>
              <p className="-mt-1.5 text-sm leading-relaxed text-primary-foreground/85">
                یک درس را انتخاب کن تا استاد بخش‌به‌بخش برایت تدریس کند.
              </p>
              <button
                onClick={() => navigate({ view: "library" })}
                className="mt-1 inline-flex items-center gap-2 rounded-xl bg-bronze px-5 py-2.5 text-sm font-bold text-bronze-foreground shadow-card transition-transform active:scale-[.98]"
              >
                <LibraryBig className="h-[18px] w-[18px]" />
                انتخاب درس از کتابخانه
              </button>
            </>
          )}
          <div className="flex flex-wrap gap-2 pt-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur"><BookOpen className="h-3.5 w-3.5 text-bronze" />{fa(books)} درس فعال</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur"><Flame className="h-3.5 w-3.5 text-bronze" />استریک {fa(streak)} روز</span>
          </div>
        </div>
        {heroCourse && (
          <div className="rounded-2xl bg-white/10 p-2.5 backdrop-blur-sm">
            <Donut value={lessonProgressOf(heroCourse, progress)} size={112} stroke={9} label={heroCourse.title.slice(0, 14)} flat />
          </div>
        )}
      </div>
    </section>
  );
}

/** پیام لحظه‌ای وضعیت کتابخانه — بازخورد «حذف شد ولی داده‌ات ماند» */
let toastSetter: ((m: string) => void) | null = null;

function ToastHost() {
  const [msg, setMsg] = React.useState("");
  React.useEffect(() => {
    toastSetter = setMsg;
    return () => { toastSetter = null; };
  }, []);
  if (!msg) return null;
  return (
    <p className="rounded-xl border border-success/40 bg-success/10 px-4 py-2.5 text-xs leading-relaxed text-success">{msg}</p>
  );
}

function shelfToast(text: string) {
  toastSetter?.(text);
}

/* ═══ کتابخانهٔ من — قفسهٔ اسلایدری جلدها بدون انیمیشن بالارفتن ═══════════ */

function MyLibraryShelf({
  courses, progress,
}: {
  courses: Course[];
  progress: Record<string, { status?: string }>;
}) {
  const tBooks = useApp((s) => s.tBooks);
  const hidden = useApp((s) => s.hiddenBuiltins);

  const teacherCount = courses.filter((c) => !!((c as Course & { _ownerUsername?: string })._ownerUsername)).length;

  /** حذف دورهٔ استاد از کتابخانه — رکورد سرور پاک می‌شود ولی هیچ دادهٔ یادگیری دست نمی‌خورد */
  async function removeTeacherBook(courseId: string, title: string) {
    try {
      await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      await refreshLibrary();
      shelfToast(`«${title}» از کتابخانه حذف شد؛ اگر دوباره اضافه‌اش کنی همهٔ فعالیتت سر جایش است.`);
    } catch {}
  }

  /** توگل حذف دورهٔ داخلی (پیش‌فرض اپ) — برای حساب روی سرور، برای مهمان در همین مرورگر */
  async function toggleBuiltin(courseId: string, title: string) {
    const willHide = await toggleBuiltinHidden(courseId);
    shelfToast(
      willHide
        ? `«${title}» از کتابخانه حذف شد؛ پیشرفت و تست‌هایت محفوظ می‌ماند و از «کتابخانهٔ عمومی ← دوره‌های آماده» برمی‌گردد.`
        : `«${title}» به کتابخانه برگشت؛ دقیقاً همان‌جا که رهایش کرده بودی.`,
    );
  }

  const addGhostCard = (
    <button
      onClick={() => navigate({ view: "library" })}
      className="group flex w-[164px] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/90 bg-card/60 p-4 text-center transition-colors hover:border-bronze/50 sm:w-[184px]"
      aria-label="افزودن درس تازه از کتابخانهٔ عمومی"
    >
      <span className="grid h-11 w-11 rotate-45 place-items-center rounded-[11px] border border-bronze/40 bg-bronze/10 shadow-card transition-transform group-hover:scale-105">
        <BookPlusDiamond />
      </span>
      <span className="text-xs font-bold text-bronze">درس تازه بخوان</span>
      <span className="text-[10px] leading-relaxed text-muted-foreground">از کتابخانهٔ عمومی یا دوره‌های آماده</span>
    </button>
  );

  return (
    <SectionSlider
      icon={BookMarked}
      title="کتابخانهٔ من"
      hint={`${fa(courses.length - teacherCount)} جزوهٔ پایه · ${fa(teacherCount)} دورهٔ استاد${hidden.length ? ` · ${fa(hidden.length)} عنوان مخفی` : ""}`}
      ariaLabel="قفسهٔ کتابخانهٔ من"
      padEnds
      action={
        <span className="hidden text-[11px] font-medium text-muted-foreground sm:inline">
          طول کشید؟ خودش می‌غزد
        </span>
      }
    >
      {courses.length === 0 ? (
        <button
          onClick={() => navigate({ view: "library" })}
          className="w-full shrink-0 rounded-2xl border border-dashed border-border bg-card px-5 py-6 text-start text-sm text-muted-foreground transition-colors hover:border-bronze/50"
        >
          هنوز درسی در قفسه نداری؛ از «کتابخانهٔ عمومی» یکی را انتخاب کن تا همین‌جا ببینی‌اش.
        </button>
      ) : (
        courses.map((c) => {
          const cid = c.id;
          const ownerCourse =
            !!((c as Course & { _ownerUsername?: string })._ownerUsername) &&
            tBooks.some((t) => t.id === cid);
          const isBuiltin = BUILTIN_IDS.has(cid);
          return (
            <BookCover
              key={cid}
              c={c}
              progress={progress}
              onRemove={
                ownerCourse
                  ? () => removeTeacherBook(cid, c.title)
                  : isBuiltin
                    ? () => toggleBuiltin(cid, c.title)
                    : undefined
              }
            />
          );
        })
      )}
      {addGhostCard}
    </SectionSlider>
  );
}

/** لوزی کوچک «+» روی کارت افزودن */
function BookPlusDiamond() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 -rotate-45 text-bronze" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function BookCover({
  c, progress, onRemove,
}: {
  c: Course;
  progress: Record<string, { status?: string }>;
  onRemove?: () => void;
}) {
  const owner = (c as Course & { _ownerUsername?: string })._ownerUsername;
  const isPrep = (c as Course & { _status?: string })._status === "prep";
  const isBuiltin = BUILTIN_IDS.has(c.id);
  const [confirming, setConfirming] = React.useState(false);
  const total = c.chapters.reduce((n, x) => n + x.lessons.length, 0);
  const done = doneCountOf(c, progress);
  const p = lessonProgressOf(c, progress);
  const zone = owner
    ? "bg-gradient-to-bl from-bronze/85 to-primary"
    : "bg-gradient-to-bl from-primary to-black/25";

  return (
    <div className="group relative w-[164px] shrink-0 snap-start sm:w-[184px]">
      <button
        onClick={() => navigate({ view: "course", id: c.id })}
        title={`${c.title} — ${fa(p)}٪ تکمیل`}
        className="block w-full overflow-hidden rounded-2xl border border-border bg-card text-start shadow-card transition-colors duration-200 hover:border-bronze/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
      >
        <span aria-hidden className={`relative block h-[86px] ${zone}`}>
          <span className="absolute -bottom-3 start-2 select-none font-display text-[58px] leading-none text-white/10">
            {c.title.slice(0, 1)}
          </span>
          <span aria-hidden className="pattern-quilt absolute inset-0 opacity-60" />
          <span className="absolute inset-x-0 bottom-2.5 mx-auto grid h-10 w-10 rotate-45 place-items-center rounded-[9px] border border-white/25 bg-background/20 shadow-card backdrop-blur-sm">
            <CourseIcon icon={c.icon} className="h-4.5 w-4.5 -rotate-45 text-white" />
          </span>
          {owner && (
            <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[9.5px] font-bold text-white backdrop-blur-sm">
              <GraduationCap className="h-3 w-3" /> {owner}
            </span>
          )}
          {isPrep && (
            <span className="absolute end-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-400/95 px-2 py-0.5 text-[9px] font-extrabold text-amber-950 shadow-card">
              <Clock3 className="h-3 w-3" /> در حال آماده‌سازی
            </span>
          )}
        </span>

        <span className="block space-y-2 p-3">
          <span className="line-clamp-1 block font-display text-[13px] font-bold">{c.title}</span>
          <ProgressBar value={p} />
          <span className="flex items-center justify-between text-[10.5px] text-muted-foreground">
            <span>{fa(p)}٪ پیشرفت</span>
            <span>{fa(done)}/{fa(total)}</span>
          </span>
        </span>
      </button>

      {/* حذف از کتابخانهٔ من — هم دورهٔ استاد، هم دورهٔ پیش‌فرض اپ؛ پیشرفت هرگز پاک نمی‌شود */}
      {onRemove && (
        confirming ? (
          <span className="absolute -top-2 end-1.5 z-10 flex items-center gap-1 rounded-xl border border-destructive/50 bg-background p-1 ps-2 shadow-card">
            <span className="whitespace-nowrap text-[10px] font-bold text-destructive">حذف شود؟</span>
            <button
              aria-label="تایید حذف"
              onClick={(e) => { e.stopPropagation(); setConfirming(false); onRemove(); }}
              className="rounded-lg bg-destructive px-2 py-1 text-[10px] font-bold text-white hover:brightness-110"
            >
              بله
            </button>
            <button
              aria-label="انصراف"
              onClick={(e) => { e.stopPropagation(); setConfirming(false); }}
              className="rounded-lg border border-border px-2 py-1 text-[10px] font-bold text-muted-foreground hover:text-foreground"
            >
              نه
            </button>
          </span>
        ) : (
          <button
            aria-label={`حذف ${c.title} از کتابخانه`}
            title={isBuiltin ? "حذف از کتابخانهٔ من — پیشرفتت می‌ماند" : "حذف از کتابخانهٔ من (پیشرفتت حفظ می‌شود)"}
            onClick={() => setConfirming(true)}
            className="absolute end-1.5 top-1.5 z-10 rounded-lg border border-border bg-background/90 p-1.5 text-muted-foreground opacity-0 shadow-card transition-opacity duration-150 hover:border-destructive/60 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 md:opacity-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )
      )}
    </div>
  );
}

/* ═══ باند کتابخانهٔ عمومی — راه ورود به دوره‌های آماده و مطالب اساتید ════ */

function LibraryBand() {
  const builtinSessions = builtinCourses.reduce((n, c) => n + c.chapters.reduce((m, ch) => m + ch.lessons.length, 0), 0);
  return (
    <button
      onClick={() => navigate({ view: "library" })}
      className="group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-border bg-card px-5 py-4 text-start shadow-card transition-colors hover:border-bronze/60"
    >
      <span aria-hidden className="absolute -start-10 top-0 h-full w-24 rotate-12 bg-gradient-to-l from-transparent via-bronze/[0.07] to-transparent" />
      <span className="grid h-12 w-12 shrink-0 rotate-45 place-items-center rounded-[13px] bg-primary/10 shadow-card transition-transform group-hover:scale-105">
        <LibraryBig className="h-5 w-5 -rotate-45 text-primary" />
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="block text-[15px] font-bold">کتابخانهٔ عمومی و دوره‌های آماده</span>
        <span className="block truncate text-xs text-muted-foreground">
          مدنی ۱، مدنی ۴، تجارت ۳ و مدنی ۷ با {fa(builtinSessions)} جلسه آماده تدریس + دوره‌ها و مطالب اساتید با دسته‌بندی شاخه‌ها
        </span>
      </span>
      <ArrowLeft className="h-4.5 w-4.5 shrink-0 text-muted-foreground/50 transition-all group-hover:-translate-x-0.5 group-hover:text-bronze" />
    </button>
  );
}

/* ═══ مطالب استادهایی که دنبال می‌کنی — اسلایدر کارتی ════════════════════ */

function FollowedFeed() {
  const { user } = useAuth();
  const { feed, teachers, showingAll, loading } = useSocial();

  const followedIds = React.useMemo(
    () => new Set(teachers.filter((t) => t.isFollowing).map((t) => t.id)),
    [teachers],
  );
  const myPosts = React.useMemo(() => {
    if (!user || !showingAll) return feed.slice(0, 8);
    return feed.filter((p) => followedIds.has(p.author.id)).slice(0, 8);
  }, [feed, followedIds, user, showingAll]);

  const showTeaser = !loading && myPosts.length === 0;

  return (
    <SectionSlider
      icon={Rss}
      title="مطالب استادهایی که دنبال می‌کنی"
      hint={user && showingAll && myPosts.length ? "چون هنوز کسی را دنبال نمی‌کنی، تازه‌ترین مطالب همه نشان داده شده" : undefined}
      ariaLabel="مطالب دنبال‌شده"
      action={
        <button onClick={() => navigate({ view: "teachers" })} className="text-xs font-semibold text-bronze hover:underline">اساتید ←</button>
      }
    >
      {showTeaser ? (
        <button
          onClick={() => navigate({ view: "teachers" })}
          className="w-full shrink-0 rounded-2xl border border-dashed border-border bg-card px-5 py-4 text-start text-xs leading-relaxed text-muted-foreground transition-colors hover:border-bronze/50 sm:w-[520px]"
        >
          {!user ? (
            <span className="mb-1 flex items-center gap-2 text-[12.5px] font-bold text-foreground"><LogIn className="h-4 w-4 shrink-0 text-bronze" /> وارد شو تا فید شخصی‌ات ساخته شود</span>
          ) : (
            <span className="mb-1 flex items-center gap-2 text-[12.5px] font-bold text-foreground"><UserPlus className="h-4 w-4 shrink-0 text-bronze" /> هنوز کسی را دنبال نکرده‌ای</span>
          )}
          {user
            ? "از صفحهٔ اساتید یکی را انتخاب کن تا نوشته‌هایش اینجا ببینی."
            : "اساتید را دنبال کن؛ نوشته‌های آموزشی‌شان همین‌جا غلتان می‌شود."}
        </button>
      ) : loading && myPosts.length === 0 ? (
        Array.from({ length: 3 }).map((_, i) => <FeedSkeleton key={i} />)
      ) : (
        myPosts.map((p) => (
          <article
            key={p.id}
            role="link"
            tabIndex={0}
            onClick={() => navigate({ view: "post", id: p.id })}
            onKeyDown={(e) => e.key === "Enter" && navigate({ view: "post", id: p.id })}
            className="group relative w-[240px] shrink-0 cursor-pointer snap-start rounded-2xl border border-border bg-card p-3.5 pt-4 shadow-card transition-colors hover:border-bronze/50"
          >
            <span aria-hidden className="absolute -top-[7px] start-4 h-px w-12 bg-gradient-to-l from-transparent via-bronze/60 to-transparent rtl:start-auto rtl:end-4" />
            <header className="mb-2 flex items-center gap-2">
              <ToTeacherProfile id={p.author.id} displayName={p.author.displayName} avatarUrl={p.author.avatarUrl} />
              <span className="min-w-0 flex-1" />
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[9.5px] font-medium text-muted-foreground">
                <MessageCircle className="h-3 w-3" /> {fa(p.commentsCount)}
              </span>
              {!!p.rating?.count && (
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-bronze/10 px-1.5 py-0.5 text-[9.5px] font-bold text-bronze">
                  <Star className="h-3 w-3 fill-current" /> {fa(Math.round(p.rating.avg * 10) / 10)}
                </span>
              )}
            </header>
            <p className="line-clamp-2 font-display text-[13px] font-bold leading-relaxed group-hover:text-bronze">{p.title}</p>
            {p.summary && <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{p.summary}</p>}
            <footer className="mt-2.5 text-[10px] text-muted-foreground/80">{faDate(p.createdAt)}</footer>
          </article>
        ))
      )}
    </SectionSlider>
  );
}

interface FollowPostLite {
  id: string; title: string; summary?: string; commentsCount: number;
  createdAt: string; rating?: { avg: number; count: number };
  author: { id: string; displayName: string; avatarUrl?: string | null };
}

function FeedSkeleton() {
  return (
    <div className="w-[240px] shrink-0 animate-pulse rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="mb-3 h-6 w-32 rounded-lg bg-muted" />
      <div className="space-y-2"><div className="h-3.5 w-full rounded bg-muted" /><div className="h-3.5 w-3/4 rounded bg-muted" /></div>
    </div>
  );
}

/** دکمهٔ کوچک رفتن به پروفایل استاد (آواتار + نام) */
function ToTeacherProfile({
  id, displayName, avatarUrl, compact = false,
}: { id: string; displayName: string; avatarUrl?: string | null; compact?: boolean }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigate({ view: "teacher", id });
      }}
      title={`پروفایل ${displayName}`}
      className="flex min-w-0 items-center gap-2 -m-0.5 rounded-lg p-0.5 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
    >
      <UserAvatar src={avatarUrl} name={displayName} size={compact ? "xs" : "sm"} />
      {!compact && (
        <span className="min-w-0 flex-1 text-start">
          <span className="block truncate text-[12px] font-bold hover:text-bronze">{displayName}</span>
          <span className="block text-[9.5px] text-muted-foreground">پروفایل و فعالیت‌ها ←</span>
        </span>
      )}
    </button>
  );
}

/* ═══ اساتید همیار — پیشنهاد اینستاگرامی داخل همان چارچوب اسلایدر ═══════ */

export function TeacherSuggestions() {
  const { teachers, loading, toggleFollow } = useSocial();
  const { user } = useAuth();
  const [err, setErr] = React.useState("");
  async function onFollow(id: string) {
    setErr("");
    try {
      await toggleFollow(id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطایی رخ داد.");
    }
  }

  if (loading && !teachers.length) {
    return (
      <SectionSlider icon={GraduationCap} title="اساتید همیار" ariaLabel="اساتید همیار">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="min-w-[188px] shrink-0 animate-pulse rounded-2xl border border-border bg-card p-4 pt-5 shadow-card">
            <div className="mx-auto mb-3 h-16 w-16 rounded-full bg-muted" />
            <div className="mx-auto mb-2 h-3.5 w-20 rounded bg-muted" />
            <div className="mx-auto mb-3 h-3 w-14 rounded bg-muted" />
            <div className="mx-auto h-7 w-24 rounded-full bg-muted" />
          </div>
        ))}
      </SectionSlider>
    );
  }
  if (!teachers.length) return null;

  const suggestions = teachers.filter((t) => !t.isFollowing).slice(0, 6);
  const following = teachers.filter((t) => t.isFollowing);

  return (
    <SectionSlider
      icon={GraduationCap}
      title="اساتید همیار"
      hint="روی آواتار بزن تا فعالیت کاملش را ببینی"
      ariaLabel="اساتید همیار"
      action={
        <button onClick={() => navigate({ view: "teachers" })} className="text-xs font-semibold text-bronze hover:underline">
          دیدن همه ←
        </button>
      }
    >
      {!user && (
        <p className="flex w-full shrink-0 items-center gap-2 self-stretch rounded-xl border border-dashed border-border bg-card px-4 py-3 text-xs leading-relaxed text-muted-foreground sm:w-[420px]">
          <LogIn className="h-4 w-4 shrink-0 text-bronze" />
          برای دنبال کردن اساتید و مشاهدهٔ مطالبشان، وارد حساب شو یا حساب بساز.
        </p>
      )}
      {err && (
        <p className="self-start rounded-xl bg-destructive/10 px-4 py-2 text-xs text-destructive">{err}</p>
      )}
      {[...suggestions, ...following].map((t) => (
        <div key={t.id} className="group relative w-[188px] shrink-0 snap-start rounded-2xl border border-border bg-card p-4 pt-5 text-center shadow-card transition-colors hover:border-bronze/50">
          <span aria-hidden className="absolute -top-[7px] start-1/2 h-px w-14 -translate-x-1/2 rtl:translate-x-1/2 bg-gradient-to-l from-transparent via-bronze/60 to-transparent" />
          <div className="mx-auto mb-3 w-fit" aria-hidden>
            <button onClick={() => navigate({ view: "teacher", id: t.id })} title={`پروفایل ${t.displayName}`} className="rounded-full p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze">
              <UserAvatar src={t.avatarUrl} name={t.displayName} />
            </button>
          </div>
          <button
            onClick={() => navigate({ view: "teacher", id: t.id })}
            className="w-full truncate rounded-lg font-display text-[13.5px] font-bold transition-colors hover:text-bronze"
            title={`پروفایل و فعالیت‌های ${t.displayName}`}
          >
            {t.displayName}
          </button>
          <p className="truncate text-[10.5px] text-muted-foreground">@{t.username}</p>
          <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
            {fa(t.followers)} دنبال‌کننده · {fa(t.posts)} مطلب{t.courses > 0 ? ` · ${fa(t.courses)} دوره` : ""}
          </p>
          <button
            onClick={() => onFollow(t.id)}
            disabled={!user}
            title={!user ? "ابتدا وارد شو" : undefined}
            className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[11.5px] font-bold transition-all ${
              t.isFollowing
                ? "border border-success/50 bg-success/10 text-success"
                : "bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-45"
            }`}
          >
            {t.isFollowing ? <UserCheck className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
            {t.isFollowing ? "دنبال می‌کنی" : "دنبال کردن"}
          </button>
        </div>
      ))}
    </SectionSlider>
  );
}

/* ═══ نقشهٔ پیشرفت — حلقه‌های لوزی‌نشانِ اسلایدری ═════════════════════════ */

function ProgressRings({
  courses, progress,
}: {
  courses: Course[];
  progress: Record<string, { status?: string }>;
}) {
  return (
    <SectionSlider
      icon={Flame}
      title="نقشهٔ پیشرفت تو"
      hint="حلقهٔ رنگی یعنی درصد اتمام آن درس"
      ariaLabel="نقشهٔ پیشرفت"
      action={
        <button onClick={() => navigate({ view: "progress" })} className="text-xs font-semibold text-bronze hover:underline">گزارش کامل ←</button>
      }
    >
      {courses.map((c) => {
        const done = doneCountOf(c, progress);
        const total = c.chapters.reduce((n, x) => n + x.lessons.length, 0);
        const np = nextPending(c, progress);
        const p = lessonProgressOf(c, progress);
        return (
          <button
            key={c.id}
            onClick={() => navigate({ view: "course", id: c.id })}
            title={`${c.title} — ${fa(p)}٪ تکمیل`}
            className="group w-[168px] shrink-0 snap-start rounded-2xl border border-border bg-card p-4 text-center shadow-card transition-colors hover:border-bronze/60"
          >
            <div className="relative mx-auto h-[92px] w-[92px]">
              <Donut value={p} size={92} stroke={8} flat />
              <span className="absolute end-0 top-0 grid h-7 w-7 rotate-45 place-items-center rounded-[8px] border border-bronze/30 bg-bronze/10 shadow-card">
                <CourseIcon icon={c.icon} className="h-3.5 w-3.5 -rotate-45 text-bronze" />
              </span>
            </div>
            <p className="mt-2.5 truncate font-display text-[13px] font-bold">{c.title}</p>
            <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted-foreground">
              {fa(done)} از {fa(total)} جلسه
              {np ? <> · ادامه از «{np.title.length > 14 ? np.title.slice(0, 14) + "…" : np.title}»</> : " · تمام شد؛ آفرین!"}
            </p>
            <span className="mt-2 inline-flex items-center gap-1 text-[10.5px] font-bold text-bronze opacity-0 transition-opacity group-hover:opacity-100">
              باز کردن فصل‌ها <ArrowLeft className="h-3 w-3" />
            </span>
          </button>
        );
      })}
    </SectionSlider>
  );
}

/* ═══ نسخهٔ قبلی تیزرهای فید — همچنان در صفحهٔ اساتید استفاده می‌شود ═════ */

export function TeacherFeedTeasers() {
  const { feed, showingAll, loading } = useSocial();
  if (!loading && !feed.length) return null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Rss className="h-5 w-5 text-bronze" /> مطالب اساتید</h2>
        <span className="text-[11px] text-muted-foreground">
          {showingAll ? "برای اختصاصی شدن فید، اساتید را دنبال کن" : "فقط از اساتیدی که دنبال می‌کنی"}
        </span>
      </div>

      {loading && <p className="text-sm text-muted-foreground">در حال بارگذاری مطالب…</p>}

      <div className="grid gap-3 md:grid-cols-2">
        {feed.map((p) => (
          <div
            key={p.id}
            role="link"
            tabIndex={0}
            onClick={() => navigate({ view: "post", id: p.id })}
            onKeyDown={(e) => e.key === "Enter" && navigate({ view: "post", id: p.id })}
            className="group relative cursor-pointer overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-card transition-colors hover:border-bronze/50 sm:p-5"
          >
            <div className="mb-2.5 flex items-center gap-2.5">
              <ToTeacherProfile id={p.author.id} displayName={p.author.displayName} avatarUrl={p.author.avatarUrl} />
              <span className="text-[10px] text-muted-foreground">{faDate(p.createdAt)}</span>
              <span className="ms-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                <MessageCircle className="h-3 w-3" /> {fa(p.commentsCount)}
              </span>
              {!!p.rating?.count && (
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-bronze/10 px-2 py-0.5 text-[10px] font-bold text-bronze">
                  <Star className="h-3 w-3 fill-current" /> {fa(Math.round(p.rating.avg * 10) / 10)}
                </span>
              )}
            </div>
            <p className="font-display line-clamp-1 text-[15px] font-bold group-hover:text-bronze">{p.title}</p>
            {p.summary && <p className="line-clamp-2 mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{p.summary}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
