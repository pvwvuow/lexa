"use client";
/* Official accounts made by education centres (phase 1 of docs/ORG_LEARNING.md).
 * Account creation, passwords, bans and centre sign-in go through the Edge Function
 * supabase/functions/org-auth (service key stays on the server); reads go through the
 * RPCs in supabase/006_org_accounts.sql. */
import { sbAdoptSession, sbFetch, sbUser } from "@/lib/supabase";
import { HttpError, sbRpc, sbSelect } from "./rest";

export type StudentStatus = "active" | "suspended" | "graduated" | "withdrawn";
export type AccessAfterExit = "open" | "limited" | "until";

export const STUDENT_STATUSES: { key: StudentStatus; label: string }[] = [
  { key: "active", label: "فعال" },
  { key: "suspended", label: "معلق" },
  { key: "graduated", label: "فارغ‌التحصیل" },
  { key: "withdrawn", label: "انصرافی" },
];
export const ACCESS_AFTER_EXIT: { key: AccessAfterExit; label: string }[] = [
  { key: "open", label: "دسترسی به محتوای مرکز باز بماند" },
  { key: "limited", label: "فقط محتوای عمومی" },
  { key: "until", label: "باز تا تاریخ مشخص" },
];
export const statusLabel = (s: string) => STUDENT_STATUSES.find((x) => x.key === s)?.label ?? s;

/** internal e-mail of a centre-made account: never show it in the UI */
export function isInternalEmail(email: string | null | undefined): boolean {
  return /^u_[0-9a-f]{32}@/i.test(email ?? "");
}

export const ORG_USERNAME_RE = /^[A-Za-z0-9._-]{2,40}$/;
export const ORG_CODE_RE = /^[a-z0-9][a-z0-9-]{1,23}$/;

// --- errors ---
const ERRORS: [RegExp, string][] = [
  [/bad_credentials/, "کد مرکز، نام کاربری یا رمز عبور نادرست است."],
  [/too_many_attempts/, "تلاش‌های ناموفق زیاد بود؛ ۱۵ دقیقهٔ دیگر دوباره امتحان کنید."],
  [/mfa_required|mfa required/, "برای این کار باید ورود دومرحله‌ای را تأیید کنید."],
  [/not_manager|not a manager/, "این کار فقط از مدیران این مرکز آموزشی ساخته است."],
  [/org_not_active|not active/, "این مرکز آموزشی فعال نیست یا اعتبار آن به پایان رسیده است."],
  [/no_student_seats/, "ظرفیت حساب‌های دانشجویی این مرکز تکمیل است."],
  [/no_teacher_seats/, "ظرفیت مدرسان این مرکز تکمیل است."],
  [/bad_username:(\d+)/, "نام کاربری ردیف $1 نامعتبر است (۲ تا ۴۰ نویسهٔ لاتین، رقم، نقطه، خط تیره یا زیرخط)."],
  [/duplicate_username:(\d+)/, "نام کاربری ردیف $1 در فهرست تکراری است."],
  [/username_taken/, "این نام کاربری در مرکز قبلاً استفاده شده است."],
  [/bad_batch/, "فهرست خالی است یا بیش از ۳۰۰ ردیف دارد."],
  [/not_managed/, "رمز حسابی که خود کاربر ساخته (با کد فعال‌سازی وصل شده) را مرکز نمی‌تواند تغییر دهد."],
  [/student_not_found/, "این دانشجو در فهرست مرکز پیدا نشد."],
  [/already_linked/, "این ردیف قبلاً به یک حساب وصل شده است."],
  [/weak_password/, "رمز باید دست‌کم ۸ نویسه باشد و نام کاربری یا شمارهٔ دانشجویی در آن نباشد."],
  [/nothing_to_change/, "رمز این حساب قبلاً تغییر کرده است."],
  [/change the first password first/, "اول رمز اولیه را تغییر دهید."],
  [/not_signed_in|not signed in/, "ابتدا وارد حساب کاربری خود شوید."],
  [/admin only/, "این کار فقط از مدیر Lexa ساخته است."],
  [/not_configured/, "سرویس حساب‌های مرکز هنوز راه‌اندازی نشده است."],
  [/row-level security|42501/, "اجازهٔ انجام این کار را ندارید."],
];

export function orgAccountError(e: unknown): string {
  const raw = e instanceof HttpError ? `${e.message} ${e.code}` : e instanceof Error ? e.message : String(e ?? "");
  for (const [re, msg] of ERRORS) {
    const m = raw.match(re);
    if (m) return msg.replace("$1", m[1] ?? "");
  }
  if (e instanceof TypeError) return "اتصال به Lexa برقرار نشد؛ اتصال اینترنت را بررسی کنید.";
  return "درخواست انجام نشد. لطفاً دوباره تلاش کنید.";
}

// --- Edge Function ---
async function orgAuth<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const res = await sbFetch("/functions/v1/org-auth", { method: "POST", body: JSON.stringify({ action, ...payload }) });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new HttpError(res.status, String(j.error ?? `http ${res.status}`), String(j.error ?? ""));
  return j as T;
}

/** sign in with centre code + centre username; returns whether the first password must change */
export async function orgSignIn(orgCode: string, username: string, password: string): Promise<{ mustChange: boolean }> {
  const r = await orgAuth<{ access_token: string; refresh_token: string; user: { id: string }; must_change_password: boolean }>(
    "login", { org: orgCode.trim().toLowerCase(), username: username.trim(), password },
  );
  sbAdoptSession({ access_token: r.access_token, refresh_token: r.refresh_token, user: { id: r.user.id, email: "" } });
  return { mustChange: !!r.must_change_password };
}

export const setFirstPassword = (newPassword: string, acceptTerms: boolean) =>
  orgAuth<{ ok: boolean }>("set_password", { new_password: newPassword, accept_terms: acceptTerms });

export interface PersonInput {
  kind: "student" | "staff";
  username: string;
  studentNo: string;
  externalId: string;
  fullName: string;
  field: string;
  entryYear: string;
  existingAccount: boolean;
}
export interface ProvisionResult {
  row: number;
  username: string;
  result: "created" | "updated" | "code" | "exists" | "error";
  password?: string;
  code?: string;
  error?: string;
}

export async function provisionPeople(orgId: string, people: PersonInput[]): Promise<ProvisionResult[]> {
  const r = await orgAuth<{ results: ProvisionResult[] }>("provision", {
    org_id: orgId,
    people: people.map((p) => ({
      kind: p.kind, username: p.username, student_no: p.studentNo, external_id: p.externalId,
      full_name: p.fullName, field: p.field, entry_year: p.entryYear, existing_account: p.existingAccount,
    })),
  });
  return r.results ?? [];
}

export const resetPassword = (orgId: string, userId: string) =>
  orgAuth<{ password: string; sessions_revoked: boolean }>("reset_password", { org_id: orgId, user_id: userId });

export const setStudentStatus = (orgId: string, studentId: string, status: StudentStatus, after: AccessAfterExit, until: string | null) =>
  orgAuth<{ ok: boolean }>("set_status", { org_id: orgId, student_id: studentId, status, access_after_exit: after, access_until: until });

export const issueActivationCode = (orgId: string, studentId: string) =>
  orgAuth<{ code: string; username: string }>("issue_code", { org_id: orgId, student_id: studentId });

// --- reads (RPC / RLS) ---
export interface MyOrgAccount {
  orgId: string;
  orgName: string;
  orgCode: string;
  orgUsername: string;
  status: StudentStatus;
  termsAcceptedAt: string | null;
  mustChangePassword: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function myOrgAccounts(): Promise<MyOrgAccount[]> {
  if (!sbUser()) return [];
  const rows = await sbRpc<any[]>("lexa_my_org_accounts");
  return (rows ?? []).map((r) => ({
    orgId: r.org_id, orgName: r.org_name ?? "", orgCode: r.org_code ?? "", orgUsername: r.org_username ?? "",
    status: r.status, termsAcceptedAt: r.terms_accepted_at ?? null, mustChangePassword: !!r.must_change_password,
  }));
}

/** must the signed-in account still change its first password? (centre-made accounts only) */
export async function mustChangePassword(): Promise<boolean> {
  const u = sbUser();
  if (!u) return false;
  const rows = await sbSelect<{ must_change_password: boolean }>("lexa_account_flags", `user_id=eq.${u.id}&select=must_change_password&limit=1`);
  return !!rows[0]?.must_change_password;
}

export const acceptOrgTerms = (orgId: string) => sbRpc<string>("lexa_org_accept_terms", { o: orgId });

/** "ok" (with the centre id), or a reason the code did not work */
export async function redeemActivationCode(code: string): Promise<{ ok: true; orgId: string } | { ok: false; reason: string }> {
  const r = String(await sbRpc<string>("lexa_org_redeem_code", { code }));
  if (r.startsWith("ok:")) return { ok: true, orgId: r.slice(3) };
  const reasons: Record<string, string> = {
    limit: "تلاش‌های ناموفق زیاد بود؛ یک ساعت دیگر دوباره امتحان کنید.",
    expired: "اعتبار این کد تمام شده است؛ از مرکز آموزشی کد تازه بگیرید.",
    invalid: "کد فعال‌سازی نادرست است.",
    already: "حساب شما قبلاً به این مرکز وصل شده است.",
    inactive: "این مرکز آموزشی در حال حاضر فعال نیست.",
    username_taken: "نام کاربری این ردیف در مرکز تکراری است؛ با مرکز آموزشی تماس بگیرید.",
  };
  return { ok: false, reason: reasons[r] ?? "کد فعال‌سازی پذیرفته نشد." };
}

export interface RosterRow {
  id: string;
  userId: string | null;
  orgUsername: string;
  studentNo: string;
  externalId: string;
  fullName: string;
  field: string;
  entryYear: string;
  status: StudentStatus;
  accessAfterExit: AccessAfterExit;
  accessUntil: string | null;
  officialSince: string | null;
  termsAcceptedAt: string | null;
  managed: boolean;
  mustChangePassword: boolean;
  lastSignInAt: string | null;
  pendingCode: boolean;
  createdAt: string;
}

export async function orgRoster(orgId: string): Promise<RosterRow[]> {
  const rows = await sbRpc<any[]>("lexa_org_roster", { o: orgId });
  return (rows ?? []).map((r) => ({
    id: r.id, userId: r.user_id ?? null, orgUsername: r.org_username, studentNo: r.student_no ?? "",
    externalId: r.external_id ?? "", fullName: r.full_name ?? "", field: r.field ?? "", entryYear: r.entry_year ?? "",
    status: r.status, accessAfterExit: r.access_after_exit, accessUntil: r.access_until ?? null,
    officialSince: r.official_since ?? null, termsAcceptedAt: r.terms_accepted_at ?? null, managed: !!r.managed,
    mustChangePassword: !!r.must_change_password, lastSignInAt: r.last_sign_in_at ?? null,
    pendingCode: !!r.pending_code, createdAt: r.created_at,
  }));
}

export interface OrgCapacity { studentSeats: number; studentsUsed: number; teacherSeats: number; teachersUsed: number; code: string }
export async function orgCapacity(orgId: string): Promise<OrgCapacity | null> {
  const rows = await sbRpc<any[]>("lexa_org_capacity", { o: orgId });
  const r = rows?.[0];
  return r ? {
    studentSeats: Number(r.student_seats) || 0, studentsUsed: Number(r.students_used) || 0,
    teacherSeats: Number(r.teacher_seats) || 0, teachersUsed: Number(r.teachers_used) || 0, code: r.code ?? "",
  } : null;
}

export interface AuditRow { id: number; at: string; actor: string | null; action: string; target: string | null; detail: Record<string, unknown> }
export async function orgAuditLog(orgId: string, limit = 200): Promise<AuditRow[]> {
  const rows = await sbSelect<any>("lexa_audit_log", `org_id=eq.${orgId}&select=*&order=at.desc&limit=${Math.min(limit, 1000)}`);
  return rows.map((r) => ({ id: Number(r.id), at: r.at, actor: r.actor, action: r.action, target: r.target, detail: r.detail ?? {} }));
}

export async function orgBadges(userIds: string[]): Promise<{ userId: string; orgName: string; orgSlug: string; status: StudentStatus }[]> {
  if (!sbUser() || !userIds.length) return [];
  const rows = await sbRpc<any[]>("lexa_org_badges", { ids: userIds.slice(0, 200) });
  return (rows ?? []).map((r) => ({ userId: r.user_id, orgName: r.org_name, orgSlug: r.org_slug, status: r.status }));
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** "فارغ‌التحصیل [مرکز]" style label for a profile */
export function badgeLabel(b: { orgName: string; status: string }): string {
  if (b.status === "graduated") return `فارغ‌التحصیل ${b.orgName}`;
  if (b.status === "withdrawn") return `انصرافی ${b.orgName}`;
  return `دانشجوی ${b.orgName}`;
}

export const adminSetOrgAccounts = (orgId: string, code: string, studentSeats: number) =>
  sbRpc<string>("lexa_admin_set_org_accounts", { o: orgId, new_code: code, new_student_seats: studentSeats });

// --- CSV ---
/** parse CSV / TSV text (quotes, BOM, Excel ";" exports) into rows of cells */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const first = src.split(/\r?\n/, 1)[0] ?? "";
  const counts = [",", ";", "\t"].map((d) => [d, first.split(d).length] as const);
  const delim = counts.sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows.map((r) => r.map((c) => c.trim()));
}

const HEADER_KEYS: Record<keyof PersonInput, string[]> = {
  kind: ["kind", "type", "نوع", "نقش"],
  username: ["username", "user", "login", "نام کاربری", "نام‌کاربری"],
  studentNo: ["student_no", "studentno", "student number", "شماره دانشجویی", "شماره‌دانشجویی", "شماره"],
  externalId: ["external_id", "id", "شناسه", "کد"],
  fullName: ["name", "full_name", "fullname", "نام", "نام و نام خانوادگی", "نام کامل"],
  field: ["field", "major", "رشته"],
  entryYear: ["entry_year", "entry", "year", "ورودی", "سال ورود"],
  existingAccount: ["existing", "existing_account", "has_account", "حساب قبلی", "حساب دارد"],
};
const norm = (s: string) => s.toLowerCase().replace(/[\\u200c\s_]+/g, " ").trim();

/** map CSV rows (first row = headers) to people; unknown columns are ignored */
export function peopleFromCsv(rows: string[][]): { people: PersonInput[]; missing: string[] } {
  if (!rows.length) return { people: [], missing: ["username"] };
  const head = rows[0].map(norm);
  const col = {} as Record<keyof PersonInput, number>;
  (Object.keys(HEADER_KEYS) as (keyof PersonInput)[]).forEach((k) => {
    col[k] = head.findIndex((h) => HEADER_KEYS[k].map(norm).includes(h));
  });
  const missing = col.username < 0 && col.studentNo < 0 ? ["username"] : [];
  const yes = (v: string) => /^(1|yes|true|y|بله|بلی|دارد|آری)$/i.test(v.trim());
  const get = (r: string[], k: keyof PersonInput) => (col[k] >= 0 ? r[col[k]] ?? "" : "");
  const people = rows.slice(1).map((r) => {
    const kind = /^(staff|teacher|استاد|مدرس)$/i.test(get(r, "kind").trim()) ? "staff" as const : "student" as const;
    const studentNo = toLatinDigits(get(r, "studentNo"));
    return {
      kind,
      username: toLatinDigits(get(r, "username")) || studentNo,
      studentNo,
      externalId: toLatinDigits(get(r, "externalId")),
      fullName: get(r, "fullName"),
      field: get(r, "field"),
      entryYear: toLatinDigits(get(r, "entryYear")),
      existingAccount: yes(get(r, "existingAccount")),
    };
  });
  return { people, missing };
}

export function toLatinDigits(s: string): string {
  return s.replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/** problems of one row before sending (Persian), or "" */
export function personProblem(p: PersonInput): string {
  if (!ORG_USERNAME_RE.test(p.username)) return "نام کاربری نامعتبر";
  if (p.fullName.length > 80) return "نام بیش از ۸۰ نویسه";
  if (p.studentNo.length > 40) return "شمارهٔ دانشجویی بیش از ۴۰ نویسه";
  return "";
}

/** CSV cell safe for Excel: quoted, and formulas (= + - @ tab) neutralised */
export function csvCell(v: unknown): string {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}
export function toCsv(rows: unknown[][]): string {
  return "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
export function downloadText(name: string, text: string, type = "text/csv;charset=utf-8"): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
