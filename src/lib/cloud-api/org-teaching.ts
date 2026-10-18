"use client";
/* Terms, calendar, catalogue, classes, waitlist and cohorts (phase A3 of docs/ADMIN_PLATFORM.md):
 * typed client over supabase/015_terms_classes.sql, Persian labels and error texts. */
import { sbRpc } from "./rest";
import { orgConsoleError } from "./org-console";

// --- terms and calendar ---
export type TermStatus = "planned" | "current" | "closed";
export const TERM_STATUS_LABEL: Record<TermStatus, string> = { planned: "برنامه‌ریزی‌شده", current: "جاری", closed: "بسته" };
export type DateKind = "registration" | "add_drop" | "classes" | "midterms" | "exams" | "grade_entry" | "appeals" | "holiday" | "other";
export const DATE_KINDS: { key: DateKind; label: string; hint: string; color: string; enforceable: boolean }[] = [
  { key: "registration", label: "ثبت‌نام", hint: "ثبت‌نام در کلاس‌ها فقط در این بازه باز است", color: "#1f6f5c", enforceable: true },
  { key: "add_drop", label: "حذف و اضافه", hint: "اضافه و حذف کلاس و جابه‌جایی دانشجو", color: "#2f7fb5", enforceable: true },
  { key: "classes", label: "برگزاری کلاس‌ها", hint: "از شروع تا پایان کلاس‌ها", color: "#8a8f98", enforceable: false },
  { key: "midterms", label: "میان‌ترم‌ها", hint: "هفته‌ی آزمون میان‌ترم", color: "#b08a46", enforceable: false },
  { key: "exams", label: "امتحانات پایانی", hint: "دوره‌ی امتحانات پایان ترم", color: "#a5542b", enforceable: false },
  { key: "grade_entry", label: "ورود نمره", hint: "مهلت استادها برای ورود و ارسال نمره (اجرای آن در فاز A4)", color: "#7a4fa3", enforceable: true },
  { key: "appeals", label: "اعتراض به نمره", hint: "مهلت اعتراض دانشجو (فاز A4)", color: "#b5475f", enforceable: true },
  { key: "holiday", label: "تعطیلی", hint: "تعطیلات رسمی یا مرکز", color: "#c2a24a", enforceable: false },
  { key: "other", label: "سایر", hint: "هر رویداد دیگر", color: "#6b7280", enforceable: false },
];
export const DATE_KIND: Record<DateKind, (typeof DATE_KINDS)[number]> = Object.fromEntries(DATE_KINDS.map((k) => [k.key, k])) as Record<DateKind, (typeof DATE_KINDS)[number]>;
export interface TermDate { id?: string; kind: DateKind; title: string; starts_at: string; ends_at: string; enforce: boolean }
export interface TermRow {
  id: string; title: string; code: string; starts_on: string | null; ends_on: string | null; status: TermStatus; note: string;
  copied_from: string | null; copied_from_title: string | null; classes: number; students: number; waitlisted: number;
  dates: TermDate[]; open_now: DateKind[]; created_at: string;
}
export const orgTermList = async (orgId: string) => (await sbRpc<TermRow[]>("lexa_org_term_list", { o: orgId })) ?? [];
export interface TermInput { title: string; code: string; starts_on: string | null; ends_on: string | null; status: TermStatus; note: string }
export const orgTermUpsert = (orgId: string, id: string | null, p: TermInput, reason = "") =>
  sbRpc<string>("lexa_org_term_upsert", { o: orgId, t_id: id, p, reason });
export const orgTermDelete = (termId: string, reason: string) => sbRpc<string>("lexa_org_term_delete", { t: termId, reason });
export const orgTermDatesSave = (termId: string, dates: TermDate[], reason = "") =>
  sbRpc<number>("lexa_org_term_dates_save", { t: termId, dates: dates.map(({ id: _id, ...d }) => d), reason });
export interface TermCopyInput extends Omit<TermInput, "note"> {
  copy_classes: boolean; copy_teachers: boolean; copy_capacity: boolean; copy_content: boolean; copy_dates: boolean;
}
export const orgTermCopy = (srcId: string, p: TermCopyInput) =>
  sbRpc<{ term_id: string; classes: number; dates: number; content: number }>("lexa_org_term_copy", { src: srcId, p });

// --- catalogue ---
export type WeightKey = "midterm" | "final_exam" | "classwork" | "project";
export const WEIGHT_LABEL: Record<WeightKey, string> = { midterm: "میان‌ترم", final_exam: "امتحان پایانی", classwork: "کلاسی و تکلیف", project: "پروژه" };
export type Weights = Partial<Record<WeightKey, number>>;
export interface CourseRow {
  id: string; code: string; title: string; units: number; description: string; prereqs: string[]; prereq_titles: string[];
  default_capacity: number | null; pass_mark: number; weights: Weights; unit_id: string | null; unit_name: string | null;
  status: "active" | "archived"; classes: number; classes_current: number; can_edit: boolean;
}
export const orgCourseList = async (orgId: string) => (await sbRpc<CourseRow[]>("lexa_org_course_list", { o: orgId })) ?? [];
export interface CourseInput {
  code: string; title: string; units: number; description: string; prereqs: string[]; default_capacity: number | null;
  pass_mark: number; weights: Weights; unit_id: string | null; status: "active" | "archived";
}
export const orgCourseUpsert = (orgId: string, id: string | null, p: CourseInput) =>
  sbRpc<string>("lexa_org_course_upsert", { o: orgId, c_id: id, p });

// --- classes ---
export interface Slot { day: number; start: string; end: string; room: string }
export const DAY_LABEL = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
export const slotText = (s: Slot) => `${DAY_LABEL[s.day] ?? "?"} ${s.start}–${s.end}${s.room ? ` · ${s.room}` : ""}`;
export interface ClassRow {
  id: string; term_id: string; term_title: string; term_status: TermStatus; course_id: string; course_code: string;
  course_title: string; units: number; title: string; section: string; teacher_id: string | null; teacher_name: string | null;
  unit_id: string | null; unit_name: string | null; capacity: number | null; waitlist: boolean; enrolled: number; completed: number;
  waitlisted: number; schedule: Slot[]; location: string; status: "active" | "archived"; exams: number; content: number;
  external_id: string; can_edit: boolean; can_enroll: boolean; created_at: string;
}
export const classLabel = (c: Pick<ClassRow, "course_code" | "course_title" | "title" | "section">) =>
  `${c.title || c.course_title}${c.section ? ` (گروه ${c.section})` : ""}`;
export const orgClassAdminList = async (orgId: string, termId: string | null) =>
  (await sbRpc<ClassRow[]>("lexa_org_class_admin_list", { o: orgId, p_term: termId })) ?? [];
export interface ClassInput {
  term_id: string; course_id: string; title: string; section: string; teacher_id: string | null; unit_id: string | null;
  capacity: number | null; waitlist: boolean; schedule: Slot[]; location: string; external_id: string; status: "active" | "archived";
}
export const orgClassUpsert = (orgId: string, id: string | null, p: ClassInput) =>
  sbRpc<string>("lexa_org_class_upsert", { o: orgId, k_id: id, p });
export type BulkAction = "teacher" | "capacity" | "archive" | "restore";
export const orgClassesBulk = (orgId: string, ids: string[], action: BulkAction, p: Record<string, unknown> = {}, reason = "") =>
  sbRpc<number>("lexa_org_classes_bulk", { o: orgId, ids, action, p, reason });
export interface TeacherPick { user_id: string; username: string; display_name: string | null; avatar_url: string | null; base_role: string; classes: number }
export const orgTeacherPick = async (orgId: string) => (await sbRpc<TeacherPick[]>("lexa_org_teacher_pick", { o: orgId })) ?? [];

export type RosterState = "enrolled" | "completed" | "dropped" | "waitlisted";
export const ROSTER_STATE_LABEL: Record<RosterState, string> = { enrolled: "ثبت‌نام", completed: "گذرانده", dropped: "حذف‌شده", waitlisted: "لیست انتظار" };
export interface RosterRow {
  student_id: string; org_username: string; full_name: string; student_no: string; student_status: string; field: string;
  entry_year: string; unit_name: string | null; state: RosterState; pos: number | null; since: string; final_score: number | null;
}
export const orgClassRoster = async (classId: string) => (await sbRpc<RosterRow[]>("lexa_org_class_roster", { k: classId })) ?? [];
export interface StudentPick { id: string; org_username: string; full_name: string; student_no: string; status: string; field: string; entry_year: string; unit_name: string | null }
export const orgStudentPick = async (orgId: string, q: string) =>
  (await sbRpc<StudentPick[]>("lexa_org_student_pick", { o: orgId, q, lim: 30 })) ?? [];

// --- enrolment ---
export type EnrollResult =
  | "enrolled" | "waitlisted" | "already_waitlisted" | "full" | "already" | "prereq_missing" | "not_active" | "not_found"
  | "dropped" | "unlisted" | "not_enrolled" | "promoted" | "moved" | "closed" | "window_closed";
export const ENROLL_RESULT: Record<EnrollResult, { label: string; tone: "ok" | "warn" | "bad" | "info" | "muted" }> = {
  enrolled: { label: "ثبت‌نام شد", tone: "ok" },
  waitlisted: { label: "به لیست انتظار رفت", tone: "info" },
  already_waitlisted: { label: "از قبل در لیست انتظار", tone: "muted" },
  full: { label: "ظرفیت پر", tone: "bad" },
  already: { label: "از قبل ثبت‌نام", tone: "muted" },
  prereq_missing: { label: "پیش‌نیاز را نگذرانده", tone: "warn" },
  not_active: { label: "دانشجو فعال نیست", tone: "warn" },
  not_found: { label: "در فهرست مرکز نیست", tone: "bad" },
  dropped: { label: "حذف شد", tone: "ok" },
  unlisted: { label: "از لیست انتظار برداشته شد", tone: "ok" },
  not_enrolled: { label: "ثبت‌نام نبود", tone: "muted" },
  promoted: { label: "از لیست انتظار وارد کلاس شد", tone: "info" },
  moved: { label: "منتقل شد", tone: "ok" },
  closed: { label: "کلاس یا ترم بسته است", tone: "bad" },
  window_closed: { label: "خارج از مهلت ثبت‌نام", tone: "bad" },
};
export interface EnrollRow { ref: string; result: EnrollResult; student_id: string | null }
export const orgEnroll = async (classId: string, refs: string[], mode: "enroll" | "drop", force = false, reason = "") =>
  (await sbRpc<EnrollRow[]>("lexa_org_enroll_v2", { k: classId, refs, mode, force, reason })) ?? [];
export const orgEnrollTransfer = async (fromId: string, toId: string, ids: string[], force = false, reason = "") =>
  (await sbRpc<{ student_id: string; result: EnrollResult }[]>("lexa_org_enroll_transfer", { from_k: fromId, to_k: toId, ids, force, reason })) ?? [];
export const orgWaitlistSet = (classId: string, ids: string[], action: "remove" | "top" | "promote", reason = "") =>
  sbRpc<number>("lexa_org_waitlist_set", { k: classId, ids, action, reason });

export function tally(rows: { result: EnrollResult }[]): [EnrollResult, number][] {
  const m = new Map<EnrollResult, number>();
  for (const r of rows) m.set(r.result, (m.get(r.result) ?? 0) + 1);
  return [...m];
}

// --- cohorts ---
export interface CohortRow {
  id: string; name: string; code: string; entry_year: string; note: string; unit_id: string | null; unit_name: string | null;
  status: "active" | "archived"; members: number; active_members: number; can_edit: boolean; created_at: string;
}
export const orgCohortList = async (orgId: string) => (await sbRpc<CohortRow[]>("lexa_org_cohort_list", { o: orgId })) ?? [];
export interface CohortInput { name: string; code: string; entry_year: string; note: string; unit_id: string | null; status: "active" | "archived" }
export const orgCohortUpsert = (orgId: string, id: string | null, p: CohortInput) =>
  sbRpc<string>("lexa_org_cohort_upsert", { o: orgId, c_id: id, p });
export const orgCohortDelete = (cohortId: string, reason: string) => sbRpc<string>("lexa_org_cohort_delete", { c: cohortId, reason });
export interface CohortMember { student_id: string; org_username: string; full_name: string; student_no: string; status: string; field: string; entry_year: string; unit_name: string | null; added_at: string }
export const orgCohortMembers = async (cohortId: string) => (await sbRpc<CohortMember[]>("lexa_org_cohort_members", { c: cohortId })) ?? [];
export const orgCohortSet = async (cohortId: string, refs: string[], remove = false) =>
  (await sbRpc<{ ref: string; result: string }[]>("lexa_org_cohort_set", { c: cohortId, refs, remove })) ?? [];
export const orgCohortFill = (cohortId: string, p: { entry_year?: string; field?: string; unit_id?: string | null; only_active?: boolean }) =>
  sbRpc<number>("lexa_org_cohort_fill", { c: cohortId, p });
export interface CohortEnrollSummary { class_id: string; title: string; results: Partial<Record<EnrollResult, number>> }
export const orgCohortEnroll = async (cohortId: string, classIds: string[], force = false, reason = "") =>
  (await sbRpc<CohortEnrollSummary[]>("lexa_org_cohort_enroll", { c: cohortId, class_ids: classIds, force, reason })) ?? [];

// --- helpers ---
/** a pasted list (lines, commas, tabs, Persian commas) -> unique trimmed refs */
export function parseRefs(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/[\n\r,،;\t]+/)) {
    const v = raw.trim().replace(/^@/, "");
    if (v && !seen.has(v.toLowerCase())) { seen.add(v.toLowerCase()); out.push(v); }
  }
  return out;
}
/** ISO -> value of <input type="datetime-local"> in local time */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
export const faDay = (iso: string | null | undefined) =>
  iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" }) : "—";

const ERRORS: [RegExp, string][] = [
  [/enrolment window closed/i, "مهلت ثبت‌نام و حذف و اضافه‌ی این ترم باز نیست. برای ثبت خارج از مهلت، «بدون رعایت قواعد» را با دلیل بزنید."],
  [/term closed/i, "این ترم بسته شده است؛ ثبت‌نام و تغییر کلاس ممکن نیست."],
  [/class archived/i, "این کلاس بایگانی است."],
  [/reason required/i, "برای این کار دلیل (حداقل ۳ حرف) لازم است."],
  [/forbidden: ?override/i, "نادیده گرفتن مهلت، ظرفیت یا پیش‌نیاز فقط با دسترسی ثبت‌نام یا تقویم در کل مرکز ممکن است."],
  [/forbidden: ?org\.terms/i, "اجازه‌ی مدیریت ترم و تقویم را ندارید."],
  [/forbidden: ?org\.classes/i, "اجازه‌ی مدیریت درس و کلاس را در این بخش ندارید."],
  [/forbidden: ?org\.enroll/i, "اجازه‌ی ثبت‌نام در این کلاس را ندارید."],
  [/forbidden: ?org\.students/i, "اجازه‌ی مدیریت دانشجو و گروه ورودی را در این بخش ندارید."],
  [/bad term title/i, "عنوان ترم باید ۱ تا ۶۰ حرف باشد."],
  [/bad term code/i, "کد ترم حداکثر ۳۰ حرف است."],
  [/bad dates/i, "تاریخ‌ها درست نیستند؛ پایان باید بعد از شروع باشد."],
  [/term has classes/i, "ترمی که کلاس دارد حذف نمی‌شود؛ آن را ببندید."],
  [/bad subject title/i, "عنوان درس باید ۱ تا ۱۲۰ حرف باشد."],
  [/bad subject code/i, "کد درس حداکثر ۳۰ حرف است."],
  [/subject code taken/i, "درسی با همین کد وجود دارد."],
  [/bad weights/i, "جمع وزن‌های نمره باید دقیقاً ۱۰۰ باشد."],
  [/bad prerequisites/i, "پیش‌نیازها درست نیستند (حداکثر ۲۰ و نه خود درس)."],
  [/bad schedule/i, "برنامه‌ی هفتگی درست نیست؛ ساعت پایان باید بعد از شروع باشد."],
  [/bad capacity/i, "ظرفیت باید بین ۱ تا ۵۰۰۰ باشد یا خالی (بدون سقف)."],
  [/external id taken/i, "شناسه‌ی بیرونی این کلاس تکراری است."],
  [/teacher_not_member/i, "استاد انتخاب‌شده عضو فعال مرکز نیست."],
  [/bad cohort name/i, "نام گروه ورودی باید ۱ تا ۸۰ حرف باشد."],
  [/cohort name taken/i, "گروه ورودی‌ای با همین نام هست."],
  [/too many cohorts/i, "حداکثر ۵۰۰ گروه ورودی می‌توانید داشته باشید."],
  [/empty rule/i, "حداقل یکی از سال ورود، رشته یا واحد را تعیین کنید."],
  [/bad_batch/i, "تعداد موارد در هر بار باید بین ۱ تا ۱۰۰۰ باشد."],
  [/org_not_active/i, "پنل مرکز فعال نیست."],
  [/not_found/i, "پیدا نشد؛ شاید حذف شده باشد. صفحه را تازه کنید."],
  [/PGRST202|Could not find the function/i, "فایل 015_terms_classes.sql هنوز روی پایگاه داده اجرا نشده است."],
];
export function orgTeachingError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e ?? "");
  for (const [re, msg] of ERRORS) if (re.test(raw)) return msg;
  return orgConsoleError(e);
}
