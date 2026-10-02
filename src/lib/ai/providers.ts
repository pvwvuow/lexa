// ─── لایهٔ پروایدرهای هوش مصنوعی نسخهٔ سرور ──────────────────────────────────
// «استاد داخلی» با z-ai-web-dev-sdk فقط همین‌جاست (باندل سروری)؛ بقیه از
// لایهٔ سبک ایزومورفیک می‌آید. از /api/ai و مسیرهای بازخورد استفاده می‌شود.
import { callGemini, callOpenAiCompatible, type AiConf } from './providers-lite';

export { extractJson, PERSIAN_FAIL } from './providers-lite';
export type { AiConf } from './providers-lite';
export { callGemini, callOpenAiCompatible } from './providers-lite';

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

/** dispatch کامل سرور — شامل استاد داخلی */
export async function dispatch(conf: AiConf, system: string, user: string, tempOverride?: number): Promise<string> {
  switch (conf.provider) {
    case 'gemini': return callGemini(conf, system, user, tempOverride);
    case 'openai': return callOpenAiCompatible(conf, system, user, tempOverride);
    default:       return callBuiltin(system, user, tempOverride);
  }
}
