"use client";
/* Reads for study time: "my stats", centre dashboard and reports, class activity, Lexa admin
 * overview (phase 4, supabase/009_study_time.sql). Writing is done by src/lib/study-tracker.ts. */
import { sbUser } from "@/lib/supabase";
import { HttpError, sbRpc } from "./rest";
import { toCsv } from "./org-accounts";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface StudyDay { day: string; seconds: number; byKind: Record<string, number>; byOrg: Record<string, number> }

export async function myStudy(days = 90): Promise<StudyDay[]> {
  if (!sbUser()) return [];
  const rows = await sbRpc<any[]>("lexa_my_study", { days });
  return (rows ?? []).map((r) => ({ day: r.day, seconds: Number(r.seconds) || 0, byKind: r.by_kind ?? {}, byOrg: r.by_org ?? {} }));
}

export async function myLearning(days = 90): Promise<Record<string, { n: number; total: number }>> {
  if (!sbUser()) return {};
  const rows = await sbRpc<any[]>("lexa_my_learning", { days });
  const out: Record<string, { n: number; total: number }> = {};
  for (const r of rows ?? []) out[r.kind] = { n: Number(r.n) || 0, total: Number(r.total) || 0 };
  return out;
}

export const forgetMyStudy = () => sbRpc<number>("lexa_study_forget");

// --- dates on the Tehran calendar ---
export function tehranToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 800; d = addDays(d, 1)) out.push(d);
  return out;
}
export const faDay = (day: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("fa-IR-u-ca-persian", { timeZone: "UTC", ...opts });

// --- formatting ---
const fa = (n: number) => n.toLocaleString("fa-IR");
/** "۲ ساعت و ۱۵ دقیقه", "۴۵ دقیقه", "کمتر از یک دقیقه" */
export function fmtDuration(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  if (m < 1) return seconds > 0 ? "کمتر از یک دقیقه" : "۰";
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${fa(r)} دقیقه`;
  return r ? `${fa(h)} ساعت و ${fa(r)} دقیقه` : `${fa(h)} ساعت`;
}
export const hours = (seconds: number, digits = 1) =>
  (Math.max(0, seconds) / 3600).toLocaleString("fa-IR", { maximumFractionDigits: digits });

export const KIND_LABELS: Record<string, string> = {
  course: "دوره‌های Lexa",
  tcourse: "دوره‌های مدرسان",
  post: "مطالب",
  book: "جزوه و کتاب",
  exam: "آزمون رسمی",
  flashcards: "فلش‌کارت",
  quiz: "تمرین و تست",
  law: "متن قانون",
  other: "سایر بخش‌ها",
};
export const EVENT_LABELS: Record<string, string> = {
  lesson_done: "جلسهٔ تمام‌شده",
  quiz_done: "تمرین تمام‌شده",
  cards_reviewed: "مرور فلش‌کارت",
  exam_done: "آزمون تحویل‌شده",
};

// --- my stats ---
export interface StudySummary {
  today: number;
  last7: number;
  last30: number;
  total: number;
  streak: number;
  bestDay: { day: string; seconds: number } | null;
  activeDays30: number;
  byKind: [string, number][];
}

/** streak = consecutive days with at least 5 minutes, ending today (or yesterday if today is still empty) */
export function summarize(rows: StudyDay[], today = tehranToday()): StudySummary {
  const by = new Map(rows.map((r) => [r.day, r.seconds]));
  const sumSince = (n: number) => rows.filter((r) => r.day > addDays(today, -n)).reduce((a, r) => a + r.seconds, 0);
  let streak = 0;
  let d = (by.get(today) ?? 0) >= 300 ? today : addDays(today, -1);
  while ((by.get(d) ?? 0) >= 300 && streak < 1000) { streak++; d = addDays(d, -1); }
  const kinds = new Map<string, number>();
  for (const r of rows) for (const [k, v] of Object.entries(r.byKind)) kinds.set(k, (kinds.get(k) ?? 0) + (Number(v) || 0));
  const best = rows.reduce<StudyDay | null>((a, r) => (!a || r.seconds > a.seconds ? r : a), null);
  return {
    today: by.get(today) ?? 0,
    last7: sumSince(7),
    last30: sumSince(30),
    total: rows.reduce((a, r) => a + r.seconds, 0),
    streak,
    bestDay: best && best.seconds > 0 ? { day: best.day, seconds: best.seconds } : null,
    activeDays30: rows.filter((r) => r.day > addDays(today, -30) && r.seconds > 0).length,
    byKind: Array.from(kinds.entries()).sort((a, b) => b[1] - a[1]),
  };
}

// --- centre ---
export interface OrgDashboard {
  students: number;
  seats: number;
  active7d: number;
  active30d: number;
  seconds7d: number;
  seconds30d: number;
  orgSeconds30d: number;
  classes: number;
  examsUpcoming: number;
  avgFinal: number | null;
  daily: { day: string; seconds: number; users: number }[];
}
export async function orgDashboard(orgId: string): Promise<OrgDashboard> {
  const r = await sbRpc<any>("lexa_org_dashboard", { o: orgId });
  return {
    students: Number(r?.students) || 0, seats: Number(r?.seats) || 0, active7d: Number(r?.active_7d) || 0,
    active30d: Number(r?.active_30d) || 0, seconds7d: Number(r?.seconds_7d) || 0, seconds30d: Number(r?.seconds_30d) || 0,
    orgSeconds30d: Number(r?.org_seconds_30d) || 0, classes: Number(r?.classes) || 0, examsUpcoming: Number(r?.exams_upcoming) || 0,
    avgFinal: r?.avg_final === null || r?.avg_final === undefined ? null : Number(r.avg_final),
    daily: ((r?.daily ?? []) as any[]).map((d) => ({ day: d.day, seconds: Number(d.seconds) || 0, users: Number(d.users) || 0 })),
  };
}

export interface StudentStudyRow {
  studentId: string;
  username: string;
  fullName: string;
  studentNo: string;
  status: string;
  seconds: number;
  orgSeconds: number;
  activeDays: number;
  lastDay: string | null;
  events: number;
}
export async function orgStudyReport(orgId: string, from: string, to: string): Promise<StudentStudyRow[]> {
  const rows = await sbRpc<any[]>("lexa_org_study_report", { o: orgId, d_from: from, d_to: to });
  return (rows ?? []).map((r) => ({
    studentId: r.student_id, username: r.org_username, fullName: r.full_name ?? "", studentNo: r.student_no ?? "", status: r.status,
    seconds: Number(r.seconds) || 0, orgSeconds: Number(r.org_seconds) || 0, activeDays: Number(r.active_days) || 0,
    lastDay: r.last_day ?? null, events: Number(r.events) || 0,
  }));
}

export function studyReportCsv(orgName: string, from: string, to: string, rows: StudentStudyRow[]): { name: string; text: string } {
  const head = ["نام کاربری", "شماره دانشجویی", "نام", "وضعیت", "زمان مطالعه (دقیقه)", "زمان روی محتوای مرکز (دقیقه)", "روزهای فعال", "آخرین روز فعال", "فعالیت‌های ثبت‌شده"];
  const body = rows.map((r) => [r.username, r.studentNo, r.fullName, r.status, Math.round(r.seconds / 60), Math.round(r.orgSeconds / 60), r.activeDays, r.lastDay ?? "", r.events]);
  const safe = orgName.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 40) || "org";
  return { name: `study-${safe}-${from}-${to}.csv`, text: toCsv([head, ...body]) };
}

export interface TeacherClassRow {
  classId: string;
  courseTitle: string;
  title: string;
  termTitle: string;
  students: number;
  active7d: number;
  seconds7d: number;
  secondsPrev7d: number;
  avgMidterm: number | null;
  avgFinal: number | null;
  examsUpcoming: number;
}
const nn = (v: unknown) => (v === null || v === undefined ? null : Number(v));
export async function teacherOverview(orgId: string): Promise<TeacherClassRow[]> {
  const rows = await sbRpc<any[]>("lexa_teacher_overview", { o: orgId });
  return (rows ?? []).map((r) => ({
    classId: r.class_id, courseTitle: r.course_title ?? "", title: r.title ?? "", termTitle: r.term_title ?? "",
    students: Number(r.students) || 0, active7d: Number(r.active_7d) || 0, seconds7d: Number(r.seconds_7d) || 0,
    secondsPrev7d: Number(r.seconds_prev_7d) || 0, avgMidterm: nn(r.avg_midterm), avgFinal: nn(r.avg_final),
    examsUpcoming: Number(r.exams_upcoming) || 0,
  }));
}

export interface ClassStudyRow {
  studentId: string;
  username: string;
  fullName: string;
  studentNo: string;
  enrollment: string;
  seconds: number;
  orgSeconds: number;
  activeDays: number;
  lastDay: string | null;
  recentSeconds: number;
  prevSeconds: number;
  grades: Record<string, number>;
}
export async function classStudyReport(classId: string, from: string, to: string): Promise<ClassStudyRow[]> {
  const rows = await sbRpc<any[]>("lexa_class_study_report", { k: classId, d_from: from, d_to: to });
  return (rows ?? []).map((r) => ({
    studentId: r.student_id, username: r.org_username, fullName: r.full_name ?? "", studentNo: r.student_no ?? "", enrollment: r.enrollment,
    seconds: Number(r.seconds) || 0, orgSeconds: Number(r.org_seconds) || 0, activeDays: Number(r.active_days) || 0,
    lastDay: r.last_day ?? null, recentSeconds: Number(r.recent_seconds) || 0, prevSeconds: Number(r.prev_seconds) || 0,
    grades: Object.fromEntries(Object.entries((r.grades ?? {}) as Record<string, unknown>).map(([k, v]) => [k, Number(v)])),
  }));
}

/** reasons a student may be falling behind (Persian, empty = fine). Rules are deliberately simple
 *  and shown to the teacher as hints, never to the student. */
export function fallingBehind(r: Pick<ClassStudyRow, "recentSeconds" | "prevSeconds" | "grades" | "lastDay">, today = tehranToday()): string[] {
  const out: string[] = [];
  if (r.prevSeconds >= 3600 && r.recentSeconds < r.prevSeconds * 0.5) out.push("زمان مطالعه نصف شده");
  if (r.recentSeconds < 1800) out.push("کمتر از نیم ساعت در دو هفتهٔ اخیر");
  if (!r.lastDay || r.lastDay < addDays(today, -10)) out.push("بیش از ۱۰ روز بدون فعالیت");
  const mid = r.grades.midterm;
  if (mid !== undefined && mid < 10) out.push("میان‌ترم زیر ۱۰");
  return out;
}

// --- Lexa admin ---
export interface AdminStudyOverview {
  usersActive: number;
  officialActive: number;
  seconds: number;
  officialSeconds: number;
  daily: { day: string; seconds: number; users: number }[];
  orgs: { orgId: string; name: string; status: string; students: number; activeStudents: number; orgSeconds: number }[];
}
export async function adminStudyOverview(from: string, to: string): Promise<AdminStudyOverview> {
  const r = await sbRpc<any>("lexa_admin_study_overview", { d_from: from, d_to: to });
  return {
    usersActive: Number(r?.users_active) || 0, officialActive: Number(r?.official_active) || 0,
    seconds: Number(r?.seconds) || 0, officialSeconds: Number(r?.official_seconds) || 0,
    daily: ((r?.daily ?? []) as any[]).map((d) => ({ day: d.day, seconds: Number(d.seconds) || 0, users: Number(d.users) || 0 })),
    orgs: ((r?.orgs ?? []) as any[]).map((o) => ({
      orgId: o.org_id, name: o.name ?? "", status: o.status ?? "", students: Number(o.students) || 0,
      activeStudents: Number(o.active_students) || 0, orgSeconds: Number(o.org_seconds) || 0,
    })),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const ERRORS: [RegExp, string][] = [
  [/mfa required/, "برای دیدن آمار دانشجوها باید ورود دومرحله‌ای را تأیید کنید."],
  [/not a manager|not_staff/, "این گزارش فقط برای مدیران یا مدرس همین کلاس است."],
  [/admin only/, "این گزارش فقط برای مدیر Lexa است."],
  [/bad_input/, "بازهٔ تاریخ نامعتبر است (حداکثر ۴۰۰ روز)."],
  [/not signed in/, "ابتدا وارد حساب کاربری خود شوید."],
];
export function studyError(e: unknown): string {
  const raw = e instanceof HttpError ? `${e.message} ${e.code}` : e instanceof Error ? e.message : String(e ?? "");
  for (const [re, msg] of ERRORS) if (re.test(raw)) return msg;
  if (e instanceof TypeError) return "اتصال به Lexa برقرار نشد؛ اتصال اینترنت را بررسی کنید.";
  return "گزارش بارگذاری نشد. لطفاً دوباره تلاش کنید.";
}
