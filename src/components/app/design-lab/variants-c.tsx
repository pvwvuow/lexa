"use client";

/* ═══ نمونه‌های ۷ و ۸ — شبانهٔ سینمایی · مرکز فرمان ═══════════════════════════ */

import * as React from "react";
import {
  PlayCircle, BookOpen, Flame, ArrowLeft, NotebookTabs, Sparkles,
  Clock3, Search, Command, CalendarClock, ListChecks, Bookmark,
  History, ChevronLeft, MessageCircle, Star,
} from "lucide-react";
import {
  GREETING, NEXT_TITLE, NEXT_COURSE, NEXT_LESSON, EXAM_TITLE, EXAM_DESC,
  BOOKS_LABEL, STREAK_LABEL, POSTS, POSTS_CTA,
  LabGoldCta, LabBar, PostsHeader, LabPostCardMatte,
} from "./shared";

/* ═══ نمونهٔ ۷ — «شبانهٔ سینمایی» (هیرو تمام‌صفحه + ریل «ادامه بده») ══════════ */

const CONTINUE = [
  { title: NEXT_LESSON, course: `${NEXT_COURSE} · جلسهٔ ۱۲`, pct: 58, cover: "from-[#1f5a4c] to-[#0f2f28]", mins: "۴۲ دقیقه" },
  { title: "بیع؛ اقساط و خیار", course: `${NEXT_COURSE} · جلسهٔ ۹`, pct: 82, cover: "from-[#2a4a68] to-[#101f2e]", mins: "۱۸ دقیقه" },
  { title: "ضمان و جهد", course: "حقوق مدنی ۶ · جلسهٔ ۴", pct: 24, cover: "from-[#96742f] to-[#413113]", mins: "۵۶ دقیقه" },
];

export function VariantCinema() {
  return (
    <div>
      {/* هیرو تمام‌عرض — سینمایی تیره */}
      <div className="relative bg-gradient-to-b from-[#0b1f18] via-[#123527] to-[#0d211a] px-5 pb-7 pt-9 text-white sm:px-7 sm:pt-12">
        <img
          src="/media/hero-law.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover opacity-20 [mask-image:linear-gradient(to_top,transparent_4%,black_58%)]"
        />
        <div aria-hidden className="absolute -top-20 end-1/4 h-52 w-52 rounded-full bg-bronze/20 blur-3xl" />

        <div className="relative mx-auto max-w-3xl space-y-4 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-[10.5px] font-bold text-white/90 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-[#ecd29a]" />{GREETING}
          </span>
          <h3 className="text-[26px] font-black leading-[1.5] sm:text-4xl sm:leading-[1.45]">{NEXT_LESSON}</h3>
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11.5px] font-semibold text-white/70">
            <span className="text-[#ecd29a]">{NEXT_COURSE}</span>
            <span aria-hidden className="h-1 w-1 rounded-full bg-white/40" />
            <span>{NEXT_TITLE}</span>
            <span aria-hidden className="h-1 w-1 rounded-full bg-white/40" />
            <span>جلسهٔ ۱۲ از ۲۰</span>
            <span aria-hidden className="h-1 w-1 rounded-full bg-white/40" />
            <span>۴۲ دقیقه</span>
          </p>

          <div className="mx-auto max-w-md">
            <div className="mb-1.5 flex justify-between text-[9.5px] font-bold text-white/60">
              <span>پیشرفت درس</span><span className="tabular-nums text-[#ecd29a]">۵۸٪</span>
            </div>
            <LabBar pct={58} dark className="h-2" />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-1.5">
            <LabGoldCta />
            <span role="presentation" className="inline-flex cursor-default items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-[12.5px] font-bold text-white backdrop-blur transition-colors hover:bg-white/20">
              <Bookmark className="h-4 w-4 text-[#ecd29a]" />مرور فلش‌کارت‌ها
            </span>
          </div>
        </div>
      </div>

      {/* بدنهٔ زیر هیرو */}
      <div className="space-y-6 p-4 sm:p-6">
        {/* ریل «امشب ادامه بده» */}
        <div className="space-y-3">
          <p className="flex items-center gap-1.5 text-[13px] font-extrabold text-foreground">
            <History className="h-4 w-4 text-bronze" />امشب ادامه بده
          </p>
          <div className="hslider -mx-1 flex gap-3 overflow-x-auto px-1 pb-1.5 pt-1">
            {CONTINUE.map((c) => (
              <div key={c.title} className="group w-[210px] shrink-0 cursor-default overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-colors hover:border-bronze/50 sm:w-[230px]">
                <div className={`relative block h-[86px] w-full overflow-hidden bg-gradient-to-bl ${c.cover}`}>
                  <div aria-hidden className="pattern-quilt absolute inset-0 opacity-30" />
                  <PlayCircle aria-hidden className="absolute inset-0 m-auto h-9 w-9 text-white/85 transition-transform duration-200 group-hover:scale-110" />
                  <span className="absolute bottom-2 start-2 rounded-full bg-black/55 px-2 py-0.5 text-[9px] font-bold text-white backdrop-blur">{c.course}</span>
                </div>
                <div className="space-y-2 p-3">
                  <p className="line-clamp-1 text-[12px] font-extrabold text-foreground transition-colors group-hover:text-bronze">{c.title}</p>
                  <div className="flex items-center gap-2">
                    <LabBar pct={c.pct} className="flex-1" />
                    <span className="text-[9.5px] font-extrabold tabular-nums text-bronze">{c.pct}٪</span>
                  </div>
                  <p className="flex items-center gap-1 text-[9.5px] font-semibold text-muted-foreground"><Clock3 className="h-3 w-3" />{c.mins} باقی‌مانده</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* آزمون + آمار */}
        <div className="grid gap-3 sm:grid-cols-[1.4fr,1fr]">
          <div className="group flex cursor-default items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-card transition-colors hover:border-bronze/50">
            <span aria-hidden className="grid h-10 w-10 shrink-0 rotate-45 place-items-center rounded-[11px] border border-bronze/40 bg-bronze/10 transition-transform duration-200 group-hover:scale-110">
              <NotebookTabs className="h-4.5 w-4.5 -rotate-45 text-bronze" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-extrabold text-foreground">{EXAM_TITLE}</span>
              <span className="block truncate text-[10.5px] text-muted-foreground">{EXAM_DESC}</span>
            </span>
            <ArrowLeft aria-hidden className="h-4 w-4 shrink-0 text-bronze transition-transform group-hover:-translate-x-0.5" />
          </div>
          <div className="flex items-center justify-around rounded-2xl border border-border bg-card px-4 py-3.5 shadow-card">
            <span className="flex items-center gap-1.5 text-[11.5px] font-bold text-foreground"><BookOpen className="h-4 w-4 text-primary" />{BOOKS_LABEL}</span>
            <span aria-hidden className="h-6 w-px bg-border" />
            <span className="flex items-center gap-1.5 text-[11.5px] font-bold text-foreground"><Flame className="h-4 w-4 text-warn" />{STREAK_LABEL}</span>
          </div>
        </div>

        {/* جدیدترین مطالب */}
        <div className="space-y-3">
          <PostsHeader tone="ink" />
          <div className="grid gap-3 sm:grid-cols-2">
            {POSTS.map((p) => <LabPostCardMatte key={p.id} p={p} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══ نمونهٔ ۸ — «مرکز فرمان» (نوار فرمان + KPI + برنامهٔ امشب) ═══════════════ */

const AGENDA = [
  { time: "۲۰:۰۰", title: "مرور «ودیعه و عاریه» — جلسهٔ ۱۲", mins: "۱۵ دقیقه", Icon: PlayCircle, tone: "bg-primary/10 text-primary" },
  { time: "۲۱:۰۰", title: "۱۰ سؤال تستی از «امانت‌ها»", mins: "۸ دقیقه", Icon: ListChecks, tone: "bg-bronze/15 text-bronze" },
  { time: "۲۲:۰۰", title: "۵ فلش‌کارت «سنگرهای امانت»", mins: "۳ دقیقه", Icon: Bookmark, tone: "bg-amber-400/15 text-warn" },
];

const KPIS = [
  { value: "۵", label: "درس فعال", Icon: BookOpen, tone: "text-primary bg-primary/10" },
  { value: "۱ روز", label: "استریک", Icon: Flame, tone: "text-warn bg-amber-400/15" },
  { value: "۷۴٪", label: "میانگین آزمون", Icon: NotebookTabs, tone: "text-bronze bg-bronze/10" },
  { value: "۴۰ دقیقه", label: "مرور امشب", Icon: Clock3, tone: "text-foreground bg-foreground/[0.07]" },
];

export function VariantCommand() {
  return (
    <div className="space-y-5 p-4 sm:p-6">
      {/* نوار فرمان */}
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-card ring-1 ring-bronze/20">
        <Search className="h-4.5 w-4.5 shrink-0 text-bronze" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-muted-foreground">
          امشب چه کار کنم؟ <span className="text-foreground/70">{NEXT_LESSON}…</span>
        </span>
        <kbd className="hidden shrink-0 rounded-lg border border-border bg-background px-2 py-1 text-[9.5px] font-bold text-muted-foreground sm:inline-block">Ctrl + K</kbd>
      </div>

      {/* چیپ‌های پیشنهاد */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10.5px] font-bold text-muted-foreground">پیشنهاد:</span>
        <span role="presentation" className="inline-flex cursor-default items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-[11px] font-extrabold text-primary-foreground shadow-card"><PlayCircle className="h-3.5 w-3.5 text-bronze" />شروع مرور</span>
        <span role="presentation" className="inline-flex cursor-default items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-[11px] font-bold text-foreground transition-colors hover:border-bronze/50"><ListChecks className="h-3.5 w-3.5 text-bronze" />آزمون سریع</span>
        <span role="presentation" className="inline-flex cursor-default items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-[11px] font-bold text-foreground transition-colors hover:border-bronze/50"><Bookmark className="h-3.5 w-3.5 text-bronze" />فلش‌کارت‌ها</span>
        <span role="presentation" className="inline-flex cursor-default items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-[11px] font-bold text-foreground transition-colors hover:border-bronze/50"><NotebookTabs className="h-3.5 w-3.5 text-bronze" />دفترچه‌ها</span>
      </div>

      {/* ردیف KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {KPIS.map((k) => (
          <div key={k.label} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-card">
            <span aria-hidden className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${k.tone}`}>
              <k.Icon className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-black tabular-nums text-foreground">{k.value}</span>
              <span className="block text-[9.5px] font-semibold text-muted-foreground">{k.label}</span>
            </span>
          </div>
        ))}
      </div>

      {/* دو ستون: برنامهٔ امشب + مطالب */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* برنامهٔ امشب */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[12.5px] font-extrabold text-foreground">
              <CalendarClock className="h-4 w-4 text-bronze" />برنامهٔ امشب
            </p>
            <span className="rounded-full bg-primary/[0.08] px-2.5 py-0.5 text-[9.5px] font-extrabold text-primary">پیشنهادی · ۲۶ دقیقه</span>
          </div>
          <ul className="mt-3.5 space-y-2.5">
            {AGENDA.map((a) => (
              <li key={a.time} className="group flex items-center gap-3 rounded-xl border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-background/40">
                <span className="shrink-0 rounded-lg bg-background/60 px-2 py-1 text-[9.5px] font-black tabular-nums text-muted-foreground ring-1 ring-border">{a.time}</span>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${a.tone}`}><a.Icon className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 block text-[12px] font-bold text-foreground">{a.title}</span>
                  <span className="block text-[9.5px] font-semibold text-muted-foreground">{a.mins}</span>
                </span>
                <ChevronLeft aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground/30 transition-all group-hover:-translate-x-0.5 group-hover:text-bronze" />
              </li>
            ))}
          </ul>
          <div className="mt-3.5 border-t border-dashed border-border pt-3">
            <LabGoldCta label="شروع از ۲۰:۰۰" />
          </div>
        </div>

        {/* جدیدترین مطالب */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12.5px] font-extrabold text-foreground">جدیدترین مطالب</p>
            <span className="inline-flex cursor-default items-center gap-1 text-[10.5px] font-bold text-bronze">
              {POSTS_CTA}
              <ArrowLeft className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-3 space-y-2.5">
            {POSTS.map((p) => (
              <div key={p.id} className="group flex cursor-default items-center gap-3 rounded-xl px-1.5 py-2 transition-colors hover:bg-background/40">
                <span className={`relative block h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gradient-to-bl ${p.cover}`}>
                  <p.Icon className="absolute inset-0 m-auto h-4 w-4 text-white/85" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 block text-[12px] font-extrabold text-foreground transition-colors group-hover:text-bronze">{p.title}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[9.5px] font-semibold text-muted-foreground">
                    {p.author}<span className="text-bronze">·</span>{p.date}
                    <span className="ms-auto inline-flex items-center gap-0.5"><MessageCircle className="h-3 w-3" />{p.comments}</span>
                    {!!p.rating && <span className="inline-flex items-center gap-0.5 font-bold text-bronze"><Star className="h-3 w-3 fill-current" />{p.rating}</span>}
                  </span>
                </span>
              </div>
            ))}
          </div>
          {/* آزمون به‌صورت ردیف پایانی */}
          <div className="mt-3.5 flex items-center gap-3 rounded-xl border border-dashed border-bronze/50 px-3.5 py-3">
            <NotebookTabs className="h-4.5 w-4.5 shrink-0 text-bronze" />
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-extrabold text-foreground">{EXAM_TITLE}</span>
              <span className="block truncate text-[9.5px] text-muted-foreground">{EXAM_DESC}</span>
            </span>
            <Command aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
          </div>
        </div>
      </div>

      {/* پانوشت کوچک */}
      <p className="flex items-center justify-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
        <Sparkles className="h-3 w-3 text-bronze" />
        {BOOKS_LABEL} · {STREAK_LABEL} — همه‌چیز یک ارسال فاصله دارد
      </p>
    </div>
  );
}
