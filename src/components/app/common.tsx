"use client";

import * as React from "react";
import {
  Scale, BookOpen, HelpCircle, Lightbulb, ListChecks, GitCompareArrows,
  GraduationCap, Quote, FileText, Sparkles,
} from "lucide-react";
import type { SectionType, LawRef } from "@/lib/law/types";
import { fa } from "@/lib/fa";

export function CourseIcon({ icon, className }: { icon?: string; className?: string }) {
  const Ico = icon === "FileText" ? FileText : Scale;
  return <Ico className={className ?? "h-5 w-5"} />;
}

/** نشان شماره ماده با ارقام فارسی */
export function LawBadge({ law }: { law: LawRef }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-bronze/40 bg-bronze/10 px-2.5 py-0.5 text-xs font-semibold text-bronze">
      <Scale className="h-3 w-3" />
      مادهٔ {law.no}
      {law.source && law.source !== "قانون مدنی" && (
        <span className="font-normal opacity-80">— {law.source}</span>
      )}
    </span>
  );
}

/** باکس مادهٔ قانونی — حس «برگهٔ پرونده» با واترمارک و قاب طلایی */
export function LawBox({ laws }: { laws: LawRef[] }) {
  return (
    <div className="space-y-3">
      {laws.map((l, i) => (
        <figure key={i} className="law-box rounded-xl p-4 sm:p-5">
          <figcaption className="relative z-10 mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <LawBadge law={l} />
            <span className="text-[10px] font-medium tracking-wide text-muted-foreground/70">نصّ صریح قانون</span>
          </figcaption>
          <blockquote className="law-text relative z-10 text-[15.5px] leading-[2.05] text-foreground/90">{l.text}</blockquote>
        </figure>
      ))}
    </div>
  );
}

export const SECTION_META: Record<SectionType, { title: string; Icon: React.ComponentType<{ className?: string }>; tint: string }> = {
  intro: { title: "مقدمه و هدف جلسه", Icon: BookOpen, tint: "text-primary" },
  concept: { title: "تعریف و مفهوم", Icon: Lightbulb, tint: "text-warn" },
  law: { title: "مستند قانونی", Icon: Scale, tint: "text-bronze" },
  notes: { title: "نکات کلیدی و ریزه‌کاری‌ها", Icon: ListChecks, tint: "text-success" },
  example: { title: "مثال کاربردی / کیس فرضی", Icon: Quote, tint: "text-muted-foreground" },
  compare: { title: "جدول مقایسه‌ای", Icon: GitCompareArrows, tint: "text-primary" },
  summary: { title: "جمع‌بندی", Icon: GraduationCap, tint: "text-bronze" },
  question: { title: "سؤال تعاملی استاد", Icon: HelpCircle, tint: "text-primary" },
};

/** سرصفحهٔ هر بخش تدریس: شمارهٔ طلایی + آیکون + خط تزئینی */
export function SectionHead({ n, type, title }: { n: number; type: SectionType; title?: string }) {
  const meta = SECTION_META[type];
  const MIcon = meta.Icon;
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center gap-2.5">
        <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-bronze/35 bg-bronze/10 text-[13px] font-bold text-bronze">
          {fa(n)}
        </span>
        <MIcon className={`h-[18px] w-[18px] ${meta.tint}`} />
        <h2 className="flex-1 truncate font-bold text-[17px]">{title ?? meta.title}</h2>
      </div>
      <div aria-hidden className="ornament-rule" />
    </div>
  );
}

/** دکمه‌های تعاملی زیر جلسه */
export function ActionBtn({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium shadow-card transition-all duration-200 hover:-translate-y-px hover:border-bronze/60 hover:text-bronze disabled:opacity-50 disabled:hover:translate-y-0 ${rest.className ?? ""}`}
    >
      {children}
    </button>
  );
}

/** چاپ کوچک آماری برای هدر کارت‌ها */
export function StatChip({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-card">
      <Icon className="h-3.5 w-3.5 text-bronze" />
      {children}
    </span>
  );
}

/** انیمیشن بارگذاری معتبر — به جای اسپینر معمولی */
export function AIThinking({ label = "در حال تحلیل ماده قانونی" }: { label?: string }) {
  return (
    <div aria-live="polite" className="flex items-center gap-2 text-sm text-bronze">
      <Sparkles className="h-4 w-4 animate-pulse" />
      <span className="ai-dots font-medium">{label}</span>
    </div>
  );
}

/**
 * گیج پیشرفت نسخهٔ ۲ — حلقهٔ گرادیانی یشمی→طلایی با تیک‌های محیطی
 * (نام قبلی Donut حفظ شده تا جاهای دیگر نشکند)
 */
export function Donut({
  value, size = 92, stroke = 9, label,
}: { value: number; size?: number; stroke?: number; label?: string }) {
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const r = (size - stroke - 8) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(100, Math.max(0, value));
  const filled = (v / 100) * c;

  // تیک‌های ظریف محیط بیرونی
  const ticks = Array.from({ length: 36 }, (_, i) => i * 10);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`پیشرفت ${value} درصد`}>
      <defs>
        <linearGradient id={`g-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--bronze)" />
        </linearGradient>
      </defs>

      {/* تیک‌های محیطی */}
      <g opacity="0.22">
        {ticks.map((deg) => (
          <line
            key={deg} x1={size / 2} y1={4} x2={size / 2} y2={Math.max(6, stroke > 9 ? 9 : 7)}
            stroke="currentColor" strokeWidth="1" strokeLinecap="round"
            transform={`rotate(${deg + 90} ${size / 2} ${size / 2})`}
          />
        ))}
      </g>

      {/* ریل */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="text-border" stroke="currentColor" />
      {/* مقدار */}
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={`url(#g-${id})`} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${filled} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray .7s cubic-bezier(.4,0,.2,1)" }}
      />

      <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground font-display text-lg font-bold">
        {fa(v)}٪
      </text>
      {label && (
        <text x="50%" y="67%" textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-[10px]">
          {label}
        </text>
      )}
    </svg>
  );
}

/** نوار پیشرفت گرادیانی با برق ملایم */
export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-border/80 ${className ?? ""}`}>
      <div
        className="progress-sheen h-full rounded-full"
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          background: "linear-gradient(to left, var(--bronze), color-mix(in srgb, var(--primary) 82%, var(--bronze)))",
          transition: "width .55s cubic-bezier(.4,0,.2,1)",
        }}
      />
    </div>
  );
}

export function EmptyState({ title, desc, action }: { title: string; desc: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center shadow-card">
      <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-bronze/30 bg-bronze/10">
        <GraduationCap className="h-7 w-7 text-bronze" />
      </span>
      <p className="font-bold">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{desc}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
