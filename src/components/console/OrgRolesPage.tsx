"use client";
/* Roles and the permission matrix (phase A2 of docs/ADMIN_PLATFORM.md). Rows = named permissions in
 * groups, columns = roles of the centre (system templates first, then custom roles). A custom role is
 * created from scratch or as a copy of a template and edited right in the matrix; nobody can add a
 * permission they do not hold themselves (checked again on the server). */
import * as React from "react";
import { Check, Copy, Lock, Minus, Pencil, Plus, Save, ShieldCheck, Trash2, Undo2 } from "lucide-react";
import { faNum } from "@/lib/cloud-api/admin-console";
import {
  ALL_PERMS, orgConsoleError, orgRoleDelete, orgRoleList, orgRoleSave, PERM_GROUPS, PERM_LABEL,
  type PermKey, type RoleRow,
} from "@/lib/cloud-api/org-console";
import {
  Badge, Btn, ConfirmDialog, cx, Drawer, EmptyState, inputCls, Notice, Panel, RefreshBtn, Segmented, useLoad,
  type ConfirmSpec,
} from "./ConsoleKit";
import { MfaGate, SectionIntro } from "./CentreBits";
import type { CentrePageProps } from "./CentreConsole";

type View = "matrix" | "cards";

export function OrgRolesPage(p: CentrePageProps) {
  return (
    <MfaGate why="نقش‌ها و دسترسی‌های مرکز فقط از نشست دومرحله‌ای دیده و تغییر داده می‌شوند.">
      <RolesInner {...p} />
    </MfaGate>
  );
}

function RolesInner({ orgId, access, nav }: CentrePageProps) {
  const roles = useLoad(() => orgRoleList(orgId), [orgId]);
  const [view, setView] = React.useState<View>("matrix");
  const [edit, setEdit] = React.useState<{ id: string | null; name: string; description: string; perms: PermKey[] } | null>(null);
  const [draft, setDraft] = React.useState<Record<string, PermKey[]>>({});
  const [confirm, setConfirm] = React.useState<ConfirmSpec | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState("");
  const canManage = access.can("org.roles.manage");
  const mine = React.useMemo(() => new Set(access.raw.perms), [access]);
  const list = roles.data ?? [];
  const custom = list.filter((r) => !r.is_system);
  const permsOf = (r: RoleRow) => draft[r.id] ?? r.perms;
  const dirtyIds = Object.keys(draft).filter((id) => {
    const r = list.find((x) => x.id === id);
    return r && [...draft[id]].sort().join() !== [...r.perms].sort().join();
  });
  const editable = (r: RoleRow) => canManage && !r.is_system && r.perms.every((x) => mine.has(x));

  function toggle(r: RoleRow, perm: PermKey) {
    if (!editable(r) || !mine.has(perm)) return;
    const cur = new Set(permsOf(r));
    if (cur.has(perm)) cur.delete(perm); else cur.add(perm);
    setDraft({ ...draft, [r.id]: ALL_PERMS.filter((x) => cur.has(x)) });
  }
  function toggleGroup(r: RoleRow, perms: PermKey[]) {
    if (!editable(r)) return;
    const allowed = perms.filter((x) => mine.has(x));
    const cur = new Set(permsOf(r));
    const on = allowed.every((x) => cur.has(x));
    for (const x of allowed) { if (on) cur.delete(x); else cur.add(x); }
    setDraft({ ...draft, [r.id]: ALL_PERMS.filter((x) => cur.has(x)) });
  }

  function saveDraft() {
    setConfirm({
      title: "ذخیره‌ی تغییر دسترسی‌ها", needReason: true, confirmLabel: "ذخیره",
      text: <>دسترسی {faNum(dirtyIds.length)} نقش تغییر می‌کند و برای همه‌ی کسانی که این نقش را دارند، بلافاصله اعمال می‌شود. افزوده و حذف‌شده‌ها در لاگ ممیزی ثبت می‌شوند.</>,
      run: async (reason) => {
        setSaving(true); setErr("");
        try {
          for (const id of dirtyIds) {
            const r = list.find((x) => x.id === id);
            if (r) await orgRoleSave(orgId, { id, name: r.name, description: r.description, perms: draft[id] }, reason);
          }
          setDraft({});
        } finally { setSaving(false); }
      },
    });
  }

  const copyOf = (r: RoleRow) => setEdit({ id: null, name: `${r.name} (کپی)`.slice(0, 60), description: r.description, perms: r.perms.filter((x) => mine.has(x)) });

  return (
    <>
      <SectionIntro
        text="هر کار در مرکز یک دسترسی نام‌دار دارد و نقش فقط مجموعه‌ای از دسترسی‌هاست. نقش‌های پیش‌فرض قفل‌اند؛ برای نیاز خاص از آن‌ها کپی بگیرید. دادن نقش به افراد و تعیین دامنه‌ی آن (کل مرکز یا یک شاخه) در «استادها و کارکنان» است."
        meta={roles.data && <>{faNum(list.length - custom.length)} نقش پیش‌فرض · {faNum(custom.length)} نقش سفارشی از ۴۰</>}
        actions={<>
          <Segmented value={view} onChange={setView} options={[{ key: "matrix", label: "ماتریس" }, { key: "cards", label: "فهرست نقش‌ها" }]} />
          {canManage && <Btn kind="primary" icon={Plus} onClick={() => setEdit({ id: null, name: "", description: "", perms: [] })}>نقش تازه</Btn>}
          {nav.has("staff") && <Btn onClick={() => nav.go("staff")}>دادن نقش به افراد</Btn>}
          <RefreshBtn onClick={() => void roles.reload()} busy={roles.busy} at={roles.at} />
        </>} />

      {!canManage && (
        <div className="mb-3"><Notice tone="info" icon={Lock} title="فقط مشاهده">ساختن و تغییر نقش‌ها دسترسی «نقش‌ها و اعطا» در کل مرکز را می‌خواهد.</Notice></div>
      )}
      {dirtyIds.length > 0 && (
        <div className="sticky top-16 z-20 mb-3">
          <Notice tone="warn" title={`${faNum(dirtyIds.length)} نقش تغییر ذخیره‌نشده دارد`}
            action={<div className="flex gap-1.5"><Btn size="sm" icon={Undo2} onClick={() => setDraft({})}>برگرداندن</Btn>
              <Btn size="sm" kind="primary" icon={Save} busy={saving} onClick={saveDraft}>ذخیره</Btn></div>}>
            خانه‌های تغییرکرده با حاشیه‌ی رنگی مشخص شده‌اند.
          </Notice>
        </div>
      )}
      {err && <div className="mb-3"><Notice tone="bad" title="ذخیره نشد">{err}</Notice></div>}
      {roles.error ? <Notice tone="bad" title="نقش‌ها خوانده نشد">{orgConsoleError(roles.error)}</Notice>
        : roles.data === null ? <div className="h-96 animate-pulse rounded-xl bg-muted/50" />
        : view === "matrix" ? (
          <div className="overflow-auto rounded-xl border border-border bg-card shadow-sm" style={{ maxHeight: "72vh" }}>
            <table className="w-max min-w-full border-collapse text-[12.5px]">
              <thead className="sticky top-0 z-10 bg-card">
                <tr>
                  <th scope="col" className="sticky start-0 z-20 min-w-[230px] border-b border-e border-border bg-card px-3 py-2 text-start text-[11.5px] font-bold text-muted-foreground">دسترسی</th>
                  {list.map((r) => (
                    <th key={r.id} scope="col" className="min-w-[96px] max-w-[120px] border-b border-border px-2 py-2 align-bottom">
                      <div className="flex flex-col items-center gap-1 text-center">
                        {r.is_system ? <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="پیش‌فرض" /> : <Pencil className="h-3.5 w-3.5 text-bronze" aria-label="سفارشی" />}
                        <span className="line-clamp-2 text-[11.5px] font-bold leading-tight">{r.name}</span>
                        <span className="text-[10.5px] font-normal text-muted-foreground">{faNum(r.holders)} نفر</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERM_GROUPS.map((g) => (
                  <React.Fragment key={g.key}>
                    <tr className="bg-muted/50">
                      <th scope="rowgroup" className="sticky start-0 z-[5] border-y border-e border-border bg-muted px-3 py-1.5 text-start text-[11px] font-extrabold text-muted-foreground">{g.label}</th>
                      {list.map((r) => {
                        const ed = editable(r);
                        const ps = new Set(permsOf(r));
                        const n = g.perms.filter((x) => ps.has(x.key)).length;
                        return (
                          <td key={r.id} className="border-y border-border px-2 py-1.5 text-center">
                            {ed ? <button type="button" onClick={() => toggleGroup(r, g.perms.map((x) => x.key))}
                              className="text-[10.5px] font-bold text-bronze hover:underline">{n === g.perms.length ? "هیچ" : "همه"}</button>
                              : <span className="text-[10.5px] tabular-nums text-muted-foreground">{faNum(n)}/{faNum(g.perms.length)}</span>}
                          </td>
                        );
                      })}
                    </tr>
                    {g.perms.map((pm) => (
                      <tr key={pm.key} className="hover:bg-muted/30">
                        <th scope="row" className="sticky start-0 z-[5] border-b border-e border-border bg-card px-3 py-1.5 text-start font-normal">
                          <span className="flex items-center gap-1.5 font-semibold">{pm.label}{pm.sensitive && <Badge tone="warn">حساس</Badge>}</span>
                          <span className="block text-[10.5px] leading-snug text-muted-foreground">{pm.hint}</span>
                        </th>
                        {list.map((r) => {
                          const has = permsOf(r).includes(pm.key);
                          const changed = !!draft[r.id] && has !== r.perms.includes(pm.key);
                          const ed = editable(r) && mine.has(pm.key);
                          return (
                            <td key={r.id} className="border-b border-border px-2 py-1 text-center">
                              <button type="button" disabled={!ed} onClick={() => toggle(r, pm.key)}
                                aria-label={`${pm.label} برای ${r.name}`} aria-pressed={has}
                                title={!editable(r) ? (r.is_system ? "نقش پیش‌فرض قفل است" : "این نقش از دسترسی شما قوی‌تر است") : !mine.has(pm.key) ? "این دسترسی را خودتان ندارید" : undefined}
                                className={cx("mx-auto grid h-7 w-7 place-items-center rounded-md border transition-colors",
                                  has ? "border-primary/40 bg-primary/10 text-primary" : "border-transparent text-muted-foreground/40",
                                  ed && "hover:border-bronze/60", changed && "ring-2 ring-amber-400", !ed && "cursor-default")}>
                                {has ? <Check className="h-4 w-4" /> : <Minus className="h-3 w-3" />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
                <tr>
                  <th scope="row" className="sticky start-0 z-[5] border-e border-border bg-card px-3 py-2 text-start text-[11px] text-muted-foreground">کارها</th>
                  {list.map((r) => (
                    <td key={r.id} className="px-2 py-2 text-center">
                      <div className="flex justify-center gap-1">
                        {canManage && <button type="button" title="کپی" aria-label={`کپی ${r.name}`} onClick={() => copyOf(r)} className="grid h-7 w-7 place-items-center rounded-md hover:bg-muted"><Copy className="h-3.5 w-3.5" /></button>}
                        {editable(r) && <button type="button" title="ویرایش" aria-label={`ویرایش ${r.name}`} onClick={() => setEdit({ id: r.id, name: r.name, description: r.description, perms: permsOf(r) })} className="grid h-7 w-7 place-items-center rounded-md hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button>}
                        {editable(r) && <button type="button" title="حذف" aria-label={`حذف ${r.name}`} onClick={() => setConfirm(deleteSpec(orgId, r))} className="grid h-7 w-7 place-items-center rounded-md text-red-600 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></button>}
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {list.map((r) => (
              <div key={r.id} className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start gap-2">
                  <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-lg", r.is_system ? "bg-muted text-muted-foreground" : "bg-bronze/10 text-bronze")}>
                    {r.is_system ? <Lock className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-[14px] font-extrabold">{r.name}
                      {r.base ? <Badge tone="info">نقش پایه</Badge> : r.is_system ? <Badge tone="muted">پیش‌فرض</Badge> : <Badge tone="brand">سفارشی</Badge>}</p>
                    <p className="text-[11.5px] text-muted-foreground">{faNum(r.perms.length)} دسترسی · {faNum(r.holders)} نفر</p>
                  </div>
                </div>
                {r.description && <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{r.description}</p>}
                <div className="mt-3 flex flex-1 flex-wrap content-start gap-1">
                  {r.perms.map((x) => <span key={x} className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[10.5px]">{PERM_LABEL[x] ?? x}</span>)}
                </div>
                <div className="mt-3 flex justify-end gap-1.5">
                  {canManage && <Btn size="sm" icon={Copy} onClick={() => copyOf(r)}>کپی</Btn>}
                  {editable(r) && <Btn size="sm" icon={Pencil} onClick={() => setEdit({ id: r.id, name: r.name, description: r.description, perms: permsOf(r) })}>ویرایش</Btn>}
                  {editable(r) && <Btn size="sm" kind="danger" icon={Trash2} onClick={() => setConfirm(deleteSpec(orgId, r))}>حذف</Btn>}
                </div>
              </div>
            ))}
            {!custom.length && canManage && (
              <div className="rounded-xl border border-dashed border-border p-4">
                <EmptyState icon={Plus} title="هنوز نقش سفارشی ندارید" text="مثلاً «کارشناس آموزش شعبه‌ی غرب» یا «مصحح آزمون جامع». از یک نقش پیش‌فرض کپی بگیرید."
                  action={<Btn size="sm" kind="primary" onClick={() => setEdit({ id: null, name: "", description: "", perms: [] })}>نقش تازه</Btn>} />
              </div>
            )}
          </div>
        )}

      {edit && <RoleEditor orgId={orgId} initial={edit} mine={mine} onClose={() => setEdit(null)}
        onSaved={() => { setEdit(null); if (edit.id) { const d = { ...draft }; delete d[edit.id]; setDraft(d); } void roles.reload(); }} />}
      <ConfirmDialog spec={confirm} onClose={() => setConfirm(null)} onDone={() => void roles.reload()}
        errorText={orgConsoleError} />
    </>
  );
}

function deleteSpec(orgId: string, r: RoleRow): ConfirmSpec {
  return {
    title: `حذف نقش «${r.name}»`, danger: true, needReason: true, confirmLabel: "حذف کن", typeToConfirm: r.holders > 0 ? "delete" : undefined,
    text: r.holders > 0
      ? <>این نقش الان به <b>{faNum(r.holders)} نفر</b> داده شده و با حذف آن، دسترسی همه‌شان همان لحظه پس گرفته می‌شود.</>
      : "این نقش به کسی داده نشده است.",
    run: (reason) => orgRoleDelete(orgId, r.id, reason),
  };
}

function RoleEditor({ orgId, initial, mine, onClose, onSaved }: {
  orgId: string; initial: { id: string | null; name: string; description: string; perms: PermKey[] };
  mine: Set<string>; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = React.useState(initial.name);
  const [description, setDescription] = React.useState(initial.description);
  const [perms, setPerms] = React.useState<Set<PermKey>>(new Set(initial.perms));
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const ok = name.trim().length >= 2 && name.trim().length <= 60 && perms.size > 0;
  async function save() {
    setBusy(true); setErr("");
    try { await orgRoleSave(orgId, { id: initial.id, name: name.trim(), description: description.trim(), perms: ALL_PERMS.filter((x) => perms.has(x)) }, reason.trim()); onSaved(); }
    catch (e) { setErr(orgConsoleError(e)); } finally { setBusy(false); }
  }
  const flip = (k: PermKey) => { const s = new Set(perms); if (s.has(k)) s.delete(k); else s.add(k); setPerms(s); };
  return (
    <Drawer open onClose={onClose} width={600} title={initial.id ? `ویرایش «${initial.name}»` : "نقش تازه"}
      subtitle="فقط دسترسی‌هایی را می‌توانید بدهید که خودتان در کل مرکز دارید"
      footer={<div className="flex items-center justify-between gap-2">
        <span className="text-[12px] text-muted-foreground">{faNum(perms.size)} دسترسی</span>
        <div className="flex gap-2"><Btn onClick={onClose}>انصراف</Btn><Btn kind="primary" icon={Save} busy={busy} disabled={!ok} onClick={() => void save()}>ذخیره</Btn></div>
      </div>}>
      <div className="space-y-4">
        <label className="block space-y-1"><span className="text-[12px] font-bold">نام نقش</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus className={cx(inputCls, "w-full")} placeholder="مثلاً کارشناس آموزش" /></label>
        <label className="block space-y-1"><span className="text-[12px] font-bold">توضیح</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={2}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-bronze" /></label>
        {PERM_GROUPS.map((g) => (
          <Panel key={g.key} title={g.label} bodyClass="p-2">
            <ul className="space-y-0.5">
              {g.perms.map((pm) => {
                const allowed = mine.has(pm.key);
                return (
                  <li key={pm.key}>
                    <label className={cx("flex items-start gap-2.5 rounded-lg px-2 py-1.5", allowed ? "cursor-pointer hover:bg-muted/50" : "opacity-50")}>
                      <input type="checkbox" className="mt-0.5" checked={perms.has(pm.key)} disabled={!allowed} onChange={() => flip(pm.key)} />
                      <span className="min-w-0"><span className="flex items-center gap-1.5 text-[12.5px] font-semibold">{pm.label}{pm.sensitive && <Badge tone="warn">حساس</Badge>}</span>
                        <span className="block text-[11px] text-muted-foreground">{pm.hint}{!allowed && " · خودتان ندارید"}</span></span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </Panel>
        ))}
        <label className="block space-y-1"><span className="text-[12px] font-bold">دلیل (در لاگ ممیزی)</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={cx(inputCls, "w-full")} /></label>
        {err && <Notice tone="bad" title="ذخیره نشد">{err}</Notice>}
      </div>
    </Drawer>
  );
}
