import type { Chapter, Course } from '../types';
import { lessonJG1, lessonJG2, lessonJG3 } from './jaza-g-ch1';
import { lessonJG4, lessonJG5, lessonJG6, lessonJG7, lessonJG8 } from './jaza-g-ch2';
import { lessonJG9, lessonJG10, lessonJG11, lessonJG12 } from './jaza-g-ch3';
import { lessonJG13 } from './jaza-g-ch3b';
import { lessonJG14, lessonJG15 } from './jaza-g-ch4';

// ─── تدریس جزا ۱ (کلیات جزا) — بازنویسی کامل صفحات ۱ تا ۵۰ جزوهٔ تدریس رایگان جزا ───
// مطابق جزوهٔ «تدریس جزا — احمد غفوری»: نقشهٔ قانون مجازات، عناصر سه‌گانهٔ جرم،
// قلمرو اجرای قوانین کیفری در مکان (مواد ۳ تا ۹) و در زمان (مواد ۱۰ و ۱۱)
// همراه با کارگاه ۱۲ تستِ تشخیص صلاحیت خودِ جزوه.

export const tadrisJaza1: Course = {
  id: 'tadris-jaza-1',
  title: 'تدریس جزا ۱ — کلیات',
  tagline: 'جزوهٔ احمد غفوری؛ عناصر جرم و قلمرو قوانین کیفری، صفحه‌به‌صفحه',
  description:
    'مطابق جزوهٔ تدریس رایگان جزا (احمد غفوری) — صفحات ۱ تا ۵۰: تقسیم‌بندی پنج‌گانهٔ قانون مجازات، اصل قانونی بودن و سه نتیجهٔ آن، عناصر مادی و روانی جرم (سوءنیت عام و خاص، تقصیر، تقارن و تطابق)، قلمرو اجرای قوانین در مکان (چهار قاعده و پنج اصل صلاحیت، مواد ۳ تا ۹) و در زمان (عطف به ماسبق و اجرای فوری، مواد ۱۰ و ۱۱) — همراه کارگاه کامل ۱۲ تست تشخیص صلاحیت خودِ جزوه.',
  icon: 'Gavel',
  accent: 'navy',
  origin: 'built-in',
  sourceLabel: 'جزوهٔ تدریس رایگان کلاس جزا — احمد غفوری (صفحات ۱–۵۰ از ۹۸۴)',
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
  ],
};
