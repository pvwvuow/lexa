"use client";

/* ─── درخواست باز شدن پنجرهٔ ورود از هر نقطهٔ اپ ──────────────────────────────
 * دکمه‌هایی که به حساب نیاز دارند (فالو، امتیاز، کامنت) دیگر برای مهمان
 * «غیرفعال با تولتیپ موبایل‌نامرئی» نیستند؛ با تپ، همین رویداد منتشر می‌شود و
 * ناحیهٔ حساب هدر (AccountArea / CloudAccountArea) پنجرهٔ «ورود / ثبت‌نام» را
 * باز می‌کند. حساب ابری کافی است — پل حساب (cloud-bridge) خودش نشست سروری
 * می‌سازد و همهٔ قابلیت‌های اجتماعی همان لحظه روشن می‌شود.
 */

export const AUTH_PROMPT_EVENT = "lexa:auth-prompt";

/** فراخوانی از دکمه‌ها: «برای این کار حساب لازم است» → پنجرهٔ ورود باز شود */
export function requestAuthPrompt(reason?: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_PROMPT_EVENT, { detail: reason }));
}

/** گوش دادن در ناحیهٔ حساب هدر؛ تابع پاک‌سازی برمی‌گرداند */
export function onAuthPrompt(fn: (reason?: string) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => fn((e as CustomEvent).detail as string | undefined);
  window.addEventListener(AUTH_PROMPT_EVENT, handler);
  return () => window.removeEventListener(AUTH_PROMPT_EVENT, handler);
}
