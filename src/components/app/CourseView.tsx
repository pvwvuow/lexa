"use client";

import * as React from "react";
import { ChevronDown, CheckCircle2, CircleDot, Timer, ClipboardList, Sparkles } from "lucide-react";
import type { Course } from "@/lib/law/types";
import { builtinCourses } from "@/lib/law/courses";
import { useApp } from "@/lib/store";
import { fa } from "@/lib/fa";
import { navigate } from "@/lib/router";
import { CourseIcon, ProgressBar } from "./common";

export function CourseView({ id }: { id: string }) {
  const custom = useApp((s) => s.customCourses);
  const progress = useApp((s) => s.progress);
  const openLesson = useApp((s) => s.openLesson);
  const [openCh, setOpenCh] = React.useState<string | null>(null);

  const course: Course | undefined = [...builtinCourses, ...custom].find((c) => c.id === id);
  if (!course) return <p className="p-10 text-center text-muted-foreground">درس پیدا نشد.</p>;

  const allLessons = course.chapters.flatMap((c) => c.lessons);
  const doneCount = allLessons.filter((l) => progress[l.id]?.status === "completed").length;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 pb-16 pt-6 sm:px-6">
      {/* سربرگ درس */}
      <header className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
        <div aria-hidden className="absolute -end-10 -top-10 h-36 w-36 rounded-full border border-bronze/15" />
        <div aria-hidden className="absolute -end-4 -top-4 h-16 w-16 rounded-full border border-bronze/10" />
        <div className="relative flex items-start gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
            <CourseIcon icon={course.icon} className="h-7 w-7" />
          </span>
          <div className="flex-1 space-y-1">
            <h1 className="text-2xl font-bold">{course.title}</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">{course.description}</p>
            {course.sourceLabel && (
              <p className="pt-1 text-xs text-bronze">منبع: {course.sourceLabel}</p>
            )}
          </div>
        </div>
        <div className="relative mt-5">
          <ProgressBar value={(doneCount / Math.max(1, allLessons.length)) * 100} />
          <p className="mt-2 text-xs text-muted-foreground">{fa(doneCount)} از {fa(allLessons.length)} جلسه تکمیل شده</p>
        </div>
      </header>

      {/* فصل‌ها — آکاردئون */}
      <div className="space-y-3">
        {course.chapters.map((ch) => {
          const isOpen = openCh === ch.id;
          const chDone = ch.lessons.filter((l) => progress[l.id]?.status === "completed").length;
          return (
            <section key={ch.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-colors hover:border-bronze/30">
              <button
                onClick={() => setOpenCh(isOpen ? null : ch.id)}
                aria-expanded={isOpen}
                className={`flex w-full items-center gap-3 p-4 transition-colors sm:p-5 ${isOpen ? "bg-accent/50" : ""}`}
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl font-display text-sm font-bold ${chDone === ch.lessons.length ? "bg-success/15 text-success ring-1 ring-inset ring-success/30" : "bg-primary/10 text-primary"}`}>
                  {fa(ch.order)}
                </span>
                <span className="flex-1 text-start">
                  <span className="block font-bold">{ch.title}</span>
                  <span className="block text-xs text-muted-foreground">{ch.subtitle}</span>
                </span>
                <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
              </button>

              {isOpen && (
                <ul className="divide-y divide-border border-t border-border">
                  {ch.lessons.map((l, i) => {
                    const p = progress[l.id];
                    const aiPending = l.status === "ai-pending";
                    return (
                      <li key={l.id}>
                        <button
                          onClick={() => {
                            if (!aiPending) openLesson(l.id);
                            navigate(aiPending ? { view: "learn", id: l.id } : { view: "learn", id: l.id });
                          }}
                          className="group flex w-full items-center gap-3 px-4 py-3.5 text-start transition-all duration-150 hover:bg-accent/60 sm:px-6"
                        >
                          {p?.status === "completed" ? (
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                          ) : p ? (
                            <CircleDot className="h-5 w-5 shrink-0 text-bronze" />
                          ) : (
                            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-border font-display text-[10px] text-muted-foreground">{fa(i + 1)}</span>
                          )}
                          <span className="flex-1 min-w-0">
                            <span className="block truncate font-medium group-hover:text-primary">{l.title}</span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1"><Timer className="h-3 w-3" />{fa(l.minutes ?? 15)} دقیقه</span>
                              {!aiPending && l.quiz.length > 0 && (
                                <span className="inline-flex items-center gap-1"><ClipboardList className="h-3 w-3" />{fa(l.quiz.length)} تست</span>
                              )}
                              {aiPending && (
                                <span className="inline-flex items-center gap-1 text-bronze"><Sparkles className="h-3 w-3" />تولید هوشمند هنگام ورود</span>
                              )}
                              {p?.quizBest != null && <span>بهترین تست: {fa(p.quizBest)}٪</span>}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
