"use client";
/* Console UI kit (phase A1 of docs/ADMIN_PLATFORM.md): one consistent "workspace" look for the
 * Lexa platform console and, from A2, the centre console. Full-height frame with a grouped side
 * navigation, a top bar with breadcrumbs, page headers, panels, KPI tiles, charts, tables,
 * drawers and confirmation dialogs. RTL, light/dark, no extra dependencies. */
import * as React from "react";
import { AlertTriangle, ChevronLeft, Inbox, Loader2, Menu, RefreshCw, Search, X } from "lucide-react";

export type Tone = "ok" | "warn" | "bad" | "info" | "muted" | "brand";
export type IconType = React.ComponentType<{ className?: string }>;

const TONE_TEXT: Record<Tone, string> = {
  ok: "text-emerald-700 dark:text-emerald-400",
  warn: "text-amber-700 dark:text-amber-400",
  bad: "text-red-700 dark:text-red-400",
  info: "text-sky-700 dark:text-sky-400",
  muted: "text-muted-foreground",
  brand: "text-bronze",
};
const TONE_SOFT: Record<Tone, string> = {
  ok: "bg-emerald-500/10 border-emerald-500/25",
  warn: "bg-amber-500/10 border-amber-500/30",
  bad: "bg-red-500/10 border-red-500/25",
  info: "bg-sky-500/10 border-sky-500/25",
  muted: "bg-muted/60 border-border",
  brand: "bg-bronze/10 border-bronze/30",
};
const TONE_DOT: Record<Tone, string> = {
  ok: "bg-emerald-500", warn: "bg-amber-500", bad: "bg-red-500", info: "bg-sky-500", muted: "bg-muted-foreground/50", brand: "bg-bronze",
};

export function cx(...a: (string | false | null | undefined)[]): string {
  return a.filter(Boolean).join(" ");
}

// ─── frame ─────────────────────────────────────────────────────────────────────────────────────
export interface NavItem { key: string; label: string; icon: IconType; badge?: number | null; tone?: Tone }
export interface NavGroup { label: string; items: NavItem[] }

export function ConsoleFrame({
  product, workspace, groups, active, onSelect, footer, crumbs, topActions, children,
}: {
  product: string;
  workspace: string;
  groups: NavGroup[];
  active: string;
  onSelect: (key: string) => void;
  footer?: React.ReactNode;
  crumbs: string[];
  topActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const select = (k: string) => { setOpen(false); onSelect(k); };
  const nav = (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#0b1c16] via-[#0f251d] to-[#0b1c16] text-white/80">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#d9b877] via-bronze to-[#8a6a30] font-extrabold text-[#132018] shadow">L</span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[15px] font-extrabold text-white">{product}</span>
          <span className="block truncate text-[10.5px] font-semibold text-bronze">{workspace}</span>
        </span>
      </div>
      <nav aria-label="ناوبری کنسول" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="px-3 pb-1.5 text-[10.5px] font-bold tracking-wide text-white/40">{g.label}</p>
            <div className="space-y-0.5">
              {g.items.map((it) => {
                const on = it.key === active;
                const Icon = it.icon;
                return (
                  <button key={it.key} type="button" onClick={() => select(it.key)} aria-current={on ? "page" : undefined}
                    className={cx(
                      "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                      on ? "bg-white/[0.09] text-white" : "hover:bg-white/[0.05] hover:text-white",
                    )}>
                    {on && <span aria-hidden className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-bronze" />}
                    <Icon className={cx("h-[17px] w-[17px] shrink-0", on ? "text-bronze" : "text-white/55 group-hover:text-white/80")} />
                    <span className="min-w-0 flex-1 truncate text-start">{it.label}</span>
                    {!!it.badge && (
                      <span className={cx("min-w-[22px] rounded-full px-1.5 py-0.5 text-center text-[10.5px] font-bold tabular-nums",
                        it.tone === "bad" ? "bg-red-500/90 text-white" : it.tone === "warn" ? "bg-amber-400 text-[#1b1405]" : "bg-white/15 text-white")}>
                        {it.badge.toLocaleString("fa-IR")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      {footer && <div className="shrink-0 border-t border-white/10 p-3">{footer}</div>}
    </div>
  );

  return (
    <div dir="rtl" className="flex min-h-screen bg-muted/30 text-foreground">
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 lg:block">{nav}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal>
          <button type="button" aria-label="بستن منو" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 start-0 w-[270px] shadow-2xl">{nav}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur sm:px-6">
          <button type="button" onClick={() => setOpen(true)} className="grid h-9 w-9 place-items-center rounded-lg border border-border lg:hidden" aria-label="منو">
            <Menu className="h-4 w-4" />
          </button>
          <ol className="flex min-w-0 items-center gap-1.5 text-[13px]">
            {crumbs.map((c, i) => (
              <li key={i} className="flex min-w-0 items-center gap-1.5">
                {i > 0 && <ChevronLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
                <span className={cx("truncate", i === crumbs.length - 1 ? "font-bold text-foreground" : "text-muted-foreground")}>{c}</span>
              </li>
            ))}
          </ol>
          <div className="ms-auto flex items-center gap-2">{topActions}</div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

// ─── page parts ──────────────────────────────────────────────────────────────────────────────
export function PageHeader({ title, description, actions, meta }: {
  title: string; description?: string; actions?: React.ReactNode; meta?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-[22px] font-extrabold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
        {meta && <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-muted-foreground">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, description, actions, children, className, bodyClass, icon: Icon }: {
  title?: string; description?: string; actions?: React.ReactNode; children: React.ReactNode;
  className?: string; bodyClass?: string; icon?: IconType;
}) {
  return (
    <section className={cx("rounded-xl border border-border bg-card shadow-sm", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="flex items-center gap-2 text-[13.5px] font-bold">{Icon && <Icon className="h-4 w-4 text-bronze" />}{title}</h2>}
            {description && <p className="mt-0.5 text-[11.5px] text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-1.5">{actions}</div>}
        </div>
      )}
      <div className={cx("p-4", bodyClass)}>{children}</div>
    </section>
  );
}

export function Kpi({ label, value, hint, icon: Icon, tone = "brand", spark, onClick }: {
  label: string; value: string; hint?: React.ReactNode; icon?: IconType; tone?: Tone; spark?: number[]; onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick}
      className={cx("relative flex flex-col gap-2 overflow-hidden rounded-xl border border-border bg-card p-4 text-start shadow-sm",
        onClick && "transition-colors hover:border-bronze/50")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold text-muted-foreground">{label}</span>
        {Icon && <span className={cx("grid h-8 w-8 place-items-center rounded-lg border", TONE_SOFT[tone])}><Icon className={cx("h-4 w-4", TONE_TEXT[tone])} /></span>}
      </div>
      <div className="flex items-end justify-between gap-3">
        <span className="font-display text-[26px] font-extrabold leading-none tabular-nums">{value}</span>
        {spark && spark.length > 1 && <Sparkline values={spark} />}
      </div>
      {hint && <div className="text-[11.5px] text-muted-foreground">{hint}</div>}
    </Tag>
  );
}

export function Sparkline({ values, width = 92, height = 28 }: { values: number[]; width?: number; height?: number }) {
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - (v / max) * (height - 4)).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0 text-bronze" aria-hidden style={{ transform: "scaleX(-1)" }}>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** multi-series line/area chart; x runs right-to-left like the rest of the RTL page */
export function TrendChart({ labels, series, height = 200, format }: {
  labels: string[];
  series: { name: string; values: number[]; color: string; area?: boolean }[];
  height?: number;
  format?: (v: number) => string;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const w = 720;
  const h = height;
  const pad = { t: 10, b: 22, s: 8 };
  const n = Math.max(1, labels.length);
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const x = (i: number) => w - pad.s - (n === 1 ? 0 : (i * (w - 2 * pad.s)) / (n - 1));
  const y = (v: number) => pad.t + (h - pad.t - pad.b) * (1 - v / max);
  const fmt = format ?? ((v: number) => v.toLocaleString("fa-IR"));
  return (
    <div className="relative" dir="ltr">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label={series.map((s) => s.name).join("، ")}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * w;
          const i = Math.round(((w - pad.s - px) * (n - 1)) / (w - 2 * pad.s));
          setHover(Math.max(0, Math.min(n - 1, i)));
        }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={pad.s} x2={w - pad.s} y1={y(max * f)} y2={y(max * f)} className="stroke-border" strokeDasharray={f ? "3 4" : undefined} />
        ))}
        {series.map((s) => {
          const d = s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
          return (
            <g key={s.name}>
              {s.area && <path d={`${d} L${x(s.values.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={s.color} opacity={0.12} />}
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={h - pad.b} className="stroke-muted-foreground/40" />}
        {[0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i).map((i) => (
          <text key={i} x={x(i)} y={h - 6} textAnchor="middle" className="fill-muted-foreground" fontSize="11">{labels[i]}</text>
        ))}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-1 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-[11px] shadow-md" dir="rtl"
          style={{ left: `${(x(hover) / w) * 100}%`, transform: `translateX(${x(hover) > w / 2 ? "-105%" : "5%"})` }}>
          <p className="mb-0.5 font-bold">{labels[hover]}</p>
          {series.map((s) => (
            <p key={s.name} className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} /> {s.name}: <b className="tabular-nums">{fmt(s.values[hover] ?? 0)}</b>
            </p>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap justify-end gap-3 text-[11px] text-muted-foreground" dir="rtl">
        {series.map((s) => <span key={s.name} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.name}</span>)}
      </div>
    </div>
  );
}

export function Meter({ used, cap }: { used: number; cap: number }) {
  const p = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const tone = p >= 100 ? "bg-red-500" : p >= 85 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="min-w-[90px]">
      <div className="mb-1 flex justify-between text-[11px] tabular-nums text-muted-foreground">
        <span>{used.toLocaleString("fa-IR")} / {cap.toLocaleString("fa-IR")}</span><span>{p.toLocaleString("fa-IR")}٪</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={cx("h-full rounded-full", tone)} style={{ width: `${p}%` }} /></div>
    </div>
  );
}

export function Badge({ tone = "muted", children, dot }: { tone?: Tone; children: React.ReactNode; dot?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-semibold", TONE_SOFT[tone], TONE_TEXT[tone])}>
      {dot && <span className={cx("h-1.5 w-1.5 rounded-full", TONE_DOT[tone])} />}{children}
    </span>
  );
}

// ─── controls ──────────────────────────────────────────────────────────────────────────────
type BtnKind = "primary" | "secondary" | "ghost" | "danger";
const BTN: Record<BtnKind, string> = {
  primary: "bg-primary text-primary-foreground hover:brightness-110 border-transparent",
  secondary: "bg-card text-foreground border-border hover:bg-muted",
  ghost: "bg-transparent text-muted-foreground border-transparent hover:bg-muted hover:text-foreground",
  danger: "bg-red-600 text-white border-transparent hover:bg-red-700",
};
export function Btn({ kind = "secondary", size = "md", icon: Icon, busy, className, children, ...rest }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: BtnKind; size?: "sm" | "md"; icon?: IconType; busy?: boolean }) {
  return (
    <button type="button" {...rest} disabled={rest.disabled || busy}
      className={cx("inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-8 px-2.5 text-[12px]" : "h-9 px-3.5 text-[13px]", BTN[kind], className)}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

export const inputCls = "h-9 rounded-lg border border-border bg-background px-3 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-bronze focus:ring-2 focus:ring-bronze/15";

export function SearchBox({ value, onChange, placeholder, className, onEnter }: {
  value: string; onChange: (v: string) => void; placeholder: string; className?: string; onEnter?: () => void;
}) {
  return (
    <div className={cx("relative", className)}>
      <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        onKeyDown={(e) => { if (e.key === "Enter") onEnter?.(); }}
        className={cx(inputCls, "w-full ps-9")} />
    </div>
  );
}

export function Select<T extends string>({ value, onChange, options, label, className }: {
  value: T; onChange: (v: T) => void; options: { key: T; label: string }[]; label: string; className?: string;
}) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)} className={cx(inputCls, "pe-8", className)}>
      {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
    </select>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { key: T; label: string; count?: number }[] }) {
  return (
    <div role="tablist" className="inline-flex flex-wrap gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5">
      {options.map((o) => (
        <button key={o.key} type="button" role="tab" aria-selected={o.key === value} onClick={() => onChange(o.key)}
          className={cx("inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-semibold transition-colors",
            o.key === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          {o.label}
          {o.count !== undefined && <span className="tabular-nums text-muted-foreground">{o.count.toLocaleString("fa-IR")}</span>}
        </button>
      ))}
    </div>
  );
}

export function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 flex flex-wrap items-center gap-2">{children}</div>;
}

// ─── table ─────────────────────────────────────────────────────────────────────────────────────
export interface Column<T> { key: string; header: string; cell: (row: T) => React.ReactNode; className?: string; hideBelow?: "sm" | "md" | "lg" | "xl" }
const HIDE: Record<string, string> = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell", xl: "hidden xl:table-cell" };

export function DataTable<T>({ columns, rows, rowKey, onRowClick, loading, empty, selectedKey }: {
  columns: Column<T>[]; rows: T[] | null; rowKey: (r: T) => string; onRowClick?: (r: T) => void;
  loading?: boolean; empty?: React.ReactNode; selectedKey?: string | null;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full border-collapse text-[13px]">
        <thead className="sticky top-0 z-10 bg-muted/70 backdrop-blur">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cx("whitespace-nowrap border-b border-border px-3 py-2.5 text-start text-[11.5px] font-bold text-muted-foreground", c.hideBelow && HIDE[c.hideBelow], c.className)}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(rows === null || loading) && !rows?.length
            ? Array.from({ length: 6 }, (_, i) => (
              <tr key={i} className="border-b border-border/60 last:border-0">
                {columns.map((c) => <td key={c.key} className={cx("px-3 py-3", c.hideBelow && HIDE[c.hideBelow])}><span className="block h-3.5 w-3/4 animate-pulse rounded bg-muted" /></td>)}
              </tr>
            ))
            : rows.map((r) => {
              const k = rowKey(r);
              return (
                <tr key={k} onClick={onRowClick ? () => onRowClick(r) : undefined}
                  className={cx("border-b border-border/60 last:border-0", onRowClick && "cursor-pointer hover:bg-muted/50",
                    selectedKey === k && "bg-bronze/[0.06]")}>
                  {columns.map((c) => <td key={c.key} className={cx("px-3 py-2.5 align-middle", c.hideBelow && HIDE[c.hideBelow], c.className)}>{c.cell(r)}</td>)}
                </tr>
              );
            })}
        </tbody>
      </table>
      {rows !== null && !loading && rows.length === 0 && <div className="p-6">{empty ?? <EmptyState title="موردی پیدا نشد" />}</div>}
    </div>
  );
}

export function Pager({ offset, limit, total, onPage }: { offset: number; limit: number; total: number; onPage: (o: number) => void }) {
  if (total <= limit) return null;
  const from = offset + 1;
  const to = Math.min(total, offset + limit);
  return (
    <div className="mt-3 flex items-center justify-between text-[12px] text-muted-foreground">
      <span className="tabular-nums">{from.toLocaleString("fa-IR")}–{to.toLocaleString("fa-IR")} از {total.toLocaleString("fa-IR")}</span>
      <div className="flex gap-1.5">
        <Btn size="sm" disabled={offset === 0} onClick={() => onPage(Math.max(0, offset - limit))}>قبلی</Btn>
        <Btn size="sm" disabled={to >= total} onClick={() => onPage(offset + limit)}>بعدی</Btn>
      </div>
    </div>
  );
}

// ─── states ──────────────────────────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon = Inbox, title, text, action }: { icon?: IconType; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-muted/60"><Icon className="h-5 w-5 text-muted-foreground" /></span>
      <p className="text-[13px] font-bold">{title}</p>
      {text && <p className="max-w-sm text-[12px] leading-relaxed text-muted-foreground">{text}</p>}
      {action}
    </div>
  );
}

export function Notice({ tone = "warn", title, children, action, icon: Icon = AlertTriangle }: {
  tone?: Tone; title: string; children?: React.ReactNode; action?: React.ReactNode; icon?: IconType;
}) {
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={cx("flex flex-wrap items-start gap-3 rounded-xl border p-3.5", TONE_SOFT[tone])}>
      <Icon className={cx("mt-0.5 h-4 w-4 shrink-0", TONE_TEXT[tone])} />
      <div className="min-w-0 flex-1">
        <p className={cx("text-[13px] font-bold", TONE_TEXT[tone])}>{title}</p>
        {children && <div className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function RefreshBtn({ onClick, busy, at }: { onClick: () => void; busy?: boolean; at?: Date | null }) {
  return (
    <Btn size="sm" kind="ghost" icon={RefreshCw} busy={busy} onClick={onClick} title="بازخوانی">
      {at ? at.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }) : "بازخوانی"}
    </Btn>
  );
}

export function KeyValues({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(110px,auto)_1fr] gap-x-4 gap-y-2 text-[12.5px]">
      {items.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words font-medium">{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

// ─── overlays ──────────────────────────────────────────────────────────────────────────────
function useEscape(open: boolean, onClose: () => void) {
  React.useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
}

export function Drawer({ open, onClose, title, subtitle, children, footer, width = 560 }: {
  open: boolean; onClose: () => void; title: React.ReactNode; subtitle?: React.ReactNode;
  children: React.ReactNode; footer?: React.ReactNode; width?: number;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" dir="rtl" role="dialog" aria-modal>
      <button type="button" aria-label="بستن" className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      <div className="absolute inset-y-0 end-0 flex w-full flex-col border-s border-border bg-background shadow-2xl" style={{ maxWidth: width }}>
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-extrabold">{title}</div>
            {subtitle && <div className="mt-0.5 text-[12px] text-muted-foreground">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted" aria-label="بستن"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="shrink-0 border-t border-border bg-muted/30 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export interface ConfirmSpec {
  title: string;
  text: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  needReason?: boolean;
  /** user must type this exact word (e.g. the centre address) */
  typeToConfirm?: string;
  run: (reason: string) => Promise<unknown>;
}

export function ConfirmDialog({ spec, onClose, onDone, errorText }: {
  spec: ConfirmSpec | null; onClose: () => void; onDone?: () => void; errorText: (e: unknown) => string;
}) {
  const [reason, setReason] = React.useState("");
  const [typed, setTyped] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  React.useEffect(() => { setReason(""); setTyped(""); setErr(""); setBusy(false); }, [spec]);
  useEscape(!!spec && !busy, onClose);
  if (!spec) return null;
  const ok = (!spec.needReason || reason.trim().length >= 3) && (!spec.typeToConfirm || typed.trim().toLowerCase() === spec.typeToConfirm.toLowerCase());
  async function go() {
    if (!spec || !ok) return;
    setBusy(true); setErr("");
    try { await spec.run(reason.trim()); onDone?.(); onClose(); } catch (e) { setErr(errorText(e)); } finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4" dir="rtl" role="alertdialog" aria-modal>
      <button type="button" aria-label="انصراف" className="absolute inset-0 bg-black/45" onClick={() => !busy && onClose()} />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-2xl">
        <h3 className="flex items-center gap-2 text-[15px] font-extrabold">
          {spec.danger && <AlertTriangle className="h-4 w-4 text-red-600" />}{spec.title}
        </h3>
        <div className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{spec.text}</div>
        {spec.needReason && (
          <label className="mt-4 block space-y-1">
            <span className="text-[12px] font-bold">دلیل (در گزارش ممیزی ثبت می‌شود)</span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={300}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-bronze" />
          </label>
        )}
        {spec.typeToConfirm && (
          <label className="mt-3 block space-y-1">
            <span className="text-[12px] font-bold">برای تأیید، <code dir="ltr" className="rounded bg-muted px-1">{spec.typeToConfirm}</code> را بنویسید</span>
            <input dir="ltr" value={typed} onChange={(e) => setTyped(e.target.value)} className={cx(inputCls, "w-full")} />
          </label>
        )}
        {err && <p role="alert" className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-[12px] text-red-700 dark:text-red-400">{err}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Btn onClick={onClose} disabled={busy}>انصراف</Btn>
          <Btn kind={spec.danger ? "danger" : "primary"} busy={busy} disabled={!ok} onClick={() => void go()}>{spec.confirmLabel}</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── data hook ─────────────────────────────────────────────────────────────────────────────
export function useLoad<T>(fn: () => Promise<T>, deps: React.DependencyList) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<unknown>(null);
  const [busy, setBusy] = React.useState(true);
  const [at, setAt] = React.useState<Date | null>(null);
  const seq = React.useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = React.useCallback(fn, deps);
  const reload = React.useCallback(async () => {
    const id = ++seq.current;
    setBusy(true); setError(null);
    try {
      const v = await run();
      if (id === seq.current) { setData(v); setAt(new Date()); }
    } catch (e) {
      if (id === seq.current) setError(e);
    } finally {
      if (id === seq.current) setBusy(false);
    }
  }, [run]);
  React.useEffect(() => { void reload(); }, [reload]);
  return { data, error, busy, at, reload, setData };
}
