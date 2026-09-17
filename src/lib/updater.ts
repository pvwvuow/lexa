/* ─── Lexa — سیستم به‌روزرسانی درون‌برنامه‌ای محتوا (دلتا) ────────────────────
 *
 * بسته‌های محتوایی (دوره‌ها و دفترچه‌های آزمون) بدون انتشار نسخهٔ جدید اپ،
 * از پوشهٔ updates/ مخزن گیت‌هاب (pvwvuow/lexa) دانلود و نصب می‌شوند.
 *
 * جریان کار:
 *   ۱) manifest از updates/manifest.json خوانده می‌شود — ابتدا jsDelivr CDN،
 *      در خطا raw.githubusercontent (fallback) و در محیط توسعه مسیر محلی.
 *   ۲) بسته‌ها به‌صورت JSON در IndexedDB (استور lexa-content-packs) ذخیره می‌شوند.
 *   ۳) در استارتاپ، بسته‌های نصب‌شده در اپ ادغام می‌شوند:
 *        دوره‌ها → customCourses (استور zustand)
 *        دفترچه‌ها → آرایهٔ examPacks (ماژول law/examPacks)
 *   ۴) حذف بسته، هم از IndexedDB و هم از ادغام پاک می‌کند.
 * ─────────────────────────────────────────────────────────────────────── */

import type { Course } from "@/lib/law/types";
import type { ExamPack } from "@/lib/law/examPacks";
import { registerDynamicExamPack } from "@/lib/law/examPacks";
import { useApp } from "@/lib/store";

/* ─── پیکربندی مخزن ──────────────────────────────────────────────────────── */

const REPO = "pvwvuow/lexa";
const BRANCH = "main";
const UPDATES_DIR = "updates";

/** حداکثر اندازهٔ فایل بسته — ۵ مگابایت (محافظت از حافظهٔ دستگاه) */
const MAX_PACK_BYTES = 5 * 1024 * 1024;

/** مهلت هر درخواست دانلود (میلی‌ثانیه) */
const FETCH_TIMEOUT = 12_000;

/** منابع دانلود به ترتیب اولویت — اولین پاسخ موفق برنده است */
function sourceUrls(relPath: string): string[] {
  const p = relPath.replace(/^\/+/, "");
  return [
    // ۱) jsDelivr — CDN سریع با کش سراسری
    `https://cdn.jsdelivr.net/gh/${REPO}@${BRANCH}/${UPDATES_DIR}/${p}`,
    // ۲) رَو گیت‌هاب — fallback رسمی
    `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${UPDATES_DIR}/${p}`,
    // ۳) مسیر محلی — برای توسعه و تست (فایل‌های updates/ در public کپی‌شده یا سرور خود اپ)
    `/${UPDATES_DIR}/${p}`,
  ];
}

/* ─── تایپ‌ها ─────────────────────────────────────────────────────────────── */

export type ContentPackKind = "course" | "examPack";

/** یک ردیف از updates/manifest.json */
export interface UpdatePackMeta {
  id: string;
  kind: ContentPackKind;
  /** نسخهٔ semver بسته — مثل 1.0.0 */
  version: string;
  title: string;
  description?: string;
  /** مسیر فایل JSON نسبت به updates/ — مثل packs/course-mabani.json */
  file: string;
  /** اندازهٔ تقریبی به بایت (اختیاری، برای نمایش) */
  size?: number;
}

export interface UpdateManifest {
  /** نسخهٔ کل محتوای برخط */
  version: string;
  /** تاریخ تولید مانیفست — ISO */
  generatedAt: string;
  /** یادداشت انتشار (اختیاری) */
  notes?: string;
  packs: UpdatePackMeta[];
}

/** یک بستهٔ نصب‌شده در IndexedDB */
export interface InstalledPack {
  meta: UpdatePackMeta;
  /** شناسهٔ محتوا داخل payload — برای پاک‌سازی دقیق از customCourses */
  contentId: string;
  payload: Course | ExamPack;
  installedAt: string;
}

export interface PackStatus {
  meta: UpdatePackMeta;
  installed: InstalledPack | null;
  /** نصب‌شده اما نسخه‌اش از مانیفست قدیمی‌تر است */
  outdated: boolean;
}

/* ─── کلیدهای ذخیره‌سازی ─────────────────────────────────────────────────── */

export const CONTENT_PACKS_STORE = "lexa-content-packs"; // استور IndexedDB
const CONTENT_DB_NAME = "lexa-content-db";
const LAST_CHECK_KEY = "lexa-updates-last-check";
const MANIFEST_CACHE_KEY = "lexa-updates-manifest";

/* ─── IndexedDB — لایهٔ ذخیرهٔ بسته‌ها ────────────────────────────────────── */

function openContentDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CONTENT_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CONTENT_PACKS_STORE)) {
        db.createObjectStore(CONTENT_PACKS_STORE, { keyPath: "meta.id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("باز‌کردن IndexedDB ناموفق بود"));
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openContentDb();
  try {
    const tx = db.transaction(CONTENT_PACKS_STORE, mode);
    const store = tx.objectStore(CONTENT_PACKS_STORE);
    return await new Promise<T>((resolve, reject) => {
      const req = fn(store);
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error ?? new Error("عملیات IndexedDB ناموفق بود"));
    });
  } finally {
    db.close();
  }
}

/** همهٔ بسته‌های نصب‌شده روی این دستگاه */
export async function listInstalledPacks(): Promise<InstalledPack[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    const rows = await withStore<InstalledPack[]>("readonly", (s) => s.getAll());
    return (rows ?? []).filter((r) => r?.meta?.id && r?.payload);
  } catch {
    return [];
  }
}

async function putInstalledPack(p: InstalledPack): Promise<void> {
  await withStore("readwrite", (s) => s.put(p));
}

async function deleteInstalledPack(id: string): Promise<void> {
  await withStore("readwrite", (s) => s.delete(id));
}

/* ─── دانلود با fallback ─────────────────────────────────────────────────── */

async function fetchJsonWithFallback<T>(relPath: string, maxBytes = MAX_PACK_BYTES): Promise<T> {
  const urls = sourceUrls(relPath);
  let lastErr: unknown = null;
  for (const url of urls) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
      const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const len = Number(res.headers.get("content-length") ?? 0);
      if (len && len > maxBytes) throw new Error("حجم فایل بیش از حد مجاز است");
      const text = await res.text();
      if (text.length > maxBytes) throw new Error("حجم فایل بیش از حد مجاز است");
      return JSON.parse(text) as T;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("دانلود از همهٔ منابع ناموفق بود");
}

/* ─── مانیفست ─────────────────────────────────────────────────────────────── */

/** اعتبارسنجی ساختاری مانیفست — جلوی JSON خراب/بدخیم را می‌گیرد */
function validManifest(m: unknown): m is UpdateManifest {
  if (!m || typeof m !== "object") return false;
  const o = m as Record<string, unknown>;
  return typeof o.version === "string" && Array.isArray(o.packs);
}

/** دریافت مانیفست به‌روز از مخزن (jsDelivr → raw → محلی) */
export async function fetchManifest(): Promise<UpdateManifest> {
  const m = await fetchJsonWithFallback<unknown>("manifest.json");
  if (!validManifest(m)) throw new Error("مانیفست نامعتبر است");
  return m;
}

/** مانیفست کش‌شدهٔ آخرین بررسی موفق (برای نمایش بدون شبکه) */
export function cachedManifest(): UpdateManifest | null {
  try {
    const raw = localStorage.getItem(MANIFEST_CACHE_KEY);
    if (!raw) return null;
    const m = JSON.parse(raw);
    return validManifest(m) ? m : null;
  } catch {
    return null;
  }
}

export function lastCheckAt(): number {
  try {
    return Number(localStorage.getItem(LAST_CHECK_KEY) ?? 0);
  } catch {
    return 0;
  }
}

/* ─── اعتبارسنجی payload بسته ────────────────────────────────────────────── */

function validCourse(c: unknown): c is Course {
  if (!c || typeof c !== "object") return false;
  const o = c as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    Array.isArray(o.chapters)
  );
}

function validExamPack(p: unknown): p is ExamPack {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    (o.kind === "mcq" || o.kind === "descriptive") &&
    Array.isArray(o.questions)
  );
}

/* ─── ادغام در اپ ─────────────────────────────────────────────────────────── */

function mergeIntoApp(inst: InstalledPack) {
  if (inst.meta.kind === "examPack" && validExamPack(inst.payload)) {
    registerDynamicExamPack(inst.payload);
  } else if (inst.meta.kind === "course" && validCourse(inst.payload)) {
    // دوره‌های بستهٔ محتوایی مثل «دورهٔ وارداتی» به کتابخانهٔ کاربر اضافه می‌شوند
    useApp.getState().upsertCourse(inst.payload as Course);
  }
}

function unmergeFromApp(inst: InstalledPack) {
  if (inst.meta.kind === "course") {
    const cur = useApp.getState().customCourses;
    useApp.setState({ customCourses: cur.filter((c) => c.id !== inst.contentId) });
  }
  // دفترچهٔ آزمون: unregisterDynamicExamPack در examPacks.ts
}

/* ─── نصب / حذف / به‌روزرسانی ─────────────────────────────────────────────── */

/**
 * نصب (یا ارتقای) یک بسته از مانیفست:
 * دانلود JSON → اعتبارسنجی → ذخیره در IndexedDB → ادغام در اپ
 */
export async function installPack(meta: UpdatePackMeta): Promise<InstalledPack> {
  const file = await fetchJsonWithFallback<unknown>(meta.file);
  const payload = (file && typeof file === "object" && "payload" in (file as Record<string, unknown>))
    ? (file as { payload: unknown }).payload
    : file;

  if (meta.kind === "examPack" && !validExamPack(payload)) {
    throw new Error("ساختار دفترچهٔ آزمون در بسته نامعتبر است");
  }
  if (meta.kind === "course" && !validCourse(payload)) {
    throw new Error("ساختار دوره در بسته نامعتبر است");
  }

  const contentId = ((payload as { id?: unknown }).id as string) || meta.id;
  const inst: InstalledPack = {
    meta: { ...meta },
    contentId,
    payload: payload as Course | ExamPack,
    installedAt: new Date().toISOString(),
  };

  await putInstalledPack(inst);
  mergeIntoApp(inst);
  return inst;
}

/** حذف کامل بسته: از IndexedDB و از ادغام در اپ */
export async function removePack(packId: string): Promise<void> {
  const all = await listInstalledPacks();
  const inst = all.find((p) => p.meta.id === packId);
  await deleteInstalledPack(packId);
  if (inst) unmergeFromApp(inst);
  if (inst?.meta.kind === "examPack") {
    // تابع unregister از examPacks.ts
    const mod = await import("@/lib/law/examPacks");
    mod.unregisterDynamicExamPack(inst.contentId);
  }
}

/** وضعیت هر بستهٔ مانیفست نسبت به نصب‌شده‌ها */
export function buildStatuses(manifest: UpdateManifest, installed: InstalledPack[]): PackStatus[] {
  const byId = new Map(installed.map((p) => [p.meta.id, p]));
  const rows: PackStatus[] = manifest.packs.map((meta) => {
    const inst = byId.get(meta.id) ?? null;
    const outdated = !!inst && inst.meta.version !== meta.version;
    return { meta, installed: inst, outdated };
  });
  // بسته‌های نصب‌شده که دیگر در مانیفست نیستند — هنوز نصب‌اند و قابل حذف
  const known = new Set(manifest.packs.map((p) => p.id));
  for (const inst of installed) {
    if (!known.has(inst.meta.id)) {
      rows.push({ meta: inst.meta, installed: inst, outdated: false });
    }
  }
  return rows;
}

/** نصب خودکار همهٔ بسته‌های عقب‌مانده (دکمهٔ «نصب همه») */
export async function installAllOutdated(statuses: PackStatus[]): Promise<number> {
  let n = 0;
  for (const st of statuses) {
    if (!st.installed || st.outdated) {
      try {
        await installPack(st.meta);
        n += 1;
      } catch {
        /* هر بسته مستقل است — خطای یکی بقیه را متوقف نمی‌کند */
      }
    }
  }
  return n;
}

/* ─── استارتاپ ────────────────────────────────────────────────────────────── */

let started = false;

/**
 * در استارتاپ اپ: بسته‌های نصب‌شده را ادغام می‌کند و در پس‌زمینه مانیفست را
 * برای «نشان به‌روزرسانی موجود» کش می‌کند. چندبار صدا زدنش بی‌ضرر است.
 */
export async function initContentPacks(): Promise<void> {
  if (started || typeof window === "undefined") return;
  started = true;

  // ۱) بسته‌های نصب‌شده → ادغام فوری (قبل از رندر مسیرها)
  try {
    const installed = await listInstalledPacks();
    for (const inst of installed) mergeIntoApp(inst);
  } catch {
    /* IndexedDB در دسترس نیست — بی‌خیال */
  }

  // ۲) بررسی بی‌صدای مانیفست برای کش و نشانگر تنظیمات
  void checkForUpdates().catch(() => {
    /* آفلاین یا مخزن در دسترس نیست — مشکلی نیست */
  });
}

/**
 * بررسی به‌روزرسانی: مانیفست تازه را می‌گیرد، در localStorage کش می‌کند
 * و مانیفست را برمی‌گرداند. خطا را به caller می‌دهد.
 */
export async function checkForUpdates(): Promise<UpdateManifest> {
  const m = await fetchManifest();
  try {
    localStorage.setItem(MANIFEST_CACHE_KEY, JSON.stringify(m));
    localStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
  } catch {
    /* حالت خصوصی مرورگر — بی‌خیال */
  }
  return m;
}

/* ─── کمکی‌های نمایشی ─────────────────────────────────────────────────────── */

/** نسخهٔ نصب‌شدهٔ یک بسته یا خالی */
export function installedVersionOf(statuses: PackStatus[], id: string): string | null {
  return statuses.find((s) => s.meta.id === id)?.installed?.meta.version ?? null;
}

/** برچسب فارسی نوع بسته */
export function kindLabel(kind: ContentPackKind): string {
  return kind === "course" ? "دوره" : "دفترچهٔ آزمون";
}
