"use client";
/* Platform console: users and roles (phase A1 of docs/ADMIN_PLATFORM.md). Search across every
 * account, filter by role and state, and act on one account from its record: role (with a reason),
 * suspend / unsuspend, sign out everywhere, reset two-factor. Needs a two-factor session. */
import * as React from "react";
import { Ban, Download, KeyRound, LogOut, ShieldAlert, ShieldCheck, UserCog, Users } from "lucide-react";
import { useAal } from "@/lib/mfa";
import { MfaPanel } from "@/components/app/MfaPanel";
import { navigate } from "@/lib/router";
import {
  actionLabel, adminChangeRole, adminError, adminUserAction, adminUserDetail, adminUsers, downloadCsv, faAgo, faDate,
  faDateTime, faHours, faNum, MEMBER_ROLE_LABEL, ROLE_LABEL, toCsv, type AdminUserRow, type GlobalRole, type UserFilter,
} from "@/lib/cloud-api/admin-console";
import {
  Badge, Btn, ConfirmDialog, DataTable, Drawer, EmptyState, inputCls, KeyValues, Notice, PageHeader, Pager, Panel,
  RefreshBtn, SearchBox, Segmented, Select, Sparkline, Toolbar, useLoad, type ConfirmSpec,
} from "./ConsoleKit";

const LIMIT = 50;
const STATUS_LABEL: Record<string, string> = { active: "فعال", suspended: "معلق", graduated: "فارغ‌التحصیل", withdrawn: "انصرافی", invited: "دعوت‌شده", requested: "درخواست", declined: "ردشده", removed: "حذف‌شده" };

export function AdminUsersPage({ initialQuery }: { initialQuery: string }) {
  const aal = useAal();
  if (aal !== "aal2") {
    return (
      <>
        <PageHeader title="کاربران و نقش‌ها" description="جستجو، نقش سراسری، تعلیق و امنیت حساب‌ها." />
        <Panel title="ورود دومرحله‌ای لازم است" icon={ShieldAlert}>
          <p className="mb-3 text-[12.5px] text-muted-foreground">فهرست کاربران شامل اطلاعات شخصی است و فقط از نشست دومرحله‌ای باز می‌شود.</p>
          <MfaPanel />
        </Panel>
      </>
    );
  }
  return <UsersInner initialQuery={initialQuery} />;
}

function UsersInner({ initialQuery }: { initialQuery: string }) {
  const [q, setQ] = React.useState(initialQuery);
  const [applied, setApplied] = React.useState(initialQuery);
  const [role, setRole] = React.useState<GlobalRole | "all">("all");
  const [filter, setFilter] = React.useState<UserFilter>("all");
  const [offset, setOffset] = React.useState(0);
  const [openId, setOpenId] = React.useState<string | null>(null);
  React.useEffect(() => { setQ(initialQuery); setApplied(initialQuery); setOffset(0); }, [initialQuery]);
  React.useEffect(() => {
    const t = setTimeout(() => { setApplied(q.trim()); setOffset(0); }, 350);
    return () => clearTimeout(t);
  }, [q]);
  const list = useLoad(() => adminUsers({ q: applied, role, filter, limit: LIMIT, offset }), [applied, role, filter, offset]);

  function exportCsv() {
    const r = list.data?.rows;
    if (!r) return;
    downloadCsv(`lexa-users-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(
      ["username", "display_name", "role", "email_masked", "created_at", "last_sign_in_at", "suspended", "mfa", "orgs", "official", "study_hours_30d"],
      r.map((u) => [u.username, u.display_name, u.role, u.email_masked, u.created_at, u.last_sign_in_at, u.suspended || u.banned ? "yes" : "no",
        u.mfa ? "yes" : "no", u.orgs, u.official, Math.round(u.study_seconds_30d / 360) / 10]),
    ));
  }

  return (
    <>
      <PageHeader title="کاربران و نقش‌ها" description="همهٔ حساب‌های Lexa. ایمیل‌ها در فهرست نیمه‌پنهان‌اند؛ پروندهٔ کامل با ثبت در ممیزی باز می‌شود."
        actions={<>
          <Btn size="sm" icon={Download} onClick={exportCsv} disabled={!list.data?.rows.length}>خروجی همین صفحه</Btn>
          <RefreshBtn onClick={() => void list.reload()} busy={list.busy} at={list.at} />
        </>} />
      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="نام کاربری، نام یا ایمیل…" className="min-w-[220px] flex-1" />
        <Select label="نقش" value={role} onChange={(v) => { setRole(v); setOffset(0); }} options={[
          { key: "all", label: "همهٔ نقش‌ها" }, { key: "user", label: "کاربر" }, { key: "teacher", label: "مدرس" }, { key: "admin", label: "مدیر Lexa" },
        ]} />
        <Segmented value={filter} onChange={(v) => { setFilter(v); setOffset(0); }} options={[
          { key: "all", label: "همه" }, { key: "new_7d", label: "جدید ۷ روز" }, { key: "inactive_30d", label: "غیرفعال ۳۰ روز" },
          { key: "staff", label: "کادر" }, { key: "suspended", label: "معلق" }, { key: "admins_no_mfa", label: "مدیر بدون ۲FA" },
        ]} />
      </Toolbar>
      {list.error ? <Notice tone="bad" title="فهرست کاربران خوانده نشد">{adminError(list.error)}</Notice> : null}
      <DataTable rows={list.data?.rows ?? null} loading={list.busy} rowKey={(u) => u.id} onRowClick={(u) => setOpenId(u.id)} selectedKey={openId}
        empty={<EmptyState icon={Users} title="کاربری پیدا نشد" text="عبارت جستجو یا فیلترها را تغییر دهید." />}
        columns={[
          { key: "u", header: "کاربر", cell: (u) => <UserCell u={u} /> },
          { key: "r", header: "نقش", cell: (u) => <Badge tone={u.role === "admin" ? "brand" : u.role === "teacher" ? "info" : "muted"}>{ROLE_LABEL[u.role] ?? u.role}</Badge> },
          { key: "s", header: "وضعیت", cell: (u) => (
            <div className="flex flex-wrap gap-1">
              {u.suspended || u.banned ? <Badge tone="bad" dot>معلق</Badge> : <Badge tone="ok" dot>فعال</Badge>}
              {u.mfa && <Badge tone="ok">2FA</Badge>}
            </div>
          ) },
          { key: "o", header: "مراکز", hideBelow: "lg", cell: (u) => <span className="text-[12px] text-muted-foreground">{u.orgs ? `${faNum(u.orgs)} عضویت` : ""}{u.orgs && u.official ? " · " : ""}{u.official ? `${faNum(u.official)} حساب رسمی` : ""}{!u.orgs && !u.official ? "—" : ""}</span> },
          { key: "m", header: "مطالعه ۳۰ روز", hideBelow: "md", cell: (u) => <span className="tabular-nums">{u.study_seconds_30d ? `${faHours(u.study_seconds_30d)} ساعت` : "—"}</span> },
          { key: "c", header: "عضویت", hideBelow: "xl", cell: (u) => <span className="whitespace-nowrap text-[12px] text-muted-foreground">{faDate(u.created_at)}</span> },
          { key: "l", header: "آخرین ورود", hideBelow: "sm", cell: (u) => <span className="whitespace-nowrap text-[12px] text-muted-foreground">{faAgo(u.last_sign_in_at)}</span> },
        ]} />
      <Pager offset={offset} limit={LIMIT} total={list.data?.total ?? 0} onPage={setOffset} />
      {openId && <UserDrawer key={openId} uid={openId} onClose={() => setOpenId(null)} onChanged={() => void list.reload()} />}
    </>
  );
}

function UserCell({ u }: { u: Pick<AdminUserRow, "username" | "display_name" | "avatar_url" | "email_masked"> }) {
  return (
    <div className="flex min-w-[200px] items-center gap-2.5">
      {u.avatar_url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={u.avatar_url} alt="" className="h-8 w-8 shrink-0 rounded-full border border-border object-cover" />
        : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary/80 to-bronze text-[12px] font-bold text-primary-foreground">{(u.display_name || u.username).slice(0, 1)}</span>}
      <span className="min-w-0"><b className="block truncate">{u.display_name || u.username}</b>
        <span className="block truncate text-[11px] text-muted-foreground">@{u.username} · <span dir="ltr">{u.email_masked}</span></span></span>
    </div>
  );
}

function UserDrawer({ uid, onClose, onChanged }: { uid: string; onClose: () => void; onChanged: () => void }) {
  const d = useLoad(() => adminUserDetail(uid), [uid]);
  const [confirm, setConfirm] = React.useState<ConfirmSpec | null>(null);
  const [newRole, setNewRole] = React.useState<GlobalRole | "">("");
  const [note, setNote] = React.useState("");
  const u = d.data;
  const suspended = !!u && (!!u.flags?.suspended || (!!u.banned_until && new Date(u.banned_until).getTime() > Date.now()));
  const done = () => { void d.reload(); onChanged(); };
  const ACTIONS: Record<"suspend" | "unsuspend" | "revoke_sessions" | "reset_mfa", Omit<ConfirmSpec, "run">> = {
    suspend: { title: "تعلیق حساب", danger: true, needReason: true, confirmLabel: "معلق کن",
      text: "کاربر از همهٔ دستگاه‌ها خارج می‌شود و تا رفع تعلیق نمی‌تواند وارد شود. داده‌هایش پاک نمی‌شود." },
    unsuspend: { title: "رفع تعلیق", confirmLabel: "رفع تعلیق", needReason: true, text: "کاربر دوباره می‌تواند وارد شود." },
    revoke_sessions: { title: "خروج از همهٔ دستگاه‌ها", confirmLabel: "خارج کن", text: "همهٔ نشست‌های فعال این کاربر بسته می‌شود؛ رمز او تغییر نمی‌کند." },
    reset_mfa: { title: "بازنشانی ورود دومرحله‌ای", danger: true, needReason: true, confirmLabel: "بازنشانی",
      text: "همهٔ عامل‌های دومرحله‌ای کاربر حذف می‌شود و باید دوباره ثبت کند. فقط وقتی هویت او را از راه دیگری تأیید کرده‌اید." },
  };
  const action = (a: keyof typeof ACTIONS): ConfirmSpec => ({ ...ACTIONS[a], run: (reason: string) => adminUserAction(uid, a, reason) });

  return (
    <>
      <Drawer open onClose={onClose} width={640}
        title={u ? <span className="flex items-center gap-2">{u.display_name || u.username}
          <Badge tone={u.role === "admin" ? "brand" : u.role === "teacher" ? "info" : "muted"}>{ROLE_LABEL[u.role]}</Badge>
          {suspended ? <Badge tone="bad" dot>معلق</Badge> : <Badge tone="ok" dot>فعال</Badge>}</span> : "پروندهٔ کاربر"}
        subtitle={u ? `@${u.username} · عضو از ${faDate(u.created_at)}` : undefined}
        footer={u && (
          <div className="flex flex-wrap justify-end gap-1.5">
            <Btn size="sm" icon={LogOut} onClick={() => setConfirm(action("revoke_sessions"))}>خروج از همهٔ دستگاه‌ها</Btn>
            {u.factors.some((f) => f.status === "verified") && <Btn size="sm" icon={KeyRound} onClick={() => setConfirm(action("reset_mfa"))}>بازنشانی 2FA</Btn>}
            {suspended
              ? <Btn size="sm" kind="primary" icon={ShieldCheck} onClick={() => setConfirm(action("unsuspend"))}>رفع تعلیق</Btn>
              : u.role !== "admin" && <Btn size="sm" kind="danger" icon={Ban} onClick={() => setConfirm(action("suspend"))}>تعلیق</Btn>}
          </div>
        )}>
        {d.error ? <Notice tone="bad" title="پرونده خوانده نشد">{adminError(d.error)}</Notice> : !u ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/60" />)}</div>
        ) : (
          <>
            {u.flags?.suspended && <Notice tone="bad" title="حساب معلق است">{u.flags.reason || "بدون دلیل"} · {faDateTime(u.flags.changed_at)}{u.flags.changed_by ? ` · @${u.flags.changed_by}` : ""}</Notice>}
            <Panel title="حساب">
              <KeyValues items={[
                ["ایمیل", <span key="e" dir="ltr">{u.email || "—"}</span>],
                ["تلفن", <span key="p" dir="ltr">{u.phone || "—"}</span>],
                ["روش ورود", (u.providers ?? []).join("، ") || "—"],
                ["تأیید ایمیل", u.email_confirmed_at ? faDate(u.email_confirmed_at) : "تأییدنشده"],
                ["آخرین ورود", `${faDateTime(u.last_sign_in_at)} (${faAgo(u.last_sign_in_at)})`],
                ["ورود دومرحله‌ای", u.factors.length ? u.factors.map((f) => `${f.type.toUpperCase()} ${f.status === "verified" ? "✓" : "(ناتمام)"}`).join("، ") : "ندارد"],
                ["درخواست مدرسی", u.teacher_request ? `${u.teacher_request.status} · ${faDate(u.teacher_request.created_at)}` : "—"],
              ]} />
            </Panel>

            <Panel title="نقش سراسری" icon={UserCog} description="تغییر نقش با دلیل در گزارش ممیزی ثبت می‌شود.">
              <div className="flex flex-wrap items-center gap-2">
                <select aria-label="نقش تازه" value={newRole || u.role} onChange={(e) => setNewRole(e.target.value as GlobalRole)} className={inputCls}>
                  {(Object.keys(ROLE_LABEL) as GlobalRole[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="دلیل تغییر…" className={`${inputCls} min-w-[180px] flex-1`} />
                <Btn kind="primary" disabled={!newRole || newRole === u.role || note.trim().length < 3}
                  onClick={() => newRole && setConfirm({
                    title: "تغییر نقش", confirmLabel: "تغییر بده", danger: newRole === "admin",
                    text: newRole === "admin" ? "این کاربر به همهٔ کنسول مدیریت Lexa دسترسی می‌گیرد." : `نقش از «${ROLE_LABEL[u.role]}» به «${ROLE_LABEL[newRole]}» تغییر می‌کند.`,
                    run: () => adminChangeRole(uid, newRole, note.trim()).then(() => { setNewRole(""); setNote(""); }),
                  })}>اعمال</Btn>
              </div>
            </Panel>

            <div className="grid gap-4 sm:grid-cols-2">
              <Panel title="عضویت در مراکز">
                {!u.memberships.length && !u.official.length ? <p className="text-[12px] text-muted-foreground">عضو هیچ مرکزی نیست.</p> : (
                  <ul className="space-y-2 text-[12.5px]">
                    {u.memberships.map((m) => (
                      <li key={`m${m.org_id}`} className="flex items-center justify-between gap-2">
                        <button type="button" className="truncate text-start font-semibold hover:text-bronze" onClick={() => navigate({ view: "org", id: m.slug })}>{m.name}</button>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{MEMBER_ROLE_LABEL[m.role] ?? m.role} · {STATUS_LABEL[m.status] ?? m.status}</span>
                      </li>
                    ))}
                    {u.official.map((s) => (
                      <li key={`s${s.org_id}`} className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold">{s.name}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">دانشجوی رسمی <span dir="ltr">{s.username}</span> · {STATUS_LABEL[s.status] ?? s.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel title="مطالعه">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="font-display text-2xl font-extrabold tabular-nums">{faHours(u.study.seconds_30d)}<span className="ms-1 text-[12px] font-semibold text-muted-foreground">ساعت / ۳۰ روز</span></p>
                    <p className="text-[11.5px] text-muted-foreground">{faNum(u.study.days_30d)} روز فعال · ۷ روز: {faHours(u.study.seconds_7d)} ساعت · آخرین: {u.study.last_day ? faDate(u.study.last_day) : "—"}</p>
                  </div>
                  <Sparkline values={u.study.daily.map((x) => x.seconds)} width={110} height={34} />
                </div>
              </Panel>
            </div>

            <Panel title="رویدادهای اخیر" bodyClass="p-0">
              {!u.audit.length ? <div className="p-4"><EmptyState title="رویدادی ثبت نشده" /></div> : (
                <ul className="divide-y divide-border">
                  {u.audit.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 px-4 py-2 text-[12px]">
                      <span className="w-28 shrink-0 tabular-nums text-muted-foreground">{faDateTime(a.at)}</span>
                      <span className="min-w-0 flex-1 truncate"><b>{actionLabel(a.action)}</b>{a.org && <span className="text-muted-foreground"> · {a.org}</span>}
                        {typeof a.detail?.reason === "string" && a.detail.reason && <span className="text-muted-foreground"> · «{String(a.detail.reason)}»</span>}</span>
                      <span className="shrink-0 text-muted-foreground">{a.actor ? `@${a.actor}` : "سیستم"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </>
        )}
      </Drawer>
      <ConfirmDialog spec={confirm} onClose={() => setConfirm(null)} onDone={done} errorText={adminError} />
    </>
  );
}
