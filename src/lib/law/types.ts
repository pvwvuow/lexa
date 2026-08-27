// ─── Domain model of "همیار حقوق" ────────────────────────────────────────────

export type SectionType =
  | 'intro'      // مقدمه و هدف جلسه
  | 'concept'    // تعریف و مفهوم
  | 'law'        // مستند قانونی
  | 'notes'      // نکات کلیدی و ریزه‌کاری‌ها
  | 'example'    // مثال کاربردی / کیس فرضی
  | 'compare'    // جدول مقایسه‌ای
  | 'summary'    // جمع‌بندی
  | 'question';  // سؤال تعاملی

export interface LawRef {
  no: string;          // مثل «۹۵۶» یا «۱۴ ق.آ.د.م»
  source?: string;     // مثل «قانون مدنی» – پیش‌فرض قانون مدنی
  text: string;
}

export interface CompareTable {
  headers: string[];
  rows: string[][];
}

export interface LessonSection {
  id: string;
  type: SectionType;
  title?: string;
  body?: string;              // متن اصلی (می‌تواند چند پاراگراف با \n\n باشد)
  law?: LawRef[];             // برای بخش law (و حتی استناد جانبی)
  bullets?: string[];         // لیست نکته‌ها
  table?: CompareTable;
  questionText?: string;      // برای section نوع question
  suggestedAnswer?: string;
}

export interface McqOption { key: 'a' | 'b' | 'c' | 'd'; text: string }

export interface QuizQuestion {
  q: string;
  options: McqOption[];
  answer: 'a' | 'b' | 'c' | 'd';
  explanation: string;
  topic?: string;             // برای شناسایی مبحث ضعیف
}

export interface Flashcard {
  front: string;
  back: string;
  lawRef?: string;
}

export interface Lesson {
  id: string;
  title: string;
  /** جلسات وارداتی هنوز تولید محتوا نشده‌اند */
  status?: 'ready' | 'ai-pending';
  sourceSlice?: string;       // متن خام PDF برای تولید AI
  sections: LessonSection[];
  quiz: QuizQuestion[];
  minutes?: number;
}

export interface Chapter {
  id: string;
  order: number;
  title: string;
  subtitle?: string;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  title: string;
  tagline: string;
  description: string;
  icon?: string;                       // نام آیکون lucide
  accent?: 'navy' | 'bronze' | 'green';
  origin: 'built-in' | 'imported';
  sourceLabel?: string;                // «جزوه دکتر ملاکریمی، ویرایش ۱۴۰۲» …
  chapters: Chapter[];
}

/** پیدا کردن جلسه در کل دوره‌ها */
export function findLesson(courses: Course[], lessonId: string): {
  lesson: Lesson; chapter: Chapter; course: Course; index: number; total: number;
} | null {
  for (const c of courses) {
    for (const ch of c.chapters) {
      const idx = ch.lessons.findIndex((l) => l.id === lessonId);
      if (idx >= 0)
        return {
          lesson: ch.lessons[idx], chapter: ch, course: c,
          index: idx,
          total: c.chapters.reduce((n, x) => n + x.lessons.length, 0),
        };
    }
  }
  return null;
}

export function flatLessons(course: Course): { lesson: Lesson; chapter: Chapter }[] {
  return course.chapters.flatMap((ch) => ch.lessons.map((l) => ({ lesson: l, chapter: ch })));
}

export function flattenAll(courses: Course[]): { lesson: Lesson; chapter: Chapter; course: Course }[] {
  return courses.flatMap((c) =>
    c.chapters.flatMap((ch) => ch.lessons.map((l) => ({ lesson: l, chapter: ch, course: c }))),
  );
}
