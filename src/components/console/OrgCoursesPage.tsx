"use client";
/* Course catalogue (phase A3 of docs/ADMIN_PLATFORM.md): the subjects a centre teaches, independent of terms.
 * A course holds the code, units, prerequisites, default capacity, pass mark and grading weights; each term
 * gets its own classes (sections) of a course. */
import * as React from "react";
import { Archive, BookOpen, Pencil, Plus } from "lucide-react";
import { downloadCsv, faNum, toCsv } from "@/lib/cloud-api/admin-console";
import { unitIndex, type UnitRow } from "@/lib/cloud-api/org-console";
import {
  orgCourseList, orgCourseUpsert, orgTeachingError, WEIGHT_LABEL,
  type CourseInput, type CourseRow, type WeightKey, type Weights,
} from "@/lib/cloud-api/org-teaching";
import {
  Badge, Btn, cx, DataTable, Drawer, EmptyState, inputCls, Notice, RefreshBtn, SearchBox, Segmented, Toolbar, type Column,
} from "./ConsoleKit";
import { Chip, SectionIntro, UnitSelect, useUnits } from "./CentreBits";
import { Field, scopeFor } from "./TeachingBits";
import type { CentrePageProps } from "./CentreConsole";

const WEIGHT_KEYS: WeightKey[] = ["midterm", "final_exam", "classwork", "project"];
const weightSum = (w: Weights) => WEIGHT_KEYS.reduce((s, k) => s + (Number(w[k]) || 0), 0);
const weightText = (w: Weights) => WEIGHT_KEYS.filter((k) => w[k]).map((k) => `${WEIGHT_LABEL[k]} ${faNum(w[k] ?? 0)}`).join(" · ");

export function OrgCoursesPage({ orgId, access, nav }: CentrePageProps) {
  const [rows, setRows] = React.useState<CourseRow[] | null>(null);
  const [error, setError] = React.useState<unknown>(null);
  const [busy, setBusy] = React.useState(false);
  const [at, setAt] = React.useState<Date | null>(null);
  const units = useUnits(orgId);
  const [q, setQ] = React.useState("");
  const [unit, setUnit] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<"active" | "archived" | "noclass">("active");
  const [edit, setEdit] = React.useState<CourseRow | "new" | null>(null);
  const canAdd = access.canSomewhere("org.classes.manage");

  const load = React.useCallback(async () => {
    setBusy(true); setError(null);
    try { setRows(await orgCourseList(orgId)); setAt(new Date()); } catch (e) { setError(e); } finally { setBusy(false); }
  }, [orgId]);
  React.useEffect(() => { void load(); }, [load]);

  const unitSet = React.useMemo(() => (unit && units.data ? new Set(unitIndex(units.data).subtree(unit)) : null), [unit, units.data]);

  const all = rows ?? [];
  const term = q.trim().toLowerCase();
  const shown = all.filter((c) =>
    (status === "noclass" ? c.status === "active" && c.classes === 0 : c.status === status) &&
    (!unitSet || (c.unit_id !== null && unitSet.has(c.unit_id))) &&
    (!term || `${c.code} ${c.title} ${c.description}`.toLowerCase().includes(term)));

  const columns: Column<CourseRow>[] = [
    { key: "code", header: "کد", cell: (c) => c.code ? <span dir="ltr" className="font-mono text-[12px]">{c.code}</span> : <span className="text-muted-foreground">—</span>, className: "w-24" },
    { key: "title", header: "درس", cell: (c) => (
      <div className="min-w-0">
        <b className="block truncate">{c.title}</b>
        {c.description && <span className="block max-w-[340px] truncate text-[11.5px] text-muted-foreground">{c.description}</span>}
      </div>
    ) },
    { key: "units", header: "واحد", cell: (c) => <span className="tabular-nums">{faNum(c.units)}</span>, className: "w-16" },
    { key: "unit", header: "بخش", cell: (c) => c.unit_name ? <Chip>{c.unit_name}</Chip> : <span className="text-[12px] text-muted-foreground">کل مرکز</span>, hideBelow: "md" },
    { key: "pre", header: "پیش‌نیاز", hideBelow: "lg", cell: (c) => c.prereq_titles.length
      ? <div className="flex max-w-[260px] flex-wrap gap-1">{c.prereq_titles.slice(0, 3).map((t) => <Chip key={t}>{t}</Chip>)}{c.prereq_titles.length > 3 && <Chip>+{faNum(c.prereq_titles.length - 3)}</Chip>}</div>
      : <span className="text-muted-foreground">—</span> },
    { key: "grade", header: "نمره", hideBelow: "xl", cell: (c) => (
      <div className="text-[11.5px] text-muted-foreground"><span>قبولی {faNum(c.pass_mark)} از ۲۰</span><span className="block">{weightText(c.weights)}</span></div>
    ) },
    { key: "classes", header: "کلاس", cell: (c) => (
      <span className="text-[12px] tabular-nums">{faNum(c.classes)}{c.classes_current > 0 && <span className="text-muted-foreground"> · {faNum(c.classes_current)} در ترم جاری</span>}</span>
    ) },
    { key: "act", header: "", className: "w-12", cell: (c) => c.can_edit
      ? <button type="button" aria-label="ویرایش" onClick={(e) => { e.stopPropagation(); setEdit(c); }} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"><Pencil className="h-4 w-4" /></button>
      : null },
  ];

  function exportCsv() {
    downloadCsv(`courses-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(
      ["کد", "عنوان", "واحد", "بخش", "پیش‌نیاز", "ظرفیت پیش‌فرض", "نمره‌ی قبولی", "وزن‌ها", "کلاس‌ها", "وضعیت"],
      shown.map((c) => [c.code, c.title, c.units, c.unit_name ?? "", c.prereq_titles.join(" | "), c.default_capacity ?? "",
        c.pass_mark, weightText(c.weights), c.classes, c.status === "active" ? "فعال" : "بایگانی"])));
  }

  return (
    <>
      <SectionIntro
        text="فهرست درس‌های مرکز، جدا از ترم. هر درس کد، تعداد واحد، پیش‌نیاز، ظرفیت پیش‌فرض، نمره‌ی قبولی و وزن نمره دارد؛ هر ترم کلاس‌ها (گروه‌های) خودش را از این درس‌ها می‌سازد."
        meta={rows && <>{faNum(all.filter((c) => c.status === "active").length)} درس فعال · {faNum(all.reduce((s, c) => s + c.classes, 0))} کلاس</>}
        actions={<>
          {canAdd && <Btn kind="primary" icon={Plus} onClick={() => setEdit("new")}>درس تازه</Btn>}
          {nav.has("classes") && <Btn onClick={() => nav.go("classes")}>کلاس‌ها</Btn>}
          <RefreshBtn onClick={() => void load()} busy={busy} at={at} />
        </>} />
      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="جستجوی کد یا نام درس" className="w-64" />
        {units.data && units.data.length > 0 && <UnitSelect units={units.data} value={unit} onChange={setUnit} label="بخش" centreLabel="همه‌ی بخش‌ها" />}
        <Segmented value={status} onChange={setStatus} options={[
          { key: "active", label: "فعال", count: all.filter((c) => c.status === "active").length },
          { key: "noclass", label: "بدون کلاس", count: all.filter((c) => c.status === "active" && c.classes === 0).length },
          { key: "archived", label: "بایگانی", count: all.filter((c) => c.status === "archived").length },
        ]} />
        <span className="flex-1" />
        <Btn size="sm" disabled={!shown.length} onClick={exportCsv}>خروجی CSV</Btn>
      </Toolbar>
      {error ? <Notice tone="bad" title="درس‌ها خوانده نشد">{orgTeachingError(error)}</Notice> : (
        <DataTable columns={columns} rows={rows === null ? null : shown} rowKey={(c) => c.id} loading={busy && rows === null}
          onRowClick={(c) => c.can_edit && setEdit(c)}
          empty={<EmptyState icon={BookOpen} title={all.length ? "درسی با این فیلتر نیست" : "هنوز درسی تعریف نشده"}
            text={all.length ? undefined : "درس‌ها را یک‌بار تعریف کنید؛ برای هر ترم فقط کلاس می‌سازید."}
            action={!all.length && canAdd ? <Btn kind="primary" icon={Plus} onClick={() => setEdit("new")}>درس تازه</Btn> : undefined} />} />
      )}
      {edit && units.data && (
        <CourseEditor orgId={orgId} course={edit === "new" ? null : edit} all={all} units={units.data}
          scope={scopeFor(access, "org.classes.manage", units.data)}
          onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void load(); }} />
      )}
    </>
  );
}

function CourseEditor({ orgId, course, all, units, scope, onClose, onSaved }: {
  orgId: string; course: CourseRow | null; all: CourseRow[]; units: UnitRow[];
  scope: { only?: Set<string>; allowCentre: boolean }; onClose: () => void; onSaved: () => void;
}) {
  const [f, setF] = React.useState<CourseInput>(() => ({
    code: course?.code ?? "", title: course?.title ?? "", units: course?.units ?? 2, description: course?.description ?? "",
    prereqs: course?.prereqs ?? [], default_capacity: course?.default_capacity ?? null, pass_mark: course?.pass_mark ?? 10,
    weights: course?.weights && weightSum(course.weights) === 100 ? course.weights : { midterm: 40, final_exam: 60 },
    unit_id: course?.unit_id ?? (scope.allowCentre ? null : [...(scope.only ?? [])][0] ?? null), status: course?.status ?? "active",
  }));
  const [preQ, setPreQ] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const set = (p: Partial<CourseInput>) => setF((x) => ({ ...x, ...p }));
  const sum = weightSum(f.weights);
  const ok = f.title.trim().length > 0 && sum === 100 && f.units >= 0 && f.units <= 30 && f.pass_mark >= 0 && f.pass_mark <= 20
    && (f.default_capacity === null || (f.default_capacity >= 1 && f.default_capacity <= 5000)) && (scope.allowCentre || f.unit_id !== null);
  const options = all.filter((c) => c.id !== course?.id && c.status === "active" &&
    (!preQ.trim() || `${c.code} ${c.title}`.toLowerCase().includes(preQ.trim().toLowerCase())));
  const byId = new Map(all.map((c) => [c.id, c]));

  async function save() {
    setBusy(true); setErr("");
    try {
      await orgCourseUpsert(orgId, course?.id ?? null, { ...f, code: f.code.trim(), title: f.title.trim(), description: f.description.trim() });
      onSaved();
    } catch (e) { setErr(orgTeachingError(e)); } finally { setBusy(false); }
  }
  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <Drawer open onClose={onClose} width={600} title={course ? `ویرایش «${course.title}»` : "درس تازه"}
      subtitle={course ? `${faNum(course.classes)} کلاس از این درس ساخته شده` : "درس یک‌بار تعریف می‌شود و در همه‌ی ترم‌ها کلاس می‌گیرد"}
      footer={<div className="flex items-center justify-between gap-2">
        {course ? <Btn size="sm" icon={Archive} onClick={() => set({ status: f.status === "active" ? "archived" : "active" })}>{f.status === "active" ? "بایگانی درس" : "برگرداندن از بایگانی"}</Btn> : <span />}
        <div className="flex gap-2"><Btn onClick={onClose}>انصراف</Btn><Btn kind="primary" busy={busy} disabled={!ok} onClick={() => void save()}>{course ? "ذخیره" : "ساخت"}</Btn></div>
      </div>}>
      <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)_100px]">
        <Field label="کد"><input dir="ltr" value={f.code} maxLength={30} onChange={(e) => set({ code: e.target.value })} placeholder="LAW-201" className={cx(inputCls, "w-full")} /></Field>
        <Field label="عنوان درس"><input value={f.title} maxLength={120} autoFocus onChange={(e) => set({ title: e.target.value })} placeholder="حقوق مدنی ۴" className={cx(inputCls, "w-full")} /></Field>
        <Field label="تعداد واحد"><input type="number" min={0} max={30} step={0.5} value={f.units} onChange={(e) => set({ units: num(e.target.value) })} className={cx(inputCls, "w-full")} /></Field>
      </div>
      <Field label="توضیح (اختیاری)"><textarea value={f.description} maxLength={2000} rows={2} onChange={(e) => set({ description: e.target.value })}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-bronze" /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="بخش سازمانی" hint={scope.allowCentre ? "درس‌های کل مرکز را همه‌ی بخش‌ها می‌بینند" : "فقط بخش‌هایی که در آن دسترسی دارید"}>
          <UnitSelect units={units} value={f.unit_id} onChange={(v) => set({ unit_id: v })} label="بخش" allowCentre={scope.allowCentre} only={scope.only} className="w-full" />
        </Field>
        <Field label="ظرفیت پیش‌فرض هر کلاس" hint="خالی یعنی بدون سقف؛ کلاس‌ها می‌توانند ظرفیت خودشان را داشته باشند">
          <input type="number" min={1} max={5000} value={f.default_capacity ?? ""} placeholder="بدون سقف"
            onChange={(e) => set({ default_capacity: e.target.value === "" ? null : Number(e.target.value) })} className={cx(inputCls, "w-full")} />
        </Field>
      </div>

      <section className="rounded-xl border border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12.5px] font-bold">نمره‌دهی</p>
          <Badge tone={sum === 100 ? "ok" : "bad"}>جمع وزن‌ها {faNum(sum)} از ۱۰۰</Badge>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Field label="نمره‌ی قبولی"><input type="number" min={0} max={20} step={0.25} value={f.pass_mark} onChange={(e) => set({ pass_mark: num(e.target.value) })} className={cx(inputCls, "w-full")} /></Field>
          {WEIGHT_KEYS.map((k) => (
            <Field key={k} label={WEIGHT_LABEL[k]}>
              <input type="number" min={0} max={100} value={f.weights[k] ?? 0}
                onChange={(e) => set({ weights: { ...f.weights, [k]: Math.max(0, Math.min(100, num(e.target.value))) } })} className={cx(inputCls, "w-full")} />
            </Field>
          ))}
        </div>
        <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted">
          {WEIGHT_KEYS.map((k, i) => (f.weights[k] ?? 0) > 0 && (
            <div key={k} title={WEIGHT_LABEL[k]} className={["bg-primary", "bg-bronze", "bg-emerald-600", "bg-sky-600"][i]} style={{ width: `${Math.min(100, f.weights[k] ?? 0)}%` }} />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">وزن‌ها در فاز A4 برای محاسبه‌ی نمره‌ی نهایی و کارنامه به کار می‌روند.</p>
      </section>

      <section className="rounded-xl border border-border p-3">
        <p className="text-[12.5px] font-bold">پیش‌نیازها <span className="font-normal text-muted-foreground">({faNum(f.prereqs.length)} از ۲۰)</span></p>
        <p className="mt-0.5 text-[11.5px] text-muted-foreground">دانشجو وقتی پیش‌نیاز را گذرانده (و نمره‌اش از نمره‌ی قبولی آن درس کمتر نبوده) می‌تواند ثبت‌نام کند.</p>
        {f.prereqs.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {f.prereqs.map((id) => (
              <button key={id} type="button" onClick={() => set({ prereqs: f.prereqs.filter((x) => x !== id) })}
                className="rounded-md border border-bronze/30 bg-bronze/10 px-1.5 py-0.5 text-[11.5px] font-semibold hover:line-through">
                {byId.get(id)?.title ?? "درس حذف‌شده"} ×
              </button>
            ))}
          </div>
        )}
        <input value={preQ} onChange={(e) => setPreQ(e.target.value)} placeholder="جستجوی درس…" className={cx(inputCls, "mt-2 w-full")} />
        <ul className="mt-2 max-h-44 divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {options.slice(0, 50).map((c) => {
            const on = f.prereqs.includes(c.id);
            return (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[12.5px] hover:bg-muted/50">
                  <input type="checkbox" checked={on} disabled={!on && f.prereqs.length >= 20}
                    onChange={() => set({ prereqs: on ? f.prereqs.filter((x) => x !== c.id) : [...f.prereqs, c.id] })} />
                  {c.code && <span dir="ltr" className="font-mono text-[11px] text-muted-foreground">{c.code}</span>}
                  <span className="truncate">{c.title}</span>
                </label>
              </li>
            );
          })}
          {!options.length && <li className="px-3 py-2 text-[12px] text-muted-foreground">درسی نیست.</li>}
        </ul>
      </section>
      {f.status === "archived" && <Notice tone="warn" title="درس بایگانی می‌شود">کلاس‌های موجود می‌مانند، ولی برای ترم‌های بعد کلاس تازه از این درس ساخته نمی‌شود.</Notice>}
      {err && <Notice tone="bad" title="ذخیره نشد">{err}</Notice>}
    </Drawer>
  );
}
