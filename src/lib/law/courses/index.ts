import type { Chapter, Course, Lesson } from '../types';
import { chPersonality } from './madani1-a';
import { lessonCapacityIntro } from './madani1-l21-capacity';
import { lessonSafahat } from './madani1-l22-safahat';
import { lessonInsanityMinority } from './madani1-l23-jonoon-saghir';
import { lessonDomicile } from './madani1-l31-eqamatgah';
import { lessonLegalPersons } from './madani1-l32-shakhs-hoghoughi';
import { lessonProperty } from './madani1-l41-amval';
import { lessonT11 } from './tejarat3-t11';
import { lessonT12 } from './tejarat3-t12';
import { lessonT21 } from './tejarat3-t21';
import { lessonT22 } from './tejarat3-t22';
import { lessonT31 } from './tejarat3-t31';
import { lessonT32 } from './tejarat3-t32';
import { lessonT41 } from './tejarat3-t41';
import { lessonT51 } from './tejarat3-t51';

const L = (...l: Lesson[]) => l;
const CH = (id: string, order: number, title: string, subtitle: string, lessons: Lesson[]): Chapter => ({
  id, order, title, subtitle, lessons,
});

// ─── حقوق مدنی ۱ ─────────────────────────────────────────────────────────────
export const madani1: Course = {
  id: 'madani-1',
  title: 'حقوق مدنی ۱',
  tagline: 'از «شخص» تا «مال»؛ سنگ بنای حقوق مدنی',
  description:
    'در این درس مفاهیم پایه‌ای شخصیت، اهلیت، اقامتگاه، اشخاص حقوقی و اموال را با الگوی هشت‌بخشی استاد می‌آموزید؛ همراه مستندات دقیق قانون مدنی، مثال کاربردی و آزمون.',
  icon: 'Scale',
  accent: 'navy',
  origin: 'built-in',
  sourceLabel: 'طراحی مدرسه‌ای مطابق سرفصل کارشناسی حقوق',
  chapters: [
    chPersonality,
    {
      id: 'm-c2', order: 2,
      title: 'اهلیت',
      subtitle: 'بلوغ، عقل و حسن تدبیر؛ دژهای قانون برای اعمال حقوقی',
      lessons: L(lessonCapacityIntro, lessonSafahat, lessonInsanityMinority),
    },
    {
      id: 'm-c3', order: 3,
      title: 'اقامتگاه و اشخاص حقوقی',
      subtitle: 'نشانی ای که قانون به آن اعتماد میکند و سازمانهایی که انسان شدند',
      lessons: L(lessonDomicile, lessonLegalPersons),
    },
    {
      id: 'm-c4', order: 4,
      title: 'اموال',
      subtitle: 'مالیت، مقصودیت و تقسیم منقول/غیرمنقول',
      lessons: L(lessonProperty),
    },
  ],
};

// ─── حقوق تجارت ۳ (مبتنی بر جزوه دکتر ملاکریمی) ─────────────────────────────
export const tejarat3: Course = {
  id: 'tejarat-3',
  title: 'حقوق تجارت ۳',
  tagline: 'اسناد تجاری؛ برات، فته و چك — فصل به فصل از جزوه',
  description:
    'مطابق جزوه حقوق تجارت ۳ دکتر امید ملاکریمی (ویرایش ۱۴۰۲): کلیات اسناد تجاری، شرایط و ضمانت اجراهای چك (با سامانه صیاد)، برات و شرایط هشتگانه آن، مقررات حاکم بر سفته و مرور آزمونی تفکیک سه سند.',
  icon: 'FileText',
  accent: 'bronze',
  origin: 'built-in',
  sourceLabel: 'جزوه دکتر ملاکریمی – mollakarimi.ir – ویرایش ۱۴۰۲',
  chapters: [
    {
      id: 't-c1', order: 1,
      title: 'کلیات اسناد تجاری',
      subtitle: 'چهار مزیت ویژه و وظایف دارندگان',
      lessons: L(lessonT11, lessonT12),
    },
    {
      id: 't-c2', order: 2,
      title: 'چك',
      subtitle: 'شرایط اساسی، انواع، صیاد و ضمانت اجراهای سه‌گانه',
      lessons: L(lessonT21, lessonT22),
    },
    {
      id: 't-c3', order: 3,
      title: 'برات',
      subtitle: 'شرایط هشتگانه، قبول، واخواست و ظهرنویسی',
      lessons: L(lessonT31, lessonT32),
    },
    {
      id: 't-c4', order: 4,
      title: 'فتھ (سفته)',
      subtitle: 'کارکردها، شرایط صورت سفته و مسئولان',
      lessons: L(lessonT41),
    },
    {
      id: 't-c5', order: 5,
      title: 'مرور نهایی',
      subtitle: 'تفکیک طلایی سه سند در یک جدول',
      lessons: L(lessonT51),
    },
  ],
};

export const builtinCourses: Course[] = [madani1, tejarat3];
