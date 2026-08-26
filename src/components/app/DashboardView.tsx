"use client";

import * as React from "react";
import { PlayCircle, Clock3, CheckCircle2, CircleDot, Sparkles, BookOpen } from "lucide-react";
import { builtinCourses } from "@/lib/law/courses";
import type { Course, Lesson } from "@/lib/law/types";
import { useApp } from "@/lib/store";
import { fa, pct } from "@/lib/fa";
import { navigate } from "@/lib/router";
import { Donut, ProgressBar, CourseIcon } from "./common";

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
    if (h < 12) return "صبح‌ بخیر، حق‌جو عزیز";
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
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 pb-16 pt-6 sm:px-6">
      {/* خوش‌آمد + پیشرفت کلی */}
      <section className="flex flex-col items-start gap-6 rounded-2xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:p-8">
        <div className="flex-1 space-y-2">
          <p className="text-sm text-muted-foreground">{greeting}</p>
          <h1 className="text-2xl font-bold leading-relaxed sm:text-3xl">استادت منتظرته؛ بیا ادامه بدهیم</h1>
          <div className="flex flex-wrap items-center gap-3 pt-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1"><BookOpen className="h-4 w-4 text-bronze" />{fa(courses.length)} درس فعال</span>
            <span className="inline-flex items-center gap-1"><Sparkles className="h-4 w-4 text-bronze" />استریک {fa(streak.count)} روز</span>
          </div>
        </div>
        <Donut value={lessonProgressOf(courses[0], progress)} label="حقوق مدنی ۱" />
      </section>

      {/* دکمه ادامه یادگیری */}
      {resumeTarget && (
        <button
          onClick={() => navigate({ view: "learn", id: resumeTarget.lesson.id })}
          className="group flex w-full items-center justify-between gap-4 rounded-2xl bg-primary px-6 py-5 text-start text-primary-foreground transition-all hover:opacity-[.97] active:scale-[.99]"
        >
          <span className="space-y-1">
            <span className="block text-sm opacity-80">{resumeTarget.courseTitle} — جلسهٔ بعدی</span>
            <span className="block text-lg font-bold">{resumeTarget.lesson.title}</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white/10 px-4 py-2 font-semibold backdrop-blur transition-transform group-hover:-translate-x-1">
            <PlayCircle className="h-5 w-5" />
            ادامه یادگیری از جایی که مانده‌اید
          </span>
        </button>
      )}

      {/* کارت‌های درس */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold">درس‌های تو</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {courses.map((c) => {
            const p = lessonProgressOf(c, progress);
            return (
              <button
                key={c.id}
                onClick={() => navigate({ view: "course", id: c.id })}
                className="rounded-2xl border border-border bg-card p-5 text-start shadow-sm transition-all hover:border-bronze/50 hover:shadow-md"
              >
                <div className="mb-3 flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <CourseIcon icon={c.icon} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{c.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.tagline}</p>
                  </div>
                </div>
                <ProgressBar value={p} />
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{fa(p)}٪ تکمیل شده</span>
                  <span>{fa(c.chapters.reduce((n, x) => n + x.lessons.length, 0))} جلسه — {fa(c.chapters.length)} فصل</span>
                </div>
              </button>
            );
          })}

          {/* درس‌های آینده */}
          {["حقوق مدنی ۲", "حقوق کیفری ۱"].map((t) => (
            <div key={t} aria-disabled className="rounded-2xl border border-border/60 bg-card/50 p-5 opacity-50 select-none blur-[0.3px]">
              <div className="mb-3 flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-muted text-muted-foreground"><Clock3 className="h-5 w-5" /></span>
                <div>
                  <p className="font-bold text-muted-foreground">{t}</p>
                  <p className="text-xs text-muted-foreground">در حال آماده‌سازی محتوای تدریس</p>
                </div>
              </div>
              <ProgressBar value={0} />
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><CircleDot className="h-3.5 w-3.5" /> به‌زودی</div>
            </div>
          ))}
        </div>
      </section>

      {/* نقشه راه فصل‌های درس فعال */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold">نقشه راه فصل‌ها — حقوق مدنی ۱</h2>
        <ol className="relative space-y-4 border-s border-dashed border-border ps-6">
          {builtinCourses[0].chapters.map((ch, i) => {
            const doneCount = ch.lessons.filter((l) => progress[l.id]?.status === "completed").length;
            const allDone = doneCount === ch.lessons.length;
            return (
              <li key={ch.id} className="relative">
                <span className={`absolute -start-[31px] top-1.5 grid h-4 w-4 place-items-center rounded-full border ${allDone ? "border-success bg-success text-primary-foreground" : "border-bronze bg-background"}`}>
                  {allDone ? <CheckCircle2 className="h-3 w-3 text-primary-foreground" /> : null}
                </span>
                <button onClick={() => navigate({ view: "course", id: "madani-1" })} className="w-full rounded-xl px-3 py-2 text-start transition-colors hover:bg-muted">
                  <p className="font-semibold">فصل {fa(i + 1)}: {ch.title}</p>
                  <p className="text-xs text-muted-foreground">{ch.subtitle} — {fa(doneCount)} از {fa(ch.lessons.length)} جلسه</p>
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
