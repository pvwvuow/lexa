"use client";

/* ═══ نمونه‌های ۴ تا ۶ — دستیار همیار · بنتو · آزمون‌محور ════════════════════ */

import * as React from "react";
import {
  PlayCircle, BookOpen, Flame, ArrowLeft, NotebookTabs, Sparkles,
  Bot, Timer, ListChecks, Bookmark, Moon, Hourglass, TrendingUp, Target,
} from "lucide-react";
import {
  GREETING, NEXT_TITLE, NEXT_COURSE, NEXT_LESSON, EXAM_TITLE, EXAM_DESC,
  BOOKS_LABEL, STREAK_LABEL, POSTS,
  LabGoldCta, LabBar, WeekDots, PostsHeader, LabPostCardMatte,
} from "./shared";

/* ═══ نمونهٔ ۴ — «دستیار همیار» (بریفینگ شخصی + برنامهٔ پیشنهادی امشب) ═══════ */

export function VariantAssistant() {
  return (
    <div className="p-4 sm:p-6">
      {/* هویت دستیار */}
      <div className="flex items-center gap-3">
        <span aria-hidden className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#ecd29a] via-[#cda65e] to-[#8a6a30] text-[#1b1408] shadow-[0_4px_14px_-4px_rgba(205,166,94,0.7)]">
          <Bot className="h-6 w-6" />
          <span className="absolute -bottom-0.5 -end-0.5 h-3.5 w-3.5 rounded-full border-2 border-card bg-emerald-500" />
        </span>
        <div>
          <p className="text-[15px] font-extrabold text-foreground">همیار</p>
          <p className="flex items-center gap-1 text-[10.5px] font-semibold text-muted-foreground">
            آنلاین · بر پایهٔ روند ۷ شب گذشته‌ات
          </p>
        </div>
        <span className="ms-auto inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-[10.5px] font-bold text-muted-foreground ring-1 ring-border">
          <Moon className="h-3.5 w-3.5 text-bronze" />{GREETING}
        </span>
      </div>

      {/* حباب بریفینگ */}
      <div className="mt-4 rounded-3xl rounded-ss-md border border-border bg-card p-5 shadow-card">
        <p className="text-sm leading-7 text-foreground">
          بر اساس پیشرفتت، امشب فقط <span className="font-black text-bronze">۲۰ دقیقه</span> کافیه تا
          هدف روز کامل بشه. جلسهٔ بعدی‌ات آماده‌ست و پیشنهادم این برنامه‌ست:
        </p>

        {/* برنامهٔ پیشنهادی */}
        <ul className="mt-4 space-y-2">
          <li className="flex items-center gap-3 rounded-xl bg-primary/[0.06] px-3.5 py-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10"><PlayCircle className="h-4 w-4 text-primary" /></span>
            <span className="min-w-0 flex-1 text-[12.5px] font-bold text-foreground">مرور «ودیعه و عاریه» — جلسهٔ ۱۲</span>
            <span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-[10px] font-extrabold text-bronze ring-1 ring-border">۱۵ دقیقه</span>
          </li>
          <li className="flex items-center gap-3 rounded-xl bg-primary/[0.06] px-3.5 py-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-bronze/15"><ListChecks className="h-4 w-4 text-bronze" /></span>
            <span className="min-w-0 flex-1 text-[12.5px] font-bold text-foreground">۱۰ سؤال تستی از «امانت‌ها»</span>
            <span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-[10px] font-extrabold text-bronze ring-1 ring-border">۸ دقیقه</span>
          </li>
          <li className="flex items-center gap-3 rounded-xl bg-primary/[0.06] px-3.5 py-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-400/15"><Bookmark className="h-4 w-4 text-warn" /></span>
            <span className="min-w-0 flex-1 text-[12.5px] font-bold text-foreground">۵ فلش‌کارت «سنگرهای امانت»</span>
            <span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-[10px] font-extrabold text-bronze ring-1 ring-border">۳ دقیقه</span>
          </li>
        </ul>

        {/* CTA */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <LabGoldCta label="شروع برنامهٔ امشب" />
          <span role="presentation" className="inline-flex cursor-default items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-[12.5px] font-bold text-foreground transition-colors hover:border-bronze/50">
            <Timer className="h-4 w-4 text-bronze" />آزمون سریع
          </span>
          <span className="ms-auto text-[10.5px] font-semibold text-muted-foreground">{BOOKS_LABEL} · {STREAK_LABEL}</span>
        </div>
      </div>

      {/* دو ستون: آزمون + مطالبِ بعد از مرور */}
      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr,1.2fr]">
        <div className="group flex cursor-default items-center gap-3 rounded-2xl border border-dashed border-bronze/50 bg-card px-4 py-3.5 shadow-card transition-colors hover:border-bronze">
          <span aria-hidden className="grid h-10 w-10 shrink-0 rotate-45 place-items-center rounded-[11px] border border-bronze/40 bg-bronze/10">
            <NotebookTabs className="h-4.5 w-4.5 -rotate-45 text-bronze" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-extrabold text-foreground">{EXAM_TITLE}</span>
            <span className="block truncate text-[10.5px] text-muted-foreground">{EXAM_DESC}</span>
          </span>
          <ArrowLeft aria-hidden className="h-4 w-4 shrink-0 text-bronze transition-transform group-hover:-translate-x-0.5" />
        </div>

        <div className="space-y-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-bronze">
            <Sparkles className="h-3.5 w-3.5" />برای بعد از مرور
          </p>
          {POSTS.map((p) => (
            <div key={p.id} className="group flex cursor-default items-center gap-3 rounded-2xl border border-border bg-card p-2.5 shadow-card transition-colors hover:border-bronze/40">
              <span className={`relative block h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-gradient-to-bl ${p.cover}`}>
                <p.Icon className="absolute inset-0 m-auto h-4 w-4 text-white/85" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1 block text-[12px] font-extrabold text-foreground transition-colors group-hover:text-bronze">{p.title}</span>
                <span className="mt-0.5 block text-[9.5px] font-semibold text-muted-foreground">{p.author} · {p.date} · {p.mins} دقیقه</span>
              </span>
              <ArrowLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-all group-hover:-translate-x-0.5 group-hover:text-bronze" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══ نمونهٔ ۵ — «بنتو» (کاشی‌کاری نامتقارن؛ هر عدد یک کاشی) ═════════════════ */

const COURSE_BARS = [
  { name: NEXT_COURSE, lesson: "ودیعه و عاریه", pct: 58 },
  { name: "حقوق تجارت", lesson: "بیع؛ اقساط و خیار", pct: 24 },
  { name: "اصول فقه", lesson: "دلالت و اشتراک لفظی", pct: 41 },
];

export function VariantBento() {
  return (
    <div className="p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-4">
        {/* کاشی خوش‌آمد */}
        <div className="flex flex-col justify-between gap-3 rounded-3xl border border-border bg-card p-4 shadow-card">
          <span aria-hidden className="grid h-9 w-9 place-items-center rounded-xl bg-bronze/10">
            <Moon className="h-4.5 w-4.5 text-bronze" />
          </span>
          <p className="text-[12.5px] font-bold leading-relaxed text-foreground">{GREETING}</p>
        </div>

        {/* کاشی جلسهٔ بعدی — بزرگ */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-bl from-primary via-primary to-[#123628] p-5 text-primary-foreground shadow-card sm:col-span-3">
          <div aria-hidden className="pattern-quilt absolute inset-0 opacity-80" />
          <div aria-hidden className="absolute -bottom-16 -start-10 h-44 w-44 rounded-full bg-bronze/20 blur-3xl" />
          <div className="relative flex h-full flex-col justify-between gap-4">
            <div>
              <p className="text-[10.5px] font-bold tracking-wide text-bronze">{NEXT_TITLE}</p>
              <h3 className="mt-1.5 text-xl font-extrabold leading-relaxed sm:text-[22px]">{NEXT_LESSON}</h3>
              <p className="mt-0.5 text-[11.5px] font-semibold text-primary-foreground/70">{NEXT_COURSE} · جلسهٔ ۱۲ از ۲۰ · ۴۲ دقیقه</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <LabGoldCta />
              <div className="min-w-[150px] flex-1 sm:max-w-[220px]">
                <div className="mb-1 flex justify-between text-[9.5px] font-bold text-white/70">
                  <span>پیشرفت</span><span className="tabular-nums text-[#ecd29a]">۵۸٪</span>
                </div>
                <LabBar pct={58} dark />
              </div>
            </div>
          </div>
        </div>

        {/* کاشی استریک */}
        <div className="flex flex-col justify-between gap-3 rounded-3xl border border-border bg-card p-4 shadow-card sm:col-span-2">
          <div className="flex items-center justify-between">
            <span aria-hidden className="grid h-9 w-9 place-items-center rounded-xl bg-amber-400/15">
              <Flame className="h-4.5 w-4.5 text-warn" />
            </span>
            <p className="text-[19px] font-black tabular-nums text-foreground">۱ <span className="text-[11px] font-bold text-muted-foreground">روز</span></p>
          </div>
          <div>
            <p className="text-[11px] font-extrabold text-foreground">هفتهٔ استریک — امشب را کامل کن</p>
            <div className="mt-2.5"><WeekDots done={2} today={2} /></div>
          </div>
        </div>

        {/* کاشی مرکز آزمون — دو دفترچه */}
        <div className="rounded-3xl border border-border bg-card p-4 shadow-card sm:col-span-2">
          <div className="flex items-center gap-2">
            <span aria-hidden className="grid h-9 w-9 place-items-center rounded-xl bg-bronze/10">
              <NotebookTabs className="h-4.5 w-4.5 text-bronze" />
            </span>
            <div>
              <p className="text-[12.5px] font-extrabold text-foreground">{EXAM_TITLE}</p>
              <p className="text-[9.5px] font-semibold text-muted-foreground">دفترچه‌های آماده با پاسخ نمونه</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <span role="presentation" className="cursor-default rounded-xl border border-border bg-background/50 px-3 py-2.5 text-center transition-colors hover:border-bronze/60">
              <span className="block text-[11px] font-extrabold text-foreground">تستی زمان‌سنج</span>
              <span className="mt-0.5 block text-[9px] font-semibold text-muted-foreground">۵۴ سؤال · ۴۵ دقیقه</span>
            </span>
            <span role="presentation" className="cursor-default rounded-xl border border-border bg-background/50 px-3 py-2.5 text-center transition-colors hover:border-bronze/60">
              <span className="block text-[11px] font-extrabold text-foreground">تشریحی</span>
              <span className="mt-0.5 block text-[9px] font-semibold text-muted-foreground">۴۱ سؤال · پاسخ نمونه</span>
            </span>
          </div>
        </div>

        {/* کاشی درس‌های فعال — نوارهای کوچک */}
        <div className="rounded-3xl border border-border bg-card p-4 shadow-card sm:col-span-2">
          <div className="flex items-center justify-between">
            <p className="text-[12.5px] font-extrabold text-foreground">{BOOKS_LABEL}</p>
            <span className="text-[9.5px] font-semibold text-muted-foreground">از فهرست مطالعهٔ تو</span>
          </div>
          <div className="mt-3 space-y-3">
            {COURSE_BARS.map((c) => (
              <div key={c.name}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <p className="truncate text-[11px] font-bold text-foreground">{c.name} <span className="font-medium text-muted-foreground">· {c.lesson}</span></p>
                  <span className="shrink-0 text-[9.5px] font-extrabold tabular-nums text-bronze">{c.pct}٪</span>
                </div>
                <LabBar pct={c.pct} />
              </div>
            ))}
          </div>
        </div>

        {/* کاشی مطلب برجسته */}
        <div className={`relative min-h-[150px] overflow-hidden rounded-3xl bg-gradient-to-bl ${POSTS[0].cover} p-4 text-white shadow-card sm:col-span-2`}>
          <div aria-hidden className="pattern-quilt absolute inset-0 opacity-30" />
          <span aria-hidden className="absolute -bottom-7 -start-3 select-none font-display text-[92px] leading-none text-white/10">ب</span>
          <div className="relative flex h-full flex-col justify-between gap-3">
            <span className="w-fit rounded-full bg-black/45 px-2.5 py-0.5 text-[9.5px] font-bold text-white backdrop-blur">{POSTS[0].cat}</span>
            <div>
              <p className="line-clamp-2 text-[14px] font-extrabold leading-relaxed">{POSTS[0].title}</p>
              <p className="mt-1 text-[9.5px] font-semibold text-white/70">{POSTS[0].author} · {POSTS[0].date} · {POSTS[0].mins} دقیقه مطالعه</p>
            </div>
          </div>
        </div>
      </div>

      {/* جدیدترین مطالب */}
      <div className="mt-5 space-y-3">
        <PostsHeader tone="ink" />
        <div className="grid gap-3 sm:grid-cols-2">
          {POSTS.map((p) => <LabPostCardMatte key={p.id} p={p} />)}
        </div>
      </div>
    </div>
  );
}

/* ═══ نمونهٔ ۶ — «آزمون‌محور» (شمارش معکوس + نمودار نتایج؛ آزمون جلوتر از همه) ═ */

const SCORES = [
  { label: "امانت‌ها", pct: 68 },
  { label: "ضمان", pct: 74 },
  { label: "بیع", pct: 81 },
];

export function VariantExamFirst() {
  return (
    <div className="space-y-5 p-4 sm:p-6">
      {/* سربرگ باریک */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-muted-foreground">{GREETING}</p>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[10.5px] font-bold text-foreground shadow-card">
          <BookOpen className="h-3.5 w-3.5 text-bronze" />{NEXT_COURSE} · جلسهٔ ۱۲
        </span>
      </div>

      {/* هیروی آزمون */}
      <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-bl from-[#0d211a] via-[#16352a] to-[#0d211a] p-5 text-white shadow-card sm:p-6">
        <div aria-hidden className="pattern-quilt absolute inset-0 opacity-50" />
        <NotebookTabs aria-hidden className="absolute -bottom-6 -start-6 h-36 w-36 text-white/[0.05]" />
        <div aria-hidden className="absolute -top-20 start-1/3 h-44 w-44 rounded-full bg-bronze/20 blur-3xl" />

        <div className="relative grid items-center gap-6 lg:grid-cols-[1.2fr,auto]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-bronze/20 px-3 py-1 text-[10.5px] font-extrabold text-[#ecd29a]">
                <Hourglass className="h-3.5 w-3.5" />۱۲ روز تا آزمون جامع مدنی
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold text-white/85">
                <TrendingUp className="h-3.5 w-3.5 text-[#ecd29a]" />+۱۳٪ نسبت به هفتهٔ قبل
              </span>
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-wide text-[#ecd29a]">{EXAM_TITLE}</p>
              <h3 className="mt-1 text-[20px] font-extrabold leading-relaxed sm:text-2xl">{EXAM_DESC}</h3>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <LabGoldCta label="آزمون سریع ۱۰ سؤالی · ۸ دقیقه" />
              <span role="presentation" className="inline-flex cursor-default items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-[12.5px] font-bold text-white backdrop-blur transition-colors hover:bg-white/20">
                <NotebookTabs className="h-4 w-4 text-[#ecd29a]" />دفترچهٔ کامل
              </span>
            </div>
          </div>

          {/* کارت نمودار نتایج */}
          <div className="rounded-2xl border border-white/15 bg-white/[0.06] p-4 backdrop-blur-sm">
            <p className="text-[10.5px] font-extrabold text-white/80">نتایج آخرین آزمون‌های تو</p>
            <div className="mt-3 flex h-24 items-end justify-center gap-5">
              {SCORES.map((s, i) => (
                <div key={s.label} className="flex w-12 flex-col items-center gap-1.5">
                  <span className="text-[10px] font-black tabular-nums text-[#ecd29a]">{s.pct}٪</span>
                  <div className="flex h-14 w-7 items-end overflow-hidden rounded-md bg-white/10">
                    <div
                      className="w-full rounded-md bg-gradient-to-t from-[#8a6a30] to-[#ecd29a]"
                      style={{ height: `${s.pct}%`, opacity: i === SCORES.length - 1 ? 1 : 0.65 }}
                    />
                  </div>
                  <span className="text-[9px] font-semibold text-white/60">{s.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-white/15 pt-2.5 text-[10px]">
              <span className="font-semibold text-white/60">میانگین</span>
              <span className="font-black tabular-nums text-[#ecd29a]">۷۴٪</span>
            </div>
          </div>
        </div>
      </div>

      {/* جلسهٔ بعدی — نوار باریک */}
      <div className="group flex cursor-default flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-card transition-colors hover:border-bronze/50">
        <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10">
          <PlayCircle className="h-5 w-5 text-primary" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-extrabold text-foreground">{NEXT_LESSON}</span>
          <span className="block text-[10.5px] font-semibold text-muted-foreground">{NEXT_TITLE} — {NEXT_COURSE} · جلسهٔ ۱۲ از ۲۰</span>
        </span>
        <span className="flex w-28 items-center gap-2">
          <LabBar pct={58} className="flex-1" />
          <span className="text-[10px] font-extrabold tabular-nums text-bronze">۵۸٪</span>
        </span>
        <ArrowLeft aria-hidden className="h-4 w-4 shrink-0 text-bronze transition-transform group-hover:-translate-x-0.5" />
      </div>

      {/* آمار کوچک */}
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-bold text-foreground"><BookOpen className="h-3.5 w-3.5 text-primary" />{BOOKS_LABEL}</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-bold text-foreground"><Flame className="h-3.5 w-3.5 text-warn" />{STREAK_LABEL}</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-bold text-foreground"><Target className="h-3.5 w-3.5 text-bronze" />۴۰ دقیقه مرور امشب</span>
      </div>

      {/* جدیدترین مطالب */}
      <div className="space-y-3">
        <PostsHeader tone="ink" />
        <div className="grid gap-3 sm:grid-cols-2">
          {POSTS.map((p) => <LabPostCardMatte key={p.id} p={p} />)}
        </div>
      </div>
    </div>
  );
}
