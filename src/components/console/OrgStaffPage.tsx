"use client";
/* Staff and their access (phase A2 of docs/ADMIN_PLATFORM.md): everyone who works in the centre with
 * their base role, extra roles and where those apply, home unit, two-factor status and last sign-in.
 * From a person's record: title and unit, base role (owner only), grant / revoke roles with a scope and
 * an expiry, remove from the centre. Inviting staff (advisors, finance, exam office) takes no teacher seat. */
import * as React from "react";
import { MailPlus, Plus, ShieldAlert, ShieldCheck, Trash2, UserCog, UserMinus, UsersRound } from "lucide-react";
import { downloadCsv, faAgo, faDate, faNum, toCsv } from "@/lib/cloud-api/admin-console";
import {
  BASE_ROLE_LABEL, findUserByUsername, orgConsoleError, orgGrant, orgGrantList, orgGrantRevoke, orgRoleList,
  orgSetBaseRole, orgStaff, orgStaffInvite, orgStaffRemove, orgStaffUpdate,
  type BaseRole, type FoundUser, type GrantRow, type RoleRow, type StaffRow, type UnitRow,
} from "@/lib/cloud-api/org-console";
import {
  Badge, Btn, ConfirmDialog, cx, DataTable, Drawer, EmptyState, inputCls, KeyValues, Notice, Panel, RefreshBtn,
  SearchBox, Segmented, Toolbar, useLoad, type ConfirmSpec, type Tone,
} from "./ConsoleKit";
import { Chip, endOfDayIso, MfaGate, PersonCell, SectionIntro, UnitSelect, useUnits } from "./CentreBits";
import type { CentrePageProps } from "./CentreConsole";

type Filter = "all" | "active" | "invited" | "no_mfa" | "extra";
const BASE_TONE: Record<BaseRole, Tone> = { owner: "brand", manager: "info", teacher: "muted", staff: "muted" };
const STATUS: Record<StaffRow["status"], { label: string; tone: Tone }> = {
  active: { label: "فعال", tone: "ok" }, invited: { label: "دعوت‌شده", tone: "info" }, requested: { label: "درخواست عضویت", tone: "warn" },
};

export function OrgStaffPage(p: CentrePageProps) {
  return (
    <MfaGate why="فهرست کارکنان، نقش‌ها و وضعیت ورود آن‌ها فقط از نشست دومرحله‌ای دیده و تغییر داده می‌شود.">
      <StaffInner {...p} />
    </MfaGate>
  );
}

function StaffInner({ orgId, access }: CentrePageProps) {
  const staff = useLoad(() => orgStaff(orgId), [orgId]);
  const grants = useLoad(() => orgGrantList(orgId), [orgId]);
  const roles = useLoad(() => orgRoleList(orgId), [orgId]);
  const units = useUnits(orgId);
  const [q, setQ] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [open, setOpen] = React.useState<string | null>(null);
  const [inviting, setInviting] = React.useState(false);
  const reload = () => { void staff.reload(); void grants.reload(); };

  const byUser = React.useMemo(() => {
    const m = new Map<string, GrantRow[]>();
    for (const g of grants.data ?? []) { const l = m.get(g.user_id) ?? []; l.push(g); m.set(g.user_id, l); }
    return m;
  }, [grants.data]);
  const all = staff.data ?? [];
  const t = q.trim().toLowerCase();
  const rows = staff.data === null ? null : all.filter((s) =>
    (!t || s.username.toLowerCase().includes(t) || (s.display_name ?? "").toLowerCase().includes(t) || s.title.toLowerCase().includes(t))
    && (filter === "all" || (filter === "active" && s.status === "active") || (filter === "invited" && s.status !== "active")
      || (filter === "no_mfa" && s.status === "active" && !s.mfa && s.base_role !== "teacher")
      || (filter === "extra" && (byUser.get(s.user_id)?.length ?? 0) > 0)));
  const noMfa = all.filter((s) => s.status === "active" && !s.mfa && s.base_role !== "teacher").length;
  const sel = open ? all.find((s) => s.user_id === open) ?? null : null;

  function exportCsv() {
    const head = ["username", "name", "base_role", "status", "title", "unit", "extra_roles", "mfa", "last_sign_in"];
    downloadCsv(`lexa-staff-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(head, all.map((s) => [
      s.username, s.display_name, s.base_role, s.status, s.title, s.unit_name ?? "",
      (byUser.get(s.user_id) ?? []).map((g) => `${g.role_name}@${g.unit_name ?? "centre"}`).join("; "), s.mfa ? "yes" : "no", s.last_sign_in_at ?? "",
    ])));
  }

  return (
    <>
      <SectionIntro
        text="هر کس با نقش پایه‌اش (مالک، مدیر کل، مدرس، کارمند) و نقش‌های افزوده‌ای که فقط در کل مرکز یا در یک شاخه از درخت معتبرند. هر تغییر با دلیل در لاگ ممیزی ثبت می‌شود."
        actions={<>
          {access.canSomewhere("org.members.manage") && <Btn kind="primary" icon={MailPlus} onClick={() => setInviting(true)}>دعوت کارمند</Btn>}
          {access.can("org.reports.export") && <Btn onClick={exportCsv} disabled={!all.length}>CSV</Btn>}
          <RefreshBtn onClick={reload} busy={staff.busy || grants.busy} at={staff.at} />
        </>} />

      {noMfa > 0 && (
        <div className="mb-3">
          <Notice tone="warn" icon={ShieldAlert} title={`${faNum(noMfa)} مدیر یا کارمند هنوز ورود دومرحله‌ای ندارد`}
            action={<Btn size="sm" onClick={() => setFilter("no_mfa")}>نشان بده</Btn>}>
            تا آن را فعال نکنند، هیچ داده‌ی دانشجویی برایشان باز نمی‌شود.
          </Notice>
        </div>
      )}

      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="نام، نام کاربری یا عنوان" className="min-w-[220px] flex-1" />
        <Segmented value={filter} onChange={setFilter} options={[
          { key: "all", label: "همه", count: all.length },
          { key: "active", label: "فعال", count: all.filter((s) => s.status === "active").length },
          { key: "invited", label: "در انتظار", count: all.filter((s) => s.status !== "active").length },
          { key: "extra", label: "با نقش افزوده", count: all.filter((s) => (byUser.get(s.user_id)?.length ?? 0) > 0).length },
          { key: "no_mfa", label: "بدون 2FA", count: noMfa },
        ]} />
      </Toolbar>

      {staff.error ? <Notice tone="bad" title="فهرست خوانده نشد">{orgConsoleError(staff.error)}</Notice> : (
        <DataTable<StaffRow>
          rows={rows} rowKey={(r) => r.user_id} onRowClick={(r) => setOpen(r.user_id)} selectedKey={open}
          empty={<EmptyState icon={UsersRound} title="کسی پیدا نشد" />}
          columns={[
            { key: "p", header: "شخص", cell: (r) => <PersonCell name={r.display_name} username={r.username} avatar={r.avatar_url} sub={r.title || undefined} /> },
            { key: "b", header: "نقش پایه", cell: (r) => <Badge tone={BASE_TONE[r.base_role]}>{BASE_ROLE_LABEL[r.base_role]}</Badge> },
            { key: "g", header: "نقش‌های افزوده", cell: (r) => {
              const l = byUser.get(r.user_id) ?? [];
              return l.length ? <div className="flex max-w-[300px] flex-wrap gap-1">{l.slice(0, 3).map((g) => (
                <Chip key={g.id} tone={g.expired ? "warn" : "brand"} title={g.expired ? "منقضی" : undefined}>{g.role_name}{g.unit_name ? ` · ${g.unit_name}` : ""}</Chip>
              ))}{l.length > 3 && <Chip>+{faNum(l.length - 3)}</Chip>}</div> : <span className="text-muted-foreground">—</span>;
            } },
            { key: "u", header: "واحد", cell: (r) => r.unit_name ?? <span className="text-muted-foreground">کل مرکز</span>, hideBelow: "lg" },
            { key: "m", header: "2FA", cell: (r) => r.mfa ? <Badge tone="ok" dot>دارد</Badge> : r.base_role === "teacher" ? <Badge tone="muted">ندارد</Badge> : <Badge tone="bad" dot>ندارد</Badge>, hideBelow: "md" },
            { key: "l", header: "آخرین ورود", cell: (r) => <span className="text-muted-foreground">{faAgo(r.last_sign_in_at)}</span>, hideBelow: "xl" },
            { key: "s", header: "وضعیت", cell: (r) => <Badge tone={STATUS[r.status].tone} dot>{STATUS[r.status].label}</Badge> },
          ]} />
      )}

      {sel && (
        <StaffDrawer orgId={orgId} person={sel} grants={byUser.get(sel.user_id) ?? []} roles={roles.data ?? []} units={units.data ?? []}
          access={access} onClose={() => setOpen(null)} onChanged={reload} />
      )}
      {inviting && (
        <InviteDrawer orgId={orgId} roles={roles.data ?? []} units={units.data ?? []} access={access}
          onClose={() => setInviting(false)} onDone={() => { setInviting(false); reload(); }} />
      )}
    </>
  );
}

function StaffDrawer({ orgId, person, grants, roles, units, access, onClose, onChanged }: {
  orgId: string; person: StaffRow; grants: GrantRow[]; roles: RoleRow[]; units: UnitRow[];
  access: CentrePageProps["access"]; onClose: () => void; onChanged: () => void;
}) {
  const [title, setTitle] = React.useState(person.title);
  const [unit, setUnit] = React.useState<string | null>(person.unit_id);
  const [base, setBase] = React.useState<Exclude<BaseRole, "owner">>(person.base_role === "owner" ? "manager" : person.base_role);
  const [confirm, setConfirm] = React.useState<ConfirmSpec | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const isOwner = person.base_role === "owner";
  const canMembers = access.canSomewhere("org.members.manage");
  const canRoles = access.canSomewhere("org.roles.manage");
  const dirty = title !== person.title || unit !== person.unit_id;

  async function saveBasics() {
    setBusy(true); setErr("");
    try { await orgStaffUpdate(orgId, person.user_id, title.trim(), unit); onChanged(); } catch (e) { setErr(orgConsoleError(e)); } finally { setBusy(false); }
  }

  return (
    <>
      <Drawer open onClose={onClose} width={640}
        title={<span className="flex flex-wrap items-center gap-2">{person.display_name || person.username}
          <Badge tone={BASE_TONE[person.base_role]}>{BASE_ROLE_LABEL[person.base_role]}</Badge>
          <Badge tone={STATUS[person.status].tone} dot>{STATUS[person.status].label}</Badge></span>}
        subtitle={`@${person.username} · عضو از ${faDate(person.since)}`}
        footer={!isOwner && canMembers && (
          <div className="flex justify-end">
            <Btn size="sm" kind="danger" icon={UserMinus} onClick={() => setConfirm({
              title: "حذف از مرکز", danger: true, needReason: true, confirmLabel: "حذف کن",
              text: `${person.display_name || person.username} از مرکز حذف می‌شود، همه‌ی نقش‌های افزوده‌اش پس گرفته می‌شود و نوشته‌ها و درس‌هایش دیگر به نام مرکز نیست. حساب Lexa او پاک نمی‌شود.`,
              run: (r) => orgStaffRemove(orgId, person.user_id, r) })}>حذف از مرکز</Btn>
          </div>
        )}>
        <div className="space-y-4">
          <Panel title="مشخصات" icon={UserCog}>
            <KeyValues items={[
              ["ورود دومرحله‌ای", person.mfa ? "فعال" : "ندارد"],
              ["آخرین ورود", faAgo(person.last_sign_in_at)],
              ["کلاس‌های فعال (استاد)", faNum(person.classes)],
            ]} />
            {canMembers && !isOwner && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1"><span className="text-[12px] font-bold">عنوان</span>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className={cx(inputCls, "w-full")} placeholder="مثلاً مشاور تحصیلی" /></label>
                <label className="block space-y-1"><span className="text-[12px] font-bold">واحد اصلی</span>
                  <UnitSelect units={units} value={unit} onChange={setUnit} label="واحد اصلی" className="w-full" /></label>
                <div className="sm:col-span-2 flex justify-end"><Btn size="sm" kind="primary" busy={busy} disabled={!dirty} onClick={() => void saveBasics()}>ذخیره</Btn></div>
              </div>
            )}
            {err && <div className="mt-3"><Notice tone="bad" title="ذخیره نشد">{err}</Notice></div>}
          </Panel>

          {access.isOwner && !isOwner && (
            <Panel title="نقش پایه" icon={ShieldCheck} description="فقط مالک تغییر می‌دهد. مدیر کل همه‌ی دسترسی‌ها جز نقش‌ها را دارد؛ مدرس صندلی مدرس می‌گیرد؛ کارمند صندلی نمی‌گیرد.">
              <div className="flex flex-wrap items-center gap-2">
                <select aria-label="نقش پایه" value={base} onChange={(e) => setBase(e.target.value as Exclude<BaseRole, "owner">)} className={inputCls}>
                  {(["manager", "teacher", "staff"] as const).map((r) => <option key={r} value={r}>{BASE_ROLE_LABEL[r]}</option>)}
                </select>
                <Btn size="sm" disabled={base === person.base_role} onClick={() => setConfirm({
                  title: "تغییر نقش پایه", needReason: true, confirmLabel: "تغییر بده", danger: base === "manager",
                  text: `نقش پایه‌ی ${person.display_name || person.username} از «${BASE_ROLE_LABEL[person.base_role]}» به «${BASE_ROLE_LABEL[base]}» تغییر می‌کند.`,
                  run: (r) => orgSetBaseRole(orgId, person.user_id, base, r) })}>اعمال</Btn>
              </div>
            </Panel>
          )}

          <Panel title="نقش‌های افزوده" icon={ShieldCheck} bodyClass="p-0"
            description="هر نقش در کل مرکز یا فقط در یک شاخه از درخت (با همه‌ی زیرمجموعه) معتبر است">
            {isOwner ? <p className="p-4 text-[12.5px] text-muted-foreground">مالک همه‌ی دسترسی‌ها را دارد.</p> : (
              <>
                {!grants.length ? <p className="p-4 text-[12.5px] text-muted-foreground">نقش افزوده‌ای ندارد.</p> : (
                  <ul className="divide-y divide-border">
                    {grants.map((g) => (
                      <li key={g.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-bold">{g.role_name} <span className="font-normal text-muted-foreground">· {g.unit_name ?? "کل مرکز"}</span></p>
                          <p className="text-[11px] text-muted-foreground">
                            {g.expires_at ? (g.expired ? <span className="text-amber-700 dark:text-amber-400">منقضی از {faDate(g.expires_at)}</span> : `تا ${faDate(g.expires_at)}`) : "بدون انقضا"}
                            {g.granted_by_name ? ` · اعطا: ${g.granted_by_name}` : ""} · {faDate(g.granted_at)}{g.note ? ` · ${g.note}` : ""}
                          </p>
                        </div>
                        {canRoles && <Btn size="sm" icon={Trash2} onClick={() => setConfirm({
                          title: "پس گرفتن نقش", needReason: true, confirmLabel: "پس بگیر",
                          text: `«${g.role_name}» در «${g.unit_name ?? "کل مرکز"}» از ${person.display_name || person.username} پس گرفته می‌شود.`,
                          run: (r) => orgGrantRevoke(g.id, r) })}>پس گرفتن</Btn>}
                      </li>
                    ))}
                  </ul>
                )}
                {canRoles && <GrantForm orgId={orgId} userId={person.user_id} roles={roles} units={units} access={access} onDone={onChanged} />}
              </>
            )}
          </Panel>
        </div>
      </Drawer>
      <ConfirmDialog spec={confirm} onClose={() => setConfirm(null)} onDone={onChanged} errorText={orgConsoleError} />
    </>
  );
}

function GrantForm({ orgId, userId, roles, units, access, onDone }: {
  orgId: string; userId: string; roles: RoleRow[]; units: UnitRow[]; access: CentrePageProps["access"]; onDone: () => void;
}) {
  const grantable = roles.filter((r) => !r.base);
  const wide = access.can("org.roles.manage");
  const [roleId, setRoleId] = React.useState("");
  const [unit, setUnit] = React.useState<string | null>(wide ? null : access.unitsFor("org.roles.manage")[0]?.id ?? null);
  const [expires, setExpires] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const scoped = React.useMemo(() => (wide ? undefined : new Set(access.unitsFor("org.roles.manage").map((u) => u.id))), [wide, access]);
  async function go() {
    setBusy(true); setErr("");
    try { await orgGrant(orgId, userId, roleId, unit, expires ? endOfDayIso(expires) : null, note.trim()); setRoleId(""); setNote(""); setExpires(""); onDone(); }
    catch (e) { setErr(orgConsoleError(e)); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-3 border-t border-border bg-muted/20 p-4">
      <p className="text-[12px] font-bold">نقش تازه</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <select aria-label="نقش" value={roleId} onChange={(e) => setRoleId(e.target.value)} className={cx(inputCls, "w-full")}>
          <option value="">انتخاب نقش…</option>
          {grantable.map((r) => <option key={r.id} value={r.id}>{r.name}{r.is_system ? "" : " (سفارشی)"}</option>)}
        </select>
        <UnitSelect units={units} value={unit} onChange={setUnit} label="دامنه" centreLabel="در کل مرکز" allowCentre={wide} only={scoped} className="w-full" />
        <label className="flex items-center gap-2 text-[12px]"><span className="shrink-0 text-muted-foreground">انقضا (اختیاری)</span>
          <input type="date" dir="ltr" value={expires} onChange={(e) => setExpires(e.target.value)} className={cx(inputCls, "w-full")} /></label>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="یادداشت (اختیاری)" className={cx(inputCls, "w-full")} />
      </div>
      {err && <Notice tone="bad" title="داده نشد">{err}</Notice>}
      <div className="flex justify-end"><Btn size="sm" kind="primary" icon={Plus} busy={busy} disabled={!roleId || (!wide && !unit)} onClick={() => void go()}>دادن نقش</Btn></div>
    </div>
  );
}

function InviteDrawer({ orgId, roles, units, access, onClose, onDone }: {
  orgId: string; roles: RoleRow[]; units: UnitRow[]; access: CentrePageProps["access"]; onClose: () => void; onDone: () => void;
}) {
  const wide = access.can("org.members.manage");
  const [uname, setUname] = React.useState("");
  const [found, setFound] = React.useState<FoundUser | null>(null);
  const [looking, setLooking] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [roleId, setRoleId] = React.useState("");
  const [unit, setUnit] = React.useState<string | null>(wide ? null : access.unitsFor("org.members.manage")[0]?.id ?? null);
  const [expires, setExpires] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const scoped = React.useMemo(() => (wide ? undefined : new Set(access.unitsFor("org.members.manage").map((u) => u.id))), [wide, access]);
  async function look() {
    setLooking(true); setErr(""); setFound(null);
    try { const u = await findUserByUsername(uname); if (!u) setErr("کاربری با این نام کاربری پیدا نشد."); else setFound(u); }
    catch (e) { setErr(orgConsoleError(e)); } finally { setLooking(false); }
  }
  async function send() {
    if (!found) return;
    setBusy(true); setErr("");
    try {
      await orgStaffInvite(orgId, { userId: found.id, title: title.trim(), roleId: roleId || null, unitId: unit, expiresAt: expires ? endOfDayIso(expires) : null });
      onDone();
    } catch (e) { setErr(orgConsoleError(e)); } finally { setBusy(false); }
  }
  return (
    <Drawer open onClose={onClose} width={560} title="دعوت کارمند" subtitle="مشاور، مالی و پشتیبانی، مسئول آزمون، ناظر… (صندلی مدرس نمی‌گیرد؛ استادها از بخش «استادها» دعوت می‌شوند)"
      footer={<div className="flex justify-end gap-2"><Btn onClick={onClose}>انصراف</Btn><Btn kind="primary" icon={MailPlus} busy={busy} disabled={!found} onClick={() => void send()}>فرستادن دعوت</Btn></div>}>
      <div className="space-y-4">
        <label className="block space-y-1"><span className="text-[12px] font-bold">نام کاربری Lexa</span>
          <div className="flex gap-2">
            <input dir="ltr" value={uname} onChange={(e) => { setUname(e.target.value); setFound(null); }} onKeyDown={(e) => { if (e.key === "Enter" && uname.trim()) void look(); }}
              placeholder="@username" className={cx(inputCls, "flex-1")} />
            <Btn busy={looking} disabled={!uname.trim()} onClick={() => void look()}>پیدا کن</Btn>
          </div></label>
        {found && (
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <PersonCell name={found.display_name} username={found.username} avatar={found.avatar_url} sub={found.role === "teacher" ? "مدرس" : found.role === "admin" ? "مدیر Lexa" : "کاربر"} />
          </div>
        )}
        <label className="block space-y-1"><span className="text-[12px] font-bold">عنوان</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="مثلاً کارشناس آموزش" className={cx(inputCls, "w-full")} /></label>
        <label className="block space-y-1"><span className="text-[12px] font-bold">واحد</span>
          <UnitSelect units={units} value={unit} onChange={setUnit} label="واحد" allowCentre={wide} only={scoped} className="w-full" /></label>
        {access.canSomewhere("org.roles.manage") && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1"><span className="text-[12px] font-bold">نقش (اختیاری)</span>
              <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className={cx(inputCls, "w-full")}>
                <option value="">بدون نقش فعلاً</option>
                {roles.filter((r) => !r.base).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select></label>
            <label className="block space-y-1"><span className="text-[12px] font-bold">انقضای نقش</span>
              <input type="date" dir="ltr" value={expires} onChange={(e) => setExpires(e.target.value)} disabled={!roleId} className={cx(inputCls, "w-full")} /></label>
          </div>
        )}
        <p className="text-[11.5px] leading-relaxed text-muted-foreground">دعوت در حساب شخص دیده می‌شود و تا آن را نپذیرد، هیچ دسترسی‌ای ندارد. نقش در دامنه‌ی همان واحد داده می‌شود.</p>
        {err && <Notice tone="bad" title="انجام نشد">{err}</Notice>}
      </div>
    </Drawer>
  );
}
