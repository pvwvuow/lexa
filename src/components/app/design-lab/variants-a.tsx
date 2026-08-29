"use client";

/* ═══ نمونه‌های ۱ تا ۳ — طرح فعلی (مرجع) · تمرکز · مسیر یادگیری ═══════════════ */

import * as React from "react";
import {
  PlayCircle, BookOpen, Flame, ArrowLeft, NotebookTabs, Sparkles,
  CheckCircle2, Lock, Flag, Target, Clock3, CircleDot,
} from "lucide-react";
import {
  GREETING, NEXT_TITLE, NEXT_COURSE, NEXT_LESSON, EXAM_TITLE, EXAM_DESC,
  BOOKS_LABEL, STREAK_LABEL, POSTS, POSTS_TITLE,
  LabGoldCta, LabBar, ProgressRing, WeekDots, PostsHeader, LabPostCardMatte,
} from "./shared";

/* ═══ نمونهٔ ۱ — طرح فعلی (مرجع مقایسه) ═════════════════════════════════════ */

export function VariantCurrent() {
  return (
    <div className="p-3 sm:p-5">
      <section
        aria-label="نمونهٔ فعلی خانه"
        className="relative overflow-hidden rounded-[28px] border border-primary-foreground/10 bg-gradient-to-bl from-primary via-primary to-[#123628] p-5 text-primary-foreground shadow-card sm:p-8"
      >
        <div aria-hidden className="pattern-quilt absolute inset-0 opacity-90" />
        <img
          src="/media/hero-law.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover opacity-[0.16] lg:inset-y-0 lg:end-0 lg:start-auto lg:h-full lg:w-[47%] lg:opacity-95 lg:[mask-image:linear-gradient(to_right,black_36%,transparent_97%)]"
        />
        <div aria-hidden className="absolute -top-28 start-1/4 h-64 w-64 rounded-full bg-bronze/25 blur-3xl" />
        <div aria-hidden className="absolute -bottom-32 end-0 h-56 w-56 rounded-full bg-bronze/10 blur-3xl" />

        <div className="relative space-y-6">
          <div className="space-y-3 lg:max-w-[55%]">
            <p className="text-sm font-medium text-primary-foreground/75">{GREETING}</p>
            <h3 className="text-xl font-extrabold leading-relaxed sm:text-2xl">{NEXT_TITLE}</h3>
            <p className="-mt-1.5 text-sm leading-relaxed text-primary-foreground/85">
              <span className="font-semibold text-bronze">{NEXT_COURSE}</span> · {NEXT_LESSON}
            </p>
            <LabGoldCta />
            <div className="flex flex-wrap gap-2 pt-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.13] px-3 py-1 text-xs font-semibold text-white backdrop-blur"><BookOpen className="h-3.5 w-3.5 text-bronze" />{BOOKS_LABEL}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.13] px-3 py-1 text-xs font-semibold text-white backdrop-blur"><Flame className="h-3.5 w-3.5 text-bronze" />{STREAK_LABEL}</span>
            </div>
          </div>

          {/* مرکز آزمون */}
          <div className="feed-card group flex w-full cursor-default items-center gap-3 rounded-2xl px-4 py-3 text-start">
            <span aria-hidden className="grid h-10 w-10 shrink-0 rotate-45 place-items-center rounded-[11px] border border-border bg-primary/5 shadow-card transition-transform duration-200 group-hover:scale-110">
              <NotebookTabs className="h-4.5 w-4.5 -rotate-45 text-bronze" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-extrabold text-foreground">{EXAM_TITLE}</span>
              <span className="block text-[11px] leading-relaxed text-muted-foreground">{EXAM_DESC}</span>
            </span>
            <ArrowLeft aria-hidden className="h-4 w-4 shrink-0 text-bronze transition-transform group-hover:-translate-x-0.5" />
          </div>

          {/* جدیدترین مطالب */}
          <div className="space-y-3" aria-label={POSTS_TITLE}>
            <PostsHeader tone="onGreen" />
            <div className="hslider -mx-1 flex gap-3 overflow-x-auto px-1 pb-1.5 pt-1">
              {POSTS.map((p) => <LabPostCardMatte key={p.id} p={p} className="w-[240px] shrink-0 snap-start sm:w-[268px]" />)}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ═══ نمونهٔ ۲ — «تمرکز» (بلوک سبز بزرگ حذف شد؛ یک حلقه، یک درس، آمار درشت) ══ */

export function VariantFocus() {
  return (
    <div className="p-5 sm:p-7">
      {/* سربرگ ساکت */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-wide text-bronze">دوشنبه · ۵ شهریور</p>
          <p className="mt-0.5 text-sm font-semibold text-muted-foreground">{GREETING}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-bronze/40 bg-bronze/10 px-3 py-1 text-[11px] font-extrabold text-bronze">
          <Target className="h-3.5 w-3.5" />
          هدف امشب: ۴۰ دقیقه
        </span>
      </div>
      <div aria-hidden className="ornament-rule mt-4" />

      {/* حلقهٔ مرور + درس جاری */}
      <div className="mt-6 flex flex-col items-center gap-7 sm:flex-row sm:items-center sm:gap-9">
        <ProgressRing pct={40} gid="lab-ring-focus" className="shrink-0">
          <div className="space-y-0.5">
            <p className="text-2xl font-black leading-none text-foreground">۲<span className="text-base font-bold text-muted-foreground">/۵</span></p>
            <p className="text-[10px] font-bold text-muted-foreground">مرور امشب</p>
          </div>
        </ProgressRing>

        <div className="min-w-0 flex-1 space-y-3 text-center sm:text-start">
          <p className="text-[11px] font-bold tracking-wide text-bronze">درس جاری</p>
          <h3 className="text-[22px] font-extrabold leading-snug text-foreground sm:text-2xl">{NEXT_LESSON}</h3>
          <p className="text-[12.5px] font-semibold text-muted-foreground">
            {NEXT_COURSE} · جلسهٔ ۱۲ از ۲۰
          </p>
          <div className="mx-auto max-w-[280px] sm:mx-0 sm:max-w-none">
            <div className="mb-1 flex items-center justify-between text-[10px] font-bold text-muted-foreground">
              <span>پیشرفت درس</span><span className="tabular-nums text-bronze">۵۸٪</span>
            </div>
            <LabBar pct={58} />
          </div>
          <div className="flex justify-center pt-1 sm:justify-start">
            <LabGoldCta />
          </div>
        </div>
      </div>

      {/* آمار درشت — اعداد بزرگ، حاشیه‌های نازک */}
      <div className="mt-7 grid grid-cols-3 overflow-hidden rounded-2xl border border-border bg-card/60">
        <div className="space-y-1 px-3 py-4 text-center">
          <p className="text-xl font-black tabular-nums text-foreground">۵</p>
          <p className="text-[10.5px] font-semibold text-muted-foreground">درس فعال</p>
        </div>
        <div className="border-s border-border px-3 py-4 text-center">
          <p className="flex items-center justify-center gap-1 text-xl font-black tabular-nums text-foreground">
            ۱<Flame className="h-4 w-4 text-warn" />
          </p>
          <p className="text-[10.5px] font-semibold text-muted-foreground">روز استریک</p>
        </div>
        <div className="border-s border-border px-3 py-4 text-center">
          <p className="text-xl font-black tabular-nums text-foreground">۴۰<span className="text-sm font-bold text-muted-foreground"> دقیقه</span></p>
          <p className="text-[10.5px] font-semibold text-muted-foreground">تا پایان هدف</p>
        </div>
      </div>

      {/* مرکز آزمون — ردیف نازک */}
      <div className="group mt-4 flex cursor-default items-center gap-3 rounded-xl border border-border px-4 py-3 transition-colors hover:border-bronze/50">
        <NotebookTabs className="h-4.5 w-4.5 shrink-0 text-bronze" />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-extrabold text-foreground">{EXAM_TITLE}</span>
          <span className="block truncate text-[10.5px] text-muted-foreground">{EXAM_DESC}</span>
        </span>
        <ArrowLeft aria-hidden className="h-4 w-4 shrink-0 text-bronze transition-transform group-hover:-translate-x-0.5" />
      </div>

      {/* جدیدترین مطالب — فهرست دو خطی ساکت */}
      <div className="mt-6 space-y-2.5">
        <PostsHeader tone="ink" />
        {POSTS.map((p) => (
          <div key={p.id} className="group flex cursor-default items-center gap-3 rounded-xl border border-transparent px-2 py-2 transition-colors hover:border-border">
            <span className={`relative block h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gradient-to-bl ${p.cover}`}>
              <p.Icon className="absolute inset-0 m-auto h-4 w-4 text-white/80" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-1 block text-[12.5px] font-extrabold text-foreground transition-colors group-hover:text-bronze">{p.title}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
                {p.author}<span className="text-bronze">·</span>{p.date}<span className="text-bronze">·</span>{p.mins} دقیقه
              </span>
            </span>
            <ArrowLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-all group-hover:-translate-x-0.5 group-hover:text-bronze" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══ نمونهٔ ۳ — «مسیر یادگیری» (درس‌ها روی یک مسیر + ایستگاه آزمون) ══════════ */

type PathNode = { state: "done" | "current" | "locked"; title: string; sub: string; pct?: number };

const PATH_NODES: PathNode[] = [
  { state: "done", title: "جلسهٔ ۱۰ — بیع؛ اقساط و خیار", sub: "تکمیل شد · آزمون ۸۰٪" },
  { state: "done", title: "جلسهٔ ۱۱ — ضمان و جهد", sub: "تکمیل شد · آزمون ۷۲٪" },
  { state: "current", title: NEXT_LESSON, sub: `${NEXT_COURSE} · جلسهٔ ۱۲ از ۲۰ · ۵۸٪`, pct: 58 },
  { state: "locked", title: "جلسهٔ ۱۳ — خِلال امانت‌دار", sub: "پس از اتمام این درس باز می‌شود" },
  { state: "locked", title: "جلسهٔ ۱۴ — مرور جامع فصل", sub: "قفل" },
];

export function VariantPath() {
  return (
    <div className="p-4 sm:p-6">
      {/* سربرگ: خوش‌آمد + هفتهٔ استریک */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10">
            <Sparkles className="h-4.5 w-4.5 text-bronze" />
          </span>
          <div>
            <p className="text-[13px] font-extrabold text-foreground">{NEXT_TITLE}</p>
            <p className="text-[10.5px] font-semibold text-muted-foreground">{GREETING}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1 text-[10.5px] font-extrabold text-warn">
            <Flame className="h-3.5 w-3.5" />{STREAK_LABEL}
          </span>
          <WeekDots done={2} today={2} />
        </div>
      </div>

      <div className="mt-6 grid items-start gap-7 lg:grid-cols-[1fr,290px]">
        {/* مسیر */}
        <div className="relative">
          <p className="mb-4 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-bronze">
            <CircleDot className="h-3.5 w-3.5" />مسیر «ودیعه و عاریه» — {BOOKS_LABEL}
          </p>
          <ol className="relative">
            {PATH_NODES.map((n, i) => {
              const last = i === PATH_NODES.length - 1;
              if (n.state === "current")
                return (
                  <li key={i} className="relative flex gap-3.5 pb-5">
                    {!last && <span aria-hidden className="absolute bottom-0 start-[19px] top-10 w-px bg-bronze/50" />}
                    <span aria-hidden className="relative z-10 mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ecd29a] to-[#cda65e] text-[#1b1408] shadow-[0_0_0_5px_rgba(205,166,94,0.2)]">
                      <PlayCircle className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1 rounded-2xl border border-bronze/50 bg-card p-4 shadow-card">
                      <p className="text-[10px] font-bold tracking-wide text-bronze">درس جاری — همان‌جا که رهایش کردی</p>
                      <p className="mt-1 text-[15px] font-extrabold leading-relaxed text-foreground">{n.title}</p>
                      <p className="mt-0.5 text-[10.5px] font-semibold text-muted-foreground">{n.sub}</p>
                      <div className="mt-2.5 flex items-center gap-3">
                        <LabBar pct={n.pct ?? 0} className="flex-1" />
                        <span className="text-[10px] font-extrabold tabular-nums text-bronze">{n.pct}٪</span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                        <LabGoldCta />
                        <span className="inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-semibold text-muted-foreground">
                          <Clock3 className="h-3 w-3" />۴۲ دقیقه باقی‌مانده
                        </span>
                      </div>
                    </div>
                  </li>
                );
              return (
                <li key={i} className="relative flex items-start gap-3.5 pb-5">
                  {!last && <span aria-hidden className={`absolute bottom-0 start-[19px] top-9 w-px ${n.state === "done" ? "bg-primary/50" : "border-s border-dashed border-border"}`} />}
                  <span aria-hidden className={`relative z-10 mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                    n.state === "done"
                      ? "bg-primary text-primary-foreground shadow-card"
                      : "border border-dashed border-border bg-card text-muted-foreground/60"
                  }`}>
                    {n.state === "done" ? <CheckCircle2 className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                  </span>
                  <div className={`min-w-0 flex-1 pt-1.5 ${n.state === "locked" ? "opacity-70" : ""}`}>
                    <p className={`text-[13px] font-extrabold ${n.state === "done" ? "text-foreground" : "text-muted-foreground"}`}>{n.title}</p>
                    <p className="mt-0.5 text-[10.5px] font-semibold text-muted-foreground">{n.sub}</p>
                  </div>
                </li>
              );
            })}

            {/* ایستگاه آزمون */}
            <li className="relative flex items-start gap-3.5">
              <span aria-hidden className="relative z-10 mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-dashed border-bronze/60 bg-bronze/10 text-bronze">
                <Flag className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 flex-1 rounded-2xl border border-dashed border-bronze/50 px-4 py-3">
                <p className="text-[13px] font-extrabold text-foreground">ایستگاه پایانی: {EXAM_TITLE}</p>
                <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted-foreground">{EXAM_DESC}</p>
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-bronze/10 px-2.5 py-0.5 text-[10px] font-extrabold text-bronze">
                  ۱۲ روز مانده
                </span>
              </div>
            </li>
          </ol>
        </div>

        {/* ستون کنار: آزمون + مطالب */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <p className="text-[11px] font-black text-foreground">آمار مسیر</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-primary/5 py-2.5">
                <p className="text-[15px] font-black tabular-nums text-foreground">۱۱</p>
                <p className="text-[9px] font-semibold text-muted-foreground">تکمیل‌شده</p>
              </div>
              <div className="rounded-xl bg-bronze/10 py-2.5">
                <p className="text-[15px] font-black tabular-nums text-bronze">۹</p>
                <p className="text-[9px] font-semibold text-muted-foreground">باقی‌مانده</p>
              </div>
              <div className="rounded-xl bg-amber-400/10 py-2.5">
                <p className="flex items-center justify-center gap-0.5 text-[15px] font-black tabular-nums text-warn">۱<Flame className="h-3 w-3" /></p>
                <p className="text-[9px] font-semibold text-muted-foreground">استریک</p>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <PostsHeader tone="ink" />
            {POSTS.map((p) => (
              <div key={p.id} className="group flex cursor-default gap-3 rounded-2xl border border-border bg-card p-2.5 shadow-card transition-colors hover:border-bronze/40">
                <span className={`relative block h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gradient-to-bl ${p.cover}`}>
                  <p.Icon className="absolute inset-0 m-auto h-4.5 w-4.5 text-white/85" />
                </span>
                <span className="min-w-0 flex-1 py-0.5">
                  <span className="block text-[9.5px] font-bold text-bronze">{p.cat}</span>
                  <span className="line-clamp-2 block text-[11.5px] font-extrabold leading-relaxed text-foreground transition-colors group-hover:text-bronze">{p.title}</span>
                  <span className="mt-0.5 block text-[9.5px] font-semibold text-muted-foreground">{p.author} · {p.date}</span>
                </span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
