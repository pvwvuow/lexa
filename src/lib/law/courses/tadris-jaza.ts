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

// ─── تدریس جزا ۱ (کلیات جزا) — بازنویسی کامل صفحات ۱ تا ۱۵۰ جزوهٔ تدریس رایگان جزا ───
// مطابق جزوهٔ «تدریس جزا — احمد غفوری»: نقشهٔ قانون مجازات، عناصر سه‌گانهٔ جرم،
// قلمرو اجرای قوانین کیفری در مکان و زمان (مواد ۳ تا ۱۱)، رأی وحدت رویه،
// قانونی بودن مجازات‌ها، شخص حقوقی، درجات مادهٔ ۱۹، مجازات‌های تبعی/تکمیلی و اجرا،
// جزای نقدی و بازداشت بدل، محرومیت‌ها و انتشار حکم، تخفیف و معافیت،
// تعویق صدور حکم و تعلیق اجرا، نیمه‌آزادی/آزادی مشروط/نظارت الکترونیکی
// و مجازات‌های جایگزین حبس — همراه با کارگاه تست‌های ۱ تا ۳۵ خودِ جزوه.

export const tadrisJaza1: Course = {
  id: 'tadris-jaza-1',
  title: 'تدریس جزا ۱ — کلیات',
  tagline: 'جزوهٔ احمد غفوری؛ از کلیات جرم تا تعلیق و مجازات‌های جایگزین، صفحه‌به‌صفحه',
  description:
    'مطابق جزوهٔ تدریس رایگان جزا (احمد غفوری) — صفحات ۱ تا ۱۵۰: تقسیم‌بندی پنج‌گانهٔ قانون مجازات، اصل قانونی بودن و استثناهایش، عناصر مادی و روانی جرم، قلمرو اجرای قوانین در مکان و زمان، رأی وحدت رویه، قانونی بودن مجازات‌ها، درجات مادهٔ ۱۹، مجازات‌های تبعی و تکمیلی، احتساب بازداشت و بازداشت بدل از جزای نقدی، محرومیت‌ها و انتشار حکم، تخفیف و معافیت از کیفر، تعویق صدور حکم و تعلیق اجرا، نیمه‌آزادی و آزادی مشروط و نظارت الکترونیکی و مجازات‌های جایگزین حبس — همراه کارگاه کامل تست‌های ۱ تا ۳۵ خودِ جزوه.\n\nدر پایان هر مبحث، «منبع و مستندات همان جلسه» (صفحات جزوه و مواد و رأی‌های مربوط) درج شده است.',
  icon: 'Gavel',
  accent: 'navy',
  origin: 'built-in',
  sourceLabel: 'جزوهٔ تدریس رایگان کلاس جزا — احمد غفوری (صفحات ۱–۱۵۰ از ۹۸۴)',
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
  ],
};
