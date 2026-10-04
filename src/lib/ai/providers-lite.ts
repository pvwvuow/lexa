// ─── لایهٔ سبک پروایدرهای هوش مصنوعی (ایزومورفیک: سرور + کلاینت/APK) ─────────
// بدون هیچ وابستگی سروری (no fs / no z-ai-sdk) تا در باندل مرورگر و WebView
// اندروید هم ایمن باشد. نسخهٔ کامل سرور با «استاد داخلی» در providers.ts است.

export interface AiConf {
  provider?: 'builtin' | 'gemini' | 'openai';
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  temperature?: number;
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
  if (!res.ok) throw friendlyProviderError("Gemini", res.status);
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
  if (!res.ok) throw friendlyProviderError("سرویس هوشمند", res.status);
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '';
  if (!text) throw new Error('پاسخی از مدل دریافت نشد.');
  return text;
}

export const BUILTIN_CLIENT_MSG =
  'برای استفاده از استاد هوشمند در نسخهٔ اندروید، یک کلید شخصی لازم است — از «تنظیمات ← هوش مصنوعی ← تنظیمات پیشرفته» دو دقیقه‌ای فعالش کن.';

/** خطای دوستانه برای کاربر — هیچ متن خام فنی (JSON/HTTP) نمایش داده نمی‌شود */
function friendlyProviderError(name: string, status: number): Error {
  if (status === 401 || status === 403) {
    return new Error(`کلید ${name} معتبر نیست — از تنظیمات، کلید شخصی را بررسی کن.`);
  }
  if (status === 429) {
    return new Error(`سرویس ${name} موقتاً شلوغ است — چند لحظه بعد دوباره امتحان کن.`);
  }
  if (status >= 500) {
    return new Error(`سرور ${name} موقتاً در دسترس نیست — چند لحظه بعد دوباره امتحان کن.`);
  }
  return new Error(`ارتباط با ${name} برقرار نشد — اتصال اینترنت را بررسی کن و دوباره تلاش کن.`);
}

/** dispatch سبک — بدون استاد داخلی (کلاینت) */
export async function dispatch(conf: AiConf, system: string, user: string, tempOverride?: number): Promise<string> {
  switch (conf.provider) {
    case 'gemini': return callGemini(conf, system, user, tempOverride);
    case 'openai': return callOpenAiCompatible(conf, system, user, tempOverride);
    default: throw new Error(BUILTIN_CLIENT_MSG);
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
  'استاد هوشمند فعلاً در دسترس نیست — چند لحظه بعد دوباره امتحان کن. اگر ادامه داشت، اتصال اینترنت را بررسی کن.';
