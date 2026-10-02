import { NextResponse } from 'next/server';
import { runAiTask, PERSIAN_FAIL, type AiTaskBody } from '@/lib/ai/tasks';
import { dispatch } from '@/lib/ai/providers';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: Request) {
  // موتور AI پرهزینه است — حداکثر ۳۰ فراخوانی در دقیقه از هر IP
  if (!rateLimit(req, "ai", 30, 60_000))
    return NextResponse.json({ error: 'تعداد درخواست‌ها زیاد است؛ چند لحظه صبر کنید.' }, { status: 429 });
  let body: AiTaskBody;
  try { body = (await req.json()) as AiTaskBody; }
  catch { return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 }); }

  try {
    // سرور: dispatch کامل با استاد داخلی (z-ai sdk)
    const result = await runAiTask(body, dispatch);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[AI]', msg);
    return NextResponse.json({ error: `${PERSIAN_FAIL}\n(${msg.slice(0, 180)})` }, { status: 502 });
  }
}
