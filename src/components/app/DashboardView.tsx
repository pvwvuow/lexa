"use client";

import * as React from "react";
import {
  PlayCircle, Clock3, Sparkles, BookOpen, BookMarked, Flame, ArrowLeft,
  UserPlus, UserCheck, MessageCircle, GraduationCap, Rss, LogIn, Star, Trash2,
  ChevronLeft, ChevronRight, LibraryBig, ListChecks, Briefcase, Gavel, CloudOff,
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
import type { OfflineCardPost } from "@/lib/offline";
import { OfflineDownloadButton, OfflineUpdatedPill } from "./offline-ui";

export const faDate = (iso: string) =>
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
  greeting, streak, books, resumeTarget,
}: {
  greeting: string;
  streak: number;
  books: number;
  resumeTarget: { courseTitle: string; lesson: Lesson } | null;
}) {
  return (
    <section
      aria-label="خانه"
      className="relative overflow-hidden rounded-[28px] border border-primary-foreground/10 bg-gradient-to-bl from-primary via-primary to-[#123628] p-5 text-primary-foreground shadow-card sm:p-8"
    >
      {/* بافت فیبرکربنی و هالهٔ برنزی */}
      <div aria-hidden className="pattern-quilt absolute inset-0 opacity-90" />
      {/* تصویر صحنهٔ حقوق — نیمهٔ خالی هیرو را پر می‌کند (موبایل: پس‌زمینهٔ کم‌رنگ) */}
      <img
        src="/media/hero-law.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover opacity-[0.16] lg:inset-y-0 lg:end-0 lg:start-auto lg:h-full lg:w-[47%] lg:opacity-95 lg:[mask-image:linear-gradient(to_right,black_36%,transparent_97%)]"
      />
      <div aria-hidden className="absolute -top-28 start-1/4 h-64 w-64 rounded-full bg-bronze/25 blur-3xl" />
      <div aria-hidden className="absolute -bottom-32 end-0 h-56 w-56 rounded-full bg-bronze/10 blur-3xl" />

      <div className="relative space-y-6">
        {/* سطر بالایی: سلام + آمار — بدون هیچ درصد پیشرفتی؛ در دسکتاپ در نیمهٔ راست */}
        <div className="space-y-3 lg:max-w-[55%]">
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

        {/* جدیدترین مطالب — کارت‌های فید مثل طرح مرجع */}
        <LatestPosts />
      </div>
    </section>
  );
}

/* ─── جدیدترین مطالب — کاروسل کارت فید با جلد دسته‌بندی، نویسنده و زمان مطالعه ── */

const CATEGORY_COVER: Record<string, { bg: string; Icon: React.ComponentType<{ className?: string }> }> = {
  tejarat: { bg: "from-[#96742f] to-[#413113]", Icon: Briefcase },
  "ayin-dadresi": { bg: "from-[#1f5a4c] to-[#0f2f28]", Icon: Gavel },
  "azmoon-vekalat": { bg: "from-[#2c5083] to-[#152a47]", Icon: GraduationCap },
  takhassosi: { bg: "from-[#5a3b6e] to-[#2c1d38]", Icon: BookMarked },
  other: { bg: "from-[#3c5148] to-[#1c2b24]", Icon: BookOpen },
};

function LatestPosts() {
  const { feed, loading, offline } = useSocial();
  const ref = React.useRef<HTMLDivElement>(null);
  const [edge, setEdge] = React.useState({ prev: false, next: false });

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
    const t = setTimeout(measure, 500); // پس از نشست فونت‌ها
    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      clearTimeout(t);
    };
  }, [measure, feed.length]);

  function slide(dir: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.82), behavior: "smooth" });
  }

  return (
    <div className="space-y-3" aria-label="جدیدترین مطالب استادها">
      {/* سرصفحه: عنوان + «مشاهده همه» */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-white">
          <Rss className="h-4 w-4 text-bronze" /> جدیدترین مطالب
        </span>
        <button
          onClick={() => navigate({ view: "teachers" })}
          className="rounded-full border border-bronze/60 bg-bronze/15 px-3 py-1 text-[10.5px] font-bold text-bronze transition-colors hover:bg-bronze/25"
        >
          مشاهده همه
        </button>
        {offline && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[9.5px] font-bold text-amber-200">
            <CloudOff className="h-3 w-3" /> نسخهٔ آفلاین بستهٔ ذخیره‌شده
          </span>
        )}
        <span className="ms-auto hidden text-[10px] font-medium text-primary-foreground/50 sm:inline">
          تازه‌ترین نوشته‌های اساتید
        </span>
      </div>

      {/* ردیف کارت‌ها + فلش‌های شناور */}
      <div className="relative">
        <div ref={ref} className="hslider -mx-1 flex gap-3 overflow-x-auto px-1 pb-1.5 pt-1">
          {loading && feed.length === 0 ? (
            [0, 1, 2, 3].map((i) => <FeedCardSkeleton key={i} />)
          ) : feed.length > 0 ? (
            feed.slice(0, 10).map((p) => <FeedCard key={p.id} p={p} />)
          ) : (
            <button
              onClick={() => navigate({ view: "teachers" })}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-l from-amber-100 to-sky-100 px-4 py-6 text-xs font-semibold leading-relaxed text-[#1f2c25] shadow-card transition-shadow hover:shadow-lg"
            >
              <GraduationCap className="h-5 w-5 shrink-0 text-amber-600" />
              هنوز مطلبی منتشر نشده؛ از «اساتید و مقالات» یکی را دنبال کن تا تازه‌هایش اینجا بدرخشد.
            </button>
          )}
        </div>

        {edge.next && (
          <button
            onClick={() => slide(-1)}
            aria-label="مطالب بعدی"
            className="absolute end-0 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/45 text-white shadow-card backdrop-blur transition-colors hover:border-bronze hover:text-bronze"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {edge.prev && (
          <button
            onClick={() => slide(1)}
            aria-label="مطالب قبلی"
            className="absolute start-0 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/45 text-white shadow-card backdrop-blur transition-colors hover:border-bronze hover:text-bronze"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/** کارت مطلب — جلد رنگی دسته + چیپ دسته + عنوان + نویسنده + تاریخ + زمان مطالعه */
function FeedCard({
  p,
}: {
  p: {
    id: string; title: string; summary?: string; createdAt: string; updatedAt?: string; commentsCount: number;
    rating?: { avg: number; count: number };
    categories?: string[];
    category?: string;
    thumbnail?: string;
    author: { id: string; displayName: string; avatarUrl?: string | null };
  };
}) {
  const cat = p.categories?.[0] ?? p.category ?? "other";
  const cover = CATEGORY_COVER[cat] ?? CATEGORY_COVER.other;
  const Icon = cover.Icon;
  const catLabel = categoryLabelOf(cat);
  // برآورد زمان مطالعه از حجم خلاصه — تشریفاتی ولی منطقی
  const minutes = Math.min(12, Math.max(3, Math.ceil((p.summary?.length ?? 140) / 150) + 3));

  return (
    // div با نقش لینک — چون دکمهٔ دانلود آفلاین داخلش است (button تودرتو ممنوع)
    // ظاهر هم‌سبک دکمهٔ روز/شب — گرادیان ملایم کهربایی → آسمانی
    <div
      role="link"
      tabIndex={0}
      onClick={() => navigate({ view: "post", id: p.id })}
      onKeyDown={(e) => e.key === "Enter" && navigate({ view: "post", id: p.id })}
      className="group w-[240px] shrink-0 snap-start cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-bl from-amber-100 to-sky-100 text-start text-[#1f2c25] shadow-card transition-all duration-200 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze sm:w-[268px]"
    >
      {/* جلد — تصویر شاخص استاد اگر باشد، وگرنه جلد رنگی دسته — گرد و با فاصله از لبهٔ کارت */}
      <span className="block p-2.5 pb-0">
      {p.thumbnail ? (
        <span className="relative block h-[104px] overflow-hidden rounded-xl">
          <img src={p.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
          <OfflineUpdatedPill kind="post" id={p.id} serverUpdatedAt={p.updatedAt} className="absolute top-2 start-2.5" />
          <span className="absolute bottom-2 start-2.5 rounded-full bg-black/45 px-2.5 py-0.5 text-[9.5px] font-bold text-white backdrop-blur">
            {catLabel}
          </span>
        </span>
      ) : (
      <span className={`relative block h-[104px] overflow-hidden rounded-xl bg-gradient-to-bl ${cover.bg}`}>
        <span aria-hidden className="pattern-quilt absolute inset-0 opacity-30" />
        <span aria-hidden className="absolute -bottom-6 -start-4 select-none font-display text-[64px] leading-none text-white/10">
          {p.title.slice(0, 1)}
        </span>
        <span aria-hidden className="absolute inset-0 m-auto grid h-11 w-11 rotate-45 place-items-center rounded-[11px] border border-white/40 bg-white/15 shadow-card backdrop-blur-[2px] transition-transform duration-200 group-hover:scale-110">
          <Icon className="h-4.5 w-4.5 -rotate-45 text-white" />
        </span>
        <OfflineUpdatedPill kind="post" id={p.id} serverUpdatedAt={p.updatedAt} className="absolute top-2 start-2.5" />
        <span className="absolute bottom-2 start-2.5 rounded-full bg-black/45 px-2.5 py-0.5 text-[9.5px] font-bold text-white backdrop-blur">
          {catLabel}
        </span>
      </span>
      )}
      </span>

      <span className="block space-y-2 p-3.5 pt-3">
        <span className="block min-h-[2.7em] text-[13px] font-extrabold leading-relaxed transition-colors group-hover:text-amber-700">
          {p.title}
        </span>
        <span className="flex items-center gap-2">
          <UserAvatar src={p.author.avatarUrl} name={p.author.displayName} size="xs" />
          <span className="min-w-0 flex-1 truncate text-[11px] font-bold">{p.author.displayName}</span>
          <span dir="ltr" className="shrink-0 text-[10px] font-semibold tabular-nums text-[#5c6b60]">{faDate(p.createdAt)}</span>
        </span>
        <span className="flex items-center gap-2 border-t border-black/[0.08] pt-2 text-[10px] font-semibold text-[#5c6b60]">
          <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{fa(minutes)} دقیقه مطالعه</span>
          <span className="ms-auto inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />{fa(p.commentsCount)} گفتگو</span>
          {!!p.rating?.count && (
            <span className="inline-flex items-center gap-0.5 font-bold text-amber-600"><Star className="h-3 w-3 fill-current" />{fa(Math.round(p.rating.avg * 10) / 10)}</span>
          )}
          <OfflineDownloadButton kind="post" id={p.id} serverUpdatedAt={p.updatedAt} card={p as OfflineCardPost} />
        </span>
      </span>
    </div>
  );
}

function FeedCardSkeleton() {
  return (
    <span className="block w-[240px] shrink-0 animate-pulse overflow-hidden rounded-2xl bg-gradient-to-bl from-amber-100/70 to-sky-100/70 sm:w-[268px]">
      <span className="block p-2.5 pb-0">
        <span className="block h-[104px] rounded-xl bg-white/40" />
      </span>
      <span className="block space-y-2 p-3.5 pt-3">
        <span className="block h-3.5 w-4/5 rounded bg-black/10" />
        <span className="block h-3 w-2/5 rounded bg-black/10" />
        <span className="block h-2.5 w-3/5 rounded bg-black/[0.07]" />
      </span>
    </span>
  );
}

/** برچسب فارسی دسته — بدون وابستگی به social-shared (سبک‌وزن برای هیرو) */
function categoryLabelOf(slug: string): string {
  return (
    { tejarat: "تجارت", "ayin-dadresi": "آیین دادرسی مدنی", "azmoon-vekalat": "آزمون وکالت", takhassosi: "دروس تخصصی", other: "مطلب آموزشی" } as Record<string, string>
  )[slug] ?? "مطلب آموزشی";
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
        <div className="flex w-full shrink-0 gap-3">
          <button
            onClick={() => navigate({ view: "library" })}
            className="min-w-[240px] flex-1 rounded-2xl border border-dashed border-border bg-card px-5 py-6 text-start text-sm leading-relaxed text-muted-foreground transition-colors hover:border-bronze/50"
          >
            هنوز درسی در قفسه نداری؛ از «کتابخانهٔ عمومی» یکی را انتخاب کن تا همین‌جا ببینی‌اش.
          </button>
          <div className="hidden w-[260px] shrink-0 rounded-2xl border border-border bg-card p-3.5 sm:block">
            <p className="mb-2 text-[11px] font-bold text-bronze">افزودن سریع</p>
            <div className="space-y-1.5">
              {["madani-1", "madani-4", "tejarat-3"].map((bid) => {
                const bc = builtinCourses.find((x) => x.id === bid);
                if (!bc) return null;
                return (
                  <button
                    key={bid}
                    onClick={() => void toggleBuiltinHidden(bid)}
                    className="flex w-full items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-[12px] font-bold transition-colors hover:border-bronze/60 hover:text-bronze"
                  >
                    <span className="grid h-5 w-5 place-items-center rounded-md bg-bronze/15 text-bronze">+</span>
                    <span className="min-w-0 flex-1 truncate text-start">{bc.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
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
              <OfflineUpdatedPill kind="post" id={p.id} serverUpdatedAt={p.updatedAt} />
              <span className="ms-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                <MessageCircle className="h-3 w-3" /> {fa(p.commentsCount)}
              </span>
              {!!p.rating?.count && (
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-bronze/10 px-2 py-0.5 text-[10px] font-bold text-bronze">
                  <Star className="h-3 w-3 fill-current" /> {fa(Math.round(p.rating.avg * 10) / 10)}
                </span>
              )}
              <OfflineDownloadButton kind="post" id={p.id} serverUpdatedAt={p.updatedAt} card={p} />
            </div>
            <p className="font-display line-clamp-1 text-[15px] font-bold group-hover:text-bronze">{p.title}</p>
            {p.summary && <p className="line-clamp-2 mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{p.summary}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
