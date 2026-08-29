"use client";

// ─── کلاینت شبکهٔ اساتید ──────────────────────────────────────────────────────
import * as React from "react";
import { useApp } from "@/lib/store";
import { useAuth, refreshLibrary } from "@/lib/auth-client";

export interface SuggestionItem {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl?: string | null;
  followers: number;
  posts: number;
  courses: number;
  isFollowing: boolean;
}

export interface RatingInfo { avg: number; count: number }

export interface FeedPost {
  id: string;
  title: string;
  summary: string;
  tags: string;
  category?: string;
  categories?: string[];
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
  commentsCount: number;
  rating?: RatingInfo;
  author: { id: string; username: string; displayName: string; avatarUrl?: string | null };
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
  rating?: RatingInfo;
  /** متادیتای دورهٔ استاد از سرور */
  _category?: string;
  _categories?: string[];
  _status?: "draft" | "prep" | "published";
  _ownerUsername?: string;
  _ownerAvatar?: string | null;
  /** آخرین به‌روزرسانی سرور — مبنای نشان «به‌روز شده» نسخهٔ آفلاین */
  _updatedAt?: string;
  teacher: { id: string; username: string; displayName: string; avatarUrl?: string | null };
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

/**
 * توگل حذف/برگرداندن یک «دورهٔ داخلی» از کتابخانهٔ من.
 * وضعیت محلی بی‌درنگ عوض می‌شود؛ اگر وارد حساب شده باشد همان تغییر با سینک خودکار
 * (و یک POST فوری) روی سرور ثبت می‌شود. مهمان فقط در همین مرورگر ثبت می‌کند.
 * پیشرفت، تست و یادداشت آن جلسات به هیچ عنوان دست نمی‌خورد.
 */
export async function toggleBuiltinHidden(courseId: string): Promise<boolean /* اکنون مخفی؟ */> {
  const st = useApp.getState();
  const cur = st.hiddenBuiltins;
  const willHide = !cur.includes(courseId);
  st.setHiddenBuiltins(willHide ? [...cur, courseId] : cur.filter((x) => x !== courseId));
  try {
    await fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "builtin", courseId }),
    });
  } catch { /* مهمان یا آفلاین: حالت محلی می‌ماند؛ سینک بعدی هندل می‌کند */ }
  return willHide;
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

/** وضعیت امتیاز یک هدف (مطلب یا دوره) + ثبت رأی ستاره‌ای */
export function useTargetRating(targetType: "post" | "tcourse", targetId?: string | null) {
  const [agg, setAgg] = React.useState<RatingInfo>({ avg: 0, count: 0 });
  const [my, setMy] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!targetId) return;
    let alive = true;
    setAgg({ avg: 0, count: 0 });
    setMy(null);
    fetch(`/api/ratings?targetType=${targetType}&targetId=${encodeURIComponent(targetId)}`)
      .then((r) => r.json())
      .then((d: { avg?: number; count?: number; my?: number | null }) => {
        if (!alive) return;
        setAgg({ avg: d.avg ?? 0, count: d.count ?? 0 });
        setMy(d.my ?? null);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [targetType, targetId]);

  const rate = React.useCallback(
    async (stars: number) => {
      if (!targetId) throw new Error("هدف امتیاز یافت نشد.");
      setBusy(true);
      try {
        const d = await jf<{ avg: number; count: number; my: number }>("/api/ratings", {
          method: "POST",
          body: JSON.stringify({ targetType, targetId, stars }),
        });
        setAgg({ avg: d.avg, count: d.count });
        setMy(d.my);
      } finally {
        setBusy(false);
      }
    },
    [targetType, targetId],
  );

  return { agg, my, busy, rate };
}

/** واکشی کتابخانهٔ عمومی به تفکیک شاخه — enabled=false یعنی کلاً درخواست نزن */
export function usePublicLibrary(cat: string, enabled = true) {
  const [courses, setCourses] = React.useState<TCourseCard[]>([]);
  const [posts, setPosts] = React.useState<FeedPost[]>([]);
  const [loading, setLoading] = React.useState(enabled);

  const load = React.useCallback(async () => {
    if (!enabled) { setCourses([]); setPosts([]); setLoading(false); return; }
    setLoading(true);
    try {
      const d = await jf<{ courses: TCourseCard[]; posts: FeedPost[] }>(
        `/api/library/public${cat ? `?cat=${encodeURIComponent(cat)}` : ""}`,
      );
      setCourses(d.courses ?? []);
      setPosts(d.posts ?? []);
    } catch {
      /* بی‌صدا */
    } finally {
      setLoading(false);
    }
  }, [cat, enabled]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return { courses, posts, loading, reload: load };
}

export interface TeacherProfileData {
  profile: {
    id: string;
    username: string;
    displayName: string;
    bio: string;
    avatarUrl?: string | null;
    role: string;
    joinedAt: string;
    followersCount: number;
    postsCount: number;
    coursesCount: number;
    avgRating: number;
    isFollowing: boolean;
  };
  courses: TCourseCard[];
  posts: Omit<FeedPost, "author">[];
}

/** پروفایل عمومی یک استاد */
export function useTeacherProfile(userId?: string | null) {
  const [data, setData] = React.useState<TeacherProfileData | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setNotFound(false);
    try {
      setData(await jf<TeacherProfileData>(`/api/users/${userId}`));
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, notFound, reload: load };
}
