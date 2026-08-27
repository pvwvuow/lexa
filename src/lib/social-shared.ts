// ─── ابزارهای مشترک شبکهٔ اساتید (سمت سرور) ───────────────────────────────────
import type { Course, Chapter, Lesson, LessonSection } from "@/lib/law/types";

export interface AuthorMeta {
  id: string;
  username: string;
  displayName: string; // نمایش: displayName یا username
}

/** حداکثرهای امن برای بلوک‌های مطلب/دوره */
const LIMITS = {
  postsBlocks: 80,
  chapters: 24,
  lessonsPerChapter: 40,
  sectionsPerLesson: 60,
};

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
            quiz: [],
          };
        });
      return {
        id: `${courseId}-c${ci}`,
        order: ci + 1,
        title: s(ch.title, 140) || `فصل ${ci + 1}`,
        subtitle: s(ch.subtitle, 160) || undefined,
        lessons,
      };
    })
    .map((ch, ci) => ({ ...ch, order: ci + 1, id: `${courseId}-c${ci}` }));
}

export function teacherCourseToCourse(
  row: {
    id: string; title: string; tagline: string; description: string;
    icon: string; accent: string; chaptersJson: string;
  },
  teacher: AuthorMeta,
): Course & { _ownerUsername?: string } {
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
  };
}

export { LIMITS };
