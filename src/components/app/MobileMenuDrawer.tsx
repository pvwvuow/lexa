"use client";

/* ─── منوی کشویی موبایل با درگ زندهٔ ۱:۱ ─────────────────────────────────────
 * - باز شدن فوری از دکمه: پنل همیشه نصب است (بدون مونتِ لحظهٔ باز شدن) و با
 *   ترنزیشن کوتاه ۲۸۰ms لیز می‌خورد — حس تأخیر ندارد.
 * - کشیدن از لبهٔ راست صفحه (راست ← چپ): منو با انگشت باز می‌شود.
 * - کشیدن روی خود منو یا پردهٔ پشت آن: منو زیر دست کاربر جلو و عقب می‌رود
 *   (هر اندازه کشیدن، همان‌اندازه منو جابه‌جا می‌شود).
 * - رها کردن: بر اساس موقعیت (نیمهٔ راه) و سرعت انگشت به باز/بسته می‌چسبد.
 * - اسکرول عمودی داخل منو و صفحه دست‌نخورده می‌ماند؛ فقط نیت افقی درگ می‌شود.
 * ─────────────────────────────────────────────────────────────────────── */

import * as React from "react";

const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const REDUCED =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const DUR = REDUCED ? 0 : 280;
/** عرض نوار لمسی لبهٔ راست برای شروع کشیدن (باز کردن) */
const EDGE_PX = 30;
/** حداقل جابه‌جایی افقی برای قطعی شدن نیت درگ */
const ENGAGE_PX = 10;

interface MobileMenuDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label?: string;
  children: React.ReactNode;
}

interface DragInfo {
  surface: "edge" | "panel" | "overlay";
  startP: number;
  startX: number;
  startY: number;
  startT: number;
  lastX: number;
  lastT: number;
  vx: number;
  engaged: boolean;
  width: number;
}

export function MobileMenuDrawer({ open, onOpenChange, label = "منو", children }: MobileMenuDrawerProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);
  /** پیشرفت باز بودن — ۰ بسته، ۱ باز؛ میان‌مقادیر فقط هنگام درگ */
  const progressRef = React.useRef(0);
  const shownRef = React.useRef(false);
  const [shown, setShown] = React.useState(false);
  const hideTimerRef = React.useRef<number | null>(null);
  const dragRef = React.useRef<DragInfo | null>(null);
  const openRef = React.useRef(open);
  openRef.current = open;
  const onOpenChangeRef = React.useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  /** نوشتن مستقیم موقعیت روی DOM — بدون رندر مجدد، برای درگ روان */
  const applyProgress = React.useCallback((p: number) => {
    const panel = panelRef.current;
    const overlay = overlayRef.current;
    if (panel) panel.style.transform = `translateX(${(1 - p) * 100}%)`;
    if (overlay) overlay.style.opacity = String(p);
  }, []);

  const setAnimating = React.useCallback((on: boolean) => {
    const panel = panelRef.current;
    const overlay = overlayRef.current;
    if (panel) panel.style.transition = on ? `transform ${DUR}ms ${EASE}` : "none";
    if (overlay) overlay.style.transition = on ? `opacity ${DUR}ms ${EASE}` : "none";
  }, []);

  const showNow = React.useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (!shownRef.current) {
      shownRef.current = true;
      setShown(true);
    }
  }, []);

  /** چسبیدن به وضعیت نهایی (باز/بسته) با انیمیشن — مبدأ همهٔ تغییر وضعیت‌ها */
  const settle = React.useCallback(
    (target: 0 | 1) => {
      progressRef.current = target;
      setAnimating(true);
      requestAnimationFrame(() => applyProgress(target));
      if (target === 1) {
        showNow();
      } else if (shownRef.current) {
        if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = window.setTimeout(() => {
          hideTimerRef.current = null;
          shownRef.current = false;
          setShown(false);
        }, DUR + 60);
      }
      if (openRef.current !== (target === 1)) onOpenChangeRef.current(target === 1);
    },
    [applyProgress, setAnimating, showNow]
  );

  // واکنش به تغییر open — دکمهٔ منو، انتخاب آیتم، Esc، کلیک پرده…
  React.useLayoutEffect(() => {
    settle(open ? 1 : 0);
  }, [open, settle]);

  // تمرکز روی پنل هنگام باز شدن (دسترس‌پذیری کیبورد)
  React.useEffect(() => {
    if (open) panelRef.current?.focus({ preventScroll: true });
  }, [open]);

  // Esc منو را می‌بندد
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChangeRef.current(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // قفل اسکرول پس‌زمینه وقتی منو باز است
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ─── موتور درگ — لیسنرهای بومی لمسی روی document ───
  React.useEffect(() => {
    const panel = panelRef.current;
    const overlay = overlayRef.current;
    if (!panel || !overlay) return;

    function cleanupMove() {
      document.removeEventListener("touchmove", onTM);
    }

    function hitSurface(target: EventTarget | null): DragInfo["surface"] | null {
      const el = target as Node | null;
      if (!el) return null;
      if (panel!.contains(el)) return "panel";
      if (overlay!.contains(el)) return "overlay";
      return null;
    }

    function onTS(e: TouchEvent) {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (!t) return;
      const isOpen = openRef.current || progressRef.current > 0.02;
      const surface = hitSurface(e.target);
      if (!surface) {
        // بیرون از منو → فقط لبهٔ راست صفحه و فقط وقتی منو بسته است
        if (isOpen) return;
        if (t.clientX < window.innerWidth - EDGE_PX) return;
      }
      dragRef.current = {
        surface: surface ?? "edge",
        startP: progressRef.current,
        startX: t.clientX,
        startY: t.clientY,
        startT: performance.now(),
        lastX: t.clientX,
        lastT: performance.now(),
        vx: 0,
        engaged: false,
        width: panelRef.current?.offsetWidth || 320,
      };
      document.addEventListener("touchmove", onTM, { passive: false });
    }

    function onTM(e: TouchEvent) {
      const d = dragRef.current;
      if (!d) {
        cleanupMove();
        return;
      }
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - d.startX;
      const dy = t.clientY - d.startY;
      if (!d.engaged) {
        if (Math.abs(dx) > ENGAGE_PX && Math.abs(dx) > Math.abs(dy) * 1.25) {
          // نیت افقی قطعی شد — درگ زنده آغاز می‌شود
          d.engaged = true;
          setAnimating(false);
          showNow();
        } else if (Math.abs(dy) > 12) {
          // اسکرول عمودی — درگ لغو شود
          dragRef.current = null;
          cleanupMove();
          return;
        } else {
          return; // هنوز مبهم
        }
      }
      if (e.cancelable) e.preventDefault();
      const p = Math.min(1, Math.max(0, d.startP - dx / d.width));
      progressRef.current = p;
      applyProgress(p);
      const now = performance.now();
      const dt = now - d.lastT;
      if (dt > 0) {
        d.vx = 0.7 * ((t.clientX - d.lastX) / dt) + 0.3 * d.vx;
        d.lastX = t.clientX;
        d.lastT = now;
      }
    }

    function onTE(e: TouchEvent) {
      const d = dragRef.current;
      dragRef.current = null;
      cleanupMove();
      if (!d) return;
      const t = e.changedTouches[0];
      if (!d.engaged) {
        // تپ روی پرده → بستن
        if (t && d.surface === "overlay") {
          const dt = performance.now() - d.startT;
          const dist = Math.hypot(t.clientX - d.startX, t.clientY - d.startY);
          if (dt < 450 && dist < 12) onOpenChangeRef.current(false);
        }
        return;
      }
      const p = progressRef.current;
      let target: 0 | 1 = p >= 0.5 ? 1 : 0;
      // فلیک سریع، حتی اگر کمتر از نصف راه هم باشد مسیرش را می‌برد
      if (Math.abs(d.vx) > 0.3) target = d.vx < 0 ? 1 : 0;
      settle(target);
    }

    document.addEventListener("touchstart", onTS, { passive: true });
    document.addEventListener("touchend", onTE, { passive: true });
    document.addEventListener("touchcancel", onTE, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTS);
      document.removeEventListener("touchend", onTE);
      document.removeEventListener("touchcancel", onTE);
      cleanupMove();
    };
  }, [applyProgress, setAnimating, showNow, settle]);

  return (
    <div className="lg:hidden">
      {/* پردهٔ پشت منو — شفافیتش با پیشرفت درگ بالا و پایین می‌شود */}
      <div
        ref={overlayRef}
        aria-hidden="true"
        onClick={() => onOpenChange(false)}
        className={`fixed inset-0 z-50 bg-black/55 ${shown ? "" : "pointer-events-none"}`}
        style={{ opacity: 0, touchAction: "none", willChange: "opacity" }}
      />
      {/* پنل منو — همیشه نصب؛ فقط جابه‌جا می‌شود */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-hidden={!shown}
        tabIndex={-1}
        className={`fixed inset-y-0 right-0 z-50 flex w-[290px] touch-pan-y flex-col gap-0 overflow-y-auto overscroll-contain border-e border-border/70 bg-background p-4 shadow-2xl outline-none sm:w-[320px] ${
          shown ? "visible" : "invisible"
        }`}
        style={{ transform: "translateX(100%)", willChange: "transform" }}
      >
        {children}
      </div>
    </div>
  );
}
