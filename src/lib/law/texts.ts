"use client";

/* ─── Lexa — لود تنبل متن و سؤال جلسه‌ها ────────────────────────────────────────
 * باندل اپ فقط «متادیتا» را دارد (عنوان/فصل‌بندی/نسخهٔ محتوا/تعداد سؤال).
 * محتوای هر جلسه (sections + quiz) به‌محض باز شدن همان جلسه (یا فصل) از شبکه
 * گرفته و در IndexedDB کش می‌شود — نه دانلود یک‌جای کل متون.
 *
 * زنجیرهٔ منابع (اولین پاسخ سالم برنده است):
 *   ۱) سرور خود اپ  /texts/<id>.json   — همیشه با نسخهٔ اپ هم‌خوان است
 *   ۲) jsDelivr CDN                    — کش سراسری سریع
 *   ۳) raw.githubusercontent           — fallback رسمی
 * سالم = فایل JSON با v برابر نسخهٔ داخل باندل؛ در غیر این صورت منبع بعدی.
 *
 * آب‌رسانی (hydration): محتوای دریافتی روی همان آبجکت Lesson باندل نوشته می‌شود
 * (الگوی رجیستری داینامیک examPacks) و شمارندهٔ نسخه، مشترک‌های React را
 * از طریق useSyncExternalStore تازه می‌کند.
 * ──────────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import type { Lesson, Chapter, LessonSection, QuizQuestion } from "./types";

/* ─── پیکربندی ─────────────────────────────────────────────────────────────── */

const REPO = "pvwvuow/lexa";
const BRANCH = "main";

/** مهلت هر درخواست (میلی‌ثانیه) */
const FETCH_TIMEOUT = 12_000;
/** حداکثر حجم فایل محتوا — ۵ مگابایت (محافظت از حافظه) */
const MAX_TEXT_BYTES = 5 * 1024 * 1024;
/** همزمانی پیش‌فرض پیش‌بارگیری فصل */
const PREFETCH_CONCURRENCY = 4;

function sourceUrls(lessonId: string): string[] {
  return [
    `/texts/${encodeURIComponent(lessonId)}.json`,
    `https://cdn.jsdelivr.net/gh/${REPO}@${BRANCH}/public/texts/${encodeURIComponent(lessonId)}.json`,
    `https://raw.githubusercontent.com/${REPO}/${BRANCH}/public/texts/${encodeURIComponent(lessonId)}.json`,
  ];
}

/* ─── IndexedDB — کش محتوا ──────────────────────────────────────────────────── */

const DB_NAME = "lexa-texts-db";
const STORE = "texts";

interface CachedText {
  id: string;
  v: string;
  sections: LessonSection[];
  quiz: QuizQuestion[];
  savedAt: number;
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbRun<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  try {
    const tx = db.transaction(STORE, mode);
    return await new Promise<T | null>((resolve) => {
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/* ─── رجیستری وضعیت + اطلاع‌رسانی ──────────────────────────────────────────── */

export type TextState = "idle" | "loading" | "ready" | "error";

const states = new Map<string, TextState>();
const inflight = new Map<string, Promise<boolean>>();
let version = 0;
const listeners = new Set<() => void>();

function setState(id: string, s: TextState) {
  states.set(id, s);
  version += 1;
  listeners.forEach((l) => l());
}

function notify() {
  version += 1;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getVersion() {
  return version;
}

/** محتوای لود‌شده چسبیده به همان آبجکت جلسه نوشته می‌شود */
function hydrate(lesson: Lesson, payload: { sections: LessonSection[]; quiz: QuizQuestion[] }) {
  lesson.sections = payload.sections ?? [];
  lesson.quiz = payload.quiz ?? [];
}

/** آیا این جلسه «تنبل» است؟ (داخلی با نسخه؛ دوره‌های وارداتی از همین اول پرمحتوا هستند) */
export function isLazyLesson(l?: Lesson | null): boolean {
  return !!l && typeof l.v === "string" && l.v.length > 0;
}

/* ─── دریافت از شبکه ────────────────────────────────────────────────────────── */

async function fetchWithTimeout(url: string, ms: number): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, credentials: "omit" });
    return res.ok ? res : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function fetchFromNetwork(lessonId: string, wantV: string): Promise<CachedText | null> {
  for (const url of sourceUrls(lessonId)) {
    const res = await fetchWithTimeout(url, FETCH_TIMEOUT);
    if (!res) continue;
    try {
      const len = Number(res.headers.get("content-length") ?? "0");
      if (len > MAX_TEXT_BYTES) continue;
      const txt = await res.text();
      if (txt.length > MAX_TEXT_BYTES) continue;
      const data = JSON.parse(txt) as Partial<CachedText>;
      if (data?.id !== lessonId || !Array.isArray(data.sections)) continue;
      // نسخهٔ ناهم‌خوان (مثلاً کش کهنهٔ CDN) → منبع بعدی
      if (data.v !== wantV) continue;
      return { id: lessonId, v: data.v, sections: data.sections, quiz: data.quiz ?? [], savedAt: Date.now() };
    } catch {
      continue;
    }
  }
  return null;
}

/* ─── API اصلی ──────────────────────────────────────────────────────────────── */

/**
 * اطمینان از پر بودن محتوای جلسه. اگر لازم باشد از کش/شبکه می‌گیرد.
 * خروجی: true یعنی sections/quiz آمادهٔ استفاده‌اند.
 */
export function ensureLessonContent(lesson?: Lesson | null): Promise<boolean> {
  if (!lesson) return Promise.resolve(false);
  // جلسات غیرتنبل (وارداتی/استودیو) — محتوا همین حالا حاضر است
  if (!isLazyLesson(lesson)) return Promise.resolve(true);
  if (lesson.sections.length > 0) return Promise.resolve(true);

  const id = lesson.id;
  const running = inflight.get(id);
  if (running) return running;

  const job = (async () => {
    setState(id, "loading");
    const wantV = lesson.v as string;

    // ۱) کش محلی — اگر نسخه‌اش همان نسخهٔ باندل باشد
    const cached = await idbRun<CachedText>("readonly", (s) => s.get(id));
    if (cached && cached.v === wantV && Array.isArray(cached.sections)) {
      hydrate(lesson, cached);
      setState(id, "ready");
      return true;
    }

    // ۲) شبکه — زنجیرهٔ self → jsDelivr → raw
    const fresh = await fetchFromNetwork(id, wantV);
    if (fresh) {
      hydrate(lesson, fresh);
      void idbRun("readwrite", (s) => s.put(fresh));
      setState(id, "ready");
      return true;
    }

    // ۳) هیچ‌کدام نشد؛ نسخهٔ کهنهٔ کش بهتر از هیچ است (آفلاین + باندل جدید)
    if (cached && Array.isArray(cached.sections) && cached.sections.length > 0) {
      hydrate(lesson, cached);
      setState(id, "ready");
      return true;
    }

    setState(id, "error");
    return false;
  })();

  inflight.set(id, job);
  return job.finally(() => inflight.delete(id));
}

/** پیش‌بارگیری مجموعه‌ای از جلسه‌ها — با همزمانی محدود؛ تعداد موفق برمی‌گرداند */
export async function ensureLessonsContent(lessons: (Lesson | null | undefined)[], concurrency = 6): Promise<number> {
  const list = lessons.filter((l): l is Lesson => !!l && isLazyLesson(l) && l.sections.length === 0);
  if (!list.length) return 0;
  let ok = 0;
  let cursor = 0;
  async function worker() {
    while (cursor < list.length) {
      const l = list[cursor++];
      if (await ensureLessonContent(l)) ok += 1;
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));
  return ok;
}

/** پیش‌بارگیری کل فصل — با باز شدن فصل صدا زده می‌شود؛ خطاها بی‌صدا */
export async function ensureChapterContent(chapter?: Chapter | null, concurrency = PREFETCH_CONCURRENCY): Promise<number> {
  if (!chapter) return 0;
  return ensureLessonsContent(chapter.lessons ?? [], concurrency);
}

/** پاک‌سازی کش متون (مثلاً از تنظیمات) */
export async function clearTextsCache(): Promise<void> {
  await idbRun("readwrite", (s) => s.clear());
}

/* ─── هوک‌های React ─────────────────────────────────────────────────────────── */

/** نسخهٔ رجیستری — برای بازسازی ایندکس‌ها/لیست‌ها وقتی محتوای تازه آب می‌شود */
export function useTextsVersion(): number {
  return React.useSyncExternalStore(subscribe, getVersion, getVersion);
}

/** وضعیت محتوای یک جلسه */
export function useTextState(lessonId?: string): TextState {
  React.useSyncExternalStore(subscribe, getVersion, getVersion);
  return (lessonId && states.get(lessonId)) || "idle";
}

/** خواندن وضعیت بدون هوک — داخل رندر لیست‌ها (با useTextsVersion تازه می‌شود) */
export function peekTextState(lessonId?: string): TextState {
  return (lessonId && states.get(lessonId)) || "idle";
}

/**
 * گیت محتوا برای صفحهٔ جلسه — در مونت، محتوا را می‌گیرد و وضعیت می‌دهد.
 * برای جلسات غیرتنبل همیشه ready است.
 */
export function useLessonContent(lesson?: Lesson | null): TextState {
  React.useSyncExternalStore(subscribe, getVersion, getVersion);
  const lazy = isLazyLesson(lesson);
  const id = lesson?.id;
  const empty = !!lesson && lesson.sections.length === 0;

  React.useEffect(() => {
    if (lesson && lazy && empty) void ensureLessonContent(lesson);
  }, [lesson, lazy, empty]);

  if (!lazy) return "ready";
  if (lesson && lesson.sections.length > 0) return "ready";
  return (id && states.get(id)) || "idle";
}

/* ─── گرم‌کن تدریجی کتابخانه (فلش‌کارت‌ها) ──────────────────────────────────── */

let warmupRunning = false;

/**
 * بارگیری آرام و پس‌زمینه‌ای همهٔ متون باقی‌مانده — فقط وقتی کاربر فعالانه
 * وارد جایی می‌شود که به کل کتابخانه نیاز دارد (مثل فلش‌کارت‌ها).
 * همزمانی کم + وقفه، تا شبکه/باتری آزار نبیند.
 */
export async function startLibraryWarmup(getLessons: () => Lesson[]): Promise<void> {
  if (warmupRunning) return;
  warmupRunning = true;
  try {
    const queue = getLessons().filter((l) => isLazyLesson(l) && l.sections.length === 0);
    let cursor = 0;
    const workers = Array.from({ length: 2 }, async () => {
      while (cursor < queue.length) {
        const l = queue[cursor++];
        await ensureLessonContent(l);
        await new Promise((r) => setTimeout(r, 250));
      }
    });
    await Promise.all(workers);
  } finally {
    warmupRunning = false;
    notify();
  }
}

export function isWarmupRunning(): boolean {
  return warmupRunning;
}
