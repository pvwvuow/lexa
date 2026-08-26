import type { Chapter, Course, Lesson } from '../types';
import { chPersonality } from './madani1-a';
import { lessonCapacityIntro } from './madani1-l21-capacity';
import { lessonSafahat } from './madani1-l22-safahat';
import { lessonInsanityMinority } from './madani1-l23-jonoon-saghir';
import { lessonDomicile } from './madani1-l31-eqamatgah';
import { lessonLegalPersons } from './madani1-l32-shakhs-hoghoughi';
import { lessonProperty } from './madani1-l41-amval';
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

export const builtinCourses: Course[] = [madani1, madani4, tejarat3];
