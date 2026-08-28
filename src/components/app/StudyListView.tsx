"use client";

/* ═══ فهرست مطالعه — صفحهٔ میان‌بُر منظم بین خانه و درس/دوره ═══════════════════
 * کاربر وقتی از یک درس یا دوره «بازگشت» می‌زند به همین صفحه می‌رسد: لیست مرتبِ
 * نام دوره‌ها و درس‌هایشان. از همین صفحه هم بازگشت یعنی خانه (AppShell).
 * ──────────────────────────────────────────────────────────────────────────── */
import * as React from "react";
import {
  BookOpen, ChevronDown, GraduationCap, ListTree, PlayCircle, Timer,
  ClipboardList, CheckCircle2, CircleDot, LibraryBig,
} from "lucide-react";
import type { Course } from "@/lib/law/types";
import { useApp } from "@/lib/store";
import { mergeVisible } from "@/lib/books";
import { fa, pct } from "@/lib/fa";
import { navigate } from "@/lib/router";
import { CourseIcon } from "./common";

function courseStats(course: Course, progress: Record<string, { status?: string }>) {
  const flat = course.chapters.flatMap((c) => c.lessons);
  let done = 0;
  flat.forEach((l) => {
    if (progress[l.id]?.status === "completed") done += 1;
    else if (progress[l.id]) done += 0.5;
  });
  return {
    lessons: flat.length,
    percent: pct(done, Math.max(1, flat.length)),
    doneAll: flat.length > 0 && done >= flat.length,
  };
}

export function StudyListView() {
  const custom = useApp((s) => s.customCourses);
  const tBooks = useApp((s) => s.tBooks);
  const hiddenBuiltins = useApp((s) => s.hiddenBuiltins);
  const progress = useApp((s) => s.progress);
  const lastLessonId = useApp((s) => s.lastLocation.lessonId);

  const courses = React.useMemo(
    () => mergeVisible({ customCourses: custom, tBooks, hiddenBuiltins }),
    [custom, tBooks, hiddenBuiltins],
  );

  // دورهٔ محل آخرین مطالعه به‌صورت پیش‌فرض باز است
  let recentId: string | null = null;
  let recentLessonTitle: { course: Course; title: string } | null = null;
  if (lastLessonId) {
    outer: for (const c of courses)
      for (const ch of c.chapters)
        for (const l of ch.lessons)
          if (l.id === lastLessonId) {
            recentId = c.id;
            recentLessonTitle = { course: c, title: l.title };
            break outer;
          }
  }

  const [openId, setOpenId] = React.useState<string | null>(recentId);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 pb-28 pt-4 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><ListTree className="h-6 w-6" /></span>
            فهرست مطالعه
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            همهٔ دوره‌ها و درس‌هایت یک‌جا و منظم — هر دوره را باز کن و از همان‌جا سر جلسه برو.
          </p>
        </div>
        <p className="text-xs font-semibold text-muted-foreground">
          {fa(courses.length)} دوره · {fa(courses.reduce((n, c) => n + c.chapters.reduce((m, x) => m + x.lessons.length, 0), 0))} جلسه
        </p>
      </header>

      {/* ادامهٔ آخرین جلسه — میان‌بر مستقیم */}
      {recentLessonTitle && (
        <button
          onClick={() => navigate({ view: "learn", id: lastLessonId! })}
          className="flex w-full items-center gap-3 rounded-2xl border border-primary/25 bg-primary/[0.06] p-4 text-start shadow-card transition-colors hover:border-primary/50"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><PlayCircle className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10.5px] font-bold text-muted-foreground">ادامه از جایی که رها کردی</span>
            <span className="block truncate text-[13px] font-extrabold">{recentLessonTitle.title}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{recentLessonTitle.course.title}</span>
          </span>
          <PlayCircle className="h-5 w-5 shrink-0 text-bronze/70" />
        </button>
      )}

      {courses.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center shadow-card">
          <LibraryBig className="mx-auto mb-3 h-10 w-10 text-bronze/70" />
          <p className="text-sm font-bold">هنوز دوره‌ای در فهرست مطالعه‌ات نیست</p>
          <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
            از «کتابخانهٔ عمومی» دوره‌های آماده را به کتابخانه‌ات بیفزای یا از «اساتید و مقالات» دورهٔ استادها را بردار.
          </p>
          <button
            onClick={() => navigate({ view: "library" })}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground transition-transform active:scale-[.98]"
          >
            <BookOpen className="h-4 w-4" /> رفتن به کتابخانهٔ عمومی
          </button>
        </div>
      )}

      {/* فهرست مطالعه — ساده و منظم مثل فهرست کتاب: هر دوره یک ردیف با جداکننده، بدون جعبه */}
      <div className="divide-y divide-border/80">
        {courses.map((c) => {
          const st = courseStats(c, progress);
          const isOpen = openId === c.id;
          const owner = (c as Course & { _ownerUsername?: string })._ownerUsername;
          const isPrep = (c as Course & { _status?: string })._status === "prep";
          return (
            <section key={c.id} className="py-1">
              {/* ردیف دوره — div با نقش دکمه (داخلش دکمهٔ «صفحهٔ دوره» داریم) */}
              <div
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                onClick={() => setOpenId(isOpen ? null : c.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenId(isOpen ? null : c.id); } }}
                className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-3 text-start transition-colors hover:bg-accent/40"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center">
                  <CourseIcon icon={c.icon} className="h-5 w-5 text-bronze" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-[15px] font-extrabold">{c.title}</span>
                    {owner && <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-muted-foreground"><GraduationCap className="h-3 w-3 text-bronze" />استاد {owner}</span>}
                    {isPrep && <span className="shrink-0 rounded-full bg-amber-400/95 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-950">آماده‌سازی</span>}
                    {st.doneAll && <span className="shrink-0 rounded-full bg-success/15 px-1.5 py-0.5 text-[9px] font-extrabold text-success">تکمیل شد</span>}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{c.tagline || c.description}</span>
                  <span className="mt-0.5 block text-[10.5px] font-semibold text-muted-foreground/80">
                    {fa(c.chapters.length)} فصل · {fa(st.lessons)} جلسه · پیشرفت {fa(st.percent)}٪
                  </span>
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate({ view: "course", id: c.id }); }}
                  title={`صفحهٔ دوره «${c.title}»`}
                  className="hidden shrink-0 rounded-lg px-2 py-1.5 text-[10.5px] font-bold text-muted-foreground transition-colors hover:bg-bronze/10 hover:text-bronze sm:block"
                >
                  صفحهٔ دوره
                </button>
                <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180 text-bronze" : ""}`} />
              </div>

              {/* درس‌ها به تفکیک فصل — تورفتگی درختی مثل فهرست مطالب */}
              {isOpen && (
                <div className="space-y-4 pb-4 pe-2 ps-[3.25rem] pt-1">
                  {c.chapters.map((ch) => (
                    <div key={ch.id} className="border-s-2 border-border/70 ps-4">
                      <p className="mb-1 flex items-center gap-1.5 text-[11.5px] font-extrabold text-bronze">
                        <BookOpen className="h-3.5 w-3.5" /> {ch.title}
                        <span className="font-semibold text-muted-foreground/70">({fa(ch.lessons.length)} جلسه)</span>
                      </p>
                      <ul className="space-y-0.5">
                        {ch.lessons.map((l, i) => {
                          const p = progress[l.id];
                          return (
                            <li key={l.id}>
                              <button
                                onClick={() => navigate({ view: "learn", id: l.id })}
                                className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-start transition-colors hover:bg-accent/60"
                              >
                                {p?.status === "completed" ? (
                                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                                ) : p ? (
                                  <CircleDot className="h-4 w-4 shrink-0 text-bronze" />
                                ) : (
                                  <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-border font-display text-[9px] text-muted-foreground">{fa(i + 1)}</span>
                                )}
                                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium group-hover:text-primary">{l.title}</span>
                                <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground"><Timer className="h-3 w-3" />{fa(l.minutes ?? 15)}′</span>
                                {l.quiz.length > 0 && (
                                  <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground"><ClipboardList className="h-3 w-3" />{fa(l.quiz.length)}</span>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
