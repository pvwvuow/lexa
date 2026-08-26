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
    <span className="inline-flex items-center gap-1 rounded-md border border-bronze/40 bg-bronze/10 px-2 py-0.5 text-xs font-semibold text-bronze">
      <Scale className="h-3 w-3" />
      مادهٔ {law.no}
      {law.source && law.source !== "قانون مدنی" ? (
        <span className="font-normal opacity-80">— {law.source}</span>
      ) : law.source === "قانون مدنی" ? null : null}
    </span>
  );
}

export function LawBox({ laws }: { laws: LawRef[] }) {
  return (
    <div className="space-y-3">
      {laws.map((l, i) => (
        <figure key={i} className="law-box rounded-xl p-4">
          <figcaption className="mb-2 flex items-center gap-2">
            <LawBadge law={l} />
          </figcaption>
          <blockquote className="text-[15px] leading-[1.9] text-foreground/90">{l.text}</blockquote>
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

/** انیمیشن بارگذاری معتبر — به جای اسپینر معمولی */
export function AIThinking({ label = "در حال تحلیل ماده قانونی" }: { label?: string }) {
  return (
    <div aria-live="polite" className="flex items-center gap-2 text-sm text-bronze">
      <Sparkles className="h-4 w-4 animate-pulse" />
      <span className="ai-dots font-medium">{label}</span>
    </div>
  );
}

/** نمودار دایره‌ای مینیمال */
export function Donut({ value, size = 92, stroke = 9, label }: { value: number; size?: number; stroke?: number; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`پیشرفت ${value} درصد`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-border" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="var(--bronze)" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${filled} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray .6s ease" }}
      />
      <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-lg font-bold">
        {fa(value)}٪
      </text>
      {label && (
        <text x="50%" y="66%" textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-[10px]">
          {label}
        </text>
      )}
    </svg>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-border ${className ?? ""}`}>
      <div
        className="h-full rounded-full bg-bronze transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function EmptyState({ title, desc, action }: { title: string; desc: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
      <GraduationCap className="mx-auto mb-3 h-8 w-8 text-bronze" />
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
