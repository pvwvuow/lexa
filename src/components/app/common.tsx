"use client";

import * as React from "react";
import {
  Scale, BookOpen, HelpCircle, Lightbulb, ListChecks, GitCompareArrows,
  GraduationCap, Quote, FileText, Sparkles, BookOpenCheck, Handshake,
  AlertTriangle, Zap, Info, Compass,
} from "lucide-react";
import type { SectionType, LawRef, LessonSection } from "@/lib/law/types";
import { fa } from "@/lib/fa";

export function CourseIcon({ icon, className }: { icon?: string; className?: string }) {
  const Ico = icon === "FileText" ? FileText : icon === "BookOpenCheck" ? BookOpenCheck : icon === "Handshake" ? Handshake : Scale;
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

/** جداکنندهٔ گروه محتوا — وقتی چند بلوک متفاوت (مثلاً کارت اصطلاح و سپس باکس ماده)
 *  در یک سکشن پشت هم می‌آیند، مرز بصری واضح بینشان می‌گذارد تا «توی هم» نیفتند */
export function BlockDivider({ label, Icon = Scale }: { label: string; Icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div role="separator" className="my-6 flex items-center gap-3">
      <span aria-hidden className="grid h-7 w-7 shrink-0 rotate-45 place-items-center rounded-[8px] border border-bronze/40 bg-card shadow-card">
        <Icon className="h-3.5 w-3.5 -rotate-45 text-bronze" />
      </span>
      <span className="shrink-0 font-display text-[12.5px] font-bold tracking-wide text-bronze">{label}</span>
      <span aria-hidden className="h-px flex-1 bg-gradient-to-l from-transparent via-bronze/40 to-transparent" />
    </div>
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

/* ── برگهٔ مرور — رندر اختصاصی جمع‌بندی ═══════════════════════════════════════
 * به‌جای کارت‌های مستطیلیِ تکراری، حس «برگهٔ چکیدهٔ پرونده»: اعداد آویزان، متن
 * روان و جداکنندهٔ مویی. حالت خودآزمایی هم دارد: ابتدا جمله پنهان است و با کلیک
 * روی هر ردیف، پاسخ همان نکته باز می‌شود (یادآوری فعال). */
export function SummarySheet({ items }: { items: string[] }) {
  const parsed = React.useMemo(
    () => items.map((x) => parseTermLine(x.replace(NUM_RE, "").trim())),
    [items],
  );
  const [veil, setVeil] = React.useState(false);
  const [shown, setShown] = React.useState<Set<number>>(new Set());
  const revealed = shown;

  React.useEffect(() => {
    setShown(new Set());
    setVeil(false);
  }, [items]);

  if (!parsed.length) return null;

  const reveal = (i: number) => setShown((s) => { const n = new Set(s); n.add(i); return n; });

  return (
    <div>
      {/* نوار ابزار برگه */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11.5px] font-medium text-muted-foreground">
          چکیدهٔ جلسه در {fa(parsed.length)} نکته{veil && <> — {fa(revealed.size)} از {fa(parsed.length)} باز شده</>}
        </span>
        <button
          onClick={() => { setVeil((v) => !v); setShown(new Set()); }}
          aria-pressed={veil}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-bold transition-colors ${
            veil ? "border-bronze bg-bronze/15 text-bronze" : "border-border bg-background text-muted-foreground hover:border-bronze/50 hover:text-bronze"
          }`}
        >
          {veil ? <EyeOn className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {veil ? "پایان خودآزمایی" : "خودآزمایی؛ اول فکر کن"}
        </button>
      </div>

      <ol className="relative">
        {parsed.map((it, i) => {
          const hidden = veil && !revealed.has(i);
          return (
            <li key={i} className="group relative py-4 first:pt-2 last:pb-2">
              {/* جداکنندهٔ مویی بین ردیف‌ها */}
              {i > 0 && <span aria-hidden className="absolute inset-x-1 top-0 h-px bg-gradient-to-l from-transparent via-border to-transparent" />}
              <div className="flex gap-4">
                {/* عدد آویزان — بدون قاب، فقط رقم سایه‌دار */}
                <span aria-hidden className="pointer-events-none w-8 shrink-0 select-none pt-1 text-center font-display text-[26px] font-bold leading-none text-bronze/35 transition-colors duration-200 group-hover:text-bronze/60" style={{ fontVariantNumeric: "normal" }}>
                  {fa(i + 1)}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  {it.term && <p className="mb-1 font-display text-[16.5px] font-bold tracking-wide text-primary">{it.term}</p>}
                  {hidden ? (
                    <button
                      onClick={() => reveal(i)}
                      className="flex w-full items-center gap-2 rounded-lg border border-dashed border-bronze/40 bg-bronze/[0.04] px-3.5 py-2.5 text-start transition-colors hover:bg-bronze/10"
                      aria-label={`نمایش نکتهٔ ${fa(i + 1)}`}
                    >
                      <EyeOff className="h-4 w-4 shrink-0 text-bronze" />
                      <span className="text-[13px] font-medium text-bronze">جمله را از حفظ بگو، بعد برای مقایسه بازش کن</span>
                    </button>
                  ) : (
                    <p className={`font-body whitespace-pre-line text-[18.5px] leading-[2.05] text-foreground/95 transition-opacity duration-300`}>{it.text}</p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <div aria-hidden className="mx-auto mt-2 h-px w-24 bg-gradient-to-l from-transparent via-bronze/50 to-transparent" />
    </div>
  );
}

function EyeOff({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOn({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="m1 1 22 22" />
    </svg>
  );
}

/** رندر بدنهٔ درس: پاراگراف + کارت اصطلاح + پله‌نما (تشخیص خودکار نکتهٔ مهم) */
export function BodyRich({ text }: { text: string }) {
  const blocks = React.useMemo(() => parseBody(text), [text]);
  return (
    <div className="space-y-4">
      {blocks.map((b, i) => {
        if (b.kind === "p") {
          // تشخیص «نکتهٔ مهم» خط‌به‌خط — پاراگراف‌های معمولی و المان‌های مهم
          // می‌توانند در یک بلوک کنار هم باشند؛ هر خط جداگانه ارزیابی می‌شود
          const pieces = b.text.split("\n");
          const rendered: React.ReactNode[] = [];
          let buf: string[] = [];
          const flush = (key: string) => {
            if (buf.length)
              rendered.push(
                <p key={key} className="whitespace-pre-line text-[20px] leading-[2.15] text-foreground/95">
                  {buf.join("\n")}
                </p>,
              );
            buf = [];
          };
          pieces.forEach((ln, k) => {
            const imp = detectImportant(ln);
            if (imp) {
              flush(`p-${i}-${k}`);
              rendered.push(
                <ImportantNote key={`i-${i}-${k}`} variant={imp.variant} label={imp.label}>
                  {imp.rest}
                </ImportantNote>,
              );
            } else buf.push(ln);
          });
          flush(`p-${i}-end`);
          if (rendered.length === 1 && React.isValidElement(rendered[0])) return rendered[0];
          return <React.Fragment key={i}>{rendered}</React.Fragment>;
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

/** رندر آرایهٔ bullets (بخش نکات/جمع‌بندی) با برگهٔ لوزی‌نشان بدون کارت مستطیلی */
export function BulletRich({ items }: { items: string[] }) {
  return <KeyNotesSheet items={items} />;
}

/* ── برگهٔ نکات کلیدی — جایگزین شبکهٔ کارت‌های مستطیلی ════════════════════════
 * زبان طراحی اپ: نشان لوزیِ چرخان، خط مویی جداکننده و رنگ‌بندی چرخشی
 * برنز/یشمی/کهربایی؛ هرگز قاب مستطیلی تکراری. */

const KEY_ACCENTS = [
  { dot: "bg-bronze", term: "text-bronze", glow: "shadow-[0_0_0_3px_color-mix(in_srgb,var(--bronze)_12%,transparent)]" },
  { dot: "bg-success", term: "text-success", glow: "" },
  { dot: "bg-warn", term: "text-warn", glow: "" },
] as const;

export function KeyNotesSheet({ items }: { items: string[] }) {
  const parsed = React.useMemo(() => items.map(parseTermLine), [items]);
  if (!parsed.length) return null;

  return (
    <div className="relative">
      {/* نقش پس‌زمینه: مهِ نرمِ رنگی، نه قاب */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-2 inset-x-[-14px] opacity-[0.05]"
        style={{ background: "radial-gradient(420px 180px at 85% 0%, var(--bronze), transparent 70%)" }}
      />
      <ListChecks aria-hidden className="pointer-events-none absolute -bottom-5 start-1 h-16 w-16 -rotate-6 text-bronze/[0.06]" />

      <ul className="relative">
        {parsed.map((it, i) => {
          const acc = KEY_ACCENTS[i % KEY_ACCENTS.length];
          return (
            <li key={i} className="group relative py-3.5 first:pt-0 last:pb-1">
              {i > 0 && (
                <span aria-hidden className="absolute inset-x-2 top-0 h-px bg-gradient-to-l from-transparent via-border to-transparent" />
              )}
              <div className="flex gap-3.5">
                <span aria-hidden className={`mt-[11px] h-2 w-2 shrink-0 rotate-45 rounded-[2px] ${acc.dot}`} />
                <div className="min-w-0 flex-1">
                  {it.term && (
                    <p className={`font-display mb-0.5 text-[15.5px] font-bold tracking-wide ${acc.term}`}>{it.term}</p>
                  )}
                  <p className="whitespace-pre-line font-body text-[18px] leading-[1.95] text-foreground/95">{it.text}</p>
                  {it.subs?.map((sub, k) => (
                    <p key={k} className="mt-1 flex gap-2 ps-4 text-[17px] leading-[1.9] text-muted-foreground">
                      <span aria-hidden className={`mt-[13px] h-1.5 w-1.5 shrink-0 rotate-45 rounded-[1.5px] ${acc.dot} opacity-70`} />
                      <span>
                        {sub.term && <strong className="font-display text-[15px]">{sub.term}: </strong>}
                        {sub.text}
                      </span>
                    </p>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* چکیدهٔ پایانی برگه */}
      <div aria-hidden className="mx-auto mt-3 h-px w-20 bg-gradient-to-l from-transparent via-bronze/50 to-transparent" />
    </div>
  );
}

/* ── المان «نکتهٔ مهم» در دل متن ══════════════════════════════════════════════
 * باند تمام‌عرض بدون قاب مستطیلی: میلهٔ گردِ رنگی + لوزی آیکون + پس‌زمینهٔ
 * محو رنگی متناسب با شدت پیام (هشدار سرخ، مهم کهربا، ترفند یشمی، یادآوری سرمه‌ای). */

type ImpVariant = "warn" | "danger" | "success" | "info";

type ImpIcon = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
const IMP_STYLE: Record<ImpVariant, { colorVar: string; icon: ImpIcon; fallbackLabel: string }> = {
  warn: { colorVar: "--warn", icon: AlertTriangle, fallbackLabel: "نکتهٔ مهم" },
  danger: { colorVar: "--destructive", icon: AlertTriangle, fallbackLabel: "هشدار" },
  success: { colorVar: "--success", icon: Zap, fallbackLabel: "ترفند" },
  info: { colorVar: "--primary", icon: Info, fallbackLabel: "یادآوری" },
};

/** تشخیص پاراگراف‌های «نکتهٔ مهم» از سرنخ متن — برای reuse در رندررها.
 *  هم «هشدار: …» و هم برچسب‌های بلندتر مثل «هشدار اهلیت در عاریه: …» را می‌گیرد. */
export function detectImportant(text: string): { variant: ImpVariant; label: string; rest: string } | null {
  const m = text.match(
    /^\s*(⚠️|❗|📌|🚨)?\s*\[?\s*((هشدار|توجه مهم|توجه|مهم|نکتهٔ مهم|نکته مهم|یادآوری|ترفند)[^:：\n]{0,42}?)\s*\]?\s*[:：]\s*/,
  );
  if (!m) return null;
  const kw = m[3];
  const fullLabel = m[2].trim();
  let variant: ImpVariant = "warn";
  if (/هشدار/.test(kw)) variant = "danger";
  else if (/ترفند/.test(kw)) variant = "success";
  else if (/یادآوری/.test(kw)) variant = "info";
  else variant = "warn";
  return { variant, label: fullLabel, rest: text.slice(m[0].length).trim() };
}

export function ImportantNote({ variant = "warn", label, children }: {
  variant?: ImpVariant;
  label?: string;
  children: React.ReactNode;
}) {
  const st = IMP_STYLE[variant];
  const Icon = st.icon;
  const cvar = `var(${st.colorVar})`;
  return (
    <aside role="note" className="relative my-2 overflow-hidden rounded-s-full bg-transparent py-1">
      {/* مه رنگی از سمت شروع — بدون قاب */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(to left, transparent 55%, color-mix(in srgb, " + cvar + " 10%, transparent) 88%)" }}
      />
      <span
        aria-hidden
        className="absolute inset-y-1 start-0 w-[3.5px] rounded-full"
        style={{ background: "linear-gradient(to bottom, " + cvar + ", color-mix(in srgb, " + cvar + " 35%, transparent))" }}
      />
      <div className="relative flex gap-3.5 py-2 pe-2 ps-4 sm:ps-5">
        <span
          aria-hidden
          className="mt-1 grid h-9 w-9 shrink-0 rotate-45 place-items-center rounded-[9px] shadow-card"
          style={{ border: "1px solid color-mix(in srgb, " + cvar + " 45%, transparent)", background: "color-mix(in srgb, " + cvar + " 12%, transparent)" }}
        >
          <Icon className="-rotate-45 h-4 w-4" style={{ color: cvar }} />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="font-display mb-0.5 text-[12px] font-extrabold tracking-wide" style={{ color: cvar }}>
            {label ?? st.fallbackLabel}
          </p>
          <div className="whitespace-pre-line font-body text-[18px] leading-[1.95] text-foreground/95">{children}</div>
        </div>
      </div>
    </aside>
  );
}

/* ── رندرر مشترک بخش‌های تدریس ════════════════════════════════════════════════
 * همان موتور صفحهٔ تدریس؛ مطالب اساتید هم دقیقاً با همین المان‌ها رندر می‌شوند
 * تا «موقع نوشتن» استاد از طراحی اصلی اپ استفاده کند. */

/** بخش type=notes → برگهٔ نکات؛ بقیهٔ bullets هم با همان سبک جمع‌وجورتر */
function BulletsZone({ section }: { section: LessonSection }) {
  const isSummary = section.type === "summary";
  const isNotes = section.type === "notes";
  return (
    <div className="pt-2">
      {(isNotes || isSummary) ? (
        isSummary ? (
          <>
            {section.body && <BlockDivider label="چکیدهٔ نهایی" Icon={ListChecks} />}
            <SummarySheet items={section.bullets!} />
          </>
        ) : (
          <KeyNotesSheet items={section.bullets!} />
        )
      ) : (
        <>
          {section.body && <BlockDivider label="نکته‌های کلیدی این بخش" Icon={Compass} />}
          <KeyNotesSheet items={section.bullets!} />
        </>
      )}
    </div>
  );
}

export function SectionBody({ s, decorativeHeadless }: { s: LessonSection; decorativeHeadless?: boolean }) {
  return (
    <>
      {s.body && (
        <div className="teach-body text-foreground/95">
          <BodyRich text={s.body} />
        </div>
      )}

      {s.law && s.law.length > 0 && (
        <div className="pt-2">
          {(s.body || s.bullets) && !decorativeHeadless && <BlockDivider label="مستند قانونی این بخش" Icon={Scale} />}
          <LawBox laws={s.law} />
        </div>
      )}

      {s.bullets && s.bullets.length > 0 && <BulletsZone section={s} />}

      {s.table && (
        <div className="mt-4 overflow-hidden rounded-xl border border-border shadow-card">
          <table className="w-full min-w-[520px] text-sm">
            <thead><tr className="bg-primary text-primary-foreground">{s.table.headers.map((h, k) => <th key={k} className="px-4 py-3 text-start font-display text-[13px] font-semibold">{h}</th>)}</tr></thead>
            <tbody>
              {s.table.rows.map((r, k) => (
                <tr key={k} className="border-t border-border odd:bg-muted/35 hover:bg-accent/60">{r.map((c, m) => <td key={m} className={`px-4 py-3 align-top leading-[1.85] ${m === 0 ? "font-semibold text-primary" : ""}`}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {s.questionText && (
        <div className="relative mt-4 overflow-hidden rounded-xl border border-bronze/30 bg-gradient-to-l from-bronze/[0.09] to-transparent p-4">
          <HelpCircle aria-hidden className="absolute -bottom-3 -start-3 h-16 w-16 text-bronze/10" />
          <p className="font-body relative z-10 text-[18px] font-semibold leading-loose">{s.questionText}</p>
          {s.suggestedAnswer && (
            <details className="relative z-10 mt-3 text-sm">
              <summary className="cursor-pointer select-none font-medium text-bronze transition-colors hover:text-primary">نمایش پاسخ پیشنهادی</summary>
              <p className="mt-2 rounded-lg bg-background/60 p-3 text-[15.5px] leading-loose text-muted-foreground">{s.suggestedAnswer}</p>
            </details>
          )}
        </div>
      )}
    </>
  );
}
