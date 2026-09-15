/* ─── بسته‌های آزمون — دفترچه‌های تستی و تشریحی ─────────────────────────────
 * هر بسته یک «دفترچهٔ نمونه» است: تستی (۳۰-۴۰ سؤال یکجا با تایمر) یا تشریحی
 * (پرسش + پاسخ نمونه + کلیدواژه‌ها). محتوا در باندل است؛ آفلاین هم هست و
 * نیازی به سرور ندارد. دفترچه‌های بعدی فقط به همین پوشه اضافه می‌شوند.
 * ─────────────────────────────────────────────────────────────────────── */

export interface ExamMCQ {
  q: string;
  options: string[]; // ۴ گزینه
  answer: number; // شاخص گزینهٔ صحیح (۰ مبنا)
  why: string; // توضیح/تشریح پاسخ
  topic?: string;
}

export interface ExamDescQ {
  q: string;
  keywords?: string[]; // کلیدواژه‌های پاسخ
  answer: string; // پاسخ نمونه
  topic?: string;
}

export type ExamPackKind = "mcq" | "descriptive";

interface ExamPackBase {
  id: string;
  title: string;
  /** نوع آزمون — دسته‌بندی اصلی کتابخانه (وکالت، قضاوت، ارشد، تشریحی و…) */
  exam: string;
  examSlug: string;
  branch: string; // شاخهٔ حقوقی: مدنی / جزا / آیین دادرسی و…
  description: string;
  minutes: number; // زمان پیشنهادی برگزاری (دقیقه)
  /** نمرهٔ قبولی پیشنهادی — ۰ تا ۱۰۰ */
  passMark?: number;
}

export interface McqPack extends ExamPackBase {
  kind: "mcq";
  questions: ExamMCQ[];
}

export interface DescPack extends ExamPackBase {
  kind: "descriptive";
  questions: ExamDescQ[];
}

export type ExamPack = McqPack | DescPack;

import { mcqCivil } from "./exam-packs/mcq-civil";
import { mcqPenal } from "./exam-packs/mcq-penal";
import { mcqProcedure } from "./exam-packs/mcq-procedure";
import { descCivil } from "./exam-packs/desc-civil";
import { descPenal } from "./exam-packs/desc-penal";
import { descProcedure } from "./exam-packs/desc-procedure";
import { mcqJazaGhafoori } from "./exam-packs/mcq-jaza-ghafoori";
import { descJazaGhafoori } from "./exam-packs/desc-jaza-ghafoori";
import { mcqJazaGhafoori2 } from "./exam-packs/mcq-jaza-ghafoori-2";
import { descJazaGhafoori2 } from "./exam-packs/desc-jaza-ghafoori-2";
import { mcqJazaGhafoori3 } from "./exam-packs/mcq-jaza-ghafoori-3";
import { descJazaGhafoori3 } from "./exam-packs/desc-jaza-ghafoori-3";
// دفترچه‌های واقعی آزمون وکالت (اسکودا) — استخراج از منابع ایرانی (اختبار)
import { vokalat1388Madani } from "./exam-packs/mcq-vokalat-1388-madani";
import { vokalat1388Dadresi } from "./exam-packs/mcq-vokalat-1388-dadresi";
import { vokalat1388Tejarat } from "./exam-packs/mcq-vokalat-1388-tejarat";
import { vokalat1388Osool } from "./exam-packs/mcq-vokalat-1388-osool";
import { vokalat1388Jaza } from "./exam-packs/mcq-vokalat-1388-jaza";
import { vokalat1388Keyfri } from "./exam-packs/mcq-vokalat-1388-keyfri";
import { vokalatMadani1399 } from "./exam-packs/mcq-vokalat-madani-1399";
import { vokalatOsool98 } from "./exam-packs/mcq-vokalat-osool-98";

/** اسلاگ آزمون وکالت — برای هاب اختصاصی */
export const VOKALAT_SLUG = "vokalat";

export const examPacks: ExamPack[] = [
  // ═══ دفترچه‌های واقعی آزمون وکالت (اسکودا) — سوالات اصیل با کلید رسمی/تحلیلی ═══
  {
    id: "pack-vokalat-1388-madani",
    title: "دفترچهٔ واقعی ۱۳۸۸ — حقوق مدنی",
    exam: "آزمون وکالت",
    examSlug: "vokalat",
    branch: "حقوق مدنی",
    description:
      "سوالات ۱ تا ۲۰ درس حقوق مدنی دفترچهٔ رسمی آزمون وکالت ۱۳۸۸ اسکودا (کانون وکلای دادگستری): رهن، بیع کلی، خیارات، اجاره مال مشاع، حواله، ضمان، ارث، شرط نتیجه و علم اجمالی — با کلید رسمی و پاسخ تشریحی ماده‌به‌ماده.",
    minutes: 30,
    passMark: 60,
    kind: "mcq",
    questions: vokalat1388Madani,
  },
  {
    id: "pack-vokalat-1388-dadresi",
    title: "دفترچهٔ واقعی ۱۳۸۸ — آیین دادرسی مدنی",
    exam: "آزمون وکالت",
    examSlug: "vokalat",
    branch: "آیین دادرسی مدنی",
    description:
      "سوالات ۲۱ تا ۴۰ درس آیین دادرسی مدنی دفترچهٔ رسمی آزمون وکالت ۱۳۸۸: ایرادات، اعتراض ثالث، دستور موقت، تأمین خواسته، جلب ثالث، کارشناسی، واخواهی و اعاده دادرسی — با کلید رسمی و تشریح مواد ق.آ.د.م.",
    minutes: 30,
    passMark: 60,
    kind: "mcq",
    questions: vokalat1388Dadresi,
  },
  {
    id: "pack-vokalat-1388-tejarat",
    title: "دفترچهٔ واقعی ۱۳۸۸ — حقوق تجارت",
    exam: "آزمون وکالت",
    examSlug: "vokalat",
    branch: "حقوق تجارت",
    description:
      "سوالات ۴۱ تا ۶۰ درس حقوق تجارت دفترچهٔ رسمی آزمون وکالت ۱۳۸۸: چک و سفته و برات، دفاتر تجاری، شرکت سهامی، ورشکستگی و قرارداد ارفاقی، قائم‌مقام تجارتی و حمل و نقل — با کلید رسمی و تشریح مواد ق.ت.",
    minutes: 30,
    passMark: 60,
    kind: "mcq",
    questions: vokalat1388Tejarat,
  },
  {
    id: "pack-vokalat-1388-osool",
    title: "دفترچهٔ واقعی ۱۳۸۸ — اصول استنباط",
    exam: "آزمون وکالت",
    examSlug: "vokalat",
    branch: "اصول فقه",
    description:
      "سوالات ۶۱ تا ۸۰ درس اصول استنباط حقوق اسلامی دفترچهٔ رسمی آزمون وکالت ۱۳۸۸: مخصص و تخصیص، حکم واقعی اولی و ثانوی، اصالة عدم و الصحه، مفهوم غایت و علم اجمالی — با کلید رسمی و تحلیل اصولی.",
    minutes: 30,
    passMark: 60,
    kind: "mcq",
    questions: vokalat1388Osool,
  },
  {
    id: "pack-vokalat-1388-jaza",
    title: "دفترچهٔ واقعی ۱۳۸۸ — حقوق جزا",
    exam: "آزمون وکالت",
    examSlug: "vokalat",
    branch: "حقوق جزا",
    description:
      "سوالات ۸۱ تا ۱۰۰ درس جزای عمومی و اختصاصی دفترچهٔ رسمی آزمون وکالت ۱۳۸۸: شبه‌عمد، معاذیر تخفیف، تعلیق، اختلاس، معامله معارض، ربا، سرقت مشدد و تخلیه اطلاعاتی — با کلید رسمی و تشریح مواد ق.م.ا.",
    minutes: 30,
    passMark: 60,
    kind: "mcq",
    questions: vokalat1388Jaza,
  },
  {
    id: "pack-vokalat-1388-keyfri",
    title: "دفترچهٔ واقعی ۱۳۸۸ — آیین دادرسی کیفری",
    exam: "آزمون وکالت",
    examSlug: "vokalat",
    branch: "آیین دادرسی کیفری",
    description:
      "سوالات درس آیین دادرسی کیفری دفترچهٔ رسمی آزمون وکالت ۱۳۸۸ (سوال ۱۱۲ که رسماً حذف شد، لحاظ نگردیده): قرارهای تأمین، صلاحیت دادگاه‌ها، هیئت منصفه، مرور زمان و تعقیب — با کلید رسمی و تشریح.",
    minutes: 28,
    passMark: 60,
    kind: "mcq",
    questions: vokalat1388Keyfri,
  },
  {
    id: "pack-vokalat-madani-1399",
    title: "دفترچهٔ واقعی ۱۳۹۹ — حقوق مدنی",
    exam: "آزمون وکالت",
    examSlug: "vokalat",
    branch: "حقوق مدنی",
    description:
      "۲۰ سوال درس حقوق مدنی آزمون وکالت ۱۳۹۹ (اسکودا): بیمه اجباری، پیش‌فروش ساختمان، رد ترکه، تعارض اسناد، حق ارتفاق، طلاق بیماری و حق مولف — کلید بر اساس تحلیل مواد قانونی تنظیم شده است.",
    minutes: 30,
    passMark: 60,
    kind: "mcq",
    questions: vokalatMadani1399,
  },
  {
    id: "pack-vokalat-osool-98",
    title: "دفترچهٔ واقعی ۱۳۹۸ — اصول استنباط (تحلیلی)",
    exam: "آزمون وکالت",
    examSlug: "vokalat",
    branch: "اصول فقه",
    description:
      "سوالات درس اصول استنباط آزمون وکالت ۱۳۹۸ اسکودا همراه با پاسخ‌های تحلیلی — تزاحم، قیاس اولویت، شهرت، علم اجمالی، قرائن معتبره و شک در حیات — تحلیل به سبک درسنامه.",
    minutes: 25,
    passMark: 60,
    kind: "mcq",
    questions: vokalatOsool98,
  },
  {
    id: "pack-tadris-jaza-mcq3",
    title: "دفترچهٔ تستی — تدریس جزا ۳ (صفحات ۱۰۱ تا ۱۵۰)",
    exam: "تدریس جزا (غفوری)",
    examSlug: "tadris-jaza",
    branch: "حقوق جزا",
    description:
      "دفترچهٔ تستی برگرفته از صفحات ۱۰۱ تا ۱۵۰ جزوهٔ تدریس جزا احمد غفوری: احتساب بازداشت و بازداشت بدل از جزای نقدی (مواد ۲۸ و ۲۹ ق.م.ا و ۵۱۵ تا ۵۲۹ ق.آ.د.ک)، محرومیت‌ها و انتشار حکم (مواد ۳۰ تا ۳۶)، تخفیف و معافیت (مواد ۳۷ تا ۳۹ و مادهٔ ۳۲۷ اصلاحی)، تعویق صدور حکم و تعلیق اجرا (مواد ۴۰ تا ۵۵)، نیمه‌آزادی و آزادی مشروط و نظارت الکترونیکی (مواد ۵۶ تا ۶۳) و مجازات‌های جایگزین حبس (مواد ۶۴ تا ۷۵) — با پاسخ‌نامهٔ تشریحی.",
    minutes: 50,
    passMark: 70,
    kind: "mcq",
    questions: mcqJazaGhafoori3,
  },
  {
    id: "pack-tadris-jaza-mcq2",
    title: "دفترچهٔ تستی — تدریس جزا ۲ (صفحات ۵۱ تا ۱۰۰)",
    exam: "تدریس جزا (غفوری)",
    examSlug: "tadris-jaza",
    branch: "حقوق جزا",
    description:
      "دفترچهٔ تستی برگرفته از صفحات ۵۱ تا ۱۰۰ جزوهٔ تدریس جزا احمد غفوری: رأی وحدت رویه، قانون حاکم بر رفتار، قانونی بودن اجرا (مواد ۴۸۵ و ۴۸۶)، مسئولیت شخص حقوقی، تفکیک‌های طلایی، درجات مادهٔ ۱۹، مجازات‌های تبعی و تکمیلی و نحوهٔ اجرا — با پاسخ‌نامهٔ تشریحی.",
    minutes: 35,
    passMark: 70,
    kind: "mcq",
    questions: mcqJazaGhafoori2,
  },
  {
    id: "pack-tadris-jaza-mcq",
    title: "دفترچهٔ تستی — تدریس جزا (کلیات جزا)",
    exam: "تدریس جزا (غفوری)",
    examSlug: "tadris-jaza",
    branch: "حقوق جزا",
    description:
      "دفترچهٔ تستی جامع برگرفته از جزوهٔ تدریس جزا احمد غفوری (صفحات ۱ تا ۵۰): کلیات قانون مجازات، اصل قانونی بودن، عناصر مادی و روانی جرم، پنج اصل صلاحیت (مواد ۳ تا ۹) و قلمرو زمان (مواد ۱۰ و ۱۱) — با پاسخ‌نامهٔ تشریحی سؤال‌به‌سؤال.",
    minutes: 40,
    passMark: 70,
    kind: "mcq",
    questions: mcqJazaGhafoori,
  },
  {
    id: "pack-vokalat-madani",
    title: "دفترچهٔ تستی نمونه — حقوق مدنی",
    exam: "آزمون وکالت",
    examSlug: "vokalat",
    branch: "حقوق مدنی",
    description:
      "دفترچهٔ تستی چهارگزینه‌ای از عقود، بیع، اجاره، خیارات، ضمان، غصب، شفعه، وصیت، ارث و نکاح — به سبک آزمون وکالت با پاسخ‌نامهٔ تشریحی سؤال‌به‌سؤال.",
    minutes: 25,
    passMark: 70,
    kind: "mcq",
    questions: mcqCivil,
  },
  {
    id: "pack-vokalat-jaza",
    title: "دفترچهٔ تستی نمونه — حقوق جزا",
    exam: "آزمون وکالت",
    examSlug: "vokalat",
    branch: "حقوق جزا",
    description:
      "دفترچهٔ تستی از مسئولیت کیفری، قتل‌ها، دیه، قواعد فقهی، دفاع مشروع، سرقت، کلاهبرداری، خیانت در امانت، جعل و محاربه — با توضیح هر پاسخ.",
    minutes: 25,
    passMark: 70,
    kind: "mcq",
    questions: mcqPenal,
  },
  {
    id: "pack-vokalat-dadresi",
    title: "دفترچهٔ تستی نمونه — آیین دادرسی مدنی",
    exam: "آزمون وکالت",
    examSlug: "vokalat",
    branch: "آیین دادرسی مدنی",
    description:
      "دفترچهٔ تستی از صلاحیت دادگاه‌ها، دادخواست، ابلاغ، وکالت در دعاوی، دلایل، تجدیدنظر، واخواهی، فرجام و اجرای احکام — با پاسخ‌نامهٔ تشریحی.",
    minutes: 20,
    passMark: 70,
    kind: "mcq",
    questions: mcqProcedure,
  },
  {
    id: "pack-desc-madani",
    title: "دفترچهٔ تشریحی — حقوق مدنی",
    exam: "نمونه سوالات تشریحی",
    examSlug: "tashrihi",
    branch: "حقوق مدنی",
    description:
      "۱۲ پرسش تشریحی از شرایط اعتبار عقد، بیع، خیارات، غبن، غصب، شفعه، وصیت، ارث و مسئولیت مدنی — با پاسخ نمونهٔ مکتوب و کلیدواژه‌های نمره‌آور.",
    minutes: 60,
    kind: "descriptive",
    questions: descCivil,
  },
  {
    id: "pack-desc-jaza",
    title: "دفترچهٔ تشریحی — حقوق جزا",
    exam: "نمونه سوالات تشریحی",
    examSlug: "tashrihi",
    branch: "حقوق جزا",
    description:
      "۱۰ پرسش تشریحی از سن مسئولیت، انواع قتل، دفاع مشروع، شروع به جرم و معاونت، جرایم مالی، حد سرقت، دیه و قواعد فقهی — با پاسخ نمونهٔ منظم.",
    minutes: 50,
    kind: "descriptive",
    questions: descPenal,
  },
  {
    id: "pack-desc-dadresi",
    title: "دفترچهٔ تشریحی — آیین دادرسی مدنی",
    exam: "نمونه سوالات تشریحی",
    examSlug: "tashrihi",
    branch: "آیین دادرسی مدنی",
    description:
      "۱۰ پرسش تشریحی از صلاحیت دادگاه‌ها، دادخواست، دعوای متقابل، ادلهٔ اثبات، تجدیدنظر، واخواهی، فرجام و اجرای احکام — با پاسخ نمونهٔ کامل.",
    minutes: 50,
    kind: "descriptive",
    questions: descProcedure,
  },
  {
    id: "pack-tadris-jaza-desc",
    title: "دفترچهٔ تشریحی — تدریس جزا (کلیات جزا)",
    exam: "نمونه سوالات تشریحی",
    examSlug: "tashrihi",
    branch: "حقوق جزا",
    description:
      "۲۹ پرسش تشریحی برگرفته از جزوهٔ تدریس جزا احمد غفوری (صفحات ۱ تا ۵۰): اصل قانونی بودن و استثناهایش، عناصر مادی و روانی جرم، تقارن و تطابق، چهار قاعده و پنج اصل صلاحیت، جدول قواعد، الگوریتم تشخیص صلاحیت و قلمرو زمان — با پاسخ نمونهٔ کامل و کلیدواژه‌های نمره‌آور.",
    minutes: 90,
    kind: "descriptive",
    questions: descJazaGhafoori,
  },
  {
    id: "pack-tadris-jaza-desc2",
    title: "دفترچهٔ تشریحی — تدریس جزا ۲ (صفحات ۵۱ تا ۱۰۰)",
    exam: "نمونه سوالات تشریحی",
    examSlug: "tashrihi",
    branch: "حقوق جزا",
    description:
      "۱۹ پرسش تشریحی برگرفته از صفحات ۵۱ تا ۱۰۰ جزوهٔ تدریس جزا احمد غفوری: رأی وحدت رویه، قانون حاکم بر رفتار، ماده‌های ۴۸۵ و ۴۸۶، شخص حقوقی (مواد ۱۴۳ و ۲۰ تا ۲۲)، درجات مادهٔ ۱۹، مجازات تبعی و محاسبهٔ محرومیت و احتساب بازداشت — با پاسخ نمونهٔ کامل و کلیدواژه‌های نمره‌آور.",
    minutes: 80,
    kind: "descriptive",
    questions: descJazaGhafoori2,
  },
  {
    id: "pack-tadris-jaza-desc3",
    title: "دفترچهٔ تشریحی — تدریس جزا ۳ (صفحات ۱۰۱ تا ۱۵۰)",
    exam: "نمونه سوالات تشریحی",
    examSlug: "tashrihi",
    branch: "حقوق جزا",
    description:
      "۲۱ پرسش تشریحی برگرفته از صفحات ۱۰۱ تا ۱۵۰ جزوهٔ تدریس جزا احمد غفوری: احتساب بازداشت و بازداشت بدل از جزای نقدی، محرومیت‌ها و انتشار حکم، تخفیف و معافیت (مادهٔ ۳۲۷ اصلاحی و مادهٔ ۳۹)، تعویق صدور حکم و تعلیق اجرا و مادهٔ ۴۷، نیمه‌آزادی و آزادی مشروط و نظارت الکترونیکی و مجازات‌های جایگزین حبس — با پاسخ نمونهٔ کامل و کلیدواژه‌های نمره‌آور.",
    minutes: 85,
    kind: "descriptive",
    questions: descJazaGhafoori3,
  },
];

/** یک بسته با شناسه */
export function getExamPack(id: string): ExamPack | null {
  return examPacks.find((p) => p.id === id) ?? null;
}

/** انواع آزمون موجود — به ترتیب بسته‌ها */
export function examTypes(): { slug: string; label: string; count: number }[] {
  const map = new Map<string, { slug: string; label: string; count: number }>();
  for (const p of examPacks) {
    const cur = map.get(p.examSlug);
    if (cur) cur.count += 1;
    else map.set(p.examSlug, { slug: p.examSlug, label: p.exam, count: 1 });
  }
  return [...map.values()];
}

/** تعداد کل سؤال‌های یک بسته */
export function packQuestionCount(p: ExamPack): number {
  return p.questions.length;
}
