// ─── محدودساز نرخ درخواست (در حافظهٔ سرور) ─────────────────────────────────────
// پنجرهٔ زمانی ثابت به ازای کلید (مثلاً IP یا شناسه کاربر). برای تک‌سرور اپ
// فعلی کافی است و در برابر حملات سادهٔ تکرار/brute-force می‌ایستد.
// نکته: در حالت multi-instance باید به Redis منتقل شود.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// پاکسازی دوره‌ای کلیدهای منقضی تا حافظه رشد نکند
const SWEEP_EVERY = 5 * 60_000;
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < SWEEP_EVERY) return;
  lastSweep = now;
  for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
}

/** استخراج IP واقعی از هدرهای پراکسی/لودبالنسر */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}

/**
 * بلامانع بودن درخواست — true یعنی مجاز، false یعنی محدود (۴۲۹).
 * limit درخواست در هر windowMs به ازای هر کلید.
 */
export function rateLimit(req: Request, key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);
  const full = `${key}:${clientIp(req)}`;
  const b = buckets.get(full);
  if (!b || b.resetAt <= now) {
    buckets.set(full, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}
