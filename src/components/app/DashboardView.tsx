"use client";

import * as React from "react";
import {
  PlayCircle, Clock3, Sparkles, BookOpen, Layers3, Flame, ArrowLeft,
  UserPlus, UserCheck, MessageCircle, GraduationCap, Rss, LogIn,
} from "lucide-react";
import { builtinCourses } from "@/lib/law/courses";
import type { Course, Lesson } from "@/lib/law/types";
import { useApp } from "@/lib/store";
import { mergeAll } from "@/lib/books";
import { fa, pct } from "@/lib/fa";
import { navigate } from "@/lib/router";
import { Donut, ProgressBar, CourseIcon, StatChip } from "./common";
import { useAuth } from "@/lib/auth-client";
import { useSocial } from "@/lib/social-client";

const faDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fa-IR", { month: "long", day: "numeric" });

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

export function DashboardView() {
  const progress = useApp((s) => s.progress);
  const last = useApp((s) => s.lastLocation);
  const streak = useApp((s) => s.streak);
  const customCourses = useApp((s) => s.customCourses);
  const tBooks = useApp((s) => s.tBooks);
  const courses = mergeAll({ customCourses, tBooks });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "صبح بخیر، حق‌جو عزیز";
    if (h < 18) return "وقت بخیر، حق‌جو عزیز";
    return "شب بخیر، برای مرور شبانه آماده‌ای؟";
  })();

  // مقصد «ادامه یادگیری»
  let resumeTarget: { courseTitle: string; lesson: Lesson } | null = null;
  if (last.lessonId) {
    for (const c of courses)
      for (const ch of c.chapters)
        for (const l of ch.lessons)
          if (l.id === last.lessonId) resumeTarget = { courseTitle: c.title, lesson: l };
  }
  if (!resumeTarget) {
    for (const m of courses) {
      outer2: for (const ch of m.chapters) {
        for (const l of ch.lessons)
          if (!progress[l.id]?.status) { resumeTarget = { courseTitle: m.title, lesson: l }; break outer2; }
      }
      if (resumeTarget) break;
    }
  }

  // آمار کل کتاب‌ها + درسِ مبنای گیج هدر (آخرین درسِ فعال، وگرنه اولین)
  const totalLessons = courses.reduce((n, c) => n + c.chapters.reduce((m, ch) => m + ch.lessons.length, 0), 0);
  const heroCourse = resumeTarget ? courses.find((c) => c.title === resumeTarget?.courseTitle) ?? courses[0] : courses[0];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 pb-28 pt-6 sm:px-6">
      {/* پنل وضعیت: تک‌رنگ با بافت توری + گیج تخت */}
      <section className="relative overflow-hidden rounded-2xl bg-primary p-6 text-primary-foreground shadow-card sm:p-8">
        <div aria-hidden className="pattern-quilt absolute inset-0" />
        <div className="relative flex flex-col items-start gap-7 sm:flex-row sm:items-center">
          <div className="flex-1 space-y-2.5 min-w-0">
            <p className="text-sm font-medium text-primary-foreground/70">{greeting}</p>
            <h1 className="text-2xl font-bold leading-relaxed sm:text-[28px]">استادت منتظرته؛ بیا ادامه بدهیم</h1>
            <div className="flex flex-wrap gap-2 pt-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur"><BookOpen className="h-3.5 w-3.5 text-bronze" />{fa(courses.length)} درس فعال</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur"><Flame className="h-3.5 w-3.5 text-bronze" />استریک {fa(streak.count)} روز</span>
              <span className="hidden items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur sm:inline-flex"><Layers3 className="h-3.5 w-3.5 text-bronze" />{fa(totalLessons)} جلسه در {fa(courses.length)} کتاب</span>
            </div>
          </div>
          <div className="rounded-2xl bg-white/10 p-2">
            <Donut value={lessonProgressOf(heroCourse, progress)} size={116} stroke={10} label={heroCourse.title} flat />
          </div>
        </div>
      </section>

      {/* دکمه ادامه یادگیری */}
      {resumeTarget && (
        <button
          onClick={() => navigate({ view: "learn", id: resumeTarget.lesson.id })}
          className="group w-full rounded-2xl border border-border bg-card p-5 text-start shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-bronze/60 sm:p-6"
        >
          <span className="flex items-center justify-between gap-4">
            <span className="space-y-1">
              <span className="block text-xs font-medium text-bronze">{resumeTarget.courseTitle} — جلسهٔ بعدی</span>
              <span className="block text-lg font-bold">{resumeTarget.lesson.title}</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform duration-200 group-hover:-translate-x-1">
              <PlayCircle className="h-[18px] w-[18px]" />
              ادامه یادگیری
            </span>
          </span>
        </button>
      )}

      {/* کارت‌های درس */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-bold"><BookOpen className="h-5 w-5 text-bronze" /> درس‌های تو</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {courses.map((c) => {
            const p = lessonProgressOf(c, progress);
            return (
              <button
                key={c.id}
                onClick={() => navigate({ view: "course", id: c.id })}
                className="group rounded-2xl border border-border bg-card p-5 text-start shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-bronze/50"
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="relative grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-105">
                    <CourseIcon icon={c.icon} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{c.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.tagline}</p>
                  </div>
                  <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-all duration-200 group-hover:-translate-x-0.5 group-hover:text-bronze" />
                </div>
                <ProgressBar value={p} />
                <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{fa(p)}٪ تکمیل شده</span>
                  <span>{fa(c.chapters.reduce((n, x) => n + x.lessons.length, 0))} جلسه — {fa(c.chapters.length)} فصل</span>
                </div>
              </button>
            );
          })}

          {/* درس‌های آینده */}
          {["حقوق مدنی ۲", "حقوق کیفری ۱"].map((t) => (
            <div key={t} aria-disabled className="relative select-none rounded-2xl border border-dashed border-border/80 bg-card/40 p-5 opacity-55 blur-[0.3px]">
              <span className="absolute start-4 top-4 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">به‌زودی</span>
              <div className="mb-3 mt-4 flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-muted text-muted-foreground"><Clock3 className="h-5 w-5" /></span>
                <div>
                  <p className="font-bold text-muted-foreground">{t}</p>
                  <p className="text-xs text-muted-foreground">در حال آماده‌سازی محتوای تدریس</p>
                </div>
              </div>
              <ProgressBar value={0} />
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><CircleDotSm /> هنوز آغاز نشده</div>
            </div>
          ))}
        </div>
      </section>

      {/* اساتید پیشنهادی — مثل پیشنهادهای اینستاگرام؛ فالو کن و مطالبشان را ببین */}
      <TeacherSuggestions />

      {/* آخرین مطالب اساتیدی که دنبال می‌کنی */}
      <TeacherFeedTeasers />

      {/* نقشهٔ پیشرفت — همهٔ کتاب‌ها روی یک تخته */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">نقشهٔ پیشرفت تو</h2>
          <span className="text-[11.5px] text-muted-foreground">هر قطعه یک فصل است؛ رنگِ پر یعنی جلسات خوانده‌شدهٔ آن فصل</span>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          {courses.map((c, ci) => {
            const done = doneCountOf(c, progress);
            const total = c.chapters.reduce((n, x) => n + x.lessons.length, 0);
            const np = nextPending(c, progress);
            return (
              <button
                key={c.id}
                onClick={() => navigate({ view: "course", id: c.id })}
                className={`group w-full p-5 text-start transition-colors hover:bg-muted/25 ${ci > 0 ? "border-t border-dashed border-border" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-105">
                    <CourseIcon icon={c.icon} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{c.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {fa(done)} از {fa(total)} جلسه{np ? <> · ادامه از «{np.title}»</> : " · این کتاب تمام شد؛ آفرین!"}
                    </p>
                  </div>
                  <span className="shrink-0 font-display text-sm font-bold text-bronze">{fa(lessonProgressOf(c, progress))}٪</span>
                  <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-all duration-200 group-hover:-translate-x-0.5 group-hover:text-bronze" />
                </div>

                {/* نوار فصلی — هر قطعه به عرضِ تعداد جلسات آن فصل */}
                <div aria-hidden className="mt-3.5 flex h-[9px] gap-[3px]">
                  {[...c.chapters].sort((a, b) => a.order - b.order).map((ch) => {
                    const d = ch.lessons.filter((l) => progress[l.id]?.status === "completed").length;
                    const ratio = Math.round((d / Math.max(1, ch.lessons.length)) * 100);
                    const allDone = d === ch.lessons.length;
                    const started = d > 0 && !allDone;
                    return (
                      <span
                        key={ch.id}
                        title={`فصل ${ch.order}: ${ch.title} — ${fa(d)} از ${fa(ch.lessons.length)} جلسه`}
                        className="relative h-full overflow-hidden rounded-full bg-border/70"
                        style={{ flexGrow: ch.lessons.length, flexBasis: 0 }}
                      >
                        <span
                          className={`absolute inset-y-0 start-0 block rounded-full transition-all duration-500 ${allDone ? "bg-success" : "bg-gradient-to-l from-bronze to-primary"}`}
                          style={{ width: `${ratio}%`, opacity: started || allDone ? 1 : 0 }}
                        />
                      </span>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ردپای آمار پایین */}
      <section className="flex flex-wrap items-center justify-center gap-2 pt-1">
        <StatChip icon={Sparkles}>برای استریک امروز کافیست یک جلسه را تمام کنی</StatChip>
      </section>
    </div>
  );
}

function CircleDotSm() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <circle cx="5" cy="5" r="3.6" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/* ═══ اساتید — پیشنهاد اینستاگرامی + فید مطالب ═════════════════════════════ */

function DiamondAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-8 w-8 text-[12px]" : "h-11 w-11 text-[15px]";
  return (
    <span className={`relative grid ${cls} shrink-0 rotate-45 place-items-center rounded-[10px] bg-gradient-to-bl from-primary/90 to-bronze shadow-card`}>
      <span className="-rotate-45 font-display font-bold leading-none text-primary-foreground">{name.slice(0, 1)}</span>
    </span>
  );
}

/** ردیف پیشنهاد اساتید با کارت‌های لوزی‌محور (بدون قاب مستطیلی) */
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
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><GraduationCap className="h-5 w-5 text-bronze" /> اساتید همیار</h2>
        <p className="text-sm text-muted-foreground">در حال دریافت فهرست اساتید…</p>
      </section>
    );
  }
  if (!teachers.length) return null;

  const suggestions = teachers.filter((t) => !t.isFollowing).slice(0, 6);
  const following = teachers.filter((t) => t.isFollowing);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold"><GraduationCap className="h-5 w-5 text-bronze" /> اساتید همیار</h2>
        <button onClick={() => navigate({ view: "teachers" })} className="text-xs font-semibold text-bronze hover:underline">
          دیدن همه و دوره‌هایشان ←
        </button>
      </div>

      {!user && (
        <p className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-card px-4 py-2.5 text-xs text-muted-foreground">
          <LogIn className="h-4 w-4 shrink-0 text-bronze" />
          برای دنبال کردن اساتید و مشاهدهٔ مطالبشان، وارد حساب شو یا حساب بساز.
        </p>
      )}
      {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>}

      {/* کارت‌های افقی قابل پیمایش */}
      <div className="-mx-1 flex gap-3 overflow-x-auto pb-1.5 px-1 [scrollbar-width:thin]">
        {[...suggestions, ...following].map((t) => (
          <div key={t.id} className="group relative min-w-[188px] flex-1 rounded-2xl border border-border bg-card p-4 pt-5 text-center shadow-card transition-colors hover:border-bronze/50">
            <span aria-hidden className="absolute -top-[7px] start-1/2 h-px w-14 -translate-x-1/2 rtl:translate-x-1/2 bg-gradient-to-l from-transparent via-bronze/60 to-transparent" />
            <div className="mx-auto mb-3 w-fit" aria-hidden>
              <DiamondAvatar name={t.displayName} />
            </div>
            <p className="truncate font-display text-[13.5px] font-bold">{t.displayName}</p>
            <p className="truncate text-[10.5px] text-muted-foreground">@{t.username}</p>
            <p className="mt-1 text-[10.5px] text-muted-foreground">
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
      </div>
    </section>
  );
}

/** تیزرهای آخرین مطالب اساتیدی که دنبال می‌شوند (+ همه اگر کسی دنبال نشده) */
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
          <button
            key={p.id}
            onClick={() => navigate({ view: "post", id: p.id })}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 text-start shadow-card transition-all hover:-translate-y-0.5 hover:border-bronze/50 sm:p-5"
          >
            <div className="mb-2.5 flex items-center gap-2.5">
              <DiamondAvatar name={p.author.displayName} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-bold">{p.author.displayName}</span>
                <span className="block text-[10px] text-muted-foreground">{faDate(p.createdAt)}</span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                <MessageCircle className="h-3 w-3" /> {fa(p.commentsCount)}
              </span>
            </div>
            <p className="font-display line-clamp-1 text-[15px] font-bold group-hover:text-bronze">{p.title}</p>
            {p.summary && <p className="line-clamp-2 mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{p.summary}</p>}
          </button>
        ))}
      </div>
    </section>
  );
}
