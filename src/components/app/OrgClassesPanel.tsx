"use client";
/* Centre panel, "classes" tab (phase 3, see docs/ORG_P3_SETUP.md): terms, subjects, classes,
 * enrolment, grades (manual + CSV), official exams and content attached to a class.
 * Managers see every class (student data needs a two-factor session); teachers only theirs. */
import * as React from "react";
import { ArrowRight, BookOpen, Download, FileUp, GraduationCap, Plus, RefreshCw, Save, Trash2, Users } from "lucide-react";
import { MfaPanel } from "./MfaPanel";
import { sbSelect, inList } from "@/lib/cloud-api/rest";
import { downloadText } from "@/lib/cloud-api/org-accounts";
import { visibilityLabel } from "@/lib/cloud-api/visibility";
import {
  ENROLLMENT_LABELS, ENROLL_RESULTS, GRADE_COMPONENTS, GRADE_RESULTS, SOURCE_LABELS, TERM_STATUSES,
  classContent, classDisplayName, classGradeIds, classList, classStudents, deleteClass, deleteGrades, enroll,
  faNum, gpaFromCsv, gradesCsv, gradesFromCsv, listCourses, listTerms, myOrgItems, orgClassError, saveClass,
  saveCourse, saveTerm, setClassContent, upsertGrades, upsertPriorGpa,
  type ClassContent, type ClassRow, type ClassStudent, type Course, type GradeComponent, type Term, type TermStatus,
} from "@/lib/cloud-api/org-classes";
import { OrgExamsPanel } from "./OrgExamsPanel";
import { ClassActivityPanel } from "./ClassActivityPanel"; // فاز ۴ — فعالیت کلاس (بستهٔ همکار)

const input = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";
const btn = "inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted disabled:opacity-50";
const btnMain = "inline-flex items-center gap-1 rounded-xl bg-bronze px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50";

function ErrorLine({ text }: { text: string }) {
  /* خطای «ورود دومرحله‌ای» (aal2) → همان UI فاز ۱: ثبت/تأیید TOTP (docs/ORG_P3_SETUP.md) */
  if (/دومرحله|دو مرحله|mfa/i.test(text)) return <MfaPanel compact />;
  return text ? <p className="rounded-xl border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/30">{text}</p> : null;
}

async function readFile(f: File): Promise<string> {
  if (f.size > 5 * 1024 * 1024) throw new Error("حجم فایل بیش از ۵ مگابایت است.");
  return await f.text();
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function activeMembers(orgId: string): Promise<{ id: string; name: string }[]> {
  const rows = await sbSelect<any>("lexa_org_members", `org_id=eq.${orgId}&status=eq.active&select=user_id,role,title&limit=1000`);
  if (!rows.length) return [];
  const ids = rows.map((r) => r.user_id as string);
  const profiles: any[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    profiles.push(...(await sbSelect<any>("lexa_profiles", `id=${inList(ids.slice(i, i + 100))}&select=id,display_name,username`)));
  }
  const byId = new Map(profiles.map((p) => [p.id as string, (p.display_name || p.username || "") as string]));
  return ids.map((id) => ({ id, name: byId.get(id) || id.slice(0, 8) })).sort((a, b) => a.name.localeCompare(b.name, "fa"));
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function OrgClassesPanel({ orgId, orgName, canManage, isOwner = false }: {
  orgId: string;
  orgName: string;
  /** owner / manager of the centre (or Lexa admin) */
  canManage: boolean;
  /** owner of the centre (or Lexa admin): may delete classes and grades */
  isOwner?: boolean;
}) {
  const [terms, setTerms] = React.useState<Term[]>([]);
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [classes, setClasses] = React.useState<ClassRow[]>([]);
  const [members, setMembers] = React.useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [open, setOpen] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<"" | "term" | "course" | "class" | "gpa">("");

  const load = React.useCallback(async () => {
    setBusy(true);
    setErr("");
    try {
      const [t, c, k] = await Promise.all([listTerms(orgId), listCourses(orgId), classList(orgId)]);
      setTerms(t);
      setCourses(c);
      setClasses(k);
      if (canManage) setMembers(await activeMembers(orgId));
    } catch (e) {
      setErr(orgClassError(e));
    } finally {
      setBusy(false);
    }
  }, [orgId, canManage]);
  React.useEffect(() => { void load(); }, [load]);

  const cls = classes.find((c) => c.id === open);
  if (cls) {
    return <ClassDetail cls={cls} orgId={orgId} canManage={canManage} isOwner={isOwner}
      onBack={() => { setOpen(null); void load(); }} onDeleted={() => { setOpen(null); void load(); }} />;
  }

  const byTerm = new Map<string, ClassRow[]>();
  for (const c of classes) byTerm.set(c.termId, [...(byTerm.get(c.termId) ?? []), c]);

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-1 text-sm font-bold"><GraduationCap className="h-4 w-4" /> کلاس‌های {orgName}</h3>
        <span className="flex-1" />
        <button className={btn} onClick={() => void load()} disabled={busy}><RefreshCw className="h-3.5 w-3.5" /> تازه‌سازی</button>
        {canManage && (
          <>
            <button className={btn} onClick={() => setForm(form === "term" ? "" : "term")}><Plus className="h-3.5 w-3.5" /> ترم</button>
            <button className={btn} onClick={() => setForm(form === "course" ? "" : "course")}><Plus className="h-3.5 w-3.5" /> درس</button>
            <button className={btnMain} onClick={() => setForm(form === "class" ? "" : "class")} disabled={!terms.length || !courses.length}>
              <Plus className="h-3.5 w-3.5" /> کلاس
            </button>
            <button className={btn} onClick={() => setForm(form === "gpa" ? "" : "gpa")}><FileUp className="h-3.5 w-3.5" /> معدل قبلی</button>
          </>
        )}
      </div>
      <ErrorLine text={err} />
      {canManage && form === "term" && <TermForm orgId={orgId} terms={terms} onDone={() => { setForm(""); void load(); }} />}
      {canManage && form === "course" && <CourseForm orgId={orgId} onDone={() => { setForm(""); void load(); }} />}
      {canManage && form === "class" && (
        <ClassForm orgId={orgId} terms={terms} courses={courses} members={members} onDone={() => { setForm(""); void load(); }} />
      )}
      {canManage && form === "gpa" && <PriorGpaImport orgId={orgId} onDone={() => setForm("")} />}
      {canManage && (!terms.length || !courses.length) && (
        <p className="text-xs text-muted-foreground">برای ساختن کلاس، اول یک ترم و یک درس تعریف کنید.</p>
      )}
      {!busy && !classes.length && <p className="text-sm text-muted-foreground">هنوز کلاسی {canManage ? "تعریف نشده" : "به شما سپرده نشده"} است.</p>}
      {terms.filter((t) => byTerm.has(t.id)).map((t) => (
        <section key={t.id} className="space-y-2">
          <h4 className="text-xs font-bold text-muted-foreground">
            {t.title} · {TERM_STATUSES.find((s) => s.key === t.status)?.label}
          </h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {(byTerm.get(t.id) ?? []).map((c) => (
              <button key={c.id} onClick={() => setOpen(c.id)}
                className={`rounded-xl border p-3 text-start text-sm hover:border-bronze ${c.status === "archived" ? "opacity-60" : ""}`}>
                <span className="block font-bold">{classDisplayName(c)}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {c.courseCode ? `${c.courseCode} · ` : ""}{c.teacherName || "بدون مدرس"} · {faNum(c.students, 0)} دانشجو · {faNum(c.exams, 0)} آزمون
                  {c.status === "archived" ? " · بایگانی" : ""}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TermForm({ orgId, terms, onDone }: { orgId: string; terms: Term[]; onDone: () => void }) {
  const [id, setId] = React.useState("");
  const cur = terms.find((t) => t.id === id);
  const [title, setTitle] = React.useState("");
  const [startsOn, setStartsOn] = React.useState("");
  const [endsOn, setEndsOn] = React.useState("");
  const [status, setStatus] = React.useState<TermStatus>("current");
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    setTitle(cur?.title ?? "");
    setStartsOn(cur?.startsOn ?? "");
    setEndsOn(cur?.endsOn ?? "");
    setStatus(cur?.status ?? "current");
  }, [cur]);
  const save = async () => {
    if (!title.trim()) { setErr("نام ترم را بنویسید (مثلاً «نیمسال اول ۱۴۰۴-۱۴۰۵»)."); return; }
    if (status === "closed" && cur?.status !== "closed"
        && !window.confirm("با بستن ترم، کلاس‌های آن برای دانشجوها «گذرانده» می‌شوند. ادامه می‌دهید؟")) return;
    setBusy(true);
    setErr("");
    try {
      await saveTerm(orgId, { id: id || null, title, startsOn, endsOn, status });
      onDone();
    } catch (e) {
      setErr(orgClassError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <select className={input} value={id} onChange={(e) => setId(e.target.value)}>
        <option value="">ترم تازه</option>
        {terms.map((t) => <option key={t.id} value={t.id}>ویرایش: {t.title}</option>)}
      </select>
      <input className={input} placeholder="نام ترم" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs">شروع<input type="date" className={input} value={startsOn} onChange={(e) => setStartsOn(e.target.value)} /></label>
        <label className="text-xs">پایان<input type="date" className={input} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} /></label>
        <label className="text-xs">وضعیت
          <select className={input} value={status} onChange={(e) => setStatus(e.target.value as TermStatus)}>
            {TERM_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
      </div>
      <ErrorLine text={err} />
      <button className={btnMain} onClick={() => void save()} disabled={busy}><Save className="h-3.5 w-3.5" /> ذخیره</button>
    </div>
  );
}

function CourseForm({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const [code, setCode] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [units, setUnits] = React.useState("2");
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const save = async () => {
    if (!title.trim()) { setErr("نام درس را بنویسید."); return; }
    setBusy(true);
    setErr("");
    try {
      await saveCourse(orgId, { code, title, units: Number(units) || 0 });
      onDone();
    } catch (e) {
      setErr(orgClassError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-4">
      <input className={`${input} sm:col-span-2`} placeholder="نام درس (مثلاً حقوق مدنی ۷)" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
      <input className={input} placeholder="کد درس (اختیاری)" value={code} maxLength={30} onChange={(e) => setCode(e.target.value)} />
      <input className={input} type="number" min={0} max={30} step={0.5} placeholder="واحد" value={units} onChange={(e) => setUnits(e.target.value)} />
      <div className="sm:col-span-4"><ErrorLine text={err} /></div>
      <button className={btnMain} onClick={() => void save()} disabled={busy}><Save className="h-3.5 w-3.5" /> ذخیره</button>
    </div>
  );
}

function ClassForm({ orgId, terms, courses, members, initial, onDone }: {
  orgId: string;
  terms: Term[];
  courses: Course[];
  members: { id: string; name: string }[];
  initial?: ClassRow;
  onDone: () => void;
}) {
  const [termId, setTermId] = React.useState(initial?.termId ?? terms.find((t) => t.status === "current")?.id ?? terms[0]?.id ?? "");
  const [courseId, setCourseId] = React.useState(initial?.courseId ?? courses[0]?.id ?? "");
  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [teacherId, setTeacherId] = React.useState(initial?.teacherId ?? "");
  const [externalId, setExternalId] = React.useState(initial?.externalId ?? "");
  const [archived, setArchived] = React.useState(initial?.status === "archived");
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const save = async () => {
    setBusy(true);
    setErr("");
    try {
      await saveClass(orgId, { id: initial?.id ?? null, termId, courseId, title, teacherId: teacherId || null, externalId, status: archived ? "archived" : "active" });
      onDone();
    } catch (e) {
      setErr(orgClassError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-2">
      <label className="text-xs">ترم
        <select className={input} value={termId} onChange={(e) => setTermId(e.target.value)}>
          {terms.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
      </label>
      <label className="text-xs">درس
        <select className={input} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.code ? `${c.code} · ` : ""}{c.title}</option>)}
        </select>
      </label>
      <label className="text-xs">نام گروه (اختیاری، مثلاً «گروه ۲»)
        <input className={input} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="text-xs">مدرس
        <select className={input} value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
          <option value="">بدون مدرس</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </label>
      <label className="text-xs">شناسهٔ کلاس در سامانهٔ دانشگاه (اختیاری)
        <input className={input} dir="ltr" value={externalId} maxLength={80} onChange={(e) => setExternalId(e.target.value)} />
      </label>
      {initial && (
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> بایگانی (برای همه فقط‌خواندنی می‌ماند)
        </label>
      )}
      <div className="sm:col-span-2"><ErrorLine text={err} /></div>
      <button className={btnMain} onClick={() => void save()} disabled={busy || !termId || !courseId}><Save className="h-3.5 w-3.5" /> ذخیره</button>
    </div>
  );
}

function PriorGpaImport({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const [msg, setMsg] = React.useState("");
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setErr("");
    setMsg("");
    try {
      const { rows, missing } = gpaFromCsv(await readFile(f));
      if (missing.length) { setErr("فایل باید ستون «نام کاربری» یا «شماره دانشجویی» و ستون «معدل» داشته باشد."); return; }
      if (!rows.length) { setErr("ردیفی پیدا نشد."); return; }
      setBusy(true);
      const res = await upsertPriorGpa(orgId, rows);
      const ok = res.filter((r) => r.result === "saved").length;
      const bad = res.filter((r) => r.result !== "saved").map((r) => `ردیف ${faNum(r.row + 1, 0)}: ${GRADE_RESULTS[r.result] ?? r.result}`);
      setMsg(`${faNum(ok, 0)} معدل ثبت شد.${bad.length ? ` ${bad.slice(0, 20).join("، ")}` : ""}`);
    } catch (e) {
      setErr(orgClassError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2 rounded-xl border border-border p-3 text-xs">
      <p className="text-muted-foreground">
        معدل کل دانشجوها پیش از استفاده از Lexa (برای گزارش مقایسه). ستون‌ها: «نام کاربری» یا «شماره دانشجویی»، «معدل» و در صورت تمایل «تا ترم».
      </p>
      <input type="file" accept=".csv,.txt,text/csv" disabled={busy} onChange={(e) => void onFile(e.target.files?.[0])} />
      <ErrorLine text={err} />
      {msg && <p className="text-green-700">{msg}</p>}
      <button className={btn} onClick={onDone}>بستن</button>
    </div>
  );
}

type Tab = "students" | "grades" | "exams" | "content" | "activity";

function ClassDetail({ cls, orgId, canManage, isOwner, onBack, onDeleted }: {
  cls: ClassRow;
  orgId: string;
  canManage: boolean;
  isOwner: boolean;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const [tab, setTab] = React.useState<Tab>("students");
  const [students, setStudents] = React.useState<ClassStudent[]>([]);
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [terms, setTerms] = React.useState<Term[]>([]);
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [members, setMembers] = React.useState<{ id: string; name: string }[]>([]);

  const load = React.useCallback(async () => {
    setBusy(true);
    setErr("");
    try {
      setStudents(await classStudents(cls.id));
    } catch (e) {
      setErr(orgClassError(e));
    } finally {
      setBusy(false);
    }
  }, [cls.id]);
  React.useEffect(() => { void load(); }, [load]);

  const openEdit = async () => {
    try {
      const [t, c, m] = await Promise.all([listTerms(orgId), listCourses(orgId), activeMembers(orgId)]);
      setTerms(t);
      setCourses(c);
      setMembers(m);
      setEditing(true);
    } catch (e) {
      setErr(orgClassError(e));
    }
  };
  const remove = async () => {
    if (!window.confirm(`کلاس «${classDisplayName(cls)}» با همهٔ نمره‌ها و نتیجه‌های آزمون‌هایش برای همیشه حذف شود؟`)) return;
    try {
      await deleteClass(cls.id);
      onDeleted();
    } catch (e) {
      setErr(orgClassError(e));
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "students", label: "دانشجوها" },
    { key: "grades", label: "نمره‌ها" },
    { key: "exams", label: "آزمون‌های رسمی" },
    { key: "content", label: "محتوای کلاس" },
    { key: "activity", label: "فعالیت" },
  ];
  const active = cls.status === "active";
  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        <button className={btn} onClick={onBack}><ArrowRight className="h-3.5 w-3.5" /> همهٔ کلاس‌ها</button>
        <h3 className="text-sm font-bold">{classDisplayName(cls)}</h3>
        <span className="text-[11px] text-muted-foreground">{cls.termTitle} · {cls.teacherName || "بدون مدرس"}</span>
        <span className="flex-1" />
        {canManage && <button className={btn} onClick={() => void openEdit()}>ویرایش کلاس</button>}
        {isOwner && <button className={btn} onClick={() => void remove()}><Trash2 className="h-3.5 w-3.5" /> حذف کلاس</button>}
      </div>
      {editing && (
        <ClassForm orgId={orgId} terms={terms} courses={courses} members={members} initial={cls} onDone={() => { setEditing(false); onBack(); }} />
      )}
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`whitespace-nowrap px-3 py-2 text-xs font-bold ${tab === t.key ? "border-b-2 border-bronze text-bronze" : "text-muted-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <ErrorLine text={err} />
      {tab === "students" && (
        <StudentsTab cls={cls} students={students} busy={busy} canManage={canManage && active} onChanged={() => void load()} />
      )}
      {tab === "grades" && (
        <GradesTab cls={cls} students={students} canEdit={active} isOwner={isOwner} onChanged={() => void load()} />
      )}
      {tab === "exams" && <OrgExamsPanel classId={cls.id} className={classDisplayName(cls)} canEdit={active} isOwner={isOwner} />}
      {tab === "content" && <ContentTab cls={cls} orgId={orgId} canEdit={active} />}
      {tab === "activity" && <ClassActivityPanel classId={cls.id} className={classDisplayName(cls)} />}
    </div>
  );
}

function StudentsTab({ cls, students, busy, canManage, onChanged }: {
  cls: ClassRow;
  students: ClassStudent[];
  busy: boolean;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [refs, setRefs] = React.useState("");
  const [result, setResult] = React.useState<{ ref: string; result: string }[]>([]);
  const [err, setErr] = React.useState("");
  const [working, setWorking] = React.useState(false);
  const run = async (drop: boolean) => {
    const list = refs.split(/[\n,،;\t]+/).map((s) => s.trim()).filter(Boolean);
    if (!list.length) return;
    if (drop && !window.confirm(`${faNum(list.length, 0)} دانشجو از این کلاس حذف شوند؟ (نمره‌ها می‌مانند)`)) return;
    setWorking(true);
    setErr("");
    try {
      setResult(await enroll(cls.id, list, drop));
      setRefs("");
      onChanged();
    } catch (e) {
      setErr(orgClassError(e));
    } finally {
      setWorking(false);
    }
  };
  const live = students.filter((s) => s.enrollment !== "dropped").length;
  return (
    <div className="space-y-3">
      {canManage && (
        <div className="space-y-2 rounded-xl border border-border p-3">
          <p className="text-xs text-muted-foreground">
            نام کاربری یا شمارهٔ دانشجویی، هر کدام در یک خط (از ستون Excel کپی کنید). فقط دانشجوهای فعال مرکز ثبت می‌شوند.
          </p>
          <textarea className={`${input} h-24 font-mono`} dir="ltr" value={refs} onChange={(e) => setRefs(e.target.value)} />
          <div className="flex gap-2">
            <button className={btnMain} onClick={() => void run(false)} disabled={working || !refs.trim()}><Users className="h-3.5 w-3.5" /> ثبت در کلاس</button>
            <button className={btn} onClick={() => void run(true)} disabled={working || !refs.trim()}>حذف از کلاس</button>
          </div>
          <ErrorLine text={err} />
          {result.length > 0 && (
            <ul className="max-h-40 overflow-auto text-[11px]">
              {result.filter((r) => r.result !== "enrolled" && r.result !== "dropped").map((r) => (
                <li key={r.ref} className="text-red-700"><span dir="ltr">{r.ref}</span>: {ENROLL_RESULTS[r.result] ?? r.result}</li>
              ))}
              <li className="text-green-700">{faNum(result.filter((r) => r.result === "enrolled" || r.result === "dropped").length, 0)} ردیف انجام شد.</li>
            </ul>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">{busy ? "در حال بارگذاری…" : `${faNum(live, 0)} دانشجو`}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="p-2 text-start">نام</th><th className="p-2 text-start">نام کاربری</th>
              <th className="p-2 text-start">شمارهٔ دانشجویی</th><th className="p-2 text-start">وضعیت در کلاس</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.studentId} className={`border-t border-border ${s.enrollment === "dropped" ? "opacity-50" : ""}`}>
                <td className="p-2">{s.fullName || "-"}</td>
                <td className="p-2" dir="ltr">{s.username}</td>
                <td className="p-2" dir="ltr">{s.studentNo || "-"}</td>
                <td className="p-2">{ENROLLMENT_LABELS[s.enrollment] ?? s.enrollment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GradesTab({ cls, students, canEdit, isOwner, onChanged }: {
  cls: ClassRow;
  students: ClassStudent[];
  canEdit: boolean;
  isOwner: boolean;
  onChanged: () => void;
}) {
  const [draft, setDraft] = React.useState<Record<string, string>>({});
  const [err, setErr] = React.useState("");
  const [msg, setMsg] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const list = students.filter((s) => s.enrollment !== "dropped");
  const key = (sid: string, c: GradeComponent) => `${sid}:${c}`;
  const changed = Object.entries(draft).filter(([k, v]) => {
    const [sid, c] = k.split(":") as [string, GradeComponent];
    const cur = students.find((s) => s.studentId === sid)?.grades[c];
    return v.trim() !== "" && String(cur?.score ?? "") !== v.trim();
  });

  const report = (res: { row: number; result: string }[], labels: string[]) => {
    const ok = res.filter((r) => r.result === "saved").length;
    const bad = res.filter((r) => !["saved", "same", "skipped"].includes(r.result))
      .map((r) => `${labels[r.row - 1] ?? `ردیف ${faNum(r.row, 0)}`}: ${GRADE_RESULTS[r.result] ?? r.result}`);
    setMsg(`${faNum(ok, 0)} نمره ثبت شد.${bad.length ? ` خطا: ${bad.slice(0, 30).join("، ")}` : ""}`);
  };

  const save = async () => {
    if (!changed.length) return;
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const rows = changed.map(([k, v]) => {
        const [sid, c] = k.split(":") as [string, GradeComponent];
        return { ref: sid, component: c, score: v, max: 20 };
      });
      const res = await upsertGrades(cls.id, rows, "manual");
      report(res, rows.map((r) => students.find((s) => s.studentId === r.ref)?.username ?? r.ref));
      setDraft({});
      onChanged();
    } catch (e) {
      setErr(orgClassError(e));
    } finally {
      setBusy(false);
    }
  };

  const importCsv = async (f: File | undefined) => {
    if (!f) return;
    setErr("");
    setMsg("");
    try {
      const { rows, missing } = gradesFromCsv(await readFile(f));
      if (missing.includes("ref")) { setErr("فایل باید ستون «نام کاربری» یا «شماره دانشجویی» داشته باشد."); return; }
      if (missing.includes("component")) { setErr("فایل باید دست‌کم یکی از ستون‌های «میان‌ترم»، «پایان‌ترم» یا «نهایی» را داشته باشد."); return; }
      if (!rows.length) { setErr("نمره‌ای در فایل پیدا نشد."); return; }
      if (!window.confirm(`${faNum(rows.length, 0)} نمره از فایل ثبت شود؟ نمره‌های قبلی همان ستون‌ها جایگزین می‌شوند (تغییرها در گزارش فعالیت می‌ماند).`)) return;
      setBusy(true);
      const res = await upsertGrades(cls.id, rows, "csv");
      report(res, rows.map((r) => `${r.ref}`));
      onChanged();
    } catch (e) {
      setErr(orgClassError(e));
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const { name, text } = gradesCsv(classDisplayName(cls), students);
    downloadText(name, text);
  };

  const removeColumn = async (c: GradeComponent) => {
    const label = GRADE_COMPONENTS.find((x) => x.key === c)?.label;
    if (!window.confirm(`همهٔ نمره‌های «${label}» این کلاس برای همیشه حذف شوند؟`)) return;
    setBusy(true);
    setErr("");
    try {
      const ids = (await classGradeIds(cls.id, c)).map((g) => g.id);
      if (ids.length) await deleteGrades(ids);
      setMsg(`${faNum(ids.length, 0)} نمره حذف شد.`);
      onChanged();
    } catch (e) {
      setErr(orgClassError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {canEdit && <button className={btnMain} onClick={() => void save()} disabled={busy || !changed.length}><Save className="h-3.5 w-3.5" /> ذخیرهٔ {faNum(changed.length, 0)} تغییر</button>}
        {canEdit && (
          <label className={`${btn} cursor-pointer`}>
            <FileUp className="h-3.5 w-3.5" /> ورود از CSV
            <input type="file" className="hidden" accept=".csv,.txt,text/csv" disabled={busy}
              onChange={(e) => { void importCsv(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        )}
        <button className={btn} onClick={exportCsv} disabled={!students.length}><Download className="h-3.5 w-3.5" /> خروجی CSV</button>
      </div>
      <p className="text-[11px] text-muted-foreground">نمره از ۲۰. ستون‌های فایل: «نام کاربری» یا «شماره دانشجویی» و «میان‌ترم»، «پایان‌ترم»، «نهایی».</p>
      <ErrorLine text={err} />
      {msg && <p className="text-xs text-green-700">{msg}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="p-2 text-start">دانشجو</th>
              {GRADE_COMPONENTS.map((c) => (
                <th key={c.key} className="p-2 text-start">
                  {c.label}
                  {isOwner && <button className="ms-1 text-red-600" title="حذف همهٔ نمره‌های این ستون" onClick={() => void removeColumn(c.key)}><Trash2 className="inline h-3 w-3" /></button>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.studentId} className="border-t border-border">
                <td className="p-2">{s.fullName || s.username} <span className="text-muted-foreground" dir="ltr">{s.studentNo}</span></td>
                {GRADE_COMPONENTS.map((c) => {
                  const g = s.grades[c.key];
                  const k = key(s.studentId, c.key);
                  return (
                    <td key={c.key} className="p-2">
                      {canEdit ? (
                        <input className="w-16 rounded-lg border border-border bg-background px-2 py-1" inputMode="decimal" dir="ltr"
                          value={draft[k] ?? (g ? String(g.score) : "")} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
                      ) : (
                        <span>{g ? faNum(g.score) : "-"}</span>
                      )}
                      {g && <span className="block text-[10px] text-muted-foreground">{SOURCE_LABELS[g.source] ?? g.source}{g.max !== 20 ? ` · از ${faNum(g.max)}` : ""}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ContentTab({ cls, orgId, canEdit }: { cls: ClassRow; orgId: string; canEdit: boolean }) {
  const [items, setItems] = React.useState<ClassContent[]>([]);
  const [mine, setMine] = React.useState<{ kind: "post" | "tcourse"; id: string; title: string; visibility: string }[]>([]);
  const [pick, setPick] = React.useState("");
  const [makeClass, setMakeClass] = React.useState(true);
  const [err, setErr] = React.useState("");
  const load = React.useCallback(async () => {
    setErr("");
    try {
      const [a, b] = await Promise.all([classContent(cls.id), canEdit ? myOrgItems(orgId) : Promise.resolve([])]);
      setItems(a);
      setMine(b);
    } catch (e) {
      setErr(orgClassError(e));
    }
  }, [cls.id, orgId, canEdit]);
  React.useEffect(() => { void load(); }, [load]);
  const attach = async () => {
    const it = mine.find((m) => `${m.kind}:${m.id}` === pick);
    if (!it) return;
    try {
      await setClassContent(cls.id, it.kind, it.id, true, makeClass);
      setPick("");
      void load();
    } catch (e) {
      setErr(orgClassError(e));
    }
  };
  const detach = async (c: ClassContent) => {
    try {
      await setClassContent(cls.id, c.kind, c.itemId, false);
      void load();
    } catch (e) {
      setErr(orgClassError(e));
    }
  };
  const attached = new Set(items.map((i) => `${i.kind}:${i.itemId}`));
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">
        مطلب یا دوره‌ای که سطح دسترسی‌اش «کلاس» است فقط برای مدرس و دانشجویان کلاس‌هایی که اینجا به آن وصل شده دیده می‌شود.
      </p>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <select className={`${input} max-w-sm`} value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">یکی از مطالب یا دوره‌های خودتان در این مرکز…</option>
            {mine.filter((m) => !attached.has(`${m.kind}:${m.id}`)).map((m) => (
              <option key={`${m.kind}:${m.id}`} value={`${m.kind}:${m.id}`}>{m.kind === "tcourse" ? "دوره" : "مطلب"}: {m.title}</option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={makeClass} onChange={(e) => setMakeClass(e.target.checked)} /> سطح دسترسی را «کلاس» کن
          </label>
          <button className={btnMain} onClick={() => void attach()} disabled={!pick}><BookOpen className="h-3.5 w-3.5" /> وصل کن</button>
        </div>
      )}
      <ErrorLine text={err} />
      {!items.length && <p className="text-xs text-muted-foreground">هنوز محتوایی به این کلاس وصل نشده است.</p>}
      <ul className="space-y-1">
        {items.map((c) => (
          <li key={`${c.kind}:${c.itemId}`} className="flex items-center gap-2 rounded-xl border border-border p-2 text-xs">
            <span className="font-bold">{c.kind === "tcourse" ? "دوره" : "مطلب"}</span>
            <span className="flex-1">{c.title || "(بدون عنوان)"}</span>
            {c.visibility !== "class" && <span className="text-[10px] text-muted-foreground">سطح: {visibilityLabel(c.visibility)}</span>}
            {canEdit && <button className={btn} onClick={() => void detach(c)}>جدا کن</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}
