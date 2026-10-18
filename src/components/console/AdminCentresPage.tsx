"use client";
/* Platform console: centres directory (phase A1 of docs/ADMIN_PLATFORM.md). Directory with state
 * filter and search; side panel per centre for plan, seats, student seats, sign-in code, expiry,
 * internal note, lifecycle (suspend → archive → scheduled deletion with grace) and purge.
 * Viewing is allowed without aal2; every change is guarded server-side and mapped to a Persian
 * error by adminError(). */
import * as React from "react";
import { Building2, CalendarClock, KeyRound, SearchCheck, ShieldAlert } from "lucide-react";
import {
  adminError, adminOrgLifecycle, adminOrgPurge, adminOrgSetCode, adminOrgUpdate, adminOrgsOverview,
  faDate, faDateTime, faDaysLeft, faHours, faNum, faAgo, LIFECYCLE_LABEL, orgState, PLAN_LABEL,
  type AdminOrgRow, type OrgAction,
} from "@/lib/cloud-api/admin-console";
import { orgCapacity } from "@/lib/cloud-api/org-accounts";
import {
  Badge, Btn, ConfirmDialog, DataTable, Drawer, EmptyState, inputCls, KeyValues, Meter, Notice,
  PageHeader, Panel, RefreshBtn, SearchBox, Segmented, Toolbar, useLoad, type ConfirmSpec, type Tone,
} from "./ConsoleKit";

type StateFilter = "all" | "active" | "pending" | "suspended" | "archived" | "deleting" | "expired";

const STATE_TONE: Record<string, Tone> = { ok: "ok", warn: "warn", bad: "bad", info: "info", muted: "muted" };

/** which lifecycle transitions the UI offers for a centre in its current display state */
function actionsFor(key: string): { act: OrgAction; label: string; danger?: boolean; needReason?: boolean }[] {
  if (key === "deleting") return [{ act: "cancel_delete", label: "لغو حذف زمان‌بندی‌شده" }];
  if (key === "pending") return [{ act: "activate", label: "فعال‌سازی مرکز" }];
  if (key === "active" || key === "expired")
    return [
      { act: "suspend", label: "تعلیق مرکز", danger: true, needReason: true },
      { act: "archive", label: "بایگانی مرکز" },
    ];
  if (key === "suspended")
    return [
      { act: "activate", label: "فعال‌سازی دوباره" },
      { act: "archive", label: "بایگانی مرکز" },
    ];
  return [ // archived
    { act: "restore", label: "بازگردانی از بایگانی" },
    { act: "schedule_delete", label: "زمان‌بندی حذف (۳۰ روز)", danger: true, needReason: true },
  ];
}

export function AdminCentresPage() {
  const [state, setState] = React.useState<StateFilter>("all");
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState<AdminOrgRow | null>(null);
  const list = useLoad(() => adminOrgsOverview(), []);
  const rows = list.data ?? [];

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: rows.length, active: 0, pending: 0, suspended: 0, archived: 0, deleting: 0, expired: 0 };
    for (const o of rows) c[orgState(o).key] = (c[orgState(o).key] ?? 0) + 1;
    return c;
  }, [rows]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((o) => {
      if (state !== "all" && orgState(o).key !== state) return false;
      if (!needle) return true;
      return `${o.name} ${o.slug} ${o.city} ${o.owner_username ?? ""}`.toLowerCase().includes(needle);
    });
  }, [rows, state, q]);

  const refresh = React.useCallback(() => { void list.reload(); }, [list]);

  return (
    <>
      <PageHeader title="مراکز آموزشی" description="فهرست همهٔ مراکز با وضعیت، پلن، صندلی‌ها و اعتبار. برای تغییر، مرکز را باز کنید؛ هر تغییر در گزارش ممیزی با مقدار قبل و بعد ثبت می‌شود."
        actions={<RefreshBtn onClick={refresh} busy={list.busy} at={list.at} />} />
      {list.error ? <div className="mb-4"><Notice tone="bad" title="فهرست مراکز خوانده نشد">{adminError(list.error)}</Notice></div> : null}
      <Panel className="mb-4" bodyClass="p-3">
        <Toolbar>
          <SearchBox value={q} onChange={setQ} placeholder="جست‌وجوی نام، نشانی، شهر یا مالک…" className="min-w-[220px] flex-1" />
          <Segmented<StateFilter> value={state} onChange={setState} options={[
            { key: "all", label: "همه", count: counts.all },
            { key: "active", label: "فعال", count: counts.active },
            { key: "pending", label: "در انتظار", count: counts.pending },
            { key: "expired", label: "تمام‌شده", count: counts.expired },
            { key: "suspended", label: "معلق", count: counts.suspended },
            { key: "archived", label: "بایگانی", count: counts.archived },
            { key: "deleting", label: "در صف حذف", count: counts.deleting },
          ]} />
        </Toolbar>
      </Panel>
      <DataTable rows={filtered} loading={list.busy} rowKey={(r) => r.id} onRowClick={setOpen} selectedKey={open?.id ?? null}
        empty={<EmptyState icon={SearchCheck} title="مرکزی با این فیلترها نیست" text="جست‌وجو را کوتاه‌تر کنید یا فیلتر وضعیت را عوض کنید." />}
        columns={[
          { key: "n", header: "مرکز", cell: (r) => (
            <span className="min-w-[180px]">
              <b className="block truncate">{r.name}</b>
              <span dir="ltr" className="text-[11px] text-muted-foreground">{r.slug}{r.city ? ` · ${r.city}` : ""}</span>
            </span>
          ) },
          { key: "s", header: "وضعیت", cell: (r) => {
            const st = orgState(r);
            return <Badge tone={STATE_TONE[st.tone] ?? "muted"} dot>{st.label}</Badge>;
          } },
          { key: "p", header: "پلن", hideBelow: "sm", cell: (r) => <Badge tone="brand">{PLAN_LABEL[r.plan]}</Badge> },
          { key: "t", header: "مدرس", hideBelow: "md", cell: (r) => <Meter used={r.teachers_used} cap={r.seats} /> },
          { key: "st", header: "دانشجو", hideBelow: "md", cell: (r) => <Meter used={r.students_used} cap={r.student_seats} /> },
          { key: "l7", header: "یادگیرندهٔ ۷ روز", hideBelow: "lg", cell: (r) => <span className="tabular-nums">{faNum(r.learners_7d)}</span> },
          { key: "e", header: "اعتبار", hideBelow: "lg", cell: (r) => r.delete_after
            ? <span className="text-[11.5px] text-red-700 dark:text-red-400">حذف: {faDate(r.delete_after)}</span>
            : <span className="text-[11.5px] text-muted-foreground">{r.expires_at ? <>{faDate(r.expires_at)}{faDaysLeft(r.expires_at) ? ` · ${faDaysLeft(r.expires_at)}` : ""}</> : "بدون انقضا"}</span> },
          { key: "ls", header: "آخرین مطالعه", hideBelow: "xl", cell: (r) => <span className="text-[11.5px] text-muted-foreground">{faAgo(r.last_study_day)}</span> },
        ]} />
      <p className="mt-3 text-[11.5px] text-muted-foreground">{faNum(filtered.length)} مرکز در این نما · مطالعهٔ ۳۰ روز مرکز باز با زدن ردیف دیده می‌شود.</p>
      <CentreDrawer org={open} onClose={() => setOpen(null)} onChanged={refresh} />
    </>
  );
}

function CentreDrawer({ org, onClose, onChanged }: { org: AdminOrgRow | null; onClose: () => void; onChanged: () => void }) {
  const [confirm, setConfirm] = React.useState<ConfirmSpec | null>(null);
  const [actionErr, setActionErr] = React.useState("");
  const [cap, setCap] = React.useState<Awaited<ReturnType<typeof orgCapacity>>>(null);
  React.useEffect(() => {
    setActionErr("");
    setCap(null);
    if (org) orgCapacity(org.id).then(setCap).catch(() => setCap(null));
  }, [org]);
  if (!org) return null;
  const st = orgState(org);
  const run = (spec: ConfirmSpec) => { setActionErr(""); setConfirm(spec); };
  const lifecycle = (act: OrgAction, label: string, opts: { danger?: boolean; needReason?: boolean } = {}) =>
    run({
      title: label,
      text: <>مرکز «{org.name}» به وضعیت هدف می‌رود و رویداد آن با دلیل در گزارش ممیزی ثبت می‌شود.</>,
      confirmLabel: label,
      danger: opts.danger,
      needReason: opts.needReason,
      run: (reason) => adminOrgLifecycle(org.id, act, reason).then(onChanged),
    });
  return (
    <>
      <Drawer open onClose={onClose} title={org.name} subtitle={`${PLAN_LABEL[org.plan]} · ${LIFECYCLE_LABEL[org.status]}${org.city ? ` · ${org.city}` : ""}`} width={640}
        footer={
          <div className="flex flex-wrap items-center gap-2">
            {actionsFor(st.key).map((a) => (
              <Btn key={a.act} kind={a.danger ? "danger" : "secondary"} size="sm" onClick={() => lifecycle(a.act, a.label, { danger: a.danger, needReason: a.needReason })}>{a.label}</Btn>
            ))}
            <Btn kind="ghost" size="sm" className="ms-auto text-red-700 dark:text-red-400" icon={ShieldAlert}
              onClick={() => run({
                title: "حذف دائمی مرکز",
                text: <>همهٔ جدول‌های این مرکز (اعضا، ترم‌ها، کلاس‌ها، آزمون‌ها، نمره‌ها و محتوا) پاک می‌شوند و فقط ردیف‌های گزارش ممیزی می‌مانند. این کار برگشت‌ناپذیر است.</>,
                confirmLabel: "حذف دائمی",
                danger: true,
                typeToConfirm: org.slug,
                run: () => adminOrgPurge(org.id, org.slug.trim()).then(onChanged),
              })}>حذف دائمی…</Btn>
          </div>
        }>
        <KeyValues items={[
          ["نشانی", <code key="s" dir="ltr">{org.slug}</code>],
          ["وضعیت نمایشی", <Badge key="st" tone={STATE_TONE[st.tone] ?? "muted"} dot>{st.label}</Badge>],
          ["نوع", org.kind],
          ["مالک", org.owner_username ? `@${org.owner_username}` : org.owner_name || "—"],
          ["ساخته‌شده", faDate(org.created_at)],
          ["تماس", org.contact || "—"],
          ["کلاس‌های فعال", faNum(org.classes)],
          ["یادگیرندهٔ ۷ روز", faNum(org.learners_7d)],
          ["مطالعهٔ ۳۰ روز", `${faHours(org.study_seconds_30d)} ساعت`],
        ]} />
        {org.delete_after && (
          <Notice tone="bad" title="حذف زمان‌بندی‌شده">
            این مرکز در {faDate(org.delete_after)} ({faDateTime(org.delete_after)}) برای همیشه پاک می‌شود. تا آن زمان می‌توانید حذف را لغو کنید.
          </Notice>
        )}
        {!org.delete_after && org.status_reason && (
          <Notice tone={org.status === "suspended" ? "warn" : "info"} title="دلیل آخرین تغییر وضعیت">
            {org.status_reason}{org.status_changed_at ? <> — {faDateTime(org.status_changed_at)}</> : null}
          </Notice>
        )}
        {cap && (
          <Panel title="صندلی‌ها" icon={Building2}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><p className="mb-1 text-[11px] font-semibold text-muted-foreground">صندلی مدرس</p><Meter used={cap.teachersUsed} cap={cap.teacherSeats} /></div>
              <div><p className="mb-1 text-[11px] font-semibold text-muted-foreground">صندلی دانشجوی رسمی</p><Meter used={cap.studentsUsed} cap={cap.studentSeats} /></div>
            </div>
          </Panel>
        )}
        <PlanForm org={org} onSaved={onChanged} />
        <CodeForm org={org} onSaved={onChanged} />
        {actionErr && <Notice tone="bad" title="کار انجام نشد">{actionErr}</Notice>}
      </Drawer>
      <ConfirmDialog spec={confirm} onClose={() => setConfirm(null)} errorText={(e) => { const m = adminError(e); setActionErr(m); return m; }} />
    </>
  );
}

function PlanForm({ org, onSaved }: { org: AdminOrgRow; onSaved: () => void }) {
  const [f, setF] = React.useState({
    plan: org.plan,
    seats: String(org.seats),
    studentSeats: String(org.student_seats),
    expires: org.expires_at ? org.expires_at.slice(0, 10) : "",
    note: org.admin_note ?? "",
  });
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  React.useEffect(() => {
    setF({ plan: org.plan, seats: String(org.seats), studentSeats: String(org.student_seats), expires: org.expires_at ? org.expires_at.slice(0, 10) : "", note: org.admin_note ?? "" });
    setMsg("");
  }, [org.id, org.plan, org.seats, org.student_seats, org.expires_at, org.admin_note]);
  async function save() {
    setBusy(true); setMsg("");
    try {
      await adminOrgUpdate(org.id, {
        plan: f.plan,
        seats: Math.max(0, Math.min(2000, Number(f.seats) || 0)),
        studentSeats: Math.max(0, Math.min(100000, Number(f.studentSeats) || 0)),
        expiresAt: f.expires ? new Date(`${f.expires}T23:59:59+03:30`).toISOString() : null,
        note: f.note,
      });
      setMsg("ذخیره شد — رویداد admin.org.update در گزارش ممیزی ثبت شد.");
      onSaved();
    } catch (e) { setMsg(adminError(e)); } finally { setBusy(false); }
  }
  return (
    <Panel title="پلن، ظرفیت و اعتبار" icon={CalendarClock}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-[12px] font-bold">پلن</span>
          <select className={`${inputCls} w-full`} value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value as AdminOrgRow["plan"] })}>
            {(Object.keys(PLAN_LABEL) as AdminOrgRow["plan"][]).map((p) => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[12px] font-bold">صندلی مدرس (۰ تا ۲۰۰۰)</span>
          <input type="number" min={0} max={2000} dir="ltr" className={`${inputCls} w-full`} value={f.seats} onChange={(e) => setF({ ...f, seats: e.target.value })} />
        </label>
        <label className="space-y-1">
          <span className="text-[12px] font-bold">صندلی دانشجوی رسمی (۰ تا ۱۰۰٬۰۰۰)</span>
          <input type="number" min={0} max={100000} dir="ltr" className={`${inputCls} w-full`} value={f.studentSeats} onChange={(e) => setF({ ...f, studentSeats: e.target.value })} />
        </label>
        <label className="space-y-1">
          <span className="text-[12px] font-bold">پایان اعتبار (خالی = بدون انقضا)</span>
          <input type="date" dir="ltr" className={`${inputCls} w-full`} value={f.expires} onChange={(e) => setF({ ...f, expires: e.target.value })} />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-[12px] font-bold">یادداشت داخلی (برای مرکز نمایش داده نمی‌شود)</span>
          <textarea rows={2} maxLength={600} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-bronze" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Btn kind="primary" busy={busy} onClick={() => void save()}>ذخیره</Btn>
        {msg && <span className="text-[11.5px] text-muted-foreground">{msg}</span>}
      </div>
    </Panel>
  );
}

function CodeForm({ org, onSaved }: { org: AdminOrgRow; onSaved: () => void }) {
  const [code, setCode] = React.useState(org.code ?? "");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  React.useEffect(() => { setCode(org.code ?? ""); setMsg(""); }, [org.id, org.code]);
  async function save() {
    const c = code.trim().toLowerCase();
    if (c && !/^[a-z0-9][a-z0-9-]{1,23}$/.test(c)) { setMsg("کد نامعتبر است: ۲ تا ۲۴ نویسهٔ لاتین کوچک، رقم و خط تیره."); return; }
    setBusy(true); setMsg("");
    try { await adminOrgSetCode(org.id, c); setMsg("کد ورود مرکز ذخیره شد."); onSaved(); }
    catch (e) { setMsg(adminError(e)); } finally { setBusy(false); }
  }
  return (
    <Panel title="کد ورود مرکز" icon={KeyRound} description="دانشجویان با این کد + نام کاربری + رمز اولیه وارد حساب رسمی می‌شوند.">
      <div className="flex flex-wrap items-center gap-2">
        <input dir="ltr" maxLength={24} className={`${inputCls} w-48`} value={code} onChange={(e) => setCode(e.target.value.toLowerCase())} placeholder="مثلاً ut" aria-label="کد مرکز" />
        <Btn kind="primary" busy={busy} onClick={() => void save()}>ذخیرهٔ کد</Btn>
        {msg && <span className="text-[11.5px] text-muted-foreground">{msg}</span>}
      </div>
    </Panel>
  );
}
