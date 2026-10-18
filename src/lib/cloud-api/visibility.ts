"use client";
/* Content visibility (phase 2 of docs/ORG_LEARNING.md, supabase/007_content_visibility.sql).
 * RLS decides what each reader gets; this file has the labels for the editor, the public
 * preview cards of centre-only courses, the private centre media bucket and the clean-up of
 * offline copies after access is lost. */
import * as React from "react";
import { sbFetch, sbUser } from "@/lib/supabase";
import { supaUrl } from "@/lib/supabase-config";
import { useApp } from "@/lib/store";
import { HttpError, inList, isUuid, sbRpc, sbSelect } from "./rest";

export type Visibility = "public" | "users" | "org" | "draft";

export const VISIBILITIES: { key: Visibility; label: string; hint: string }[] = [
  { key: "public", label: "عمومی", hint: "همه، حتی بدون ورود به حساب" },
  { key: "users", label: "کاربران Lexa", hint: "هر کسی که وارد حساب Lexa شده باشد" },
  { key: "org", label: "دانشجویان مرکز", hint: "فقط دانشجویان رسمی و مدرسان مرکز انتخاب‌شده" },
  { key: "draft", label: "پیش‌نویس", hint: "فقط خودتان و مدیران همان مرکز" },
];
export const visibilityLabel = (v: string | null | undefined) =>
  VISIBILITIES.find((x) => x.key === v)?.label ?? "عمومی";

export function asVisibility(v: unknown): Visibility {
  return v === "users" || v === "org" || v === "draft" ? v : "public";
}

/** problems before saving (Persian), or "" */
export function visibilityProblem(v: Visibility, orgId: string | null | undefined): string {
  if (v === "org" && !orgId) return "برای «دانشجویان مرکز»، مرکز آموزشی را انتخاب کنید.";
  return "";
}

// --- preview cards of centre-only courses ---
export interface CoursePreview {
  id: string;
  title: string;
  tagline: string;
  icon: string;
  accent: string;
  thumbnail: string;
  categories: string[];
  teacherId: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
  chapters: number;
  updatedAt: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function coursePreviews(orgId?: string | null, limit = 60): Promise<CoursePreview[]> {
  const rows = await sbRpc<any[]>("lexa_org_course_previews", { o: orgId && isUuid(orgId) ? orgId : null, lim: limit });
  return (rows ?? []).map((r) => ({
    id: r.id, title: r.title ?? "", tagline: r.tagline ?? "", icon: r.icon ?? "", accent: r.accent ?? "bronze",
    thumbnail: r.thumbnail ?? "", categories: Array.isArray(r.categories) ? r.categories : [], teacherId: r.teacher_id,
    orgId: r.org_id, orgName: r.org_name ?? "", orgSlug: r.org_slug ?? "", chapters: Number(r.chapters) || 0,
    updatedAt: r.updated_at,
  }));
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const previewLabel = (orgName: string) => `مخصوص دانشجویان ${orgName}`;

// --- private centre media: stored in content as "lexa-org://<org_id>/<user_id>/<file>" ---
export const ORG_MEDIA_BUCKET = "lexa-org-media";
export const ORG_MEDIA_PREFIX = "lexa-org://";
export const isOrgMediaRef = (url: string | null | undefined) => !!url && url.startsWith(ORG_MEDIA_PREFIX);

/** upload a file only members of the centre can open; returns the lexa-org:// reference */
export async function uploadOrgMedia(orgId: string, file: Blob, name = "file"): Promise<string> {
  const u = sbUser();
  if (!u) throw new Error("ابتدا وارد حساب کاربری خود شوید.");
  if (!isUuid(orgId)) throw new Error("مرکز آموزشی نامعتبر است.");
  if (file.size > 50 * 1024 * 1024) throw new Error("حجم فایل بیش از ۵۰ مگابایت است.");
  const ext = (name.match(/\.([a-z0-9]{1,8})$/i)?.[1] ?? "bin").toLowerCase();
  const path = `${orgId}/${u.id}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const res = await sbFetch(`/storage/v1/object/${ORG_MEDIA_BUCKET}/${path}`, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!res.ok) throw new HttpError(res.status, "آپلود فایل مرکز انجام نشد.");
  return ORG_MEDIA_PREFIX + path;
}

const signed = new Map<string, { url: string; until: number }>();

/** a 10-minute signed URL for a lexa-org:// reference ("" when the reader has no access) */
export async function orgMediaUrl(ref: string): Promise<string> {
  if (!isOrgMediaRef(ref)) return ref;
  const path = ref.slice(ORG_MEDIA_PREFIX.length);
  const hit = signed.get(path);
  if (hit && hit.until > Date.now()) return hit.url;
  const res = await sbFetch(`/storage/v1/object/sign/${ORG_MEDIA_BUCKET}/${path}`, {
    method: "POST",
    body: JSON.stringify({ expiresIn: 600 }),
  });
  if (!res.ok) return "";
  const j = (await res.json().catch(() => ({}))) as { signedURL?: string; signedUrl?: string };
  const rel = j.signedURL ?? j.signedUrl ?? "";
  if (!rel) return "";
  const url = rel.startsWith("http") ? rel : `${supaUrl()}/storage/v1${rel.startsWith("/") ? "" : "/"}${rel}`;
  signed.set(path, { url, until: Date.now() + 9 * 60_000 });
  return url;
}

/** resolve a media URL for rendering: normal URLs pass through, lexa-org:// is signed */
export function useMediaUrl(src: string | null | undefined): string {
  const [url, setUrl] = React.useState(() => (src && !isOrgMediaRef(src) ? src : ""));
  React.useEffect(() => {
    let alive = true;
    if (!src) { setUrl(""); return; }
    if (!isOrgMediaRef(src)) { setUrl(src); return; }
    void orgMediaUrl(src).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [src]);
  return url;
}

// --- offline copies ---
type CachedCourse = { id: string; _visibility?: string };

/** remove offline copies of courses that are no longer visible to this account (signed out,
 *  graduated with limited access, suspended, removed from the centre ...). Public copies stay.
 *  Returns the ids that were removed. */
export async function pruneLostAccess(): Promise<string[]> {
  const st = useApp.getState() as unknown as { tBooks: CachedCourse[]; setTBooks: (b: never[]) => void };
  const books = Array.isArray(st.tBooks) ? st.tBooks : [];
  const guarded = books.filter((b) => b && isUuid(b.id) && b._visibility && b._visibility !== "public");
  if (!guarded.length) return [];
  let visible: Set<string>;
  if (!sbUser()) {
    visible = new Set();
  } else {
    try {
      const rows: { id: string }[] = [];
      for (let i = 0; i < guarded.length; i += 100) {
        const ids = guarded.slice(i, i + 100).map((b) => b.id);
        rows.push(...(await sbSelect<{ id: string }>("lexa_tcourses", `id=${inList(ids)}&select=id`)));
      }
      visible = new Set(rows.map((r) => r.id));
    } catch {
      // offline or server error: never delete on a failed check
      return [];
    }
  }
  const lost = guarded.filter((b) => !visible.has(b.id)).map((b) => b.id);
  if (lost.length) st.setTBooks(books.filter((b) => !lost.includes(b.id)) as never[]);
  return lost;
}
