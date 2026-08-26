import { NextResponse } from 'next/server';
import { buildSystem, LESSON_JSON_SPEC, lessonContextBlock } from '@/lib/ai/prompts';

export const runtime = 'nodejs';
export const maxDuration = 120;

interface AiConf {
  provider?: 'builtin' | 'gemini' | 'openai';
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  temperature?: number;
}

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

// ─── پیاده‌سازی پروایدرها ────────────────────────────────────────────────────
async function callBuiltin(system: string, user: string): Promise<string> {
  const ZAI = (await import('z-ai-web-dev-sdk')).default;
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.4,
  });
  return completion.choices[0]?.message?.content ?? '';
}

async function callGemini(conf: AiConf, system: string, user: string): Promise<string> {
  const key = conf.apiKey!;
  const model = conf.model || 'gemini-2.0-flash';
  const base = conf.baseUrl?.replace(/\/$/, '') || 'https://generativelanguage.googleapis.com/v1beta';
  const res = await fetch(`${base}/models/${encodeURIComponent(model)}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: conf.temperature ?? 0.4 },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text: string =
    data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  if (!text) throw new Error('پاسخی از Gemini دریافت نشد.');
  return text;
}

async function callOpenAiCompatible(conf: AiConf, system: string, user: string): Promise<string> {
  const base = (conf.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = conf.model || 'gpt-4o-mini';
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${conf.apiKey ?? ''}`,
    },
    body: JSON.stringify({
      model,
      temperature: conf.temperature ?? 0.4,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '';
  if (!text) throw new Error('پاسخی از مدل دریافت نشد.');
  return text;
}

async function dispatch(conf: AiConf, system: string, user: string): Promise<string> {
  switch (conf.provider) {
    case 'gemini': return callGemini(conf, system, user);
    case 'openai': return callOpenAiCompatible(conf, system, user);
    default:       return callBuiltin(system, user);
  }
}

// ─── کمک‌های JSON ────────────────────────────────────────────────────────────
export function extractJson<T>(raw: string): T | null {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?/m, '').replace(/```\s*$/m, '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  try { return JSON.parse(s.slice(start, end + 1)) as T; } catch { return null; }
}

const PERSIAN_FAIL =
  'استاد در حال حاضر در دسترس نیست. از صفحهٔ تنظیمات، کلید API (Gemini یا سازگار با OpenAI) را بررسی کنید یا بعداً تلاش کنید.';

export async function POST(req: Request) {
  let body: Body;
  try { body = (await req.json()) as Body; }
  catch { return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 }); }

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
          const parsed = extractJson<{ title: string; sections: never[]; quiz: never[] }>(raw);
          if (parsed && Array.isArray(parsed.sections) && parsed.sections.length >= 5)
            return NextResponse.json({ lesson: parsed });
        }
        return NextResponse.json({ error: 'تحلیل ساختار جلسه ناموفق بود.' }, { status: 502 });
      }

      case 'gen_quiz': {
        const source = String(body.content ?? '').slice(0, 6000);
        const n = Math.min(Math.max(body.n ?? 5, 3), 10);
        const user = `از منبع زیر ${n} سؤال تستی چهارگزینه‌ای دانشگاهی (تراز آزمون وکالت) بساز و فقط JSON برگردان:
{"quiz":[{"q":string,"options":[{"key":"a|b|c|d","text":string}],"answer":"a|b|c|d","explanation":string,"topic":string}]}
تشریح هر گزینه باید به ماده/اصل قانونی ارجاع دهد.\n\n--- منبع ---\n${source}
${lessonContextBlock(ctx as never)}`;
        for (let attempt = 0; attempt < 2; attempt++) {
          const raw = await dispatch(ai, buildSystem('QUIZ'), user);
          const parsed = extractJson<{ quiz: unknown[] }>(raw);
          if (parsed?.quiz?.length) return NextResponse.json({ quiz: parsed.quiz });
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
