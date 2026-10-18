"use client";
/* API keys of a centre (phase 5, supabase/010_org_api.sql + supabase/functions/org-api).
 * Keys are made by the Edge Function (it alone knows the pepper that turns a key id into its
 * secret); listing, revoking and the request log are RPCs. Managers need a two-factor session. */
import { sbFetch } from "@/lib/supabase";
import { supaUrl } from "@/lib/supabase-config";
import { HttpError, sbRpc } from "./rest";

export const API_SCOPES: { key: string; label: string }[] = [
  { key: "students:write", label: "ساخت و به‌روزرسانی حساب دانشجوها" },
  { key: "staff:write", label: "ساخت حساب مدرسان" },
  { key: "status:write", label: "تغییر وضعیت دانشجو (تعلیق، فارغ‌التحصیلی، …)" },
  { key: "classes:write", label: "ترم‌ها، درس‌ها و کلاس‌ها" },
  { key: "enrollments:write", label: "ثبت‌نام در کلاس" },
  { key: "grades:write", label: "نمره‌ها و معدل قبلی" },
  { key: "reports:read", label: "خواندن گزارش‌ها (فهرست، کلاس، نمره، زمان مطالعه)" },
];
export const scopeLabel = (s: string) => API_SCOPES.find((x) => x.key === s)?.label ?? s;

export const apiBaseUrl = () => `${supaUrl().replace(/\/$/, "")}/functions/v1/org-api`;

export interface ApiKeyRow {
  id: string;
  name: string;
  hint: string;
  scopes: string[];
  allowedIps: string[];
  sandbox: boolean;
  expiresAt: string | null;
  createdAt: string;
  createdByName: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}
export const keyLabel = (k: Pick<ApiKeyRow, "id" | "sandbox">) => `lxk_${k.sandbox ? "test" : "live"}_${k.id}`;
export function keyState(k: ApiKeyRow): "active" | "revoked" | "expired" {
  if (k.revokedAt) return "revoked";
  if (k.expiresAt && Date.parse(k.expiresAt) <= Date.now()) return "expired";
  return "active";
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function listApiKeys(orgId: string): Promise<ApiKeyRow[]> {
  const rows = await sbRpc<any[]>("lexa_org_api_keys", { o: orgId });
  return (rows ?? []).map((r) => ({
    id: r.id, name: r.name ?? "", hint: r.hint ?? "", scopes: r.scopes ?? [], allowedIps: r.allowed_ips ?? [],
    sandbox: !!r.sandbox, expiresAt: r.expires_at ?? null, createdAt: r.created_at, createdByName: r.created_by_name ?? "",
    lastUsedAt: r.last_used_at ?? null, revokedAt: r.revoked_at ?? null,
  }));
}

export interface ApiLogRow { at: string; keyName: string; method: string; path: string; status: number; ms: number; rows: number; error: string; sandbox: boolean }
export async function apiLog(orgId: string, limit = 200): Promise<ApiLogRow[]> {
  const rows = await sbRpc<any[]>("lexa_org_api_log_list", { o: orgId, lim: limit });
  return (rows ?? []).map((r) => ({
    at: r.at, keyName: r.key_name ?? "", method: r.method ?? "", path: r.path ?? "", status: Number(r.status) || 0,
    ms: Number(r.ms) || 0, rows: Number(r.n_rows) || 0, error: r.error ?? "", sandbox: !!r.sandbox,
  }));
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface NewApiKey { id: string; key: string; secret: string; hint: string; sandbox: boolean }

async function manage<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  const res = await sbFetch("/functions/v1/org-api/manage", { method: "POST", body: JSON.stringify({ action, ...payload }) });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new HttpError(res.status, String(j.error ?? `http ${res.status}`), String(j.error ?? ""));
  return j as T;
}

export const createApiKey = (orgId: string, o: { name: string; scopes: string[]; ips: string[]; days: number | null; sandbox: boolean }) =>
  manage<NewApiKey>("create_key", { org_id: orgId, name: o.name, scopes: o.scopes, ips: o.ips, days: o.days, sandbox: o.sandbox });

/** a new key with the same settings; the old one keeps working for graceHours (0 = stops now) */
export const rotateApiKey = (orgId: string, keyId: string, graceHours: number) =>
  manage<NewApiKey & { old_key_ends_in_hours: number }>("rotate_key", { org_id: orgId, key_id: keyId, grace_hours: graceHours });

export const revokeApiKey = (keyId: string) => sbRpc<string>("lexa_org_api_key_revoke", { k: keyId, grace_hours: 0 });

const ERRORS: [RegExp, string][] = [
  [/mfa_required|mfa required/, "برای مدیریت کلیدهای API باید ورود دومرحله‌ای را تأیید کنید."],
  [/not_manager|not a manager/, "این کار فقط از مدیران این مرکز ساخته است."],
  [/bad_scopes/, "دست‌کم یک دسترسی انتخاب کنید."],
  [/bad_ips/, "فهرست IP نامعتبر است (مثلاً 203.0.113.10 یا 203.0.113.0/24، حداکثر ۲۰ مورد)."],
  [/too_many_keys/, "این مرکز حداکثر ۱۰ کلید فعال می‌تواند داشته باشد؛ یکی را باطل کنید."],
  [/org_not_active/, "این مرکز آموزشی فعال نیست."],
  [/not_configured/, "سرویس API هنوز راه‌اندازی نشده است (LEXA_API_PEPPER)."],
  [/bad_input/, "نام کلید (۱ تا ۶۰ نویسه) یا مدت اعتبار (۱ تا ۷۳۰ روز) نامعتبر است."],
  [/not_signed_in|not signed in/, "ابتدا وارد حساب کاربری خود شوید."],
];
export function orgApiError(e: unknown): string {
  const raw = e instanceof HttpError ? `${e.message} ${e.code}` : e instanceof Error ? e.message : String(e ?? "");
  for (const [re, msg] of ERRORS) if (re.test(raw)) return msg;
  if (e instanceof TypeError) return "اتصال به Lexa برقرار نشد؛ اتصال اینترنت را بررسی کنید.";
  return "درخواست انجام نشد. لطفاً دوباره تلاش کنید.";
}
