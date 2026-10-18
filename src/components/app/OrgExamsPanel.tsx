"use client";
/* Official exams of one class (phase 3): list, editor with the answer key, results per student,
 * publishing results and copying scores into a grade column. Grading happens on the server. */
import * as React from "react";
import { ArrowRight, Check, Download, Eye, Plus, Save, Send, Trash2 } from "lucide-react";
import { downloadText, toCsv } from "@/lib/cloud-api/org-accounts";
import {
  ATTEMPT_STATES, GRADE_COMPONENTS, classExams, deleteExam, examForEditor, examProblem, examReport, faDateTime,
  faNum, orgClassError, releaseExam, saveExam, toLocalInput,
  type ClassExam, type ExamMeta, type ExamQuestionInput, type ExamReportRow, type GradeComponent,
} from "@/lib/cloud-api/org-classes";

const input = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";
const btn = "inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted disabled:opacity-50";
const btnMain = "inline-flex items-center gap-1 rounded-xl bg-bronze px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50";

function ErrorLine({ text }: { text: string }) {
  return text ? <p className="rounded-xl border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/30">{text}</p> : null;
}

const emptyQuestion = (): ExamQuestionInput => ({ text: "", options: ["", "", "", ""], correct: 0, points: 1, explanation: "" });

function newMeta(): ExamMeta {
  const start = new Date(Date.now() + 24 * 3600_000);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 2 * 3600_000);
  return {
    title: "", instructions: "", startsAt: start.toISOString(), endsAt: end.toISOString(), durationMin: 60,
    shuffle: true, results: "after_end", maxScore: 20, status: "draft",
  };
}

export function OrgExamsPanel({ classId, className, canEdit, isOwner }: {
  classId: string;
  className: string;
  canEdit: boolean;
  isOwner: boolean;
}) {
  const [exams, setExams] = React.useState<ClassExam[]>([]);
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [view, setView] = React.useState<{ mode: "edit"; id: string | null } | { mode: "report"; exam: ClassExam } | null>(null);

  const load = React.useCallback(async () => {
    setBusy(true);
    setErr("");
    try {
      setExams(await classExams(classId));
    } catch (e) {
      setErr(orgClassError(e));
    } finally {
      setBusy(false);
    }
  }, [classId]);
  React.useEffect(() => { void load(); }, [load]);

  if (view?.mode === "edit") {
    return <ExamEditor classId={classId} examId={view.id} canEdit={canEdit} onClose={() => { setView(null); void load(); }} />;
  }
  if (view?.mode === "report") {
    return <ExamReport exam={view.exam} className={className} canEdit={canEdit} onClose={() => { setView(null); void load(); }} />;
  }

  const remove = async (x: ClassExam) => {
    const warn = x.attempts > 0
      ? `آزمون «${x.title}» ${faNum(x.attempts, 0)} شرکت‌کننده دارد. با حذف، نتیجه‌ها برای همیشه پاک می‌شوند (فقط مالک مرکز). ادامه می‌دهید؟`
      : `آزمون «${x.title}» حذف شود؟`;
    if (!window.confirm(warn)) return;
    try {
      await deleteExam(x.id);
      void load();
    } catch (e) {
      setErr(orgClassError(e));
    }
  };

  const now = Date.now();
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-[11px] text-muted-foreground">
          آزمون رسمی با ساعت سرور برگزار و در سرور تصحیح می‌شود؛ هر دانشجو یک بار شرکت می‌کند و کلید پاسخ پیش از پایان آزمون به اپ نمی‌رسد.
        </p>
        {canEdit && <button className={btnMain} onClick={() => setView({ mode: "edit", id: null })}><Plus className="h-3.5 w-3.5" /> آزمون تازه</button>}
      </div>
      <ErrorLine text={err} />
      {!busy && !exams.length && <p className="text-xs text-muted-foreground">هنوز آزمونی برای این کلاس ساخته نشده است.</p>}
      <ul className="space-y-2">
        {exams.map((x) => {
          const over = Date.parse(x.endsAt) < now;
          return (
            <li key={x.id} className="rounded-xl border border-border p-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold">{x.title}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${x.status === "published" ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}`}>
                  {x.status === "published" ? "منتشرشده" : "پیش‌نویس"}
                </span>
                {x.releasedAt && <span className="rounded-full bg-bronze/10 px-2 py-0.5 text-[10px] font-bold text-bronze">نتیجه منتشر شد</span>}
                <span className="flex-1" />
                <button className={btn} onClick={() => setView({ mode: "report", exam: x })}><Eye className="h-3.5 w-3.5" /> نتیجه‌ها</button>
                {canEdit && <button className={btn} onClick={() => setView({ mode: "edit", id: x.id })}>{x.attempts > 0 ? "مشاهده" : "ویرایش"}</button>}
                {(x.attempts === 0 ? canEdit : isOwner) && <button className={btn} onClick={() => void remove(x)}><Trash2 className="h-3.5 w-3.5" /></button>}
              </div>
              <p className="mt-1 text-muted-foreground">
                {faDateTime(x.startsAt)} تا {faDateTime(x.endsAt)} · {faNum(x.durationMin, 0)} دقیقه · {faNum(x.questions, 0)} سؤال · از {faNum(x.maxScore)}
              </p>
              <p className="text-muted-foreground">
                {faNum(x.attempts, 0)} شرکت‌کننده · {faNum(x.submitted, 0)} تحویل · میانگین {faNum(x.avgScore)}
                {over ? " · پایان‌یافته" : ""}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ExamEditor({ classId, examId, canEdit, onClose }: { classId: string; examId: string | null; canEdit: boolean; onClose: () => void }) {
  const [meta, setMeta] = React.useState<ExamMeta>(newMeta);
  const [qs, setQs] = React.useState<ExamQuestionInput[]>([emptyQuestion()]);
  const [locked, setLocked] = React.useState(false);
  const [loaded, setLoaded] = React.useState(!examId);
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [id, setId] = React.useState<string | null>(examId);

  React.useEffect(() => {
    if (!examId) return;
    let alive = true;
    examForEditor(examId).then((r) => {
      if (!alive) return;
      setMeta(r.meta);
      setQs(r.questions.length ? r.questions : [emptyQuestion()]);
      setLocked(r.locked);
      setLoaded(true);
    }).catch((e) => { if (alive) setErr(orgClassError(e)); });
    return () => { alive = false; };
  }, [examId]);

  const readOnly = locked || !canEdit;
  const setQ = (i: number, patch: Partial<ExamQuestionInput>) => setQs(qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const save = async (status: "draft" | "published") => {
    const m = { ...meta, status };
    const p = examProblem(m, qs);
    if (p) { setErr(p); return; }
    if (status === "published" && !window.confirm("آزمون منتشر شود؟ دانشجوهای کلاس آن را در فهرست آزمون‌هایشان می‌بینند و از زمان شروع می‌توانند شرکت کنند.")) return;
    setBusy(true);
    setErr("");
    try {
      const newId = await saveExam(classId, id, m, qs);
      setId(newId);
      setMeta(m);
      if (status === "published") onClose();
    } catch (e) {
      setErr(orgClassError(e));
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return <div className="space-y-2"><ErrorLine text={err} /><p className="text-xs text-muted-foreground">در حال بارگذاری…</p></div>;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button className={btn} onClick={onClose}><ArrowRight className="h-3.5 w-3.5" /> آزمون‌ها</button>
        <span className="flex-1 text-sm font-bold">{id ? "ویرایش آزمون" : "آزمون تازه"}</span>
        {!readOnly && (
          <>
            <button className={btn} onClick={() => void save("draft")} disabled={busy}><Save className="h-3.5 w-3.5" /> ذخیرهٔ پیش‌نویس</button>
            <button className={btnMain} onClick={() => void save("published")} disabled={busy}><Send className="h-3.5 w-3.5" /> انتشار</button>
          </>
        )}
      </div>
      {locked && <p className="rounded-xl bg-muted p-2 text-xs">دانشجوها آزمون را شروع کرده‌اند؛ برای منصفانه ماندن، دیگر نمی‌شود آن را تغییر داد.</p>}
      <ErrorLine text={err} />
      <fieldset disabled={readOnly} className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs sm:col-span-2">عنوان
          <input className={input} value={meta.title} maxLength={140} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
        </label>
        <label className="text-xs sm:col-span-2">توضیح برای دانشجو
          <textarea className={`${input} h-16`} value={meta.instructions} maxLength={2000} onChange={(e) => setMeta({ ...meta, instructions: e.target.value })} />
        </label>
        <label className="text-xs">شروع (ساعت همین دستگاه)
          <input type="datetime-local" className={input} value={toLocalInput(meta.startsAt)}
            onChange={(e) => setMeta({ ...meta, startsAt: e.target.value ? new Date(e.target.value).toISOString() : "" })} />
        </label>
        <label className="text-xs">پایان (آخرین لحظهٔ شروع و تحویل)
          <input type="datetime-local" className={input} value={toLocalInput(meta.endsAt)}
            onChange={(e) => setMeta({ ...meta, endsAt: e.target.value ? new Date(e.target.value).toISOString() : "" })} />
        </label>
        <label className="text-xs">مدت پاسخ‌گویی (دقیقه)
          <input type="number" min={1} max={600} className={input} value={meta.durationMin}
            onChange={(e) => setMeta({ ...meta, durationMin: Number(e.target.value) || 0 })} />
        </label>
        <label className="text-xs">نمرهٔ کل
          <input type="number" min={1} max={100} step={0.25} className={input} value={meta.maxScore}
            onChange={(e) => setMeta({ ...meta, maxScore: Number(e.target.value) || 0 })} />
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={meta.shuffle} onChange={(e) => setMeta({ ...meta, shuffle: e.target.checked })} /> ترتیب سؤال‌ها برای هر دانشجو جدا باشد
        </label>
        <label className="text-xs">نمایش نتیجه و پاسخ‌نامه
          <select className={input} value={meta.results} onChange={(e) => setMeta({ ...meta, results: e.target.value === "manual" ? "manual" : "after_end" })}>
            <option value="after_end">خودکار بعد از پایان آزمون</option>
            <option value="manual">وقتی خودم منتشر کنم</option>
          </select>
        </label>
      </fieldset>
      <ol className="space-y-3">
        {qs.map((q, i) => (
          <li key={i} className="space-y-2 rounded-xl border border-border p-3">
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="flex-1">سؤال {faNum(i + 1, 0)}</span>
              <label className="flex items-center gap-1 font-normal">نمره
                <input type="number" min={0.25} max={100} step={0.25} disabled={readOnly} className="w-16 rounded-lg border border-border bg-background px-2 py-1"
                  value={q.points} onChange={(e) => setQ(i, { points: Number(e.target.value) || 0 })} />
              </label>
              {!readOnly && qs.length > 1 && <button className={btn} onClick={() => setQs(qs.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></button>}
            </div>
            <textarea className={`${input} h-16`} disabled={readOnly} maxLength={4000} placeholder="متن سؤال" value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} />
            {q.options.map((o, j) => (
              <div key={j} className="flex items-center gap-2">
                <input type="radio" name={`correct-${i}`} disabled={readOnly} checked={q.correct === j} onChange={() => setQ(i, { correct: j })} title="گزینهٔ درست" />
                <input className={input} disabled={readOnly} maxLength={500} placeholder={`گزینهٔ ${faNum(j + 1, 0)}`} value={o}
                  onChange={(e) => setQ(i, { options: q.options.map((x, k) => (k === j ? e.target.value : x)) })} />
                {!readOnly && q.options.length > 2 && (
                  <button className="text-muted-foreground" title="حذف گزینه"
                    onClick={() => setQ(i, { options: q.options.filter((_, k) => k !== j), correct: q.correct === j ? 0 : q.correct > j ? q.correct - 1 : q.correct })}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            {!readOnly && q.options.length < 8 && <button className={btn} onClick={() => setQ(i, { options: [...q.options, ""] })}><Plus className="h-3.5 w-3.5" /> گزینه</button>}
            <textarea className={`${input} h-12`} disabled={readOnly} maxLength={2000} placeholder="پاسخ تشریحی (بعد از انتشار نتیجه به دانشجو نشان داده می‌شود)"
              value={q.explanation} onChange={(e) => setQ(i, { explanation: e.target.value })} />
          </li>
        ))}
      </ol>
      {!readOnly && qs.length < 200 && <button className={btn} onClick={() => setQs([...qs, emptyQuestion()])}><Plus className="h-3.5 w-3.5" /> سؤال تازه</button>}
    </div>
  );
}

function ExamReport({ exam, className, canEdit, onClose }: { exam: ClassExam; className: string; canEdit: boolean; onClose: () => void }) {
  const [rows, setRows] = React.useState<ExamReportRow[]>([]);
  const [err, setErr] = React.useState("");
  const [msg, setMsg] = React.useState("");
  const [comp, setComp] = React.useState<GradeComponent | "">("");
  const [busy, setBusy] = React.useState(false);
  const load = React.useCallback(async () => {
    try {
      setRows(await examReport(exam.id));
    } catch (e) {
      setErr(orgClassError(e));
    }
  }, [exam.id]);
  React.useEffect(() => { void load(); }, [load]);
  const over = Date.parse(exam.endsAt) < Date.now();
  const release = async () => {
    const label = GRADE_COMPONENTS.find((c) => c.key === comp)?.label;
    if (!window.confirm(comp ? `نتیجه منتشر شود و نمره‌ها در ستون «${label}» ثبت شوند؟` : "نتیجه و پاسخ‌نامه برای دانشجوها منتشر شود؟")) return;
    setBusy(true);
    setErr("");
    try {
      const n = await releaseExam(exam.id, comp || null);
      setMsg(comp ? `نتیجه منتشر شد و ${faNum(n, 0)} نمره ثبت شد.` : "نتیجه منتشر شد.");
      void load();
    } catch (e) {
      setErr(orgClassError(e));
    } finally {
      setBusy(false);
    }
  };
  const exportCsv = () => {
    const head = ["نام کاربری", "شماره دانشجویی", "نام", "وضعیت", "شروع", "تحویل", `نمره (از ${exam.maxScore})`];
    const body = rows.map((r) => [r.username, r.studentNo, r.fullName, ATTEMPT_STATES[r.state] ?? r.state, r.startedAt ?? "", r.submittedAt ?? "", r.score ?? ""]);
    downloadText(`exam-${exam.title.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 40)}-${className.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 30)}.csv`, toCsv([head, ...body]));
  };
  const done = rows.filter((r) => r.score !== null).map((r) => r.score as number).sort((a, b) => a - b);
  const avg = done.length ? done.reduce((a, b) => a + b, 0) / done.length : null;
  const median = done.length ? (done.length % 2 ? done[(done.length - 1) / 2] : (done[done.length / 2 - 1] + done[done.length / 2]) / 2) : null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button className={btn} onClick={onClose}><ArrowRight className="h-3.5 w-3.5" /> آزمون‌ها</button>
        <span className="flex-1 text-sm font-bold">{exam.title}</span>
        <button className={btn} onClick={exportCsv} disabled={!rows.length}><Download className="h-3.5 w-3.5" /> خروجی CSV</button>
      </div>
      <p className="text-xs text-muted-foreground">
        {faNum(done.length, 0)} نفر تحویل داده‌اند · میانگین {faNum(avg)} · میانه {faNum(median)} · از {faNum(exam.maxScore)}
      </p>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-2 text-xs">
          {over ? (
            <>
              <span>انتشار نتیجه و</span>
              <select className="rounded-lg border border-border bg-background px-2 py-1" value={comp} onChange={(e) => setComp(e.target.value as GradeComponent | "")}>
                <option value="">بدون ثبت در نمره‌ها</option>
                {GRADE_COMPONENTS.map((c) => <option key={c.key} value={c.key}>ثبت در ستون «{c.label}»</option>)}
              </select>
              <button className={btnMain} onClick={() => void release()} disabled={busy}><Check className="h-3.5 w-3.5" /> انجام بده</button>
            </>
          ) : (
            <span className="text-muted-foreground">انتشار نتیجه بعد از پایان آزمون ({faDateTime(exam.endsAt)}) فعال می‌شود.</span>
          )}
        </div>
      )}
      <ErrorLine text={err} />
      {msg && <p className="text-xs text-green-700">{msg}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="p-2 text-start">دانشجو</th><th className="p-2 text-start">وضعیت</th>
              <th className="p-2 text-start">تحویل</th><th className="p-2 text-start">نمره</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.studentId} className="border-t border-border">
                <td className="p-2">{r.fullName || r.username} <span className="text-muted-foreground" dir="ltr">{r.studentNo}</span></td>
                <td className="p-2">{ATTEMPT_STATES[r.state] ?? r.state}</td>
                <td className="p-2">{faDateTime(r.submittedAt)}</td>
                <td className="p-2 font-bold">{faNum(r.score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
