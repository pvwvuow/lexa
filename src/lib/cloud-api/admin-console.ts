"use client";
/* Platform admin console (phase A1 of docs/ADMIN_PLATFORM.md): typed client over
 * supabase/013_admin_console.sql and the admin-users Edge Function. */
import { sbFetch } from "@/lib/supabase";
import { HttpError, sbRpc } from "./rest";

// ─── types ───────────────────────────────────────────────────────────────────────────────────
export interface AdminKpis {
  users: number; users_new_7d: number; users_new_30d: number; signins_7d: number;
  teachers: number; admins: number; admins_no_mfa: number | null; suspended_users: number;
  learners_1d: number; learners_7d: number; learners_30d: number;
  study_seconds_7d: number; study_seconds_30d: number;
  orgs_active: number; orgs_expired: number; orgs_pending: number; orgs_suspended: number; orgs_archived: number;
  official_students: number; student_seats: number; classes_active: number; exams_next_7d: number;
  connector_failed_24h: number | null; api_errors_24h: number | null;
}
export interface AdminQueues {
  teacher_requests: number; teacher_requests_oldest: string | null;
  org_requests: number; org_requests_oldest: string | null;
  orgs_delete_due: number; orgs_delete_scheduled: number;
}
export type AlertKind =
  | "admins_no_mfa" | "org_delete_due" | "org_expired" | "org_expiring" | "org_students_full"
  | "org_teachers_full" | "connector_failed" | "api_errors";
export interface AdminAlert {
  rank: number; kind: AlertKind; org_id?: string; slug?: string; name?: string;
  at?: string | null; used?: number; cap?: number; count?: number;
}
export interface SeriesPoint { day: string; signups: number; learners: number; seconds: number }
export interface RecentAudit { id: number; at: string; action: string; actor: string | null; org: string | null; target: string | null; target_name: string | null }
export interface AdminHome {
  kpis: AdminKpis; queues: AdminQueues; alerts: AdminAlert[]; series: SeriesPoint[];
  recent: RecentAudit[]; mfa: boolean; today: string; generated_at: string;
}

export type LifecycleStatus = "pending" | "active" | "suspended" | "archived";
export interface AdminOrgRow {
  id: string; slug: string; name: string; kind: string; city: string; logo_url: string;
  status: LifecycleStatus; plan: "trial" | "basic" | "pro";
  seats: number; teachers_used: number; student_seats: number; students_used: number; code: string | null;
  expires_at: string | null; created_at: string; owner_id: string | null; owner_username: string | null; owner_name: string | null;
  status_reason: string; status_changed_at: string | null; delete_after: string | null;
  classes: number; learners_7d: number; study_seconds_30d: number; last_study_day: string | null;
  admin_note: string; contact: string;
}
export type OrgAction = "activate" | "suspend" | "archive" | "restore" | "schedule_delete" | "cancel_delete";

export type UserFilter = "all" | "suspended" | "staff" | "admins_no_mfa" | "new_7d" | "inactive_30d";
export type GlobalRole = "user" | "teacher" | "admin";
export interface AdminUserRow {
  id: string; username: string; display_name: string; avatar_url: string | null; role: GlobalRole;
  email_masked: string; created_at: string | null; last_sign_in_at: string | null;
  banned: boolean; suspended: boolean; mfa: boolean; orgs: number; official: number; study_seconds_30d: number;
}
export interface AdminUserDetail {
  id: string; username: string; display_name: string; avatar_url: string | null; bio: string; role: GlobalRole;
  email: string; phone: string; providers: string[]; created_at: string | null; last_sign_in_at: string | null;
  email_confirmed_at: string | null; banned_until: string | null;
  flags: { suspended: boolean; reason: string; changed_at: string; changed_by: string | null } | null;
  factors: { type: string; status: string; name: string; created_at: string }[];
  memberships: { org_id: string; slug: string; name: string; role: string; status: string; title: string }[];
  official: { org_id: string; slug: string; name: string; username: string; status: string; student_no: string }[];
  teacher_request: { status: string; created_at: string } | null;
  study: { seconds_7d: number; seconds_30d: number; days_30d: number; last_day: string | null; daily: { day: string; seconds: number }[] };
  audit: { id: number; at: string; action: string; actor: string | null; org: string | null; detail: Record<string, unknown> }[];
}
export type UserAction = "suspend" | "unsuspend" | "revoke_sessions" | "reset_mfa";

export interface AuditRow {
  id: number; at: string; actor: string | null; actor_username: string | null; org_id: string | null; org_name: string | null;
  action: string; target: string | null; target_username: string | null; detail: Record<string, unknown>;
}

// ─── calls ───────────────────────────────────────────────────────────────────────────────────
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v) || 0);

export async function adminHome(): Promise<AdminHome> {
  const r = await sbRpc<AdminHome>("lexa_admin_home");
  return { ...r, alerts: r.alerts ?? [], series: (r.series ?? []).map((p) => ({ ...p, seconds: num(p.seconds) })), recent: r.recent ?? [] };
}

export async function adminOrgsOverview(): Promise<AdminOrgRow[]> {
  const rows = await sbRpc<AdminOrgRow[]>("lexa_admin_orgs_overview");
  return (rows ?? []).map((r) => ({ ...r, study_seconds_30d: num(r.study_seconds_30d) }));
}

export const adminOrgLifecycle = (orgId: string, act: OrgAction, reason = "", graceDays = 30) =>
  sbRpc<string>("lexa_admin_org_lifecycle", { o: orgId, act, reason, grace_days: graceDays });

export const adminOrgUpdate = (orgId: string, f: {
  plan?: AdminOrgRow["plan"]; seats?: number; studentSeats?: number; expiresAt?: string | null; note?: string;
}) =>
  sbRpc<string>("lexa_admin_org_update", {
    o: orgId,
    p_plan: f.plan ?? null,
    p_seats: f.seats ?? null,
    p_student_seats: f.studentSeats ?? null,
    p_expires: f.expiresAt ? f.expiresAt : null,
    p_clear_expiry: f.expiresAt === null,
    p_note: f.note ?? null,
  });

export const adminOrgPurge = (orgId: string, confirmSlug: string) =>
  sbRpc<string>("lexa_admin_org_purge", { o: orgId, confirm_slug: confirmSlug });

export async function adminUsers(p: { q?: string; role?: GlobalRole | "all"; filter?: UserFilter; limit?: number; offset?: number }) {
  const rows = await sbRpc<(AdminUserRow & { total: number })[]>("lexa_admin_users", {
    q: p.q ?? "", p_role: p.role ?? "all", p_filter: p.filter ?? "all", lim: p.limit ?? 50, off: p.offset ?? 0,
  });
  const list = rows ?? [];
  return { rows: list.map((r) => ({ ...r, study_seconds_30d: num(r.study_seconds_30d) })), total: list.length ? num(list[0].total) : 0 };
}

export const adminUserDetail = (uid: string) => sbRpc<AdminUserDetail>("lexa_admin_user_detail", { uid });

export const adminChangeRole = (uid: string, role: GlobalRole, reason: string) =>
  sbRpc<string>("lexa_admin_change_role", { uid, new_role: role, reason });

export async function adminUserAction(uid: string, action: UserAction, reason = ""): Promise<{ ok: boolean; sessions_ended?: boolean; factors_removed?: number }> {
  const res = await sbFetch("/functions/v1/admin-users", { method: "POST", body: JSON.stringify({ action, user_id: uid, reason }) });
  const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; sessions_ended?: boolean; factors_removed?: number };
  if (!res.ok || !j.ok) throw new HttpError(res.status, j.error ?? `function ${res.status}`, j.error ?? "");
  return { ok: true, sessions_ended: j.sessions_ended, factors_removed: j.factors_removed };
}

export async function adminAudit(p: { from?: string | null; to?: string | null; action?: string; orgId?: string | null; actor?: string; limit?: number; offset?: number }) {
  const rows = await sbRpc<(AuditRow & { total: number })[]>("lexa_admin_audit", {
    p_from: p.from ?? null, p_to: p.to ?? null, p_action: p.action ?? "", p_org: p.orgId ?? null,
    p_actor: (p.actor ?? "").replace(/^@/, ""), lim: p.limit ?? 100, off: p.offset ?? 0,
  });
  const list = rows ?? [];
  return { rows: list, total: list.length ? num(list[0].total) : 0 };
}

// ─── errors ──────────────────────────────────────────────────────────────────────────────────
const ERRORS: [RegExp, string][] = [
  [/mfa required|mfa_required/i, "این کار به ورود دومرحله‌ای نیاز دارد. از بخش «امنیت» کد برنامهٔ احراز هویت را تأیید کنید."],
  [/admin only|admin_only/i, "این بخش فقط برای مدیران Lexa است."],
  [/reason required|reason_required/i, "برای این کار، نوشتن دلیل (حداقل سه حرف) لازم است."],
  [/not on yourself|not_on_yourself/i, "این کار را نمی‌توانید روی حساب خودتان انجام دهید."],
  [/demote the admin first|admin_target/i, "حساب مدیر را نمی‌توان معلق کرد؛ ابتدا نقش او را تغییر دهید."],
  [/last admin/i, "Lexa دست‌کم یک مدیر لازم دارد؛ اول مدیر دیگری تعیین کنید."],
  [/cannot demote yourself/i, "نمی‌توانید نقش مدیریتی خودتان را بردارید."],
  [/suspend first/i, "اول مرکز را معلق کنید، بعد بایگانی."],
  [/archive first/i, "حذف فقط برای مرکز بایگانی‌شده زمان‌بندی می‌شود."],
  [/restore first/i, "مرکز بایگانی‌شده را اول بازگردانی کنید."],
  [/cancel deletion first/i, "اول حذف زمان‌بندی‌شده را لغو کنید."],
  [/not due/i, "مهلت حذف این مرکز هنوز تمام نشده است."],
  [/confirm mismatch/i, "نشانی واردشده با نشانی مرکز یکی نیست."],
  [/bad transition/i, "این تغییر وضعیت از وضعیت فعلی مرکز ممکن نیست."],
  [/user not found|user_not_found/i, "کاربر پیدا نشد."],
  [/org not found/i, "مرکز پیدا نشد."],
  [/auth_failed/i, "سرویس ورود Lexa درخواست را نپذیرفت؛ چند دقیقهٔ دیگر دوباره تلاش کنید."],
  [/not_configured|function 404|Requested function was not found/i, "تابع admin-users هنوز روی سرور نصب نشده است (docs/ADMIN_A1_SETUP.md)."],
  [/PGRST202|Could not find the function/i, "فایل 013_admin_console.sql هنوز روی پایگاه داده اجرا نشده است."],
  [/JWT expired|invalid JWT|not_signed_in|PGRST30[0-9]/i, "نشست ورود منقضی شده است؛ یک بار خارج و دوباره وارد شوید."],
];

export function adminError(e: unknown): string {
  const raw = e instanceof HttpError ? `${e.message} ${e.code}` : e instanceof Error ? e.message : String(e ?? "");
  for (const [re, msg] of ERRORS) if (re.test(raw)) return msg;
  if (e instanceof TypeError) return "اتصال به Lexa برقرار نشد؛ اینترنت را بررسی کنید.";
  const code = e instanceof HttpError ? e.code || String(e.status || "") : "";
  return code ? `درخواست انجام نشد (کد ${code}).` : "درخواست انجام نشد. دوباره تلاش کنید.";
}

// ─── labels ──────────────────────────────────────────────────────────────────────────────────
export const LIFECYCLE_LABEL: Record<LifecycleStatus, string> = {
  pending: "در انتظار تأیید", active: "فعال", suspended: "معلق", archived: "بایگانی",
};
export const PLAN_LABEL: Record<AdminOrgRow["plan"], string> = { trial: "آزمایشی", basic: "پایه", pro: "حرفه‌ای" };
export const ROLE_LABEL: Record<GlobalRole, string> = { user: "کاربر", teacher: "مدرس", admin: "مدیر Lexa" };
export const MEMBER_ROLE_LABEL: Record<string, string> = { owner: "مالک", manager: "مدیر", teacher: "مدرس" };

/** derived display state of a centre (expiry and scheduled deletion included) */
export function orgState(o: Pick<AdminOrgRow, "status" | "expires_at" | "delete_after">):
  { key: string; label: string; tone: "ok" | "warn" | "bad" | "muted" | "info" } {
  if (o.delete_after) return { key: "deleting", label: "در صف حذف", tone: "bad" };
  if (o.status === "active" && o.expires_at && new Date(o.expires_at).getTime() <= Date.now())
    return { key: "expired", label: "اعتبار تمام‌شده", tone: "warn" };
  if (o.status === "active") return { key: "active", label: "فعال", tone: "ok" };
  if (o.status === "pending") return { key: "pending", label: "در انتظار تأیید", tone: "info" };
  if (o.status === "suspended") return { key: "suspended", label: "معلق", tone: "bad" };
  return { key: "archived", label: "بایگانی", tone: "muted" };
}

const ACTION_LABEL: Record<string, string> = {
  "admin.org.activate": "فعال‌سازی مرکز", "admin.org.suspend": "تعلیق مرکز", "admin.org.archive": "بایگانی مرکز",
  "admin.org.restore": "بازگردانی مرکز", "admin.org.schedule_delete": "زمان‌بندی حذف مرکز",
  "admin.org.cancel_delete": "لغو حذف مرکز", "admin.org.purge": "حذف دائمی مرکز", "admin.org.update": "تغییر پلن و ظرفیت",
  "admin.set_accounts": "تغییر کد و ظرفیت دانشجو", "admin.user.view": "مشاهدهٔ پروندهٔ کاربر",
  "admin.user.role": "تغییر نقش کاربر", "admin.user.suspend": "تعلیق کاربر", "admin.user.unsuspend": "رفع تعلیق کاربر",
  "admin.user.revoke_sessions": "خروج اجباری از همهٔ دستگاه‌ها", "admin.user.reset_mfa": "بازنشانی ورود دومرحله‌ای",
  "student.accept_terms": "پذیرش شرایط مرکز", "student.redeem_code": "فعال‌سازی با کد", "term.save": "ذخیرهٔ ترم",
  "course.save": "ذخیرهٔ درس", "class.save": "ذخیرهٔ کلاس", "class.delete": "حذف کلاس", "class.enroll": "ثبت‌نام در کلاس",
  "class.drop": "حذف از کلاس", "grade.upsert": "ثبت نمره", "grade.change": "تغییر نمره", "grade.delete": "حذف نمره",
  "gpa.upsert": "ثبت معدل قبلی", "exam.save": "ذخیرهٔ آزمون", "exam.delete": "حذف آزمون", "exam.release": "انتشار نتایج آزمون",
  "exam.start": "شروع آزمون", "exam.submit": "ارسال آزمون", "api.key_create": "ساخت کلید API", "api.key_revoke": "ابطال کلید API",
  "connector.save": "ذخیرهٔ کانکتور", "connector.secret": "تغییر رمز کانکتور", "connector.delete": "حذف کانکتور",
  "connector.rekey": "کلید تازهٔ کانکتور",
};
export function actionLabel(a: string): string {
  return ACTION_LABEL[a] ?? a;
}
export const AUDIT_GROUPS: { key: string; label: string }[] = [
  { key: "", label: "همهٔ رویدادها" },
  { key: "admin.", label: "کارهای مدیران Lexa" },
  { key: "admin.org.", label: "چرخهٔ عمر مراکز" },
  { key: "admin.user.", label: "حساب‌های کاربری" },
  { key: "student.", label: "دانشجویان رسمی" },
  { key: "grade.", label: "نمره‌ها" },
  { key: "exam.", label: "آزمون‌های رسمی" },
  { key: "class.", label: "کلاس‌ها" },
  { key: "api.", label: "کلیدهای API" },
  { key: "connector.", label: "کانکتور" },
];

// ─── formatting ──────────────────────────────────────────────────────────────────────────────
export const faNum = (n: number | null | undefined, d = 0) =>
  n === null || n === undefined || Number.isNaN(n) ? "—" : Number(n).toLocaleString("fa-IR", { maximumFractionDigits: d });
export const faHours = (seconds: number) => faNum(seconds / 3600, seconds < 36000 ? 1 : 0);
export function faDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fa-IR", { year: "numeric", month: "short", day: "numeric" });
}
export function faDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("fa-IR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
export function faAgo(iso: string | null | undefined): string {
  if (!iso) return "هرگز";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "—";
  const m = Math.round(ms / 60000);
  if (m < 1) return "همین حالا";
  if (m < 60) return `${faNum(m)} دقیقه پیش`;
  const h = Math.round(m / 60);
  if (h < 24) return `${faNum(h)} ساعت پیش`;
  const d = Math.round(h / 24);
  if (d < 31) return `${faNum(d)} روز پیش`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${faNum(mo)} ماه پیش`;
  return `${faNum(Math.round(mo / 12))} سال پیش`;
}
export function faDaysLeft(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (d < 0) return `${faNum(-d)} روز گذشته`;
  if (d === 0) return "امروز";
  return `${faNum(d)} روز مانده`;
}

/** CSV with a BOM so Excel opens Persian text correctly */
export function toCsv(head: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "\uFEFF" + [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}
export function downloadCsv(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** centre sign-in code (006 RPC; student capacity is set with adminOrgUpdate) */
export const adminOrgSetCode = (orgId: string, code: string) =>
  sbRpc<string>("lexa_admin_set_org_accounts", { o: orgId, new_code: code, new_student_seats: null });
