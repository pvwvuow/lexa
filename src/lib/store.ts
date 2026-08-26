import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Course } from '@/lib/law/types';
import { todayISO, daysBetween } from '@/lib/fa';

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
  customCourses: Course[];
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
  updateAi(patch: Partial<AiSettings>): void;
  reset(): void;
}

const initialFns = () => ({});

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      progress: {},
      streak: { count: 0, lastDate: '' },
      customCourses: [],
      notes: {},
      ai: DEFAULT_AI,
      lastLocation: {},

      touchStreak() {
        const s = get().streak;
        const today = todayISO();
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

      updateAi(patch) {
        set({ ai: { ...get().ai, ...patch } });
      },

      reset() {
        set({
          progress: {}, streak: { count: 0, lastDate: '' }, customCourses: [], notes: {}, lastLocation: {},
        });
      },
    }),
    {
      name: 'hamyar-hoghough-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        progress: s.progress,
        streak: s.streak,
        customCourses: s.customCourses,
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

initialFns();
