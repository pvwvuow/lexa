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
          <blockquote className="law-text relative z-10 text-[19px] leading-[2.1] text-foreground/90">{l.text}</blockquote>
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
  value, size = 92, stroke = 9, label, flat,
}: { value: number; size?: number; stroke?: number; label?: string; flat?: boolean }) {
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const r = (size - stroke - 8) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(100, Math.max(0, value));
  const filled = (v / 100) * c;

  // تیک‌های ظریف محیط بیرونی
  const ticks = Array.from({ length: 36 }, (_, i) => i * 10);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`پیشرفت ${value} درصد`}>
      {!flat && (
        <defs>
          <linearGradient id={`g-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--bronze)" />
          </linearGradient>
        </defs>
      )}

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
        stroke={flat ? "var(--bronze)" : `url(#g-${id})`} strokeWidth={stroke} strokeLinecap="round"
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

/* ═══ موتور محتوای غنی: تبدیل متن درس به بلوک‌های ساخت‌یافته ═══════════════ */

type SubItem = { term?: string; text: string };
type TermItem = { term?: string; text: string; subs?: SubItem[] };
type BodyBlock =
  | { kind: "p"; text: string }
  | { kind: "terms"; items: TermItem[] }
  | { kind: "steps"; items: string[] };

const DASH_RE = /^[-–•*]\s+/;
const NUM_RE = /^[0-9۰-۹]{1,2}\s*[-–.)))]\s*/;

type RunKind = "p" | "dash" | "num";

/** جداسازی عنوان و توضیح از خطوطی مثل «اهلیت تمتع: توان دارا شدن حق» */
function parseTermLine(line: string): TermItem {
  const raw = line.replace(/^[-–•*]\s+/, "").trim();
  const m = raw.match(/^(«?[^«»:：]{2,44}»?)\s*[:：]\s+(.+)$/);
  if (m) return { term: m[1].replace(/^«/, "").replace(/»$/, ""), text: m[2].trim() };
  return { text: raw };
}

/** بدنهٔ درس را به پاراگراف / کارت اصطلاح / پله‌نما تبدیل می‌کند.
 *  خط‌به‌خط گروه‌بندی می‌شود؛ هیچ جملهٔ مقدمه‌ای حذف نمی‌شود و
 *  خطوط فرورفته به‌عنوان زیرمجموعهٔ آیتم قبلی رندر می‌شوند. */
export function parseBody(body: string): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  let paraBuf: string[] = [];
  const flushPara = () => {
    if (paraBuf.length) {
      blocks.push({ kind: "p", text: paraBuf.join("\n") });
      paraBuf = [];
    }
  };

  for (const chunk of body.split(/\n{2,}/)) {
    const rawLines = chunk.split("\n").filter((l) => l.trim());
    if (!rawLines.length) continue;

    // گروه‌بندی خط‌های پیوستهٔ هم‌نوع
    const runs: { kind: RunKind; lines: string[] }[] = [];
    for (const raw of rawLines) {
      const t = raw.trim();
      const kind: RunKind = DASH_RE.test(t) ? "dash" : NUM_RE.test(t) ? "num" : "p";
      const lastRun = runs[runs.length - 1];
      if (kind === "p") {
        if (!lastRun || lastRun.kind !== "p") runs.push({ kind: "p", lines: [raw] });
        else lastRun.lines.push(raw);
      } else if (lastRun && lastRun.kind === kind) lastRun.lines.push(raw);
      else runs.push({ kind, lines: [raw] });
    }

    for (const run of runs) {
      if (run.kind === "p") {
        paraBuf.push(run.lines.map((l) => l.trim()).join("\n"));
        continue;
      }
      flushPara();
      if (run.kind === "num") {
        blocks.push({ kind: "steps", items: run.lines.map((l) => l.replace(NUM_RE, "").trim()) });
      } else {
        const items: TermItem[] = [];
        for (const raw of run.lines) {
          const indented = /^[ \t]/.test(raw);
          const parsed = parseTermLine(raw.trim());
          if (indented && items.length) {
            const parent = items[items.length - 1];
            (parent.subs ??= []).push({ term: parsed.term, text: parsed.text });
          } else items.push(parsed);
        }
        blocks.push({ kind: "terms", items });
      }
    }
  }
  flushPara();
  return blocks;
}

/** کارت اصطلاح‌نامه — قاب دوخط، نشان لوزی، عنوان طلایی و واترمارک کتاب */
export function TermCard({ item, index }: { item: TermItem; index?: number }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-bronze/30 bg-accent/40 p-4 transition-colors duration-200 hover:border-bronze/55 sm:p-5">
      <span aria-hidden className="pointer-events-none absolute inset-1.5 rounded-lg border border-bronze/15" />
      <BookOpen aria-hidden className="pointer-events-none absolute -bottom-4 -start-4 h-16 w-16 rotate-12 text-bronze/[0.07]" />
      <div className="relative z-10">
        <div className="mb-2.5 flex items-center gap-3">
          {index !== undefined && (
            <span aria-hidden className="grid h-7 w-7 shrink-0 rotate-45 place-items-center rounded-[9px] border border-bronze/40 bg-card shadow-card">
              <span className="-rotate-45 text-[11.5px] font-bold leading-none text-bronze">{fa(index)}</span>
            </span>
          )}
          <h4 className="min-w-0 break-words font-display text-[17px] font-bold text-bronze">{item.term}</h4>
        </div>
        <div aria-hidden className="ornament-rule mb-3 opacity-80" />
        <p className="font-body text-[18px] leading-[2] text-foreground/95">{item.text}</p>
        {item.subs && item.subs.length > 0 && (
          <ul className="mt-3 space-y-2.5 border-t border-dashed border-bronze/25 pt-3">
            {item.subs.map((sub, k) => (
              <li key={k} className="flex gap-2.5">
                <span aria-hidden className="mt-[13px] h-1.5 w-1.5 shrink-0 rotate-45 rounded-[1.5px] bg-bronze/70" />
                <span className="font-body min-w-0 flex-1 text-[17px] leading-[1.95] text-foreground/90">
                  {sub.term && <strong className="font-display text-[15.5px] text-primary">{sub.term}: </strong>}
                  {sub.text}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** پله‌نما — مدال‌های مات روی یک ریل پیوسته (بدون نفوذ به ردیف بعد) */
export function StepList({ items }: { items: string[] }) {
  return (
    <ol className="relative space-y-3">
      {items.length > 1 && (
        <span aria-hidden className="pointer-events-none absolute bottom-[18px] start-[17px] top-[18px] w-px border-s border-dashed border-bronze/40" />
      )}
      {items.map((t, i) => {
        const parsed = parseTermLine(t);
        return (
          <li key={i} className="relative flex gap-3">
            <span className="relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-bronze/45 bg-card text-[13.5px] font-bold text-bronze shadow-card">
              {fa(i + 1)}
            </span>
            <span className="font-body min-w-0 flex-1 rounded-xl border border-border bg-muted/45 px-4 py-3 text-[18px] leading-[1.95] transition-colors duration-150 hover:bg-accent/50">
              {parsed.term ? (
                <>
                  <strong className="font-display text-[16px] text-primary">{parsed.term}: </strong>
                  {parsed.text}
                </>
              ) : t}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** لیست نکتهٔ ساده با لوزی طلایی */
function PlainList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((b, j) => (
        <li key={j} className="flex gap-2.5 rounded-xl border-e-2 border-transparent px-3 py-2 text-[18px] leading-[1.95] transition-colors hover:border-bronze/50 hover:bg-muted/40">
          <span aria-hidden className="mt-[15px] h-2 w-2 shrink-0 rotate-45 rounded-[2px] bg-bronze/80" />
          <span className="font-body">{b}</span>
        </li>
      ))}
    </ul>
  );
}

/** رندر بدنهٔ درس: پاراگراف + کارت اصطلاح + پله‌نما */
export function BodyRich({ text }: { text: string }) {
  const blocks = React.useMemo(() => parseBody(text), [text]);
  return (
    <div className="space-y-4">
      {blocks.map((b, i) => {
        if (b.kind === "p") {
          return (
            <p key={i} className="whitespace-pre-line text-[20px] leading-[2.15] text-foreground/95">
              {b.text}
            </p>
          );
        }
        if (b.kind === "steps") return <StepList key={i} items={b.items} />;
        const withTerm = b.items.filter((x) => x.term || x.subs).length >= Math.ceil(b.items.length / 2);
        if (!withTerm) return <PlainList key={i} items={b.items.map((x) => x.text)} />;
        return (
          <div key={i} className="grid items-start gap-3 md:grid-cols-2">
            {b.items.map((x, j) => <TermCard key={j} item={x} index={b.items.length > 1 && (x.term || x.subs) ? j + 1 : undefined} />)}
          </div>
        );
      })}
    </div>
  );
}

/** رندر آرایهٔ bullets (بخش نکات/جمع‌بندی) با تشخیص خودکار اصطلاح یا شماره */
export function BulletRich({ items }: { items: string[] }) {
  const parsed = items.map(parseTermLine);
  const termCount = parsed.filter((x) => x.term || x.subs).length;
  const numCount = items.filter((x) => NUM_RE.test(x.trim())).length;
  if (termCount >= Math.ceil(parsed.length / 2)) {
    return (
      <div className="grid items-start gap-3 md:grid-cols-2">
        {parsed.map((x, j) => <TermCard key={j} item={x} index={parsed.length > 1 && (x.term || x.subs) ? j + 1 : undefined} />)}
      </div>
    );
  }
  if (numCount >= Math.ceil(items.length / 2)) {
    return <StepList items={items.map((x) => x.replace(NUM_RE, "").trim())} />;
  }
  return <PlainList items={items} />;
}
