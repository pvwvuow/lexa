// ─── تبدیل سکشن‌های جلسه به متن زمینه برای «استاد حقوقی هوشمند» ────────────────
// هدف: استاد فقط بر اساس محتوای واقعی تدریس‌شده پاسخ بدهد، نه حافظهٔ خودش؛
// و برای استناد، فقط شماره‌های همین فهرست را مجاز بداند (ضد جعل ماده).

import type { LessonSection } from "./types";

export interface LessonGround {
  /** متن کامل بخش‌های دیده‌شده (متن + بولت + جدول + مواد) */
  text: string;
  /** فهرست مواد قانونی معتبرِ همین جلسه؛ تنها مرجع مجاز ارجاع شماره‌ای */
  lawRegistry: string[];
}

const TYPE_FA: Record<string, string> = {
  intro: "مقدمه",
  concept: "تعریف و مفهوم",
  law: "مستند قانونی",
  notes: "نکات کلیدی",
  example: "مثال کاربردی",
  compare: "مقایسه",
  summary: "جمع‌بندی",
  question: "سؤال تعاملی",
};

export function lessonToContextText(sections: LessonSection[], maxLen = 6000): LessonGround {
  const lawRegistry: string[] = [];
  const parts: string[] = [];

  for (const s of sections) {
    const head = `## ${s.title ?? TYPE_FA[s.type] ?? s.type}`;
    const chunks: string[] = [head];

    if (s.body?.trim()) chunks.push(s.body.trim());

    if (s.bullets?.length) chunks.push(s.bullets.map((b) => `- ${b}`).join("\n"));

    if (s.law?.length) {
      for (const l of s.law) {
        const src = l.source && l.source !== "قانون مدنی" ? ` — ${l.source}` : " — قانون مدنی";
        chunks.push(`📜 مادهٔ ${l.no}${src}: ${l.text}`);
        lawRegistry.push(`مادهٔ ${l.no}${src}`);
      }
    }

    if (s.table) {
      chunks.push(
        [s.table.headers.join(" | "), ...s.table.rows.map((r) => r.join(" | "))].join("\n"),
      );
    }

    if (s.questionText) {
      chunks.push(`سؤال: ${s.questionText}${s.suggestedAnswer ? `\nپاسخ پیشنهادی: ${s.suggestedAnswer}` : ""}`);
    }

    parts.push(chunks.join("\n"));
  }

  return { text: parts.join("\n\n").slice(0, maxLen), lawRegistry };
}
