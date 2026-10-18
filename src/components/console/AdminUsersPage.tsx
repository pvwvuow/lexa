"use client";
/* Platform console: users and roles (phase A1 of docs/ADMIN_PLATFORM.md). Search with filters, open
 * a record (audited as admin.user.view), change the global role with a reason, and run the account
 * actions of the admin-users function: suspend / unsuspend, sign out everywhere, reset two-factor.
 * The whole page needs an aal2 session. */
import * as React from "react";
import { KeyRound, LogOut, ScrollText, ShieldAlert, ShieldOff, UserCheck, UserCog, Users, UserX } from "lucide-react";
import { useAal } from "@/lib/mfa";
import { MfaPanel } from "@/components/app/MfaPanel";
import {
  actionLabel, adminChangeRole, adminError, adminUserAction, adminUserDetail, adminUsers, faAgo,
  faDate, faDateTime, faHours, faNum, ROLE_LABEL, type AdminUserDetail, type AdminUserRow,
  type GlobalRole, type UserAction, type UserFilter,
} from "@/lib/cloud-api/admin-console";
import {
  Badge, Btn, ConfirmDialog, DataTable, Drawer, EmptyState, KeyValues, Notice, PageHeader, Pager,
  Panel, RefreshBtn, SearchBox, Select, Toolbar, TrendChart, useLoad, type ConfirmSpec, type Tone,
} from "./ConsoleKit";

const LIMIT = 50;
const ROLE_TONE: Record<GlobalRole, Tone> = { admin: "brand", teacher: "info", user: "muted" };

const FILTERS: { key: UserFilter; label: string }[] = [
  { key: "all", label: "همهٔ کاربران" },
  { key: "suspended", label: "معلق‌شده‌ها" },
  { key: "staff", label: "استاد و مدیر" },
  { key: "admins_no_mfa", label: "مدیر بدون ورود دومرحله‌ای" },
  { key: "new_7d", label: "تازه‌های ۷ روز" },
  { key: "inactive_30d", label: "غیرفعالِ ۳۰ روز" },
];

export function AdminUsersPage() {
  const aal = useAal();
  if (aal !== "aal2") {
    return (
      <>
        <PageHeader title="کاربران و نقش‌ها" description="پروندهٔ کاربر، تغییر نقش با دلیل، تعلیق، خروج اجباری از دستگاه‌ها و بازنشانی ورود دومرحله‌ای." />
        <div className="mb-4"><Notice tone="warn" title="این بخش به ورود دومرحله‌ای نیاز دارد">
          برای دیدن پرونده‌ها و انجام هر تغییری، ابتدا از بخش «امنیت» ورود دومرحله‌ای را فعال یا تأیید کنید.
        </Notice></div>
        <Panel title="ورود دومرحله‌ای" icon={ShieldAlert}><MfaPanel /></Panel>
      </>
    );
  }
  return <UsersInner />;
}

function UsersInner() {
  const [draftQ, setDraftQ] = React.useState("");
  const [q, setQ] = React.useState("");
  const [role, setRole] = React.useState<GlobalRole | "all">("all");
  const [filter, setFilter] = React.useState<UserFilter>("all");
  const [offset, setOffset] = React.useState(0);
  const [open, setOpen] = React.useState<string | null>(null); // user id of the open record
  const list = useLoad(
    () => adminUsers({ q, role, filter, limit: LIMIT, offset }),
    [q, role, filter, offset],
  );

  const apply = () => { setQ(draftQ.trim()); setOffset(0); };
  const reset = () => { setDraftQ(""); setQ(""); setRole("all"); setFilter("all"); setOffset(0); };
  const refresh = React.useCallback(() => { void list.reload(); }, [list]);

  return (
    <>
      <PageHeader title="کاربران و نقش‌ها" description="جست‌وجو با بخشی از نام کاربری، ایمیل یا نام نمایشی. باز کردن هر پرونده در گزارش ممیزی ثبت می‌شود (admin.user.view)."
        actions={<RefreshBtn onClick={refresh} busy={list.busy} at={list.at} />} />
      <Panel className="mb-4" bodyClass="p-3">
        <Toolbar>
          <SearchBox value={draftQ} onChange={setDraftQ} onEnter={apply} placeholder="جست‌وجوی کاربر (نام کاربری، ایمیل، نام)…" className="min-w-[240px] flex-1" />
          <Btn kind="primary" size="sm" icon={UserCog} onClick={apply}>جست‌وجو</Btn>
          <Select<GlobalRole | "all"> label="نقش" value={role} onChange={(v) => { setRole(v); setOffset(0); }}
            options={[{ key: "all", label: "همهٔ نقش‌ها" }, { key: "user", label: ROLE_LABEL.user }, { key: "teacher", label: ROLE_LABEL.teacher }, { key: "admin", label: ROLE_LABEL.admin }]} />
          <Select<UserFilter> label="فیلتر" value={filter} onChange={(v) => { setFilter(v); setOffset(0); }} options={FILTERS} />
          {(q || role !== "all" || filter !== "all") && <Btn kind="ghost" size="sm" onClick={reset}>پاک‌کردن</Btn>}
        </Toolbar>
      </Panel>
      {list.error ? <div className="mb-4"><Notice tone="bad" title="فهرست کاربران خوانده نشد">{adminError(list.error)}</Notice></div> : null}
      <DataTable rows={list.data?.rows ?? null} loading={list.busy} rowKey={(r) => r.id} onRowClick={(r) => setOpen(r.id)} selectedKey={open}
        empty={<EmptyState icon={Users} title="کاربری با این شرایط پیدا نشد" text="جست‌وجو را کوتاه‌تر کنید یا فیلتر نقش را عوض کنید." />}
        columns={[
          { key: "u", header: "کاربر", cell: (r) => (
            <span className="min-w-[160px]">
              <b className="block truncate">{r.display_name || r.username}</b>
              <span dir="ltr" className="text-[11px] text-muted-foreground">@{r.username} · {r.email_masked}</span>
            </span>
          ) },
          { key: "r", header: "نقش", cell: (r) => <Badge tone={ROLE_TONE[r.role]}>{ROLE_LABEL[r.role]}</Badge> },
          { key: "f", header: "وضعیت", hideBelow: "sm", cell: (r) => (
            <span className="flex flex-wrap gap-1">
              {r.suspended ? <Badge tone="bad" dot>معلق</Badge> : null}
              {r.banned && !r.suspended ? <Badge tone="bad" dot>مسدود</Badge> : null}
              {r.role === "admin" && !r.mfa ? <Badge tone="warn" dot>بدون دومرحله‌ای</Badge> : null}
              {!r.suspended && !r.banned ? <Badge tone="ok" dot>عادی</Badge> : null}
            </span>
          ) },
          { key: "o", header: "مراکز", hideBelow: "md", cell: (r) => <span className="tabular-nums">{faNum(r.orgs)}</span> },
          { key: "of", header: "دانشجوی رسمی", hideBelow: "lg", cell: (r) => <span className="tabular-nums">{r.official ? <Badge tone="info">رسمی</Badge> : "—"}</span> },
          { key: "s", header: "مطالعهٔ ۳۰ روز", hideBelow: "xl", cell: (r) => <span className="tabular-nums text-[12px]">{faHours(r.study_seconds_30d)} ساعت</span> },
          { key: "l", header: "آخرین ورود", hideBelow: "xl", cell: (r) => <span className="text-[11.5px] text-muted-foreground">{faAgo(r.last_sign_in_at)}</span> },
        ]} />
      <Pager offset={offset} limit={LIMIT} total={list.data?.total ?? 0} onPage={setOffset} />
      <UserDrawer uid={open} onClose={() => setOpen(null)} onChanged={refresh} />
    </>
  );
}

function UserDrawer({ uid, onClose, onChanged }: { uid: string | null; onClose: () => void; onChanged: () => void }) {
  const detail = useLoad(() => (uid ? adminUserDetail(uid) : Promise.resolve(null)), [uid]);
  const [confirm, setConfirm] = React.useState<ConfirmSpec | null>(null);
  const [actionErr, setActionErr] = React.useState("");
  const d = detail.data;
  if (!uid) return null;
  const run = (spec: ConfirmSpec) => { setActionErr(""); setConfirm(spec); };
  const act = (action: UserAction, label: string, opts: { danger?: boolean; needReason?: boolean } = {}) =>
    run({
      title: label,
      text: <>این کار روی حساب <b dir="ltr">@{d?.username ?? ""}</b> انجام می‌شود و با انجام‌دهنده و دلیل در گزارش ممیزی ثبت می‌شود.</>,
      confirmLabel: label,
      danger: opts.danger,
      needReason: opts.needReason,
      run: (reason) => adminUserAction(uid, action, reason).then(() => { void detail.reload(); onChanged(); }),
    });

  return (
    <>
      <Drawer open onClose={onClose} title={d ? d.display_name || d.username : "پروندهٔ کاربر"}
        subtitle={d ? `@${d.username} · ${ROLE_LABEL[d.role]}` : "در حال خواندن…"} width={640}
        footer={d && (
          <div className="flex flex-wrap items-center gap-2">
            <RoleAction d={d} onSpec={run} />
            {d.flags?.suspended
              ? <Btn size="sm" icon={UserCheck} onClick={() => act("unsuspend", "رفع تعلیق حساب")}>رفع تعلیق</Btn>
              : <Btn size="sm" kind="danger" icon={UserX} onClick={() => act("suspend", "تعلیق حساب", { danger: true, needReason: true })}>تعلیق</Btn>}
            <Btn size="sm" icon={LogOut} onClick={() => act("revoke_sessions", "خروج اجباری از همهٔ دستگاه‌ها", { danger: true })}>خروج از دستگاه‌ها</Btn>
            {(d.factors.length > 0) && (
              <Btn size="sm" kind="danger" icon={KeyRound} onClick={() => act("reset_mfa", "بازنشانی ورود دومرحله‌ای", { danger: true })}>بازنشانی دومرحله‌ای</Btn>
            )}
          </div>
        )}>
        {detail.error ? <Notice tone="bad" title="پرونده خوانده نشد">{adminError(detail.error)}</Notice> : null}
        {!d && !detail.error ? <p className="text-[12px] text-muted-foreground">در حال خواندن پرونده…</p> : null}
        {d && (
          <>
            {actionErr && <Notice tone="bad" title="کار انجام نشد">{actionErr}</Notice>}
            {detail.data?.flags?.suspended && (
              <Notice tone="bad" title="این حساب معلق است">
                {detail.data.flags.reason ? <>دلیل: {detail.data.flags.reason}</> : "بدون دلیل ثبت‌شده"}
                {detail.data.flags.changed_at ? <> — {faDateTime(detail.data.flags.changed_at)}{detail.data.flags.changed_by ? ` توسط ${detail.data.flags.changed_by}` : ""}</> : null}
              </Notice>
            )}
            <KeyValues items={[
              ["نام کاربری", <span key="u" dir="ltr">@{d.username}</span>],
              ["نقش", <Badge key="r" tone={ROLE_TONE[d.role]}>{ROLE_LABEL[d.role]}</Badge>],
              ["ایمیل", <span key="e" dir="ltr">{d.email || "—"}</span>],
              ["شماره", <span key="p" dir="ltr">{d.phone || "—"}</span>],
              ["ورود با", d.providers.join("، ") || "—"],
              ["ساخته‌شده", faDate(d.created_at)],
              ["آخرین ورود", faDateTime(d.last_sign_in_at)],
              ["تأیید ایمیل", d.email_confirmed_at ? faDate(d.email_confirmed_at) : "تأییدنشده"],
            ]} />
            <Panel title="ورود دومرحله‌ای" icon={KeyRound}>
              {d.factors.length === 0
                ? <p className="text-[12px] text-muted-foreground">عاملی ثبت نشده است.</p>
                : (
                  <div className="flex flex-wrap gap-2">
                    {d.factors.map((f) => (
                      <Badge key={`${f.type}-${f.created_at}`} tone={f.status === "verified" ? "ok" : "warn"} dot>
                        {f.name || f.type} · {f.status === "verified" ? "تأییدشده" : f.status}
                      </Badge>
                    ))}
                  </div>
                )}
            </Panel>
            <Panel title="عضویت در مراکز" icon={Users}>
              {d.memberships.length === 0
                ? <p className="text-[12px] text-muted-foreground">عضویتی ثبت نشده است.</p>
                : (
                  <ul className="space-y-1.5 text-[12.5px]">
                    {d.memberships.map((m) => (
                      <li key={m.org_id} className="flex flex-wrap items-center gap-2">
                        <b>{m.name}</b>
                        <Badge tone="brand">{m.role === "owner" ? "مالک" : m.role === "manager" ? "مدیر" : "مدرس"}</Badge>
                        <Badge tone={m.status === "active" ? "ok" : "muted"}>{m.status === "active" ? "فعال" : m.status}</Badge>
                        {m.title && <span className="text-muted-foreground">{m.title}</span>}
                      </li>
                    ))}
                  </ul>
                )}
            </Panel>
            {d.official.length > 0 && (
              <Panel title="دانشجوی رسمی" icon={UserCheck}>
                <ul className="space-y-1.5 text-[12.5px]">
                  {d.official.map((o) => (
                    <li key={o.org_id} className="flex flex-wrap items-center gap-2">
                      <b>{o.name}</b>
                      <span dir="ltr" className="text-[11.5px] text-muted-foreground">{o.username}</span>
                      <Badge tone={o.status === "active" ? "ok" : "muted"}>{o.status === "active" ? "فعال" : o.status}</Badge>
                      {o.student_no && <span className="text-[11px] text-muted-foreground">شماره: {o.student_no}</span>}
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
            {d.teacher_request && (
              <Panel title="درخواست حساب مدرس" icon={UserCog}>
                <p className="text-[12.5px]">
                  وضعیت: <Badge tone={d.teacher_request.status === "pending" ? "warn" : d.teacher_request.status === "approved" ? "ok" : "muted"}>{d.teacher_request.status === "pending" ? "در انتظار بررسی" : d.teacher_request.status === "approved" ? "تأییدشده" : "ردشده"}</Badge>
                  <span className="ms-2 text-muted-foreground">{faDate(d.teacher_request.created_at)}</span>
                </p>
              </Panel>
            )}
            <Panel title="مطالعهٔ ۳۰ روز" icon={ScrollText}>
              <p className="mb-2 text-[12px] text-muted-foreground">
                ۷ روز: {faHours(d.study.seconds_7d)} ساعت · ۳۰ روز: {faHours(d.study.seconds_30d)} ساعت · {faNum(d.study.days_30d)} روز فعال
              </p>
              <TrendChart labels={d.study.daily.map((x) => x.day.slice(5))} height={140}
                series={[{ name: "دقیقه", color: "#8a6a30", area: true, values: d.study.daily.map((x) => Math.round(x.seconds / 60)) }]}
                format={(v) => `${faNum(v)} دقیقه`} />
            </Panel>
            <Panel title="رویدادهای اخیر این کاربر" icon={ScrollText}>
              {d.audit.length === 0
                ? <p className="text-[12px] text-muted-foreground">رویدادی ثبت نشده است.</p>
                : (
                  <ul className="space-y-1.5 text-[12px]">
                    {d.audit.slice(0, 10).map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center gap-2">
                        <span className="tabular-nums text-muted-foreground">{faDateTime(a.at)}</span>
                        <b>{actionLabel(a.action)}</b>
                        <span className="text-muted-foreground">{a.actor ? <>توسط <code dir="ltr" className="text-[10.5px]">{a.actor.slice(0, 8)}</code></> : "سیستم"}</span>
                      </li>
                    ))}
                  </ul>
                )}
            </Panel>
          </>
        )}
      </Drawer>
      <ConfirmDialog spec={confirm} onClose={() => setConfirm(null)} errorText={(e) => { const m = adminError(e); setActionErr(m); return m; }} />
    </>
  );
}

function RoleAction({ d, onSpec }: { d: AdminUserDetail; onSpec: (s: ConfirmSpec) => void }) {
  const [role, setRole] = React.useState<GlobalRole>(d.role);
  React.useEffect(() => setRole(d.role), [d.role, d.id]);
  return (
    <span className="inline-flex items-center gap-1.5">
      <Select<GlobalRole> label="نقش تازه" value={role} onChange={setRole}
        options={[{ key: "user", label: ROLE_LABEL.user }, { key: "teacher", label: ROLE_LABEL.teacher }, { key: "admin", label: ROLE_LABEL.admin }]} />
      <Btn size="sm" icon={ShieldOff} disabled={role === d.role}
        onClick={() => onSpec({
          title: "تغییر نقش کاربر",
          text: <>نقش <b dir="ltr">@{d.username}</b> از «{ROLE_LABEL[d.role]}» به «{ROLE_LABEL[role]}» تغییر می‌کند. به‌ویژه برای نقش مدیر، دلیل روشن بنویسید.</>,
          confirmLabel: "تغییر نقش",
          needReason: true,
          run: (reason) => adminChangeRole(d.id, role, reason),
        })}>تغییر نقش…</Btn>
    </span>
  );
}
