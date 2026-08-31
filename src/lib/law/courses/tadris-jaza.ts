import type { Chapter, Course } from '../types';
import { lessonJG1, lessonJG2, lessonJG3 } from './jaza-g-ch1';
import { lessonJG4, lessonJG5, lessonJG6, lessonJG7, lessonJG8 } from './jaza-g-ch2';
import { lessonJG9, lessonJG10, lessonJG11, lessonJG12 } from './jaza-g-ch3';
import { lessonJG13 } from './jaza-g-ch3b';
import { lessonJG14, lessonJG15 } from './jaza-g-ch4';
import { lessonJG16, lessonJG17, lessonJG18 } from './jaza-g-ch5';
import { lessonJG19, lessonJG20, lessonJG21, lessonJG22, lessonJG23 } from './jaza-g-ch6';
import { lessonJG24, lessonJG25, lessonJG26 } from './jaza-g-ch7';
import { lessonJG27, lessonJG28, lessonJG29 } from './jaza-g-ch8';
import { lessonJG30, lessonJG31, lessonJG32, lessonJG33 } from './jaza-g-ch9';
import { lessonJG34, lessonJG35, lessonJG36, lessonJG37 } from './jaza-g-ch10';
import { lessonJG38, lessonJG39, lessonJG40 } from './jaza-g-ch11';
import { lessonJG41, lessonJG42, lessonJG43, lessonJG44, lessonJG45 } from './jaza-g-ch12';
import { lessonJG46, lessonJG47, lessonJG48, lessonJG49 } from './jaza-g-ch13';
import { lessonJG50, lessonJG51, lessonJG52, lessonJG53, lessonJG54 } from './jaza-g-ch14';
import { lessonJG55, lessonJG56, lessonJG57, lessonJG58, lessonJG59, lessonJG60, lessonJG61 } from './jaza-g-ch15';
import { lessonJG62, lessonJG63, lessonJG64 } from './jaza-g-ch16';
import { lessonJG65, lessonJG66, lessonJG67 } from './jaza-g-ch17';
import { lessonJG68, lessonJG69, lessonJG70 } from './jaza-g-ch18';
import { lessonJG71, lessonJG72, lessonJG73, lessonJG74, lessonJG75 } from './jaza-g-ch19';
import { lessonJG76, lessonJG77, lessonJG78, lessonJG79 } from './jaza-g-ch20';
import { lessonJG80, lessonJG81 } from './jaza-g-ch21';
import { lessonJG82, lessonJG83, lessonJG84, lessonJG85, lessonJG86, lessonJG87, lessonJG88 } from './jaza-g-ch22';
import { lessonJG89, lessonJG90, lessonJG91, lessonJG92 } from './jaza-g-ch23';

// ─── تدریس جزا ۱ (کلیات جزا) — بازنویسی کامل صفحات ۱ تا ۳۰۰ جزوهٔ تدریس رایگان جزا ───
// مطابق جزوهٔ «تدریس جزا — احمد غفوری»: نقشهٔ قانون مجازات، عناصر سه‌گانهٔ جرم،
// قلمرو اجرای قوانین کیفری در مکان و زمان (مواد ۳ تا ۱۱)، رأی وحدت رویه،
// قانونی بودن مجازات‌ها، شخص حقوقی، درجات مادهٔ ۱۹، مجازات‌های تبعی/تکمیلی و اجرا،
// جزای نقدی و بازداشت بدل، محرومیت‌ها و انتشار حکم، تخفیف و معافیت،
// تعویق صدور حکم و تعلیق اجرا، نیمه‌آزادی/آزادی مشروط/نظارت الکترونیکی
// و مجازات‌های جایگزین حبس — همراه با کارگاه تست‌های ۱ تا ۳۵ خودِ جزوه.

export const tadrisJaza1: Course = {
  id: 'tadris-jaza-1',
  title: 'تدریس جزا ۱ — کلیات',
  tagline: 'جزوهٔ احمد غفوری؛ از کلیات جرم تا تعدد جرم و جرایم حدی، صفحه‌به‌صفحه تا ۳۰۰',
  description:
    'مطابق جزوهٔ تدریس رایگان جزا (احمد غفوری) — صفحات ۱ تا ۲۵۰: تقسیم‌بندی پنج‌گانهٔ قانون مجازات، اصل قانونی بودن و استثناهایش، عناصر مادی و روانی جرم، قلمرو اجرای قوانین در مکان و زمان، رأی وحدت رویه، قانونی بودن مجازات‌ها، درجات مادهٔ ۱۹، مجازات‌های تبعی و تکمیلی، احتساب بازداشت و بازداشت بدل از جزای نقدی، محرومیت‌ها و انتشار حکم، تخفیف و معافیت از کیفر، تعویق صدور حکم و تعلیق اجرا، نیمه‌آزادی و آزادی مشروط و نظارت الکترونیکی و مجازات‌های جایگزین حبس، احکام تکمیلی و اجرای جایگزین (مواد ۷۴ تا ۸۷)، اطفال و نوجوانان (مواد ۸۸ تا ۹۵)، عفو و نسخ و گذشت شاکی (مواد ۹۶ تا ۱۰۴)، مرور زمان کامل (مواد ۱۰۵ تا ۱۱۳)، توبه (مواد ۱۱۴ تا ۱۱۹)، قاعدهٔ درأ (مواد ۱۲۰ و ۱۲۱)، جرایم ناتمام (مواد ۱۲۲ و ۱۲۳) و شرکت و سبب و معاونت (مواد ۱۲۵ تا ۱۳۵)، مجازات معاون و معاونت‌های خاص (مواد ۱۲۷ تا ۱۳۸)، سردستگی (مادهٔ ۱۳۰)، اسباب متعدد (مواد ۵۳۵ و ۵۳۶) و تعدد و تکرار کامل (مواد ۱۳۱ تا ۱۳۵ و تعدد در جرایم حدی و قصاص) — همراه کارگاه کامل تست‌های ۱ تا ۶۷ خودِ جزوه.\n\nدر پایان هر مبحث، «منبع و مستندات همان جلسه» (صفحات جزوه و مواد و رأی‌های مربوط) درج شده است.',
  icon: 'Gavel',
  accent: 'navy',
  origin: 'built-in',
  sourceLabel: 'جزوهٔ تدریس رایگان کلاس جزا — احمد غفوری (صفحات ۱–۳۰۰ از ۹۸۴)',
  chapters: [
    {
      id: 'jg-c1', order: 1,
      title: 'کلیات قانون و عنصر قانونی',
      subtitle: 'نقشهٔ پنج‌گانهٔ قانون مجازات، اصل قانونی بودن و استثناهای آن',
      lessons: [lessonJG1, lessonJG2, lessonJG3],
    },
    {
      id: 'jg-c2', order: 2,
      title: 'عناصر مادی و روانی جرم',
      subtitle: 'ماهیت رفتار، مطلق و مقید، سوءنیت عام و خاص، تقصیر، تقارن و تطابق',
      lessons: [lessonJG4, lessonJG5, lessonJG6, lessonJG7, lessonJG8],
    },
    {
      id: 'jg-c3', order: 3,
      title: 'قلمرو اجرای قوانین در مکان',
      subtitle: 'چهار قاعده و پنج اصل صلاحیت (مواد ۳ تا ۹) + کارگاه ۱۲ تست',
      lessons: [lessonJG9, lessonJG10, lessonJG11, lessonJG12, lessonJG13],
    },
    {
      id: 'jg-c4', order: 4,
      title: 'قلمرو اجرای قوانین در زمان',
      subtitle: 'عطف به ماسبق، اجرای فوری و حکم قطعی (مواد ۱۰ و ۱۱)',
      lessons: [lessonJG14, lessonJG15],
    },
    {
      id: 'jg-c5', order: 5,
      title: 'ادامهٔ قلمرو زمان؛ وحدت رویه و ماهیت جرم',
      subtitle: 'حقوق متهم و مرور زمان، قانون حاکم بر رفتار، رأی وحدت رویه + تست‌های ۱۳ تا ۱۵',
      lessons: [lessonJG16, lessonJG17, lessonJG18],
    },
    {
      id: 'jg-c6', order: 6,
      title: 'فصل چهارم جزوه؛ قانونی بودن مجازات‌ها',
      subtitle: 'مواد ۱۲ تا ۲۲: مسئولیت مجری و قاضی، شخص حقوقی، تفکیک‌های طلایی و درجات مادهٔ ۱۹',
      lessons: [lessonJG19, lessonJG20, lessonJG21, lessonJG22, lessonJG23],
    },
    {
      id: 'jg-c7', order: 7,
      title: 'مجازات‌های تبعی، تکمیلی و اجرا',
      subtitle: 'مواد ۲۳ تا ۲۸: تکمیلی و تبعی، حقوق اجتماعی، احتساب بازداشت + کارگاه تست‌های ۲۱ تا ۳۱',
      lessons: [lessonJG24, lessonJG25, lessonJG26],
    },
    {
      id: 'jg-c8', order: 8,
      title: 'احتساب بازداشت، جزای نقدی و بازداشت بدل',
      subtitle: 'ماده‌های ۵۱۵ و ۵۱۶ و ۵۲۹ ق.آ.د.ک و مواد ۲۸ و ۲۹ ق.م.ا؛ مثال‌های ۸۶ تا ۹۷',
      lessons: [lessonJG27, lessonJG28],
    },
    {
      id: 'jg-c9', order: 9,
      title: 'محرومیت‌ها و انتشار حکم محکومیت',
      subtitle: 'مواد ۳۰ تا ۳۶: منع شغل و رانندگی و چک و سلاح و خروج، اخراج بیگانگان، انتشار حکم',
      lessons: [lessonJG29],
    },
    {
      id: 'jg-c10', order: 10,
      title: 'تخفیف و معافیت از مجازات',
      subtitle: 'مواد ۳۷ تا ۳۹ + مادهٔ ۳۲۷ اصلاحی ۹۹؛ نکته‌های ۶۲ تا ۷۲ و کارگاه تست‌های ۳۱ تا ۳۳',
      lessons: [lessonJG30, lessonJG31, lessonJG32, lessonJG33],
    },
    {
      id: 'jg-c11', order: 11,
      title: 'تعویق صدور حکم و تعلیق اجرای مجازات',
      subtitle: 'مواد ۴۰ تا ۵۵ و ۵۵۲ ق.آ.د.ک؛ مادهٔ ۴۷ و نکته‌های ۷۸ تا ۸۴ + کارگاه تست‌های ۳۴ و ۳۵',
      lessons: [lessonJG34, lessonJG35, lessonJG36, lessonJG37],
    },
    {
      id: 'jg-c12', order: 12,
      title: 'نیمه‌آزادی، آزادی مشروط و نظارت الکترونیکی',
      subtitle: 'مواد ۵۶ تا ۶۳؛ مثال‌های ۱۱۹ تا ۱۲۴ و نکتهٔ ۸۵ (ملاک مجازات قضایی)',
      lessons: [lessonJG38],
    },
    {
      id: 'jg-c13', order: 13,
      title: 'مجازات‌های جایگزین حبس',
      subtitle: 'مواد ۶۴ تا ۷۵: جدول الزامی/اختیاری/ممنوع، مادهٔ ۶۶ و سابقهٔ پنج‌ساله، مثال‌های ۱۲۵ تا ۱۳۹',
      lessons: [lessonJG39, lessonJG40],
    },
    {
      id: 'jg-c14', order: 14,
      title: 'احکام تکمیلی جایگزین حبس',
      subtitle: 'کسر مجازات‌ها و مواد ۷۴ تا ۸۷: قاضی اجرای احکام، جدول تخلف، دورهٔ مراقبت و خدمات عمومی و جزای نقدی',
      lessons: [lessonJG41, lessonJG42, lessonJG43, lessonJG44, lessonJG45],
    },
    {
      id: 'jg-c15', order: 15,
      title: 'اطفال و نوجوانان',
      subtitle: 'مواد ۸۸ تا ۹۵: بندهای مادهٔ ۸۸، جدول سه‌گانهٔ سنی، مادهٔ ۸۹ درجه‌محور و تجدیدنظر و تخفیف‌ها',
      lessons: [lessonJG46, lessonJG47, lessonJG48, lessonJG49],
    },
    {
      id: 'jg-c16', order: 16,
      title: 'عفو، نسخ و گذشت شاکی؛ آغاز مرور زمان',
      subtitle: 'مواد ۹۶ تا ۱۰۴ و شروع مادهٔ ۱۰۵: شش تفاوت عفوها، فهرست قابل گذشت‌ها، نصاب‌ها و رأی وحدت رویهٔ ۸۲۰',
      lessons: [lessonJG50, lessonJG51, lessonJG52, lessonJG53, lessonJG54],
    },
    {
      id: 'jg-c17', order: 17,
      title: 'مرور زمان (ادامه و تکمیل)',
      subtitle: 'مواد ۱۰۵ تا ۱۱۳: چهار مبدأ، قواعد محاسبه، قابل گذشت‌ها و نصاب‌های جرایم اقتصادی',
      lessons: [lessonJG55, lessonJG56, lessonJG57, lessonJG58, lessonJG59, lessonJG60, lessonJG61],
    },
    {
      id: 'jg-c18', order: 18,
      title: 'توبه و قاعدهٔ درأ',
      subtitle: 'مواد ۱۱۴ تا ۱۲۱: توبه در حدی‌ها و تعزیری‌ها، احراز و تظاهر، و دو مسیر برائت',
      lessons: [lessonJG62, lessonJG63, lessonJG64],
    },
    {
      id: 'jg-c19', order: 19,
      title: 'جرایم ناتمام',
      subtitle: 'مواد ۱۲۲ و ۱۲۳: نردبان چهارمرحله‌ای، شروع به جرم، جرم محال و کارگاه تست ۴۲ تا ۵۱',
      lessons: [lessonJG65, lessonJG66, lessonJG67],
    },
    {
      id: 'jg-c20', order: 20,
      title: 'شرکت، سبب و معاونت',
      subtitle: 'مواد ۱۲۵ تا ۱۳۵ و ۴۹۴/۵۰۶/۵۲۶: نسبت جرم، مجازات شرکا، نصاب کل و شش شرط معاونت',
      lessons: [lessonJG68, lessonJG69, lessonJG70],
    },
    {
      id: 'jg-c21', order: 21,
      title: 'مجازات معاون و معاونت‌های خاص',
      subtitle: 'مواد ۱۲۷ تا ۱۳۸: مادهٔ ۱۲۷ و تبصره‌ها، ممسک و دیده‌بان، اسیدپاشی و قاچاق، صغیر و مجنون',
      lessons: [lessonJG71, lessonJG72, lessonJG73, lessonJG74, lessonJG75],
    },
    {
      id: 'jg-c22', order: 22,
      title: 'جهات، سردستگی و اسباب متعدد',
      subtitle: 'مادهٔ ۱۳۰ و ۵۳۵ و ۵۳۶: جهات شخصی و عینی، فرمول مجازات سردسته، چاه و سنگ و نظریه‌های مسئولیت',
      lessons: [lessonJG76, lessonJG77, lessonJG78, lessonJG79],
    },
    {
      id: 'jg-c23', order: 23,
      title: 'کارگاه تست ۵۲ تا ۶۲',
      subtitle: 'تست‌های آزمون‌های رسمی جزوه: اسباب متعدد، معاونت، شرکت غیرعمدی، سردستگی و تحریک مجنون',
      lessons: [lessonJG80, lessonJG81],
    },
    {
      id: 'jg-c24', order: 24,
      title: 'تعدد جرم در جرایم تعزیری',
      subtitle: 'مواد ۱۳۱ تا ۱۳۴: تعدد معنوی و مادی، مجازات اشد، عنوان خاص، فرمول‌های بند ب و پ و ج و ت',
      lessons: [lessonJG82, lessonJG83, lessonJG84, lessonJG85, lessonJG86, lessonJG87, lessonJG88],
    },
    {
      id: 'jg-c25', order: 25,
      title: 'کارگاه تست تعدد و جرایم حدی',
      subtitle: 'تست‌های ۶۳ تا ۶۷ + مادهٔ ۱۳۲ و تبصره‌ها، قذف، مواد ۱۳۳ و ۱۳۵ و ترتیب اجرا (نکته‌های ۱۹۸ تا ۲۰۲)',
      lessons: [lessonJG89, lessonJG90, lessonJG91, lessonJG92],
    },
  ],
};
