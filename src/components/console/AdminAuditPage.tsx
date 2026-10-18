"use client";
/* Platform console: audit log (phase A1 of docs/ADMIN_PLATFORM.md). Search the append-only log by
 * event group, actor, centre and date; open one entry for its full detail; export CSV. */
import * as React from "react";
import { Download, Filter, ScrollText, ShieldAlert } from "lucide-react";
import { useAal } from "@/lib/mfa";
import { MfaPanel } from "@/components/app/MfaPanel";
import {
  actionLabel, adminAudit, adminError, adminOrgsOverview, AUDIT_GROUPS, downloadCsv, faDateTime, toCsv, type AuditRow,
} from "@/lib/cloud-api/admin-console";
import {
  Badge, Btn, DataTable, Drawer, EmptyState, inputCls, KeyValues, Notice, PageHeader, Pager, Panel, RefreshBtn, Select,
  Toolbar, useLoad,
} from "./ConsoleKit";

const LIMIT = 100;
interface Filters { group: string; actor: string; org: string; from: string; to: string }
const EMPTY: Filters = { group: "", actor: "", org: "", from: "", to: "" };

/** Tehran day start (UTC+03:30) as an ISO instant */
const dayStart = (d: string) => (d ? new Date(`${d}T00:00:00+03:30`).toISOString() : null);
const dayEnd = (d: string) => (d ? new Date(new Date(`${d}T00:00:00+03:30`).getTime() + 86_400_000).toISOString() : null);

function summary(d: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(d ?? {})) {
    if (v === null || v === undefined || v === "") continue;
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    parts.push(`${k}: ${s.length > 40 ? `${s.slice(0, 40)}…` : s}`);
    if (parts.length >= 3) break;
  }
  return parts.join(" · ");
}

export function AdminAuditPage() {
  const aal = useAal();
  if (aal !== "aal2") {
    return (
      <>
        <PageHeader title="گزارش ممیزی" description="ثبت تغییرناپذیر همهٔ کارهای حساس در Lexa و مراکز." />
        <Panel title="ورود دومرحله‌ای لازم است" icon={ShieldAlert}><MfaPanel /></Panel>
      </>
    );
  }
  return <AuditInner />;
}

function AuditInner() {
  const [draft, setDraft] = React.useState<Filters>(EMPTY);
  const [f, setF] = React.useState<Filters>(EMPTY);
  const [offset, setOffset] = React.useState(0);
  const [open, setOpen] = React.useState<AuditRow | null>(null);
  const [exporting, setExporting] = React.useState(false);
  const [exportErr, setExportErr] = React.useState("");
  const orgs = useLoad(() => adminOrgsOverview(), []);
  const params = { from: dayStart(f.from), to: dayEnd(f.to), action: f.group, orgId: f.org || null, actor: f.actor.trim() };
  const list = useLoad(() => adminAudit({ ...params, limit: LIMIT, offset }), [f, offset]);

  const apply = () => { setF(draft); setOffset(0); };
  const reset = () => { setDraft(EMPTY); setF(EMPTY); setOffset(0); };
  async function exportCsv() {
    setExporting(true); setExportErr("");
    try {
      const all = await adminAudit({ ...params, limit: 1000, offset: 0 });
      downloadCsv(`lexa-audit-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(
        ["id", "at", "action", "label", "actor", "org", "target", "target_username", "detail"],
        all.rows.map((r) => [r.id, r.at, r.action, actionLabel(r.action), r.actor_username ?? "", r.org_name ?? "", r.target ?? "", r.target_username ?? "", JSON.stringify(r.detail ?? {})]),
      ));
    } catch (e) { setExportErr(adminError(e)); } finally { setExporting(false); }
  }
  const active = JSON.stringify(f) !== JSON.stringify(EMPTY);

  return (
    <>
      <PageHeader title="گزارش ممیزی" description="ثبت فقط‌افزودنی کارهای حساس: چه کسی، چه وقت، روی چه چیزی و با چه دلیلی. هیچ ردیفی قابل ویرایش یا حذف نیست."
        actions={<>
          <Btn size="sm" icon={Download} busy={exporting} onClick={() => void exportCsv()}>خروجی CSV (تا ۱۰۰۰ ردیف)</Btn>
          <RefreshBtn onClick={() => void list.reload()} busy={list.busy} at={list.at} />
        </>} />
      {exportErr && <div className="mb-3"><Notice tone="bad" title="خروجی ساخته نشد">{exportErr}</Notice></div>}
      <Panel className="mb-4" bodyClass="p-3">
        <Toolbar>
          <Select label="نوع رویداد" value={draft.group} onChange={(v) => setDraft({ ...draft, group: v })} options={AUDIT_GROUPS} />
          <select aria-label="مرکز" value={draft.org} onChange={(e) => setDraft({ ...draft, org: e.target.value })} className={`${inputCls} max-w-[220px]`}>
            <option value="">همهٔ مراکز</option>
            {(orgs.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <input value={draft.actor} onChange={(e) => setDraft({ ...draft, actor: e.target.value })} placeholder="انجام‌دهنده (نام کاربری)" className={`${inputCls} w-48`} dir="auto" />
          <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">از
            <input type="date" dir="ltr" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} className={inputCls} /></label>
          <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">تا
            <input type="date" dir="ltr" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} className={inputCls} /></label>
          <Btn kind="primary" size="sm" icon={Filter} onClick={apply}>اعمال</Btn>
          {active && <Btn kind="ghost" size="sm" onClick={reset}>پاک‌کردن فیلترها</Btn>}
        </Toolbar>
      </Panel>
      {list.error ? <Notice tone="bad" title="گزارش خوانده نشد">{adminError(list.error)}</Notice> : null}
      <DataTable rows={list.data?.rows ?? null} loading={list.busy} rowKey={(r) => String(r.id)} onRowClick={setOpen} selectedKey={open ? String(open.id) : null}
        empty={<EmptyState icon={ScrollText} title="رویدادی با این فیلترها نیست" />}
        columns={[
          { key: "t", header: "زمان", cell: (r) => <span className="whitespace-nowrap text-[12px] tabular-nums text-muted-foreground">{faDateTime(r.at)}</span> },
          { key: "a", header: "رویداد", cell: (r) => (
            <span className="min-w-[160px]"><b className="block">{actionLabel(r.action)}</b><code dir="ltr" className="text-[10.5px] text-muted-foreground">{r.action}</code></span>
          ) },
          { key: "u", header: "انجام‌دهنده", cell: (r) => r.actor_username ? <span className="text-[12px]">@{r.actor_username}</span> : <Badge>سیستم</Badge> },
          { key: "o", header: "مرکز", hideBelow: "md", cell: (r) => <span className="text-[12px] text-muted-foreground">{r.org_name ?? "—"}</span> },
          { key: "g", header: "هدف", hideBelow: "lg", cell: (r) => <span className="text-[12px] text-muted-foreground">{r.target_username ? `@${r.target_username}` : r.target ? <code dir="ltr">{r.target.slice(0, 8)}</code> : "—"}</span> },
          { key: "d", header: "جزئیات", hideBelow: "xl", cell: (r) => <span className="line-clamp-1 max-w-[320px] text-[11.5px] text-muted-foreground" dir="auto">{summary(r.detail)}</span> },
        ]} />
      <Pager offset={offset} limit={LIMIT} total={list.data?.total ?? 0} onPage={setOffset} />
      <Drawer open={!!open} onClose={() => setOpen(null)} title={open ? actionLabel(open.action) : ""} subtitle={open ? faDateTime(open.at) : undefined}>
        {open && (
          <>
            <KeyValues items={[
              ["شناسهٔ رویداد", <code key="i" dir="ltr">{open.id}</code>],
              ["کد رویداد", <code key="c" dir="ltr">{open.action}</code>],
              ["انجام‌دهنده", open.actor_username ? `@${open.actor_username}` : "سیستم / کلید سرویس"],
              ["مرکز", open.org_name ?? "—"],
              ["هدف", open.target_username ? `@${open.target_username}` : open.target ? <code key="t" dir="ltr">{open.target}</code> : "—"],
            ]} />
            <Panel title="جزئیات کامل">
              <pre dir="ltr" className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-all rounded-lg bg-muted/60 p-3 text-[11.5px] leading-relaxed">{JSON.stringify(open.detail ?? {}, null, 2)}</pre>
            </Panel>
          </>
        )}
      </Drawer>
    </>
  );
}
