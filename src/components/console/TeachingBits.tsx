"use client";
/* Shared parts of the teaching pages (phase A3 of docs/ADMIN_PLATFORM.md): student picker (search or paste),
 * weekly schedule editor, enrolment result summary, fill meter, term and teacher selects. */
import * as React from "react";
import { ClipboardPaste, Plus, Search, Trash2, X } from "lucide-react";
import { faNum } from "@/lib/cloud-api/admin-console";
import {
  DAY_LABEL, ENROLL_RESULT, orgStudentPick, orgTeachingError, parseRefs, TERM_STATUS_LABEL,
  type EnrollResult, type Slot, type StudentPick, type TeacherPick, type TermRow,
} from "@/lib/cloud-api/org-teaching";
import { unitIndex, type PermKey, type UnitRow } from "@/lib/cloud-api/org-console";
import { Badge, Btn, cx, inputCls, Segmented } from "./ConsoleKit";

export function FillMeter({ used, cap, wait }: { used: number; cap: number | null; wait?: number }) {
  if (!cap) {
    return <span className="text-[12px] tabular-nums">{faNum(used)} <span className="text-muted-foreground">نفر · بدون سقف</span></span>;
  }
  const pct = Math.min(100, Math.round((used / cap) * 100));
  const tone = used >= cap ? "bg-red-500" : pct >= 85 ? "bg-amber-500" : "bg-emerald-600";
  return (
    <div className="min-w-[120px]">
      <div className="flex items-center justify-between gap-2 text-[11.5px] tabular-nums">
        <span><b>{faNum(used)}</b> از {faNum(cap)}</span>
        {!!wait && <Badge tone="info">{faNum(wait)} در انتظار</Badge>}
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cx("h-full rounded-full", tone)} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export function TermSelect({ terms, value, onChange, allowAll, className }: {
  terms: TermRow[]; value: string | null; onChange: (v: string | null) => void; allowAll?: boolean; className?: string;
}) {
  return (
    <select aria-label="ترم" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className={cx(inputCls, "min-w-[180px]", className)}>
      {allowAll && <option value="">همه‌ی ترم‌ها</option>}
      {!allowAll && value === null && <option value="" disabled>انتخاب ترم…</option>}
      {terms.map((t) => <option key={t.id} value={t.id}>{t.title} ({TERM_STATUS_LABEL[t.status]})</option>)}
    </select>
  );
}

export function TeacherSelect({ teachers, value, onChange, className, emptyLabel = "بدون استاد" }: {
  teachers: TeacherPick[]; value: string | null; onChange: (v: string | null) => void; className?: string; emptyLabel?: string;
}) {
  return (
    <select aria-label="استاد" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className={cx(inputCls, "min-w-[180px]", className)}>
      <option value="">{emptyLabel}</option>
      {teachers.map((t) => (
        <option key={t.user_id} value={t.user_id}>{t.display_name || t.username} (@{t.username}) · {faNum(t.classes)} کلاس</option>
      ))}
    </select>
  );
}

/** weekly slots; day 0 = Saturday */
export function ScheduleEditor({ value, onChange }: { value: Slot[]; onChange: (v: Slot[]) => void }) {
  const set = (i: number, p: Partial<Slot>) => onChange(value.map((s, j) => (j === i ? { ...s, ...p } : s)));
  return (
    <div className="space-y-2">
      {value.map((s, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <select aria-label="روز" value={s.day} onChange={(e) => set(i, { day: Number(e.target.value) })} className={cx(inputCls, "w-28")}>
            {DAY_LABEL.map((d, k) => <option key={k} value={k}>{d}</option>)}
          </select>
          <input type="time" dir="ltr" aria-label="شروع" value={s.start} onChange={(e) => set(i, { start: e.target.value })} className={cx(inputCls, "w-28")} />
          <span className="text-muted-foreground">تا</span>
          <input type="time" dir="ltr" aria-label="پایان" value={s.end} onChange={(e) => set(i, { end: e.target.value })} className={cx(inputCls, "w-28")} />
          <input aria-label="کلاس یا اتاق" value={s.room} maxLength={40} onChange={(e) => set(i, { room: e.target.value })} placeholder="اتاق" className={cx(inputCls, "w-28 flex-1")} />
          <button type="button" aria-label="حذف" onClick={() => onChange(value.filter((_, j) => j !== i))} className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted"><Trash2 className="h-4 w-4" /></button>
          {s.end <= s.start && <span className="text-[11px] text-red-600">پایان باید بعد از شروع باشد</span>}
        </div>
      ))}
      {value.length < 14 && (
        <Btn size="sm" icon={Plus} onClick={() => onChange([...value, { day: 0, start: "08:00", end: "09:30", room: "" }])}>جلسه‌ی هفتگی</Btn>
      )}
    </div>
  );
}
export const scheduleOk = (v: Slot[]) => v.every((s) => /^\d{2}:\d{2}$/.test(s.start) && /^\d{2}:\d{2}$/.test(s.end) && s.end > s.start);

/** search the roster or paste a list; returns refs (usernames / student numbers / ids) */
export function StudentPicker({ orgId, onPick, busy, actionLabel, exclude }: {
  orgId: string; onPick: (refs: string[]) => void; busy?: boolean; actionLabel: string; exclude?: Set<string>;
}) {
  const [mode, setMode] = React.useState<"search" | "paste">("search");
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<StudentPick[] | null>(null);
  const [picked, setPicked] = React.useState<Map<string, StudentPick>>(new Map());
  const [paste, setPaste] = React.useState("");
  const [err, setErr] = React.useState("");
  React.useEffect(() => {
    if (mode !== "search" || q.trim().length < 2) { setHits(null); return; }
    let live = true;
    const t = setTimeout(() => {
      orgStudentPick(orgId, q.trim()).then((r) => { if (live) { setHits(r); setErr(""); } })
        .catch((e) => { if (live) setErr(orgTeachingError(e)); });
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [orgId, q, mode]);
  const refs = mode === "search" ? [...picked.values()].map((s) => s.id) : parseRefs(paste);
  function toggle(s: StudentPick) {
    const m = new Map(picked);
    if (m.has(s.id)) m.delete(s.id); else m.set(s.id, s);
    setPicked(m);
  }
  return (
    <div className="space-y-3">
      <Segmented value={mode} onChange={setMode} options={[{ key: "search", label: "جستجو" }, { key: "paste", label: "فهرست چسباندنی" }]} />
      {mode === "search" ? (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="نام، نام کاربری یا شماره‌ی دانشجویی (حداقل ۲ حرف)"
              className={cx(inputCls, "w-full ps-9")} />
          </div>
          {picked.size > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {[...picked.values()].map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1 rounded-md border border-bronze/30 bg-bronze/10 px-1.5 py-0.5 text-[11.5px] font-semibold">
                  {s.full_name || s.org_username}
                  <button type="button" aria-label="برداشتن" onClick={() => toggle(s)}><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}
          {hits && (
            <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-xl border border-border">
              {!hits.length && <li className="px-3 py-3 text-[12px] text-muted-foreground">کسی پیدا نشد.</li>}
              {hits.map((s) => {
                const out = exclude?.has(s.id);
                return (
                  <li key={s.id}>
                    <label className={cx("flex items-center gap-3 px-3 py-2", out ? "opacity-50" : "cursor-pointer hover:bg-muted/50")}>
                      <input type="checkbox" disabled={out} checked={picked.has(s.id)} onChange={() => toggle(s)} />
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[12.5px]">{s.full_name || s.org_username}</b>
                        <span className="block truncate text-[11px] text-muted-foreground" dir="auto">
                          @{s.org_username}{s.student_no ? ` · ${s.student_no}` : ""}{s.field ? ` · ${s.field}` : ""}{s.entry_year ? ` · ورودی ${s.entry_year}` : ""}
                        </span>
                      </span>
                      {s.status !== "active" && <Badge tone="warn">غیرفعال</Badge>}
                      {out && <Badge tone="muted">از قبل</Badge>}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <label className="block space-y-1">
          <span className="flex items-center gap-1.5 text-[12px] font-bold"><ClipboardPaste className="h-3.5 w-3.5" />نام کاربری یا شماره‌ی دانشجویی، هر خط یکی</span>
          <textarea dir="ltr" value={paste} onChange={(e) => setPaste(e.target.value)} rows={7}
            placeholder={"ali.rezaei\n4011234567\nsara-m"}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-[12.5px] outline-none focus:border-bronze" />
          <span className="text-[11px] text-muted-foreground">{faNum(refs.length)} مورد · ستون اول فایل Excel را هم می‌توانید کپی کنید.</span>
        </label>
      )}
      {err && <p className="text-[12px] text-red-600">{err}</p>}
      <div className="flex justify-end">
        <Btn kind="primary" busy={busy} disabled={!refs.length} onClick={() => { onPick(refs); setPicked(new Map()); setPaste(""); }}>
          {actionLabel} ({faNum(refs.length)})
        </Btn>
      </div>
    </div>
  );
}

/** counts per result, e.g. after an enrolment */
export function ResultSummary({ items, onClose }: { items: [EnrollResult | string, number][]; onClose?: () => void }) {
  if (!items.length) return null;
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-bold">نتیجه</p>
        {onClose && <button type="button" aria-label="بستن" onClick={onClose}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map(([k, n]) => {
          const m = ENROLL_RESULT[k as EnrollResult];
          return <Badge key={k} tone={m?.tone ?? "muted"}>{m?.label ?? k}: {faNum(n)}</Badge>;
        })}
      </div>
    </div>
  );
}

/** "force" switch with a reason, for overrides of windows / capacity / prerequisites */
export function ForceBox({ force, setForce, reason, setReason, allowed }: {
  force: boolean; setForce: (v: boolean) => void; reason: string; setReason: (v: string) => void; allowed: boolean;
}) {
  if (!allowed) return null;
  return (
    <div className={cx("rounded-xl border p-3", force ? "border-amber-500/40 bg-amber-500/5" : "border-border")}>
      <label className="flex items-start gap-2 text-[12.5px]">
        <input type="checkbox" className="mt-0.5" checked={force} onChange={(e) => setForce(e.target.checked)} />
        <span><b>بدون رعایت قواعد</b><span className="block text-[11.5px] text-muted-foreground">مهلت ثبت‌نام، ظرفیت و پیش‌نیاز نادیده گرفته می‌شود و با دلیل در لاگ ممیزی ثبت می‌شود.</span></span>
      </label>
      {force && <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="دلیل (الزامی)" className={cx(inputCls, "mt-2 w-full")} />}
    </div>
  );
}

/** units where a perm is held (with their subtrees); `only` is undefined when the perm is centre-wide */
export function scopeFor(access: { can: (p: PermKey) => boolean; unitsFor: (p: PermKey) => { id: string }[] }, perm: PermKey, units: UnitRow[]) {
  if (access.can(perm)) return { only: undefined as Set<string> | undefined, allowCentre: true };
  const ix = unitIndex(units);
  const only = new Set<string>();
  for (const u of access.unitsFor(perm)) for (const id of ix.subtree(u.id)) only.add(id);
  return { only, allowCentre: false };
}

/** labelled form field */
export function Field({ label, hint, children, className }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <label className={cx("block space-y-1", className)}>
      <span className="text-[12px] font-bold">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}
