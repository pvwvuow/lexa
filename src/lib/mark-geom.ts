"use client";
/* ─── هندسهٔ مطمئن برای نوار و دستگیره‌های نشان (0.10.10) ────────────────────
 * دو منبع خطای «دستگیره جای رندوم می‌نشیند» را خنثی می‌کند:
 *  ۱) position:fixed زیر المانی با transform/filter/backdrop-filter نسبت به همان المان
 *     جایگیری می‌شود نه صفحه — نوار/دستگیره به body پورتال می‌شوند و با یک میلهٔ
 *     مرجع fixed کالیبره می‌شوند (هر جابه‌جایی/مقیاس احتمالی حذف می‌شود).
 *  ۲) CSS zoom متن درس: وب‌ویوهای قدیمی (قبل از Chrome 128) مختصات فرزندانِ
 *     المان zoom‌دار را «بدون زوم» گزارش می‌کنند — با یک میلهٔ آزمونی داخل متن
 *     تشخیص و جبران می‌شود.
 * فضای «true» = مختصات واقعی صفحه (همان clientX/Y اشاره‌گر و caretRangeFromPoint).
 * ─────────────────────────────────────────────────────────────────────────── */

export interface Box { left: number; top: number; right: number; bottom: number }

export interface Geo {
  /** مستطیل گزارش‌شده (getBoundingClientRect/getClientRects داخل متن) ← فضای true */
  t(r: Box): Box;
  /** فضای true ← مقدار left/top برای المان fixed پورتال‌شده به body */
  fx(x: number): number;
  fy(y: number): number;
  f(b: Box): Box;
}

function probeRect(parent: Element, css: string): DOMRect | null {
  try {
    const el = document.createElement("div");
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = css;
    parent.appendChild(el);
    const r = el.getBoundingClientRect();
    el.remove();
    return r;
  } catch {
    return null;
  }
}

const PROBE = "width:100px;height:100px;visibility:hidden;pointer-events:none;margin:0;padding:0;border:0;";

export function makeGeo(zoomRoot: Element | null, zoom: number): Geo {
  // ۲) زوم قدیمی: میلهٔ ۱۰۰ پیکسلی داخل متن باید ۱۰۰×zoom گزارش شود؛ اگر ۱۰۰ آمد،
  // مختصات گزارش‌شده تقسیم بر zoom هستند و باید ضرب شوند.
  let k = 1;
  if (zoomRoot && Math.abs(zoom - 1) > 0.01) {
    const p = probeRect(zoomRoot, "position:absolute;left:0;top:0;" + PROBE);
    if (p && Math.abs(p.width - 100) < 1.5) k = zoom;
  }
  // ۱) مرجع fixed واقعی: میله در (0,0) با اندازهٔ ۱۰۰ — جابه‌جایی و مقیاس واقعیش اندازه گرفته می‌شود
  const f = probeRect(document.body, "position:fixed;left:0;top:0;" + PROBE);
  const ox = f ? f.left : 0;
  const oy = f ? f.top : 0;
  const sx = f && f.width > 1 ? f.width / 100 : 1;
  const sy = f && f.height > 1 ? f.height / 100 : sx;
  const fx = (x: number) => (x - ox) / sx;
  const fy = (y: number) => (y - oy) / sy;
  return {
    t: (r) => ({ left: r.left * k, top: r.top * k, right: r.right * k, bottom: r.bottom * k }),
    fx,
    fy,
    f: (b) => ({ left: fx(b.left), top: fy(b.top), right: fx(b.right), bottom: fy(b.bottom) }),
  };
}

/** مستطیل گزارش‌شده ← مستطیل آمادهٔ نوار شناور (فضای fixed پورتال) */
export function toBarRect(r: Box, zoomRoot: Element | null, zoom: number): { top: number; bottom: number; centerX: number } {
  const geo = makeGeo(zoomRoot, zoom);
  const b = geo.f(geo.t(r));
  return { top: b.top, bottom: b.bottom, centerX: (b.left + b.right) / 2 };
}
