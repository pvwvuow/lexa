"use client";

import * as React from "react";
import { PlayCircle, Clock3, CheckCircle2, Sparkles, BookOpen, Layers3, Flame, ArrowLeft } from "lucide-react";
import { builtinCourses } from "@/lib/law/courses";
import type { Course, Lesson } from "@/lib/law/types";
import { useApp } from "@/lib/store";
import { fa, pct } from "@/lib/fa";
import { navigate } from "@/lib/router";
import { Donut, ProgressBar, CourseIcon, StatChip } from "./common";

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

export function DashboardView() {
  const progress = useApp((s) => s.progress);
  const last = useApp((s) => s.lastLocation);
  const streak = useApp((s) => s.streak);
  const customCourses = useApp((s) => s.customCourses);
  const courses = [...builtinCourses, ...customCourses];

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
    const m1 = courses[0];
    outer2: for (const ch of m1.chapters) {
      for (const l of ch.lessons)
        if (!progress[l.id]?.status) { resumeTarget = { courseTitle: m1.title, lesson: l }; break outer2; }
    }
  }

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
              <span className="hidden items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur sm:inline-flex"><Layers3 className="h-3.5 w-3.5 text-bronze" />{fa(builtinCourses[0].chapters.length)} فصل مدنی ۱</span>
            </div>
          </div>
          <div className="rounded-2xl bg-white/10 p-2">
            <Donut value={lessonProgressOf(courses[0], progress)} size={116} stroke={10} label="حقوق مدنی ۱" flat />
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

      {/* نقشه راه فصل‌ها */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold">نقشه راه فصل‌ها — حقوق مدنی ۱</h2>
        <ol className="relative space-y-3 ps-9">
          <span aria-hidden className="absolute bottom-4 top-4 w-px bg-gradient-to-b from-bronze/50 via-border to-transparent" style={{ insetInlineStart: "13px" }} />
          {builtinCourses[0].chapters.map((ch, i) => {
            const doneCount = ch.lessons.filter((l) => progress[l.id]?.status === "completed").length;
            const allDone = doneCount === ch.lessons.length;
            const some = doneCount > 0 && !allDone;
            return (
              <li key={ch.id} className="relative">
                <span className={`absolute -start-9 top-3 grid h-7 w-7 place-items-center rounded-lg border text-[11px] font-bold shadow-card ${allDone ? "border-success/50 bg-success text-white" : some ? "border-bronze/50 bg-bronze/15 text-bronze" : "border-border bg-card text-muted-foreground"}`} style={{ insetInlineStart: "-36px" }}>
                  {allDone ? <CheckCircle2 className="h-4 w-4" /> : fa(i + 1)}
                </span>
                <button onClick={() => navigate({ view: "course", id: "madani-1" })} className="w-full rounded-xl border border-transparent px-3 py-2.5 text-start transition-all duration-150 hover:border-border hover:bg-card hover:shadow-card">
                  <p className="font-semibold">فصل {fa(i + 1)}: {ch.title}</p>
                  <p className="text-xs text-muted-foreground">{ch.subtitle} — {fa(doneCount)} از {fa(ch.lessons.length)} جلسه</p>
                </button>
              </li>
            );
          })}
        </ol>
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
