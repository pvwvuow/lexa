"use client";
/* Usernames for cloud accounts. The sign-up form checks the name, sends it with
 * the sign-up (supabase/004 trigger uses it) and keeps it as "pending": after the
 * first sign-in it is applied again through lexa_set_username, so it also works
 * when 004 has not run yet or e-mail confirmation delays the first session. */
import { sbUser } from "@/lib/supabase";
import { sbRpc, sbSelect } from "./rest";
import { forgetCloudMe } from "./handlers";

const KEY = "lexa-pending-username-v1";
// same rule as lexa_set_username in supabase/002_cloud_social.sql
const RE = /^[a-zA-Z0-9_\u0600-\u06FF][a-zA-Z0-9_.\u0600-\u06FF]*$/;

export function normalizeUsername(v: string): string {
  return v.trim().replace(/^@/, "");
}

/** a Persian error message, or null when the name is acceptable */
export function usernameProblem(raw: string): string | null {
  const v = normalizeUsername(raw);
  if (v.length < 3 || v.length > 20) return "نام کاربری باید ۳ تا ۲۰ نویسه باشد.";
  if (!RE.test(v)) return "نام کاربری فقط حروف فارسی یا انگلیسی، رقم، _ و . می‌پذیرد (بدون فاصله؛ نباید با . شروع شود).";
  if (/^u[0-9a-f]{10}$/i.test(v)) return "این شکل نام کاربری رزرو است؛ یکی دیگر انتخاب کن.";
  return null;
}

/** is the name used by someone else? (profiles are publicly readable) */
export async function usernameTaken(raw: string): Promise<boolean> {
  const v = normalizeUsername(raw).replace(/[\\_%*]/g, (m) => "\\" + m);
  const rows = await sbSelect<{ id: string }>("lexa_profiles", `username=ilike.${encodeURIComponent(v)}&select=id&limit=2`);
  const me = sbUser()?.id;
  return rows.some((r) => r.id !== me);
}

/** change my username; throws an Error with a Persian message */
export async function setMyUsername(raw: string): Promise<string> {
  const v = normalizeUsername(raw);
  const bad = usernameProblem(v);
  if (bad) throw new Error(bad);
  try {
    await sbRpc<string>("lexa_set_username", { uname: v });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    if (/taken/i.test(m)) throw new Error("این نام کاربری قبلاً گرفته شده؛ یکی دیگر انتخاب کن.");
    if (/invalid/i.test(m)) throw new Error("نام کاربری نامعتبر است.");
    if (/not signed in/i.test(m)) throw new Error("اول وارد حساب شو.");
    throw new Error("نام کاربری ذخیره نشد؛ اتصال اینترنت را چک کن.");
  }
  forgetCloudMe();
  return v;
}

export function rememberPendingUsername(email: string, username: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ email: email.trim().toLowerCase(), username: normalizeUsername(username) }));
  } catch { /* private mode */ }
}

export function clearPendingUsername(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** after a sign-in: apply the name picked at sign-up. Returns an error message or null. */
export async function applyPendingUsername(): Promise<string | null> {
  const u = sbUser();
  if (!u) return null;
  let p: { email?: string; username?: string } | null = null;
  try { p = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { p = null; }
  if (!p?.username) return null;
  if (p.email && u.email && p.email !== u.email.toLowerCase()) return null;
  clearPendingUsername();
  try {
    const cur = await sbSelect<{ username: string | null }>("lexa_profiles", `id=eq.${u.id}&select=username`);
    if ((cur[0]?.username || "").toLowerCase() === p.username.toLowerCase()) return null;
    await setMyUsername(p.username);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "نام کاربری ثبت نشد.";
  }
}
