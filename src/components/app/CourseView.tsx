"use client";

import * as React from "react";
import { ChevronDown, CheckCircle2, CircleDot, Timer, ClipboardList, Sparkles, GraduationCap, Loader2, Star, WifiOff } from "lucide-react";
import type { Course } from "@/lib/law/types";
import { builtinCourses } from "@/lib/law/courses";
import { useApp } from "@/lib/store";
import { mergeVisible } from "@/lib/books";
import { fa } from "@/lib/fa";
import { navigate } from "@/lib/router";
import { CourseIcon, ProgressBar, StarRating, UserAvatar } from "./common";
import { useAuth } from "@/lib/auth-client";
import { useTargetRating } from "@/lib/social-client";
import { getOfflineItem } from "@/lib/offline";
import { OfflineDownloadButton, OfflineUpdatedPill } from "./offline-ui";

const BUILTIN_IDS = new Set(builtinCourses.map((b) => b.id));

export function CourseView({ id }: { id: string }) {
  const custom = useApp((s) => s.customCourses);
  const tBooks = useApp((s) => s.tBooks);
  const hiddenBuiltins = useApp((s) => s.hiddenBuiltins);
  const progress = useApp((s) => s.progress);
  const openLesson = useApp((s) => s.openLesson);
  const [openCh, setOpenCh] = React.useState<string | null>(null);

  const local = React.useMemo(
    () => mergeVisible({ customCourses: custom, tBooks, hiddenBuiltins }).find((c) => c.id === id),
    [custom, tBooks, hiddenBuiltins, id],
  );

  // ── دورهٔ استاد که هنوز در کتابخانهٔ من نیست: واکشی فقط‌خواندنی از سرور ──
  // (همان دورهٔ کارت «پروفایل استاد» که با کلیک اینجا باز می‌شود)
  // اگر سرور در دسترس نبود، از نسخهٔ ذخیره‌شدهٔ آفلاین (IndexedDB) می‌خوانیم
  const [remoteCourse, setRemoteCourse] = React.useState<Course | null>(null);
  const [remoteLoading, setRemoteLoading] = React.useState(false);
  const [remoteFailed, setRemoteFailed] = React.useState(false);
  const [offlineUsed, setOfflineUsed] = React.useState(false);

  React.useEffect(() => {
    if (local || remoteCourse || remoteFailed) return;
    let alive = true;
    setRemoteLoading(true);
    const loadOffline = async () => {
      const it = (await getOfflineItem("tcourse", id)) ?? (await getOfflineItem("builtin", id));
      if (!alive) return;
      if (it?.course) {
        setRemoteCourse(it.course as Course);
        setOfflineUsed(true);
      } else {
        setRemoteFailed(true);
      }
    };
    fetch(`/api/tcourses/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { course?: Course } | null) => {
        if (alive && d?.course) setRemoteCourse(d.course);
        else if (alive) void loadOffline();
      })
      .catch(() => { if (alive) void loadOffline(); })
      .finally(() => { if (alive) setRemoteLoading(false); });
    return () => { alive = false; };
  }, [local, remoteCourse, remoteFailed, id]);

  const course: Course | undefined = local ?? remoteCourse ?? undefined;

  // نوع آفلاین: دورهٔ آماده (در باندل) / دورهٔ استاد (کتابخانهای یا پیش‌نمایش سروری)
  // دورههای وارداتی/تولیدی محلی از قبل در دستگاه‌اند و دکمه لازم ندارند
  const offlineKind: "builtin" | "tcourse" | null = BUILTIN_IDS.has(id)
    ? "builtin"
    : tBooks.some((t) => t.id === id) || remoteCourse
      ? "tcourse"
      : null;

  if (!course) {
    if (remoteLoading) {
      return (
        <p className="flex items-center justify-center gap-2 p-16 text-sm text-bronze">
          <Loader2 className="h-5 w-5 animate-spin" /> در حال بارگذاری دوره…
        </p>
      );
    }
    return <p className="p-10 text-center text-muted-foreground">درس پیدا نشد.</p>;
  }

  return (
    <CourseBody
      course={course}
      isRemote={!!remoteCourse}
      offlineKind={offlineKind}
      offlineUsed={offlineUsed}
      inLibrary={!!local && !hiddenBuiltins.includes(course.id)}
      progress={progress}
      openCh={openCh}
      setOpenCh={setOpenCh}
      openLesson={openLesson}
    />
  );
}

/* ─── توضیحات دوره — پاراگراف‌بندی مرتب + بولت + جمع‌شدن برای متن‌های بلند ── */

function CourseDescription({ text }: { text: string }) {
  const blocks = React.useMemo(
    () => text.split(/\n/).map((l) => l.trim()).filter(Boolean),
    [text],
  );
  // متن‌های بلند به‌صورت جمع‌شده شروع می‌شوند تا سربرگ دوره شلوغ نشود
  const isLong = text.length > 420 || blocks.length > 8;
  const [expanded, setExpanded] = React.useState(false);

  const renderBlock = (line: string, i: number) => {
    const m = /^([•\-*–])\s*/.exec(line);
    if (m) {
      return (
        <div key={i} className="flex items-start gap-2">
          <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-bronze/80" />
          <span>{line.slice(m[0].length)}</span>
        </div>
      );
    }
    // خط‌هایی که فقط «تیتر بخش» هستند و با «:» تمام می‌شوند — کمی پررنگ‌تر
    if (line.endsWith(":") && line.length < 40) {
      return <p key={i} className="pt-1 font-bold text-foreground/80">{line}</p>;
    }
    return <p key={i}>{line}</p>;
  };

  return (
    <div className="text-sm leading-relaxed text-muted-foreground">
      <div className={`space-y-1.5 ${isLong && !expanded ? "line-clamp-5" : ""}`}>
        {blocks.map(renderBlock)}
      </div>
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 rounded-lg text-xs font-bold text-bronze transition-colors hover:bg-bronze/10"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          {expanded ? "بستن توضیحات" : "مشاهدهٔ کل توضیحات"}
        </button>
      )}
    </div>
  );
}

/* ─── بدنهٔ صفحهٔ دوره — مشترک بین دورهٔ محلی و پیش‌نمایش سروری ─────────── */

function CourseBody({
  course, isRemote, offlineKind, offlineUsed, inLibrary, progress, openCh, setOpenCh, openLesson,
}: {
  course: Course;
  isRemote?: boolean;
  offlineKind: "builtin" | "tcourse" | null;
  offlineUsed?: boolean;
  inLibrary: boolean;
  progress: Record<string, { status?: string; quizBest?: number }>;
  openCh: string | null;
  setOpenCh: (v: string | null) => void;
  openLesson: (id: string) => void;
}) {
  const auth = useAuth();
  const owner = (course as Course & { _ownerUsername?: string })._ownerUsername;
  const ownerAvatar = (course as Course & { _ownerAvatar?: string | null })._ownerAvatar;
  const status = (course as Course & { _status?: string })._status;

  // امتیاز ستاره‌ای برای دوره‌های استاد — از هر جای برنامه قابل رأی دادن است
  const rate = useTargetRating("tcourse", isRemote ? course.id : null);

  const allLessons = course.chapters.flatMap((c) => c.lessons);
  const doneCount = allLessons.filter((l) => progress[l.id]?.status === "completed").length;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 pb-16 pt-6 sm:px-6">
      {/* نشان نسخهٔ آفلاین */}
      {offlineUsed && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-400/10 px-4 py-2.5 text-xs font-bold text-amber-700 dark:text-amber-400">
          <WifiOff className="h-3.5 w-3.5 shrink-0" /> در حال دیدن نسخهٔ ذخیره‌شدهٔ آفلاین این دوره هستی.
        </p>
      )}

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
            <CourseDescription text={course.description} />
            {course.sourceLabel && (
              <p className="pt-1 text-xs text-bronze">منبع: {course.sourceLabel}</p>
            )}
            {/* صاحب دورهٔ استاد — کلیک رفتن به پروفایل او */}
            {owner && (
              <button
                onClick={() => navigate({ view: "teacher", id: (course as Course & { _teacherId?: string })._teacherId ?? "" })}
                disabled={!course.id.startsWith("tc-")}
                title="پروفایل استاد"
                className="mt-1 inline-flex w-fit items-center gap-2 rounded-xl px-1 py-0.5 transition-colors hover:bg-muted/60"
              >
                <UserAvatar src={ownerAvatar} name={owner} size="xs" />
                <GraduationCap className="h-3.5 w-3.5 text-bronze" />
                <span className="text-[11.5px] font-bold">{owner}</span>
              </button>
            )}
            {status === "prep" && (
              <p className="mt-1.5 inline-flex w-fit items-center gap-1 rounded-full bg-amber-400/95 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-950">
                <Sparkles className="h-3 w-3" /> این دوره در حال آماده‌سازی است
              </p>
            )}
          </div>
        </div>

        {/* امتیازدهی دورهٔ استاد */}
        {!!isRemote && (
          <div className="relative mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-bronze/25 bg-bronze/[0.05] px-4 py-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-bronze">
              <Star className="h-4 w-4 fill-current" /> امتیاز شما به این دوره
            </span>
            {auth.user ? (
              <StarRating
                value={rate.my ?? rate.agg.avg}
                count={rate.agg.count}
                disabled={rate.busy}
                onChange={(n) => void rate.rate(n)}
                size={20}
              />
            ) : (
              <span className="inline-flex items-center gap-2">
                <StarRating value={rate.agg.avg} count={rate.agg.count} size={14} />
                <span className="text-[11px] text-muted-foreground">برای ثبت امتیاز وارد شو</span>
              </span>
            )}
          </div>
        )}

        {/* دانلود آفلاین این درس — برای همهٔ دوره‌ها: آمادهٔ اپ و دورهٔ استاد */}
        {offlineKind && (
          <div className="relative mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-muted/30 px-4 py-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <WifiOff className="h-4 w-4 shrink-0 text-bronze" />
              {offlineKind === "builtin"
                ? "این جزوه را یک‌جا برای مطالعهٔ آفلاین ذخیره کن"
                : "این دوره را یک‌جا برای مطالعهٔ آفلاین ذخیره کن"}
            </span>
            <span className="ms-auto flex items-center gap-2">
              {offlineKind === "tcourse" && (
                <OfflineUpdatedPill kind="tcourse" id={course.id} serverUpdatedAt={(course as Course & { _updatedAt?: string })._updatedAt} />
              )}
              <OfflineDownloadButton
                kind={offlineKind}
                id={course.id}
                labeled
                serverUpdatedAt={offlineKind === "tcourse" ? (course as Course & { _updatedAt?: string })._updatedAt : undefined}
                courseObj={offlineKind === "builtin" ? course : undefined}
                card={{
                  id: course.id,
                  title: course.title,
                  tagline: course.tagline ?? "",
                  description: course.description ?? "",
                  icon: course.icon,
                  thumbnail: (course as Course & { thumbnail?: string }).thumbnail,
                  lessonsCount: course.chapters?.reduce((n, c) => n + c.lessons.length, 0) ?? 0,
                  teacher: {
                    id: (course as Course & { _teacherId?: string })._teacherId ?? "",
                    username: (course as Course & { _ownerUsername?: string })._ownerUsername ?? "",
                    displayName: (course as Course & { _ownerUsername?: string })._ownerUsername ?? "همیار حقوق",
                    avatarUrl: (course as Course & { _ownerAvatar?: string | null })._ownerAvatar,
                  },
                }}
              />
            </span>
          </div>
        )}

        {!inLibrary && (
          <p className="relative mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            این دوره را به کتابخانهٔ خود اضافه نکرده‌ای؛ پیش‌نمایش فهرست جلسات آزاد است.
            {auth.user && (
              <button
                onClick={async () => {
                  await fetch("/api/library", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ courseId: course.id }),
                  });
                  window.location.reload();
                }}
                className="ms-auto rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-colors hover:brightness-110"
              >
                افزودن به کتابخانهٔ من
              </button>
            )}
          </p>
        )}

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
                            navigate({ view: "learn", id: l.id });
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
