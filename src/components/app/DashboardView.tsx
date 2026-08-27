"use client";

import * as React from "react";
import {
  PlayCircle, Clock3, Sparkles, BookOpen, BookMarked, Flame, ArrowLeft,
  UserPlus, UserCheck, MessageCircle, GraduationCap, Rss, LogIn, Star, Trash2,
  ChevronLeft, ChevronRight, LibraryBig, ListChecks,
} from "lucide-react";
import { builtinCourses } from "@/lib/law/courses";
import type { Course, Lesson } from "@/lib/law/types";
import { useApp } from "@/lib/store";
import { mergeAll } from "@/lib/books";
import { fa } from "@/lib/fa";
import { navigate } from "@/lib/router";
import { ProgressBar, CourseIcon, StatChip, UserAvatar } from "./common";
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
  return Math.round((completed / Math.max(1, flat.length)) * 100);
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
  // سرفصل‌های بعدی هر کتاب — برای صحنهٔ تئاتری و اسلایدر پایین هیرو
  const nextLessons = React.useMemo(() => {
    const out: {
      lessonId: string; courseTitle: string; lessonTitle: string;
      pct: number; icon?: string; owner?: string; isPrep: boolean;
    }[] = [];
    for (const c of shelfCourses.slice(0, 12)) {
      const np = nextPending(c, progress);
      if (!np) continue;
      out.push({
        lessonId: np.id,
        courseTitle: c.title,
        lessonTitle: np.title,
        pct: lessonProgressOf(c, progress),
        icon: c.icon,
        owner: (c as Course & { _ownerUsername?: string })._ownerUsername,
        isPrep: (c as Course & { _status?: string })._status === "prep",
      });
      if (out.length >= 8) break;
    }
    return out;
  }, [shelfCourses, progress]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-9 px-4 pb-28 pt-5 sm:px-6">
      {/* ═══ هیروی کربنی — سلام + ادامهٔ یادگیری + صحنهٔ تئاتری تازه‌ترین‌ها ═══ */}
      <HeroPanel
        greeting={greeting}
        streak={streak.count}
        books={shelfCourses.length}
        resumeTarget={resumeTarget}
        nextLessons={nextLessons}
      />

      {/* پیام وضعیت کتابخانه (حذف/افزودن) */}
      <ToastHost />

      {/* ═══ قفسهٔ کتابخانهٔ من — اسلایدر ═══ */}
      <MyLibraryShelf courses={shelfCourses} progress={progress} />

      {/* ═══ سرفصل‌های بعدی — نوار افقی بدون هیچ درصدی ═══ */}
      {nextLessons.length > 0 && (
        <SectionSlider icon={ListChecks} title="سرفصل‌های بعدی" hint="یک قدم تا جلسهٔ تازه" ariaLabel="سرفصل‌های بعدی" padEnds>
          {nextLessons.map((n) => (
            <button
              key={n.lessonId}
              onClick={() => navigate({ view: "learn", id: n.lessonId })}
              title={`${n.courseTitle} — جلسهٔ ${n.lessonTitle}`}
              className="group flex w-[250px] shrink-0 snap-start items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-start shadow-card transition-colors hover:border-bronze/60 sm:w-[290px]"
            >
              <span className="grid h-10 w-10 shrink-0 rotate-45 place-items-center rounded-[10px] border border-border bg-primary/5 shadow-card">
                <CourseIcon icon={n.icon} className="h-4 w-4 -rotate-45 text-bronze" />
              </span>
              <span className="min-w-0 flex-1 space-y-0.5">
                <span className="flex items-baseline gap-x-2">
                  <span className="truncate text-[12.5px] font-bold group-hover:text-bronze">{n.courseTitle}</span>
                  {n.owner && <span className="hidden shrink-0 text-[9.5px] font-bold text-muted-foreground sm:inline">استاد {n.owner}</span>}
                  {n.isPrep && <span className="shrink-0 rounded-full bg-amber-400/95 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-950">آماده‌سازی</span>}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">جلسهٔ بعد: {n.lessonTitle}</span>
              </span>
              <PlayCircle className="h-5 w-5 shrink-0 text-bronze/60 transition-all group-hover:-translate-x-0.5 group-hover:text-bronze" />
            </button>
          ))}
        </SectionSlider>
      )}

      {/* ═══ اساتید همیار — پیشنهاد اینستاگرامی ═══ */}
      <TeacherSuggestions />

      <section className="flex flex-wrap items-center justify-center gap-2 pt-1">
        <StatChip icon={Sparkles}>برای استریک امروز کافیست یک جلسه را تمام کنی</StatChip>
      </section>
    </div>
  );
}

/* ═══ هیروی کربنی v3 — بدون حلقهٔ پیشرفت؛ صحنهٔ تئاتری تک‌آیتم تایم‌دار ═══ */

type StageItem =
  | { kind: "post"; id: string; title: string; summary?: string; authorId: string; authorName: string; avatarUrl?: string | null; commentsCount: number; ratingAvg?: number; date: string }
  | { kind: "lesson"; lessonId: string; courseTitle: string; lessonTitle: string; owner?: string; isPrep: boolean; icon?: string };

const STAGE_DELAY = 7000; // هفت ثانیه روی هر آیتم، بعد آیتم تازه

function HeroPanel({
  greeting, streak, books, resumeTarget, nextLessons,
}: {
  greeting: string;
  streak: number;
  books: number;
  resumeTarget: { courseTitle: string; lesson: Lesson } | null;
  nextLessons: {
    lessonId: string; courseTitle: string; lessonTitle: string;
    pct: number; icon?: string; owner?: string; isPrep: boolean;
  }[];
}) {
  return (
    <section
      aria-label="خانه"
      className="relative overflow-hidden rounded-[28px] border border-primary-foreground/10 bg-gradient-to-bl from-primary via-primary to-[#123628] p-5 text-primary-foreground shadow-card sm:p-8"
    >
      {/* بافت فیبرکربنی و هالهٔ برنزی */}
      <div aria-hidden className="pattern-quilt absolute inset-0 opacity-90" />
      <div aria-hidden className="absolute -top-28 start-1/4 h-64 w-64 rounded-full bg-bronze/25 blur-3xl" />
      <div aria-hidden className="absolute -bottom-32 end-0 h-56 w-56 rounded-full bg-bronze/10 blur-3xl" />

      <div className="relative space-y-6">
        {/* سطر بالایی: سلام + آمار — بدون هیچ درصد پیشرفتی */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-primary-foreground/75">{greeting}</p>
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
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.13] px-3 py-1 text-xs font-semibold text-white backdrop-blur"><BookOpen className="h-3.5 w-3.5 text-bronze" />{fa(books)} درس فعال</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.13] px-3 py-1 text-xs font-semibold text-white backdrop-blur"><Flame className="h-3.5 w-3.5 text-bronze" />استریک {fa(streak)} روز</span>
          </div>
        </div>

        {/* صحنهٔ تئاتری — یک مطلب مهم، نورافکن‌وار، تایم‌دار */}
        <StageRotator nextLessons={nextLessons} />
      </div>
    </section>
  );
}

/* ─── صحنهٔ تئاتری: یک آیتم تازه در مرکز نور؛ تایمر می‌چرخد و آیتم بعدی می‌آید ── */

function StageRotator({
  nextLessons,
}: {
  nextLessons: {
    lessonId: string; courseTitle: string; lessonTitle: string;
    pct: number; icon?: string; owner?: string; isPrep: boolean;
  }[];
}) {
  const { feed, loading } = useSocial();
  const [authorFilter, setAuthorFilter] = React.useState("");

  // نویسندگان فید برای چیپ‌های فیلتر
  const authors = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of feed) if (!seen.has(p.author.id)) seen.set(p.author.id, p.author.displayName);
    return [...seen.entries()];
  }, [feed]);

  // آیتم‌های صحنه: مطالب استادها؛ اگر فیدی نبود سرفصل‌های بعدی همان‌جا زیر نور می‌روند
  const items = React.useMemo<StageItem[]>(() => {
    const posts = (authorFilter ? feed.filter((p) => p.author.id === authorFilter) : feed)
      .slice(0, 8)
      .map<StageItem>((p) => ({
        kind: "post", id: p.id, title: p.title, summary: p.summary,
        authorId: p.author.id, authorName: p.author.displayName, avatarUrl: p.author.avatarUrl,
        commentsCount: p.commentsCount, ratingAvg: p.rating?.count ? p.rating.avg : undefined,
        date: p.createdAt,
      }));
    if (posts.length > 0) return posts;
    return nextLessons.slice(0, 6).map<StageItem>((n) => ({
      kind: "lesson", lessonId: n.lessonId, courseTitle: n.courseTitle,
      lessonTitle: n.lessonTitle, owner: n.owner, isPrep: n.isPrep, icon: n.icon,
    }));
  }, [feed, authorFilter, nextLessons]);

  const [idx, setIdx] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [cycle, setCycle] = React.useState(0); // ریست انیمیشن نوار تایمر

  React.useEffect(() => { setIdx(0); setCycle((c) => c + 1); }, [authorFilter, feed.length]);

  React.useEffect(() => {
    if (paused || items.length <= 1) return;
    const t = setTimeout(() => {
      setIdx((i) => (i + 1) % items.length);
      setCycle((c) => c + 1);
    }, STAGE_DELAY);
    return () => clearTimeout(t);
  }, [idx, paused, items.length, cycle]);

  const item = items[Math.min(idx, items.length - 1)];

  if (loading && feed.length === 0) {
    return (
      <div className="space-y-3" aria-label="در حال بارگذاری تازه‌ها">
        <span className="block h-3.5 w-28 animate-pulse rounded bg-white/15" />
        <div className="grid min-h-[168px] place-items-center rounded-[22px] border border-white/10 bg-white/[0.04]">
          <div className="space-y-2.5 text-center">
            <span className="mx-auto block h-10 w-10 animate-pulse rounded-full bg-white/15" />
            <span className="mx-auto block h-3.5 w-44 animate-pulse rounded bg-white/15" />
            <span className="mx-auto block h-2.5 w-64 animate-pulse rounded bg-white/10" />
          </div>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <p className="rounded-[22px] border border-dashed border-white/25 bg-white/[0.05] px-4 py-6 text-center text-xs leading-relaxed text-primary-foreground/80">
        هنوز مطلب تازه‌ای برای نمایش نیست؛ از «اساتید همیار» یکی را دنبال کن تا نوشته‌هایش اینجا روی صحنه بیاید.
      </p>
    );
  }

  return (
    <div className="space-y-3.5" aria-label="تازه‌ها از استادها">
      {/* سرصفحه + فیلتر نویسنده (فقط وقتی فید پست دارد) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-primary-foreground/80">
          <Rss className="h-3.5 w-3.5 text-bronze" /> تازه از استادها
        </span>
        {items[0]?.kind === "post" && authors.length > 1 && (
          <>
            <span aria-hidden className="mx-1 hidden h-4 w-px bg-white/20 sm:block" />
            <div className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                onClick={() => setAuthorFilter("")}
                aria-pressed={!authorFilter}
                className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
                  !authorFilter ? "bg-white text-primary shadow-card" : "text-primary-foreground/70 hover:text-white"
                }`}
              >
                همه
              </button>
              {authors.map(([id, name]) => (
                <button
                  key={id}
                  onClick={() => setAuthorFilter(authorFilter === id ? "" : id)}
                  aria-pressed={authorFilter === id}
                  className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
                    authorFilter === id ? "bg-white text-primary shadow-card" : "text-primary-foreground/70 hover:text-white"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ═══ صحنه — زیر نورافکن ═══ */}
      <div
        className="stage-spotlight relative min-h-[190px] overflow-hidden rounded-[22px] border border-white/12 bg-white/[0.055] px-5 py-6 backdrop-blur-sm sm:px-8 sm:py-7"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setTimeout(() => setPaused(false), 3500)}
      >
        {/* پرتو نور از بالا — حس صحنهٔ تئاتر */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-24 h-56 bg-[radial-gradient(ellipse_at_top,rgba(205,166,94,0.22),transparent_65%)]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 start-1/2 h-40 w-[70%] -translate-x-1/2 rounded-full bg-[#0e2f22]/60 blur-2xl rtl:translate-x-1/2" />

        {item.kind === "post" ? (
          <div key={item.id} className="stage-in relative flex h-full flex-col items-center gap-3 text-center">
            <button
              onClick={(e) => { e.stopPropagation(); navigate({ view: "teacher", id: item.authorId }); }}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] py-1 pe-3.5 ps-1 transition-colors hover:border-bronze/50"
              title={`پروفایل ${item.authorName}`}
            >
              <UserAvatar src={item.avatarUrl} name={item.authorName} size="sm" />
              <span className="text-[11.5px] font-bold text-white">{item.authorName}</span>
            </button>
            <button
              onClick={() => navigate({ view: "post", id: item.id })}
              className="group mx-auto max-w-2xl space-y-2.5"
            >
              <h3 className="font-display text-[19px] font-extrabold leading-snug text-white transition-colors group-hover:text-bronze sm:text-[22px]">
                {item.title}
              </h3>
              {item.summary && (
                <p className="mx-auto max-w-xl line-clamp-2 text-[12.5px] leading-relaxed text-primary-foreground/75">{item.summary}</p>
              )}
              <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10.5px] text-primary-foreground/60">
                <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />{fa(item.commentsCount)} گفتگو</span>
                {!!item.ratingAvg && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-bronze/25 px-1.5 py-0.5 font-bold text-white">
                    <Star className="h-2.5 w-2.5 fill-current text-bronze" /> {fa(Math.round(item.ratingAvg * 10) / 10)}
                  </span>
                )}
                <span>· {faDate(item.date)}</span>
              </p>
            </button>
            <button
              onClick={() => navigate({ view: "post", id: item.id })}
              className="group mt-0.5 inline-flex items-center gap-1.5 rounded-full bg-bronze px-4 py-2 text-[12px] font-bold text-bronze-foreground shadow-card transition-transform active:scale-[.97]"
            >
              خواندن مطلب
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            </button>
          </div>
        ) : (
          <div key={item.lessonId} className="stage-in relative flex h-full flex-col items-center gap-3 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1 text-[11px] font-bold text-primary-foreground/85">
              <ListChecks className="h-3.5 w-3.5 text-bronze" /> سرفصل بعدی تو
            </span>
            <button
              onClick={() => navigate({ view: "learn", id: item.lessonId })}
              className="group mx-auto max-w-2xl space-y-2.5"
            >
              <h3 className="font-display text-[19px] font-extrabold leading-snug text-white transition-colors group-hover:text-bronze sm:text-[22px]">
                {item.lessonTitle}
              </h3>
              <p className="text-[12.5px] text-primary-foreground/75">
                <span className="font-bold text-bronze">{item.courseTitle}</span>
                {item.owner && <> · استاد {item.owner}</>}
                {item.isPrep && <span className="ms-1.5 rounded-full bg-amber-400/95 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-950">آماده‌سازی</span>}
              </p>
            </button>
            <button
              onClick={() => navigate({ view: "learn", id: item.lessonId })}
              className="group mt-0.5 inline-flex items-center gap-1.5 rounded-full bg-bronze px-4 py-2 text-[12px] font-bold text-bronze-foreground shadow-card transition-transform active:scale-[.97]"
            >
              شروع تدریس
              <PlayCircle className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* نوار تایمر پایین صحنه — گذشت زمان تا آیتم تازه */}
        {items.length > 1 && (
          <div aria-hidden className="absolute inset-x-5 bottom-0 h-[3px] overflow-hidden rounded-t bg-white/10 sm:inset-x-8">
            <span
              key={cycle}
              className="stage-timer block h-full rounded-t bg-gradient-to-l from-bronze to-[color-mix(in_srgb,var(--bronze)_55%,white)]"
              style={{ animationPlayState: paused ? "paused" : "running" }}
            />
          </div>
        )}
      </div>

      {/* پیمایش صحنه: نقطه‌ها + فلش‌ها */}
      {items.length > 1 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="انتخاب آیتم صحنه">
            {items.map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === idx}
                aria-label={`آیتم ${fa(i + 1)}`}
                onClick={() => { setIdx(i); setCycle((c) => c + 1); }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === idx ? "w-6 bg-bronze" : "w-1.5 bg-white/25 hover:bg-white/45"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { setIdx((i) => (i + 1) % items.length); setCycle((c) => c + 1); }}
              aria-label="آیتم بعدی"
              className="grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-white/[0.06] text-primary-foreground/80 transition-colors hover:border-bronze/60 hover:text-bronze"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => { setIdx((i) => (i - 1 + items.length) % items.length); setCycle((c) => c + 1); }}
              aria-label="آیتم قبلی"
              className="grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-white/[0.06] text-primary-foreground/80 transition-colors hover:border-bronze/60 hover:text-bronze"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** آواتار + نام کوچک روشن روی پنل تیره — کلیک به پروفایل استاد */
function ToTeacherProfileLight({
  id, displayName, avatarUrl,
}: { id: string; displayName: string; avatarUrl?: string | null }) {
  return (
    <span
      role="link"
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); navigate({ view: "teacher", id }); }}
      onKeyDown={(e) => e.key === "Enter" && navigate({ view: "teacher", id })}
      title={`پروفایل ${displayName}`}
      className="flex w-fit shrink-0 items-center gap-2 rounded-lg p-0.5 transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
    >
      <UserAvatar src={avatarUrl} name={displayName} size="sm" />
      <span className="hidden truncate text-[11.5px] font-bold text-white/90 sm:block max-w-24">{displayName}</span>
    </span>
  );
}

function HeroRowSkeleton() {
  return (
    <span className="flex animate-pulse items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3">
      <span className="h-8 w-8 shrink-0 rounded-full bg-white/15" />
      <span className="flex-1 space-y-1.5">
        <span className="block h-3 w-3/4 rounded bg-white/15" />
        <span className="block h-2.5 w-1/3 rounded bg-white/10" />
      </span>
    </span>
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

/* ═══ مطالب استادهایی که دنبال می‌کنی — اسلایدر کارتی ════════════════════ */

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
