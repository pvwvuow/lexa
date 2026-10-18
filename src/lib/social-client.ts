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
  // ⚠️ سرور محلی Capacitor برای مسیرهای ناموجود (مثل /api/* در APK) صفحهٔ
  // 404.html را با status 200 برمی‌گرداند؛ بدون این گارد، HTML به‌جای JSON
  // «پاسخ سالم» پنداشته می‌شود و فیلدهای undefined به state می‌روند (کرش رندر).
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  const data = ct.includes("json") ? await res.json().catch(() => ({})) : {};
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "خطای ارتباط با سرور.");
  return data as T;
}

/** User-facing error text: browser network errors ("Failed to fetch", …) are English
 *  and meaningless to users, so only Persian server messages are shown as-is. */
export function errText(e: unknown, fallback: string): string {
  const m = e instanceof Error ? e.message : "";
  return m && /[\u0600-\u06FF]/.test(m) ? m : fallback;
}

const NET_FAIL = "دریافت اطلاعات انجام نشد؛ اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.";

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
  // a failed load must not look like "no teachers yet"
  const [error, setError] = React.useState("");
  // only the newest load may write state (a slow reply for the previous account
  // used to overwrite the new one)
  const reqRef = React.useRef(0);

  const load = React.useCallback(async () => {
    const id = ++reqRef.current;
    setLoading(true);
    setError("");
    try {
      const s = await jf<{ teachers: SuggestionItem[] }>("/api/social/suggestions");
      if (id !== reqRef.current) return;
      // گارد دفاعی — state هرگز undefined نمی‌شود (هر طور پاسخ خراب/غیرJSON برگردد)
      setTeachers(Array.isArray(s?.teachers) ? s.teachers : []);
      const f = await jf<{ posts: FeedPost[]; showingAll?: boolean }>("/api/social/feed");
      if (id !== reqRef.current) return;
      setFeed(Array.isArray(f?.posts) ? f.posts : []);
      setShowingAll(!!f?.showingAll);
    } catch (e) {
      if (id === reqRef.current) {
        setError(errText(e, NET_FAIL));
      }
    } finally {
      if (id === reqRef.current) setLoading(false);
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

  return { teachers, feed, showingAll, loading, error, reload: load, toggleFollow };
}

/** فهرست دوره‌های اساتید (+ mine فقط دوره‌های خودم) */
export function useTCourses(mine = false) {
  const [courses, setCourses] = React.useState<TCourseCard[]>([]);
  const [loading, setLoading] = React.useState(true);
  // a failed load must not look like "no courses yet"
  const [error, setError] = React.useState("");
  const reqRef = React.useRef(0);

  const load = React.useCallback(async () => {
    const id = ++reqRef.current;
    setLoading(true);
    setError("");
    try {
      const d = await jf<{ courses: TCourseCard[] }>(`/api/tcourses${mine ? "?mine=1" : ""}`);
      // APK: the HTML 404 page comes back as {} — never put undefined into state
      if (id === reqRef.current) setCourses(Array.isArray(d?.courses) ? d.courses : []);
    } catch (e) {
      if (id === reqRef.current) setError(errText(e, NET_FAIL));
    } finally {
      if (id === reqRef.current) setLoading(false);
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

  return { courses, loading, error, reload: load, toggleLibrary, setCourses };
}

/** آیا این دورهٔ استاد در کتابخانهٔ محلی همین دستگاه هست؟ (مهمان‌ها بدون حساب اضافه می‌کنند) */
export function isInLocalLibrary(tBooks: { id: string }[], courseId: string): boolean {
  return tBooks.some((t) => t.id === courseId);
}

/**
 * افزودن محلی دورهٔ استاد برای مهمان‌ها — بدون حساب و بدون سرور.
 * دوره از سرور واکشی و در فروشگاه همین دستگاه (localStorage) می‌ماند؛
 * شناسهٔ جلسات با مسیر سروری یکی است، پس پیشرفت بعد از ساختن حساب هم سر جایش است.
 */
export async function addTCourseLocally(courseId: string): Promise<boolean> {
  try {
    const r = await fetch(`/api/tcourses/${encodeURIComponent(courseId)}`);
    if (!r.ok) return false;
    const d = await r.json();
    if (!d?.course) return false;
    const st = useApp.getState();
    if (st.tBooks.some((c) => c.id === courseId)) return true;
    st.setTBooks([...st.tBooks, d.course]);
    return true;
  } catch {
    return false;
  }
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
  // a failed request is shown with a retry button, never as an empty category
  const [error, setError] = React.useState("");
  // switching category A → B: a slow reply for A must not overwrite B
  const reqRef = React.useRef(0);

  const load = React.useCallback(async () => {
    const id = ++reqRef.current;
    setError("");
    if (!enabled) { setCourses([]); setPosts([]); setLoading(false); return; }
    setLoading(true);
    try {
      const d = await jf<{ courses: TCourseCard[]; posts: FeedPost[] }>(
        `/api/library/public${cat ? `?cat=${encodeURIComponent(cat)}` : ""}`,
      );
      if (id !== reqRef.current) return;
      setCourses(Array.isArray(d?.courses) ? d.courses : []);
      setPosts(Array.isArray(d?.posts) ? d.posts : []);
    } catch (e) {
      if (id === reqRef.current) setError(errText(e, NET_FAIL));
    } finally {
      if (id === reqRef.current) setLoading(false);
    }
  }, [cat, enabled]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return { courses, posts, loading, error, reload: load };
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
  // network / server failure — shown with a retry button, never as "not found"
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const reqRef = React.useRef(0);

  const load = React.useCallback(async () => {
    if (!userId) return;
    const id = ++reqRef.current;
    setLoading(true);
    setNotFound(false);
    setError("");
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(userId)}`);
      // APK: missing routes come back as the HTML 404 page with status 200
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      const d = (ct.includes("json") ? await res.json().catch(() => ({})) : {}) as Partial<TeacherProfileData> & { error?: string };
      if (id !== reqRef.current) return;
      if (res.status === 404 || (res.ok && !d?.profile)) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        setError(d.error || "دریافت پروفایل انجام نشد؛ لطفاً دوباره تلاش کنید.");
        return;
      }
      setData({
        ...(d as TeacherProfileData),
        courses: Array.isArray(d.courses) ? d.courses : [],
        posts: Array.isArray(d.posts) ? d.posts : [],
      });
    } catch {
      if (id === reqRef.current) setError(NET_FAIL);
    } finally {
      if (id === reqRef.current) setLoading(false);
    }
  }, [userId]);

  // another profile: never show the previous teacher while the new one loads
  React.useEffect(() => {
    setData(null);
  }, [userId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, notFound, error, reload: load };
}
