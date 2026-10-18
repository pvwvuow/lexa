"use client";
/* Centre audit log (phase A2 of docs/ADMIN_PLATFORM.md): every change in the centre, searchable by
 * time, kind and person, with the detail of each entry and a CSV export. Append-only on the server. */
import * as React from "react";
import { Download, ScrollText } from "lucide-react";
import { downloadCsv, faDateTime, faNum, toCsv } from "@/lib/cloud-api/admin-console";
import { orgActionLabel, orgAudit, orgConsoleError, ORG_AUDIT_GROUPS, PERM_LABEL, type OrgAuditRow } from "@/lib/cloud-api/org-console";
import {
  Btn, DataTable, Drawer, EmptyState, inputCls, KeyValues, Notice, Pager, RefreshBtn, SearchBox, Select, Toolbar, useLoad,
} from "./ConsoleKit";
import { MfaGate, SectionIntro } from "./CentreBits";
import type { CentrePageProps } from "./CentreConsole";

const LIMIT = 50;
const RANGES = [
  { key: "7", label: "۷ روز اخیر" }, { key: "30", label: "۳۰ روز اخیر" }, { key: "90", label: "۹۰ روز اخیر" }, { key: "all", label: "همه" },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];
const DETAIL_LABEL: Record<string, string> = {
  reason: "دلیل", name: "نام", old_name: "نام قبلی", kind: "نوع", old_kind: "نوع قبلی", role: "نقش", role_name: "نام نقش",
  unit: "واحد", old_unit: "واحد قبلی", parent: "بالادستی", old_parent: "بالادستی قبلی", from: "از", to: "به",
  expires_at: "انقضا", note: "یادداشت", perms: "دسترسی\u200cها", added: "افزوده", removed: "برداشته", grants: "تعداد اعطا",
  count: "تعداد", title: "عنوان", preset: "درخت آماده", units: "تعداد واحد", code: "کد",
};

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.map((x) => PERM_LABEL[String(x)] ?? String(x)).join("، ") : "—";
  if (typeof v === "object") return JSON.stringify(v);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return faDateTime(v);
  return String(v);
}

export function OrgAuditPage(p: CentrePageProps) {
  return (
    <MfaGate why="لاگ ممیزی شامل نام دانشجوها و کارکنان است و فقط از نشست دومرحله‌ای باز می‌شود.">
      <AuditInner {...p} />
    </MfaGate>
  );
}

function AuditInner({ orgId, access }: CentrePageProps) {
  const [range, setRange] = React.useState<RangeKey>("30");
  const [group, setGroup] = React.useState("");
  const [actor, setActor] = React.useState("");
  const [applied, setApplied] = React.useState("");
  const [offset, setOffset] = React.useState(0);
  const [open, setOpen] = React.useState<OrgAuditRow | null>(null);
  React.useEffect(() => { const t = setTimeout(() => { setApplied(actor.trim()); setOffset(0); }, 400); return () => clearTimeout(t); }, [actor]);
  const from = range === "all" ? null : new Date(Date.now() - Number(range) * 86400000).toISOString();
  const res = useLoad(() => orgAudit(orgId, { from, action: group, actor: applied, limit: LIMIT, offset }), [orgId, range, group, applied, offset]);

  async function exportCsv() {
    const all: OrgAuditRow[] = [];
    for (let off = 0; off < 2000; off += 200) {
      const r = await orgAudit(orgId, { from, action: group, actor: applied, limit: 200, offset: off });
      all.push(...r.rows);
      if (r.rows.length < 200) break;
    }
    downloadCsv(`lexa-centre-audit-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(
      ["at", "action", "actor", "target", "detail"],
      all.map((r) => [r.at, r.action, r.actor_name ?? "", r.target_name ?? "", JSON.stringify(r.detail ?? {})])));
  }

  return (
    <>
      <SectionIntro text="هر تغییر در مرکز با کنشگر، زمان، هدف و دلیل اینجا ثبت می‌شود. لاگ فقط افزودنی است و هیچ‌کس، حتی مالک، نمی‌تواند آن را پاک یا ویرایش کند."
        actions={<>
          {access.can("org.reports.export") && <Btn icon={Download} onClick={() => void exportCsv()} disabled={!res.data?.rows.length}>CSV</Btn>}
          <RefreshBtn onClick={() => void res.reload()} busy={res.busy} at={res.at} />
        </>} />
      <Toolbar>
        <Select label="بازه" value={range} onChange={(v) => { setRange(v); setOffset(0); }} options={RANGES.map((r) => ({ key: r.key, label: r.label }))} />
        <select aria-label="نوع رویداد" value={group} onChange={(e) => { setGroup(e.target.value); setOffset(0); }} className={inputCls}>
          {ORG_AUDIT_GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
        </select>
        <SearchBox value={actor} onChange={setActor} placeholder="کنشگر (نام کاربری یا نام)" className="min-w-[220px] flex-1" />
      </Toolbar>
      {res.error ? <Notice tone="bad" title="لاگ خوانده نشد">{orgConsoleError(res.error)}</Notice> : (
        <>
          <DataTable<OrgAuditRow>
            rows={res.data?.rows ?? null} loading={res.busy} rowKey={(r) => String(r.id)} onRowClick={setOpen} selectedKey={open ? String(open.id) : null}
            empty={<EmptyState icon={ScrollText} title="رویدادی با این فیلترها نیست" />}
            columns={[
              { key: "t", header: "زمان", cell: (r) => <span className="whitespace-nowrap tabular-nums text-muted-foreground">{faDateTime(r.at)}</span> },
              { key: "a", header: "رویداد", cell: (r) => <b>{orgActionLabel(r.action)}</b> },
              { key: "w", header: "کنشگر", cell: (r) => r.actor_name ?? <span className="text-muted-foreground">سیستم</span> },
              { key: "g", header: "هدف", cell: (r) => r.target_name ?? "—", hideBelow: "md" },
              { key: "r", header: "دلیل", cell: (r) => <span className="line-clamp-1 max-w-[260px] text-muted-foreground">{typeof r.detail?.reason === "string" && r.detail.reason ? r.detail.reason : "—"}</span>, hideBelow: "lg" },
            ]} />
          <Pager offset={offset} limit={LIMIT} total={res.data?.total ?? 0} onPage={setOffset} />
          {res.data && <p className="mt-2 text-[11.5px] text-muted-foreground">{faNum(res.data.total)} رویداد</p>}
        </>
      )}
      {open && (
        <Drawer open onClose={() => setOpen(null)} width={520} title={orgActionLabel(open.action)} subtitle={`${faDateTime(open.at)} · ${open.actor_name ?? "سیستم"}`}>
          <KeyValues items={[
            ["رویداد", <span key="a" dir="ltr" className="font-mono text-[11.5px]">{open.action}</span>],
            ["کنشگر", open.actor_name ?? "سیستم"],
            ["هدف", open.target_name ?? "—"],
            ...Object.entries(open.detail ?? {}).map(([k, v]) => [DETAIL_LABEL[k] ?? k, fmt(v)] as [string, React.ReactNode]),
          ]} />
        </Drawer>
      )}
    </>
  );
}
