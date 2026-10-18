"use client";
/* Thin PostgREST / Storage helpers for the cloud social layer.
 * Every call goes through sbFetch, so the signed-in user's token (with
 * automatic refresh) is used and RLS in supabase/002_cloud_social.sql decides
 * what each row allows. */
import { sbFetch } from "@/lib/supabase";
import { supaUrl } from "@/lib/supabase-config";

export const MEDIA_BUCKET = "lexa-media";

export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, message: string, code = "") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function fail(res: Response): Promise<never> {
  let msg = "";
  let code = "";
  try {
    const j = (await res.json()) as { message?: string; error?: string; error_description?: string; msg?: string; code?: string; statusCode?: string | number };
    msg = j.message || j.error_description || j.error || j.msg || "";
    // Storage answers HTTP 400 with the real status inside the body
    code = j.code || (j.statusCode ? String(j.statusCode) : "");
  } catch { /* not JSON */ }
  throw new HttpError(res.status, msg || `cloud error ${res.status}`, code);
}

/** in.(…) filter value; ids are uuids so no quoting is needed */
export function inList(ids: string[]): string {
  return `in.(${ids.join(",")})`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

export async function sbSelect<T>(table: string, query: string): Promise<T[]> {
  const res = await sbFetch(`/rest/v1/${table}?${query}`);
  if (!res.ok) await fail(res);
  return (await res.json()) as T[];
}

export async function sbInsert<T>(
  table: string,
  row: unknown,
  opts: { select?: string; onConflict?: string; merge?: boolean; ignore?: boolean } = {},
): Promise<T[]> {
  const prefer = ["return=representation"];
  if (opts.merge) prefer.push("resolution=merge-duplicates");
  if (opts.ignore) prefer.push("resolution=ignore-duplicates");
  const q: string[] = [];
  if (opts.onConflict) q.push(`on_conflict=${opts.onConflict}`);
  if (opts.select) q.push(`select=${opts.select}`);
  const res = await sbFetch(`/rest/v1/${table}${q.length ? `?${q.join("&")}` : ""}`, {
    method: "POST",
    headers: { Prefer: prefer.join(",") },
    body: JSON.stringify(row),
  });
  if (!res.ok) await fail(res);
  return (await res.json().catch(() => [])) as T[];
}

export async function sbUpdate<T>(table: string, filter: string, patch: unknown, select = "*"): Promise<T[]> {
  const res = await sbFetch(`/rest/v1/${table}?${filter}&select=${select}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) await fail(res);
  return (await res.json().catch(() => [])) as T[];
}

export async function sbDelete(table: string, filter: string): Promise<number> {
  const res = await sbFetch(`/rest/v1/${table}?${filter}`, {
    method: "DELETE",
    headers: { Prefer: "return=representation" },
  });
  if (!res.ok) await fail(res);
  const rows = (await res.json().catch(() => [])) as unknown[];
  return Array.isArray(rows) ? rows.length : 0;
}

export async function sbRpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const res = await sbFetch(`/rest/v1/rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
  if (!res.ok) await fail(res);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export function mediaPublicUrl(path: string): string {
  return `${supaUrl()}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}

/** object path inside the bucket for one of our public URLs, or "" */
export function mediaPathOf(url: string | null | undefined): string {
  if (!url) return "";
  const prefix = `${supaUrl()}/storage/v1/object/public/${MEDIA_BUCKET}/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : "";
}

/** Paths are unique (time + random), so no upsert: with x-upsert Storage also needs a
 *  SELECT policy on storage.objects, which 002 never had, and every upload was refused. */
export async function sbUpload(path: string, file: Blob, contentType: string): Promise<string> {
  const res = await sbFetch(`/storage/v1/object/${MEDIA_BUCKET}/${path}`, {
    method: "POST",
    headers: { "Content-Type": contentType, "cache-control": "max-age=31536000" },
    body: file,
  });
  if (!res.ok) await fail(res);
  return mediaPublicUrl(path);
}

export async function sbRemoveMedia(path: string): Promise<void> {
  if (!path) return;
  try {
    await sbFetch(`/storage/v1/object/${MEDIA_BUCKET}`, {
      method: "DELETE",
      body: JSON.stringify({ prefixes: [path] }),
    });
  } catch { /* best effort */ }
}
