"use client";

/* ═══ آزمایشگاه طرح خانه — صفحهٔ موقت مقایسهٔ نمونه‌ها ═══════════════════════
   کاربر خواست بخش بزرگ خانه (خوش‌آمد، جلسهٔ بعدی، ادامهٔ یادگیری، آمار،
   مرکز آزمون و جدیدترین مطالب) از نو طراحی شود؛ این صفحه چند «نمونه»ی کامل
   از همان بخش را کنار هم می‌گذارد تا انتخاب کند.
   نکتهٔ فنی: تم‌های برنامه کلاس‌محورند (.dark و .theme-glass) و واریانت dark
   تیلویند هم (:is(.dark *))، پس هر نمونه با یک wrapper محدودشده هم‌زمان در
   هر سه تم (روز/شب/شیشه‌ای) رندر می‌شود — بدون دست‌زدن به تم واقعی برنامه.
   داده‌ها همهٔ نمونه‌ها ثابت و مطابق محتوای واقعی خانه است. */

import * as React from "react";
import {
  PlayCircle, Clock3, Sparkles, BookOpen, Flame, ArrowLeft,
  MessageCircle, GraduationCap, Rss, Star, NotebookTabs, Briefcase,
  Sun, Moon, Droplets, Palette, Feather, Crown, Newspaper, LayoutGrid,
} from "lucide-react";
import { UserAvatar } from "./common";

/* ─── دادهٔ ثابت نمونه‌ها — دقیقاً همان محتوای خانه ────────────────────────── */

const GREETING = "شب بخیر، برای مرور شبانه آماده‌ای؟";
const NEXT_TITLE = "جلسهٔ بعدی آماده است";
const NEXT_COURSE = "حقوق مدنی ۷";
const NEXT_LESSON = "ودیعه و عاریه؛ سنگرهای امانت";
const EXAM_TITLE = "مرکز آزمون";
const EXAM_DESC = "دفترچه‌های آمادهٔ تستی زمان‌سنج و تشریحی با پاسخ نمونه";
const POSTS_TITLE = "جدیدترین مطالب";
const POSTS_CTA = "مشاهده همه";
const POSTS_HINT = "تازه‌ترین نوشته‌های اساتید";
const BOOKS_LABEL = "۵ درس فعال";
const STREAK_LABEL = "استریک ۱ روز";

type LabPost = {
  id: string;
  cat: string;
  title: string;
  author: string;
  date: string;
  mins: number;
  comments: number;
  rating?: number;
  cover: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const POSTS: LabPost[] = [
  {
    id: "lab-p1", cat: "مطلب آموزشی",
    title: "حقوق قراردادها در یک ساعت: عمق واژهٔ «بیع»",
    author: "دکتر سلیمانی", date: "۵ شهریور", mins: 4, comments: 2, rating: 5,
    cover: "from-[#1f5a4c] to-[#0f2f28]", Icon: BookOpen,
  },
  {
    id: "lab-p2", cat: "تجارت",
    title: "قرارداد بیع و معایب بیع",
    author: "دکتر رضوی", date: "۴ شهریور", mins: 6, comments: 1,
    cover: "from-[#96742f] to-[#413113]", Icon: Briefcase,
  },
];

/* ─── محدودکردن تم — هر نمونه در یک قاب با کلاس تم رندر می‌شود ─────────────── */

export type LabTheme = "light" | "dark" | "glass";

const THEMES: { id: LabTheme; label: string; hint: string }[] = [
  { id: "light", label: "تم روز", hint: "آلاباستر و یشمی" },
  { id: "dark", label: "تم شب", hint: "کتابخانهٔ شب" },
  { id: "glass", label: "تم شیشه‌ای", hint: "آۆرایی و شیشه" },
];

function ThemeScope({ theme, children }: { theme: LabTheme; children: React.ReactNode }) {
  if (theme === "dark")
    return (
      <div className="dark relative overflow-hidden rounded-[24px] bg-background text-foreground shadow-card ring-1 ring-black/50">
        {children}
      </div>
    );
  if (theme === "glass")
    return (
      <div className="theme-glass lab-glass-wallpaper relative overflow-hidden rounded-[24px] text-foreground shadow-card ring-1 ring-white/70">
        {children}
      </div>
    );
  return (
    <div className="relative overflow-hidden rounded-[24px] bg-background text-foreground shadow-card ring-1 ring-border">
      {children}
    </div>
  );
}

function ThemeBadge({ theme }: { theme: LabTheme }) {
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Droplets;
  const t = THEMES.find((x) => x.id === theme)!;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-[11px] font-extrabold text-foreground shadow-card ring-1 ring-border">
      <Icon className="h-3.5 w-3.5 text-bronze" />
      {t.label}
      <span className="font-medium text-muted-foreground">— {t.hint}</span>
    </span>
  );
}

/* ─── قطعات مشترک نمونه‌ها ─────────────────────────────────────────────────── */

/** دکمهٔ طلایی — همان جنس دکمهٔ روز/شب که کاربر آن را تأیید کرده */
function LabGoldCta({ label = "ادامه یادگیری" }: { label?: string }) {
  return (
    <span
      role="presentation"
      className="group relative mt-1 inline-flex cursor-default items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-[#ecd29a] via-[#cda65e] to-[#8a6a30] px-5 py-2.5 text-sm font-bold text-[#1b1408] shadow-[0_3px_12px_-3px_rgba(205,166,94,0.65),inset_0_1px_0_rgba(255,255,255,0.5)] ring-1 ring-[#f6e7c1]/70 transition-all duration-300 hover:shadow-[0_5px_18px_-3px_rgba(205,166,94,0.85),inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-[1.06] active:scale-[.98]"
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/40 via-white/5 to-black/15" />
      <span aria-hidden className="pointer-events-none absolute -top-1/2 start-[-20%] h-[180%] w-2/3 rotate-12 bg-white/25 blur-[6px] transition-transform duration-500 group-hover:translate-x-[120%]" />
      <PlayCircle className="relative h-[18px] w-[18px]" />
      <span className="relative">{label}</span>
    </span>
  );
}

/** سرصفحهٔ «جدیدترین مطالب» با لحن‌های متفاوت */
function PostsHeader({ tone }: { tone: "onGreen" | "ink" | "gold" | "white" }) {
  const title =
    tone === "onGreen" ? "text-white" : tone === "white" ? "text-white" : tone === "gold" ? "text-bronze" : "text-foreground";
  const hint =
    tone === "ink" ? "text-muted-foreground" : tone === "gold" ? "text-primary-foreground/50" : "text-white/60";
  const chip =
    tone === "ink"
      ? "border-bronze/60 bg-bronze/10 text-bronze hover:bg-bronze/20"
      : "border-bronze/60 bg-bronze/15 text-bronze hover:bg-bronze/25";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`inline-flex items-center gap-1.5 text-[13px] font-extrabold ${title}`}>
        <Rss className="h-4 w-4 text-bronze" /> {POSTS_TITLE}
      </span>
      <span className={`cursor-default rounded-full border px-3 py-1 text-[10.5px] font-bold transition-colors ${chip}`}>
        {POSTS_CTA}
      </span>
      <span className={`ms-auto hidden text-[10px] font-medium sm:inline ${hint}`}>{POSTS_HINT}</span>
    </div>
  );
}

/** کارت مطلب سفید مات (زبان «feed-card» فعلی) — با گزینهٔ حلقهٔ طلایی */
function LabPostCardMatte({ p, className = "", goldRing = false }: { p: LabPost; className?: string; goldRing?: boolean }) {
  const Icon = p.Icon;
  return (
    <div
      className={`feed-card group relative cursor-default overflow-hidden rounded-[24px] text-start transition-[border-color,box-shadow] duration-200 ${
        goldRing ? "shadow-[0_0_0_1px_rgba(168,127,63,0.45),0_16px_36px_-18px_rgb(3_12_9/0.55)] hover:shadow-[0_0_0_1px_rgba(168,127,63,0.8),0_22px_44px_-18px_rgb(3_12_9/0.62)]" : ""
      } ${className}`}
    >
      <span className="relative block px-3 pt-3">
        <span className={`relative mx-auto block h-[116px] w-full overflow-hidden rounded-[14px] bg-gradient-to-bl ${p.cover} shadow-[0_4px_14px_-4px_rgba(0,0,0,0.5)]`}>
          <span aria-hidden className="pattern-quilt absolute inset-0 opacity-30" />
          <span aria-hidden className="absolute -bottom-6 -start-4 select-none font-display text-[64px] leading-none text-white/10">
            {p.title.slice(0, 1)}
          </span>
          <span aria-hidden className="absolute inset-0 m-auto grid h-11 w-11 rotate-45 place-items-center rounded-[11px] border border-white/40 bg-white/15 shadow-card backdrop-blur-[2px] transition-transform duration-200 group-hover:scale-110">
            <Icon className="h-4.5 w-4.5 -rotate-45 text-white" />
          </span>
        </span>
        <span className="absolute bottom-2.5 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 whitespace-nowrap rounded-full bg-black/55 px-2.5 py-0.5 text-[9.5px] font-bold text-white backdrop-blur">
          {p.cat}
        </span>
      </span>
      <span className="block space-y-2 p-3.5">
        <span className="line-clamp-2 block min-h-[2.7em] text-[13px] font-extrabold leading-relaxed transition-colors group-hover:text-bronze">
          {p.title}
        </span>
        <span className="flex items-center gap-2">
          <UserAvatar name={p.author} size="xs" />
          <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-foreground/80">{p.author}</span>
          <span className="shrink-0 text-[10px] font-semibold tabular-nums text-muted-foreground">{p.date}</span>
        </span>
        <span className="flex items-center gap-2 border-t border-border/70 pt-2 text-[10px] font-semibold text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{p.mins} دقیقه مطالعه</span>
          <span className="ms-auto inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />{p.comments} گفتگو</span>
          {!!p.rating && (
            <span className="inline-flex items-center gap-0.5 font-bold text-bronze"><Star className="h-3 w-3 fill-current" />{p.rating}</span>
          )}
        </span>
      </span>
    </div>
  );
}

/** کارت مطلب کاملاً شیشه‌ای — متن سفید روی شیشهٔ مایع */
function LabPostCardGlass({ p, className = "" }: { p: LabPost; className?: string }) {
  const Icon = p.Icon;
  return (
    <div className={`lg-card group relative cursor-default overflow-hidden rounded-[24px] text-start text-white ${className}`}>
      <span aria-hidden className="lg-spec" />
      <span className="relative block px-3 pt-3">
        <span className={`relative mx-auto block h-[116px] w-full overflow-hidden rounded-[14px] bg-gradient-to-bl ${p.cover} shadow-[0_4px_14px_-4px_rgba(0,0,0,0.55)]`}>
          <span aria-hidden className="pattern-quilt absolute inset-0 opacity-30" />
          <span aria-hidden className="absolute inset-0 m-auto grid h-11 w-11 rotate-45 place-items-center rounded-[11px] border border-white/40 bg-white/15 backdrop-blur-[2px] transition-transform duration-200 group-hover:scale-110">
            <Icon className="h-4.5 w-4.5 -rotate-45 text-white" />
          </span>
        </span>
        <span className="absolute bottom-2.5 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 whitespace-nowrap rounded-full bg-black/55 px-2.5 py-0.5 text-[9.5px] font-bold text-white backdrop-blur">
          {p.cat}
        </span>
      </span>
      <span className="relative block space-y-2 p-3.5">
        <span className="line-clamp-2 block min-h-[2.7em] text-[13px] font-extrabold leading-relaxed">
          {p.title}
        </span>
        <span className="flex items-center gap-2">
          <UserAvatar name={p.author} size="xs" />
          <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-white/85">{p.author}</span>
          <span className="shrink-0 text-[10px] font-semibold tabular-nums text-white/60">{p.date}</span>
        </span>
        <span className="flex items-center gap-2 border-t border-white/20 pt-2 text-[10px] font-semibold text-white/70">
          <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{p.mins} دقیقه مطالعه</span>
          <span className="ms-auto inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />{p.comments} گفتگو</span>
          {!!p.rating && (
            <span className="inline-flex items-center gap-0.5 font-bold text-[#ecd29a]"><Star className="h-3 w-3 fill-current" />{p.rating}</span>
          )}
        </span>
      </span>
    </div>
  );
}

/* ═══ نمونهٔ ۱ — طرح فعلی (مرجع مقایسه) ═════════════════════════════════════ */

function VariantCurrent() {
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
          <div className="space-y-3" aria-label="جدیدترین مطالب">
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

/* ═══ نمونهٔ ۲ — کاغذی مینیمال (حس قفسهٔ کتاب؛ بدون بلوک رنگی) ══════════════ */

function VariantPaper() {
  return (
    <div className="p-4 sm:p-6">
      {/* سربرگ تحریری */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-muted-foreground">{GREETING}</p>
        <span className="hidden text-[10px] font-medium text-muted-foreground/70 sm:inline">همیار حقوق · امشب</span>
      </div>
      <div aria-hidden className="ornament-rule mt-3" />

      <div className="mt-5 grid items-start gap-6 lg:grid-cols-[1.15fr,1fr]">
        <div className="space-y-3">
          <p className="text-[11px] font-bold tracking-wide text-bronze">پیشنهاد مرور شبانه</p>
          <h3 className="text-[26px] font-extrabold leading-snug sm:text-3xl">{NEXT_TITLE}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            <span className="font-bold text-foreground">{NEXT_COURSE}</span>
            <span className="mx-1.5 text-bronze">·</span>
            {NEXT_LESSON}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2">
            <span role="presentation" className="group inline-flex cursor-default items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-card ring-1 ring-bronze/40 transition-all hover:shadow-[0_6px_20px_-6px_rgba(29,75,64,0.55)] active:scale-[.98]">
              <PlayCircle className="h-[18px] w-[18px] text-bronze transition-transform group-hover:-translate-x-0.5" />
              ادامه یادگیری
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><BookOpen className="h-3.5 w-3.5 text-bronze" />{BOOKS_LABEL}</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Flame className="h-3.5 w-3.5 text-bronze" />{STREAK_LABEL}</span>
          </div>
        </div>

        {/* برگهٔ درس جاری — حس صفحهٔ کتاب */}
        <div className="relative rounded-2xl border border-border bg-card p-4 shadow-card">
          <div aria-hidden className="absolute inset-y-3 start-3 w-px bg-bronze/30" />
          <div className="ps-4">
            <p className="flex items-center gap-1.5 text-[10.5px] font-bold text-muted-foreground"><BookOpen className="h-3.5 w-3.5 text-bronze" />درس جاری</p>
            <p className="mt-1.5 font-body text-lg font-bold leading-relaxed text-foreground">{NEXT_LESSON}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">{NEXT_COURSE} · جلسهٔ ۱۲ از ۲۰</p>
            <div aria-hidden className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-[58%] rounded-full bg-gradient-to-l from-bronze to-[#cda65e]/60" />
            </div>
          </div>
        </div>
      </div>

      {/* مرکز آزمون — ردیف تحریری */}
      <div className="group mt-6 flex cursor-default items-center gap-3 rounded-xl border border-dashed border-bronze/50 bg-card px-4 py-3 shadow-card">
        <span aria-hidden className="grid h-10 w-10 shrink-0 rotate-45 place-items-center rounded-[11px] border border-bronze/40 bg-bronze/10 transition-transform duration-200 group-hover:scale-110">
          <NotebookTabs className="h-4.5 w-4.5 -rotate-45 text-bronze" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-extrabold text-foreground">{EXAM_TITLE}</span>
          <span className="block text-[11px] leading-relaxed text-muted-foreground">{EXAM_DESC}</span>
        </span>
        <ArrowLeft aria-hidden className="h-4 w-4 shrink-0 text-bronze transition-transform group-hover:-translate-x-0.5" />
      </div>

      {/* جدیدترین مطالب — فهرست تحریری */}
      <div className="mt-7 space-y-3">
        <PostsHeader tone="ink" />
        <div className="grid gap-3 sm:grid-cols-2">
          {POSTS.map((p) => {
            const Icon = p.Icon;
            return (
              <div key={p.id} className="feed-card group flex cursor-default gap-3 overflow-hidden rounded-2xl p-3">
                <span className={`relative block h-[86px] w-[92px] shrink-0 overflow-hidden rounded-xl bg-gradient-to-bl ${p.cover}`}>
                  <span aria-hidden className="pattern-quilt absolute inset-0 opacity-30" />
                  <span aria-hidden className="absolute inset-0 m-auto grid h-9 w-9 rotate-45 place-items-center rounded-[9px] border border-white/40 bg-white/15 backdrop-blur-[2px]">
                    <Icon className="h-4 w-4 -rotate-45 text-white" />
                  </span>
                </span>
                <span className="min-w-0 flex-1 space-y-1.5 py-0.5">
                  <span className="block text-[9.5px] font-bold tracking-wide text-bronze">{p.cat}</span>
                  <span className="line-clamp-2 block text-[12.5px] font-extrabold leading-relaxed text-foreground transition-colors group-hover:text-bronze">{p.title}</span>
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
                    {p.author}<span className="text-bronze">·</span>{p.date}<span className="text-bronze">·</span>{p.mins} دقیقه
                    {!!p.rating && <span className="ms-auto inline-flex items-center gap-0.5 font-bold text-bronze"><Star className="h-3 w-3 fill-current" />{p.rating}</span>}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══ نمونهٔ ۳ — طلایی سلطنتی (زمرد تیره با قاب برنزی، حس نسخهٔ خطی) ════════ */

function VariantRoyal() {
  return (
    <div className="p-4 sm:p-6">
      <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-bl from-[#0d211a] via-[#16352a] to-[#0d211a] p-5 text-primary-foreground shadow-card ring-1 ring-bronze/50 sm:p-7">
        <div aria-hidden className="pattern-quilt absolute inset-0 opacity-60" />
        {/* تصویر صحنهٔ حقوق — نیمهٔ خالی هیرو را پر می‌کند */}
        <img
          src="/media/hero-law.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover opacity-[0.12] lg:inset-y-0 lg:end-0 lg:start-auto lg:h-full lg:w-[44%] lg:opacity-70 lg:[mask-image:linear-gradient(to_right,black_30%,transparent_96%)]"
        />
        {/* قاب داخلی طلایی + گوشه‌های الماسی */}
        <div aria-hidden className="pointer-events-none absolute inset-2 rounded-[20px] border border-bronze/30" />
        <span aria-hidden className="pointer-events-none absolute start-3 top-3 h-2.5 w-2.5 rotate-45 border border-bronze/70 bg-bronze/20" />
        <span aria-hidden className="pointer-events-none absolute end-3 top-3 h-2.5 w-2.5 rotate-45 border border-bronze/70 bg-bronze/20" />
        <span aria-hidden className="pointer-events-none absolute bottom-3 start-3 h-2.5 w-2.5 rotate-45 border border-bronze/70 bg-bronze/20" />
        <span aria-hidden className="pointer-events-none absolute bottom-3 end-3 h-2.5 w-2.5 rotate-45 border border-bronze/70 bg-bronze/20" />
        <div aria-hidden className="absolute -top-24 start-1/3 h-56 w-56 rounded-full bg-bronze/20 blur-3xl" />

        <div className="relative space-y-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-[#e8cb8f]">{GREETING}</p>
            <Crown aria-hidden className="h-4 w-4 shrink-0 text-bronze/80" />
          </div>
          <div className="space-y-2.5">
            <h3 className="text-2xl font-extrabold leading-relaxed sm:text-3xl">{NEXT_TITLE}</h3>
            <p className="text-sm leading-relaxed text-white/85">
              <span className="font-extrabold text-[#ecd29a]">{NEXT_COURSE}</span>
              <span className="mx-1.5 text-bronze">·</span>
              {NEXT_LESSON}
            </p>
          </div>
          <LabGoldCta />
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-bronze/40 bg-bronze/10 px-3 py-1 text-xs font-semibold text-[#f3e3bb]"><BookOpen className="h-3.5 w-3.5 text-[#ecd29a]" />{BOOKS_LABEL}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-bronze/40 bg-bronze/10 px-3 py-1 text-xs font-semibold text-[#f3e3bb]"><Flame className="h-3.5 w-3.5 text-[#ecd29a]" />{STREAK_LABEL}</span>
          </div>

          {/* مرکز آزمون — قاب طلایی */}
          <div className="group flex w-full cursor-default items-center gap-3 rounded-2xl border border-bronze/35 bg-white/[0.05] px-4 py-3 text-start backdrop-blur-sm transition-colors hover:border-bronze/60">
            <span aria-hidden className="grid h-10 w-10 shrink-0 rotate-45 place-items-center rounded-[11px] border border-bronze/50 bg-bronze/15 transition-transform duration-200 group-hover:scale-110">
              <NotebookTabs className="h-4.5 w-4.5 -rotate-45 text-[#ecd29a]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-extrabold text-white">{EXAM_TITLE}</span>
              <span className="block text-[11px] leading-relaxed text-white/60">{EXAM_DESC}</span>
            </span>
            <ArrowLeft aria-hidden className="h-4 w-4 shrink-0 text-[#ecd29a] transition-transform group-hover:-translate-x-0.5" />
          </div>

          {/* جدیدترین مطالب — کارت‌های سفید با حلقهٔ طلایی */}
          <div className="space-y-3">
            <PostsHeader tone="gold" />
            <div className="hslider -mx-1 flex gap-3 overflow-x-auto px-1 pb-1.5 pt-1">
              {POSTS.map((p) => <LabPostCardMatte key={p.id} p={p} goldRing className="w-[240px] shrink-0 snap-start sm:w-[268px]" />)}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ═══ نمونهٔ ۴ — شیشهٔ مایع کامل (همه‌چیز از لُید گلس روی هاله‌های رنگی) ════ */

function VariantGlass() {
  return (
    <div className="relative p-4 sm:p-6">
      {/* صحنهٔ رنگی پشت شیشه — شیشهٔ شفاف باید روی رنگِ زنده بنشیند
          تا در هر سه تم (روشن/شب/شیشه‌ای) خوانا و واقعاً شیشه‌ای بماند */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-bl from-[#0d211a] via-[#143026] to-[#0d211a]" />
      <div aria-hidden className="absolute inset-0">
        <div className="absolute -top-12 start-4 h-48 w-48 rounded-full bg-[#3f8a6d]/65 blur-3xl" />
        <div className="absolute bottom-2 end-6 h-44 w-44 rounded-full bg-[#cda65e]/60 blur-3xl" />
        <div className="absolute top-1/3 start-1/2 h-40 w-40 rounded-full bg-[#6fa8c4]/55 blur-3xl" />
      </div>

      <div className="relative space-y-5">
        {/* هیروی شیشه‌ای */}
        <section className="lg-card relative overflow-hidden rounded-[28px] p-5 text-white sm:p-7">
          <span aria-hidden className="lg-spec" />
          <div className="relative space-y-4">
            <p className="text-sm font-medium text-white/80">{GREETING}</p>
            <h3 className="text-2xl font-extrabold leading-relaxed sm:text-3xl">{NEXT_TITLE}</h3>
            <p className="-mt-1 text-sm leading-relaxed text-white/85">
              <span className="font-semibold text-[#ecd29a]">{NEXT_COURSE}</span>
              <span className="mx-1.5 text-white/50">·</span>
              {NEXT_LESSON}
            </p>
            <LabGoldCta />
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="lg-skeleton inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white"><BookOpen className="h-3.5 w-3.5 text-bronze" />{BOOKS_LABEL}</span>
              <span className="lg-skeleton inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white"><Flame className="h-3.5 w-3.5 text-bronze" />{STREAK_LABEL}</span>
            </div>
          </div>
        </section>

        {/* مرکز آزمون — ردیف شیشه‌ای */}
        <div className="lg-card group relative flex w-full cursor-default items-center gap-3 overflow-hidden rounded-2xl px-4 py-3 text-start text-white">
          <span aria-hidden className="lg-spec" />
          <span aria-hidden className="grid h-10 w-10 shrink-0 rotate-45 place-items-center rounded-[11px] border border-white/40 bg-white/10 transition-transform duration-200 group-hover:scale-110">
            <NotebookTabs className="h-4.5 w-4.5 -rotate-45 text-[#ecd29a]" />
          </span>
          <span className="relative min-w-0 flex-1">
            <span className="block text-[13.5px] font-extrabold text-white">{EXAM_TITLE}</span>
            <span className="block text-[11px] leading-relaxed text-white/65">{EXAM_DESC}</span>
          </span>
          <ArrowLeft aria-hidden className="relative h-4 w-4 shrink-0 text-[#ecd29a] transition-transform group-hover:-translate-x-0.5" />
        </div>

        {/* جدیدترین مطالب — کارت‌های کاملاً شیشه‌ای */}
        <div className="space-y-3">
          <PostsHeader tone="white" />
          <div className="hslider -mx-1 flex gap-3 overflow-x-auto px-1 pb-1.5 pt-1">
            {POSTS.map((p) => <LabPostCardGlass key={p.id} p={p} className="w-[240px] shrink-0 snap-start sm:w-[268px]" />)}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══ نمونهٔ ۵ — مجلهٔ شبانه (چیدمان روزنامه‌ای با تیتر درشت) ═══════════════ */

function VariantMagazine() {
  return (
    <div className="p-4 sm:p-6">
      {/* سرلوحهٔ گازت */}
      <div className="flex items-baseline justify-between gap-3 border-b-2 border-foreground/70 pb-2.5">
        <span className="text-[15px] font-black tracking-tight text-foreground">روزنامهٔ حقوق امشب</span>
        <span className="text-[10px] font-semibold text-muted-foreground">سه‌شنبه · شهریور</span>
      </div>

      <div className="mt-5 grid items-start gap-7 lg:grid-cols-[1.2fr,1fr]">
        {/* تیتر اصلی */}
        <article className="space-y-3">
          <p className="text-[11px] font-bold tracking-[0.14em] text-bronze">مرور شبانه — پیشنهاد سردبیر</p>
          <h3 className="text-[28px] font-black leading-[1.35] text-foreground sm:text-[32px]">{NEXT_LESSON}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {GREETING} درسِ امشب از <span className="font-bold text-foreground">{NEXT_COURSE}</span> آماده است؛
            همان‌جا که رهایش کردی ادامه بده.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
            <span role="presentation" className="group inline-flex cursor-default items-center gap-2 rounded-lg bg-foreground px-5 py-2.5 text-sm font-bold text-background shadow-card transition-all active:scale-[.98]">
              <PlayCircle className="h-[18px] w-[18px] text-bronze transition-transform group-hover:-translate-x-0.5" />
              ادامه یادگیری
            </span>
            <span className="text-xs font-semibold text-muted-foreground">
              {BOOKS_LABEL} <span className="mx-1 text-bronze">·</span> {STREAK_LABEL}
            </span>
          </div>
        </article>

        {/* ستون کنار — «در همین شماره» */}
        <aside className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="border-b border-dashed border-border pb-2 text-[11px] font-black text-foreground">در همین شماره</p>
          <div className="mt-3 space-y-3">
            <div className="group flex cursor-default items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-bronze/10"><NotebookTabs className="h-4 w-4 text-bronze" /></span>
              <span className="min-w-0">
                <span className="block text-[12px] font-extrabold text-foreground">{EXAM_TITLE}</span>
                <span className="block truncate text-[10px] text-muted-foreground">{EXAM_DESC}</span>
              </span>
              <ArrowLeft className="ms-auto h-3.5 w-3.5 shrink-0 text-bronze transition-transform group-hover:-translate-x-0.5" />
            </div>
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10"><BookOpen className="h-4 w-4 text-primary" /></span>
              <span className="min-w-0">
                <span className="block text-[12px] font-extrabold text-foreground">{BOOKS_LABEL}</span>
                <span className="block truncate text-[10px] text-muted-foreground">از فهرست مطالعهٔ تو</span>
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-400/15"><Flame className="h-4 w-4 text-warn" /></span>
              <span className="min-w-0">
                <span className="block text-[12px] font-extrabold text-foreground">{STREAK_LABEL}</span>
                <span className="block truncate text-[10px] text-muted-foreground">امشب را هم کامل کن</span>
              </span>
            </div>
          </div>
        </aside>
      </div>

      {/* ستون مطالب — ردیف‌های مجله‌ای */}
      <div className="mt-7 border-t-2 border-foreground/70 pt-3">
        <PostsHeader tone="ink" />
        <div className="mt-1">
          {POSTS.map((p, i) => {
            const Icon = p.Icon;
            return (
              <div key={p.id} className={`group flex cursor-default items-center gap-4 py-3.5 ${i < POSTS.length - 1 ? "border-b border-dashed border-border" : ""}`}>
                <span className={`relative block h-[72px] w-[96px] shrink-0 overflow-hidden rounded-lg bg-gradient-to-bl ${p.cover}`}>
                  <span aria-hidden className="pattern-quilt absolute inset-0 opacity-30" />
                  <span aria-hidden className="absolute inset-0 m-auto grid h-8 w-8 rotate-45 place-items-center rounded-[8px] border border-white/40 bg-white/15 backdrop-blur-[2px]">
                    <Icon className="h-3.5 w-3.5 -rotate-45 text-white" />
                  </span>
                </span>
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block text-[9.5px] font-bold tracking-wide text-bronze">{p.cat}</span>
                  <span className="line-clamp-1 block text-[15px] font-extrabold leading-relaxed text-foreground transition-colors group-hover:text-bronze">{p.title}</span>
                  <span className="flex flex-wrap items-center gap-x-2 text-[10.5px] font-semibold text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><UserAvatar name={p.author} size="xs" />{p.author}</span>
                    <span className="text-bronze">·</span>{p.date}
                    <span className="text-bronze">·</span>{p.mins} دقیقه مطالعه
                    <span className="text-bronze">·</span>{p.comments} گفتگو
                    {!!p.rating && <span className="inline-flex items-center gap-0.5 font-bold text-bronze"><Star className="h-3 w-3 fill-current" />{p.rating}</span>}
                  </span>
                </span>
                <ArrowLeft className="hidden h-4 w-4 shrink-0 text-muted-foreground/50 transition-all group-hover:-translate-x-0.5 group-hover:text-bronze sm:block" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══ نمونهٔ ۶ — کارت‌های مستقل (مستطیل بزرگ به کارت‌های شناور تقسیم شد) ════ */

function VariantModular() {
  return (
    <div className="space-y-3 p-4 sm:p-5">
      {/* کارت خوش‌آمد */}
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-muted-foreground">{GREETING}</p>
          <p className="mt-0.5 truncate text-lg font-extrabold text-foreground">{NEXT_TITLE}</p>
        </div>
        <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-bronze/10">
          <Sparkles className="h-5 w-5 text-bronze" />
        </span>
      </div>

      {/* سه کارت: جلسهٔ بعدی + دو آمار */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-bl from-primary via-primary to-[#123628] p-4 text-primary-foreground shadow-card sm:col-span-1">
          <div aria-hidden className="pattern-quilt absolute inset-0 opacity-80" />
          <div className="relative space-y-1.5">
            <p className="text-[10px] font-bold text-bronze">{NEXT_COURSE}</p>
            <p className="line-clamp-2 min-h-[2.6em] text-[13px] font-extrabold leading-relaxed">{NEXT_LESSON}</p>
            <span role="presentation" className="mt-1.5 inline-flex cursor-default items-center gap-1.5 rounded-lg bg-white/[0.14] px-3.5 py-2 text-xs font-bold text-white ring-1 ring-white/25 backdrop-blur transition-colors hover:bg-white/[0.22]">
              <PlayCircle className="h-4 w-4 text-bronze" />
              ادامه یادگیری
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border">
          <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10"><BookOpen className="h-5 w-5 text-primary" /></span>
          <span>
            <span className="block text-[15px] font-extrabold text-foreground">{BOOKS_LABEL}</span>
            <span className="block text-[10.5px] text-muted-foreground">از فهرست مطالعهٔ تو</span>
          </span>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border">
          <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-400/15"><Flame className="h-5 w-5 text-warn" /></span>
          <span>
            <span className="block text-[15px] font-extrabold text-foreground">{STREAK_LABEL}</span>
            <span className="block text-[10.5px] text-muted-foreground">امشب را هم کامل کن</span>
          </span>
        </div>
      </div>

      {/* مرکز آزمون */}
      <div className="group flex cursor-default items-center gap-3 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border">
        <span aria-hidden className="grid h-11 w-11 shrink-0 rotate-45 place-items-center rounded-xl border border-bronze/40 bg-bronze/10 transition-transform duration-200 group-hover:scale-110">
          <NotebookTabs className="h-5 w-5 -rotate-45 text-bronze" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-extrabold text-foreground">{EXAM_TITLE}</span>
          <span className="block text-[11px] leading-relaxed text-muted-foreground">{EXAM_DESC}</span>
        </span>
        <ArrowLeft aria-hidden className="h-4 w-4 shrink-0 text-bronze transition-transform group-hover:-translate-x-0.5" />
      </div>

      {/* جدیدترین مطالب — دو کارت کنار هم */}
      <div className="space-y-3 pt-1">
        <PostsHeader tone="ink" />
        <div className="grid gap-3 sm:grid-cols-2">
          {POSTS.map((p) => <LabPostCardMatte key={p.id} p={p} />)}
        </div>
      </div>
    </div>
  );
}

/* ─── فهرست نمونه‌ها ───────────────────────────────────────────────────────── */

const VARIANTS: { id: string; name: string; tagline: string; icon: React.ComponentType<{ className?: string }>; Comp: React.ComponentType }[] = [
  { id: "current", name: "۱ · طرح فعلی", tagline: "زمردی همیشگی + کارت‌های سفید مات — مرجع مقایسه", icon: Sparkles, Comp: VariantCurrent },
  { id: "paper", name: "۲ · کاغذی مینیمال", tagline: "بدنهٔ کاغذی آرام، تایپ درشت، خطوط نازک — حس قفسهٔ کتاب", icon: Feather, Comp: VariantPaper },
  { id: "royal", name: "۳ · طلایی سلطنتی", tagline: "زمرد تیره با قاب و گوشه‌های برنزی — شکوه نسخهٔ خطی", icon: Crown, Comp: VariantRoyal },
  { id: "glass", name: "۴ · شیشهٔ مایع کامل", tagline: "همه‌چیز از لُید گلس روی هاله‌های رنگی — بیشترین شفافیت", icon: Droplets, Comp: VariantGlass },
  { id: "magazine", name: "۵ · مجلهٔ شبانه", tagline: "چیدمان روزنامه‌ای با تیتر درشت و ستون «در همین شماره»", icon: Newspaper, Comp: VariantMagazine },
  { id: "modular", name: "۶ · کارت‌های مستقل", tagline: "مستطیل بزرگ به کارت‌های جدا و شناور تقسیم شده", icon: LayoutGrid, Comp: VariantModular },
];

/* ═══ صفحهٔ اصلی آزمایشگاه ══════════════════════════════════════════════════ */

export function DesignLabView() {
  const [vid, setVid] = React.useState("current");
  const v = VARIANTS.find((x) => x.id === vid) ?? VARIANTS[0];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-2 sm:px-6">
      {/* سربرگ آزمایشگاه */}
      <div className="rounded-2xl border border-dashed border-bronze/50 bg-card/70 p-4 shadow-card backdrop-blur-sm sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-card">
            <Palette className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="flex flex-wrap items-center gap-2 text-base font-extrabold text-foreground">
              آزمایشگاه طرح خانه
              <span className="rounded-full bg-amber-400/95 px-2 py-0.5 text-[9.5px] font-extrabold text-amber-950">موقت</span>
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              شش نمونه برای بخش بزرگ خانه (خوش‌آمد، جلسهٔ بعدی، ادامهٔ یادگیری، آمار، مرکز آزمون و جدیدترین مطالب) —
              هر نمونه هم‌زمان در هر سه تم رندر می‌شود. طرحی را که پسندیدی بگو تا همان در خانه پیاده شود.
            </p>
          </div>
        </div>

        {/* انتخاب نمونه */}
        <div className="mt-4 flex flex-wrap gap-2">
          {VARIANTS.map((x) => (
            <button
              key={x.id}
              onClick={() => setVid(x.id)}
              aria-pressed={x.id === vid}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11.5px] font-bold shadow-card ring-1 transition-all ${
                x.id === vid
                  ? "bg-primary text-primary-foreground ring-bronze/60"
                  : "bg-card text-muted-foreground ring-border hover:text-foreground"
              }`}
            >
              <x.icon className={`h-3.5 w-3.5 ${x.id === vid ? "text-bronze" : "text-bronze/70"}`} />
              {x.name}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] font-bold text-bronze">{v.tagline}</p>
      </div>

      {/* نمونهٔ انتخابی — در هر سه تم */}
      <div className="mt-6 space-y-8">
        {THEMES.map((t) => (
          <section key={t.id} className="space-y-2.5" aria-label={`نمونه در ${t.label}`}>
            <ThemeBadge theme={t.id} />
            <ThemeScope theme={t.id}>
              <v.Comp />
            </ThemeScope>
          </section>
        ))}
      </div>

      <p className="mt-7 text-center text-[11px] leading-relaxed text-muted-foreground">
        شمارهٔ طرحی که پسندیدی را بگو (مثلاً «طرح ۳») تا با همان هویت در صفحهٔ خانه پیاده شود؛
        ترکیب بخش‌هایی از دو طرح هم ممکن است.
      </p>
    </div>
  );
}

