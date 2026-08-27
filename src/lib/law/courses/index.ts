import type { Chapter, Course, Lesson } from '../types';
import { lessonM1L1 } from './madani1-l1';
import { lessonM1L2 } from './madani1-l2';
import { lessonM1L3 } from './madani1-l3';
import { lessonM1L4 } from './madani1-l4';
import { lessonM1L5 } from './madani1-l5';
import { lessonM1L6 } from './madani1-l6';
import { lessonM1L7 } from './madani1-l7';
import { lessonM1L8 } from './madani1-l8';
import { lessonM1L9 } from './madani1-l9';
import { lessonM1L10 } from './madani1-l10';
import { lessonM1L11 } from './madani1-l11';
import { lessonT11 } from './tejarat3-t11';
import { lessonT12 } from './tejarat3-t12';
import { lessonT21 } from './tejarat3-t21';
import { lessonT22 } from './tejarat3-t22';
import { lessonT23 } from './tejarat3-t23';
import { lessonT24 } from './tejarat3-t24';
import { lessonT31 } from './tejarat3-t31';
import { lessonT32 } from './tejarat3-t32';
import { lessonT33 } from './tejarat3-t33';
import { lessonT41 } from './tejarat3-t41';
import { lessonT42 } from './tejarat3-t42';
import { lessonT51 } from './tejarat3-t51';
import { lessonM7L1 } from './madani7-l1';
import { lessonM7L2 } from './madani7-l2';
import { lessonM7L3 } from './madani7-l3';
import { lessonM7L4 } from './madani7-l4';
import { lessonM7L5 } from './madani7-l5';
import { lessonM7L6 } from './madani7-l6';
import { lessonM7L7 } from './madani7-l7';
import { lessonM7L8 } from './madani7-l8';
import { lessonM7L9 } from './madani7-l9';
import { lessonM7L10 } from './madani7-l10';
import { lessonM7L11 } from './madani7-l11';
import { lessonM7L12 } from './madani7-l12';
import { lessonM7L13 } from './madani7-l13';
import { lessonM7L14 } from './madani7-l14';
import { lessonM4L11 } from './madani4-l11';
import { lessonM4L12 } from './madani4-l12';
import { lessonM4L21 } from './madani4-l21';
import { lessonM4L22 } from './madani4-l22';
import { lessonM4L31 } from './madani4-l31';
import { lessonM4L32 } from './madani4-l32';
import { lessonM4L41 } from './madani4-l41';
import { lessonM4L42 } from './madani4-l42';
import { lessonM4L51 } from './madani4-l51';
import { lessonM4L52 } from './madani4-l52';
import { lessonM4L61 } from './madani4-l61';
import { lessonM4L62 } from './madani4-l62';
import { lessonM4L63 } from './madani4-l63';
import { lessonM4L64 } from './madani4-l64';
import { lessonM4L71 } from './madani4-l71';
import { lessonM4L72 } from './madani4-l72';
import { lessonM4L73 } from './madani4-l73';
import { lessonM4L81 } from './madani4-l81';
import { lessonM4L82 } from './madani4-l82';

const L = (...l: Lesson[]) => l;
const CH = (id: string, order: number, title: string, subtitle: string, lessons: Lesson[]): Chapter => ({
  id, order, title, subtitle, lessons,
});

// ─── حقوق مدنی ۱ (بازنویسی کامل مطابق جزوه دکتر ملاکریمی «اشخاص و حمایت از محجورین») ───
export const madani1: Course = {
  id: 'madani-1',
  title: 'حقوق مدنی ۱',
  tagline: 'اشخاص و حمایت از محجورین؛ سه فصلِ جزوه، صفحه به صفحه',
  description:
    'مطابق جزوه حقوق مدنی ۱ دکتر امید ملاکریمی (ویرایش ۱۴۰۲): فصل اشخاص (آغاز و پایان شخصیت، جنین، هویت، تابعیت، اقامتگاه، شخص حقوقی)، فصل حجر (صغیر، مجنون، عدم رشد و حکم نسبی/مطلق) و فصل قیمومت (نصب قیم، وظایف و بازرس).',
  icon: 'Scale',
  accent: 'navy',
  origin: 'built-in',
  sourceLabel: 'جزوه دکتر ملاکریمی – mollakarimi.ir – ویرایش ۱۴۰۲',
  chapters: [
    CH('m-c1', 1,
      'اشخاص',
      'شخصیت انسانی از تولد تا مرگ، جنین، هویت، تابعیت، اقامتگاه و شخص حقوقی',
      L(lessonM1L1, lessonM1L2, lessonM1L3, lessonM1L4, lessonM1L5)),
    CH('m-c2', 2,
      'حجر',
      'وقتی قانون دستِ اعمال حقوقی را می‌بندد: صغر، جنون و عدم رشد',
      L(lessonM1L6, lessonM1L7, lessonM1L8)),
    CH('m-c4', 3,
      'قیمومت',
      'سرپرست قانونی محجورین: نصب قیم، تشریفات، وظایف و حساب‌دهی',
      L(lessonM1L9, lessonM1L10, lessonM1L11)),
  ],
};

// ─── حقوق تجارت ۳ (بازنویسی کامل مطابق جزوه دکتر ملاکریمی) ──────────────────
export const tejarat3: Course = {
  id: 'tejarat-3',
  title: 'حقوق تجارت ۳',
  tagline: 'اسناد تجاری؛ برات، فته و چك — کلام به کلام از جزوه',
  description:
    'مطابق جزوه حقوق تجارت ۳ دکتر امید ملاکریمی (ویرایش ۱۴۰۲): کلیات اسناد تجاری و اصل ایرادات، چک با همه جزئیات (شرایط، انواع، صیاد، ضمانت اجراهای کیفری/ثبتی/حقوقی و جرائم)، برات با شرایط هشتگانه و گردش (ظهرنویسی، قبول، وعده، واخواست)، سفته با مسئولانش و مرور طلایی تفکیک سه سند.',
  icon: 'FileText',
  accent: 'bronze',
  origin: 'built-in',
  sourceLabel: 'جزوه دکتر ملاکریمی – mollakarimi.ir – ویرایش ۱۴۰۲',
  chapters: [
    {
      id: 't-c1', order: 1,
      title: 'کلیات اسناد تجاری',
      subtitle: 'چهار مزیت ویژه، وظایف دارندگان و سپر ایرادات',
      lessons: L(lessonT11, lessonT12),
    },
    {
      id: 't-c2', order: 2,
      title: 'چك',
      subtitle: 'شرایط اساسی، انواع، صیاد و ضمانت اجراهای سه‌گانه + جرائم',
      lessons: L(lessonT21, lessonT22, lessonT23, lessonT24),
    },
    {
      id: 't-c3', order: 3,
      title: 'برات',
      subtitle: 'شرایط هشتگانه، ظهرنویسی، قبول نهی، وعده و واخواست',
      lessons: L(lessonT31, lessonT32, lessonT33),
    },
    {
      id: 't-c4', order: 4,
      title: 'فتھ (سفته)',
      subtitle: 'کارکردها، شرایط صورت سفته، مسئولان و مواعد رجوع',
      lessons: L(lessonT41, lessonT42),
    },
    {
      id: 't-c5', order: 5,
      title: 'مرور نهایی',
      subtitle: 'تفکیک طلایی سه سند در یک جدول',
      lessons: L(lessonT51),
    },
  ],
};

// ─── حقوق مدنی ۷ (جدید — عقود معیّن قسمت دوم از جزوه دکتر ملاکریمی) ─────────
export const madani7: Course = {
  id: 'madani-7',
  title: 'حقوق مدنی ۷',
  tagline: 'عقود معیّن (قسمت دوم)؛ از مزارعه تا هبه',
  description:
    'مطابق جزوه حقوق مدنی ۷ دکتر امید ملاکریمی (مواد ۵۱۸ تا ۸۰۷ قانون مدنی): عقود مشارکتی (مزارعه، مساقات، مضاربه، شرکت)، ودیعه و عاریه و بحث امانت، قمار و گروبندی، عقد وکالت، عقد ضمان و حواله (انتقال ذمه) و عقد کفالت، رهن و هبه.',
  icon: 'Handshake',
  accent: 'bronze',
  origin: 'built-in',
  sourceLabel: 'جزوه دکتر ملاکریمی – mollakarimi.ir – مواد ۵۱۸–۸۰۷ ق.م',
  chapters: [
    {
      id: 'm7-c1', order: 1,
      title: 'عقود مشارکتی',
      subtitle: 'مزارعه، مساقات، مضاربه و احکام شرکت',
      lessons: L(lessonM7L1, lessonM7L2, lessonM7L3, lessonM7L4),
    },
    {
      id: 'm7-c2', order: 2,
      title: 'ودیه، عاریه و قمار',
      subtitle: 'سنگرهای امانت و دو واگذاری مخوف',
      lessons: L(lessonM7L5, lessonM7L6),
    },
    {
      id: 'm7-c3', order: 3,
      title: 'عقد وکالت',
      subtitle: 'نیابت حرفه‌ای: ماهیت، حدود اختیارات و پایان آن',
      lessons: L(lessonM7L7, lessonM7L8),
    },
    {
      id: 'm7-c4', order: 4,
      title: 'انتقال ذمه و وثایق',
      subtitle: 'ضمان، حواله، کفالت، رهن و هبه',
      lessons: L(lessonM7L9, lessonM7L10, lessonM7L11, lessonM7L12, lessonM7L13, lessonM7L14),
    },
  ],
};

// ─── حقوق مدنی ۴ (مبتنی بر جزوه دکتر ملاکریمی) ─────────────────────────────
export const madani4: Course = {
  id: 'madani-4',
  title: 'حقوق مدنی ۴',
  tagline: 'الزامات خارج از قرارداد؛ نقشۀ کامل مسؤولیت مدنی از جزوه',
  description:
    'مطابق جزوه حقوق مدنی ۴ دکتر امید ملاکریمی (ویرایش ۱۴۰۲): کلیات مسؤولیت مدنی، نظریه‌های مبانی، سه رکنِ ضرر/رفتار زیانبار/سببیت، هفت عنوان ضمان قهری (ایفای ناروا تا استیفاء)، مسؤولیت‌های خاص کارفرما و دولت و رانندگان، و مرور قوانین مسؤولیت مدنی ۱۳۳۹، بیمه اجباری ۱۳۹۵ و موجبات ضمان ق.م.ا.',
  icon: 'BookOpenCheck',
  accent: 'green',
  origin: 'built-in',
  sourceLabel: 'جزوه دکتر ملاکریمی – mollakarimi.ir – ویرایش ۱۴۰۲',
  chapters: [
    {
      id: 'm4-c1', order: 1,
      title: 'کلیات مسؤولیت مدنی',
      subtitle: 'ضمان قهری چیست و مرزش با اخلاق و جرم کجاست؟',
      lessons: L(lessonM4L11, lessonM4L12),
    },
    {
      id: 'm4-c2', order: 2,
      title: 'مبانی و نظریه‌ها',
      subtitle: 'چرا مسؤولیم؟ از تقصیر سنتی تا نظریه‌های بی‌تقصیر',
      lessons: L(lessonM4L21, lessonM4L22),
    },
    {
      id: 'm4-c3', order: 3,
      title: 'ارکان سه‌گانهٔ مسؤولیت',
      subtitle: 'ضرر، رفتار زیانبار و رابطهٔ سببیت؛ همراه عوامل منتفی',
      lessons: L(lessonM4L31, lessonM4L32, lessonM4L41, lessonM4L42, lessonM4L51, lessonM4L52),
    },
    {
      id: 'm4-c4', order: 4,
      title: 'عناوین ضمان قهری در قانون مدنی',
      subtitle: 'ایفای ناروا، ادارهٔ فضولی، غصب و تعاقب ایادی، اتلاف و تسبیب',
      lessons: L(lessonM4L61, lessonM4L62, lessonM4L63, lessonM4L64),
    },
    {
      id: 'm4-c5', order: 5,
      title: 'مسؤولیت‌های خاص',
      subtitle: 'استیفاء، حوادث رانندگی، کارفرما، دولت و عرضه‌کنندگان',
      lessons: L(lessonM4L71, lessonM4L72, lessonM4L73),
    },
    {
      id: 'm4-c6', order: 6,
      title: 'قوانین الحاقی و مرور نهایی',
      subtitle: 'ق.م.م ۱۳۳۹ و فصل ششم موجبات ضمان ق.م.ا',
      lessons: L(lessonM4L81, lessonM4L82),
    },
  ],
};

export const builtinCourses: Course[] = [madani1, madani4, tejarat3, madani7];
