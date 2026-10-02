// ─── موتور وظایف هوش مصنوعی (مشترک بین سرور و کلاینت/APK) ────────────────────
// سرور (/api/ai) و حالت اندروید (فراخوانی مستقیم از کلاینت با کلید کاربر)
// هر دو از همین منطق استفاده می‌کنند تا رفتار یکسان بماند.
import { buildSystem, LESSON_JSON_SPEC, lessonContextBlock } from './prompts';
import { dispatch, extractJson, PERSIAN_FAIL, type AiConf } from './providers-lite';

export interface AiTaskBody {
  task: 'free' | 'generate_lesson' | 'gen_quiz' | 'case_feedback' | 'outline_import';
  mode?: string;
  question?: string;
  modeDirective?: string;      // جهت رفتار خاص مثل «ساده‌تر توضیح بده»
  context?: Record<string, unknown>;
  ai?: AiConf;
  content?: string;            // ورودی خام برای outline_import / case_feedback
  n?: number;
}

export type DispatchFn = (conf: AiConf, system: string, user: string, tempOverride?: number) => Promise<string>;

/** صافی کیفیت تست: فقط سؤالات سالم با پاسخ معتبر و گزینه‌های غیرتکراری */
function sanitizeQuiz(quiz: unknown[]): unknown[] {
  return (quiz ?? []).filter((raw) => {
    const q = raw as { q?: unknown; options?: unknown; answer?: unknown; explanation?: unknown };
    if (typeof q.q !== 'string' || !q.q.trim()) return false;
    if (!Array.isArray(q.options) || q.options.length < 3) return false;
    if (typeof q.answer !== 'string' || !['a', 'b', 'c', 'd'].includes(q.answer)) return false;
    const opts = q.options as { key?: unknown; text?: unknown }[];
    if (!opts.some((o) => String(o?.key ?? '') === q.answer)) return false;
    if (opts.some((o) => typeof o?.text !== 'string' || !o.text.trim())) return false;
    if (typeof q.explanation !== 'string' || !q.explanation.trim()) return false;
    const texts = new Set(opts.map((o) => (o.text as string).trim()));
    if (texts.size !== opts.length) return false;
    return true;
  });
}

/** اجرای یک وظیفهٔ AI — خروجی: شیء پاسخ (بدون پوشش HTTP)
 *  سرور: dispatch کامل (با استاد داخلی) را پاس می‌دهد؛ کلاینت: پیش‌فرض سبک */
export async function runAiTask(body: AiTaskBody, dispatchFn: DispatchFn = dispatch): Promise<Record<string, unknown>> {
  const ai = body.ai ?? {};
  const ctx = body.context ?? {};

  switch (body.task) {

    case 'free': {
      const system = buildSystem(body.mode ?? 'QA');
      const directive = body.modeDirective ? `\n\n⚠️ دستور ویژه: ${body.modeDirective}` : '';
      const user =
        `${body.question ?? ''}${directive}${lessonContextBlock(ctx as never)}`;
      const text = await dispatchFn(ai, system, user);
      return { text };
    }

    case 'generate_lesson': {
      const spec = LESSON_JSON_SPEC;
      const slice = String(body.content ?? '').slice(0, 9000);
      const user = `بر اساس منبع زیر، جلسهٔ «${body.question}» در دورهٔ «${String(
        (ctx as Record<string, unknown>).courseTitle ?? '',
      )}» را کاملاً تدریس‌شده تولید کن.\n\n${spec}\n\n--- منبع آموزشی ---\n${slice}`;
      for (let attempt = 0; attempt < 2; attempt++) {
        const raw = await dispatchFn(ai, buildSystem('TEACH'), user);
        const parsed = extractJson<{ title: string; sections: never[]; quiz: never[] }>(raw);
        if (parsed && Array.isArray(parsed.sections) && parsed.sections.length >= 5)
          return { lesson: parsed };
      }
      throw new AiTaskError('تحلیل ساختار جلسه ناموفق بود.');
    }

    case 'gen_quiz': {
      const source = String(body.content ?? '').slice(0, 8000);
      const n = Math.min(Math.max(body.n ?? 5, 3), 10);
      const user = `از منبع زیر ${n} سؤال تستی چهارگزینه‌ای دانشگاهی (تراز آزمون وکالت) بساز و فقط JSON برگردان:
{"quiz":[{"q":string,"options":[{"key":"a|b|c|d","text":string}],"answer":"a|b|c|d","explanation":string,"topic":string}]}

⚠️ قواعد کیفیت (اجباری):
- هر سؤال فقط از متن منبع طراحی شود؛ موضوع خارج از منبع ممنوع.
- فقط یک گزینه صحیحِ قطعی باشد؛ سه گزینهٔ دیگر کاملاً نادرست و قابل‌تفکیک، نه دوپهلو یا شبیه صحیح.
- سؤال مفهومی/تحلیلی بساز؛ عین‌جملهٔ حفظی بدون تغییر ممنوع.
- تشریح هر سؤال با استناد به متن منبع باشد؛ شمارهٔ ماده فقط اگر عیناً در منبع آمده، وگرنه بدون شماره.
- موضوعات بین سؤال‌ها متنوع باشد.

--- منبع ---
${source}
${lessonContextBlock(ctx as never)}`;
      for (let attempt = 0; attempt < 2; attempt++) {
        const raw = await dispatchFn(ai, buildSystem('QUIZ'), user, 0.3);
        const parsed = extractJson<{ quiz: unknown[] }>(raw);
        const clean = parsed?.quiz ? sanitizeQuiz(parsed.quiz) : [];
        if (clean.length) return { quiz: clean };
      }
      throw new AiTaskError('تولید تست ناموفق بود.');
    }

    case 'case_feedback': {
      const system = buildSystem('CASE_STUDY');
      const user = `${body.question ?? ''}\n\nفقط JSON با این شکل برگردان:
{"strengths":string[],"gaps":string[],"verdict":string,"suggestedOutline":string[]}
(verdict دو-three جمله؛ suggestedOutline نقشهٔ پاسخ استاندارد.)
${lessonContextBlock(ctx as never)}`;
      const raw = await dispatchFn(ai, system, user);
      const parsed = extractJson<{ strengths: string[]; gaps: string[]; verdict: string; suggestedOutline: string[] }>(raw);
      if (parsed?.strengths) return parsed as unknown as Record<string, unknown>;
      return {
        verdict: raw.slice(0, 1500), strengths: [], gaps: [], suggestedOutline: [],
      };
    }

    case 'outline_import': {
      const text = String(body.content ?? '').slice(0, 28_000);
      const user = `متن استخراج‌شدهٔ زیر از یک کتاب/جزوهٔ حقوقی است. نقشهٔ دوره تحصیلی آن را استخراج کن؛ فقط JSON:
{"courseTitle":string,"chapters":[{"title":string,"sessions":[{"title":string,"keywords":[string]}]}]}
حداکثر ۸ فصل و هر فصل ۲ تا ۵ جلسه. keywords واژه‌های مشخص (اسامی ماده‌ها/اصطلاحات) هستند که بعداً متنِ هر جلسه را با آن‌ها پیدا می‌کنیم؛ پس بین جلسات متمایز باشند.\n\n${text}`;
      const raw = await dispatchFn(ai, buildSystem('TEACH'), user);
      const parsed = extractJson<{ courseTitle: string; chapters: { title: string; sessions: { title: string; keywords: string[] }[] }[] }>(raw);
      if (parsed?.chapters?.length) return parsed as unknown as Record<string, unknown>;
      throw new AiTaskError('تحلیل نقشهٔ کتاب ناموفق بود.');
    }

    default:
      throw new AiTaskError('task ناشناخته.');
  }
}

/** خطای وظیفهٔ AI با پیام فارسی — سرور ۵۰۲ و کلاینت مستقیم نمایش می‌دهد */
export class AiTaskError extends Error {}

export { PERSIAN_FAIL };
