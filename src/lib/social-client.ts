"use client";

// ─── کلاینت شبکهٔ اساتید ──────────────────────────────────────────────────────
import * as React from "react";
import { useAuth, refreshLibrary } from "@/lib/auth-client";

export interface SuggestionItem {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  followers: number;
  posts: number;
  courses: number;
  isFollowing: boolean;
}

export interface FeedPost {
  id: string;
  title: string;
  summary: string;
  tags: string;
  createdAt: string;
  updatedAt: string;
  commentsCount: number;
  author: { id: string; username: string; displayName: string };
}

export interface TCourseCard {
  id: string;
  title: string;
  tagline: string;
  description: string;
  icon?: string;
  lessonsCount: number;
  studentsCount: number;
  inLibrary: boolean;
  canManage: boolean;
  teacher: { id: string; username: string; displayName: string };
}

async function jf<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "خطای ارتباط با سرور.");
  return data as T;
}

export function faNum(n: number): string {
  try { return n.toLocaleString("fa-IR"); } catch { return String(n); }
}

/** پیشنهاد اساتید + فید مطالب؛ خودکار با وضعیت ورود همگام می‌شود */
export function useSocial() {
  const { user, status } = useAuth();
  const [teachers, setTeachers] = React.useState<SuggestionItem[]>([]);
  const [feed, setFeed] = React.useState<FeedPost[]>([]);
  const [showingAll, setShowingAll] = React.useState(true);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const s = await jf<{ teachers: SuggestionItem[] }>("/api/social/suggestions");
      setTeachers(s.teachers);
      const f = await jf<{ posts: FeedPost[]; showingAll?: boolean }>("/api/social/feed");
      setFeed(f.posts);
      setShowingAll(!!f.showingAll);
    } catch {
      /* در محیط آفلاین بی‌صدا */
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // پس از تغییر نشست دوباره بارگذاری کن
    void load();
  }, [load, status, user?.id]);

  /** توگل فالو بهینه با به‌روزرسانی خوش‌بینانه */
  const toggleFollow = React.useCallback(
    async (teacherId: string) => {
      if (!user) throw new Error("برای دنبال کردن، ابتدا وارد شوید.");
      let following = false;
      setTeachers((ts) =>
        ts.map((t) => {
          if (t.id !== teacherId) return t;
          following = !t.isFollowing;
          return { ...t, isFollowing: following, followers: t.followers + (following ? 1 : -1) };
        }),
      );
      try {
        await jf("/api/social/follow", { method: "POST", body: JSON.stringify({ teacherId }) });
        void load();
      } catch (e) {
        void load(); // بازگشت به حالت واقعی
        throw e;
      }
    },
    [user, load],
  );

  return { teachers, feed, showingAll, loading, reload: load, toggleFollow };
}

/** فهرست دوره‌های اساتید (+ mine فقط دوره‌های خودم) */
export function useTCourses(mine = false) {
  const [courses, setCourses] = React.useState<TCourseCard[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const d = await jf<{ courses: TCourseCard[] }>(`/api/tcourses${mine ? "?mine=1" : ""}`);
      setCourses(d.courses);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [mine]);

  React.useEffect(() => {
    void load();
  }, [load]);

  /** افزودن/حذف از کتابخانهٔ من — خوش‌بینانه */
  const toggleLibrary = React.useCallback(
    async (courseId: string) => {
      const d = await jf<{ inLibrary: boolean }>("/api/library", {
        method: "POST",
        body: JSON.stringify({ courseId }),
      });
      setCourses((cs) => cs.map((c) => (c.id === courseId ? { ...c, inLibrary: d.inLibrary } : c)));
      // هیدرات فوری کتاب‌های استاد در فروشگاه مطالعه — تا سایدبار/خانه بدون رفرش به‌روز شوند
      void refreshLibrary();
      return d.inLibrary;
    },
    [],
  );

  return { courses, loading, reload: load, toggleLibrary, setCourses };
}
