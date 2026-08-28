// ─── کتابخانهٔ قوانین کشور — ساختار داده و ثبّت‌نامه ──────────────────────────
// منبع گردآوری: سامانهٔ ملی قوانین و مقررات (qavanin.ir) و مرکز پژوهش‌های مجلس.
// متن مواد در برخی موارد گزیده/خلاصه‌بندی شده است؛ برای استناد رسمی به متن کامل
// در سامانهٔ ملی مراجعه شود. این کتابخانه صرفاً آموزشی است.

export interface LawArticle {
  no: string; // شماره ماده مثل "۱۰" یا "۳۱۰ اصلاحی"
  text: string;
  /** علامت‌گذاری متن گزیده‌شده (نه متن کامل مصوبه) */
  gist?: boolean;
}

export interface LawChapter {
  title: string;
  articles: LawArticle[];
}

export interface LawBook {
  title: string;
  chapters: LawChapter[];
}

export interface LawCode {
  id: string; // مثل "madani"
  title: string; // مثل "قانون مدنی"
  category: LawCategorySlug;
  icon: string; // نام آیکون lucide
  sourceLabel: string; // مرجع گردآوری
  metaLabel: string; // سال تصویب / آخرین اصلاح
  description: string;
  books: LawBook[];
  /** «ماده» یا «اصل» — برای قانون اساسی */
  articleWord?: string;
  /** پیوند منبع برای متن کامل */
  sourceUrl?: string;
  /** آیا متن کامل از data/laws-full.json تزریق شده است؟ */
  full?: boolean;
}

export const LAW_CATEGORIES = [
  { slug: "civil", label: "حقوق مدنی و خانواده" },
  { slug: "commercial", label: "تجاری" },
  { slug: "criminal", label: "کیفری" },
  { slug: "procedure", label: "آیین دادرسی" },
  { slug: "public", label: "اساسی و عمومی" },
  { slug: "labor", label: "کار و اجتماعی" },
] as const;

export type LawCategorySlug = (typeof LAW_CATEGORIES)[number]["slug"];

export function lawCategoryLabel(slug: string): string {
  return LAW_CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
}
