"use client";

/* ═══ آزمایشگاه طرح خانه — قطعات مشترک نمونه‌ها ═══════════════════════════════
   داده‌ها ثابت و مطابق محتوای واقعی خانه؛ قطعات پایه (قاب تم، حلقهٔ پیشرفت،
   نوار پیشرفت، هفتهٔ استریک، کارت مطلب) بین همهٔ نمونه‌ها مشترک است. */

import * as React from "react";
import {
  PlayCircle, Clock3, Rss, Star, MessageCircle, Sun, Moon, Droplets,
  BookOpen, Briefcase,
} from "lucide-react";
import { UserAvatar } from "../common";

/* ─── دادهٔ ثابت نمونه‌ها — دقیقاً همان محتوای خانه ────────────────────────── */

export const GREETING = "شب بخیر، برای مرور شبانه آماده‌ای؟";
export const NEXT_TITLE = "جلسهٔ بعدی آماده است";
export const NEXT_COURSE = "حقوق مدنی ۷";
export const NEXT_LESSON = "ودیعه و عاریه؛ سنگرهای امانت";
export const EXAM_TITLE = "مرکز آزمون";
export const EXAM_DESC = "دفترچه‌های آمادهٔ تستی زمان‌سنج و تشریحی با پاسخ نمونه";
export const POSTS_TITLE = "جدیدترین مطالب";
export const POSTS_CTA = "مشاهده همه";
export const POSTS_HINT = "تازه‌ترین نوشته‌های اساتید";
export const BOOKS_LABEL = "۵ درس فعال";
export const STREAK_LABEL = "استریک ۱ روز";

export type LabPost = {
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

export const POSTS: LabPost[] = [
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

/* ─── قاب تم — هر نمونه در یک قاب با کلاس تم رندر می‌شود ───────────────────── */

export type LabTheme = "light" | "dark" | "glass";

export const THEMES: { id: LabTheme; label: string; hint: string }[] = [
  { id: "light", label: "تم روز", hint: "آلاباستر و یشمی" },
  { id: "dark", label: "تم شب", hint: "کتابخانهٔ شب" },
  { id: "glass", label: "تم شیشه‌ای", hint: "آۆرایی و شیشه" },
];

export function ThemeScope({ theme, children }: { theme: LabTheme; children: React.ReactNode }) {
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

export function ThemeBadge({ theme }: { theme: LabTheme }) {
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

/* ─── دکمهٔ طلایی — همان جنس دکمهٔ روز/شب که کاربر آن را تأیید کرده ────────── */

export function LabGoldCta({ label = "ادامه یادگیری" }: { label?: string }) {
  return (
    <span
      role="presentation"
      className="group relative mt-1 inline-flex cursor-default items-center gap-2 whitespace-nowrap overflow-hidden rounded-xl bg-gradient-to-br from-[#ecd29a] via-[#cda65e] to-[#8a6a30] px-5 py-2.5 text-sm font-bold text-[#1b1408] shadow-[0_3px_12px_-3px_rgba(205,166,94,0.65),inset_0_1px_0_rgba(255,255,255,0.5)] ring-1 ring-[#f6e7c1]/70 transition-all duration-300 hover:shadow-[0_5px_18px_-3px_rgba(205,166,94,0.85),inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-[1.06] active:scale-[.98]"
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/40 via-white/5 to-black/15" />
      <span aria-hidden className="pointer-events-none absolute -top-1/2 start-[-20%] h-[180%] w-2/3 rotate-12 bg-white/25 blur-[6px] transition-transform duration-500 group-hover:translate-x-[120%]" />
      <PlayCircle className="relative h-[18px] w-[18px]" />
      <span className="relative">{label}</span>
    </span>
  );
}

/* ─── حلقهٔ پیشرفت (SVG) — برای «مرور امشب» و مشابه‌ها ─────────────────────── */

export function ProgressRing({
  pct, size = 132, stroke = 10, gid, from = "#ecd29a", to = "#1d4b40",
  track = "stroke-foreground/10", children, className = "",
}: {
  pct: number; size?: number; stroke?: number; gid: string;
  from?: string; to?: string; track?: string; children?: React.ReactNode; className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={track} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          stroke={`url(#${gid})`} strokeDasharray={c} strokeDashoffset={off}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/* ─── نوار پیشرفت ─────────────────────────────────────────────────────────── */

export function LabBar({ pct, dark = false, className = "" }: { pct: number; dark?: boolean; className?: string }) {
  return (
    <div className={`h-1.5 overflow-hidden rounded-full ${dark ? "bg-white/15" : "bg-foreground/10"} ${className}`}>
      <div
        className="h-full rounded-full bg-gradient-to-l from-bronze to-[#cda65e]/70"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

/* ─── هفتهٔ استریک — شنبه تا جمعه ──────────────────────────────────────────── */

const WEEK_DAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

export function WeekDots({ done = 2, today = 2 }: { done?: number; today?: number }) {
  return (
    <div className="flex gap-1.5" dir="rtl">
      {WEEK_DAYS.map((d, i) => {
        const isDone = i < done;
        const isToday = i === today;
        return (
          <span
            key={d}
            className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-extrabold transition-colors ${
              isDone
                ? "bg-gradient-to-br from-[#ecd29a] to-[#cda65e] text-[#1b1408] shadow-[0_0_0_3px_rgba(205,166,94,0.18)]"
                : isToday
                  ? "border border-dashed border-bronze/70 text-bronze"
                  : "bg-foreground/[0.07] text-muted-foreground/60"
            }`}
          >
            {d}
          </span>
        );
      })}
    </div>
  );
}

/* ─── سرصفحهٔ «جدیدترین مطالب» ─────────────────────────────────────────────── */

export function PostsHeader({ tone }: { tone: "onGreen" | "ink" | "gold" | "white" }) {
  const title =
    tone === "onGreen" || tone === "white" ? "text-white" : tone === "gold" ? "text-bronze" : "text-foreground";
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

/* ─── کارت مطلب سفید مات (زبان «feed-card» فعلی) ───────────────────────────── */

export function LabPostCardMatte({ p, className = "" }: { p: LabPost; className?: string }) {
  const Icon = p.Icon;
  return (
    <div className={`feed-card group relative cursor-default overflow-hidden rounded-[24px] text-start transition-[border-color,box-shadow] duration-200 ${className}`}>
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

/* ─── کارت مطلب کاملاً شیشه‌ای — متن سفید روی شیشهٔ مایع ───────────────────── */

export function LabPostCardGlass({ p, className = "" }: { p: LabPost; className?: string }) {
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
