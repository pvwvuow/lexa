import { NextResponse } from 'next/server';
import { buildSystem, LESSON_JSON_SPEC, lessonContextBlock } from '@/lib/ai/prompts';
import { dispatch, extractJson, PERSIAN_FAIL, type AiConf } from '@/lib/ai/providers';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 120;

interface Body {
  task: 'free' | 'generate_lesson' | 'gen_quiz' | 'case_feedback' | 'outline_import';
  mode?: string;
  question?: string;
  modeDirective?: string;      // جهت رفتار خاص مثل «ساده‌تر توضیح بده»
  context?: Record<string, unknown>;
  ai?: AiConf;
  content?: string;            // ورودی خام برای outline_import / case_feedback
  n?: number;
}

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

const SECTION_TYPES = ['intro', 'concept', 'law', 'notes', 'example', 'compare', 'question', 'summary'] as const;

/** صافی ساختار جلسهٔ AI: هر type خارج از ۸ نوع شناخته‌شده → «concept» تا رندر درس هرگز نترکد */
function sanitizeLesson(raw: { title?: unknown; sections?: unknown; quiz?: unknown }) {
  const sections = (Array.isArray(raw.sections) ? raw.sections : []).map((s) => {
    const sec = (s ?? {}) as { type?: unknown; text?: unknown } & Record<string, unknown>;
    const type = SECTION_TYPES.includes(sec.type as (typeof SECTION_TYPES)[number])
      ? (sec.type as string)
      : 'concept';
    return { ...sec, type, text: typeof sec.text === 'string' ? sec.text : '' };
  });
  const quiz = Array.isArray(raw.quiz) ? sanitizeQuiz(raw.quiz) : [];
  return {
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : 'جلسهٔ تازه',
    sections,
    quiz,
  };
}

export async function POST(req: Request) {
  // موتور AI پرهزینه است — حداکثر ۳۰ فراخوانی در دقیقه از هر IP
  if (!rateLimit(req, "ai", 30, 60_000))
    return NextResponse.json({ error: 'تعداد درخواست‌ها زیاد است؛ چند لحظه صبر کنید.' }, { status: 429 });
  let body: Body;
  try { body = (await req.json()) as Body; }
  catch { return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 }); }

  // تولید کامل جلسه سنگین‌ترین کار AI است — سقف جداتری برای هر IP دارد
  if (body.task === 'generate_lesson' && !rateLimit(req, "ai-lesson", 8, 60_000))
    return NextResponse.json({ error: 'تولید جلسه محدود است؛ چند لحظه صبر کنید.' }, { status: 429 });

  const ai = body.ai ?? {};
  const ctx = body.context ?? {};

  try {
    switch (body.task) {

      case 'free': {
        const system = buildSystem(body.mode ?? 'QA');
        const directive = body.modeDirective ? `\n\n⚠️ دستور ویژه: ${body.modeDirective}` : '';
        const user =
          `${body.question ?? ''}${directive}${lessonContextBlock(ctx as never)}`;
        const text = await dispatch(ai, system, user);
        return NextResponse.json({ text });
      }

      case 'generate_lesson': {
        const spec = LESSON_JSON_SPEC;
        const slice = String(body.content ?? '').slice(0, 9000);
        const user = `بر اساس منبع زیر، جلسهٔ «${body.question}» در دورهٔ «${String(
          (ctx as Record<string, unknown>).courseTitle ?? '',
        )}» را کاملاً تدریس‌شده تولید کن.\n\n${spec}\n\n--- منبع آموزشی ---\n${slice}`;
        for (let attempt = 0; attempt < 2; attempt++) {
          const raw = await dispatch(ai, buildSystem('TEACH'), user);
          const parsed = extractJson<{ title?: unknown; sections?: unknown; quiz?: unknown }>(raw);
          const clean = parsed ? sanitizeLesson(parsed) : null;
          if (clean && clean.sections.length >= 5)
            return NextResponse.json({ lesson: clean });
        }
        return NextResponse.json({ error: 'تحلیل ساختار جلسه ناموفق بود.' }, { status: 502 });
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
          const raw = await dispatch(ai, buildSystem('QUIZ'), user, 0.3);
          const parsed = extractJson<{ quiz: unknown[] }>(raw);
          const clean = parsed?.quiz ? sanitizeQuiz(parsed.quiz) : [];
          if (clean.length) return NextResponse.json({ quiz: clean });
        }
        return NextResponse.json({ error: 'تولید تست ناموفق بود.' }, { status: 502 });
      }

      case 'case_feedback': {
        const system = buildSystem('CASE_STUDY');
        const user = `${body.question ?? ''}\n\nفقط JSON با این شکل برگردان:
{"strengths":string[],"gaps":string[],"verdict":string,"suggestedOutline":string[]}
(verdict دو-three جمله؛ suggestedOutline نقشهٔ پاسخ استاندارد.)
${lessonContextBlock(ctx as never)}`;
        const raw = await dispatch(ai, system, user);
        const parsed = extractJson<{ strengths: string[]; gaps: string[]; verdict: string; suggestedOutline: string[] }>(raw);
        if (parsed?.strengths) return NextResponse.json(parsed);
        return NextResponse.json({
          verdict: raw.slice(0, 1500), strengths: [], gaps: [], suggestedOutline: [],
        });
      }

      case 'outline_import': {
        const text = String(body.content ?? '').slice(0, 28_000);
        const user = `متن استخراج‌شدهٔ زیر از یک کتاب/جزوهٔ حقوقی است. نقشهٔ دوره تحصیلی آن را استخراج کن؛ فقط JSON:
{"courseTitle":string,"chapters":[{"title":string,"sessions":[{"title":string,"keywords":[string]}]}]}
حداکثر ۸ فصل و هر فصل ۲ تا ۵ جلسه. keywords واژه‌های مشخص (اسامی ماده‌ها/اصطلاحات) هستند که بعداً متنِ هر جلسه را با آن‌ها پیدا می‌کنیم؛ پس بین جلسات متمایز باشند.\n\n${text}`;
        const raw = await dispatch(ai, buildSystem('TEACH'), user);
        const parsed = extractJson<{ courseTitle: string; chapters: { title: string; sessions: { title: string; keywords: string[] }[] }[] }>(raw);
        if (parsed?.chapters?.length) return NextResponse.json(parsed);
        return NextResponse.json({ error: 'تحلیل نقشهٔ کتاب ناموفق بود.' }, { status: 502 });
      }

      default:
        return NextResponse.json({ error: 'task ناشناخته.' }, { status: 400 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[AI]', msg);
    return NextResponse.json({ error: `${PERSIAN_FAIL}\n(${msg.slice(0, 180)})` }, { status: 502 });
  }
}
