import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Course } from '@/lib/law/types';
import { todayISO, daysBetween } from '@/lib/fa';
import type { SyncSnapshot, SyncLessonProgress } from '@/lib/auth-shared';

// ─── تنظیمات هوش مصنوعی ──────────────────────────────────────────────────────
export type AiProvider = 'builtin' | 'gemini' | 'openai';

export interface AiSettings {
  provider: AiProvider;
  apiKey: string;      // فقط در localStorage مرورگر کاربر ذخیره می‌شود
  model: string;       // مثلا gemini-2.0-flash / gpt-4o-mini
  baseUrl: string;     // فقط برای پروایدرهای سازگار با OpenAI
  temperature: number;
}

export const DEFAULT_AI: AiSettings = {
  provider: 'builtin',
  apiKey: '',
  model: '',
  baseUrl: '',
  temperature: 0.4,
};

// ─── پیشرفت هر جلسه ──────────────────────────────────────────────────────────
export interface LessonProgress {
  status: 'in-progress' | 'completed';
  sectionsSeen: number;      // تا کدام بخش جلسه پیش رفته (۰ مبنایی=۱ بخش اول)
  quizBest?: number;         // درصد بهترین تست از ۱۰۰
  quizAttempts: { date: string; score: number }[];
  markedReview?: boolean;    // «نیاز به مرور دارم» در فلش‌کارت/تست
}

interface AppState {
  progress: Record<string, LessonProgress>;
  streak: { count: number; lastDate: string };
  activity: string[];              // روزهای دارای مطالعه (ISO) برای هیتمپ
  customCourses: Course[];
  /** دوره‌های اساتیدی که کاربر به کتابخانه‌اش افزوده — از سرور هیدرات می‌شود */
  tBooks: Course[];
  /** دوره‌های داخلی که کاربر از کتابخانه حذف کرده — توگل روی سرور ثبت می‌شود */
  hiddenBuiltins: string[];
  notes: Record<string, { id: string; text: string; quote?: string; createdAt: number }[]>;
  ai: AiSettings;
  lastLocation: { courseId?: string; lessonId?: string };

  touchStreak(): void;
  openLesson(lessonId: string): void;
  setSectionSeen(lessonId: string, seen: number): void;
  completeLesson(lessonId: string): void;
  recordQuiz(lessonId: string, scorePct: number, topic?: string, wrongTopics?: string[]): void;
  toggleReviewFlag(topicKey: string): void;
  addNote(lessonId: string, text: string, quote?: string): void;
  removeNote(lessonId: string, noteId: string): void;
  addCourse(course: Course): void;
  upsertCourse(course: Course): void;
  setTBooks(courses: Course[]): void;
  /** جایگزینی کامل لیست دوره‌های داخلی حذف‌شده (پس از هیدریشن از سرور یا توگل محلی) */
  setHiddenBuiltins(ids: string[]): void;
  updateAi(patch: Partial<AiSettings>): void;
  reset(): void;
  /** ادغام بی‌خلط دادهٔ سرور با دادهٔ محلی — هیچ پیشرفتی از بین نمی‌رود */
  mergeServerSnapshot(snap: SyncSnapshot): void;
  /** جایگزینی کامل وضعیت محلی با نسخهٔ سرور — برای «ورود» به حساب موجود؛ بدون هیچ ادغامی */
  replaceFromServer(snap: SyncSnapshot): void;
}

const initialFns = () => ({});

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      progress: {},
      streak: { count: 0, lastDate: '' },
      activity: [],
      customCourses: [],
      tBooks: [],
      hiddenBuiltins: [],
      notes: {},
      ai: DEFAULT_AI,
      lastLocation: {},

      touchStreak() {
        const s = get().streak;
        const today = todayISO();
        // ثبت روز فعال برای هیتمپ (حداکثر ۱۲۰ روز اخیر)
        const act = get().activity;
        if (!act.includes(today)) {
          set({ activity: [...act.filter((d) => d <= today), today].slice(-120) });
        }
        if (s.lastDate === today) return;
        const delta = s.lastDate ? daysBetween(s.lastDate, today) : 999;
        set({ streak: { count: delta === 1 ? s.count + 1 : 1, lastDate: today } });
      },

      openLesson(lessonId) {
        get().touchStreak();
        const p = get().progress[lessonId];
        set({
          lastLocation: { lessonId },
          progress: p
            ? get().progress
            : { ...get().progress, [lessonId]: { status: 'in-progress', sectionsSeen: 1, quizAttempts: [] } },
        });
      },

      setSectionSeen(lessonId, seen) {
        const cur =
          get().progress[lessonId] ?? { status: 'in-progress', sectionsSeen: 1, quizAttempts: [] };
        set({
          progress: {
            ...get().progress,
            [lessonId]: { ...cur, sectionsSeen: Math.max(cur.sectionsSeen, seen), status: 'in-progress' },
          },
        });
      },

      completeLesson(lessonId) {
        const cur =
          get().progress[lessonId] ?? { status: 'in-progress', sectionsSeen: 8, quizAttempts: [] };
        set({
          progress: { ...get().progress, [lessonId]: { ...cur, status: 'completed' } },
          lastLocation: {},
        });
      },

      recordQuiz(lessonId, scorePct, topic, wrongTopics = []) {
        const cur =
          get().progress[lessonId] ?? { status: 'in-progress', sectionsSeen: 8, quizAttempts: [] };
        const attempts = [...cur.quizAttempts, { date: todayISO(), score: scorePct }];
        const best = Math.max(scorePct, cur.quizBest ?? 0);
        const rev = new Set(get().customCourses.length >= 0 ? weakStore() : []);
        (wrongTopics).forEach((t) => rev.add(t));
        if (scorePct < 60 && topic) rev.add(topic);
        else rev.delete(topic ?? '');
        rev.delete('');
        localStorage.setItem('hoh_weak_topics', JSON.stringify([...rev]));
        set({
          progress: { ...get().progress, [lessonId]: { ...cur, quizBest: best, quizAttempts: attempts } },
        });
        function weakStore(): string[] {
          try { return JSON.parse(localStorage.getItem('hoh_weak_topics') || '[]'); } catch { return []; }
        }
      },

      toggleReviewFlag(_topicKey) { /* جایگزین با recordQuiz مدیریت می‌شود */ },

      addNote(lessonId, text, quote) {
        const list = get().notes[lessonId] ?? [];
        set({
          notes: {
            ...get().notes,
            [lessonId]: [{ id: Math.random().toString(36).slice(2), text, quote, createdAt: Date.now() }, ...list],
          },
        });
      },

      removeNote(lessonId, noteId) {
        const list = (get().notes[lessonId] ?? []).filter((n) => n.id !== noteId);
        set({ notes: { ...get().notes, [lessonId]: list } });
      },

      addCourse(course) {
        if (get().customCourses.some((c) => c.id === course.id)) return;
        set({ customCourses: [...get().customCourses, course] });
      },

      upsertCourse(course) {
        const list = get().customCourses.filter((c) => c.id !== course.id);
        set({ customCourses: [...list, course] });
      },

      setTBooks(courses) {
        set({ tBooks: courses });
      },

      setHiddenBuiltins(ids) {
        set({ hiddenBuiltins: [...new Set(ids)] });
      },

      updateAi(patch) {
        set({ ai: { ...get().ai, ...patch } });
      },

      reset() {
        set({
          progress: {}, streak: { count: 0, lastDate: '' }, activity: [], customCourses: [], tBooks: [], hiddenBuiltins: [], notes: {}, lastLocation: {},
        });
      },

      mergeServerSnapshot(snap) {
        const cur = get();

        // ۱) تاریخچهٔ تست‌های سرور به‌دلیل lessonId
        const remoteAttempts = new Map<string, { date: string; score: number }[]>();
        for (const a of snap.quizAttempts ?? []) {
          const arr = remoteAttempts.get(a.lessonId) ?? [];
          arr.push({ date: a.date, score: a.score });
          remoteAttempts.set(a.lessonId, arr);
        }

        // ۲) ادغام وضعیت هر جلسه
        const ids = new Set([
          ...Object.keys(cur.progress),
          ...Object.keys(snap.progress ?? {}),
          ...remoteAttempts.keys(),
        ]);
        const progress: Record<string, LessonProgress> = {};
        for (const id of ids) {
          const l = cur.progress[id];
          const r = snap.progress?.[id];
          if (!l && !r) continue;
          const rawAttempts = [...(l?.quizAttempts ?? []), ...(remoteAttempts.get(id) ?? [])];
          const seenA = new Set<string>();
          const quizAttempts = [...rawAttempts]
            .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
            .filter((x) => {
              const k = `${x.date}|${x.score}`;
              if (seenA.has(k)) return false;
              seenA.add(k);
              return true;
            });
          const remoteBestFromAtt = quizAttempts.length ? Math.max(...quizAttempts.map((a) => a.score)) : -1;
          const best = Math.max(l?.quizBest ?? -1, r?.quizBest ?? -1, remoteBestFromAtt);
          const completed = l?.status === 'completed' || r?.status === 'completed';
          progress[id] = {
            status: completed ? 'completed' : 'in-progress',
            sectionsSeen: Math.max(l?.sectionsSeen ?? 0, r?.sectionsSeen ?? 0, 1),
            quizBest: best >= 0 ? best : undefined,
            quizAttempts,
            markedReview: !!(l?.markedReview || r?.markedReview),
          };
        }

        // ۳) ادغام یادداشت‌ها بر اساس شناسه
        const notes: Record<string, AppState['notes'][string]> = {};
        const noteIds = new Set([...Object.keys(cur.notes), ...Object.keys(snap.notes ?? {})]);
        for (const lid of noteIds) {
          const local = cur.notes[lid] ?? [];
          const remote = (snap.notes ?? {})[lid] ?? [];
          const have = new Set(local.map((n) => n.id));
          const merged = [...local, ...remote.filter((n) => !have.has(n.id))]
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 300);
          if (merged.length) notes[lid] = merged;
        }

        // ۴) روزهای فعالیت، استریک، کتاب‌ها و آخرین مکان
        const activity = [...new Set([...cur.activity, ...(snap.activity ?? [])])]
          .sort()
          .slice(-240);
        const remoteStreakCount = Number((snap.streak as { count?: number } | undefined)?.count ?? 0);
        const streak =
          remoteStreakCount > cur.streak.count
            ? (snap.streak as unknown as typeof cur.streak)
            : cur.streak;
        const customCourses = [...cur.customCourses];
        const courseIds = new Set(customCourses.map((c) => c.id));
        for (const c of (snap.customCourses ?? []) as unknown[]) {
          const obj = c as { id?: string } | null;
          if (obj?.id && !courseIds.has(obj.id)) customCourses.push(c as unknown as Course);
        }
        const lastLocation = Object.keys(cur.lastLocation).length ? cur.lastLocation : ((snap.lastLocation ?? {}) as typeof cur.lastLocation);
        // دوره‌های داخلی حذف‌شده: اتحاد محلی و سرور — چیزی ناپدید نمی‌شود
        const hiddenBuiltins = [...new Set([...cur.hiddenBuiltins, ...((snap.hiddenBuiltins ?? []) as string[])])];

        set({ progress, notes, activity, streak, customCourses, lastLocation, hiddenBuiltins });
      },

      /**
       * ورود به حساب موجود → دادهٔ سرور مقدس است؛ وضعیت محلی «دقیقاً» برابر آن می‌شود.
       * هیچ چیزی از حالت مهمانِ دستگاه به حساب راه پیدا نمی‌کند (سیاست بدون ادغام).
       */
      replaceFromServer(snap) {
        // ۱) بازسازی تاریخچهٔ تست سرور بر اساس lessonId
        const remoteAttempts = new Map<string, { date: string; score: number }[]>();
        for (const a of snap.quizAttempts ?? []) {
          const arr = remoteAttempts.get(a.lessonId) ?? [];
          arr.push({ date: a.date, score: a.score });
          remoteAttempts.set(a.lessonId, arr);
        }

        // ۲) پیشرفت هر جلسه فقط از سرور
        const ids = new Set([...Object.keys(snap.progress ?? {}), ...remoteAttempts.keys()]);
        const progress: Record<string, LessonProgress> = {};
        for (const id of ids) {
          const r = snap.progress?.[id];
          const attempts = [...(remoteAttempts.get(id) ?? [])].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
          if (!r && attempts.length === 0) continue;
          const bestFromAtt = attempts.length ? Math.max(...attempts.map((x) => x.score)) : -1;
          const best = Math.max(r?.quizBest ?? -1, bestFromAtt);
          progress[id] = {
            status: r?.status === "completed" ? "completed" : "in-progress",
            sectionsSeen: Math.max(r?.sectionsSeen ?? 0, 1),
            quizBest: best >= 0 ? best : undefined,
            quizAttempts: attempts,
            markedReview: !!r?.markedReview,
          };
        }

        // ۳) یادداشت‌ها، فعالیت، استریک، کتاب‌ها و آخرین مکان — همه فقط از سرور
        const notes: AppState["notes"] = {};
        for (const [lid, list] of Object.entries(snap.notes ?? {})) {
          if (!Array.isArray(list)) continue;
          const merged = [...list]
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 300);
          if (merged.length) notes[lid] = merged;
        }
        const activity = [...new Set((snap.activity ?? []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort().slice(-240);
        const sCount = Number((snap.streak as { count?: number } | undefined)?.count ?? 0);
        const streak: { count: number; lastDate: string } =
          sCount > 0
            ? { count: sCount, lastDate: String((snap.streak as { lastDate?: string }).lastDate ?? "") }
            : { count: 0, lastDate: "" };
        const customCourses = ((snap.customCourses ?? []) as unknown[]).filter(
          (c) => !!(c as { id?: string })?.id
        ) as unknown as Course[];
        const lastLocation = (snap.lastLocation ?? {}) as AppState["lastLocation"];
        // ورود به حساب موجود: لیست سرور مقدس است (بدون ادغام) — نه پیوست و نه حذف
        const hiddenBuiltins = [...new Set(((snap.hiddenBuiltins ?? []) as string[]).filter((x) => typeof x === 'string'))];

        set({ progress, notes, activity, streak, customCourses, lastLocation, hiddenBuiltins });
      },
    }),
    {
      name: 'hamyar-hoghough-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        progress: s.progress,
        streak: s.streak,
        activity: s.activity,
        customCourses: s.customCourses,
        hiddenBuiltins: s.hiddenBuiltins,
        notes: s.notes,
        ai: s.ai,
        lastLocation: s.lastLocation,
      }),
    },
  ),
);

export function weakTopics(): string[] {
  try { return JSON.parse(localStorage.getItem('hoh_weak_topics') || '[]'); } catch { return []; }
}
export function clearWeakTopic(t: string) {
  const list = new Set(weakTopics());
  list.delete(t);
  localStorage.setItem('hoh_weak_topics', JSON.stringify([...list]));
}

/** تبدیل وضعیت فعلی استور به بستهٔ همگام‌سازی برای ارسال به سرور */
export function buildSyncSnapshot(s: {
  progress: Record<string, LessonProgress>;
  activity: string[];
  notes: Record<string, { id: string; text: string; quote?: string; createdAt: number }[]>;
  customCourses: Course[];
  lastLocation: Record<string, string>;
  streak: { count: number; lastDate: string };
  hiddenBuiltins?: string[];
}): SyncSnapshot {
  const progress: Record<string, SyncLessonProgress> = {};
  const quizAttempts: { lessonId: string; date: string; score: number }[] = [];
  for (const [lessonId, p] of Object.entries(s.progress)) {
    progress[lessonId] = {
      status: p.status,
      sectionsSeen: p.sectionsSeen,
      quizBest: p.quizBest,
      markedReview: p.markedReview,
    };
    for (const a of p.quizAttempts ?? [])
      quizAttempts.push({ lessonId, date: a.date, score: a.score });
  }
  return {
    progress,
    quizAttempts,
    activity: s.activity,
    notes: s.notes,
    customCourses: s.customCourses as unknown[],
    lastLocation: s.lastLocation as Record<string, unknown>,
    streak: s.streak as unknown as Record<string, unknown>,
    hiddenBuiltins: s.hiddenBuiltins ?? [],
  };
}

initialFns();
