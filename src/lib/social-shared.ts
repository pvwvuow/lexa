// ─── ابزارهای مشترک شبکهٔ اساتید (سمت سرور) ───────────────────────────────────
import type { Course, Chapter, Lesson, LessonSection, QuizQuestion } from "@/lib/law/types";

export interface AuthorMeta {
  id: string;
  username: string;
  displayName: string; // نمایش: displayName یا username
  avatarUrl?: string | null;
}

/** شاخه‌های کتابخانهٔ عمومی — استاد هنگام ساخت دوره یا مطلب یکی را انتخاب می‌کند */
export const CATEGORIES = [
  { slug: "tejarat", label: "تجارت", icon: "Scale", desc: "چک، برات، سفته و قانون تجارت" },
  { slug: "ayin-dadresi", label: "آیین دادرسی مدنی", icon: "Gavel", desc: "اقدامات، رسیدگی، اجرای احکام" },
  { slug: "azmoon-vekalat", label: "آزمون وکالت", icon: "GraduationCap", desc: "نکته‌های امتحانی و تست‌محور" },
  { slug: "takhassosi", label: "دروس تخصصی کارشناسی وکالت", icon: "BookMarked", desc: "درس‌های عمیق رشتهٔ وکالت" },
  { slug: "other", label: "سایر مباحث", icon: "Library", desc: "هر مبحث حقوقی دیگر" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];
export const CATEGORY_SLUGS: string[] = CATEGORIES.map((c) => c.slug);

export function categoryLabel(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
}

function safeCategory(v: unknown): string {
  const s = typeof v === "string" ? v.trim() : "";
  return CATEGORY_SLUGS.includes(s) ? s : "other";
}

/** شاخه‌های چندگانه — آرایهٔ ورودی را پالایش و تکراری‌زدایی می‌کند (حداکثر ۴ شاخه) */
function safeCategories(v: unknown): string[] {
  const raw = Array.isArray(v) ? v : typeof v === "string" ? (() => { try { return JSON.parse(v); } catch { return []; } })() : [];
  const out: string[] = [];
  for (const item of raw) {
    const s = typeof item === "string" ? item.trim() : "";
    if (!CATEGORY_SLUGS.includes(s)) continue;
    if (!out.includes(s)) out.push(s);
    if (out.length >= 4) break;
  }
  return out.length ? out : ["other"];
}

/** خواندن شاخه‌های چندگانه از ردیف دیتابیس — با سازگاری ستون قدیمی category */
export function parseCategories(categoriesJson: string | undefined | null, legacy: string | undefined | null): string[] {
  try {
    const parsed = categoriesJson ? JSON.parse(categoriesJson) : [];
    if (Array.isArray(parsed) && parsed.length) return safeCategories(parsed);
  } catch {}
  return [safeCategory(legacy)];
}

/** آیا یک آیتم در شاخهٔ خواسته‌شده می‌آید؟ (سازگار با ستون قدیمی) */
export function inCategory(cats: string[], legacy: string | null | undefined, cat: string): boolean {
  if (!cat) return true;
  if (cats.includes(cat)) return true;
  return cat === "other" ? safeCategory(legacy) === "other" : legacy === cat;
}

/** حداکثرهای امن برای بلوک‌های مطلب/دوره */
const LIMITS = {
  postsBlocks: 80,
  chapters: 24,
  lessonsPerChapter: 40,
  sectionsPerLesson: 60,
  questionsPerQuiz: 30,
};

const QUIZ_KEYS = ["a", "b", "c", "d"] as const;

/**
 * پالایش آرایهٔ سؤالات تستی ورودی از کلاینت (آزمون فصل/جلسه/مبحث) —
 * هر سؤال باید دست‌کم دو گزینهٔ پر و پاسخِ معتبر داشته باشد.
 */
export function sanitizeQuiz(raw: unknown): QuizQuestion[] {
  const out: QuizQuestion[] = [];
  for (const item of arr(raw).slice(0, LIMITS.questionsPerQuiz)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const q = s(o.q, 600).trim();
    if (!q) continue;
    const opts = arr(o.options)
      .slice(0, 4)
      .map((x) => s((x as { text?: unknown })?.text ?? x, 300).trim())
      .filter(Boolean);
    if (opts.length < 2) continue;
    const ansIdx = QUIZ_KEYS.indexOf(String(o.answer ?? "").trim().toLowerCase() as "a");
    if (ansIdx < 0 || ansIdx >= opts.length) continue;
    out.push({
      q,
      options: opts.map((text, i) => ({ key: QUIZ_KEYS[i], text })),
      answer: QUIZ_KEYS[ansIdx],
      explanation: s(o.explanation, 1000),
      topic: s(o.topic, 80) || undefined,
    });
  }
  return out;
}

/**
 * اعتبارسنجی تصویر شاخص — فقط مسیر نسبی امن یا آدرس http(s)؛
 * خروجی خالی یعنی بدون تصویر (دلخواه است).
 */
export function safeThumbnail(v: unknown): string {
  const url = s(v, 600).trim();
  if (!url) return "";
  if (url.startsWith("/") && !url.startsWith("//") && !url.includes("\\")) return url;
  if (/^https:\/\/[\w.-]+/i.test(url) || /^http:\/\/[\w.-]+/i.test(url)) return url;
  return "";
}

function s(v: unknown, max = 6000): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}
function arr<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

/**
 * پالایش و پاک‌سازی آرایهٔ LessonSection ورودی از کلاینت — فقط فیلدهای شناخته‌شده
 * نگه داشته می‌شود تا JSON ذخیره‌شده همیشه با رندرر اپ سازگار بماند.
 */
export function sanitizeSections(raw: unknown): LessonSection[] {
  const out: LessonSection[] = [];
  for (const item of arr(raw).slice(0, LIMITS.postsBlocks)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    let type = String(o.type ?? "concept");
    if (!["intro", "concept", "law", "notes", "example", "compare", "summary", "question"].includes(type))
      type = "concept";
    if (type === "notes" && !o.bullets) type = "concept";
    if (type === "compare" && !o.table) type = "concept";
    if (type === "law" && !o.law) type = "concept";
    if (type === "question" && !o.questionText) type = "concept";

    const sec: LessonSection = {
      id: s(o.id, 40) || `sb-${Math.random().toString(36).slice(2, 10)}`,
      type: type as LessonSection["type"],
      title: s(o.title, 120) || undefined,
      body: o.body ? s(o.body, 9000) || undefined : undefined,
      bullets:
        o.bullets && Array.isArray(o.bullets)
          ? o.bullets.slice(0, 30).map((b) => s(b, 500)).filter(Boolean)
          : undefined,
      questionText: o.questionText ? s(o.questionText, 2000) : undefined,
      suggestedAnswer: o.suggestedAnswer ? s(o.suggestedAnswer, 3000) : undefined,
      table: undefined,
      law: undefined,
    };

    if (type === "law") {
      sec.law = arr(o.law)
        .slice(0, 12)
        .map((l) => {
          const lo = (l ?? {}) as Record<string, unknown>;
          return { no: s(lo.no, 24), source: s(lo.source, 90) || undefined, text: s(lo.text, 2400) };
        })
        .filter((x) => x.text);
      if (!sec.law.length) continue;
    }
    if (type === "compare") {
      const t = (o.table ?? {}) as Record<string, unknown>;
      const headers = arr(t.headers).slice(0, 8).map((h) => s(h, 90));
      const rows = arr(t.rows)
        .slice(0, 30)
        .map((r) => arr(r).slice(0, headers.length).map((c) => s(c, 400)));
      if (headers.length >= 2 && rows.length >= 1) sec.table = { headers, rows };
      else continue;
    }
    out.push(sec);
  }
  return out;
}

/** بازسازی شناسه‌ها به شکلی موتور مطالعه انتظار دارد (چون ممکن است جابه‌جا شده باشند) */
function withIds(courseId: string, rawChapters: unknown): Chapter[] {
  return arr(rawChapters)
    .slice(0, LIMITS.chapters)
    .map((chItem, ci) => {
      const ch = (chItem ?? {}) as Record<string, unknown>;
      const lessons: Lesson[] = arr(ch.lessons)
        .slice(0, LIMITS.lessonsPerChapter)
        .map((lsItem, li) => {
          const ls = (lsItem ?? {}) as Record<string, unknown>;
          return {
            id: `tc-${courseId}-${ci}-${li}`,
            title: s(ls.title, 160) || `جلسهٔ ${li + 1}`,
            status: "ready" as const,
            minutes: Number(ls.minutes) > 0 ? Math.min(180, Math.floor(Number(ls.minutes))) : undefined,
            sections: sanitizeSections(ls.sections),
            // آزمون ساختهٔ استاد برای همین جلسه — با همان موتور تست اپ اجرا می‌شود
            quiz: sanitizeQuiz(ls.quiz),
          };
        });
      return {
        id: `${courseId}-c${ci}`,
        order: ci + 1,
        title: s(ch.title, 140) || `فصل ${ci + 1}`,
        subtitle: s(ch.subtitle, 160) || undefined,
        lessons,
        // آزمون پایان فصل — اگر استاد ساخته باشد
        quiz: sanitizeQuiz(ch.quiz),
      };
    })
    .map((ch, ci) => ({ ...ch, order: ci + 1, id: `${courseId}-c${ci}` }));
}

export function teacherCourseToCourse(
  row: {
    id: string; title: string; tagline: string; description: string;
    icon: string; accent: string; chaptersJson: string;
    category?: string; categories?: string; status?: string; thumbnail?: string;
  },
  teacher: AuthorMeta,
): Course & { _ownerUsername?: string; _ownerAvatar?: string | null; _category?: string; _categories?: string[]; _status?: string; _thumbnail?: string } {
  let parsed: unknown = [];
  try { parsed = JSON.parse(row.chaptersJson); } catch {}
  return {
    id: row.id,
    title: row.title,
    tagline: row.tagline || teacher.displayName,
    description: row.description,
    icon: row.icon || undefined,
    accent: row.accent as Course["accent"],
    origin: "built-in", // مثل کتاب داخلی رفتار کند؛ تفاوت در sourceLabel مشخص است
    sourceLabel: `تدریس ${teacher.displayName} — دورهٔ آنلاین`,
    chapters: withIds(row.id, parsed),
    _ownerUsername: teacher.username,
    _ownerAvatar: teacher.avatarUrl ?? null,
    _category: safeCategory(row.category),
    _categories: parseCategories(row.categories, row.category),
    _status: row.status === "draft" || row.status === "prep" ? row.status : "published",
    _thumbnail: safeThumbnail(row.thumbnail),
  };
}

export { LIMITS, safeCategory, safeCategories };
