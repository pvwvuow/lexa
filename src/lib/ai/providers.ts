// ─── لایهٔ پروایدرهای هوش مصنوعی (مشترک بین همهٔ مسیرهای API) ──────────────────
// از /api/ai و مسیرهای بازخورد استفاده می‌شود؛ رفتار هر پروایدر دقیقاً یکسان است.

export interface AiConf {
  provider?: 'builtin' | 'gemini' | 'openai';
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  temperature?: number;
}

export async function callBuiltin(system: string, user: string, temperature = 0.4): Promise<string> {
  const ZAI = (await import('z-ai-web-dev-sdk')).default;
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature,
  });
  return completion.choices[0]?.message?.content ?? '';
}

export async function callGemini(conf: AiConf, system: string, user: string, tempOverride?: number): Promise<string> {
  const key = conf.apiKey!;
  const model = conf.model || 'gemini-2.0-flash';
  const base = conf.baseUrl?.replace(/\/$/, '') || 'https://generativelanguage.googleapis.com/v1beta';
  const res = await fetch(`${base}/models/${encodeURIComponent(model)}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: tempOverride ?? conf.temperature ?? 0.4 },
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

export async function callOpenAiCompatible(conf: AiConf, system: string, user: string, tempOverride?: number): Promise<string> {
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
      temperature: tempOverride ?? conf.temperature ?? 0.4,
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

export async function dispatch(conf: AiConf, system: string, user: string, tempOverride?: number): Promise<string> {
  switch (conf.provider) {
    case 'gemini': return callGemini(conf, system, user, tempOverride);
    case 'openai': return callOpenAiCompatible(conf, system, user, tempOverride);
    default:       return callBuiltin(system, user, tempOverride);
  }
}

/** استخراج اولین شیء JSON از پاسخ خام مدل */
export function extractJson<T>(raw: string): T | null {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?/m, '').replace(/```\s*$/m, '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  try { return JSON.parse(s.slice(start, end + 1)) as T; } catch { return null; }
}

export const PERSIAN_FAIL =
  'استاد در حال حاضر در دسترس نیست. از صفحهٔ تنظیمات، کلید API (Gemini یا سازگار با OpenAI) را بررسی کنید یا بعداً تلاش کنید.';
