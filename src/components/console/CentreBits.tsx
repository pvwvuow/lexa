"use client";
/* Small shared parts of the centre console (phase A2 of docs/ADMIN_PLATFORM.md): person cell,
 * unit picker, section intro bar, two-factor gate and a units loader. */
import * as React from "react";
import { ShieldAlert } from "lucide-react";
import { useAal } from "@/lib/mfa";
import { MfaPanel } from "@/components/app/MfaPanel";
import { orgUnitTree, unitIndex, UNIT_KIND_LABEL, type UnitRow } from "@/lib/cloud-api/org-console";
import { cx, inputCls, Panel, useLoad } from "./ConsoleKit";

export function PersonCell({ name, username, avatar, sub, size = 32 }: {
  name: string | null | undefined; username: string; avatar?: string | null; sub?: React.ReactNode; size?: number;
}) {
  const label = name || username;
  return (
    <div className="flex min-w-[180px] items-center gap-2.5">
      {avatar
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={avatar} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-full border border-border object-cover" />
        : <span style={{ width: size, height: size }}
            className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary/80 to-bronze text-[12px] font-bold text-primary-foreground">
            {label.slice(0, 1)}
          </span>}
      <span className="min-w-0">
        <b className="block truncate">{label}</b>
        <span className="block truncate text-[11px] text-muted-foreground">@{username}{sub ? <> · {sub}</> : null}</span>
      </span>
    </div>
  );
}

/** description + actions under the section title of the centre workspace */
export function SectionIntro({ text, actions, meta }: { text: React.ReactNode; actions?: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <div className="-mt-2 mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0 max-w-3xl">
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">{text}</p>
        {meta && <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11.5px] text-muted-foreground">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** a select over the organisation tree, indented by depth */
export function UnitSelect({ units, value, onChange, label, centreLabel = "کل مرکز", allowCentre = true, exclude, only, className }: {
  units: UnitRow[]; value: string | null; onChange: (v: string | null) => void; label: string;
  centreLabel?: string; allowCentre?: boolean; exclude?: Set<string>; only?: Set<string>; className?: string;
}) {
  const ordered = React.useMemo(() => {
    const ix = unitIndex(units.filter((u) => u.status === "active"));
    const out: UnitRow[] = [];
    const walk = (p: string | null) => { for (const c of ix.kids.get(p) ?? []) { out.push(c); walk(c.id); } };
    walk(null);
    return out.filter((u) => !exclude?.has(u.id) && (!only || only.has(u.id)));
  }, [units, exclude, only]);
  return (
    <select aria-label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className={cx(inputCls, "min-w-[180px] pe-8", className)}>
      {allowCentre && <option value="">{centreLabel}</option>}
      {!allowCentre && value === null && <option value="" disabled>انتخاب واحد…</option>}
      {ordered.map((u) => (
        <option key={u.id} value={u.id}>{"\u00a0\u00a0\u00a0".repeat(u.depth)}{u.depth ? "└ " : ""}{u.name} ({UNIT_KIND_LABEL[u.kind]})</option>
      ))}
    </select>
  );
}

/** content that needs a two-factor session */
export function MfaGate({ why, children }: { why: string; children: React.ReactNode }) {
  const aal = useAal();
  if (aal === "aal2") return <>{children}</>;
  return (
    <Panel title="ورود دومرحله‌ای لازم است" icon={ShieldAlert}>
      <p className="mb-3 text-[12.5px] leading-relaxed text-muted-foreground">{why}</p>
      <MfaPanel />
    </Panel>
  );
}

export function useUnits(orgId: string) {
  return useLoad(() => orgUnitTree(orgId), [orgId]);
}

export function Chip({ children, tone = "muted", title }: { children: React.ReactNode; tone?: "muted" | "brand" | "warn"; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex max-w-[220px] items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-[11px] font-semibold",
      tone === "brand" ? "border-bronze/30 bg-bronze/10 text-bronze" : tone === "warn" ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400" : "border-border bg-muted/60 text-muted-foreground")}>
      {children}
    </span>
  );
}

/** yyyy-mm-dd from a date input -> end of that day (local) as ISO, or null */
export function endOfDayIso(v: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T23:59:59`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
