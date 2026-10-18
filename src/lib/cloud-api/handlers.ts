"use client";
/* === Cloud social API — the /api/* social routes, answered from Supabase ===
 *
 * The Pages site and the APK are static exports (no /api), and the desktop app
 * runs its own local SQLite server, so teachers, posts and courses used to live
 * in different places (or nowhere). install.ts routes the social /api calls of
 * every platform here; each handler answers with the same JSON shape the old
 * Next route returned, so the existing screens work unchanged.
 *
 * Tables, RLS and RPCs: supabase/002_cloud_social.sql
 * --- */
import { sbUser } from "@/lib/supabase";
import type { PublicUser } from "@/lib/auth-shared";
import type { Course } from "@/lib/law/types";
import {
  CATEGORY_SLUGS, inCategory, safeCategories, safeCategory, safeThumbnail,
  sanitizeQuiz, sanitizeSections, teacherCourseToCourse, type AuthorMeta,
} from "@/lib/social-shared";
import {
  HttpError, inList, isUuid, mediaPathOf, sbDelete, sbInsert, sbRemoveMedia, sbRpc,
  sbSelect, sbUpdate, sbUpload,
} from "./rest";

export interface CloudReq {
  method: string;
  path: string; // "/api/…" without query
  query: URLSearchParams;
  body: unknown;
  form: FormData | null;
}
export interface CloudRes { status: number; body: unknown }

const ok = (body: unknown): CloudRes => ({ status: 200, body });
const fail = (status: number, error: string): CloudRes => ({ status, body: { error } });

const MSG = {
  login: "برای این کار ابتدا با حساب Lexa (ایمیل) وارد شوید.",
  teacher: "این کار فقط برای حساب‌های مدرس است.",
  forbidden: "اجازهٔ این کار را ندارید.",
  offline: "اتصال به Lexa برقرار نشد؛ اتصال اینترنت را بررسی کنید.",
  rate: "کمی آهسته‌تر — چند لحظه بعد دوباره تلاش کنید.",
  badJson: "درخواست نامعتبر است.",
  postNotFound: "مطلب یافت نشد.",
  courseNotFound: "دوره یافت نشد.",
};

// --- current user (profile row, cached a minute) ---
interface ProfileRow {
  id: string;
  username: string | null;
  role: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
}
const PROFILE_COLS = "id,username,role,display_name,bio,avatar_url,created_at";

function defaultUsername(id: string): string {
  return "u" + id.replace(/-/g, "").slice(0, 10);
}

function toPublicUser(p: ProfileRow): PublicUser {
  const role = p.role === "admin" || p.role === "teacher" ? p.role : "user";
  return {
    id: p.id,
    username: p.username || defaultUsername(p.id),
    role,
    displayName: p.display_name || null,
    bio: p.bio || null,
    avatarUrl: p.avatar_url || null,
    createdAt: p.created_at,
  };
}

function authorOf(p: Partial<ProfileRow> | null | undefined, fallbackId = ""): AuthorMeta {
  const id = p?.id || fallbackId;
  const username = p?.username || (id ? defaultUsername(id) : "");
  return { id, username, displayName: p?.display_name || username, avatarUrl: p?.avatar_url || null };
}

let meCache: { uid: string; at: number; me: PublicUser } | null = null;

export function forgetCloudMe() {
  meCache = null;
}

export async function cloudMe(force = false): Promise<PublicUser | null> {
  const u = sbUser();
  if (!u) return null;
  if (!force && meCache && meCache.uid === u.id && Date.now() - meCache.at < 60_000) return meCache.me;
  let rows = await sbSelect<ProfileRow>("lexa_profiles", `id=eq.${u.id}&select=${PROFILE_COLS}`);
  if (!rows.length) {
    // accounts created before 002 ran: make the row now (the trigger forces role=user)
    await sbInsert("lexa_profiles", { id: u.id, username: defaultUsername(u.id) }, { onConflict: "id", ignore: true });
    rows = await sbSelect<ProfileRow>("lexa_profiles", `id=eq.${u.id}&select=${PROFILE_COLS}`);
  }
  if (!rows.length) return null;
  const me = toPublicUser(rows[0]);
  meCache = { uid: u.id, at: Date.now(), me };
  return me;
}

const isTeacher = (me: PublicUser | null) => !!me && (me.role === "teacher" || me.role === "admin");

// --- ratings + ranking (same formula as the old server) ---
interface RatingInfo { avg: number; count: number }

async function ratingAggs(type: "post" | "tcourse", ids: string[]): Promise<Map<string, RatingInfo>> {
  const out = new Map<string, RatingInfo>();
  const valid = ids.filter(isUuid);
  if (!valid.length) return out;
  const rows = await sbRpc<{ target_id: string; avg: number | string; cnt: number | string }[]>(
    "lexa_rating_aggs", { t: type, ids: valid },
  );
  for (const r of rows ?? []) out.set(r.target_id, { avg: Number(r.avg) || 0, count: Number(r.cnt) || 0 });
  return out;
}

function feedScore(iso: string, agg?: RatingInfo): number {
  const t = new Date(iso).getTime() || Date.now();
  const ageDays = Math.max(0, (Date.now() - t) / 86_400_000);
  const ratingW = agg && agg.count > 0 ? agg.avg * Math.min(1.2, Math.sqrt(agg.count) / 2) : 0;
  return ratingW * 2 - ageDays * 0.35;
}

async function studentsCounts(ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const valid = ids.filter(isUuid);
  if (!valid.length) return out;
  const rows = await sbRpc<{ course_id: string; students: number | string }[]>("lexa_course_students", { ids: valid });
  for (const r of rows ?? []) out.set(r.course_id, Number(r.students) || 0);
  return out;
}

async function myLibraryIds(me: PublicUser | null): Promise<Set<string>> {
  if (!me) return new Set();
  const rows = await sbSelect<{ course_id: string }>("lexa_library", `user_id=eq.${me.id}&select=course_id`);
  return new Set(rows.map((r) => r.course_id));
}

async function myFollowIds(me: PublicUser | null): Promise<Set<string>> {
  if (!me) return new Set();
  const rows = await sbSelect<{ teacher_id: string }>("lexa_follows", `student_id=eq.${me.id}&select=teacher_id`);
  return new Set(rows.map((r) => r.teacher_id));
}

// --- row shapes ---
interface OrgMini { id: string; name: string; slug: string; logo_url: string }
interface PostRow {
  id: string; author_id: string; org_id: string | null; visibility?: string; title: string; summary: string; tags: string;
  category: string; categories: unknown; thumbnail: string; quiz?: unknown; blocks?: unknown;
  created_at: string; updated_at: string;
  author?: Partial<ProfileRow> | null;
  org?: OrgMini | null;
  lexa_comments?: { count: number }[];
}
interface CourseRow {
  id: string; teacher_id: string; org_id: string | null; visibility?: string; allow_preview?: boolean;
  title: string; tagline: string; description: string;
  icon: string; accent: string; category: string; categories: unknown; status: string; thumbnail: string;
  chapters: unknown; published_at: string | null; created_at: string; updated_at: string;
  teacher?: Partial<ProfileRow> | null;
  org?: OrgMini | null;
}

/* Every profile embed names its FK constraint explicitly: PostgREST also sees
 * many-to-many paths through junction tables (e.g. lexa_library between
 * lexa_tcourses and lexa_profiles) and fails with PGRST201 when the embed is
 * ambiguous — the same family of bug as the admin centres list (PR #17). */
const AUTHOR_EMBED = "author:lexa_profiles!lexa_posts_author_id_fkey(id,username,display_name,avatar_url,bio)";
const TEACHER_EMBED = "teacher:lexa_profiles!lexa_tcourses_teacher_id_fkey(id,username,display_name,avatar_url)";
const ORG_EMBED = "org:lexa_orgs(id,name,slug,logo_url)";
const POST_CARD_COLS = `id,author_id,org_id,visibility,title,summary,tags,category,categories,thumbnail,created_at,updated_at,${AUTHOR_EMBED},${ORG_EMBED},lexa_comments(count)`;

/* visibility level of a post/course (007 + 008); unknown values fall back to public */
const VISIBILITY_LEVELS = ["public", "users", "org", "class", "draft"];
const safeVisibility = (v: unknown): string => (typeof v === "string" && VISIBILITY_LEVELS.includes(v) ? v : "public");

function orgOut(o: OrgMini | null | undefined) {
  return o ? { id: o.id, name: o.name, slug: o.slug, logoUrl: o.logo_url || null } : null;
}

function catsOf(v: unknown, legacy: string): string[] {
  if (Array.isArray(v) && v.length) return safeCategories(v);
  return [safeCategory(legacy)];
}

function postCard(p: PostRow, agg?: RatingInfo) {
  const author = authorOf(p.author, p.author_id);
  return {
    id: p.id,
    title: p.title,
    summary: p.summary,
    tags: p.tags,
    category: p.category,
    categories: catsOf(p.categories, p.category),
    thumbnail: p.thumbnail,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    commentsCount: p.lexa_comments?.[0]?.count ?? 0,
    rating: agg ?? { avg: 0, count: 0 },
    score: feedScore(p.created_at, agg),
    author: { id: author.id, username: author.username, displayName: author.displayName, avatarUrl: author.avatarUrl },
    org: orgOut(p.org),
    _visibility: safeVisibility(p.visibility),
  };
}

function courseOf(row: CourseRow): Course & Record<string, unknown> {
  const teacher = authorOf(row.teacher, row.teacher_id);
  const c = teacherCourseToCourse(
    {
      id: row.id, title: row.title, tagline: row.tagline, description: row.description,
      icon: row.icon, accent: row.accent, chaptersJson: JSON.stringify(row.chapters ?? []),
      category: row.category, categories: JSON.stringify(Array.isArray(row.categories) ? row.categories : []),
      status: row.status, thumbnail: row.thumbnail,
    },
    teacher,
  );
  return {
    ...c,
    _updatedAt: row.updated_at, _orgId: row.org_id, _org: orgOut(row.org),
    _visibility: safeVisibility(row.visibility), _allowPreview: row.allow_preview === true,
  } as Course & Record<string, unknown>;
}

function courseCard(row: CourseRow, me: PublicUser | null, lib: Set<string>, students: Map<string, number>, agg?: RatingInfo) {
  const course = courseOf(row);
  const teacher = authorOf(row.teacher, row.teacher_id);
  const lessonsCount = course.chapters.reduce((n, ch) => n + ch.lessons.length, 0);
  return {
    ...course,
    teacher: { id: teacher.id, username: teacher.username, displayName: teacher.displayName, avatarUrl: teacher.avatarUrl },
    lessonsCount,
    studentsCount: students.get(row.id) ?? 0,
    inLibrary: lib.has(row.id),
    canManage: !!me && (me.id === row.teacher_id || me.role === "admin"),
    rating: agg ?? { avg: 0, count: 0 },
    _updatedAt: row.updated_at,
    score: feedScore(row.updated_at, agg),
  };
}

// --- auth / profile ---
async function authMe(): Promise<CloudRes> {
  return ok({ user: await cloudMe(true) });
}

async function cloudBridge(): Promise<CloudRes> {
  const me = await cloudMe(true);
  return me ? ok({ ok: true, user: me }) : fail(401, MSG.login);
}

async function changePassword(req: CloudReq): Promise<CloudRes> {
  const u = sbUser();
  if (!u) return fail(401, MSG.login);
  const b = (req.body ?? {}) as { current?: string; next?: string };
  const next = String(b.next ?? "");
  if (next.length < 6) return fail(400, "رمز تازه باید دست‌کم ۶ نویسه باشد.");
  const { supaUrl, supaKey } = await import("@/lib/supabase-config");
  // check the current password without replacing the stored session
  const chk = await fetch(`${supaUrl()}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: supaKey(), "Content-Type": "application/json" },
    body: JSON.stringify({ email: u.email, password: String(b.current ?? "") }),
  });
  if (!chk.ok) return fail(400, "رمز فعلی درست نیست.");
  const { sbFetch } = await import("@/lib/supabase");
  const res = await sbFetch("/auth/v1/user", { method: "PUT", body: JSON.stringify({ password: next }) });
  if (!res.ok) return fail(400, "تغییر رمز انجام نشد.");
  return ok({ ok: true });
}

async function patchProfile(req: CloudReq): Promise<CloudRes> {
  const me = await cloudMe(true);
  if (!me) return fail(401, MSG.login);
  const b = req.body as Record<string, unknown> | null;
  if (!b || typeof b !== "object") return fail(400, MSG.badJson);
  const patch: Record<string, unknown> = {};
  if ("displayName" in b) patch.display_name = typeof b.displayName === "string" ? b.displayName.trim().slice(0, 48) || null : null;
  if ("bio" in b) {
    if (me.role === "user") return fail(400, "معرفی کوتاه فقط برای حساب‌های مدرس است.");
    patch.bio = typeof b.bio === "string" ? b.bio.trim().slice(0, 320) || null : null;
  }
  if (typeof b.username === "string" && b.username.trim() && b.username.trim() !== me.username) {
    try {
      await sbRpc("lexa_set_username", { uname: b.username.trim() });
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      return fail(400, m.includes("taken") ? "این نام کاربری قبلاً گرفته شده." : "نام کاربری نامعتبر است (۳ تا ۲۰ نویسه: حروف، رقم، _ یا .).");
    }
  }
  if (Object.keys(patch).length) await sbUpdate("lexa_profiles", `id=eq.${me.id}`, patch, "id");
  const fresh = await cloudMe(true);
  return ok({ ok: true, user: fresh });
}

const IMAGE_EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/webp": "webp", "image/gif": "gif" };

/** Phone photos are often 3-12 MB (and sometimes HEIC): shrink and re-encode in the
 *  browser so every picture fits the bucket limits instead of being refused. */
async function shrinkImage(file: Blob, maxSide: number, maxBytes: number): Promise<Blob | null> {
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") return null;
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    return null; // a format this browser cannot decode
  }
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) { bmp.close(); return null; }
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const encode = (type: string, q: number) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, q));
  for (const q of [0.86, 0.74, 0.6]) {
    let out = await encode("image/webp", q);
    // browsers without a WebP encoder hand back PNG: use JPEG there
    if (!out || out.type !== "image/webp") out = await encode("image/jpeg", q);
    if (out && out.size <= maxBytes) return out;
  }
  return null;
}

function uploadError(e: unknown): CloudRes {
  const m = e instanceof HttpError ? `${e.message} ${e.code}` : String(e ?? "");
  if (/row-level security|unauthorized|403/i.test(m)) return fail(403, "اجازهٔ بارگذاری تصویر وجود ندارد؛ یک بار از حساب خارج و دوباره وارد شوید.");
  if (/bucket not found/i.test(m)) return fail(503, "فضای ذخیرهٔ تصاویر هنوز راه‌اندازی نشده است.");
  if (/maximum allowed size|too large|413/i.test(m)) return fail(400, "حجم تصویر بیش از حد مجاز است.");
  if (/mime/i.test(m)) return fail(400, "این قالب تصویر پشتیبانی نمی‌شود؛ تصویر PNG، JPG یا WebP انتخاب کنید.");
  if (e instanceof TypeError) return fail(503, MSG.offline);
  return fail(500, "بارگذاری تصویر انجام نشد؛ لطفاً دوباره تلاش کنید.");
}

async function uploadImage(req: CloudReq, prefix: string, maxBytes: number, allowGif: boolean, maxSide: number): Promise<{ url: string } | CloudRes> {
  const me = await cloudMe();
  if (!me) return fail(401, MSG.login);
  const file = req.form?.get("file");
  if (!file || typeof file === "string") return fail(400, "فایلی انتخاب نشده است.");
  let blob: Blob = file;
  let type = (file.type || "").toLowerCase().replace("image/jpg", "image/jpeg");
  let ext = IMAGE_EXT[type];
  const big = file.size > maxBytes;
  if (!ext || (!allowGif && ext === "gif") || big || (ext !== "gif" && file.size > 600 * 1024)) {
    const small = await shrinkImage(file, maxSide, maxBytes);
    if (small) { blob = small; type = small.type; ext = IMAGE_EXT[type]; }
  }
  if (!type.startsWith("image/")) return fail(400, "فایل انتخاب‌شده تصویر نیست.");
  if (!ext || (!allowGif && ext === "gif")) return fail(400, "این قالب تصویر پشتیبانی نمی‌شود؛ تصویر PNG، JPG یا WebP انتخاب کنید.");
  if (blob.size > maxBytes) return fail(400, `حجم تصویر باید کمتر از ${Math.round(maxBytes / 1048576)} مگابایت باشد.`);
  const path = `${me.id}/${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.${ext}`;
  try {
    return { url: await sbUpload(path, blob, type) };
  } catch (e) {
    return uploadError(e);
  }
}

async function avatarUpload(req: CloudReq): Promise<CloudRes> {
  const up = await uploadImage(req, "avatar", 2 * 1024 * 1024, true, 512);
  if ("status" in up) return up;
  const me = (await cloudMe())!;
  const old = mediaPathOf(me.avatarUrl);
  await sbUpdate("lexa_profiles", `id=eq.${me.id}`, { avatar_url: up.url }, "id");
  if (old) void sbRemoveMedia(old);
  forgetCloudMe();
  return ok({ ok: true, avatarUrl: up.url });
}

async function avatarDelete(): Promise<CloudRes> {
  const me = await cloudMe(true);
  if (!me) return fail(401, MSG.login);
  const old = mediaPathOf(me.avatarUrl);
  await sbUpdate("lexa_profiles", `id=eq.${me.id}`, { avatar_url: null }, "id");
  if (old) void sbRemoveMedia(old);
  forgetCloudMe();
  return ok({ ok: true, avatarUrl: null });
}

async function coverUpload(req: CloudReq): Promise<CloudRes> {
  const me = await cloudMe();
  if (!me) return fail(401, MSG.login);
  if (!isTeacher(me) && req.query.get("kind") !== "org") return fail(403, MSG.teacher);
  const logo = req.query.get("kind") === "org";
  if (logo && me.role !== "admin") {
    // centre logos: only an active owner/manager of some centre (same rule as the settings tab)
    const rows = await sbSelect<{ org_id: string }>(
      "lexa_org_members",
      `user_id=eq.${me.id}&status=eq.active&role=in.(owner,manager)&select=org_id&limit=1`,
    );
    if (!rows.length) return fail(403, MSG.forbidden);
  }
  const up = await uploadImage(req, logo ? "logo" : "cover", 4 * 1024 * 1024, false, logo ? 600 : 1600);
  if ("status" in up) return up;
  return ok({ ok: true, url: up.url });
}

// --- posts ---
function postFields(b: Record<string, unknown>) {
  const cats = safeCategories(b.categories ?? b.category);
  const single = typeof b.category === "string" && CATEGORY_SLUGS.includes(b.category) ? b.category : cats[0] ?? "";
  return { cats, single };
}

async function orgIdFrom(b: Record<string, unknown>): Promise<string | null> {
  const v = b.orgId;
  return isUuid(v) ? v : null;
}

async function myPosts(): Promise<CloudRes> {
  const me = await cloudMe();
  if (!me) return fail(401, MSG.login);
  if (!isTeacher(me)) return ok({ posts: [] });
  const rows = await sbSelect<PostRow>(
    "lexa_posts",
    `author_id=eq.${me.id}&select=id,title,summary,tags,thumbnail,quiz,created_at,updated_at,org_id,${ORG_EMBED},lexa_comments(count)&order=created_at.desc&limit=500`,
  );
  return ok({
    posts: rows.map((p) => ({
      id: p.id, title: p.title, summary: p.summary, tags: p.tags, thumbnail: p.thumbnail,
      quizCount: Array.isArray(p.quiz) ? p.quiz.length : 0,
      createdAt: p.created_at, updatedAt: p.updated_at,
      commentsCount: p.lexa_comments?.[0]?.count ?? 0,
      visibility: safeVisibility(p.visibility),
      org: orgOut(p.org),
    })),
  });
}

async function createPost(req: CloudReq): Promise<CloudRes> {
  const me = await cloudMe();
  if (!me) return fail(401, "برای انتشار مطلب، ابتدا با حساب Lexa وارد شوید.");
  if (!isTeacher(me)) return fail(403, MSG.teacher);
  const b = req.body as Record<string, unknown> | null;
  if (!b || typeof b !== "object") return fail(400, MSG.badJson);
  const title = String(b.title ?? "").trim().slice(0, 140);
  if (!title) return fail(400, "عنوان مطلب لازم است.");
  const blocks = sanitizeSections(b.blocks);
  if (!blocks.length) return fail(400, "دست‌کم یک بلوک محتوا لازم است.");
  const { cats, single } = postFields(b);
  const rows = await sbInsert<{ id: string }>("lexa_posts", {
    author_id: me.id,
    org_id: await orgIdFrom(b),
    visibility: safeVisibility(b.visibility),
    title,
    summary: String(b.summary ?? "").trim().slice(0, 280),
    tags: String(b.tags ?? "").trim().slice(0, 120),
    category: single,
    categories: cats,
    thumbnail: safeThumbnail(b.thumbnail),
    quiz: sanitizeQuiz(b.quiz),
    blocks,
  }, { select: "id" });
  return ok({ ok: true, id: rows[0]?.id });
}

async function getPost(id: string): Promise<CloudRes> {
  if (!isUuid(id)) return fail(404, MSG.postNotFound);
  const me = await cloudMe().catch(() => null);
  const rows = await sbSelect<PostRow>("lexa_posts", `id=eq.${id}&select=*,${AUTHOR_EMBED},${ORG_EMBED}`);
  const p = rows[0];
  if (!p) return fail(404, MSG.postNotFound);
  const comments = await sbSelect<{
    id: string; text: string; created_at: string; reply_to_id: string | null; user_id: string;
    user?: Partial<ProfileRow> | null;
  }>("lexa_comments", `post_id=eq.${id}&select=id,text,created_at,reply_to_id,user_id,user:lexa_profiles!lexa_comments_user_id_fkey(id,username,display_name,avatar_url)&order=created_at.asc&limit=200`);
  const author = authorOf(p.author, p.author_id);
  return ok({
    post: {
      id: p.id, title: p.title, summary: p.summary, tags: p.tags, category: p.category,
      categories: catsOf(p.categories, p.category), thumbnail: p.thumbnail,
      quiz: sanitizeQuiz(p.quiz), blocks: p.blocks ?? [],
      createdAt: p.created_at, updatedAt: p.updated_at,
      author: { ...author, bio: p.author?.bio || "" },
      orgId: p.org_id, org: orgOut(p.org),
      visibility: safeVisibility(p.visibility),
      canManage: !!me && (me.id === p.author_id || me.role === "admin"),
    },
    comments: (() => {
      // «در پاسخ به …» must survive a reload, not only show right after replying
      const nameById = new Map(comments.map((c) => [c.id, authorOf(c.user, c.user_id).displayName]));
      return comments.map((c) => {
        const a = authorOf(c.user, c.user_id);
        return {
          id: c.id, text: c.text, createdAt: c.created_at, replyToId: c.reply_to_id,
          replyToUsername: c.reply_to_id ? nameById.get(c.reply_to_id) ?? null : null,
          userId: c.user_id, username: a.displayName, avatarUrl: a.avatarUrl,
        };
      });
    })(),
  });
}

async function putPost(id: string, req: CloudReq): Promise<CloudRes> {
  const me = await cloudMe();
  if (!me) return fail(401, MSG.login);
  if (!isUuid(id)) return fail(404, MSG.postNotFound);
  const cur = await sbSelect<{ id: string; author_id: string }>("lexa_posts", `id=eq.${id}&select=id,author_id`);
  if (!cur[0]) return fail(404, MSG.postNotFound);
  if (cur[0].author_id !== me.id && me.role !== "admin") return fail(403, MSG.forbidden);
  const b = req.body as Record<string, unknown> | null;
  if (!b || typeof b !== "object") return fail(400, MSG.badJson);
  const blocks = sanitizeSections(b.blocks);
  if (!blocks.length) return fail(400, "دست‌کم یک بلوک محتوا لازم است.");
  const patch: Record<string, unknown> = { blocks };
  const title = String(b.title ?? "").trim().slice(0, 140);
  if (title) patch.title = title;
  if (typeof b.summary === "string") patch.summary = b.summary.trim().slice(0, 280);
  if (typeof b.tags === "string") patch.tags = b.tags.trim().slice(0, 120);
  if (typeof b.category === "string" || Array.isArray(b.categories)) {
    const { cats, single } = postFields(b);
    patch.category = single;
    patch.categories = cats;
  }
  if ("thumbnail" in b) patch.thumbnail = safeThumbnail(b.thumbnail);
  if ("quiz" in b) patch.quiz = sanitizeQuiz(b.quiz);
  if ("orgId" in b) patch.org_id = await orgIdFrom(b);
  if ("visibility" in b) patch.visibility = safeVisibility(b.visibility);
  await sbUpdate("lexa_posts", `id=eq.${id}`, patch, "id");
  return ok({ ok: true });
}

async function deletePost(id: string): Promise<CloudRes> {
  const me = await cloudMe();
  if (!me) return fail(401, MSG.login);
  if (!isUuid(id)) return fail(404, MSG.postNotFound);
  const n = await sbDelete("lexa_posts", `id=eq.${id}`);
  return n ? ok({ ok: true }) : fail(403, MSG.forbidden);
}

async function addComment(postId: string, req: CloudReq): Promise<CloudRes> {
  const me = await cloudMe();
  if (!me) return fail(401, "برای نوشتن نظر، ابتدا وارد شوید.");
  if (!isUuid(postId)) return fail(404, MSG.postNotFound);
  const b = (req.body ?? {}) as { text?: unknown; replyToId?: unknown };
  const text = String(b.text ?? "").trim().slice(0, 1200);
  if (!text) return fail(400, "متن نظر خالی است.");
  const replyTo = isUuid(b.replyToId) ? b.replyToId : null;
  const rows = await sbInsert<{
    id: string; text: string; created_at: string; reply_to_id: string | null; user_id: string;
    user?: Partial<ProfileRow> | null;
  }>("lexa_comments", { post_id: postId, user_id: me.id, text, reply_to_id: replyTo }, {
    select: "id,text,created_at,reply_to_id,user_id,user:lexa_profiles!lexa_comments_user_id_fkey(id,username,display_name,avatar_url)",
  });
  const c = rows[0];
  if (!c) return fail(500, "ثبت نظر ناموفق بود.");
  let replyToUsername: string | null = null;
  if (c.reply_to_id) {
    const parent = await sbSelect<{ user?: Partial<ProfileRow> | null; user_id: string }>(
      "lexa_comments", `id=eq.${c.reply_to_id}&select=user_id,user:lexa_profiles!lexa_comments_user_id_fkey(id,username,display_name)`,
    );
    if (parent[0]) replyToUsername = authorOf(parent[0].user, parent[0].user_id).displayName;
  }
  const a = authorOf(c.user, c.user_id);
  return ok({
    ok: true,
    comment: {
      id: c.id, text: c.text, createdAt: c.created_at, replyToId: c.reply_to_id, replyToUsername,
      userId: c.user_id, username: a.displayName, avatarUrl: a.avatarUrl,
    },
  });
}

async function deleteComment(postId: string, req: CloudReq): Promise<CloudRes> {
  const me = await cloudMe();
  if (!me) return fail(401, MSG.login);
  const cid = req.query.get("commentId");
  if (!isUuid(postId) || !isUuid(cid)) return fail(404, "نظر یافت نشد.");
  const n = await sbDelete("lexa_comments", `id=eq.${cid}&post_id=eq.${postId}`);
  return n ? ok({ ok: true }) : fail(403, MSG.forbidden);
}

// --- teacher courses ---
const COURSE_COLS = `*,${TEACHER_EMBED},${ORG_EMBED}`;

async function listCourses(req: CloudReq): Promise<CloudRes> {
  const me = await cloudMe().catch(() => null);
  const mine = req.query.get("mine") === "1" && me;
  const rows = await sbSelect<CourseRow>(
    "lexa_tcourses",
    `select=${COURSE_COLS}${mine ? `&teacher_id=eq.${me!.id}` : ""}&order=updated_at.desc&limit=80`,
  );
  const ids = rows.map((r) => r.id);
  const [aggs, lib, students] = await Promise.all([ratingAggs("tcourse", ids), myLibraryIds(me), studentsCounts(ids)]);
  const courses = rows
    .map((r) => courseCard(r, me, lib, students, aggs.get(r.id)))
    .sort((a, b) => b.score - a.score);
  return ok({ courses });
}

function cleanChapters(raw: unknown) {
  const chapters = Array.isArray(raw) ? raw.slice(0, 24) : [];
  return chapters.map((chItem) => {
    const ch = (chItem ?? {}) as Record<string, unknown>;
    const lessons = Array.isArray(ch.lessons) ? ch.lessons.slice(0, 40) : [];
    return {
      title: String(ch.title ?? "").slice(0, 140),
      subtitle: String(ch.subtitle ?? "").slice(0, 160),
      quiz: sanitizeQuiz(ch.quiz),
      lessons: lessons.map((lsItem) => {
        const ls = (lsItem ?? {}) as Record<string, unknown>;
        const minutes = Number(ls.minutes);
        return {
          title: String(ls.title ?? "").slice(0, 160),
          minutes: minutes > 0 ? Math.min(600, Math.floor(minutes)) : undefined,
          sections: sanitizeSections(ls.sections),
          quiz: sanitizeQuiz(ls.quiz),
        };
      }),
    };
  });
}

async function saveCourse(req: CloudReq): Promise<CloudRes> {
  const me = await cloudMe();
  if (!me) return fail(401, "برای ساخت دوره، ابتدا با حساب Lexa وارد شوید.");
  if (!isTeacher(me)) return fail(403, MSG.teacher);
  const b = req.body as Record<string, unknown> | null;
  if (!b || typeof b !== "object") return fail(400, MSG.badJson);
  const title = String(b.title ?? "").trim().slice(0, 140);
  if (!title) return fail(400, "عنوان دوره لازم است.");
  const chapters = cleanChapters(b.chapters);
  if (!chapters.length) return fail(400, "دست‌کم یک فصل لازم است.");
  const status = b.status === "draft" || b.status === "prep" ? b.status : "published";
  const accent = b.accent === "navy" || b.accent === "green" ? b.accent : "bronze";
  const row = {
    title,
    tagline: String(b.tagline ?? "").trim().slice(0, 160),
    description: String(b.description ?? "").trim().slice(0, 2000),
    icon: String(b.icon ?? "").trim().slice(0, 40),
    accent,
    category: safeCategory(b.category),
    categories: safeCategories(b.categories ?? b.category),
    status,
    thumbnail: safeThumbnail(b.thumbnail),
    chapters,
    org_id: await orgIdFrom(b),
    visibility: safeVisibility(b.visibility),
    allow_preview: b.allow_preview === true,
  };
  const id = typeof b.id === "string" ? b.id : "";
  if (id) {
    if (!isUuid(id)) return fail(404, MSG.courseNotFound);
    const cur = await sbSelect<{ id: string; teacher_id: string }>("lexa_tcourses", `id=eq.${id}&select=id,teacher_id`);
    if (!cur[0]) return fail(404, MSG.courseNotFound);
    if (cur[0].teacher_id !== me.id && me.role !== "admin") return fail(403, MSG.forbidden);
    await sbUpdate("lexa_tcourses", `id=eq.${id}`, row, "id");
    return ok({ ok: true, id });
  }
  const rows = await sbInsert<{ id: string }>("lexa_tcourses", { ...row, teacher_id: me.id }, { select: "id" });
  return ok({ ok: true, id: rows[0]?.id });
}

async function getCourse(id: string): Promise<CloudRes> {
  if (!isUuid(id)) return fail(404, MSG.courseNotFound);
  const me = await cloudMe().catch(() => null);
  const rows = await sbSelect<CourseRow>("lexa_tcourses", `id=eq.${id}&select=${COURSE_COLS}`);
  const r = rows[0];
  if (!r) return fail(404, MSG.courseNotFound);
  const teacher = authorOf(r.teacher, r.teacher_id);
  return ok({
    course: courseOf(r),
    teacher: { id: teacher.id, username: teacher.username, displayName: teacher.displayName, avatarUrl: teacher.avatarUrl },
    org: orgOut(r.org),
    canManage: !!me && (me.id === r.teacher_id || me.role === "admin"),
  });
}

async function deleteCourse(id: string): Promise<CloudRes> {
  const me = await cloudMe();
  if (!me) return fail(401, MSG.login);
  if (!isUuid(id)) return fail(404, MSG.courseNotFound);
  const n = await sbDelete("lexa_tcourses", `id=eq.${id}`);
  return n ? ok({ ok: true }) : fail(403, MSG.forbidden);
}

// --- social ---
async function feed(req: CloudReq): Promise<CloudRes> {
  const me = await cloudMe().catch(() => null);
  const idsParam = req.query.get("ids");
  if (idsParam !== null) {
    // offline freshness check: only the asked posts, no ranking cut
    const ids = idsParam.split(",").filter(isUuid).slice(0, 120);
    if (!ids.length) return ok({ posts: [], followingCount: 0, showingAll: true });
    const rows = await sbSelect<PostRow>("lexa_posts", `id=${inList(ids)}&select=${POST_CARD_COLS}`);
    return ok({ posts: rows.map((p) => postCard(p)), followingCount: 0, showingAll: true });
  }
  const scopeAll = req.query.get("scope") === "all";
  let authorIds: string[] | null = null;
  let followingCount = 0;
  if (me && !scopeAll) {
    const f = [...(await myFollowIds(me))];
    followingCount = f.length;
    if (f.length) authorIds = f;
  }
  const rows = await sbSelect<PostRow>(
    "lexa_posts",
    `select=${POST_CARD_COLS}${authorIds ? `&author_id=${inList(authorIds)}` : ""}&order=created_at.desc&limit=40`,
  );
  const aggs = await ratingAggs("post", rows.map((r) => r.id));
  const posts = rows.map((p) => postCard(p, aggs.get(p.id))).sort((a, b) => b.score - a.score).slice(0, 12);
  return ok({ followingCount, showingAll: !authorIds, posts });
}

async function follow(req: CloudReq): Promise<CloudRes> {
  const me = await cloudMe();
  if (!me) return fail(401, "برای دنبال کردن، ابتدا وارد شوید.");
  const teacherId = String((req.body as { teacherId?: unknown } | null)?.teacherId ?? "");
  if (!isUuid(teacherId)) return fail(400, "استاد نامعتبر است.");
  if (teacherId === me.id) return fail(400, "امکان دنبال کردن حساب خودتان وجود ندارد.");
  const removed = await sbDelete("lexa_follows", `student_id=eq.${me.id}&teacher_id=eq.${teacherId}`);
  if (removed) return ok({ ok: true, following: false });
  try {
    await sbInsert("lexa_follows", { student_id: me.id, teacher_id: teacherId });
  } catch (e) {
    if (e instanceof HttpError && (e.status === 403 || e.status === 401)) return fail(404, "استاد پیدا نشد.");
    throw e;
  }
  return ok({ ok: true, following: true });
}

interface DirRow {
  id: string; username: string | null; display_name: string | null; bio: string | null; avatar_url: string | null;
  followers: number | string; posts: number | string; courses: number | string;
}

async function suggestions(req: CloudReq): Promise<CloudRes> {
  const me = await cloudMe().catch(() => null);
  const q = (req.query.get("q") ?? "").trim().slice(0, 40);
  const [rows, following] = await Promise.all([
    sbRpc<DirRow[]>("lexa_teacher_directory", { q, lim: q ? 30 : 60 }),
    myFollowIds(me),
  ]);
  const teachers = (rows ?? [])
    .map((t) => {
      const a = authorOf(t, t.id);
      return {
        id: t.id, username: a.username, displayName: a.displayName, bio: t.bio || "", avatarUrl: a.avatarUrl,
        followers: Number(t.followers) || 0, posts: Number(t.posts) || 0, courses: Number(t.courses) || 0,
        isFollowing: following.has(t.id),
      };
    })
    .slice(0, req.query.get("all") === "1" ? 60 : 12);
  return ok({ teachers });
}

async function userProfile(userId: string): Promise<CloudRes> {
  if (!isUuid(userId)) return fail(404, "کاربر یافت نشد.");
  const me = await cloudMe().catch(() => null);
  const prof = await sbSelect<ProfileRow>("lexa_profiles", `id=eq.${userId}&select=${PROFILE_COLS}`);
  const u = prof[0];
  if (!u || (u.role !== "teacher" && u.role !== "admin")) return fail(404, "کاربر یافت نشد.");
  const [courseRows, postRows, stats, lib, following, orgRows] = await Promise.all([
    sbSelect<CourseRow>("lexa_tcourses", `teacher_id=eq.${userId}&select=${COURSE_COLS}&order=updated_at.desc&limit=40`),
    sbSelect<PostRow>("lexa_posts", `author_id=eq.${userId}&select=${POST_CARD_COLS}&order=created_at.desc&limit=30`),
    sbRpc<{ id: string; followers: number | string; posts: number | string; courses: number | string }[]>("lexa_teacher_stats", { ids: [userId] }),
    myLibraryIds(me),
    myFollowIds(me),
    sbSelect<{ role: string; title: string; org: (OrgMini & { kind: string; status: string }) | null }>(
      "lexa_org_members",
      `user_id=eq.${userId}&status=eq.active&select=role,title,org:lexa_orgs(id,name,slug,logo_url,kind,status)`,
    ).catch(() => []),
  ]);
  const visibleCourses = courseRows.filter((c) => c.status !== "draft" || me?.id === userId);
  const courseIds = visibleCourses.map((c) => c.id);
  const [cAggs, pAggs, students] = await Promise.all([
    ratingAggs("tcourse", courseIds),
    ratingAggs("post", postRows.map((p) => p.id)),
    studentsCounts(courseIds),
  ]);
  let wSum = 0;
  let wCnt = 0;
  for (const a of [...cAggs.values(), ...pAggs.values()]) {
    wSum += a.avg * a.count;
    wCnt += a.count;
  }
  const st = stats?.[0];
  const a = authorOf(u, u.id);
  return ok({
    profile: {
      id: u.id, username: a.username, displayName: a.displayName, bio: u.bio || "", avatarUrl: a.avatarUrl,
      role: u.role, joinedAt: u.created_at,
      followersCount: Number(st?.followers) || 0,
      postsCount: Number(st?.posts) || 0,
      coursesCount: Number(st?.courses) || 0,
      avgRating: wCnt ? Math.round((wSum / wCnt) * 10) / 10 : 0,
      isFollowing: following.has(u.id),
      orgs: orgRows
        .filter((m) => m.org && m.org.status === "active")
        .map((m) => ({ ...orgOut(m.org)!, kind: m.org!.kind, role: m.role, title: m.title })),
    },
    courses: visibleCourses.map((c) => courseCard(c, me, lib, students, cAggs.get(c.id))),
    posts: postRows.map((p) => {
      const card = postCard(p, pAggs.get(p.id));
      const { author: _author, ...rest } = card;
      void _author;
      return rest;
    }),
  });
}

// --- library ---
async function getLibrary(): Promise<CloudRes> {
  const me = await cloudMe();
  if (!me) return fail(401, MSG.login);
  const rows = await sbSelect<{ course_id: string; added_at: string; course: CourseRow | null }>(
    "lexa_library",
    `user_id=eq.${me.id}&select=course_id,added_at,course:lexa_tcourses(${COURSE_COLS})&order=added_at.desc`,
  );
  const { useApp } = await import("@/lib/store");
  return ok({
    ids: rows.map((r) => r.course_id),
    courses: rows.filter((r) => r.course).map((r) => courseOf(r.course!)),
    // built-in hide/show lives in the synced personal state (lexa_state), not here
    hiddenBuiltins: useApp.getState().hiddenBuiltins,
  });
}

async function toggleLibrary(req: CloudReq): Promise<CloudRes> {
  const b = (req.body ?? {}) as { courseId?: unknown; kind?: unknown };
  const courseId = String(b.courseId ?? "");
  if (b.kind === "builtin") {
    // the caller already flipped the local list; it syncs with the personal state
    const { useApp } = await import("@/lib/store");
    return ok({ ok: true, inLibrary: !useApp.getState().hiddenBuiltins.includes(courseId) });
  }
  const me = await cloudMe();
  if (!me) return fail(401, MSG.login);
  if (!isUuid(courseId)) return fail(400, "شناسهٔ دوره نامعتبر است.");
  const removed = await sbDelete("lexa_library", `user_id=eq.${me.id}&course_id=eq.${courseId}`);
  if (removed) return ok({ ok: true, inLibrary: false });
  const exists = await sbSelect<{ id: string }>("lexa_tcourses", `id=eq.${courseId}&select=id`);
  if (!exists[0]) return fail(404, MSG.courseNotFound);
  await sbInsert("lexa_library", { user_id: me.id, course_id: courseId }, { onConflict: "user_id,course_id", ignore: true });
  return ok({ ok: true, inLibrary: true });
}

async function publicLibrary(req: CloudReq): Promise<CloudRes> {
  const me = await cloudMe().catch(() => null);
  const catQ = req.query.get("cat") ?? "";
  const cat = CATEGORY_SLUGS.includes(catQ) ? catQ : "";
  const orgQ = req.query.get("org");
  const orgFilter = isUuid(orgQ) ? `&org_id=eq.${orgQ}` : "";
  const [courseRows, postRows] = await Promise.all([
    sbSelect<CourseRow>("lexa_tcourses", `status=neq.draft&select=${COURSE_COLS}${orgFilter}&order=updated_at.desc&limit=120`),
    sbSelect<PostRow>("lexa_posts", `select=${POST_CARD_COLS}${orgFilter}&order=created_at.desc&limit=80`),
  ]);
  const cs = courseRows.filter((c) => inCategory(catsOf(c.categories, c.category), c.category, cat));
  const ps = postRows.filter((p) => inCategory(catsOf(p.categories, p.category), p.category, cat));
  const [cAggs, pAggs, lib, students] = await Promise.all([
    ratingAggs("tcourse", cs.map((c) => c.id)),
    ratingAggs("post", ps.map((p) => p.id)),
    myLibraryIds(me),
    studentsCounts(cs.map((c) => c.id)),
  ]);
  return ok({
    courses: cs.map((c) => courseCard(c, me, lib, students, cAggs.get(c.id))).sort((a, b) => b.score - a.score),
    posts: ps.map((p) => postCard(p, pAggs.get(p.id))).sort((a, b) => b.score - a.score),
  });
}

// --- ratings ---
async function getRating(req: CloudReq): Promise<CloudRes> {
  const type = req.query.get("targetType");
  const id = req.query.get("targetId") ?? "";
  if ((type !== "post" && type !== "tcourse") || !id) return fail(400, "هدف امتیاز نامعتبر است.");
  if (!isUuid(id)) return ok({ avg: 0, count: 0, my: null });
  const me = await cloudMe().catch(() => null);
  const [aggs, mine] = await Promise.all([
    ratingAggs(type, [id]),
    me
      ? sbSelect<{ stars: number }>("lexa_ratings", `user_id=eq.${me.id}&target_type=eq.${type}&target_id=eq.${id}&select=stars`)
      : Promise.resolve([] as { stars: number }[]),
  ]);
  const a = aggs.get(id) ?? { avg: 0, count: 0 };
  return ok({ avg: a.avg, count: a.count, my: mine[0]?.stars ?? null });
}

async function postRating(req: CloudReq): Promise<CloudRes> {
  const me = await cloudMe();
  if (!me) return fail(401, "برای امتیاز دادن، ابتدا وارد شوید.");
  const b = (req.body ?? {}) as { targetType?: unknown; targetId?: unknown; stars?: unknown };
  const type = b.targetType;
  const id = String(b.targetId ?? "");
  const stars = Number(b.stars);
  if (type !== "post" && type !== "tcourse") return fail(400, "هدف امتیاز نامعتبر است.");
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return fail(400, "امتیاز باید ۱ تا ۵ باشد.");
  if (!isUuid(id)) return fail(404, "هدف امتیاز یافت نشد.");
  const exists = await sbSelect<{ id: string }>(type === "post" ? "lexa_posts" : "lexa_tcourses", `id=eq.${id}&select=id`);
  if (!exists[0]) return fail(404, "هدف امتیاز یافت نشد.");
  await sbInsert("lexa_ratings", { user_id: me.id, target_type: type, target_id: id, stars }, {
    onConflict: "user_id,target_type,target_id", merge: true,
  });
  const a = (await ratingAggs(type, [id])).get(id) ?? { avg: stars, count: 1 };
  return ok({ ok: true, avg: a.avg, count: a.count, my: stars });
}

// --- routing table ---
type Handler = (req: CloudReq, params: string[]) => Promise<CloudRes>;
const ROUTES: { method: string; re: RegExp; fn: Handler }[] = [
  { method: "GET", re: /^\/api\/auth\/me$/, fn: () => authMe() },
  { method: "POST", re: /^\/api\/auth\/cloud-bridge$/, fn: () => cloudBridge() },
  { method: "POST", re: /^\/api\/auth\/change-password$/, fn: (r) => changePassword(r) },
  { method: "PATCH", re: /^\/api\/profile$/, fn: (r) => patchProfile(r) },
  { method: "POST", re: /^\/api\/profile\/avatar$/, fn: (r) => avatarUpload(r) },
  { method: "DELETE", re: /^\/api\/profile\/avatar$/, fn: () => avatarDelete() },
  { method: "POST", re: /^\/api\/cover\/upload$/, fn: (r) => coverUpload(r) },
  { method: "GET", re: /^\/api\/posts$/, fn: () => myPosts() },
  { method: "POST", re: /^\/api\/posts$/, fn: (r) => createPost(r) },
  { method: "GET", re: /^\/api\/posts\/([^/]+)$/, fn: (_r, p) => getPost(p[0]) },
  { method: "PUT", re: /^\/api\/posts\/([^/]+)$/, fn: (r, p) => putPost(p[0], r) },
  { method: "DELETE", re: /^\/api\/posts\/([^/]+)$/, fn: (_r, p) => deletePost(p[0]) },
  { method: "POST", re: /^\/api\/posts\/([^/]+)\/comments$/, fn: (r, p) => addComment(p[0], r) },
  { method: "DELETE", re: /^\/api\/posts\/([^/]+)\/comments$/, fn: (r, p) => deleteComment(p[0], r) },
  { method: "GET", re: /^\/api\/tcourses$/, fn: (r) => listCourses(r) },
  { method: "POST", re: /^\/api\/tcourses$/, fn: (r) => saveCourse(r) },
  { method: "GET", re: /^\/api\/tcourses\/([^/]+)$/, fn: (_r, p) => getCourse(p[0]) },
  { method: "DELETE", re: /^\/api\/tcourses\/([^/]+)$/, fn: (_r, p) => deleteCourse(p[0]) },
  { method: "GET", re: /^\/api\/social\/feed$/, fn: (r) => feed(r) },
  { method: "POST", re: /^\/api\/social\/follow$/, fn: (r) => follow(r) },
  { method: "GET", re: /^\/api\/social\/suggestions$/, fn: (r) => suggestions(r) },
  { method: "GET", re: /^\/api\/users\/([^/]+)$/, fn: (_r, p) => userProfile(p[0]) },
  { method: "GET", re: /^\/api\/library$/, fn: () => getLibrary() },
  { method: "POST", re: /^\/api\/library$/, fn: (r) => toggleLibrary(r) },
  { method: "GET", re: /^\/api\/library\/public$/, fn: (r) => publicLibrary(r) },
  { method: "GET", re: /^\/api\/ratings$/, fn: (r) => getRating(r) },
  { method: "POST", re: /^\/api\/ratings$/, fn: (r) => postRating(r) },
];

/** routes that belong to the local account server when there is no cloud session */
const SESSION_ROUTES = new Set(["/api/auth/me", "/api/auth/cloud-bridge", "/api/auth/change-password", "/api/profile", "/api/profile/avatar"]);

/**
 * The handler for this request, or null when the call is not ours.
 * hasServer: the page runs on the Next server (desktop / self-hosted web) — then
 * account routes stay with the local server unless a cloud session exists.
 */
export function matchCloudRoute(method: string, path: string, hasServer: boolean): ((req: CloudReq) => Promise<CloudRes>) | null {
  if (hasServer && SESSION_ROUTES.has(path) && !sbUser()) return null;
  for (const r of ROUTES) {
    if (r.method !== method) continue;
    const m = path.match(r.re);
    if (m) {
      const params = m.slice(1).map((x) => {
        try { return decodeURIComponent(x); } catch { return x; }
      });
      return (req) => r.fn(req, params);
    }
  }
  return null;
}

/** run a handler and turn cloud/network errors into the JSON errors the screens expect */
export async function runCloud(fn: (req: CloudReq) => Promise<CloudRes>, req: CloudReq): Promise<CloudRes> {
  try {
    return await fn(req);
  } catch (e) {
    if (e instanceof HttpError) {
      const m = e.message || "";
      if (/rate limit/i.test(m)) return fail(429, MSG.rate);
      if (e.status === 401) return fail(401, MSG.login);
      if (e.status === 403 || e.code === "42501") return fail(403, MSG.forbidden);
      if (e.status === 404 || e.code === "PGRST205" || e.code === "42P01") {
        return fail(503, "این بخش هنوز راه‌اندازی نشده است.");
      }
      if (e.code === "22P02") return fail(404, "مورد خواسته‌شده یافت نشد.");
      return fail(e.status >= 400 && e.status < 600 ? e.status : 500, m.startsWith("cloud error") ? "خطای سامانه؛ لطفاً دوباره تلاش کنید." : m);
    }
    return fail(503, MSG.offline);
  }
}
