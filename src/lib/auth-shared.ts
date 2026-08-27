// انواع و اعتبارسنجی‌های مشترک کلاینت/سرور برای سیستم حساب کاربری

export interface PublicUser {
  id: string;
  username: string;
  role: "user" | "admin";
  createdAt: string; // ISO
}

/** نسخهٔ یکسان‌شدهٔ وضعیت پیشرفت یک جلسه */
export interface SyncLessonProgress {
  status: "in-progress" | "completed";
  sectionsSeen: number;
  quizBest?: number;
  markedReview?: boolean;
}

export interface SyncSnapshot {
  /** شناسهٔ جلسه → وضعیت */
  progress?: Record<string, SyncLessonProgress>;
  /** تاریخچهٔ کامل تست‌ها (فقط افزودنی) */
  quizAttempts?: { lessonId: string; date: string; score: number }[];
  /** روزهای دارای مطالعه YYYY-MM-DD */
  activity?: string[];
  notes?: Record<
    string,
    { id: string; text: string; quote?: string; createdAt: number }[]
  >;
  customCourses?: unknown[];
  lastLocation?: Record<string, unknown>;
  streak?: Record<string, unknown>;
}

// ─── قواعد نام کاربری و رمز عبور ──────────────────────────────────────────────
export function validateUsername(u: string): string | null {
  if (!u) return "نام کاربری را وارد کنید.";
  if (u.length < 3 || u.length > 20)
    return "نام کاربری باید بین ۳ تا ۲۰ نویسه باشد.";
  if (!/^[a-zA-Z0-9_\u0600-\u06FF][a-zA-Z0-9_.\u0600-\u06FF]*$/.test(u))
    return "نام کاربری فقط شامل حروف فارسی/لاتین، رقم، زیرخط یا نقطه است.";
  return null;
}

export function validatePassword(p: string): string | null {
  if (!p) return "رمز عبور را وارد کنید.";
  if (p.length < 6) return "رمز عبور باید دست‌کم ۶ نویسه باشد.";
  if (p.length > 128) return "رمز عبور بیش از حد بلند است.";
  return null;
}
