"use client";
/* Organisation tree (phase A2 of docs/ADMIN_PLATFORM.md): the centre's faculties, departments and
 * programmes (or branches, tracks and groups). Tree on one side, the selected unit on the other with
 * its totals, edit / move / archive / delete, and what hangs on it (classes, subjects, students,
 * staff). Ready-made trees for a university and for a bar-exam institute. */
import * as React from "react";
import {
  Archive, ArchiveRestore, Building, ChevronDown, ChevronLeft, FolderTree, GraduationCap, Landmark, Layers,
  Pencil, Plus, School, Trash2, Users, UsersRound,
} from "lucide-react";
import { faNum } from "@/lib/cloud-api/admin-console";
import {
  orgConsoleError, orgUnitAssign, orgUnitDelete, orgUnitItems, orgUnitPreset, orgUnitSave, orgUnitStatus,
  unitIndex, UNIT_KIND_LABEL, type UnitItem, type UnitItemKind, type UnitKind, type UnitRow,
} from "@/lib/cloud-api/org-console";
import {
  Badge, Btn, ConfirmDialog, cx, Drawer, EmptyState, inputCls, KeyValues, Notice, Panel, RefreshBtn, SearchBox,
  Segmented, useLoad, type ConfirmSpec, type IconType,
} from "./ConsoleKit";
import { MfaGate, SectionIntro, UnitSelect, useUnits } from "./CentreBits";
import type { CentrePageProps } from "./CentreConsole";

const KIND_ICON: Record<UnitKind, IconType> = {
  faculty: Landmark, department: Building, program: GraduationCap, branch: School, track: Layers, section: UsersRound, other: FolderTree,
};
const ITEM_KIND: { key: UnitItemKind; label: string }[] = [
  { key: "class", label: "کلاس‌ها" }, { key: "student", label: "دانشجوها" }, { key: "member", label: "استادها و کارکنان" }, { key: "course", label: "درس‌ها" },
];

export function OrgStructurePage(p: CentrePageProps) {
  const { orgId, access } = p;
  const units = useUnits(orgId);
  const [sel, setSel] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [showArchived, setShowArchived] = React.useState(false);
  const [open, setOpen] = React.useState<Set<string>>(new Set());
  const [form, setForm] = React.useState<{ id: string | null; parentId: string | null } | null>(null);
  const [confirm, setConfirm] = React.useState<ConfirmSpec | null>(null);
  const rows = React.useMemo(() => units.data ?? [], [units.data]);
  const ix = React.useMemo(() => unitIndex(rows), [rows]);
  const managedRoots = React.useMemo(() => new Set(access.unitsFor("org.units.manage").map((u) => u.id)), [access]);
  const canAt = React.useCallback((id: string | null) => {
    if (access.can("org.units.manage")) return true;
    if (!id) return false;
    return ix.pathOf(id).some((u) => managedRoots.has(u.id));
  }, [access, ix, managedRoots]);

  React.useEffect(() => {
    // open the top level once the tree arrives
    if (rows.length && open.size === 0) setOpen(new Set(rows.filter((r) => r.depth < 1).map((r) => r.id)));
  }, [rows, open.size]);
  React.useEffect(() => { if (sel && !ix.byId.has(sel)) setSel(null); }, [sel, ix]);

  const matches = React.useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return null;
    const hit = new Set<string>();
    for (const r of rows) if (r.name.toLowerCase().includes(t) || r.code.toLowerCase().includes(t)) for (const a of ix.pathOf(r.id)) hit.add(a.id);
    return hit;
  }, [q, rows, ix]);

  const selected = sel ? ix.byId.get(sel) ?? null : null;
  const reload = () => void units.reload();

  if (units.error) return <Notice tone="bad" title="ساختار سازمانی خوانده نشد">{orgConsoleError(units.error)}</Notice>;

  const empty = units.data !== null && rows.length === 0;
  return (
    <>
      <SectionIntro
        text="درخت سازمانی مرکز: کلاس‌ها، دانشجوها و کارکنان روی واحدها چیده می‌شوند، گزارش‌ها روی هر واحد جمع می‌خورند و به مدیر هر واحد فقط همان شاخه سپرده می‌شود."
        meta={!empty && units.data && <>{faNum(rows.filter((r) => r.status === "active").length)} واحد فعال · حداکثر شش سطح</>}
        actions={<>
          {!empty && access.can("org.units.manage") && <Btn kind="primary" icon={Plus} onClick={() => setForm({ id: null, parentId: null })}>واحد تازه</Btn>}
          <RefreshBtn onClick={reload} busy={units.busy} at={units.at} />
        </>} />

      {empty ? (
        <EmptyStart orgId={orgId} canBuild={access.can("org.units.manage")} onDone={reload} onBlank={() => setForm({ id: null, parentId: null })} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <Panel title="درخت" icon={FolderTree} bodyClass="p-2"
            actions={<button type="button" onClick={() => setOpen(open.size ? new Set() : new Set(rows.map((r) => r.id)))}
              className="text-[11.5px] font-bold text-bronze hover:underline">{open.size ? "بستن همه" : "باز کردن همه"}</button>}>
            <div className="px-1 pb-2"><SearchBox value={q} onChange={setQ} placeholder="جستجوی نام یا کد واحد" className="w-full" /></div>
            <label className="mb-1 flex items-center gap-2 px-2 text-[11.5px] text-muted-foreground">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> نمایش واحدهای بایگانی
            </label>
            {units.data === null
              ? <div className="space-y-1.5 p-1">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-8 animate-pulse rounded-md bg-muted/60" />)}</div>
              : (
                <ul role="tree" aria-label="درخت سازمانی" className="max-h-[62vh] overflow-y-auto">
                  <TreeLevel parent={null} ix={ix} open={open} setOpen={setOpen} sel={sel} onSel={setSel}
                    matches={matches} showArchived={showArchived} />
                </ul>
              )}
          </Panel>

          {selected ? (
            <UnitDetail key={selected.id} orgId={orgId} unit={selected} ix={ix} canEdit={canAt(selected.id)} canParent={canAt(selected.parent_id)}
              onAddChild={() => setForm({ id: null, parentId: selected.id })}
              onEdit={() => setForm({ id: selected.id, parentId: selected.parent_id })}
              onConfirm={setConfirm} onChanged={reload} onSelect={setSel} />
          ) : (
            <Panel>
              <EmptyState icon={FolderTree} title="یک واحد را انتخاب کنید"
                text="از درخت، واحدی را باز کنید تا آمار، زیرواحدها و کلاس‌ها و افراد آن را ببینید و مدیریت کنید." />
            </Panel>
          )}
        </div>
      )}

      {form && (
        <UnitForm orgId={orgId} rows={rows} ix={ix} initial={form} canAt={canAt}
          onClose={() => setForm(null)} onSaved={(id) => { setForm(null); setSel(id); if (form.parentId) setOpen((s) => new Set(s).add(form.parentId as string)); reload(); }} />
      )}
      <ConfirmDialog spec={confirm} onClose={() => setConfirm(null)} onDone={reload} errorText={orgConsoleError} />
    </>
  );
}

function TreeLevel({ parent, ix, open, setOpen, sel, onSel, matches, showArchived }: {
  parent: string | null; ix: ReturnType<typeof unitIndex>; open: Set<string>; setOpen: (s: Set<string>) => void;
  sel: string | null; onSel: (id: string) => void; matches: Set<string> | null; showArchived: boolean;
}) {
  const kids = (ix.kids.get(parent) ?? []).filter((u) => (showArchived || u.status === "active") && (!matches || matches.has(u.id)));
  if (!kids.length) return null;
  return (
    <>
      {kids.map((u) => {
        const Icon = KIND_ICON[u.kind];
        const hasKids = (ix.kids.get(u.id) ?? []).some((c) => showArchived || c.status === "active");
        const isOpen = open.has(u.id) || !!matches;
        const students = ix.total(u.id, "students");
        return (
          <li key={u.id} role="treeitem" aria-expanded={hasKids ? isOpen : undefined} aria-selected={sel === u.id}>
            <div className={cx("group flex items-center gap-1 rounded-lg py-1 pe-2 text-[13px] transition-colors",
              sel === u.id ? "bg-primary/[0.08] font-bold" : "hover:bg-muted", u.status === "archived" && "opacity-55")}
              style={{ paddingInlineStart: 4 + u.depth * 16 }}>
              <button type="button" aria-label={isOpen ? "بستن" : "باز کردن"} disabled={!hasKids}
                onClick={() => { const s = new Set(open); if (s.has(u.id)) s.delete(u.id); else s.add(u.id); setOpen(s); }}
                className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground disabled:opacity-0">
                {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
              </button>
              <button type="button" onClick={() => onSel(u.id)} className="flex min-w-0 flex-1 items-center gap-2 py-0.5 text-start">
                <Icon className={cx("h-4 w-4 shrink-0", sel === u.id ? "text-bronze" : "text-muted-foreground")} />
                <span className="min-w-0 flex-1 truncate">{u.name}</span>
                {u.status === "archived" && <span className="text-[10.5px] text-muted-foreground">بایگانی</span>}
                {students > 0 && <span className="rounded-full bg-muted px-1.5 text-[10.5px] font-bold tabular-nums text-muted-foreground">{faNum(students)}</span>}
              </button>
            </div>
            {hasKids && isOpen && (
              <ul role="group">
                <TreeLevel parent={u.id} ix={ix} open={open} setOpen={setOpen} sel={sel} onSel={onSel} matches={matches} showArchived={showArchived} />
              </ul>
            )}
          </li>
        );
      })}
    </>
  );
}

function EmptyStart({ orgId, canBuild, onDone, onBlank }: { orgId: string; canBuild: boolean; onDone: () => void; onBlank: () => void }) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [err, setErr] = React.useState("");
  const run = async (preset: "university" | "institute") => {
    setBusy(preset); setErr("");
    try { await orgUnitPreset(orgId, preset); onDone(); } catch (e) { setErr(orgConsoleError(e)); } finally { setBusy(null); }
  };
  if (!canBuild) return <Panel><EmptyState icon={FolderTree} title="هنوز درختی ساخته نشده" text="مالک یا مدیر کل مرکز ساختار را می‌سازد." /></Panel>;
  const cards = [
    { key: "university" as const, icon: Landmark, title: "دانشگاه یا دانشکده", text: "دانشکده ‹ گروه آموزشی ‹ رشته و مقطع. نمونه: دانشکده‌ی حقوق با گروه‌های خصوصی، عمومی و جزا." },
    { key: "institute" as const, icon: School, title: "مؤسسه‌ی آزمون", text: "شعبه ‹ دوره ‹ گروه کلاسی. نمونه: شعبه‌ی مرکزی با دوره‌های آزمون وکالت و قضاوت." },
  ];
  return (
    <MfaGate why="ساختن درخت سازمانی یک تغییر مدیریتی است و نشست دومرحله‌ای می‌خواهد.">
      <div className="grid gap-3 md:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.key} className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-bronze/10 text-bronze"><Icon className="h-5 w-5" /></span>
              <p className="mt-3 text-[14px] font-extrabold">{c.title}</p>
              <p className="mt-1 flex-1 text-[12px] leading-relaxed text-muted-foreground">{c.text}</p>
              <Btn kind="primary" className="mt-3" busy={busy === c.key} disabled={!!busy} onClick={() => void run(c.key)}>ساخت این درخت</Btn>
            </div>
          );
        })}
        <div className="flex flex-col rounded-xl border border-dashed border-border bg-card/50 p-4">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-muted text-muted-foreground"><Plus className="h-5 w-5" /></span>
          <p className="mt-3 text-[14px] font-extrabold">از صفر</p>
          <p className="mt-1 flex-1 text-[12px] leading-relaxed text-muted-foreground">اولین واحد را خودتان بسازید و بقیه را زیرش اضافه کنید. همه‌چیز بعداً قابل تغییر نام و جابه‌جایی است.</p>
          <Btn className="mt-3" onClick={onBlank}>اولین واحد</Btn>
        </div>
      </div>
      {err && <div className="mt-3"><Notice tone="bad" title="ساخته نشد">{err}</Notice></div>}
    </MfaGate>
  );
}

function UnitDetail({ orgId, unit, ix, canEdit, canParent, onAddChild, onEdit, onConfirm, onChanged, onSelect }: {
  orgId: string; unit: UnitRow; ix: ReturnType<typeof unitIndex>; canEdit: boolean; canParent: boolean;
  onAddChild: () => void; onEdit: () => void; onConfirm: (c: ConfirmSpec) => void; onChanged: () => void; onSelect: (id: string) => void;
}) {
  const Icon = KIND_ICON[unit.kind];
  const path = ix.pathOf(unit.id);
  const kids = ix.kids.get(unit.id) ?? [];
  const activeKids = kids.filter((k) => k.status === "active");
  const archived = unit.status === "archived";
  const empty = !kids.length && !unit.classes && !unit.courses && !unit.students && !unit.staff && !unit.grants;
  return (
    <div className="min-w-0 space-y-4">
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <nav aria-label="مسیر" className="mb-2 flex flex-wrap items-center gap-1 text-[11.5px] text-muted-foreground">
          <span>مرکز</span>
          {path.slice(0, -1).map((a) => (
            <React.Fragment key={a.id}><ChevronLeft className="h-3 w-3" />
              <button type="button" onClick={() => onSelect(a.id)} className="hover:text-foreground hover:underline">{a.name}</button></React.Fragment>
          ))}
        </nav>
        <div className="flex flex-wrap items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <h3 className="flex flex-wrap items-center gap-2 font-display text-[18px] font-extrabold">{unit.name}
              <Badge tone="muted">{UNIT_KIND_LABEL[unit.kind]}</Badge>
              {archived ? <Badge tone="warn" dot>بایگانی</Badge> : <Badge tone="ok" dot>فعال</Badge>}</h3>
            <p className="mt-1 text-[11.5px] text-muted-foreground">سطح {faNum(unit.depth + 1)}{unit.code ? <> · کد <span dir="ltr">{unit.code}</span></> : null}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {canEdit && !archived && unit.depth < 5 && <Btn size="sm" icon={Plus} onClick={onAddChild}>زیرواحد</Btn>}
            {canEdit && <Btn size="sm" icon={Pencil} onClick={onEdit}>ویرایش و جابه‌جایی</Btn>}
            {canParent && (archived
              ? <Btn size="sm" icon={ArchiveRestore} onClick={() => onConfirm({ title: "بازگردانی واحد", confirmLabel: "بازگردان", needReason: true,
                  text: `«${unit.name}» دوباره فعال می‌شود و در گزارش‌ها و انتخاب‌ها دیده می‌شود.`, run: (r) => orgUnitStatus(unit.id, false, r) })}>بازگردانی</Btn>
              : <Btn size="sm" icon={Archive} disabled={activeKids.length > 0} title={activeKids.length ? "اول زیرواحدهای فعال را بایگانی کنید" : undefined}
                  onClick={() => onConfirm({ title: "بایگانی واحد", confirmLabel: "بایگانی کن", needReason: true,
                    text: `«${unit.name}» از انتخاب‌ها و گزارش‌های جاری کنار می‌رود. کلاس‌ها و دانشجوهای آن دست نمی‌خورند و هر وقت بخواهید برمی‌گردد.`,
                    run: (r) => orgUnitStatus(unit.id, true, r) })}>بایگانی</Btn>)}
            {canParent && empty && (
              <Btn size="sm" kind="danger" icon={Trash2} onClick={() => onConfirm({ title: "حذف واحد", confirmLabel: "حذف کن", danger: true, needReason: true,
                text: `«${unit.name}» برای همیشه حذف می‌شود. واحد خالی است و چیزی به آن وصل نیست.`, run: (r) => orgUnitDelete(unit.id, r) })}>حذف</Btn>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { l: "زیرواحد", v: ix.subtree(unit.id).length - 1, i: FolderTree },
            { l: "دانشجو", v: ix.total(unit.id, "students"), i: GraduationCap },
            { l: "کلاس", v: ix.total(unit.id, "classes"), i: Layers },
            { l: "کارکنان", v: ix.total(unit.id, "staff"), i: Users },
          ].map((s) => {
            const SI = s.i;
            return (
              <div key={s.l} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><SI className="h-3.5 w-3.5" />{s.l} (با زیرمجموعه)</p>
                <p className="mt-0.5 font-display text-[18px] font-extrabold tabular-nums">{faNum(s.v)}</p>
              </div>
            );
          })}
        </div>
      </section>

      {kids.length > 0 && (
        <Panel title="زیرواحدها" icon={FolderTree} bodyClass="p-2">
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {kids.map((k) => {
              const KI = KIND_ICON[k.kind];
              return (
                <li key={k.id}>
                  <button type="button" onClick={() => onSelect(k.id)}
                    className={cx("flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-start text-[12.5px] hover:border-bronze/50", k.status === "archived" && "opacity-55")}>
                    <KI className="h-4 w-4 text-muted-foreground" /><span className="min-w-0 flex-1 truncate font-bold">{k.name}</span>
                    <span className="text-[11px] text-muted-foreground">{faNum(ix.total(k.id, "students"))} دانشجو · {faNum(ix.total(k.id, "classes"))} کلاس</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {canEdit && (
        <MfaGate why="فهرست دانشجوها و افراد هر واحد اطلاعات شخصی است و فقط از نشست دومرحله‌ای باز می‌شود.">
          <UnitMembers orgId={orgId} unit={unit} canEdit={!archived} onChanged={onChanged} />
        </MfaGate>
      )}
    </div>
  );
}

function UnitMembers({ orgId, unit, canEdit, onChanged }: { orgId: string; unit: UnitRow; canEdit: boolean; onChanged: () => void }) {
  const [kind, setKind] = React.useState<UnitItemKind>("class");
  const items = useLoad(() => orgUnitItems(orgId, kind), [orgId, kind]);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [adding, setAdding] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  React.useEffect(() => { setPicked(new Set()); setErr(""); }, [kind, unit.id]);
  const here = (items.data ?? []).filter((i) => i.unit_id === unit.id);
  const counts: Record<UnitItemKind, number> = { class: unit.classes, student: unit.students, member: unit.staff, course: unit.courses };

  async function move(ids: string[], to: string | null) {
    setBusy(true); setErr("");
    try { await orgUnitAssign(orgId, kind, ids, to); setPicked(new Set()); await items.reload(); onChanged(); }
    catch (e) { setErr(orgConsoleError(e)); } finally { setBusy(false); }
  }

  return (
    <Panel title="آنچه روی این واحد است" icon={Layers} bodyClass="p-0"
      description="مستقیم روی همین واحد؛ زیرواحدها جدا حساب می‌شوند"
      actions={canEdit ? <Btn size="sm" kind="primary" icon={Plus} onClick={() => setAdding(true)}>افزودن به این واحد</Btn> : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <Segmented value={kind} onChange={setKind} options={ITEM_KIND.map((k) => ({ ...k, count: counts[k.key] }))} />
        {canEdit && picked.size > 0 && (
          <Btn size="sm" busy={busy} onClick={() => void move([...picked], unit.parent_id)}>
            برداشتن {faNum(picked.size)} مورد {unit.parent_id ? "(به واحد بالاتر)" : "(به کل مرکز)"}
          </Btn>
        )}
      </div>
      {err && <div className="p-3"><Notice tone="bad" title="انجام نشد">{err}</Notice></div>}
      {items.error ? <div className="p-3"><Notice tone="bad" title="خوانده نشد">{orgConsoleError(items.error)}</Notice></div>
        : items.data === null ? <div className="m-3 h-32 animate-pulse rounded-lg bg-muted/50" />
        : !here.length ? <div className="p-4"><EmptyState title="چیزی مستقیم روی این واحد نیست" text={canEdit ? "با «افزودن به این واحد» کلاس، دانشجو یا افراد را اینجا بچینید." : undefined} /></div>
        : (
          <ul className="max-h-[420px] divide-y divide-border overflow-y-auto">
            {here.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-4 py-2">
                {canEdit && <input type="checkbox" aria-label={`انتخاب ${i.title}`} checked={picked.has(i.id)}
                  onChange={(e) => { const s = new Set(picked); if (e.target.checked) s.add(i.id); else s.delete(i.id); setPicked(s); }} />}
                <span className="min-w-0 flex-1"><b className="block truncate text-[12.5px]">{i.title}</b>
                  {i.sub && <span className="block truncate text-[11px] text-muted-foreground">{i.sub}</span>}</span>
                {i.status !== "active" && <Badge tone="muted">{i.status === "invited" ? "دعوت‌شده" : i.status === "suspended" ? "معلق" : i.status}</Badge>}
              </li>
            ))}
          </ul>
        )}
      {adding && (
        <AddItems kind={kind} unit={unit} items={(items.data ?? []).filter((i) => i.unit_id !== unit.id)}
          onClose={() => setAdding(false)} onAdd={async (ids) => { await move(ids, unit.id); setAdding(false); }} busy={busy} />
      )}
    </Panel>
  );
}

function AddItems({ kind, unit, items, onClose, onAdd, busy }: {
  kind: UnitItemKind; unit: UnitRow; items: UnitItem[]; onClose: () => void; onAdd: (ids: string[]) => Promise<void>; busy: boolean;
}) {
  const [q, setQ] = React.useState("");
  const [onlyFree, setOnlyFree] = React.useState(true);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const t = q.trim().toLowerCase();
  const list = items.filter((i) => (!onlyFree || !i.unit_id) && (!t || i.title.toLowerCase().includes(t) || (i.sub ?? "").toLowerCase().includes(t)));
  const shown = list.slice(0, 300);
  const label = ITEM_KIND.find((k) => k.key === kind)?.label ?? "";
  return (
    <Drawer open onClose={onClose} width={560} title={`افزودن ${label} به «${unit.name}»`}
      subtitle="فقط مواردی دیده می‌شوند که اجازه‌ی جابه‌جایی آن‌ها را دارید"
      footer={<div className="flex items-center justify-between gap-2">
        <span className="text-[12px] text-muted-foreground">{faNum(picked.size)} انتخاب‌شده</span>
        <div className="flex gap-2"><Btn onClick={onClose}>انصراف</Btn>
          <Btn kind="primary" busy={busy} disabled={!picked.size} onClick={() => void onAdd([...picked])}>افزودن</Btn></div>
      </div>}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="جستجو" className="min-w-[200px] flex-1" />
        <label className="flex items-center gap-1.5 text-[12px]"><input type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} /> فقط موارد بدون واحد</label>
      </div>
      {shown.length > 0 && (
        <button type="button" className="mb-2 text-[11.5px] font-bold text-bronze hover:underline"
          onClick={() => setPicked(picked.size === shown.length ? new Set() : new Set(shown.map((i) => i.id)))}>
          {picked.size === shown.length ? "برداشتن انتخاب همه" : `انتخاب همه‌ی ${faNum(shown.length)} مورد`}
        </button>
      )}
      {!list.length ? <EmptyState title="موردی نیست" text={onlyFree ? "همه‌ی موارد واحد دارند؛ تیک «فقط موارد بدون واحد» را بردارید." : undefined} /> : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {shown.map((i) => (
            <li key={i.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                <input type="checkbox" checked={picked.has(i.id)}
                  onChange={(e) => { const s = new Set(picked); if (e.target.checked) s.add(i.id); else s.delete(i.id); setPicked(s); }} />
                <span className="min-w-0 flex-1"><b className="block truncate text-[12.5px]">{i.title}</b>
                  {i.sub && <span className="block truncate text-[11px] text-muted-foreground">{i.sub}</span>}</span>
                {i.unit_id && <Badge tone="muted">واحد دیگر</Badge>}
              </label>
            </li>
          ))}
        </ul>
      )}
      {list.length > shown.length && <p className="mt-2 text-[11.5px] text-muted-foreground">{faNum(list.length - shown.length)} مورد دیگر؛ جستجو را دقیق‌تر کنید.</p>}
    </Drawer>
  );
}

function UnitForm({ orgId, rows, ix, initial, canAt, onClose, onSaved }: {
  orgId: string; rows: UnitRow[]; ix: ReturnType<typeof unitIndex>; initial: { id: string | null; parentId: string | null };
  canAt: (id: string | null) => boolean; onClose: () => void; onSaved: (id: string) => void;
}) {
  const cur = initial.id ? ix.byId.get(initial.id) : undefined;
  const parent = initial.parentId ? ix.byId.get(initial.parentId) : undefined;
  const defaultKind: UnitKind = cur?.kind ?? (parent ? (({ faculty: "department", department: "program", branch: "track", track: "section" } as Partial<Record<UnitKind, UnitKind>>)[parent.kind] ?? "other") : "faculty");
  const [name, setName] = React.useState(cur?.name ?? "");
  const [kind, setKind] = React.useState<UnitKind>(defaultKind);
  const [code, setCode] = React.useState(cur?.code ?? "");
  const [sort, setSort] = React.useState(String(cur?.sort ?? ((ix.kids.get(initial.parentId)?.length ?? 0) + 1) * 10));
  const [parentId, setParentId] = React.useState<string | null>(initial.parentId);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const exclude = React.useMemo(() => new Set(cur ? ix.subtree(cur.id) : []), [cur, ix]);
  const manageable = React.useMemo(() => new Set(rows.filter((r) => canAt(r.id)).map((r) => r.id)), [rows, canAt]);
  const ok = name.trim().length > 0 && name.trim().length <= 80 && (!code || /^[a-z0-9][a-z0-9._-]{0,29}$/.test(code.trim().toLowerCase()));

  async function save() {
    setBusy(true); setErr("");
    try {
      const id = await orgUnitSave(orgId, { id: cur?.id ?? null, parentId, kind, name: name.trim(), code: code.trim().toLowerCase(), sort: Number(sort) || 0 });
      onSaved(id);
    } catch (e) { setErr(orgConsoleError(e)); } finally { setBusy(false); }
  }

  return (
    <Drawer open onClose={onClose} width={520} title={cur ? `ویرایش «${cur.name}»` : "واحد تازه"}
      subtitle={cur ? "تغییر واحد بالادستی، کل شاخه را با خودش جابه‌جا می‌کند" : parent ? `زیر «${parent.name}»` : "در بالاترین سطح مرکز"}
      footer={<div className="flex justify-end gap-2"><Btn onClick={onClose}>انصراف</Btn><Btn kind="primary" busy={busy} disabled={!ok} onClick={() => void save()}>{cur ? "ذخیره" : "ساخت"}</Btn></div>}>
      <MfaGate why="تغییر ساختار سازمانی نشست دومرحله‌ای می‌خواهد.">
        <div className="space-y-4">
          <label className="block space-y-1"><span className="text-[12px] font-bold">نام</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={cx(inputCls, "w-full")} placeholder="مثلاً گروه حقوق خصوصی" autoFocus /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1"><span className="text-[12px] font-bold">نوع</span>
              <select value={kind} onChange={(e) => setKind(e.target.value as UnitKind)} className={cx(inputCls, "w-full")}>
                {(Object.keys(UNIT_KIND_LABEL) as UnitKind[]).map((k) => <option key={k} value={k}>{UNIT_KIND_LABEL[k]}</option>)}
              </select></label>
            <label className="block space-y-1"><span className="text-[12px] font-bold">کد (اختیاری)</span>
              <input dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} maxLength={30} className={cx(inputCls, "w-full")} placeholder="law-private" /></label>
          </div>
          <label className="block space-y-1"><span className="text-[12px] font-bold">واحد بالادستی</span>
            <UnitSelect units={rows} value={parentId} onChange={setParentId} label="واحد بالادستی" centreLabel="— بالاترین سطح (کل مرکز) —"
              allowCentre={canAt(null)} exclude={exclude} only={canAt(null) ? undefined : manageable} className="w-full" /></label>
          <label className="block space-y-1"><span className="text-[12px] font-bold">ترتیب نمایش</span>
            <input type="number" dir="ltr" value={sort} onChange={(e) => setSort(e.target.value)} className={cx(inputCls, "w-32")} /></label>
          {cur && <KeyValues items={[["کلاس مستقیم", faNum(cur.classes)], ["دانشجوی مستقیم", faNum(cur.students)], ["کارکنان مستقیم", faNum(cur.staff)]]} />}
          {err && <Notice tone="bad" title="ذخیره نشد">{err}</Notice>}
        </div>
      </MfaGate>
    </Drawer>
  );
}
