"use client";
/* Platform console: education centres (phase A1 of docs/ADMIN_PLATFORM.md). Directory with
 * lifecycle states, usage and capacity; a side panel per centre for plan / seats / expiry / note
 * and the lifecycle (activate, suspend, archive, restore, scheduled deletion, purge). */
import * as React from "react";
import { Archive, Building2, Download, ExternalLink, Pause, Play, RotateCcw, Save, Trash2, Undo2 } from "lucide-react";
import { navigate } from "@/lib/router";
import {
  adminError, adminOrgLifecycle, adminOrgPurge, adminOrgSetCode, adminOrgUpdate, adminOrgsOverview, downloadCsv,
  faAgo, faDate, faDateTime, faDaysLeft, faHours, faNum, orgState, PLAN_LABEL, toCsv, type AdminOrgRow, type OrgAction,
} from "@/lib/cloud-api/admin-console";
import {
  Badge, Btn, ConfirmDialog, DataTable, Drawer, EmptyState, inputCls, KeyValues, Meter, Notice, PageHeader, Panel,
  RefreshBtn, SearchBox, Segmented, Toolbar, useLoad, type ConfirmSpec,
} from "./ConsoleKit";

type StateKey = "all" | "active" | "pending" | "suspended" | "archived" | "expired" | "deleting";
const KIND: Record<string, string> = { university: "دانشگاه", institute: "مؤسسه", school: "آموزشگاه", other: "سایر" };

export function AdminCentresPage({ focus, onFocusDone, onChanged }: { focus: string | null; onFocusDone: () => void; onChanged: () => void }) {
  const list = useLoad(() => adminOrgsOverview(), []);
  const [state, setState] = React.useState<StateKey>("all");
  const [q, setQ] = React.useState("");
  const [openId, setOpenId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (focus) { setOpenId(focus); onFocusDone(); }
  }, [focus, onFocusDone]);

  const rows = list.data ?? null;
  const counts = React.useMemo(() => {
    const c: Record<StateKey, number> = { all: 0, active: 0, pending: 0, suspended: 0, archived: 0, expired: 0, deleting: 0 };
    for (const o of rows ?? []) { c.all += 1; c[orgState(o).key as StateKey] += 1; }
    return c;
  }, [rows]);
  const filtered = React.useMemo(() => {
    if (!rows) return null;
    const s = q.trim().toLowerCase();
    return rows.filter((o) => (state === "all" || orgState(o).key === state)
      && (!s || [o.name, o.slug, o.city, o.owner_username ?? "", o.code ?? ""].some((x) => x.toLowerCase().includes(s))));
  }, [rows, state, q]);
  const open = rows?.find((o) => o.id === openId) ?? null;

  function exportCsv() {
    if (!filtered) return;
    downloadCsv(`lexa-centres-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(
      ["name", "slug", "status", "plan", "teachers_used", "teacher_seats", "students_used", "student_seats", "learners_7d", "study_hours_30d", "expires_at", "owner", "created_at"],
      filtered.map((o) => [o.name, o.slug, orgState(o).key, o.plan, o.teachers_used, o.seats, o.students_used, o.student_seats, o.learners_7d,
        Math.round(o.study_seconds_30d / 360) / 10, o.expires_at ?? "", o.owner_username ?? "", o.created_at]),
    ));
  }
  const changed = () => { void list.reload(); onChanged(); };

  return (
    <>
      <PageHeader title="مراکز آموزشی" description="همهٔ دانشگاه‌ها، مؤسسه‌ها و آموزشگاه‌ها: وضعیت چرخهٔ عمر، پلن، ظرفیت، مصرف و فعالیت."
        actions={<>
          <Btn size="sm" icon={Download} onClick={exportCsv} disabled={!filtered?.length}>خروجی CSV</Btn>
          <RefreshBtn onClick={() => void list.reload()} busy={list.busy} at={list.at} />
        </>} />
      {list.error ? <Notice tone="bad" title="فهرست مراکز خوانده نشد" action={<Btn size="sm" onClick={() => void list.reload()}>تلاش دوباره</Btn>}>{adminError(list.error)}</Notice> : null}
      <Toolbar>
        <Segmented value={state} onChange={setState} options={[
          { key: "all", label: "همه", count: counts.all },
          { key: "active", label: "فعال", count: counts.active },
          { key: "pending", label: "در انتظار", count: counts.pending },
          { key: "expired", label: "اعتبار تمام‌شده", count: counts.expired },
          { key: "suspended", label: "معلق", count: counts.suspended },
          { key: "archived", label: "بایگانی", count: counts.archived },
          { key: "deleting", label: "در صف حذف", count: counts.deleting },
        ]} />
        <SearchBox value={q} onChange={setQ} placeholder="نام، نشانی، شهر، مالک یا کد…" className="min-w-[220px] flex-1" />
      </Toolbar>
      <DataTable rows={filtered} rowKey={(o) => o.id} onRowClick={(o) => setOpenId(o.id)} selectedKey={openId}
        empty={<EmptyState icon={Building2} title="مرکزی با این فیلتر نیست" />}
        columns={[
          { key: "n", header: "مرکز", cell: (o) => (
            <div className="flex min-w-[180px] items-center gap-2.5">
              {o.logo_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={o.logo_url} alt="" className="h-8 w-8 shrink-0 rounded-lg border border-border object-cover" />
                : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-[13px] font-bold text-primary">{o.name.slice(0, 1)}</span>}
              <span className="min-w-0"><b className="block truncate">{o.name}</b>
                <span className="block truncate text-[11px] text-muted-foreground"><span dir="ltr">{o.slug}</span>{o.city ? ` · ${o.city}` : ""} · {KIND[o.kind] ?? o.kind}</span></span>
            </div>
          ) },
          { key: "s", header: "وضعیت", cell: (o) => { const st = orgState(o); return <span title={o.status_reason || undefined}><Badge tone={st.tone} dot>{st.label}</Badge></span>; } },
          { key: "p", header: "پلن", hideBelow: "md", cell: (o) => <span className="text-[12px]">{PLAN_LABEL[o.plan] ?? o.plan}</span> },
          { key: "t", header: "مدرسان", hideBelow: "lg", cell: (o) => <Meter used={o.teachers_used} cap={o.seats} /> },
          { key: "st", header: "دانشجویان", hideBelow: "md", cell: (o) => <Meter used={o.students_used} cap={o.student_seats} /> },
          { key: "a", header: "فعال ۷ روز", hideBelow: "xl", cell: (o) => <span className="tabular-nums">{faNum(o.learners_7d)}</span> },
          { key: "h", header: "مطالعه ۳۰ روز", hideBelow: "xl", cell: (o) => <span className="tabular-nums">{faHours(o.study_seconds_30d)} ساعت</span> },
          { key: "e", header: "انقضا", hideBelow: "lg", cell: (o) => o.expires_at
            ? <span className="whitespace-nowrap text-[12px]">{faDate(o.expires_at)}<span className="block text-[11px] text-muted-foreground">{faDaysLeft(o.expires_at)}</span></span>
            : <span className="text-[12px] text-muted-foreground">بدون انقضا</span> },
          { key: "o", header: "مالک", hideBelow: "xl", cell: (o) => <span className="text-[12px] text-muted-foreground">{o.owner_username ? `@${o.owner_username}` : "—"}</span> },
        ]} />
      {open && <CentreDrawer key={open.id} o={open} onClose={() => setOpenId(null)} onChanged={changed} />}
    </>
  );
}

function CentreDrawer({ o, onClose, onChanged }: { o: AdminOrgRow; onClose: () => void; onChanged: () => void }) {
  const st = orgState(o);
  const [plan, setPlan] = React.useState(o.plan);
  const [seats, setSeats] = React.useState(String(o.seats));
  const [studentSeats, setStudentSeats] = React.useState(String(o.student_seats));
  const [expires, setExpires] = React.useState(o.expires_at ? o.expires_at.slice(0, 10) : "");
  const [noExpiry, setNoExpiry] = React.useState(!o.expires_at);
  const [code, setCode] = React.useState(o.code ?? "");
  const [note, setNote] = React.useState(o.admin_note);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = React.useState<ConfirmSpec | null>(null);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const s = Math.max(1, Math.min(2000, parseInt(seats, 10) || o.seats));
      const ss = Math.max(0, Math.min(100000, parseInt(studentSeats, 10) || 0));
      await adminOrgUpdate(o.id, {
        plan, seats: s, studentSeats: ss, note,
        expiresAt: noExpiry ? null : expires ? new Date(`${expires}T20:29:59Z`).toISOString() : undefined,
      });
      const c = code.trim().toLowerCase();
      if (c && c !== (o.code ?? "")) await adminOrgSetCode(o.id, c);
      setMsg({ ok: true, text: "تغییرات ذخیره شد و در گزارش ممیزی ثبت شد." });
      onChanged();
    } catch (e) { setMsg({ ok: false, text: adminError(e) }); } finally { setBusy(false); }
  }

  const act = (a: OrgAction): ConfirmSpec => {
    const base = { run: (reason: string) => adminOrgLifecycle(o.id, a, reason) };
    switch (a) {
      case "activate": return { ...base, title: `فعال‌سازی «${o.name}»`, confirmLabel: "فعال کن",
        text: o.expires_at && new Date(o.expires_at).getTime() <= Date.now() ? "تاریخ انقضای این مرکز گذشته است؛ پس از فعال‌سازی، تاریخ تازه را هم ذخیره کنید." : "مدیران و دانشجویان مرکز دوباره دسترسی کامل می‌گیرند." };
      case "suspend": return { ...base, title: `تعلیق «${o.name}»`, confirmLabel: "معلق کن", danger: true, needReason: true,
        text: "مدیران، مدرسان و دانشجویان رسمی این مرکز تا رفع تعلیق دسترسی رسمی ندارند. هیچ داده‌ای پاک نمی‌شود." };
      case "archive": return { ...base, title: `بایگانی «${o.name}»`, confirmLabel: "بایگانی کن", danger: true, needReason: true,
        text: "مرکز از فهرست‌ها بیرون می‌رود ولی داده‌ها می‌مانند و قابل بازگردانی است." };
      case "restore": return { ...base, title: `بازگردانی «${o.name}»`, confirmLabel: "بازگردانی", text: "مرکز به حالت معلق برمی‌گردد؛ برای کار دوباره آن را فعال کنید." };
      case "schedule_delete": return { ...base, title: `زمان‌بندی حذف «${o.name}»`, confirmLabel: "زمان‌بندی حذف", danger: true, needReason: true,
        text: "مرکز ۳۰ روز دیگر قابل حذف دائمی می‌شود. تا آن زمان می‌توانید لغو کنید. قبل از حذف، خروجی داده‌ها را به مرکز بدهید." };
      case "cancel_delete": return { ...base, title: "لغو حذف", confirmLabel: "لغو حذف", text: "مرکز بایگانی می‌ماند و حذف نمی‌شود." };
    }
  };
  const purge: ConfirmSpec = {
    title: `حذف دائمی «${o.name}»`, confirmLabel: "حذف دائمی", danger: true, typeToConfirm: o.slug,
    text: <>همهٔ کلاس‌ها، نمره‌ها، آزمون‌ها، حساب‌های رسمی، کلیدها و اتصال‌های این مرکز برای همیشه پاک می‌شوند. این کار برگشت ندارد و فقط ثبت آن در گزارش ممیزی می‌ماند.</>,
    run: () => adminOrgPurge(o.id, o.slug),
  };
  const due = !!o.delete_after && new Date(o.delete_after).getTime() <= Date.now();

  return (
    <>
      <Drawer open onClose={onClose} width={620}
        title={<span className="flex items-center gap-2">{o.name} <Badge tone={st.tone} dot>{st.label}</Badge></span>}
        subtitle={<span dir="ltr">{o.slug}</span>}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Btn size="sm" kind="ghost" icon={ExternalLink} onClick={() => navigate({ view: "org", id: o.slug })}>صفحهٔ مرکز</Btn>
            <div className="flex flex-wrap gap-1.5">
              {(o.status === "pending" || o.status === "suspended") && <Btn size="sm" kind="primary" icon={Play} onClick={() => setConfirm(act("activate"))}>فعال‌سازی</Btn>}
              {(o.status === "active" || o.status === "pending") && <Btn size="sm" icon={Pause} onClick={() => setConfirm(act("suspend"))}>تعلیق</Btn>}
              {(o.status === "suspended" || o.status === "pending") && <Btn size="sm" icon={Archive} onClick={() => setConfirm(act("archive"))}>بایگانی</Btn>}
              {o.status === "archived" && !o.delete_after && <Btn size="sm" icon={RotateCcw} onClick={() => setConfirm(act("restore"))}>بازگردانی</Btn>}
              {o.status === "archived" && !o.delete_after && <Btn size="sm" kind="danger" icon={Trash2} onClick={() => setConfirm(act("schedule_delete"))}>زمان‌بندی حذف</Btn>}
              {o.delete_after && <Btn size="sm" icon={Undo2} onClick={() => setConfirm(act("cancel_delete"))}>لغو حذف</Btn>}
              {due && <Btn size="sm" kind="danger" icon={Trash2} onClick={() => setConfirm(purge)}>حذف دائمی</Btn>}
            </div>
          </div>
        }>
        {o.delete_after && (
          <Notice tone="bad" title={due ? "مهلت حذف تمام شده است" : `حذف دائمی از ${faDate(o.delete_after)}`}>
            {due ? "می‌توانید مرکز را برای همیشه حذف کنید یا حذف را لغو کنید." : `${faDaysLeft(o.delete_after)} تا امکان حذف دائمی.`}
          </Notice>
        )}
        {o.status_reason && (o.status === "suspended" || o.status === "archived") && (
          <Notice tone="muted" title="دلیل آخرین تغییر وضعیت">{o.status_reason} · {faDateTime(o.status_changed_at)}</Notice>
        )}

        <Panel title="مصرف و فعالیت">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><p className="mb-1.5 text-[12px] font-semibold text-muted-foreground">صندلی مدرس</p><Meter used={o.teachers_used} cap={o.seats} /></div>
            <div><p className="mb-1.5 text-[12px] font-semibold text-muted-foreground">حساب دانشجویی</p><Meter used={o.students_used} cap={o.student_seats} /></div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[["کلاس فعال", faNum(o.classes)], ["یادگیرنده ۷ روز", faNum(o.learners_7d)], ["ساعت مطالعه ۳۰ روز", faHours(o.study_seconds_30d)]].map(([l, v]) => (
              <div key={l} className="rounded-lg border border-border p-2.5"><p className="font-display text-lg font-bold tabular-nums">{v}</p><p className="text-[11px] text-muted-foreground">{l}</p></div>
            ))}
          </div>
          <p className="mt-3 text-[11.5px] text-muted-foreground">آخرین مطالعه روی محتوای مرکز: {o.last_study_day ? faDate(o.last_study_day) : "هنوز نه"}</p>
        </Panel>

        <Panel title="مشخصات">
          <KeyValues items={[
            ["نوع و شهر", `${KIND[o.kind] ?? o.kind}${o.city ? ` · ${o.city}` : ""}`],
            ["مالک", o.owner_username ? `${o.owner_name || o.owner_username} (@${o.owner_username})` : "—"],
            ["راه ارتباط", o.contact || "—"],
            ["ساخته‌شده", `${faDate(o.created_at)} (${faAgo(o.created_at)})`],
            ["آخرین تغییر وضعیت", o.status_changed_at ? faDateTime(o.status_changed_at) : "—"],
          ]} />
        </Panel>

        <Panel title="پلن، ظرفیت و اعتبار" description="هر تغییر با مقدار قبل و بعد در گزارش ممیزی ثبت می‌شود.">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1"><span className="text-[12px] font-bold">پلن</span>
              <select value={plan} onChange={(e) => setPlan(e.target.value as AdminOrgRow["plan"])} className={`${inputCls} w-full`}>
                {Object.entries(PLAN_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></label>
            <label className="space-y-1"><span className="text-[12px] font-bold">کد ورود مرکز</span>
              <input dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} className={`${inputCls} w-full`} /></label>
            <label className="space-y-1"><span className="text-[12px] font-bold">صندلی مدرس</span>
              <input dir="ltr" inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value.replace(/\D/g, ""))} className={`${inputCls} w-full`} /></label>
            <label className="space-y-1"><span className="text-[12px] font-bold">حساب دانشجویی</span>
              <input dir="ltr" inputMode="numeric" value={studentSeats} onChange={(e) => setStudentSeats(e.target.value.replace(/\D/g, ""))} className={`${inputCls} w-full`} /></label>
            <label className="space-y-1"><span className="text-[12px] font-bold">پایان اعتبار</span>
              <input type="date" dir="ltr" value={expires} disabled={noExpiry} onChange={(e) => setExpires(e.target.value)} className={`${inputCls} w-full`} /></label>
            <label className="flex items-center gap-2 self-end pb-2 text-[12.5px]">
              <input type="checkbox" checked={noExpiry} onChange={(e) => setNoExpiry(e.target.checked)} className="h-4 w-4 accent-[var(--bronze,#b08d4f)]" /> بدون تاریخ انقضا
            </label>
          </div>
          <label className="mt-3 block space-y-1"><span className="text-[12px] font-bold">یادداشت داخلی Lexa (مرکز آن را نمی‌بیند)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={600}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-bronze" /></label>
          <div className="mt-3 flex items-center justify-between gap-2">
            {msg ? <p role="status" className={`text-[12px] ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p> : <span />}
            <Btn kind="primary" icon={Save} busy={busy} onClick={() => void save()}>ذخیره</Btn>
          </div>
        </Panel>
      </Drawer>
      <ConfirmDialog spec={confirm} onClose={() => setConfirm(null)} onDone={onChanged} errorText={adminError} />
    </>
  );
}
