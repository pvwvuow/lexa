"use client";
/* Terms and the academic calendar (phase A3 of docs/ADMIN_PLATFORM.md): every term with its status, dates
 * and numbers; a calendar with registration, add / drop, exams, grade entry and appeal windows drawn on a
 * timeline; enforced windows are applied by the server clock. Copy a term with its classes in one step. */
import * as React from "react";
import { CalendarDays, CalendarPlus, Copy, Lock, Pencil, Plus, Save, Trash2, Undo2, Wand2 } from "lucide-react";
import { faNum } from "@/lib/cloud-api/admin-console";
import {
  DATE_KIND, DATE_KINDS, faDay, fromLocalInput, orgTeachingError, orgTermCopy, orgTermDatesSave, orgTermDelete,
  orgTermList, orgTermUpsert, TERM_STATUS_LABEL, toLocalInput,
  type DateKind, type TermDate, type TermRow, type TermStatus,
} from "@/lib/cloud-api/org-teaching";
import {
  Badge, Btn, ConfirmDialog, cx, Drawer, EmptyState, inputCls, Notice, Panel, RefreshBtn, useLoad, type ConfirmSpec, type Tone,
} from "./ConsoleKit";
import { SectionIntro } from "./CentreBits";
import type { CentrePageProps } from "./CentreConsole";

const STATUS_TONE: Record<TermStatus, Tone> = { planned: "info", current: "ok", closed: "muted" };
const DAY = 86400000;

export function OrgTermsPage({ orgId, access, nav }: CentrePageProps) {
  const terms = useLoad(() => orgTermList(orgId), [orgId]);
  const [sel, setSel] = React.useState<string | null>(null);
  const [edit, setEdit] = React.useState<TermRow | "new" | null>(null);
  const [copy, setCopy] = React.useState<TermRow | null>(null);
  const [confirm, setConfirm] = React.useState<ConfirmSpec | null>(null);
  const canManage = access.can("org.terms.manage");
  const list = terms.data ?? [];
  const selected = list.find((t) => t.id === sel) ?? list.find((t) => t.status === "current") ?? list[0] ?? null;
  const reload = () => void terms.reload();

  return (
    <>
      <SectionIntro
        text="ترم‌ها و تقویم آموزشی مرکز. بازه‌های «اجباری» را سرور با ساعت خودش اجرا می‌کند؛ مثلاً بیرون از بازه‌ی ثبت‌نام و حذف و اضافه، ثبت‌نام بسته است مگر با دلیل و ثبت در لاگ."
        meta={terms.data && <>{faNum(list.filter((t) => t.status !== "closed").length)} ترم باز · {faNum(list.length)} ترم</>}
        actions={<>
          {canManage && <Btn kind="primary" icon={Plus} onClick={() => setEdit("new")}>ترم تازه</Btn>}
          {nav.has("classes") && <Btn onClick={() => nav.go("classes")}>کلاس‌ها</Btn>}
          <RefreshBtn onClick={reload} busy={terms.busy} at={terms.at} />
        </>} />

      {terms.error ? <Notice tone="bad" title="ترم‌ها خوانده نشد">{orgTeachingError(terms.error)}</Notice>
        : terms.data === null ? <div className="h-80 animate-pulse rounded-xl bg-muted/50" />
        : !list.length ? (
          <Panel><EmptyState icon={CalendarDays} title="هنوز ترمی نساخته‌اید"
            text="اولین ترم را بسازید، تقویمش را تنظیم کنید و بعد درس‌ها و کلاس‌ها را به آن اضافه کنید."
            action={canManage ? <Btn kind="primary" icon={Plus} onClick={() => setEdit("new")}>ترم تازه</Btn> : undefined} /></Panel>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
            <ul className="space-y-2">
              {list.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => setSel(t.id)}
                    className={cx("w-full rounded-xl border bg-card p-3 text-start shadow-sm transition-colors",
                      selected?.id === t.id ? "border-bronze/60 ring-2 ring-bronze/15" : "border-border hover:border-bronze/40")}>
                    <div className="flex items-center justify-between gap-2">
                      <b className="truncate text-[13.5px]">{t.title}</b>
                      <Badge tone={STATUS_TONE[t.status]} dot>{TERM_STATUS_LABEL[t.status]}</Badge>
                    </div>
                    <p className="mt-1 text-[11.5px] text-muted-foreground">{faDay(t.starts_on)} تا {faDay(t.ends_on)}</p>
                    <p className="mt-1 text-[11.5px] text-muted-foreground">{faNum(t.classes)} کلاس · {faNum(t.students)} دانشجو{t.waitlisted ? ` · ${faNum(t.waitlisted)} در انتظار` : ""}</p>
                    {t.open_now.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {t.open_now.map((k) => <span key={k} className="rounded px-1.5 py-0.5 text-[10.5px] font-bold text-white" style={{ background: DATE_KIND[k]?.color }}>{DATE_KIND[k]?.label} باز</span>)}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            {selected && (
              <TermDetail key={selected.id} orgId={orgId} term={selected} canManage={canManage} onChanged={reload}
                onEdit={() => setEdit(selected)} onCopy={() => setCopy(selected)} onConfirm={setConfirm}
                onClasses={nav.has("classes") ? () => nav.go("classes") : undefined} />
            )}
          </div>
        )}

      {edit && <TermEditor orgId={orgId} term={edit === "new" ? null : edit} onClose={() => setEdit(null)}
        onSaved={(id) => { setEdit(null); setSel(id); reload(); }} />}
      {copy && <TermCopyDrawer term={copy} canClasses={access.can("org.classes.manage")} onClose={() => setCopy(null)}
        onDone={(id) => { setCopy(null); setSel(id); reload(); }} />}
      <ConfirmDialog spec={confirm} onClose={() => setConfirm(null)} onDone={reload} errorText={orgTeachingError} />
    </>
  );
}

function TermDetail({ orgId, term, canManage, onChanged, onEdit, onCopy, onConfirm, onClasses }: {
  orgId: string; term: TermRow; canManage: boolean; onChanged: () => void; onEdit: () => void; onCopy: () => void;
  onConfirm: (c: ConfirmSpec) => void; onClasses?: () => void;
}) {
  const closed = term.status === "closed";
  return (
    <div className="min-w-0 space-y-4">
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><CalendarDays className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <h3 className="flex flex-wrap items-center gap-2 font-display text-[18px] font-extrabold">{term.title}
              <Badge tone={STATUS_TONE[term.status]} dot>{TERM_STATUS_LABEL[term.status]}</Badge>
              {term.code && <span dir="ltr" className="rounded bg-muted px-1.5 text-[11px] font-mono">{term.code}</span>}</h3>
            <p className="mt-1 text-[12px] text-muted-foreground">{faDay(term.starts_on)} تا {faDay(term.ends_on)}
              {term.copied_from_title && <> · کپی از «{term.copied_from_title}»</>}</p>
            {term.note && <p className="mt-1 text-[12px] text-muted-foreground">{term.note}</p>}
          </div>
          {canManage && (
            <div className="flex flex-wrap gap-1.5">
              <Btn size="sm" icon={Pencil} onClick={onEdit}>ویرایش</Btn>
              <Btn size="sm" icon={Copy} onClick={onCopy}>کپی برای ترم بعد</Btn>
              {!closed && <Btn size="sm" icon={Lock} onClick={() => onConfirm({
                title: `بستن «${term.title}»`, confirmLabel: "ببند", danger: true, needReason: true,
                text: <>همه‌ی ثبت‌نام‌های جاری این ترم «گذرانده» می‌شوند، لیست‌های انتظار پاک می‌شود و دیگر ثبت‌نامی ممکن نیست. ({faNum(term.students)} دانشجو در {faNum(term.classes)} کلاس)</>,
                run: (r) => orgTermUpsert(orgId, term.id, { title: term.title, code: term.code, starts_on: term.starts_on, ends_on: term.ends_on, status: "closed", note: term.note }, r),
              })}>بستن ترم</Btn>}
              {term.classes === 0 && <Btn size="sm" kind="danger" icon={Trash2} onClick={() => onConfirm({
                title: `حذف «${term.title}»`, confirmLabel: "حذف کن", danger: true, needReason: true,
                text: "این ترم کلاسی ندارد و با تقویمش حذف می‌شود.", run: (r) => orgTermDelete(term.id, r),
              })}>حذف</Btn>}
            </div>
          )}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[["کلاس", term.classes], ["دانشجو", term.students], ["در لیست انتظار", term.waitlisted]].map(([l, v]) => (
            <div key={l as string} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">{l}</p>
              <p className="mt-0.5 font-display text-[18px] font-extrabold tabular-nums">{faNum(v as number)}</p>
            </div>
          ))}
        </div>
        {onClasses && <div className="mt-3"><Btn size="sm" onClick={onClasses}>کلاس‌های این ترم</Btn></div>}
      </section>
      <CalendarPanel term={term} canManage={canManage && !closed} onSaved={onChanged} />
    </div>
  );
}

function Timeline({ term, dates }: { term: TermRow; dates: TermDate[] }) {
  const pts = [
    ...dates.flatMap((d) => [new Date(d.starts_at).getTime(), new Date(d.ends_at).getTime()]),
    term.starts_on ? new Date(`${term.starts_on}T00:00:00`).getTime() : NaN,
    term.ends_on ? new Date(`${term.ends_on}T23:59:59`).getTime() : NaN,
  ].filter((n) => Number.isFinite(n));
  if (pts.length < 2) return <p className="text-[12px] text-muted-foreground">برای دیدن خط زمانی، تاریخ شروع و پایان ترم یا چند بازه وارد کنید.</p>;
  const lo = Math.min(...pts) - DAY;
  const hi = Math.max(...pts) + DAY;
  const pos = (t: number) => `${((t - lo) / (hi - lo)) * 100}%`;
  const now = Date.now();
  const rows = [...dates].filter((d) => new Date(d.ends_at) > new Date(d.starts_at)).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return (
    <div className="space-y-1.5" dir="ltr">
      {term.starts_on && term.ends_on && (
        <div className="relative h-5 rounded bg-muted/60">
          <div className="absolute inset-y-0 rounded bg-primary/15" style={{ left: pos(new Date(`${term.starts_on}T00:00:00`).getTime()), right: `calc(100% - ${pos(new Date(`${term.ends_on}T23:59:59`).getTime())})` }} />
          <span className="absolute inset-y-0 end-2 flex items-center text-[10.5px] font-bold text-muted-foreground" dir="rtl">ترم</span>
        </div>
      )}
      {rows.map((d, i) => {
        const a = new Date(d.starts_at).getTime();
        const b = new Date(d.ends_at).getTime();
        const k = DATE_KIND[d.kind];
        return (
          <div key={i} className="relative h-6 rounded bg-muted/30" title={`${k?.label} · ${faDay(d.starts_at)} تا ${faDay(d.ends_at)}`}>
            <div className="absolute inset-y-0.5 flex min-w-[6px] items-center overflow-hidden rounded px-1.5 text-[10.5px] font-bold text-white"
              style={{ left: pos(a), width: `max(6px, calc(${pos(b)} - ${pos(a)}))`, background: k?.color, opacity: d.enforce || !k?.enforceable ? 1 : 0.55 }}>
              <span className="truncate" dir="rtl">{d.title || k?.label}</span>
            </div>
          </div>
        );
      })}
      {now > lo && now < hi && (
        <div className="relative h-4"><div className="absolute top-0 h-4 w-0.5 bg-red-500" style={{ left: pos(now) }} />
          <span className="absolute top-0 ms-1 text-[10px] font-bold text-red-600" style={{ left: pos(now) }}>امروز</span></div>
      )}
    </div>
  );
}

function template(term: TermRow): TermDate[] {
  if (!term.starts_on || !term.ends_on) return [];
  const s = new Date(`${term.starts_on}T08:00:00`).getTime();
  const e = new Date(`${term.ends_on}T20:00:00`).getTime();
  const at = (t: number) => new Date(t).toISOString();
  const weeks = Math.max(4, Math.round((e - s) / (7 * DAY)));
  const mid = s + Math.floor(weeks / 2) * 7 * DAY;
  return [
    { kind: "registration", title: "", starts_at: at(s - 10 * DAY), ends_at: at(s - DAY), enforce: true },
    { kind: "add_drop", title: "", starts_at: at(s + 7 * DAY), ends_at: at(s + 14 * DAY), enforce: true },
    { kind: "classes", title: "", starts_at: at(s), ends_at: at(e - 14 * DAY), enforce: false },
    { kind: "midterms", title: "", starts_at: at(mid), ends_at: at(mid + 7 * DAY), enforce: false },
    { kind: "exams", title: "", starts_at: at(e - 14 * DAY), ends_at: at(e), enforce: false },
    { kind: "grade_entry", title: "", starts_at: at(e - 14 * DAY), ends_at: at(e + 10 * DAY), enforce: true },
    { kind: "appeals", title: "", starts_at: at(e + 3 * DAY), ends_at: at(e + 17 * DAY), enforce: true },
  ];
}

function CalendarPanel({ term, canManage, onSaved }: { term: TermRow; canManage: boolean; onSaved: () => void }) {
  const [rows, setRows] = React.useState<TermDate[]>(term.dates);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  React.useEffect(() => { setRows(term.dates); }, [term.dates]);
  const dirty = JSON.stringify(rows) !== JSON.stringify(term.dates);
  const bad = rows.some((r) => !r.starts_at || !r.ends_at || new Date(r.ends_at) <= new Date(r.starts_at));
  const set = (i: number, p: Partial<TermDate>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  async function save() {
    setBusy(true); setErr("");
    try { await orgTermDatesSave(term.id, rows); onSaved(); } catch (e) { setErr(orgTeachingError(e)); } finally { setBusy(false); }
  }
  return (
    <Panel title="تقویم آموزشی" icon={CalendarPlus}
      description="بازه‌های اجباری با ساعت سرور اجرا می‌شوند؛ کم‌رنگ = فقط نمایشی"
      actions={canManage ? <div className="flex gap-1.5">
        {!rows.length && term.starts_on && term.ends_on && <Btn size="sm" icon={Wand2} onClick={() => setRows(template(term))}>الگوی پیشنهادی</Btn>}
        <Btn size="sm" icon={Plus} onClick={() => setRows([...rows, { kind: "other", title: "", starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 7 * DAY).toISOString(), enforce: false }])}>بازه</Btn>
      </div> : undefined}>
      <Timeline term={term} dates={rows} />
      {rows.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-[12.5px]">
            <thead><tr className="text-start text-[11px] text-muted-foreground">
              <th className="px-1 py-1.5 text-start font-bold">نوع</th><th className="px-1 py-1.5 text-start font-bold">عنوان</th>
              <th className="px-1 py-1.5 text-start font-bold">از</th><th className="px-1 py-1.5 text-start font-bold">تا</th>
              <th className="px-1 py-1.5 text-start font-bold">اجباری</th><th />
            </tr></thead>
            <tbody>
              {rows.map((r, i) => {
                const k = DATE_KIND[r.kind];
                const wrong = new Date(r.ends_at) <= new Date(r.starts_at);
                return (
                  <tr key={i} className="border-t border-border/60">
                    <td className="px-1 py-1.5">
                      {canManage ? (
                        <select aria-label="نوع" value={r.kind} onChange={(e) => set(i, { kind: e.target.value as DateKind, enforce: DATE_KIND[e.target.value as DateKind]?.enforceable ? r.enforce : false })} className={cx(inputCls, "h-8 w-36")}>
                          {DATE_KINDS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                        </select>
                      ) : <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: k?.color }} />{k?.label}</span>}
                    </td>
                    <td className="px-1 py-1.5">{canManage ? <input aria-label="عنوان" value={r.title} maxLength={80} onChange={(e) => set(i, { title: e.target.value })} placeholder={k?.label} className={cx(inputCls, "h-8 w-full min-w-[120px]")} /> : r.title || "—"}</td>
                    <td className="px-1 py-1.5">{canManage ? <input type="datetime-local" dir="ltr" aria-label="از" value={toLocalInput(r.starts_at)} onChange={(e) => set(i, { starts_at: fromLocalInput(e.target.value) ?? r.starts_at })} className={cx(inputCls, "h-8")} /> : null}
                      <span className="block text-[10.5px] text-muted-foreground">{faDay(r.starts_at)}</span></td>
                    <td className="px-1 py-1.5">{canManage ? <input type="datetime-local" dir="ltr" aria-label="تا" value={toLocalInput(r.ends_at)} onChange={(e) => set(i, { ends_at: fromLocalInput(e.target.value) ?? r.ends_at })} className={cx(inputCls, "h-8", wrong && "border-red-500")} /> : null}
                      <span className="block text-[10.5px] text-muted-foreground">{faDay(r.ends_at)}</span></td>
                    <td className="px-1 py-1.5 text-center">
                      {k?.enforceable ? <input type="checkbox" aria-label="اجباری" disabled={!canManage} checked={r.enforce} onChange={(e) => set(i, { enforce: e.target.checked })} /> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-1 py-1.5">{canManage && <button type="button" aria-label="حذف" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"><Trash2 className="h-4 w-4" /></button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!rows.length && <p className="mt-3 text-[12px] text-muted-foreground">هنوز بازه‌ای تعریف نشده؛ بدون بازه‌ی اجباری، ثبت‌نام همیشه باز است.</p>}
      {err && <div className="mt-3"><Notice tone="bad" title="ذخیره نشد">{err}</Notice></div>}
      {canManage && dirty && (
        <div className="mt-3 flex justify-end gap-2">
          <Btn size="sm" icon={Undo2} onClick={() => setRows(term.dates)}>برگرداندن</Btn>
          <Btn size="sm" kind="primary" icon={Save} busy={busy} disabled={bad} onClick={() => void save()}>ذخیره‌ی تقویم</Btn>
        </div>
      )}
    </Panel>
  );
}

function TermEditor({ orgId, term, onClose, onSaved }: { orgId: string; term: TermRow | null; onClose: () => void; onSaved: (id: string) => void }) {
  const [title, setTitle] = React.useState(term?.title ?? "");
  const [code, setCode] = React.useState(term?.code ?? "");
  const [starts, setStarts] = React.useState(term?.starts_on ?? "");
  const [ends, setEnds] = React.useState(term?.ends_on ?? "");
  const [status, setStatus] = React.useState<TermStatus>(term?.status ?? "planned");
  const [note, setNote] = React.useState(term?.note ?? "");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const ok = title.trim().length >= 1 && (!starts || !ends || ends >= starts);
  async function save() {
    setBusy(true); setErr("");
    try {
      const id = await orgTermUpsert(orgId, term?.id ?? null, { title: title.trim(), code: code.trim(), starts_on: starts || null, ends_on: ends || null, status, note: note.trim() });
      onSaved(id);
    } catch (e) { setErr(orgTeachingError(e)); } finally { setBusy(false); }
  }
  return (
    <Drawer open onClose={onClose} width={520} title={term ? `ویرایش «${term.title}»` : "ترم تازه"}
      footer={<div className="flex justify-end gap-2"><Btn onClick={onClose}>انصراف</Btn><Btn kind="primary" busy={busy} disabled={!ok} onClick={() => void save()}>{term ? "ذخیره" : "ساخت"}</Btn></div>}>
      <div className="space-y-4">
        <label className="block space-y-1"><span className="text-[12px] font-bold">عنوان</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} autoFocus placeholder="مثلاً نیم‌سال اول ۱۴۰۵-۱۴۰۶" className={cx(inputCls, "w-full")} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1"><span className="text-[12px] font-bold">کد (اختیاری)</span>
            <input dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} maxLength={30} placeholder="1405-1" className={cx(inputCls, "w-full")} /></label>
          <label className="block space-y-1"><span className="text-[12px] font-bold">وضعیت</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as TermStatus)} className={cx(inputCls, "w-full")}>
              {(["planned", "current", "closed"] as const).map((s) => <option key={s} value={s}>{TERM_STATUS_LABEL[s]}</option>)}
            </select></label>
          <label className="block space-y-1"><span className="text-[12px] font-bold">شروع</span>
            <input type="date" dir="ltr" value={starts} onChange={(e) => setStarts(e.target.value)} className={cx(inputCls, "w-full")} />
            <span className="text-[11px] text-muted-foreground">{faDay(starts || null)}</span></label>
          <label className="block space-y-1"><span className="text-[12px] font-bold">پایان</span>
            <input type="date" dir="ltr" value={ends} onChange={(e) => setEnds(e.target.value)} className={cx(inputCls, "w-full")} />
            <span className="text-[11px] text-muted-foreground">{faDay(ends || null)}</span></label>
        </div>
        <label className="block space-y-1"><span className="text-[12px] font-bold">یادداشت</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={2} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-bronze" /></label>
        {status === "closed" && term?.status !== "closed" && <Notice tone="warn" title="بستن ترم">ثبت‌نام‌های جاری «گذرانده» می‌شوند و لیست‌های انتظار پاک می‌شود.</Notice>}
        {err && <Notice tone="bad" title="ذخیره نشد">{err}</Notice>}
      </div>
    </Drawer>
  );
}

function TermCopyDrawer({ term, canClasses, onClose, onDone }: { term: TermRow; canClasses: boolean; onClose: () => void; onDone: (id: string) => void }) {
  const shift = (d: string | null, days: number) => {
    if (!d) return "";
    const t = new Date(`${d}T12:00:00`);
    t.setDate(t.getDate() + days);
    return t.toISOString().slice(0, 10);
  };
  const len = term.starts_on && term.ends_on ? Math.round((new Date(term.ends_on).getTime() - new Date(term.starts_on).getTime()) / DAY) : 120;
  const [title, setTitle] = React.useState(`${term.title} (کپی)`.slice(0, 60));
  const [code, setCode] = React.useState("");
  const [starts, setStarts] = React.useState(shift(term.ends_on, 30));
  const [ends, setEnds] = React.useState(shift(term.ends_on, 30 + len));
  const [opts, setOpts] = React.useState({ copy_classes: canClasses, copy_teachers: true, copy_capacity: true, copy_content: true, copy_dates: true });
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [done, setDone] = React.useState<{ term_id: string; classes: number; dates: number; content: number } | null>(null);
  async function go() {
    setBusy(true); setErr("");
    try {
      setDone(await orgTermCopy(term.id, { title: title.trim(), code: code.trim(), starts_on: starts || null, ends_on: ends || null, status: "planned", ...opts }));
    } catch (e) { setErr(orgTeachingError(e)); } finally { setBusy(false); }
  }
  const box = (k: keyof typeof opts, label: string, hint: string, disabled = false) => (
    <label className={cx("flex items-start gap-2.5 rounded-lg px-2 py-1.5", disabled ? "opacity-50" : "cursor-pointer hover:bg-muted/50")}>
      <input type="checkbox" className="mt-0.5" disabled={disabled} checked={opts[k]} onChange={(e) => setOpts({ ...opts, [k]: e.target.checked })} />
      <span><b className="text-[12.5px]">{label}</b><span className="block text-[11px] text-muted-foreground">{hint}</span></span>
    </label>
  );
  return (
    <Drawer open onClose={onClose} width={560} title={`کپی «${term.title}»`} subtitle="ترم تازه با وضعیت «برنامه‌ریزی‌شده» ساخته می‌شود؛ دانشجوها و نمره‌ها کپی نمی‌شوند"
      footer={done ? <div className="flex justify-end"><Btn kind="primary" onClick={() => onDone(done.term_id)}>رفتن به ترم تازه</Btn></div>
        : <div className="flex justify-end gap-2"><Btn onClick={onClose}>انصراف</Btn><Btn kind="primary" icon={Copy} busy={busy} disabled={!title.trim() || (!!starts && !!ends && ends < starts)} onClick={() => void go()}>ساخت ترم</Btn></div>}>
      {done ? (
        <Notice tone="info" title="ترم تازه ساخته شد">{faNum(done.classes)} کلاس، {faNum(done.dates)} بازه‌ی تقویم و {faNum(done.content)} پیوند محتوا کپی شد. ثبت‌نام دانشجوها را از صفحه‌ی کلاس‌ها یا گروه‌های ورودی انجام دهید.</Notice>
      ) : (
        <div className="space-y-4">
          <label className="block space-y-1"><span className="text-[12px] font-bold">عنوان ترم تازه</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} className={cx(inputCls, "w-full")} /></label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1"><span className="text-[12px] font-bold">کد</span>
              <input dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} maxLength={30} className={cx(inputCls, "w-full")} /></label>
            <label className="block space-y-1"><span className="text-[12px] font-bold">شروع</span>
              <input type="date" dir="ltr" value={starts} onChange={(e) => setStarts(e.target.value)} className={cx(inputCls, "w-full")} /></label>
            <label className="block space-y-1"><span className="text-[12px] font-bold">پایان</span>
              <input type="date" dir="ltr" value={ends} onChange={(e) => setEnds(e.target.value)} className={cx(inputCls, "w-full")} /></label>
          </div>
          <div className="rounded-xl border border-border p-2">
            {box("copy_classes", `کلاس‌ها (${faNum(term.classes)})`, "همه‌ی کلاس‌های فعال با درس، گروه، واحد، برنامه‌ی هفتگی و مکان", !canClasses)}
            {box("copy_teachers", "استاد هر کلاس", "اگر هنوز عضو فعال مرکز باشد", !opts.copy_classes)}
            {box("copy_capacity", "ظرفیت هر کلاس", "در غیر این صورت ظرفیت پیش‌فرض درس", !opts.copy_classes)}
            {box("copy_content", "محتوای وصل به کلاس‌ها", "نوشته‌ها و دوره‌هایی که به کلاس‌ها پیوست شده‌اند", !opts.copy_classes)}
            {box("copy_dates", `تقویم (${faNum(term.dates.length)} بازه)`, "به اندازه‌ی فاصله‌ی دو تاریخ شروع جابه‌جا می‌شود", !term.starts_on || !starts)}
          </div>
          {err && <Notice tone="bad" title="کپی نشد">{err}</Notice>}
        </div>
      )}
    </Drawer>
  );
}
