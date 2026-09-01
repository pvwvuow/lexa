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
import { lessonJG93, lessonJG94, lessonJG95 } from './jaza-g-ch24';
import { lessonJG96, lessonJG97 } from './jaza-g-ch25';
import { lessonJG98, lessonJG99 } from './jaza-g-ch26';
import { lessonJG100, lessonJG101 } from './jaza-g-ch27';
import { lessonJG102, lessonJG103 } from './jaza-g-ch28';
import { lessonJG104, lessonJG105, lessonJG106 } from './jaza-g-ch29';
import { lessonJG107, lessonJG108 } from './jaza-g-ch30';
import { lessonJG109, lessonJG110, lessonJG111 } from './jaza-g-ch31';
import { lessonJG112, lessonJG113 } from './jaza-g-ch32';
import { lessonJG114, lessonJG115 } from './jaza-g-ch33';
import { lessonJG116, lessonJG117 } from './jaza-g-ch34';
import { lessonJG118, lessonJG119 } from './jaza-g-ch35';
import { lessonJG120, lessonJG121 } from './jaza-g-ch36';
import { lessonJG122, lessonJG123, lessonJG124, lessonJG125 } from './jaza-g-ch37';
import { lessonJG126, lessonJG127, lessonJG128, lessonJG129 } from './jaza-g-ch38';
import { lessonJG130, lessonJG131, lessonJG132, lessonJG133, lessonJG134 } from './jaza-g-ch39';
import { lessonJG135, lessonJG136 } from './jaza-g-ch40';
import { lessonJG137, lessonJG138, lessonJG139 } from './jaza-g-ch41';
import { lessonJG140, lessonJG141, lessonJG142, lessonJG143 } from './jaza-g-ch42';

// ─── تدریس جزا ۱ (کلیات جزا) — بازنویسی کامل صفحات ۱ تا ۴۰۰ جزوهٔ تدریس رایگان جزا ───
// مطابق جزوهٔ «تدریس جزا — احمد غفوری»: نقشهٔ قانون مجازات، عناصر سه‌گانهٔ جرم،
// قلمرو اجرای قوانین کیفری در مکان و زمان (مواد ۳ تا ۱۱)، رأی وحدت رویه،
// قانونی بودن مجازات‌ها، شخص حقوقی، درجات مادهٔ ۱۹، مجازات‌های تبعی/تکمیلی و اجرا،
// جزای نقدی و بازداشت بدل، محرومیت‌ها و انتشار حکم، تخفیف و معافیت،
// تعویق صدور حکم و تعلیق اجرا، نیمه‌آزادی/آزادی مشروط/نظارت الکترونیکی
// و مجازات‌های جایگزین حبس — همراه با کارگاه تست‌های ۱ تا ۳۵ خودِ جزوه.

export const tadrisJaza1: Course = {
  id: 'tadris-jaza-1',
  title: 'تدریس جزا ۱ — کلیات',
  tagline: 'جزوهٔ احمد غفوری؛ از کلیات جرم تا قصاص و قسامه و علم اجمالی، صفحه‌به‌صفحه تا ۴۵۰',
  description:
    'مطابق جزوهٔ تدریس رایگان جزا (احمد غفوری) — صفحات ۱ تا ۴۵۰: تقسیم‌بندی پنج‌گانهٔ قانون مجازات، اصل قانونی بودن و استثناهایش، عناصر مادی و روانی جرم، قلمرو اجرای قوانین در مکان و زمان، رأی وحدت رویه، قانونی بودن مجازات‌ها، درجات مادهٔ ۱۹، مجازات‌های تبعی و تکمیلی، احتساب بازداشت و بازداشت بدل از جزای نقدی، محرومیت‌ها و انتشار حکم، تخفیف و معافیت از کیفر، تعویق صدور حکم و تعلیق اجرا، نیمه‌آزادی و آزادی مشروط و نظارت الکترونیکی و مجازات‌های جایگزین حبس، احکام تکمیلی و اجرای جایگزین (مواد ۷۴ تا ۸۷)، اطفال و نوجوانان (مواد ۸۸ تا ۹۵)، عفو و نسخ و گذشت شاکی (مواد ۹۶ تا ۱۰۴)، مرور زمان کامل (مواد ۱۰۵ تا ۱۱۳)، توبه (مواد ۱۱۴ تا ۱۱۹)، قاعدهٔ درأ (مواد ۱۲۰ و ۱۲۱)، جرایم ناتمام (مواد ۱۲۲ و ۱۲۳) و شرکت و سبب و معاونت (مواد ۱۲۵ تا ۱۳۵)، مجازات معاون و معاونت‌های خاص (مواد ۱۲۷ تا ۱۳۸)، سردستگی (مادهٔ ۱۳۰)، اسباب متعدد (مواد ۵۳۵ و ۵۳۶) و تعدد و تکرار کامل (مواد ۱۳۱ تا ۱۳۷ و تکرار در جرایم حدی و تعزیرات)، شرایط و موانع مسئولیت کیفری (مواد ۱۴۰ تا ۱۴۵)، جنون (مواد ۱۴۹ و ۱۵۰ و ۵۰۳ ق.آ.د.ک)، اجبار و اکراه (مادهٔ ۱۵۱)، اضطرار و احسان (مواد ۱۵۲ و ۵۱۰)، مستی و اشتباه (مواد ۱۵۴ و ۳۰۷)، دفاع مشروع و علل موجهه (مواد ۱۵۵ تا ۱۵۸)، ادلهٔ اثبات (اقرار و شهادت و سوگند و علم قاضی — مواد ۱۶۰ تا ۲۱۵)، کلیات حدود و زنا و لواط و تفخیذ و مساحقه و قوادی و شرب خمر و محاربه و افساد فی‌الارض و بغی (مواد ۲۱۷ تا ۲۸۷) و باب قصاص از سه نوع جنایت و راهکار تشخیص (مواد ۲۸۹ تا ۲۹۲ و ۶۱۶) تا اشتباه در هدف و هویت و ترک فعل (نکته‌های ۲۶۷ تا ۲۷۷)، جنایات متعدد و سرایت به نفس (مواد ۲۹۳ تا ۳۰۰)، شرایط عمومی قصاص و درجات دین و مهدورالدم و جنین و مستی (مواد ۳۰۱ تا ۳۱۱) و قسامه و لوث و لوث مردد و علم اجمالی (مواد ۳۱۲ تا ۳۳۷) — همراه کارگاه کامل تست‌های ۱ تا ۷۶ خودِ جزوه و کوئیزهای متراکم تألیفی.\n\nدر پایان هر مبحث، «منبع و مستندات همان جلسه» (صفحات جزوه و مواد و رأی‌های مربوط) درج شده است.',
  icon: 'Gavel',
  accent: 'navy',
  origin: 'built-in',
  sourceLabel: 'جزوهٔ تدریس رایگان کلاس جزا — احمد غفوری (صفحات ۱–۴۵۰ از ۹۸۴)',
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
    {
      id: 'jg-c26', order: 26,
      title: 'تکرار جرم',
      subtitle: 'مواد ۱۳۶ و ۱۳۷: سه بار حد، نردبان سرقت حدی، شروط تعزیرات و کارگاه تست ۶۸ و ۶۹',
      lessons: [lessonJG93, lessonJG94, lessonJG95],
    },
    {
      id: 'jg-c27', order: 27,
      title: 'شرایط مسئولیت و جنون',
      subtitle: 'مواد ۱۴۰ تا ۱۴۵ و ۱۴۹ و ۱۵۰: عاقل و بالغ و مختار، علل رافع و موجهه، لایه‌های زمانی جنون و تست ۷۰',
      lessons: [lessonJG96, lessonJG97],
    },
    {
      id: 'jg-c28', order: 28,
      title: 'اجبار و اکراه',
      subtitle: 'مادهٔ ۱۵۱: چهار نوع اجبار، جدول مجازات اکراه‌کننده و مکره و کارگاه تست ۷۱ و ۷۲ و ۷۶',
      lessons: [lessonJG98, lessonJG99],
    },
    {
      id: 'jg-c29', order: 29,
      title: 'اضطرار و احسان',
      subtitle: 'مواد ۱۵۲ و ۵۱۰: شش شرط اضطرار، تفکیک احسان و اضطرار، خواب و بی‌هوشی و تست‌های ۷۳ تا ۷۵',
      lessons: [lessonJG100, lessonJG101],
    },
    {
      id: 'jg-c30', order: 30,
      title: 'مستی و اشتباه',
      subtitle: 'مواد ۱۵۴ و ۳۰۷: مسلوب‌الاختیاری کامل، مجازات هر دو جرم، جهل‌های چهارگانه و جدول تأثیر جهل',
      lessons: [lessonJG102, lessonJG103],
    },
    {
      id: 'jg-c31', order: 31,
      title: 'دفاع مشروع و علل موجهه',
      subtitle: 'مواد ۱۵۵ تا ۱۵۸: شروط دفاع و تهاجم، تصور غلط، امر آمر، تأدیب و ورزش و جراحی و رضایت',
      lessons: [lessonJG104, lessonJG105, lessonJG106],
    },
    {
      id: 'jg-c32', order: 32,
      title: 'ادلهٔ اثبات (۱)؛ اقرار و شهادت',
      subtitle: 'مواد ۱۶۰ تا ۱۷۶: ادلهٔ پنج‌گانه، نصاب‌های اقرار، انکار پس از اقرار و شرایط شاهد',
      lessons: [lessonJG107, lessonJG108],
    },
    {
      id: 'jg-c33', order: 33,
      title: 'ادلهٔ اثبات (۲)؛ شهادت، سوگند و علم قاضی',
      subtitle: 'مواد ۱۷۷ تا ۲۱۵: شهادت بر شهادت، نصاب‌های شهادت، سوگند مالی و تکلیف اشیا',
      lessons: [lessonJG109, lessonJG110, lessonJG111],
    },
    {
      id: 'jg-c34', order: 34,
      title: 'کلیات حدود و زنا',
      subtitle: 'مواد ۲۱۷ تا ۲۲۶: علم به حرمت شرعی، تبصره‌های دخول، چهار فرض اعدام و احصان',
      lessons: [lessonJG112, lessonJG113],
    },
    {
      id: 'jg-c35', order: 35,
      title: 'لواط، تفخیذ، مساحقه، قوادی، شرب و محاربه',
      subtitle: 'مواد ۲۳۲ تا ۲۸۴: جدول مجازات لواط، قوادی مرد و زن، ۸۰ شلاق شرب و چهار مجازات محاربه',
      lessons: [lessonJG114, lessonJG115],
    },
    {
      id: 'jg-c36', order: 36,
      title: 'افساد فی‌الارض، بغی و دروازهٔ قصاص',
      subtitle: 'مواد ۲۸۶ و ۲۸۷: گستردگی و آستانهٔ آثار، حبس درجهٔ ۴ بغی و عناصر جنایت',
      lessons: [lessonJG116, lessonJG117],
    },
    {
      id: 'jg-c37', order: 37,
      title: 'جنایت عمدی و شبه‌عمدی',
      subtitle: 'مواد ۲۹۰ و ۲۹۱ و ۶۱۶: بندهای الف و ب و پ، قاعدهٔ نوعاً، بار اثبات و مثال‌های ۳۷۳ تا ۳۹۶',
      lessons: [lessonJG118, lessonJG119],
    },
    {
      id: 'jg-c38', order: 38,
      title: 'خطای محض و راهکار تشخیص',
      subtitle: 'مادهٔ ۲۹۲: خواب و بی‌هوشی، سه حالت نکتهٔ ۲۶۴ و جدول طلایی صفحهٔ ۳۹۷ با مثال‌های ۴۰۸ تا ۴۱۵',
      lessons: [lessonJG120, lessonJG121],
    },
    {
      id: 'jg-c39', order: 39,
      title: 'اشتباه در هدف و هویت و ترک فعل',
      subtitle: 'مواد ۲۹۳ و ۲۹۴ و ۲۹۵: نکته‌های ۲۶۷ تا ۲۷۷، دو دیدگاه بیابان، تصور مهدورالدم و سه شرط تارک فعل',
      lessons: [lessonJG122, lessonJG123, lessonJG124, lessonJG125],
    },
    {
      id: 'jg-c40', order: 40,
      title: 'جنایات متعدد و سرایت به نفس',
      subtitle: 'مواد ۲۹۶ تا ۳۰۰: قصاص عضو با دیهٔ نفس، یک ضربه و ضربات متوالی و مصالحهٔ بر دیه',
      lessons: [lessonJG126, lessonJG127, lessonJG128, lessonJG129],
    },
    {
      id: 'jg-c41', order: 41,
      title: 'شرایط عمومی قصاص (۱)',
      subtitle: 'مواد ۳۰۱ تا ۳۰۵ و ۳۰۹: درجات دین، والدین، مجنون و نابالغ و مهدورالدمِ مادهٔ ۳۰۲',
      lessons: [lessonJG130, lessonJG131, lessonJG132, lessonJG133, lessonJG134],
    },
    {
      id: 'jg-c42', order: 42,
      title: 'مستی و تردید در اوصاف',
      subtitle: 'مواد ۳۰۷، ۳۰۸ و ۳۱۱: سه سناریوی مست، بار اثبات بلوغ/عقل و اسلام/جنون مجنی‌علیه',
      lessons: [lessonJG135, lessonJG136],
    },
    {
      id: 'jg-c43', order: 43,
      title: 'قسامه و سوگند (۱)؛ کلیات و اقامه',
      subtitle: 'مواد ۳۱۳ تا ۳۲۵: قسامه و لوث، مادهٔ ۲۰۸، مطالبه و اقامه و توکیل و ورثه',
      lessons: [lessonJG137, lessonJG138, lessonJG139],
    },
    {
      id: 'jg-c44', order: 44,
      title: 'قسامه (۲)؛ تعدد، لوث مردد و علم اجمالی',
      subtitle: 'مواد ۳۲۳ تا ۳۳۷: فاضل دیه، اقرار به انفراد، لوث مردد و جدول‌های علم اجمالی',
      lessons: [lessonJG140, lessonJG141, lessonJG142, lessonJG143],
    },
  ],
};
