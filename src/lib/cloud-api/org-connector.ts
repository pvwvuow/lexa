"use client";
/* Connector of a centre (phase 7, supabase/012_connector.sql + supabase/functions/org-connector):
 * Lexa reads the centre's own server on a schedule. Settings and the run log are RPCs; the test and
 * "run now" go through the Edge Function. Owner / manager / Lexa admin with a two-factor session. */
import { sbFetch } from "@/lib/supabase";
import { HttpError, sbRpc } from "./rest";

export type ConnRes = "students" | "staff" | "classes" | "enrollments" | "grades" | "prior_gpa";
export type ConnKind = "rest_json" | "csv_url";
export type ConnAuth = "none" | "bearer" | "basic" | "header";
export type ConnSchedule = "manual" | "hourly" | "daily" | "weekly";

export interface ConnResCfg {
  enabled?: boolean;
  path?: string;
  list_key?: string;
  map?: Record<string, string>;
  defaults?: Record<string, string>;
  values?: Record<string, Record<string, string>>;
}
export interface ConnOptions {
  pagination?: "none" | "page" | "offset";
  page_param?: string;
  size_param?: string;
  page_size?: number;
  csv_delimiter?: string;
  date_format?: "gregorian" | "jalali";
  create_students?: boolean;
  status_sync?: boolean;
  exit_access?: "open" | "limited";
}
export interface ConnConfig {
  name: string;
  kind: ConnKind;
  base_url: string;
  auth_kind: ConnAuth;
  auth_user: string;
  resources: Partial<Record<ConnRes, ConnResCfg>>;
  options: ConnOptions;
  schedule: ConnSchedule;
  run_hour: number;
  enabled: boolean;
}
export interface Integration extends ConnConfig {
  id: string;
  hasSecret: boolean;
  keyOk: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: string;
}
export interface ConnRun {
  id: string;
  integrationId: string;
  integrationName: string;
  via: "manual" | "schedule";
  dry: boolean;
  startedAt: string;
  finishedAt: string | null;
  status: "running" | "ok" | "partial" | "failed";
  counts: Record<string, { fetched: number; mapped: number; results: Record<string, number>; error?: string }>;
  errors: { r: string; row: number; e: string }[];
  message: string;
  startedByName: string;
}

export const CONN_RESOURCES: { key: ConnRes; label: string; fields: { key: string; label: string; required?: boolean }[] }[] = [
  { key: "staff", label: "مدرسان", fields: [
    { key: "username", label: "نام کاربری در مرکز", required: true }, { key: "full_name", label: "نام کامل" }] },
  { key: "students", label: "دانشجوها", fields: [
    { key: "username", label: "نام کاربری در مرکز", required: true }, { key: "student_no", label: "شمارهٔ دانشجویی" },
    { key: "external_id", label: "شناسه در سامانهٔ مرکز" }, { key: "full_name", label: "نام کامل" },
    { key: "field", label: "رشته" }, { key: "entry_year", label: "سال ورود" }, { key: "status", label: "وضعیت" }] },
  { key: "classes", label: "کلاس‌ها", fields: [
    { key: "external_id", label: "شناسهٔ کلاس", required: true }, { key: "title", label: "عنوان کلاس (گروه)" },
    { key: "teacher", label: "نام کاربری مدرس" }, { key: "term_code", label: "کد ترم", required: true },
    { key: "term_title", label: "عنوان ترم" }, { key: "term_starts_on", label: "شروع ترم" },
    { key: "term_ends_on", label: "پایان ترم" }, { key: "course_code", label: "کد درس", required: true },
    { key: "course_title", label: "نام درس" }, { key: "course_units", label: "واحد" }] },
  { key: "enrollments", label: "ثبت‌نام در کلاس", fields: [
    { key: "class", label: "شناسهٔ کلاس", required: true }, { key: "student", label: "دانشجو (شناسه، نام کاربری یا شماره)", required: true },
    { key: "status", label: "وضعیت ثبت‌نام" }] },
  { key: "grades", label: "نمره‌ها", fields: [
    { key: "class", label: "شناسهٔ کلاس", required: true }, { key: "student", label: "دانشجو", required: true },
    { key: "score", label: "نمره", required: true }, { key: "max", label: "نمرهٔ کامل (پیش‌فرض ۲۰)" },
    { key: "component", label: "نوع نمره (پیش‌فرض نهایی)" }] },
  { key: "prior_gpa", label: "معدل قبلی", fields: [
    { key: "student", label: "دانشجو", required: true }, { key: "gpa", label: "معدل", required: true }, { key: "as_of", label: "تا ترم" }] },
];

export const emptyConfig = (): ConnConfig => ({
  name: "", kind: "rest_json", base_url: "https://", auth_kind: "bearer", auth_user: "", resources: {},
  options: { pagination: "none", page_size: 500, date_format: "jalali", create_students: true, status_sync: false, exit_access: "open" },
  schedule: "daily", run_hour: 3, enabled: true,
});

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function listIntegrations(orgId: string): Promise<Integration[]> {
  const rows = await sbRpc<any[]>("lexa_org_integrations", { o: orgId });
  return (rows ?? []).map((r) => ({
    id: r.id, name: r.name ?? "", kind: r.kind, base_url: r.base_url ?? "", auth_kind: r.auth_kind, auth_user: r.auth_user ?? "",
    resources: r.resources ?? {}, options: r.options ?? {}, schedule: r.schedule, run_hour: Number(r.run_hour) || 0,
    enabled: !!r.enabled, hasSecret: !!r.has_secret, keyOk: !!r.key_ok, nextRunAt: r.next_run_at ?? null,
    lastRunAt: r.last_run_at ?? null, lastStatus: r.last_status ?? "",
  }));
}

export async function integrationRuns(orgId: string, integrationId: string | null, limit = 30): Promise<ConnRun[]> {
  const rows = await sbRpc<any[]>("lexa_org_integration_runs", { o: orgId, i: integrationId, lim: limit });
  return (rows ?? []).map((r) => ({
    id: r.id, integrationId: r.integration_id, integrationName: r.integration_name ?? "", via: r.via, dry: !!r.dry,
    startedAt: r.started_at, finishedAt: r.finished_at ?? null, status: r.status, counts: r.counts ?? {},
    errors: r.errors ?? [], message: r.message ?? "", startedByName: r.started_by_name ?? "",
  }));
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const saveIntegration = (orgId: string, id: string | null, cfg: ConnConfig) =>
  sbRpc<string>("lexa_org_integration_save", { o: orgId, i: id, cfg });
/** write-only: the credential can never be read back. Empty string removes it. */
export const setIntegrationSecret = (id: string, secret: string) =>
  sbRpc<string>("lexa_org_integration_secret", { i: id, p_secret: secret });
export const deleteIntegration = (id: string) => sbRpc<string>("lexa_org_integration_delete", { i: id });
export const rekeyIntegration = (id: string) => sbRpc<string>("lexa_org_integration_rekey", { i: id });

async function fn<T>(route: string, payload: Record<string, unknown>): Promise<T> {
  const res = await sbFetch(`/functions/v1/org-connector${route}`, { method: "POST", body: JSON.stringify(payload) });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new HttpError(res.status, String(j.error ?? `http ${res.status}`), String(j.error ?? ""));
  return j as T;
}
export interface TestResult { ok: boolean; resources: Record<string, { rows?: number; fields?: string[]; error?: string }> }
export const testIntegration = (orgId: string, id: string) => fn<TestResult>("/test", { org_id: orgId, integration_id: id });
export const runIntegration = (orgId: string, id: string, dry: boolean) =>
  fn<{ run_id: string; status: string; counts: ConnRun["counts"]; errors: ConnRun["errors"]; message: string }>(
    "/run", { org_id: orgId, integration_id: id, dry });

export const RUN_STATUS: Record<string, string> = {
  running: "در حال اجرا", ok: "موفق", partial: "با چند خطا", failed: "ناموفق",
};
export const SCHEDULE_LABELS: Record<ConnSchedule, string> = {
  manual: "فقط دستی", hourly: "هر ساعت", daily: "هر روز", weekly: "هر هفته",
};

const CODES: Record<string, string> = {
  host_not_allowed: "این نشانی مجاز نیست (فقط سرور عمومی مرکز با HTTPS).",
  source_unreachable: "سرور مرکز در دسترس نبود.",
  source_timeout: "سرور مرکز در ۲۰ ثانیه پاسخ نداد.",
  source_auth_failed: "سرور مرکز اطلاعات ورود را نپذیرفت.",
  source_not_found: "این مسیر روی سرور مرکز پیدا نشد (۴۰۴).",
  source_bad_json: "پاسخ سرور JSON معتبر نبود.",
  source_bad_shape: "در پاسخ سرور فهرستی از ردیف‌ها پیدا نشد؛ «کلید فهرست» را تنظیم کنید.",
  source_too_large: "پاسخ سرور بیشتر از ۵ مگابایت بود.",
  too_many_rows: "بیشتر از ۲۰٬۰۰۰ ردیف؛ با صفحه‌بندی یا مسیر جدا بخوانید.",
  redirect_not_allowed: "سرور مرکز به نشانی دیگری هدایت کرد؛ نشانی نهایی را وارد کنید.",
  bad_path: "مسیر باید روی همان سرور باشد.",
  no_secret: "رمز یا توکن دسترسی هنوز ذخیره نشده است.",
  key_missing: "کلید داخلی اتصال باطل شده؛ «کلید تازه» را بزنید.",
  no_student_seats: "ظرفیت حساب دانشجویی مرکز پر است.",
  no_teacher_seats: "ظرفیت حساب مدرس مرکز پر است.",
  org_not_active: "مرکز فعال نیست.",
  nothing_to_read: "هیچ بخشی با تطبیق فیلد فعال نیست.",
  timeout: "اجرا بیش از ۳۰ دقیقه طول کشید و متوقف شد.",
  disabled: "اتصال غیرفعال است.",
  rate_limited: "تعداد درخواست‌ها زیاد بود؛ اجرای بعدی ادامه می‌دهد.",
};
export const codeLabel = (c: string) => CODES[c] ?? (c.startsWith("source_http_") ? `سرور مرکز خطای ${c.slice(12)} داد.` : c);

const ERRORS: [RegExp, string][] = [
  [/mfa_required|mfa required/, "برای تنظیم اتصال باید ورود دومرحله‌ای را تأیید کنید."],
  [/not_manager|not a manager/, "این کار فقط از مالک و مدیران پنل مرکز ساخته است."],
  [/too_many_integrations/, "حداکثر ۵ اتصال برای هر مرکز."],
  [/bad_config:base_url/, "نشانی باید با https:// شروع شود."],
  [/bad_config:path/, "مسیر باید با / یا ? شروع شود و روی همان سرور باشد."],
  [/bad_config:auth_header/, "نام سربرگ (header) نامعتبر است."],
  [/bad_config:name/, "نام اتصال ۱ تا ۶۰ نویسه."],
  [/bad_config/, "تنظیمات اتصال نامعتبر است."],
  [/run_in_progress/, "یک اجرای دیگر همین اتصال هنوز تمام نشده است."],
  [/(^|\s)not_found\b/, "اتصال پیدا نشد."],
  [/not_signed_in|not signed in/, "ابتدا وارد حساب کاربری خود شوید."],
];
export function connectorError(e: unknown): string {
  const raw = e instanceof HttpError ? `${e.message} ${e.code}` : e instanceof Error ? e.message : String(e ?? "");
  for (const [re, msg] of ERRORS) if (re.test(raw)) return msg;
  const code = e instanceof HttpError ? e.code : "";
  if (code && CODES[code]) return CODES[code];
  if (e instanceof TypeError) return "اتصال به Lexa برقرار نشد؛ اتصال اینترنت را بررسی کنید.";
  return "درخواست انجام نشد. لطفاً دوباره تلاش کنید.";
}
