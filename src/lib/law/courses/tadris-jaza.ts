import type { Chapter, Course } from '../types';
import { lessonJG1, lessonJG2, lessonJG3 } from './jaza-g-ch1';
import { lessonJG4, lessonJG5, lessonJG6, lessonJG7, lessonJG8 } from './jaza-g-ch2';
import { lessonJG9, lessonJG10, lessonJG11, lessonJG12 } from './jaza-g-ch3';
import { lessonJG13 } from './jaza-g-ch3b';
import { lessonJG14, lessonJG15 } from './jaza-g-ch4';
import { lessonJG16, lessonJG17, lessonJG18 } from './jaza-g-ch5';
import { lessonJG19, lessonJG20, lessonJG21, lessonJG22, lessonJG23 } from './jaza-g-ch6';
import { lessonJG24, lessonJG25, lessonJG26 } from './jaza-g-ch7';

// ─── تدریس جزا ۱ (کلیات جزا) — بازنویسی کامل صفحات ۱ تا ۱۰۰ جزوهٔ تدریس رایگان جزا ───
// مطابق جزوهٔ «تدریس جزا — احمد غفوری»: نقشهٔ قانون مجازات، عناصر سه‌گانهٔ جرم،
// قلمرو اجرای قوانین کیفری در مکان و زمان (مواد ۳ تا ۱۱)، رأی وحدت رویه،
// قانونی بودن مجازات‌ها، شخص حقوقی، درجات مادهٔ ۱۹، مجازات‌های تبعی/تکمیلی و اجرا
// همراه با کارگاه تست‌های ۱ تا ۳۱ خودِ جزوه.

export const tadrisJaza1: Course = {
  id: 'tadris-jaza-1',
  title: 'تدریس جزا ۱ — کلیات',
  tagline: 'جزوهٔ احمد غفوری؛ عناصر جرم، قلمرو قوانین و درجات مجازات، صفحه‌به‌صفحه',
  description:
    'مطابق جزوهٔ تدریس رایگان جزا (احمد غفوری) — صفحات ۱ تا ۱۰۰: تقسیم‌بندی پنج‌گانهٔ قانون مجازات، اصل قانونی بودن و استثناهایش، عناصر مادی و روانی جرم، قلمرو اجرای قوانین در مکان (مواد ۳ تا ۹) و زمان (مواد ۱۰ و ۱۱)، رأی وحدت رویه و قانون حاکم بر رفتار، فصل چهارم جزوه (قانونی بودن مجازات‌ها و دادرسی)، مسئولیت کیفری شخص حقوقی، تفکیک‌های طلایی مجازات‌ها، درجات مادهٔ ۱۹، مجازات‌های تبعی و تکمیلی و نحوهٔ اجرا — همراه کارگاه کامل تست‌های ۱ تا ۳۱ خودِ جزوه.',
  icon: 'Gavel',
  accent: 'navy',
  origin: 'built-in',
  sourceLabel: 'جزوهٔ تدریس رایگان کلاس جزا — احمد غفوری (صفحات ۱–۱۰۰ از ۹۸۴)',
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
  ],
};
