"use client";
/* Classes, official exams and grades (phase 3 of docs/ORG_LEARNING.md,
 * supabase/008_classes_exams_grades.sql). Everything goes through RPCs: the server checks who
 * the caller is (teacher of the class, manager with a two-factor session, enrolled student),
 * keeps the clock and grades exams. The answer key never reaches a student before the end. */
import { sbUser } from "@/lib/supabase";
import { HttpError, isUuid, sbRpc, sbSelect } from "./rest";
import { parseCsv, toCsv, toLatinDigits } from "./org-accounts";

export type TermStatus = "planned" | "current" | "closed";
export type ClassStatus = "active" | "archived";
export type Enrollment = "enrolled" | "completed" | "dropped";
export type GradeComponent = "midterm" | "final_exam" | "final";
export type GradeSource = "manual" | "csv" | "api" | "connector" | "lexa_exam";

export const GRADE_COMPONENTS: { key: GradeComponent; label: string }[] = [
  { key: "midterm", label: "میان‌ترم" },
  { key: "final_exam", label: "پایان‌ترم" },
  { key: "final", label: "نمرهٔ نهایی" },
];
export const componentLabel = (c: string) => GRADE_COMPONENTS.find((x) => x.key === c)?.label ?? c;
export const TERM_STATUSES: { key: TermStatus; label: string }[] = [
  { key: "planned", label: "آینده" },
  { key: "current", label: "جاری" },
  { key: "closed", label: "بسته‌شده" },
];
export const ENROLLMENT_LABELS: Record<Enrollment, string> = {
  enrolled: "در حال گذراندن",
  completed: "گذرانده",
  dropped: "حذف‌شده",
};
export const SOURCE_LABELS: Record<GradeSource, string> = {
  manual: "دستی",
  csv: "فایل CSV",
  api: "API",
  connector: "کانکتور",
  lexa_exam: "آزمون Lexa",
};

// --- errors ---
const ERRORS: [RegExp, string][] = [
  [/mfa required/, "برای این کار باید ورود دومرحله‌ای را تأیید کنید."],
  [/not a manager/, "این کار فقط از مدیران این مرکز آموزشی ساخته است."],
  [/not_staff/, "این کلاس به شما مربوط نیست."],
  [/owner_only/, "حذف نمره و نتیجهٔ آزمون رسمی فقط با مالک مرکز است."],
  [/org_not_active/, "این مرکز آموزشی فعال نیست؛ پنل فقط‌خواندنی است."],
  [/teacher_not_member/, "این مدرس عضو فعال مرکز نیست."],
  [/exam_locked/, "یک دانشجو آزمون را شروع کرده است؛ دیگر نمی‌شود آن را ویرایش کرد."],
  [/exam_not_open/, "آزمون هنوز شروع نشده است."],
  [/exam_closed/, "زمان آزمون تمام شده است."],
  [/exam_not_over/, "نتیجه را فقط بعد از پایان آزمون می‌شود منتشر کرد."],
  [/already_submitted/, "این آزمون را قبلاً تحویل داده‌اید."],
  [/not_enrolled/, "شما در این کلاس ثبت‌نام نیستید یا دسترسی آزمون رسمی ندارید."],
  [/bad_question:(\d+)/, "سؤال $1 ناقص است (متن، ۲ تا ۸ گزینه، گزینهٔ درست و نمرهٔ مثبت)."],
  [/bad_questions/, "آزمون باید ۱ تا ۲۰۰ سؤال داشته باشد."],
  [/bad_exam/, "عنوان، زمان شروع و پایان (پایان بعد از شروع) و مدت آزمون را درست وارد کنید."],
  [/item_other_org/, "این مطلب به مرکز دیگری وصل است."],
  [/bad_batch/, "فهرست خالی است یا ردیف‌های آن بیش از حد مجاز است."],
  [/bad_component/, "ستون نمره نامعتبر است."],
  [/bad_input/, "مقدار واردشده نامعتبر است."],
  [/not_found/, "پیدا نشد."],
  [/not signed in/, "ابتدا وارد حساب کاربری خود شوید."],
  [/duplicate key|23505/, "این مورد تکراری است (مثلاً کد درس یا شناسهٔ کلاس)."],
  [/row-level security|42501|permission denied/, "اجازهٔ انجام این کار را ندارید."],
];

export function orgClassError(e: unknown): string {
  const raw = e instanceof HttpError ? `${e.message} ${e.code}` : e instanceof Error ? e.message : String(e ?? "");
  for (const [re, msg] of ERRORS) {
    const m = raw.match(re);
    if (m) return msg.replace("$1", m[1] ?? "");
  }
  if (e instanceof TypeError) return "اتصال به Lexa برقرار نشد؛ اتصال اینترنت را بررسی کنید.";
  return "درخواست انجام نشد. لطفاً دوباره تلاش کنید.";
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const num = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));

// --- terms, subjects, classes ---
export interface Term { id: string; title: string; startsOn: string | null; endsOn: string | null; status: TermStatus }
export interface Course { id: string; code: string; title: string; units: number }

export async function listTerms(orgId: string): Promise<Term[]> {
  const rows = await sbSelect<any>("lexa_org_terms", `org_id=eq.${orgId}&select=*&order=created_at.desc&limit=200`);
  return rows.map((r) => ({ id: r.id, title: r.title, startsOn: r.starts_on ?? null, endsOn: r.ends_on ?? null, status: r.status }));
}

export async function listCourses(orgId: string): Promise<Course[]> {
  const rows = await sbSelect<any>("lexa_org_courses", `org_id=eq.${orgId}&select=*&order=title.asc&limit=1000`);
  return rows.map((r) => ({ id: r.id, code: r.code ?? "", title: r.title, units: Number(r.units) || 0 }));
}

export const saveTerm = (orgId: string, t: { id?: string | null; title: string; startsOn?: string | null; endsOn?: string | null; status: TermStatus }) =>
  sbRpc<string>("lexa_org_term_save", {
    o: orgId, t_id: t.id ?? null, t_title: t.title.trim(), t_starts: t.startsOn || null, t_ends: t.endsOn || null, t_status: t.status,
  });

export const saveCourse = (orgId: string, c: { id?: string | null; code: string; title: string; units: number }) =>
  sbRpc<string>("lexa_org_course_save", { o: orgId, c_id: c.id ?? null, c_code: c.code.trim(), c_title: c.title.trim(), c_units: c.units || 0 });

export interface ClassInput {
  id?: string | null;
  termId: string;
  courseId: string;
  title: string;
  teacherId: string | null;
  externalId: string;
  status: ClassStatus;
}
export const saveClass = (orgId: string, k: ClassInput) =>
  sbRpc<string>("lexa_org_class_save", {
    o: orgId, k_id: k.id ?? null, k_term: k.termId, k_course: k.courseId, k_title: k.title.trim(),
    k_teacher: k.teacherId && isUuid(k.teacherId) ? k.teacherId : null, k_external: k.externalId.trim(), k_status: k.status,
  });

/** owner only (two-factor); also deletes the class's grades and exam results */
export const deleteClass = (classId: string) => sbRpc<string>("lexa_org_class_delete", { k: classId });

export interface ClassRow {
  id: string;
  termId: string;
  termTitle: string;
  termStatus: TermStatus;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  units: number;
  title: string;
  teacherId: string | null;
  teacherName: string;
  externalId: string;
  status: ClassStatus;
  students: number;
  exams: number;
  mine: boolean;
}
export const classDisplayName = (c: { courseTitle: string; title: string }) => (c.title ? `${c.courseTitle} (${c.title})` : c.courseTitle);

export async function classList(orgId: string): Promise<ClassRow[]> {
  const rows = await sbRpc<any[]>("lexa_org_class_list", { o: orgId });
  return (rows ?? []).map((r) => ({
    id: r.id, termId: r.term_id, termTitle: r.term_title ?? "", termStatus: r.term_status, courseId: r.course_id,
    courseCode: r.course_code ?? "", courseTitle: r.course_title ?? "", units: Number(r.units) || 0, title: r.title ?? "",
    teacherId: r.teacher_id ?? null, teacherName: r.teacher_name ?? "", externalId: r.external_id ?? "", status: r.status,
    students: Number(r.students) || 0, exams: Number(r.exams) || 0, mine: !!r.mine,
  }));
}

/** refs: usernames, student numbers or roster ids (one per line in the UI) */
export async function enroll(classId: string, refs: string[], drop = false): Promise<{ ref: string; result: string }[]> {
  const clean = Array.from(new Set(refs.map((r) => toLatinDigits(r).trim()).filter(Boolean)));
  if (!clean.length) return [];
  const rows = await sbRpc<any[]>("lexa_org_enroll", { k: classId, refs: clean.slice(0, 1000), drop_them: drop });
  return (rows ?? []).map((r) => ({ ref: r.ref, result: r.result }));
}
export const ENROLL_RESULTS: Record<string, string> = {
  enrolled: "ثبت شد",
  dropped: "حذف شد",
  not_found: "در فهرست مرکز نیست",
  not_active: "دانشجوی فعال نیست",
  not_enrolled: "در این کلاس نبود",
};

export interface GradeCell { score: number; max: number; source: GradeSource; updatedAt: string }
export interface ClassStudent {
  studentId: string;
  username: string;
  fullName: string;
  studentNo: string;
  studentStatus: string;
  enrollment: Enrollment;
  grades: Partial<Record<GradeComponent, GradeCell>>;
}

export async function classStudents(classId: string): Promise<ClassStudent[]> {
  const rows = await sbRpc<any[]>("lexa_class_students", { k: classId });
  return (rows ?? []).map((r) => {
    const grades: Partial<Record<GradeComponent, GradeCell>> = {};
    for (const [k, v] of Object.entries((r.grades ?? {}) as Record<string, any>)) {
      if (k === "midterm" || k === "final_exam" || k === "final") {
        grades[k] = { score: Number(v.score), max: Number(v.max) || 20, source: v.source, updatedAt: v.updated_at };
      }
    }
    return {
      studentId: r.student_id, username: r.org_username, fullName: r.full_name ?? "", studentNo: r.student_no ?? "",
      studentStatus: r.student_status, enrollment: r.enrollment, grades,
    };
  });
}

// --- grades ---
export interface GradeInput { ref: string; component: GradeComponent; score: string | number | null; max?: number; note?: string }
export const GRADE_RESULTS: Record<string, string> = {
  saved: "ثبت شد",
  same: "بدون تغییر",
  skipped: "خالی (رد شد)",
  not_found: "دانشجو پیدا نشد",
  not_enrolled: "در این کلاس نیست",
  bad_component: "ستون نامعتبر",
  bad_score: "نمرهٔ نامعتبر",
};

export async function upsertGrades(classId: string, rows: GradeInput[], source: "manual" | "csv" = "manual"): Promise<{ row: number; result: string }[]> {
  const items = rows.map((r) => ({
    ref: toLatinDigits(String(r.ref ?? "")).trim(),
    component: r.component,
    score: r.score === null || r.score === undefined ? "" : toLatinDigits(String(r.score)).replace("/", ".").replace("٫", ".").trim(),
    max: r.max ?? 20,
    note: r.note ?? "",
  }));
  const out: { row: number; result: string }[] = [];
  for (let i = 0; i < items.length; i += 2000) {
    const part = await sbRpc<any[]>("lexa_grades_upsert", { k: classId, items: items.slice(i, i + 2000), src: source });
    out.push(...(part ?? []).map((r) => ({ row: i + Number(r.row_no), result: r.result })));
  }
  return out;
}

/** owner only (two-factor) */
export const deleteGrades = (ids: string[]) => sbRpc<number>("lexa_grades_delete", { ids });
export async function classGradeIds(classId: string, component?: GradeComponent): Promise<{ id: string; studentId: string; component: GradeComponent }[]> {
  const rows = await sbRpc<any[]>("lexa_class_grade_ids", { k: classId, comp: component ?? null });
  return (rows ?? []).map((r) => ({ id: r.id, studentId: r.student_id, component: r.component }));
}

const norm = (s: string) => s.toLowerCase().replace(/[\u200c\s_\-]+/g, " ").trim();
const REF_KEYS = ["username", "user", "login", "نام کاربری", "student no", "studentno", "student number", "شماره دانشجویی", "شماره", "ref"].map(norm);
const COMP_KEYS: Record<GradeComponent, string[]> = {
  midterm: ["midterm", "mid", "میان ترم", "میانترم"],
  final_exam: ["final exam", "final_exam", "exam", "پایان ترم", "پایانترم", "امتحان پایانی"],
  final: ["final", "grade", "نهایی", "نمره نهایی", "نمره"],
};
const MAX_KEYS = ["max", "out of", "از", "سقف", "حداکثر"].map(norm);

/** CSV with a username / student-number column and one column per component.
 *  Returns one GradeInput per non-empty cell. */
export function gradesFromCsv(text: string): { rows: GradeInput[]; missing: string[] } {
  const table = parseCsv(text);
  if (!table.length) return { rows: [], missing: ["ref"] };
  const head = table[0].map(norm);
  const refCol = head.findIndex((h) => REF_KEYS.includes(h));
  const maxCol = head.findIndex((h) => MAX_KEYS.includes(h));
  const cols = (Object.keys(COMP_KEYS) as GradeComponent[])
    .map((k) => [k, head.findIndex((h) => COMP_KEYS[k].map(norm).includes(h))] as const)
    .filter(([, i]) => i >= 0);
  const missing: string[] = [];
  if (refCol < 0) missing.push("ref");
  if (!cols.length) missing.push("component");
  if (missing.length) return { rows: [], missing };
  const rows: GradeInput[] = [];
  for (const r of table.slice(1)) {
    const ref = toLatinDigits(r[refCol] ?? "").trim();
    if (!ref) continue;
    const max = maxCol >= 0 ? Number(toLatinDigits(r[maxCol] ?? "").replace("/", ".")) || 20 : 20;
    for (const [k, i] of cols) {
      const v = (r[i] ?? "").trim();
      if (v) rows.push({ ref, component: k, score: v, max });
    }
  }
  return { rows, missing };
}

export function gradesCsv(className: string, students: ClassStudent[]): { name: string; text: string } {
  const head = ["نام کاربری", "شماره دانشجویی", "نام", "وضعیت", ...GRADE_COMPONENTS.map((c) => c.label)];
  const body = students.map((s) => [
    s.username, s.studentNo, s.fullName, ENROLLMENT_LABELS[s.enrollment] ?? s.enrollment,
    ...GRADE_COMPONENTS.map((c) => (s.grades[c.key] ? String(s.grades[c.key]!.score) : "")),
  ]);
  const safe = className.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 60) || "class";
  return { name: `grades-${safe}.csv`, text: toCsv([head, ...body]) };
}

/** prior GPA (managers, two-factor): CSV with username / student number + gpa (+ as_of) */
export function gpaFromCsv(text: string): { rows: { ref: string; gpa: string; as_of: string }[]; missing: string[] } {
  const table = parseCsv(text);
  if (!table.length) return { rows: [], missing: ["ref"] };
  const head = table[0].map(norm);
  const refCol = head.findIndex((h) => REF_KEYS.includes(h));
  const gpaCol = head.findIndex((h) => ["gpa", "معدل", "معدل کل", "average"].map(norm).includes(h));
  const asCol = head.findIndex((h) => ["as of", "as_of", "term", "ترم", "تا ترم"].map(norm).includes(h));
  const missing = [...(refCol < 0 ? ["ref"] : []), ...(gpaCol < 0 ? ["gpa"] : [])];
  if (missing.length) return { rows: [], missing };
  const rows = table.slice(1)
    .map((r) => ({ ref: toLatinDigits(r[refCol] ?? "").trim(), gpa: toLatinDigits(r[gpaCol] ?? "").replace("/", ".").trim(), as_of: asCol >= 0 ? toLatinDigits(r[asCol] ?? "").trim() : "" }))
    .filter((r) => r.ref && r.gpa);
  return { rows, missing };
}
export async function upsertPriorGpa(orgId: string, rows: { ref: string; gpa: string; as_of: string }[]): Promise<{ row: number; result: string }[]> {
  const out: { row: number; result: string }[] = [];
  for (let i = 0; i < rows.length; i += 5000) {
    const part = await sbRpc<any[]>("lexa_prior_gpa_upsert", { o: orgId, items: rows.slice(i, i + 5000), src: "csv" });
    out.push(...(part ?? []).map((r) => ({ row: i + Number(r.row_no), result: r.result })));
  }
  return out;
}

// --- student side ---
export interface MyClass {
  classId: string;
  orgId: string;
  orgName: string;
  termTitle: string;
  courseTitle: string;
  courseCode: string;
  title: string;
  teacherName: string;
  enrollment: Enrollment;
}
export async function myClasses(): Promise<MyClass[]> {
  if (!sbUser()) return [];
  const rows = await sbRpc<any[]>("lexa_my_classes");
  return (rows ?? []).map((r) => ({
    classId: r.class_id, orgId: r.org_id, orgName: r.org_name ?? "", termTitle: r.term_title ?? "", courseTitle: r.course_title ?? "",
    courseCode: r.course_code ?? "", title: r.title ?? "", teacherName: r.teacher_name ?? "", enrollment: r.enrollment,
  }));
}

export interface MyGrade {
  orgName: string;
  termTitle: string;
  courseTitle: string;
  units: number;
  classTitle: string;
  component: GradeComponent;
  score: number;
  maxScore: number;
  updatedAt: string;
}
export async function myGrades(): Promise<MyGrade[]> {
  if (!sbUser()) return [];
  const rows = await sbRpc<any[]>("lexa_my_grades");
  return (rows ?? []).map((r) => ({
    orgName: r.org_name ?? "", termTitle: r.term_title ?? "", courseTitle: r.course_title ?? "", units: Number(r.units) || 0,
    classTitle: r.class_title ?? "", component: r.component, score: Number(r.score), maxScore: Number(r.max_score) || 20,
    updatedAt: r.updated_at,
  }));
}

// --- content attached to a class ---
export interface ClassContent { kind: "post" | "tcourse"; itemId: string; title: string; visibility: string; authorId: string | null }
export async function classContent(classId: string): Promise<ClassContent[]> {
  const rows = await sbRpc<any[]>("lexa_class_content", { k: classId });
  return (rows ?? []).map((r) => ({ kind: r.kind, itemId: r.item_id, title: r.title ?? "", visibility: r.visibility ?? "public", authorId: r.author_id ?? null }));
}
/** makeClass: also switch the item to visibility "class" (only for your own items) */
export const setClassContent = (classId: string, kind: "post" | "tcourse", itemId: string, attach: boolean, makeClass = false) =>
  sbRpc<string>("lexa_class_content_set", { k: classId, t: kind, item: itemId, attach, make_class: makeClass });

/** my own posts and courses under this centre (to attach to a class) */
export async function myOrgItems(orgId: string): Promise<{ kind: "post" | "tcourse"; id: string; title: string; visibility: string }[]> {
  const u = sbUser();
  if (!u) return [];
  const [posts, courses] = await Promise.all([
    sbSelect<any>("lexa_posts", `author_id=eq.${u.id}&org_id=eq.${orgId}&select=id,title,visibility&order=created_at.desc&limit=200`),
    sbSelect<any>("lexa_tcourses", `teacher_id=eq.${u.id}&org_id=eq.${orgId}&select=id,title,visibility&order=updated_at.desc&limit=200`),
  ]);
  return [
    ...courses.map((c) => ({ kind: "tcourse" as const, id: c.id, title: c.title, visibility: c.visibility ?? "public" })),
    ...posts.map((p) => ({ kind: "post" as const, id: p.id, title: p.title, visibility: p.visibility ?? "public" })),
  ];
}

// --- official exams ---
export interface ExamQuestionInput { id?: string; text: string; options: string[]; correct: number; points: number; explanation: string }
export interface ExamMeta {
  title: string;
  instructions: string;
  startsAt: string;
  endsAt: string;
  durationMin: number;
  shuffle: boolean;
  results: "after_end" | "manual";
  maxScore: number;
  status: "draft" | "published";
}

/** problems before saving (Persian), or "" */
export function examProblem(m: ExamMeta, qs: ExamQuestionInput[]): string {
  if (!m.title.trim()) return "عنوان آزمون را بنویسید.";
  const s = Date.parse(m.startsAt);
  const e = Date.parse(m.endsAt);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return "زمان پایان باید بعد از زمان شروع باشد.";
  if (!(m.durationMin >= 1 && m.durationMin <= 600)) return "مدت آزمون باید بین ۱ تا ۶۰۰ دقیقه باشد.";
  if (!(m.maxScore > 0 && m.maxScore <= 100)) return "نمرهٔ کل باید بین ۰ تا ۱۰۰ باشد.";
  if (!qs.length || qs.length > 200) return "آزمون باید ۱ تا ۲۰۰ سؤال داشته باشد.";
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i];
    const opts = q.options.map((o) => o.trim());
    if (!q.text.trim()) return `متن سؤال ${i + 1} خالی است.`;
    if (opts.length < 2 || opts.length > 8 || opts.some((o) => !o || o.length > 500)) return `گزینه‌های سؤال ${i + 1} را کامل کنید (۲ تا ۸ گزینه).`;
    if (!(q.correct >= 0 && q.correct < opts.length)) return `گزینهٔ درست سؤال ${i + 1} را انتخاب کنید.`;
    if (!(q.points > 0 && q.points <= 100)) return `نمرهٔ سؤال ${i + 1} باید مثبت باشد.`;
  }
  return "";
}

export const saveExam = (classId: string, examId: string | null, m: ExamMeta, qs: ExamQuestionInput[]) =>
  sbRpc<string>("lexa_exam_save", {
    k: classId,
    e_id: examId,
    meta: {
      title: m.title.trim(), instructions: m.instructions, starts_at: new Date(m.startsAt).toISOString(),
      ends_at: new Date(m.endsAt).toISOString(), duration_min: Math.round(m.durationMin), shuffle: m.shuffle,
      results: m.results, max_score: m.maxScore, status: m.status,
    },
    questions: qs.map((q) => ({
      text: q.text.trim(), options: q.options.map((o) => o.trim()), correct: q.correct, points: q.points, explanation: q.explanation.trim(),
    })),
  });

export async function examForEditor(examId: string): Promise<{ meta: ExamMeta; questions: ExamQuestionInput[]; locked: boolean; releasedAt: string | null }> {
  const r = await sbRpc<any>("lexa_exam_editor", { e: examId });
  const x = r?.exam ?? {};
  return {
    meta: {
      title: x.title ?? "", instructions: x.instructions ?? "", startsAt: x.starts_at, endsAt: x.ends_at,
      durationMin: Number(x.duration_min) || 60, shuffle: x.shuffle !== false, results: x.results === "manual" ? "manual" : "after_end",
      maxScore: Number(x.max_score) || 20, status: x.status === "published" ? "published" : "draft",
    },
    questions: ((r?.questions ?? []) as any[]).map((q) => ({
      id: q.id, text: q.text ?? "", options: Array.isArray(q.options) ? q.options.map(String) : [], correct: Number(q.correct) || 0,
      points: Number(q.points) || 1, explanation: q.explanation ?? "",
    })),
    locked: !!r?.locked,
    releasedAt: x.released_at ?? null,
  };
}

export const deleteExam = (examId: string) => sbRpc<string>("lexa_exam_delete", { e: examId });

export interface ClassExam {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  durationMin: number;
  status: "draft" | "published";
  results: "after_end" | "manual";
  releasedAt: string | null;
  maxScore: number;
  questions: number;
  attempts: number;
  submitted: number;
  avgScore: number | null;
}
export async function classExams(classId: string): Promise<ClassExam[]> {
  const rows = await sbRpc<any[]>("lexa_class_exams", { k: classId });
  return (rows ?? []).map((r) => ({
    id: r.id, title: r.title, startsAt: r.starts_at, endsAt: r.ends_at, durationMin: Number(r.duration_min) || 0, status: r.status,
    results: r.results, releasedAt: r.released_at ?? null, maxScore: Number(r.max_score) || 20, questions: Number(r.questions) || 0,
    attempts: Number(r.attempts) || 0, submitted: Number(r.submitted) || 0, avgScore: num(r.avg_score),
  }));
}

export interface ExamReportRow {
  studentId: string;
  username: string;
  fullName: string;
  studentNo: string;
  state: "not_started" | "in_progress" | "submitted";
  startedAt: string | null;
  submittedAt: string | null;
  score: number | null;
}
export async function examReport(examId: string): Promise<ExamReportRow[]> {
  const rows = await sbRpc<any[]>("lexa_exam_report", { e: examId });
  return (rows ?? []).map((r) => ({
    studentId: r.student_id, username: r.org_username, fullName: r.full_name ?? "", studentNo: r.student_no ?? "", state: r.state,
    startedAt: r.started_at ?? null, submittedAt: r.submitted_at ?? null, score: num(r.score),
  }));
}
export const ATTEMPT_STATES: Record<string, string> = {
  not_started: "شرکت نکرده",
  in_progress: "در حال پاسخ",
  submitted: "تحویل داده",
  upcoming: "هنوز شروع نشده",
  open: "در حال برگزاری",
  missed: "از دست رفته",
};

/** publish results after the end; optionally copy the scores into a grade column. Returns grades written. */
export const releaseExam = (examId: string, toComponent: GradeComponent | null) =>
  sbRpc<number>("lexa_exam_release", { e: examId, to_component: toComponent });

export interface MyExam {
  examId: string;
  classId: string;
  classTitle: string;
  courseTitle: string;
  orgName: string;
  title: string;
  instructions: string;
  startsAt: string;
  endsAt: string;
  durationMin: number;
  questions: number;
  state: "upcoming" | "open" | "missed" | "in_progress" | "submitted";
  deadlineAt: string | null;
  score: number | null;
  maxScore: number;
  resultsOpen: boolean;
  /** server clock minus this device's clock, in ms */
  clockSkew: number;
}
export async function myExams(): Promise<MyExam[]> {
  if (!sbUser()) return [];
  const t0 = Date.now();
  const rows = await sbRpc<any[]>("lexa_my_exams");
  const t1 = Date.now();
  return (rows ?? []).map((r) => ({
    examId: r.exam_id, classId: r.class_id, classTitle: r.class_title ?? "", courseTitle: r.course_title ?? "", orgName: r.org_name ?? "",
    title: r.title, instructions: r.instructions ?? "", startsAt: r.starts_at, endsAt: r.ends_at, durationMin: Number(r.duration_min) || 0,
    questions: Number(r.questions) || 0, state: r.state, deadlineAt: r.deadline_at ?? null, score: num(r.score),
    maxScore: Number(r.max_score) || 20, resultsOpen: !!r.results_open,
    clockSkew: Date.parse(r.server_now) - (t0 + t1) / 2,
  }));
}

export interface RunningExam {
  attemptId: string;
  title: string;
  instructions: string;
  deadlineAt: string;
  maxScore: number;
  clockSkew: number;
  questions: { id: string; text: string; options: string[]; points: number }[];
  answers: Record<string, number>;
}
export async function startExam(examId: string): Promise<RunningExam> {
  const t0 = Date.now();
  const r = await sbRpc<any>("lexa_exam_start", { e: examId });
  const t1 = Date.now();
  return {
    attemptId: r.attempt_id, title: r.title ?? "", instructions: r.instructions ?? "", deadlineAt: r.deadline_at,
    maxScore: Number(r.max_score) || 20, clockSkew: Date.parse(r.server_now) - (t0 + t1) / 2,
    questions: ((r.questions ?? []) as any[]).map((q) => ({ id: q.id, text: q.text ?? "", options: (q.options ?? []).map(String), points: Number(q.points) || 1 })),
    answers: Object.fromEntries(Object.entries((r.answers ?? {}) as Record<string, unknown>).map(([k, v]) => [k, Number(v)])),
  };
}

/** "ok", or "closed" when the server's deadline has passed */
export const answerExam = (attemptId: string, questionId: string, choice: number | null) =>
  sbRpc<string>("lexa_exam_answer", { a: attemptId, q: questionId, pick: choice });

export async function submitExam(attemptId: string): Promise<{ status: string; score: number | null }> {
  const r = await sbRpc<any>("lexa_exam_submit", { a: attemptId });
  return { status: r?.status ?? "", score: num(r?.score) };
}

export interface ExamResult {
  open: boolean;
  endsAt?: string;
  title?: string;
  score?: number | null;
  maxScore?: number;
  questions?: { id: string; text: string; options: string[]; correct: number; points: number; explanation: string; choice: number | null }[];
}
export async function examResult(examId: string): Promise<ExamResult> {
  const r = await sbRpc<any>("lexa_exam_result", { e: examId });
  if (!r?.open) return { open: false, endsAt: r?.ends_at };
  return {
    open: true, title: r.title, score: num(r.score), maxScore: Number(r.max_score) || 20,
    questions: ((r.questions ?? []) as any[]).map((q) => ({
      id: q.id, text: q.text ?? "", options: (q.options ?? []).map(String), correct: Number(q.correct), points: Number(q.points) || 1,
      explanation: q.explanation ?? "", choice: q.choice === null || q.choice === undefined ? null : Number(q.choice),
    })),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// --- formatting ---
export const faNum = (n: number | null | undefined, digits = 2) =>
  n === null || n === undefined || !Number.isFinite(n) ? "-" : n.toLocaleString("fa-IR", { maximumFractionDigits: digits });
export const faDateTime = (iso: string | null | undefined) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("fa-IR-u-ca-persian", { dateStyle: "medium", timeStyle: "short" });
};
/** value for <input type="datetime-local"> from an ISO time (local clock) */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
