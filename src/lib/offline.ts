"use client";

/* ─── مدیریت حالت آفلاین ─────────────────────────────────────────────────────────
 * ۱) «بستهٔ طراحی» — پوسته/فونت/رسانه با Service Worker کش می‌شود؛ نسخهٔ آن با
 *    DESIGN_VERSION کنترل می‌شود تا اگر طراحی سایت تغییر کرد، تنظیمات هشدار
 *    «نسخهٔ آفلاین شما به‌روز نیست» بدهد.
 * ۲) «مطالب ذخیره‌شدهٔ من» — کاربر کنار هر مطلب یا دوره دکمهٔ دانلود دارد و
 *    آن‌ها را تک‌تک برای مطالعهٔ آفلاین ذخیره می‌کند (IndexedDB). اگر همان
 *    مطلب/دوره بعداً در سایت تغییر کند، کنارش نشان «به‌روز شده» می‌آید تا
 *    کاربر با یک دانلود مجدد، نسخهٔ آفلاینش را آپدیت کند.
 * ──────────────────────────────────────────────────────────────────────────── */
import * as React from "react";

/* ── نسخهٔ طراحی — با هر تغییر در پوسته/المان‌ها باید بالا برده شود ── */
export const DESIGN_VERSION = "1.6.5";

const DESIGN_META_KEY = "hh-design-meta-v1";
/** کلید بستهٔ قدیمی (یک‌جا) — فقط برای مهاجرت به سیستم آیتمی */
const LEGACY_PACK_KEY = "hh-offline-pack-v1";

export interface DesignMeta {
  savedAt: number;
  version: string;
}

export function getDesignMeta(): DesignMeta | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DESIGN_META_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DesignMeta;
  } catch {
    return null;
  }
}

export function saveDesignMeta(): void {
  try {
    localStorage.setItem(DESIGN_META_KEY, JSON.stringify({ savedAt: Date.now(), version: DESIGN_VERSION }));
  } catch {}
}

export function clearDesignMeta(): void {
  try {
    localStorage.removeItem(DESIGN_META_KEY);
  } catch {}
}

/** آیا «بستهٔ طراحی» ذخیره‌شده با نسخهٔ فعلی سایت فرق دارد؟ */
export function designPackOutdated(): boolean {
  const m = getDesignMeta();
  return !!m && m.version !== DESIGN_VERSION;
}

/* ═══ انبار آیتمی مطالب/دوره‌های ذخیره‌شده — IndexedDB ══════════════════════ */

const DB_NAME = "hamyar-offline-db";
const STORE = "items";

export type OfflineKind = "post" | "tcourse" | "builtin";

/** کارت نمایشی مطلب — برای فهرست/فید آفلاین (هم‌ساختار FeedPost) */
export interface OfflineCardPost {
  id: string;
  title: string;
  summary: string;
  tags?: string;
  category?: string;
  categories?: string[];
  thumbnail?: string;
  createdAt: string;
  updatedAt?: string;
  commentsCount: number;
  rating?: { avg: number; count: number };
  author: { id: string; username: string; displayName: string; avatarUrl?: string | null };
}

/** کارت نمایشی دورهٔ استاد — هم‌ساختار TCourseCard */
export interface OfflineCardCourse {
  id: string;
  title: string;
  tagline: string;
  description: string;
  icon?: string;
  thumbnail?: string;
  _thumbnail?: string;
  lessonsCount: number;
  studentsCount?: number;
  inLibrary?: boolean;
  canManage?: boolean;
  rating?: { avg: number; count: number };
  _category?: string;
  _categories?: string[];
  _status?: string;
  _updatedAt?: string;
  teacher: { id: string; username: string; displayName: string; avatarUrl?: string | null };
}

/** یک آیتم ذخیره‌شدهٔ کامل — متن/ساختار کامل + متادیتای دانلود */
export interface OfflineItem {
  kind: OfflineKind;
  id: string;
  /** زمان دانلود روی دستگاه */
  savedAt: number;
  /** updatedAt نسخهٔ سرور در لحظهٔ دانلود — مبنای تشخیص «به‌روز شده» */
  savedUpdatedAt: string;
  card: OfflineCardPost | OfflineCardCourse;
  /** متن کامل مطلب (PostData سرور) */
  post?: unknown;
  /** نظرات مطلب در لحظهٔ دانلود */
  comments?: unknown[];
  /** ساختار کامل دوره (Course موتور مطالعه) */
  course?: unknown;
}

/** فقط متادیتا و کارت — بدون بدنهٔ سنگین (برای فهرست‌ها) */
export type OfflineItemMeta = Omit<OfflineItem, "post" | "comments" | "course">;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB نامرتب است"));
  });
}

function idbRun<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error ?? new Error("خطای IndexedDB"));
        tx.oncomplete = () => db.close();
        tx.onabort = () => {
          db.close();
          reject(tx.error ?? new Error("تراکنش IndexedDB ناتمام ماند"));
        };
      }),
  );
}

function keyOf(kind: OfflineKind, id: string): string {
  return `${kind}:${id}`;
}

/* ── کش سبک وضعیت‌ها + اعلان تغییر بین کامپوننت‌ها ── */

type ItemStatus = "none" | "busy" | "saved";
interface CacheEntry {
  status: ItemStatus;
  savedAt?: number;
  savedUpdatedAt?: string;
}

const metaCache = new Map<string, CacheEntry>();
const listeners = new Set<() => void>();
let hydrated = false;
let hydrating: Promise<void> | null = null;

function emitChange(): void {
  listeners.forEach((l) => l());
}

export function subscribeOffline(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** بارگذاری اولیهٔ وضعیت‌ها از IndexedDB (+ مهاجرت یک‌بارهٔ بستهٔ قدیمی) */
export async function ensureOfflineCache(): Promise<void> {
  if (hydrated) return;
  if (!hydrating) {
    hydrating = (async () => {
      try {
        const all = await idbRun<OfflineItem[]>("readonly", (s) => s.getAll());
        metaCache.clear();
        for (const it of all ?? []) {
          if (!it?.kind || !it?.id) continue;
          metaCache.set(keyOf(it.kind, it.id), { status: "saved", savedAt: it.savedAt, savedUpdatedAt: it.savedUpdatedAt });
        }
      } catch {
        /* بدون IndexedDB (حالت خصوصی مرورگر) — فقط حالت حافظه */
      }
      hydrated = true;
      emitChange();
      void migrateLegacyPack();
    })();
  }
  return hydrating;
}

/** آیا نسخهٔ سرور از نسخهٔ ذخیره‌شدهٔ روی دستگاه جدیدتر است؟ */
export function isServerNewer(serverUpdatedAt?: string, savedUpdatedAt?: string): boolean {
  if (!serverUpdatedAt || !savedUpdatedAt) return false;
  const a = +new Date(serverUpdatedAt);
  const b = +new Date(savedUpdatedAt);
  if (!isFinite(a) || !isFinite(b)) return false;
  return a > b + 1000; // اختلاف‌های زیرثانیه‌ای را نادیده بگیر
}

/** هوک وضعیت آفلاین یک آیتم — همگام بین همهٔ دکمه‌ها و نشان‌ها */
export function useOfflineItem(kind: OfflineKind, id: string): CacheEntry {
  const none = React.useMemo<CacheEntry>(() => ({ status: "none" as const }), []);
  const read = React.useCallback((): CacheEntry => metaCache.get(keyOf(kind, id)) ?? none, [kind, id, none]);
  const [entry, setEntry] = React.useState<CacheEntry>(read);

  React.useEffect(() => {
    let alive = true;
    setEntry(read());
    void ensureOfflineCache().then(() => alive && setEntry(read()));
    const un = subscribeOffline(() => alive && setEntry(read()));
    return () => {
      alive = false;
      un();
    };
  }, [kind, id, read]);

  return entry;
}

/** کل آیتم‌های ذخیره‌شده — فقط متادیتا و کارت (بدون بدنهٔ سنگین) */
export async function listOfflineMetas(): Promise<OfflineItemMeta[]> {
  await ensureOfflineCache();
  try {
    const all = await idbRun<OfflineItem[]>("readonly", (s) => s.getAll());
    return (all ?? [])
      .filter((it) => it?.kind && it?.id)
      .map(({ post: _p, comments: _c, course: _co, ...meta }) => meta);
  } catch {
    return [];
  }
}

/** یک آیتم کامل ذخیره‌شده (متن/ساختار کامل) */
export async function getOfflineItem(kind: OfflineKind, id: string): Promise<OfflineItem | null> {
  try {
    const it = await idbRun<OfflineItem | undefined>("readonly", (s) => s.get(keyOf(kind, id)));
    return it ?? null;
  } catch {
    return null;
  }
}

function setBusy(kind: OfflineKind, id: string): CacheEntry | undefined {
  const prev = metaCache.get(keyOf(kind, id));
  metaCache.set(keyOf(kind, id), { status: "busy" });
  emitChange();
  return prev;
}

function settle(kind: OfflineKind, id: string, prev: CacheEntry | undefined, ok: boolean, item?: { savedAt: number; savedUpdatedAt: string }): boolean {
  if (ok && item) metaCache.set(keyOf(kind, id), { status: "saved", savedAt: item.savedAt, savedUpdatedAt: item.savedUpdatedAt });
  else if (prev) metaCache.set(keyOf(kind, id), prev);
  else metaCache.delete(keyOf(kind, id));
  emitChange();
  return ok;
}

/** دانلود/به‌روزرسانی یک مطلب برای مطالعهٔ آفلاین */
export async function downloadPostOffline(card: OfflineCardPost): Promise<boolean> {
  const prev = setBusy("post", card.id);
  try {
    const r = await fetch(`/api/posts/${encodeURIComponent(card.id)}`);
    const d = (await r.json().catch(() => ({}))) as { post?: unknown; comments?: unknown[] };
    if (!r.ok || !d.post) throw new Error("سرور پاسخ نداد");
    const post = d.post as { updatedAt?: string };
    const item: OfflineItem = {
      kind: "post",
      id: card.id,
      savedAt: Date.now(),
      savedUpdatedAt: String(post.updatedAt ?? card.updatedAt ?? new Date().toISOString()),
      card: { ...card, commentsCount: Array.isArray(d.comments) ? d.comments.length : card.commentsCount },
      post: d.post,
      comments: Array.isArray(d.comments) ? d.comments : [],
    };
    await idbRun("readwrite", (s) => s.put(item, keyOf("post", card.id)));
    void precacheItemImages([card.thumbnail]);
    return settle("post", card.id, prev, true, { savedAt: item.savedAt, savedUpdatedAt: item.savedUpdatedAt });
  } catch {
    return settle("post", card.id, prev, false);
  }
}

/** دانلود/به‌روزرسانی یک دورهٔ استاد برای مطالعهٔ آفلاین */
export async function downloadCourseOffline(card: OfflineCardCourse): Promise<boolean> {
  const prev = setBusy("tcourse", card.id);
  try {
    const r = await fetch(`/api/tcourses/${encodeURIComponent(card.id)}`);
    const d = (await r.json().catch(() => ({}))) as { course?: unknown };
    if (!r.ok || !d.course) throw new Error("سرور پاسخ نداد");
    const course = d.course as { _updatedAt?: string };
    const item: OfflineItem = {
      kind: "tcourse",
      id: card.id,
      savedAt: Date.now(),
      savedUpdatedAt: String(course._updatedAt ?? card._updatedAt ?? new Date().toISOString()),
      card,
      course: d.course,
    };
    await idbRun("readwrite", (s) => s.put(item, keyOf("tcourse", card.id)));
    void precacheItemImages([card.thumbnail ?? card._thumbnail]);
    return settle("tcourse", card.id, prev, true, { savedAt: item.savedAt, savedUpdatedAt: item.savedUpdatedAt });
  } catch {
    return settle("tcourse", card.id, prev, false);
  }
}

/**
 * ذخیرهٔ دورهٔ آمادهٔ اپ — محتوا در باندل برنامه است و شبکه نمی‌خواهد؛
 * ذخیره فقط آن را در فهرست «مطالب آفلاین من» ثبت می‌کند تا کاربر مطمئن شود
 * بدون اینترنت هم در دسترس است. اگر تامنیل داشته باشد در کش SW هم می‌رود.
 */
export async function downloadBuiltinCourseOffline(card: OfflineCardCourse, course: unknown): Promise<boolean> {
  const prev = setBusy("builtin", card.id);
  try {
    const item: OfflineItem = {
      kind: "builtin",
      id: card.id,
      savedAt: Date.now(),
      savedUpdatedAt: new Date().toISOString(),
      card,
      course,
    };
    await idbRun("readwrite", (s) => s.put(item, keyOf("builtin", card.id)));
    void precacheItemImages([card.thumbnail ?? card._thumbnail]);
    return settle("builtin", card.id, prev, true, { savedAt: item.savedAt, savedUpdatedAt: item.savedUpdatedAt });
  } catch {
    return settle("builtin", card.id, prev, false);
  }
}

/** حذف یک آیتم ذخیره‌شده */
export async function removeOfflineItem(kind: OfflineKind, id: string): Promise<void> {
  try {
    await idbRun("readwrite", (s) => s.delete(keyOf(kind, id)));
  } catch {}
  metaCache.delete(keyOf(kind, id));
  emitChange();
}

/** پاک‌سازی همهٔ مطالب/دوره‌های ذخیره‌شده */
export async function clearOfflineItems(): Promise<void> {
  try {
    await idbRun("readwrite", (s) => s.clear());
  } catch {}
  for (const k of [...metaCache.keys()]) metaCache.delete(k);
  emitChange();
}

/** کش‌کردن تصویر شاخص آیتم در کش Service Worker — تا آفلاین هم دیده شود */
function precacheItemImages(urls: (string | undefined)[]): void {
  const list = (urls.filter(Boolean) as string[]).slice(0, 3);
  if (!list.length || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready
    .then((reg) => reg.active?.postMessage({ type: "PRECACHE_IMAGES", urls: list }))
    .catch(() => {});
}

/* ── مهاجرت یک‌بارهٔ «بستهٔ مطالب» قدیمی به انبار آیتمی ── */
async function migrateLegacyPack(): Promise<void> {
  if (typeof window === "undefined" || !localStorage.getItem(LEGACY_PACK_KEY)) return;
  let pack: { savedAt?: number; posts?: OfflineCardPost[]; courses?: OfflineCardCourse[] } | null = null;
  try {
    pack = JSON.parse(localStorage.getItem(LEGACY_PACK_KEY) ?? "null");
  } catch {}
  localStorage.removeItem(LEGACY_PACK_KEY);
  if (!pack) return;

  for (const p of pack.posts ?? []) {
    if (!p?.id || metaCache.has(keyOf("post", p.id))) continue;
    const savedAt = pack.savedAt ?? Date.now();
    try {
      // اگر آنلاینیم، متن کامل را هم بگیر تا مهاجرت بی‌نقص باشد
      const r = await fetch(`/api/posts/${encodeURIComponent(p.id)}`);
      const d = (await r.json().catch(() => ({}))) as { post?: unknown; comments?: unknown[] };
      if (r.ok && d.post) {
        const post = d.post as { updatedAt?: string };
        const item: OfflineItem = {
          kind: "post", id: p.id, savedAt, savedUpdatedAt: String(post.updatedAt ?? p.createdAt ?? ""),
          card: { ...p, commentsCount: Array.isArray(d.comments) ? d.comments.length : p.commentsCount },
          post: d.post, comments: Array.isArray(d.comments) ? d.comments : [],
        };
        await idbRun("readwrite", (s) => s.put(item, keyOf("post", p.id)));
        metaCache.set(keyOf("post", p.id), { status: "saved", savedAt, savedUpdatedAt: item.savedUpdatedAt });
        continue;
      }
    } catch {}
    // آفلاین: فقط کارت — بعد از آنلاین شدن با دکمهٔ «به‌روزرسانی» متن کامل می‌آید
    const item: OfflineItem = {
      kind: "post", id: p.id, savedAt, savedUpdatedAt: String(p.updatedAt ?? p.createdAt ?? ""),
      card: p, post: { id: p.id, title: p.title, summary: p.summary, blocks: [], tags: p.tags ?? "", createdAt: p.createdAt, author: p.author, canManage: false },
      comments: [],
    };
    try {
      await idbRun("readwrite", (s) => s.put(item, keyOf("post", p.id)));
      metaCache.set(keyOf("post", p.id), { status: "saved", savedAt, savedUpdatedAt: item.savedUpdatedAt });
    } catch {}
  }

  for (const c of pack.courses ?? []) {
    if (!c?.id || metaCache.has(keyOf("tcourse", c.id))) continue;
    const savedAt = pack.savedAt ?? Date.now();
    try {
      const r = await fetch(`/api/tcourses/${encodeURIComponent(c.id)}`);
      const d = (await r.json().catch(() => ({}))) as { course?: unknown };
      if (r.ok && d.course) {
        const course = d.course as { _updatedAt?: string };
        const item: OfflineItem = {
          kind: "tcourse", id: c.id, savedAt, savedUpdatedAt: String(course._updatedAt ?? ""),
          card: { ...c }, course: d.course,
        };
        await idbRun("readwrite", (s) => s.put(item, keyOf("tcourse", c.id)));
        metaCache.set(keyOf("tcourse", c.id), { status: "saved", savedAt, savedUpdatedAt: item.savedUpdatedAt });
        continue;
      }
    } catch {}
    const item: OfflineItem = { kind: "tcourse", id: c.id, savedAt, savedUpdatedAt: String(c._updatedAt ?? ""), card: { ...c }, course: { ...c, chapters: [] } };
    try {
      await idbRun("readwrite", (s) => s.put(item, keyOf("tcourse", c.id)));
      metaCache.set(keyOf("tcourse", c.id), { status: "saved", savedAt, savedUpdatedAt: item.savedUpdatedAt });
    } catch {}
  }
  emitChange();
}

/* ═══ به‌روزرسانی خودکار نسخهٔ آفلاین ═══════════════════════════════════════
 * «سایت آپدیت شد ولی آفلاین آپدیت نمی‌شود» — راه‌حل: وقتی کاربر آنلاین است،
 * در پس‌زمینه همه چیز خودکار تازه می‌شود:
 *   ۱) بستهٔ طراحی اگر نسخه‌اش عقب مانده باشد (کش پوسته/فونت/رسانه)
 *   ۲) دوره‌های آمادهٔ ذخیره‌شده (همگام با باندل تازهٔ اپ)
 *   ۳) مطالب/دوره‌های اساتیدی که روی سرور تغییر کرده‌اند (یک‌به‌یک)
 * برای فشار نیاوردن به شبکه، حداکثر هر ۴۵ دقیقه یک‌بار اجرا می‌شود.
 * ──────────────────────────────────────────────────────────────────────── */
const AUTOUPDATE_KEY = "hh-autoupdate-v1";
let autoUpdateStarted = false;
let autoUpdateRunning = false;

/** برچسب‌های زمانی تازهٔ سرور برای آیتم‌های ذخیره‌شده (پست‌ها + دوره‌های اساتیدی) */
async function fetchServerStamps(metas: OfflineItemMeta[]): Promise<Record<string, string>> {
  const stamps: Record<string, string> = {};
  try {
    const postIds = metas.filter((it) => it.kind === "post").map((it) => it.id).slice(0, 120);
    const r = await fetch(`/api/social/feed${postIds.length ? `?ids=${encodeURIComponent(postIds.join(","))}` : ""}`, { cache: "no-store" });
    if (r.ok) {
      const j = (await r.json()) as { posts?: { id?: string; updatedAt?: string }[]; items?: { id?: string; updatedAt?: string }[] };
      for (const p of j.posts ?? j.items ?? []) {
        if (p?.id && p.updatedAt) stamps[`post:${p.id}`] = p.updatedAt;
      }
    }
  } catch { /* آفلاین */ }
  try {
    const r = await fetch("/api/tcourses", { cache: "no-store" });
    if (r.ok) {
      const j = (await r.json()) as { courses?: { id?: string; _updatedAt?: string }[] };
      for (const c of j.courses ?? []) {
        if (c?.id && c._updatedAt) stamps[`tcourse:${c.id}`] = c._updatedAt;
      }
    }
  } catch { /* آفلاین */ }
  return stamps;
}

async function runAutoUpdate(): Promise<void> {
  if (autoUpdateRunning) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  autoUpdateRunning = true;
  try {
    const last = Number(localStorage.getItem(AUTOUPDATE_KEY) || 0);
    const designOutdated = designPackOutdated();
    if (!designOutdated && Date.now() - last < 45 * 60 * 1000) return;

    // ۱) بستهٔ طراحی — اگر نسخهٔ اپ عوض شده، پوستهٔ آفلاین را تازه کن
    if (designOutdated) {
      const ok = await precacheDesignAssets();
      if (ok > 0) saveDesignMeta();
    }

    // ۲) آیتم‌های ذخیره‌شده
    await ensureOfflineCache();
    const metas = await listOfflineMetas();

    // دوره‌های آماده: وقتی نسخهٔ اپ عوض شده، با باندل تازه دوباره ثبت می‌شوند (بی‌شبکه)
    if (designOutdated && metas.length) {
      try {
        const { builtinCourses } = await import("@/lib/law/courses");
        for (const m of metas) {
          if (m.kind !== "builtin") continue;
          const c = builtinCourses.find((x) => x.id === m.id);
          if (c) await downloadBuiltinCourseOffline(m.card as OfflineCardCourse, c);
        }
      } catch { /* باندل در دسترس نبود */ }
    }

    if (!metas.length) return;

    // مطلب/دورهٔ اساتیدی: فقط آن‌هایی که روی سرور تغییر کرده‌اند
    const stamps = await fetchServerStamps(metas);
    for (const m of metas) {
      if (m.kind === "builtin") continue;
      if (!isServerNewer(stamps[`${m.kind}:${m.id}`], m.savedUpdatedAt)) continue;
      const ok =
        m.kind === "post"
          ? await downloadPostOffline(m.card as OfflineCardPost)
          : await downloadCourseOffline(m.card as OfflineCardCourse);
      if (ok) await new Promise((r) => setTimeout(r, 350)); // نرم و پیوسته، نه انفجاری
    }
  } catch {
    /* هر خطایی نباید صفحه را برهم بزند */
  } finally {
    try { localStorage.setItem(AUTOUPDATE_KEY, String(Date.now())); } catch {}
    autoUpdateRunning = false;
  }
}

/** شروع موتور به‌روزرسانی خودکار — یک بار در سطح برنامه (SwRegister) */
export function startOfflineAutoUpdate(): void {
  if (typeof window === "undefined" || autoUpdateStarted) return;
  autoUpdateStarted = true;
  window.setTimeout(() => void runAutoUpdate(), 10_000);
  window.addEventListener("online", () => void runAutoUpdate());
}


/* ═══ زیرساخت PWA و بستهٔ طراحی ═══════════════════════════════════════════ */

/** ثبت سرویس‌ورکر — یک بار در سطح برنامه */
export function useServiceWorkerRegistration() {
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const url = "/sw.js";
    if (navigator.serviceWorker.controller?.scriptURL.endsWith(url)) return;
    navigator.serviceWorker.register(url).catch(() => {
      /* بی‌صدا — محیط بدون SW (مثل file://) نباید خطا بدهد */
    });
  }, []);
}

/**
 * «دکتر مهربان» — پاک‌سازی کامل حافظهٔ موقت مرورگر (SW + همهٔ Cacheها) و رفرش.
 * اگر صفحه‌ای به‌هر دلیل بالا نیامد یا رفتار عجیب دید، این مسیر نجات است:
 * سرویس‌ورکر لغو ثبت می‌شود، همهٔ کش‌های PWA حذف می‌شوند و صفحه با نسخهٔ
 * تازهٔ سرور از نو بالا می‌آید. داده‌های کاربر (localStorage) دست‌نخورده می‌ماند.
 */
export async function purgeBrowserCache(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => {})));
    }
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => {})));
    }
  } catch {
    /* حتی اگر بخشی شکست، رفرش را ادامه بده */
  }
  window.location.replace(window.location.pathname);
}

/** آیا برنامه به‌صورت PWA نصب‌شده اجرا می‌شود؟ */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** هوک وضعیت آنلاین بودن */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = React.useState(true);
  React.useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

/** وضعیت نصب + رویداد نصب (اندروید/دسکتاپ) */
export type PwaPlatform = "ios" | "android" | "desktop";

/** پلتفرم دستگاه — برای راهنمای نصب مخصوص هر سیستم */
export function detectPwaPlatform(): PwaPlatform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  // iPadOS 13+ خودش را Mac معرفی می‌کند؛ با پشتیبانی لمسی تشخیص می‌دهیم
  if (/Macintosh/i.test(ua) && typeof document !== "undefined" && "ontouchend" in document) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

/** مرورگر درون‌برنامه‌ای (تلگرام، اینستاگرام و…) — نصب PWA در آن‌ها ممکن نیست */
export function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /FBAN|FBAV|FBDV|Instagram|Line\/|Snapchat|Telegram|Twitter|TikTok|musical_ly|Bytedance|HiApplication|wv\)/i.test(ua);
}

export function usePwaInstall() {
  const [prompt, setPrompt] = React.useState<{ prompt: () => Promise<void> } | null>(null);
  const [installed, setInstalled] = React.useState(false);
  const [platform, setPlatform] = React.useState<PwaPlatform>("desktop");
  const [inApp, setInApp] = React.useState(false);

  React.useEffect(() => {
    setInstalled(isStandalone());
    setPlatform(detectPwaPlatform());
    setInApp(isInAppBrowser());
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setPrompt(e as unknown as { prompt: () => Promise<void> });
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = React.useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!prompt) return "unavailable";
    await prompt.prompt();
    const choice = await (prompt as unknown as { userChoice: Promise<{ outcome: string }> }).userChoice;
    setPrompt(null);
    if (choice.outcome === "accepted") {
      setInstalled(true);
      return "accepted";
    }
    return "dismissed";
  }, [prompt]);

  return { canInstall: !!prompt, installed, install, platform, inApp };
}

/** پیش‌بارگذاری «بستهٔ طراحی» — پیام به سرویس‌ورکر برای کش‌کردن پوسته */
export function precacheDesignAssets(): Promise<number> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return resolve(-1);
    navigator.serviceWorker.ready
      .then((reg) => {
        const fonts = [
          "/fonts/Vazirmatn-Regular.woff2", "/fonts/Vazirmatn-Medium.woff2", "/fonts/Vazirmatn-Bold.woff2",
          "/fonts/Vazirmatn-SemiBold.woff2", "/fonts/MarkaziText-arabic-var.woff2", "/fonts/MarkaziText-latin-var.woff2",
          "/fonts/NotoNaskhArabic-var.woff2", "/fonts/Estedad-Regular.woff2", "/fonts/Estedad-Medium.woff2",
          "/fonts/Estedad-SemiBold.woff2", "/fonts/Estedad-Bold.woff2",
        ];
        const media = ["/media/hero-law.png", "/logo.svg", "/robots.txt"];
        const urls = [...fonts, ...media];
        const channel = new MessageChannel();
        channel.port1.onmessage = (e) => {
          if (e.data?.type === "PRECACHE_DONE") resolve(e.data.count as number);
        };
        reg.active?.postMessage({ type: "PRECACHE_SHELL", urls }, [channel.port2]);
        // اگر SW پاسخ نداد (نسخهٔ قدیمی) بعد از ۱۰ ثانیه رها کن
        setTimeout(() => resolve(-2), 10_000);
      })
      .catch(() => resolve(-1));
  });
}

/** برآورد حجم مصرفی کش و ذخیره‌سازی (بایت) */
export function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return Promise.resolve(null);
  return navigator.storage.estimate().then((e) => ({ usage: e.usage ?? 0, quota: e.quota ?? 0 }));
}

export function formatBytes(n: number): string {
  if (!n) return "۰";
  if (n < 1024) return faDigits(n) + " بایت";
  if (n < 1024 * 1024) return faDigits(Math.round(n / 1024)) + " کیلوبایت";
  return faDigits(Math.round((n / (1024 * 1024)) * 10) / 10) + " مگابایت";
}

function faDigits(n: number | string): string {
  return String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

export function faDateTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString("fa-IR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}
