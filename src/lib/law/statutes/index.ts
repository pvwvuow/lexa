// ─── ثبّت‌نامهٔ کتابخانهٔ قوانین + ابزارهای جستجو و پیمایش ────────────────────
import type { LawArticle, LawChapter, LawCode } from "./types";
import { MADANI } from "./madani";
import { TEJARAT } from "./tejarat";
import { MOJAZAT, DADRESI_MADANI, DADRESI_KEIFARI } from "./criminal-procedure";
import { ASASI, KAR, KHANEVADE } from "./public-labor";

export * from "./types";

/** همهٔ قانون‌های ثبت‌شدهٔ کتابخانه */
export const LAW_CODES: LawCode[] = [
  MADANI,
  TEJARAT,
  MOJAZAT,
  DADRESI_MADANI,
  DADRESI_KEIFARI,
  ASASI,
  KAR,
  KHANEVADE,
];

export function getLaw(id: string): LawCode | undefined {
  return LAW_CODES.find((l) => l.id === id);
}

/** شمار کل مواد یک قانون */
export function lawArticleCount(law: LawCode): number {
  return law.books.reduce(
    (n, b) => n + b.chapters.reduce((m, ch) => m + ch.articles.length, 0),
    0,
  );
}

/** پیمایش صاف همهٔ مواد با نشانگر مسیر — برای جستجوی سراسری */
export function flatLawArticles(
  law: LawCode,
): { article: LawArticle; book: string; chapter: string }[] {
  const out: { article: LawArticle; book: string; chapter: string }[] = [];
  for (const b of law.books)
    for (const ch of b.chapters)
      for (const a of ch.articles) out.push({ article: a, book: b.title, chapter: ch.title });
  return out;
}

/** همهٔ مواد همهٔ قانون‌ها — یک‌بار برای شاخص جستجو */
export function allLawArticles() {
  const out: { law: LawCode; article: LawArticle; book: string; chapter: string }[] = [];
  for (const law of LAW_CODES)
    for (const it of flatLawArticles(law)) out.push({ law, ...it });
  return out;
}
