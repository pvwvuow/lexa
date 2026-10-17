"use client";
/* Organisations (universities / institutes), teacher requests and the Lexa admin
 * console — typed client over the RPCs in supabase/002_cloud_social.sql. */
import * as React from "react";
import { sbUser, onAuthChange } from "@/lib/supabase";
import { HttpError, isUuid, sbRpc, sbSelect, sbUpdate } from "./rest";

export type OrgKind = "university" | "institute" | "school" | "other";
export type OrgStatus = "pending" | "active" | "suspended";
export type OrgPlan = "trial" | "basic" | "pro";
export type MemberRole = "owner" | "manager" | "teacher";
export type MemberStatus = "invited" | "requested" | "active" | "declined" | "removed";

export const ORG_KINDS: { key: OrgKind; label: string }[] = [
  { key: "university", label: "دانشگاه" },
  { key: "institute", label: "موسسهٔ آموزشی" },
  { key: "school", label: "آموزشگاه / مدرسه" },
  { key: "other", label: "سایر" },
];
export const ORG_PLANS: { key: OrgPlan; label: string }[] = [
  { key: "trial", label: "آزمایشی" },
  { key: "basic", label: "پایه" },
  { key: "pro", label: "حرفه‌ای" },
];
export function orgKindLabel(k: string): string {
  return ORG_KINDS.find((x) => x.key === k)?.label ?? "سازمان";
}

export interface Org {
  id: string;
  slug: string;
  name: string;
  kind: OrgKind;
  city: string;
  description: string;
  logoUrl: string;
  website: string;
  contact: string;
  status: OrgStatus;
  plan: OrgPlan;
  seats: number;
  expiresAt: string | null;
  adminNote: string;
  createdBy: string;
  createdAt: string;
}

export interface MiniUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
}

export interface OrgMember {
  orgId: string;
  userId: string;
  role: MemberRole;
  status: MemberStatus;
  title: string;
  message: string;
  createdAt: string;
  user: MiniUser;
}

export interface MyMembership {
  role: MemberRole;
  status: MemberStatus;
  title: string;
  message: string;
  org: Org;
}

export interface TeacherRequest {
  userId: string;
  fullName: string;
  bio: string;
  credentials: string;
  contact: string;
  status: "pending" | "approved" | "rejected";
  adminNote: string;
  createdAt: string;
  user?: MiniUser;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function orgOf(r: any): Org {
  // one-to-one embed: an object on new PostgREST, a one-item array on older ones
  const pv = Array.isArray(r.private) ? r.private[0] : r.private;
  r = { ...r, private: pv ?? null };
  return {
    id: r.id, slug: r.slug, name: r.name, kind: r.kind, city: r.city ?? "", description: r.description ?? "",
    logoUrl: r.logo_url ?? "", website: r.website ?? "", contact: r.private?.contact ?? "", status: r.status,
    plan: r.plan, seats: Number(r.seats) || 0, expiresAt: r.expires_at ?? null, adminNote: r.private?.admin_note ?? "",
    createdBy: r.created_by, createdAt: r.created_at,
  };
}
function userOf(r: any, id = ""): MiniUser {
  const uid = r?.id ?? id;
  const username = r?.username || (uid ? "u" + String(uid).replace(/-/g, "").slice(0, 10) : "");
  return { id: uid, username, displayName: r?.display_name || username, avatarUrl: r?.avatar_url || null, role: r?.role || "user" };
}
function memberOf(r: any): OrgMember {
  return {
    orgId: r.org_id, userId: r.user_id, role: r.role, status: r.status, title: r.title ?? "",
    message: r.message ?? "", createdAt: r.created_at, user: userOf(r.user, r.user_id),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const ERRORS: [RegExp, string][] = [
  [/not signed in/i, "اول با حساب Lexa (ایمیل) وارد شو."],
  [/not a manager/i, "فقط مدیران این پنل می‌توانند این کار را بکنند."],
  [/not active/i, "پنل این سازمان هنوز فعال نشده یا مدت اعتبارش تمام شده است."],
  [/no free seats/i, "ظرفیت اساتید این پنل پر است؛ برای افزایش ظرفیت با پشتیبانی Lexa تماس بگیر."],
  [/user not found|member not found/i, "کاربر پیدا نشد."],
  [/teacher accounts only/i, "فقط حساب‌های استادی می‌توانند درخواست عضویت بدهند."],
  [/no pending invitation/i, "دعوت‌نامهٔ در انتظاری وجود ندارد."],
  [/no pending request/i, "درخواست در انتظاری وجود ندارد."],
  [/too many organisations/i, "حداکثر سه پنل سازمانی می‌توانی ثبت کنی."],
  [/only the owner/i, "فقط مالک پنل می‌تواند نقش‌ها را تغییر دهد."],
  [/owner cannot be changed/i, "مالک پنل را نمی‌شود تغییر داد یا حذف کرد."],
  [/admin only|only a Lexa admin/i, "این کار فقط از دست مدیر Lexa برمی‌آید."],
  [/cannot demote yourself/i, "نمی‌توانی نقش مدیریتی خودت را برداری."],
  [/duplicate key|already exists|23505/i, "این شناسه قبلاً ثبت شده؛ یکی دیگر انتخاب کن."],
  [/check constraint|violates check|23514/i, "یکی از فیلدها نامعتبر است (طول یا قالب را چک کن)."],
  [/row-level security|42501/i, "اجازهٔ این کار را نداری."],
];

export function orgError(e: unknown): string {
  const raw = e instanceof HttpError ? `${e.message} ${e.code}` : e instanceof Error ? e.message : String(e ?? "");
  for (const [re, msg] of ERRORS) if (re.test(raw)) return msg;
  if (e instanceof TypeError) return "اتصال به سرور ابری Lexa برقرار نشد — اینترنت را چک کن.";
  return "خطایی رخ داد؛ دوباره امتحان کن.";
}

// contact + admin note live in lexa_org_private (managers / admins only; null for others)
const PRIVATE_EMBED = "private:lexa_org_private(contact,admin_note)";
const MEMBER_USER = "user:lexa_profiles!lexa_org_members_user_id_fkey(id,username,display_name,avatar_url,role)";

// --- reads ---
export async function listActiveOrgs(): Promise<Org[]> {
  const rows = await sbSelect("lexa_orgs", "status=eq.active&select=*&order=name.asc&limit=300");
  return rows.map(orgOf).filter((o) => !o.expiresAt || new Date(o.expiresAt).getTime() > Date.now());
}

export async function getOrg(idOrSlug: string): Promise<Org | null> {
  const key = String(idOrSlug);
  const f = isUuid(key as unknown) ? `id=eq.${key}` : `slug=eq.${encodeURIComponent(key.toLowerCase())}`;
  const rows = await sbSelect("lexa_orgs", `${f}&select=*,${PRIVATE_EMBED}&limit=1`);
  return rows[0] ? orgOf(rows[0]) : null;
}

export async function myMemberships(): Promise<MyMembership[]> {
  const u = sbUser();
  if (!u) return [];
  const rows = await sbSelect<Record<string, unknown>>(
    "lexa_org_members",
    `user_id=eq.${u.id}&select=role,status,title,message,org:lexa_orgs(*,${PRIVATE_EMBED})&order=created_at.desc`,
  );
  return rows
    .filter((r) => r.org)
    .map((r) => ({
      role: r.role as MemberRole, status: r.status as MemberStatus, title: String(r.title ?? ""),
      message: String(r.message ?? ""), org: orgOf(r.org),
    }));
}

export async function orgMembers(orgId: string): Promise<OrgMember[]> {
  const rows = await sbSelect("lexa_org_members", `org_id=eq.${orgId}&select=*,${MEMBER_USER}&order=created_at.asc`);
  return rows.map(memberOf);
}

export async function seatsUsed(orgId: string): Promise<number> {
  return Number(await sbRpc<number>("lexa_org_seats_used", { o: orgId })) || 0;
}

export async function findUser(username: string): Promise<MiniUser | null> {
  const rows = await sbRpc<Record<string, unknown>[]>("lexa_find_user", { uname: username.replace(/^@/, "") });
  return rows?.[0] ? userOf(rows[0]) : null;
}

export async function searchTeachers(q: string): Promise<MiniUser[]> {
  const rows = await sbRpc<Record<string, unknown>[]>("lexa_teacher_directory", { q, lim: 20 });
  return (rows ?? []).map((r) => ({ ...userOf(r), role: "teacher" }));
}

// --- membership actions ---
export function createOrg(f: { name: string; slug: string; kind: OrgKind; city: string; description: string; website: string; contact: string }) {
  return sbRpc<string>("lexa_create_org", {
    o_name: f.name, o_slug: f.slug, o_kind: f.kind, o_city: f.city,
    o_description: f.description, o_website: f.website, o_contact: f.contact,
  });
}

export async function updateOrg(id: string, patch: Partial<Pick<Org, "name" | "kind" | "city" | "description" | "logoUrl" | "website" | "contact">>) {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.kind !== undefined) row.kind = patch.kind;
  if (patch.city !== undefined) row.city = patch.city.trim();
  if (patch.description !== undefined) row.description = patch.description.trim();
  if (patch.logoUrl !== undefined) row.logo_url = patch.logoUrl;
  if (patch.website !== undefined) row.website = patch.website.trim();
  if (patch.contact !== undefined) {
    await sbUpdate("lexa_org_private", `org_id=eq.${id}`, { contact: patch.contact.trim() }, "org_id");
  }
  if (Object.keys(row).length) await sbUpdate("lexa_orgs", `id=eq.${id}`, row, "id");
  return getOrg(id);
}

export const inviteToOrg = (orgId: string, userId: string, title = "", message = "") =>
  sbRpc<string>("lexa_org_invite", { o: orgId, uid: userId, m_title: title, m_message: message });
export const requestJoinOrg = (orgId: string, message = "") =>
  sbRpc<string>("lexa_org_request", { o: orgId, m_message: message });
export const respondInvite = (orgId: string, accept: boolean) =>
  sbRpc<string>("lexa_org_respond", { o: orgId, accept });
export const reviewJoinRequest = (orgId: string, userId: string, accept: boolean) =>
  sbRpc<string>("lexa_org_review", { o: orgId, uid: userId, accept });
export const setOrgMember = (orgId: string, userId: string, opts: { role?: MemberRole | null; title?: string | null; remove?: boolean }) =>
  sbRpc<string>("lexa_org_set_member", {
    o: orgId, uid: userId, m_role: opts.role ?? null, m_title: opts.title ?? null, remove: !!opts.remove,
  });
export const unlinkFromOrg = (orgId: string, kind: "post" | "tcourse", itemId: string) =>
  sbRpc<string>("lexa_org_unlink", { o: orgId, kind: kind === "post" ? "post" : "tcourse", item: itemId });

/** upload an org logo through the cloud media route; returns its public URL */
export async function uploadOrgLogo(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/cover/upload?kind=org", { method: "POST", body: fd });
  const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !j.url) throw new Error(j.error ?? "آپلود لوگو ناموفق بود.");
  return j.url;
}

// --- teacher accounts ---
/* eslint-disable @typescript-eslint/no-explicit-any */
function requestOf(r: any): TeacherRequest {
  return {
    userId: r.user_id, fullName: r.full_name, bio: r.bio ?? "", credentials: r.credentials ?? "",
    contact: r.contact ?? "", status: r.status, adminNote: r.admin_note ?? "", createdAt: r.created_at,
    user: r.user ? userOf(r.user, r.user_id) : undefined,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function myTeacherRequest(): Promise<TeacherRequest | null> {
  const u = sbUser();
  if (!u) return null;
  const rows = await sbSelect("lexa_teacher_requests", `user_id=eq.${u.id}&select=*`);
  return rows[0] ? requestOf(rows[0]) : null;
}

export const requestTeacherAccount = (f: { fullName: string; bio: string; credentials: string; contact: string }) =>
  sbRpc<string>("lexa_request_teacher", { p_full_name: f.fullName, p_bio: f.bio, p_credentials: f.credentials, p_contact: f.contact });

// --- Lexa admin ---
export async function adminTeacherRequests(status: "pending" | "approved" | "rejected" = "pending"): Promise<TeacherRequest[]> {
  const rows = await sbSelect(
    "lexa_teacher_requests",
    `status=eq.${status}&select=*,user:lexa_profiles(id,username,display_name,avatar_url,role)&order=created_at.asc&limit=200`,
  );
  return rows.map(requestOf);
}
export const adminReviewTeacher = (userId: string, approve: boolean, note = "") =>
  sbRpc<string>("lexa_admin_review_teacher", { uid: userId, approve, note });
export const adminSetRole = (userId: string, role: "user" | "teacher" | "admin") =>
  sbRpc<string>("lexa_admin_set_role", { uid: userId, new_role: role });

export async function adminOrgs(): Promise<(Org & { creator: MiniUser })[]> {
  const rows = await sbSelect<Record<string, unknown>>(
    "lexa_orgs", `select=*,${PRIVATE_EMBED},creator:lexa_profiles(id,username,display_name,avatar_url,role)&order=created_at.desc&limit=300`,
  );
  return rows.map((r) => ({ ...orgOf(r), creator: userOf(r.creator, String(r.created_by ?? "")) }));
}
export const adminSetOrg = (orgId: string, f: { status: OrgStatus; plan: OrgPlan; seats: number; expiresAt: string | null; note: string }) =>
  sbRpc<string>("lexa_admin_set_org", {
    o: orgId, new_status: f.status, new_plan: f.plan, new_seats: f.seats, new_expires: f.expiresAt, note: f.note,
  });

// --- hooks ---
/** my memberships, reloaded when the cloud account changes */
export function useMyMemberships() {
  const [items, setItems] = React.useState<MyMembership[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [uid, setUid] = React.useState<string | null>(() => sbUser()?.id ?? null);
  const reqRef = React.useRef(0);
  React.useEffect(() => onAuthChange(() => setUid(sbUser()?.id ?? null)), []);
  const reload = React.useCallback(async () => {
    const id = ++reqRef.current;
    if (!sbUser()) { setItems([]); setLoading(false); return; }
    setLoading(true);
    try {
      const rows = await myMemberships();
      if (id === reqRef.current) setItems(rows);
    } catch {
      if (id === reqRef.current) setItems([]);
    } finally {
      if (id === reqRef.current) setLoading(false);
    }
  }, []);
  React.useEffect(() => { void reload(); }, [reload, uid]);
  return { items, loading, reload };
}

export function isOrgLive(o: Pick<Org, "status" | "expiresAt">): boolean {
  return o.status === "active" && (!o.expiresAt || new Date(o.expiresAt).getTime() > Date.now());
}

/** orgs I can publish under (active member of an active org) */
export function usePublishOrgs() {
  const { items, loading } = useMyMemberships();
  const orgs = React.useMemo(() => items.filter((m) => m.status === "active" && isOrgLive(m.org)).map((m) => m.org), [items]);
  return { orgs, loading };
}

/** orgs I manage (owner / manager, active) */
export function useManagedOrgs() {
  const { items, loading, reload } = useMyMemberships();
  const orgs = React.useMemo(
    () => items.filter((m) => m.status === "active" && (m.role === "owner" || m.role === "manager")).map((m) => m.org),
    [items],
  );
  return { orgs, loading, reload };
}
