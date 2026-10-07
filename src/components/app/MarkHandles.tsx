"use client";
/* ─── دستگیره‌های اختصاصی تنظیم بازهٔ نشان (بازنویسی 0.10.11 / 0.10.12) ───────
 * با لمس یک نشان، دو دستگیره دقیقاً روی اولین و آخرین حرف نشان می‌نشینند.
 * 0.10.10: پورتال به body + کالیبراسیون fixed (mark-geom)، لبهٔ حرف‌به‌حرف با جهت خودِ
 *   حرف، اندازه‌گیری خودترمیم، پیش‌نمایش CSS Highlight API، ناحیهٔ مردهٔ ۴ پیکسلی.
 * 0.10.11: همه‌چیز روی اندیس‌های ایندکس کاراکتری بخش (marks.ts)؛ چسبیدن به کلمه،
 *   عبور تمیز، نادیده‌گرفتن نقطه‌های بیرون از متن درس، اسکرول خودکار لبهٔ صفحه.
 * 0.10.12 — حس لمسی اندروید:
 *  • دستگیرهٔ در حال کشیدن دقیقاً زیر انگشت می‌ماند (نه پرش‌به‌پرش روی کلمه‌ها)؛ بعد از
 *    رها کردن روی لبهٔ حرف می‌نشیند. رنگ پیش‌نمایش همان لحظه به کلمه می‌چسبد.
 *  • عبور از روی دستگیرهٔ دیگر: همان دستگیرهٔ زیر انگشت نقش تازه را می‌گیرد (قبلاً
 *    دستگیرهٔ زیر انگشت به سر دیگر بازه می‌پرید).
 *  • ناحیهٔ لمس بزرگ‌تر (۵۶×۵۶).
 * 0.10.13 — «دستگیره گیر کرده» در وب‌ویو اندروید:
 *  ریشهٔ گزارش کاربر: کشیدن فقط به رویدادهای pointerِ خودِ دستگیره تکیه داشت — در
 *  وب‌ویو واقعی، holdِ طولانی روی متن (انتخاب بومی/منو) یا ازدست‌رفتن کپچر، جریان
 *  pointer را از دستگیره قطع می‌کند و کشیدن همان اول می‌میرد («نه عقب نه جلو»).
 *  • به‌محض شروع کشیدن، شنونده‌های pointermove/up/cancel به window وصل می‌شوند —
 *    رویدادها مهم نیست هدفشان کدام المان است، به window می‌رسند؛ کپچر فقط یک بهینه‌سازی است.
 *  • فال‌بک لمس خالص: اگر pointermove زنده نبود (>۱۲۰ms)، touchmove خودِ کشیدن را
 *    می‌راند و touchend رها کردن را تمام می‌کند؛ touchmove حین کشیدن preventDefault
 *    می‌شود تا اسکرول/ژست بومی هرگز کشیدن را نرباید.
 *  • حین کشیدن: contextmenu و selectstart در سطح window خنثی می‌شود (hold طولانی امن).
 * با رها کردن، همان نشان (همان id و رنگ) با بازهٔ تازه ذخیره می‌شود.
 * ─────────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { createPortal } from "react-dom";
import { useApp } from "@/lib/store";
import {
  markBg, markSpan, pointToIndex, sectionIndex, spanInfo, spanRange, spanSegments,
  type SectionIndex,
} from "@/lib/marks";
import { makeGeo, type Box, type Geo } from "@/lib/mark-geom";

export interface MarkHandlesCommit {
  markId: string;
  secId: string;
  text: string;
  occ: number;
  pfx: string;
  sfx: string;
  rect: { top: number; bottom: number; centerX: number } | null;
}

type Pt = { node: Text; offset: number };
type Seg = { t: Text; s: number; e: number };
type Role = "start" | "end";
type KnobKey = "a" | "b";
/** لبهٔ دستگیره در فضای true */
interface Edge { x: number; top: number; bottom: number }
interface Geom { start: Edge; end: Edge; boxes: Box[]; rect: Box; geo: Geo }
/** وضعیت بازهٔ در حال ویرایش — اندیس‌های [s,e) روی ایندکس بخش */
interface Span { secEl: Element; idx: SectionIndex; s: number; e: number; range: Range }

const DIGIT = /[0-9\u0660-\u0669\u06F0-\u06F9]/;
const RTL_CH = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const LTR_CH = /[A-Za-z\u00C0-\u024F\u0370-\u04FF]/;
const INVISIBLE = /[\s\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/;
/** مرز کلمه: فاصله و علائم — نیم‌فاصله (ZWNJ) مرز نیست تا «می‌شود» یک کلمه بماند */
const BOUNDARY = /[\s\u060C\u061B\u061F.,;:!?()[\]{}\u00AB\u00BB"'\u201C\u201D\u2018\u2019\-\u2013\u2014/\\]/;
const isB = (c: string | undefined) => c === undefined || BOUNDARY.test(c);

/** ابتدای بازه ← ابتدای کلمه (روی مرز بود: اولین کلمهٔ بعدی) */
function snapStart(full: string, i: number): number {
  const len = full.length;
  if (!len) return 0;
  i = Math.max(0, Math.min(i, len - 1));
  if (isB(full[i])) { while (i < len - 1 && isB(full[i])) i++; }
  else { while (i > 0 && !isB(full[i - 1])) i--; }
  return i;
}

/** انتهای بازه (انحصاری) ← انتهای کلمه (بعد از مرز بود: انتهای کلمهٔ قبلی) */
function snapEnd(full: string, j: number): number {
  const len = full.length;
  if (!len) return 0;
  j = Math.max(1, Math.min(j, len));
  if (isB(full[j - 1])) { while (j > 1 && isB(full[j - 1])) j--; }
  else { while (j < len && !isB(full[j])) j++; }
  return j;
}

function isRtlChar(ch: string, paraRtl: boolean): boolean {
  if (DIGIT.test(ch)) return false; // اعداد حتی فارسی چپ‌به‌راست چیده می‌شوند
  if (RTL_CH.test(ch)) return true;
  if (LTR_CH.test(ch)) return false;
  return paraRtl; // علائم خنثی جهت پاراگراف را می‌گیرند
}

function markEls(root: Element, mid: string): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(`mark[data-lexa-mark][data-mid="${CSS.escape(mid)}"]`));
}

/** بازهٔ فعلی نشان از روی DOM — بخش ← ایندکس ← اندیس‌ها */
function loadSpan(root: Element, mid: string): Span | null {
  const els = markEls(root, mid);
  if (!els.length) return null;
  const secEl = els[0].closest("[data-sec-id]");
  if (!secEl) return null;
  const idx = sectionIndex(secEl);
  const sp = markSpan(idx, mid);
  if (!sp) return null;
  const range = spanRange(idx, sp.s, sp.e);
  if (!range) return null;
  return { secEl, idx, s: sp.s, e: sp.e, range };
}

function spanAlive(st: Span | null): boolean {
  if (!st || !st.secEl.isConnected) return false;
  const a = st.idx.map[st.s];
  const b = st.idx.map[st.e - 1];
  return !!a && !!b && a.node.isConnected && b.node.isConnected;
}

/** نقطهٔ متنی زیر مختصات واقعی صفحه — استاندارد و فال‌بک وبکیت */
function caretFromPoint(x: number, y: number): Pt | null {
  const d = document as unknown as {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  let node: Node | null = null;
  let offset = 0;
  try {
    if (typeof d.caretPositionFromPoint === "function") {
      const p = d.caretPositionFromPoint(x, y);
      if (p) { node = p.offsetNode; offset = p.offset; }
    }
    if ((!node || node.nodeType !== Node.TEXT_NODE) && typeof d.caretRangeFromPoint === "function") {
      const r = d.caretRangeFromPoint(x, y);
      if (r) { node = r.startContainer; offset = r.startOffset; }
    }
  } catch {
    return null;
  }
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  return { node: node as Text, offset };
}

function charRects(t: Text, i: number): DOMRect[] {
  const r = document.createRange();
  r.setStart(t, i);
  r.setEnd(t, i + 1);
  return Array.from(r.getClientRects()).filter((b) => b.height > 0.5);
}

function paraRtl(t: Text): boolean {
  const p = t.parentElement;
  return p ? getComputedStyle(p).direction === "rtl" : true;
}

/** لبهٔ شروع: اولین حرف دیدنی بازه؛ لبهٔ راستِ حرف راست‌به‌چپ یا لبهٔ چپِ حرف چپ‌به‌راست */
function startEdge(segs: Seg[], geo: Geo): Edge | null {
  for (const { t, s, e } of segs) {
    const v = t.data;
    const pr = paraRtl(t);
    for (let i = s; i < e; i++) {
      if (INVISIBLE.test(v[i])) continue;
      const r = charRects(t, i)[0];
      if (!r || r.width < 0.5) continue;
      const b = geo.t(r);
      return { x: isRtlChar(v[i], pr) ? b.right : b.left, top: b.top, bottom: b.bottom };
    }
  }
  return null;
}

/** لبهٔ پایان: آخرین حرف دیدنی بازه؛ لبهٔ چپِ حرف راست‌به‌چپ یا لبهٔ راستِ حرف چپ‌به‌راست */
function endEdge(segs: Seg[], geo: Geo): Edge | null {
  for (let k = segs.length - 1; k >= 0; k--) {
    const { t, s, e } = segs[k];
    const v = t.data;
    const pr = paraRtl(t);
    for (let i = e - 1; i >= s; i--) {
      if (INVISIBLE.test(v[i])) continue;
      const rs = charRects(t, i);
      const r = rs[rs.length - 1];
      if (!r || r.width < 0.5) continue;
      const b = geo.t(r);
      return { x: isRtlChar(v[i], pr) ? b.left : b.right, top: b.top, bottom: b.bottom };
    }
  }
  return null;
}

function boxesOf(segs: Seg[], geo: Geo): Box[] {
  const out: Box[] = [];
  for (const { t, s, e } of segs) {
    const r = document.createRange();
    r.setStart(t, s);
    r.setEnd(t, e);
    for (const b of Array.from(r.getClientRects())) if (b.width > 0.5 && b.height > 0.5) out.push(geo.t(b));
  }
  return out;
}

/** نزدیک‌ترین والد اسکرول‌شونده — برای اسکرول خودکار حین کشیدن */
function scrollerOf(el: Element | null): Element | null {
  let n = el?.parentElement ?? null;
  while (n && n !== document.body && n !== document.documentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight + 1) return n;
    n = n.parentElement;
  }
  return document.scrollingElement;
}

/* ── پیش‌نمایش زنده با CSS Custom Highlight API ── */
const HL = "lexa-mark-edit";
type HlRegistry = { set(name: string, h: unknown): unknown; delete(name: string): unknown };
function hlApi(): { reg: HlRegistry; Ctor: new (...r: Range[]) => unknown } | null {
  const g = globalThis as unknown as { CSS?: { highlights?: HlRegistry }; Highlight?: new (...r: Range[]) => unknown };
  if (!g.CSS?.highlights || typeof g.Highlight !== "function") return null;
  return { reg: g.CSS.highlights, Ctor: g.Highlight };
}
function showHighlight(range: Range | null, bg: string): boolean {
  const api = hlApi();
  if (!api) return false;
  try {
    if (!range) {
      api.reg.delete(HL);
      return true;
    }
    let st = document.getElementById("lexa-hl-style");
    if (!st) {
      st = document.createElement("style");
      st.id = "lexa-hl-style";
      document.head.appendChild(st);
    }
    const css = `::highlight(${HL}){background-color:${bg};}`;
    if (st.textContent !== css) st.textContent = css;
    api.reg.set(HL, new api.Ctor(range));
    return true;
  } catch {
    return false;
  }
}

const DEAD_ZONE = 4;
const EDGE_TOP = 90;
const EDGE_BOTTOM = 110;
const MAX_SCROLL_STEP = 16;

interface Drag {
  key: KnobKey;
  which: Role;
  /** ارتفاع خط زیر دستگیره — برای رسم میلهٔ دستگیرهٔ زیر انگشت */
  h: number;
  /** خود المان دستگیره — برای آزادکردن کپچر در پایان (روی window به currentTarget نمی‌رسیم) */
  el: HTMLDivElement | null;
  offX: number;
  offY: number;
  pid: number;
  x0: number;
  y0: number;
  x: number;
  y: number;
  moved: boolean;
  s0: number;
  e0: number;
  raf: number;
}

export function MarkHandles({
  rootRef, lessonId, markId, color, zoom, version, onDragChange, onCommit,
}: {
  rootRef: React.RefObject<HTMLElement | null>;
  lessonId: string;
  markId: string;
  color: string;
  /** زوم CSS متن درس — برای جبران مختصات وب‌ویوهای قدیمی */
  zoom: number;
  /** هر تغییر نشان‌های جلسه — بعد از بازچینی DOM، بازه از نو خوانده می‌شود */
  version: unknown;
  onDragChange?: (dragging: boolean) => void;
  onCommit?: (c: MarkHandlesCommit) => void;
}) {
  const applyMark = useApp((s) => s.applyMark);
  const [geom, setGeom] = React.useState<Geom | null>(null);
  const [overlay, setOverlay] = React.useState(false);
  const geomRef = React.useRef<Geom | null>(null);
  const stRef = React.useRef<Span | null>(null);
  const dragRef = React.useRef<Drag | null>(null);
  // نقش هر دستگیره (a/b) — با عبور یکی از روی دیگری جابه‌جا می‌شود تا دستگیرهٔ زیر انگشت ثابت بماند
  const [roles, setRoles] = React.useState<{ a: Role; b: Role }>({ a: "start", b: "end" });
  const rolesRef = React.useRef(roles);
  const setRolesBoth = React.useCallback((r: { a: Role; b: Role }) => {
    rolesRef.current = r;
    setRoles(r);
  }, []);
  // جای دستگیرهٔ در حال کشیدن در فضای true (همان نقطهٔ آزمون زیر انگشت)
  const [dragPos, setDragPos] = React.useState<{ key: KnobKey; x: number; y: number; h: number } | null>(null);
  // قطع‌کنندهٔ شنونده‌های window حین کشیدن + تازگی استریم pointer (برای فال‌بک لمس)
  const detachDragRef = React.useRef<() => void>(() => {});
  const lastPtrMoveRef = React.useRef(0);
  const zoomRef = React.useRef(zoom);
  const colorRef = React.useRef(color);
  const cbRef = React.useRef({ onDragChange, onCommit });
  React.useEffect(() => {
    zoomRef.current = zoom;
    colorRef.current = color;
    cbRef.current = { onDragChange, onCommit };
  }, [zoom, color, onDragChange, onCommit]);

  const reloadSpan = React.useCallback(() => {
    const root = rootRef.current;
    stRef.current = root ? loadSpan(root, markId) : null;
  }, [rootRef, markId]);

  const measure = React.useCallback(() => {
    // بازچینی DOM نشان‌ها نودها را عوض می‌کند — بازهٔ کهنه هرگز اندازه گرفته نمی‌شود
    if (!dragRef.current && !spanAlive(stRef.current)) reloadSpan();
    const st = stRef.current;
    if (!st) { geomRef.current = null; setGeom(null); return; }
    const geo = makeGeo(rootRef.current, zoomRef.current);
    const segs = spanSegments(st.idx, st.s, st.e);
    const start = startEdge(segs, geo);
    const end = endEdge(segs, geo);
    if (!start || !end) { geomRef.current = null; setGeom(null); return; }
    const boxes = boxesOf(segs, geo);
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const x of boxes) {
      l = Math.min(l, x.left); t = Math.min(t, x.top); r = Math.max(r, x.right); b = Math.max(b, x.bottom);
    }
    const rect = Number.isFinite(l) ? { left: l, top: t, right: r, bottom: b } : { left: start.x, top: start.top, right: end.x, bottom: end.bottom };
    const g = { start, end, boxes, rect, geo };
    geomRef.current = g;
    setGeom(g);
  }, [rootRef, reloadSpan]);

  // بازخوانی بازه بعد از هر تغییر نشان‌ها/زوم + یک اندازه‌گیری دوم بعد از چیدمان نهایی
  React.useEffect(() => {
    if (dragRef.current) return;
    reloadSpan();
    measure();
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      measure();
      raf2 = requestAnimationFrame(() => measure());
    });
    return () => { cancelAnimationFrame(raf1); if (raf2) cancelAnimationFrame(raf2); };
  }, [reloadSpan, measure, version, zoom]);

  // اندازه‌گیری خودکار (یک‌بار در هر فریم)
  React.useEffect(() => {
    let raf = 0;
    const on = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; measure(); });
    };
    window.addEventListener("scroll", on, true);
    window.addEventListener("resize", on);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", on);
    vv?.addEventListener("scroll", on);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && rootRef.current) {
      ro = new ResizeObserver(on);
      ro.observe(rootRef.current);
    }
    try { void document.fonts?.ready.then(on); } catch { /* بی‌اثر */ }
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", on, true);
      window.removeEventListener("resize", on);
      vv?.removeEventListener("resize", on);
      vv?.removeEventListener("scroll", on);
      ro?.disconnect();
    };
  }, [measure, rootRef]);

  /** حین کشیدن، رنگ قطعه‌های قدیمی پنهان می‌شود و پیش‌نمایش زنده جایش می‌نشیند */
  const hideMarks = React.useCallback((hidden: boolean) => {
    const root = rootRef.current;
    if (!root) return;
    for (const el of markEls(root, markId)) {
      if (hidden) el.style.setProperty("background", "transparent", "important");
      else el.style.removeProperty("background");
    }
  }, [rootRef, markId]);

  const endVisuals = React.useCallback(() => {
    showHighlight(null, "");
    hideMarks(false);
    setOverlay(false);
    setDragPos(null);
  }, [hideMarks]);

  /** پایان کشیدن بدون ذخیره (قطع شدن، بازچینی DOM، unmount) */
  const abortDrag = React.useCallback(() => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    detachDragRef.current?.();
    if (d.raf) cancelAnimationFrame(d.raf);
    setRolesBoth({ a: "start", b: "end" });
    endVisuals();
    if (d.moved) cbRef.current.onDragChange?.(false);
  }, [endVisuals, setRolesBoth]);

  React.useEffect(() => () => abortDrag(), [abortDrag]);

  /** موقعیت اشاره‌گر ← بازهٔ تازه (اندیسی، چسبیده به کلمه) */
  const applyAt = React.useCallback((cx: number, cy: number) => {
    const d = dragRef.current;
    const st = stRef.current;
    const root = rootRef.current;
    if (!d || !st || !root) return;
    if (!spanAlive(st)) {
      // متن زیر دست بازچینی شد — کشیدن بی‌خطر قطع و بازه از نو خوانده می‌شود
      abortDrag();
      reloadSpan();
      measure();
      return;
    }
    const px = cx - d.offX;
    const py = cy - d.offY;
    // دستگیره همیشه زیر انگشت — حتی وقتی نقطه روی متن نیست
    setDragPos({ key: d.key, x: px, y: py, h: d.h });
    const raw = caretFromPoint(px, py);
    // فقط متن خودِ درس — نه نوار ابزار، نه پنل‌های دیگر
    if (!raw || !root.contains(raw.node) || raw.node.parentElement?.closest("[data-mark-toolbar]")) return;
    const full = st.idx.full;
    if (full.length < 2) return;
    const p = pointToIndex(st.idx, raw.node, raw.offset);
    if (p < 0) return;
    let s = st.s;
    let e = st.e;
    let which = d.which;
    if (which === "start") {
      const ns = snapStart(full, p);
      if (ns >= e) {
        // سر از روی ته رد شد: آخرین کلمهٔ قبلی لنگر می‌ماند و این دستگیره «ته» می‌شود
        s = snapStart(full, e - 1);
        e = snapEnd(full, Math.max(p, e));
        which = "end";
      } else {
        s = ns;
      }
    } else {
      const ne = snapEnd(full, p);
      if (ne <= s) {
        e = snapEnd(full, s + 1);
        s = snapStart(full, Math.min(p, s));
        which = "start";
      } else {
        e = ne;
      }
    }
    if (e <= s) return;
    if (full.slice(s, e).replace(/\s+/g, "").length < 2) return;
    if (which !== d.which) {
      // دستگیرهٔ زیر انگشت نقش تازه را می‌گیرد؛ دیگری روی لنگر می‌ماند
      d.which = which;
      const other: Role = which === "start" ? "end" : "start";
      setRolesBoth(d.key === "a" ? { a: which, b: other } : { a: other, b: which });
    }
    if (s === st.s && e === st.e) return;
    const range = spanRange(st.idx, s, e);
    if (!range) return;
    stRef.current = { ...st, s, e, range };
    showHighlight(range, markBg(colorRef.current));
    measure();
  }, [rootRef, abortDrag, reloadSpan, measure, setRolesBoth]);

  /** اسکرول خودکار وقتی انگشت نزدیک لبهٔ بالا/پایین صفحه است */
  const tick = React.useCallback(() => {
    const d = dragRef.current;
    if (!d) return;
    d.raf = 0;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    let dy = 0;
    if (d.y < EDGE_TOP) dy = -Math.ceil(((EDGE_TOP - d.y) / EDGE_TOP) * MAX_SCROLL_STEP);
    else if (d.y > vh - EDGE_BOTTOM) dy = Math.ceil(((d.y - (vh - EDGE_BOTTOM)) / EDGE_BOTTOM) * MAX_SCROLL_STEP);
    if (dy) {
      const sc = scrollerOf(rootRef.current);
      if (sc) {
        const before = sc.scrollTop;
        sc.scrollTop = before + Math.max(-MAX_SCROLL_STEP, Math.min(MAX_SCROLL_STEP, dy));
        if (sc.scrollTop !== before) applyAt(d.x, d.y);
      }
    }
    d.raf = requestAnimationFrame(tick);
  }, [rootRef, applyAt]);

  /** منطق مشترک حرکت — هم از pointermove و هم از فال‌بک touchmove صدا می‌شود */
  const driveMove = React.useCallback((cx: number, cy: number, pid: number) => {
    const d = dragRef.current;
    const st = stRef.current;
    if (!d || !st || pid !== d.pid) return;
    d.x = cx;
    d.y = cy;
    if (!d.moved) {
      if (Math.hypot(cx - d.x0, cy - d.y0) < DEAD_ZONE) return;
      d.moved = true;
      hideMarks(true);
      const ok = showHighlight(st.range, markBg(colorRef.current));
      setOverlay(!ok);
      cbRef.current.onDragChange?.(true);
      d.raf = requestAnimationFrame(tick);
    }
    applyAt(cx, cy);
  }, [applyAt, tick, hideMarks]);

  /** پایان کشیدن + ذخیره اگر جابه‌جایی بود (pointerup/pointercancel/touchend) */
  const finishDrag = React.useCallback((pid: number) => {
    const d = dragRef.current;
    if (!d || pid !== d.pid) return;
    dragRef.current = null;
    detachDragRef.current?.();
    if (d.raf) cancelAnimationFrame(d.raf);
    setRolesBoth({ a: "start", b: "end" });
    setDragPos(null);
    try { d.el?.releasePointerCapture(pid); } catch { /* بی‌اثر */ }
    if (!d.moved) return; // لمس سادهٔ دستگیره — هیچ تغییری
    endVisuals();
    cbRef.current.onDragChange?.(false);
    const st = stRef.current;
    if (!st) return;
    const secId = st.secEl.getAttribute("data-sec-id") ?? "";
    const info = secId !== "" && spanAlive(st) ? spanInfo(st.idx, st.s, st.e) : null;
    const mark = (useApp.getState().marks[lessonId] ?? []).find((m) => m.id === markId);
    if (!info || !mark) {
      reloadSpan();
      measure();
      return;
    }
    measure();
    const g = geomRef.current;
    const barRect = g
      ? (() => { const b = g.geo.f(g.rect); return { top: b.top, bottom: b.bottom, centerX: (b.left + b.right) / 2 }; })()
      : null;
    const located = { text: info.text, occ: info.occ, pfx: info.pfx, sfx: info.sfx };
    if (located.text !== mark.text || secId !== mark.secId || info.s !== d.s0 || info.e !== d.e0) {
      applyMark(lessonId, {
        id: markId, secId, text: located.text, color: mark.color,
        occ: located.occ, pfx: located.pfx, sfx: located.sfx,
      });
    }
    cbRef.current.onCommit?.({ markId, secId, ...located, rect: barRect });
  }, [endVisuals, setRolesBoth, lessonId, markId, reloadSpan, measure, applyMark]);

  /** شنونده‌های کشیدن روی window — عمداً خارج از دستگیره: در وب‌ویو اندروید،
   * انتخاب بومی/منوی hold یا افتادن کپچر می‌تواند هدف رویداد را عوض کند؛
   * رویداد pointer مهم نیست هدفش کجاست به window می‌رسد. فال‌بک لمس خالص هم
   * اگر استریم pointer مُرده باشد (>۱۲۰ms) خودش کشیدن را می‌راند. */
  const attachWindowDrag = React.useCallback(() => {
    const onWinMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pid) return;
      lastPtrMoveRef.current = performance.now();
      driveMove(e.clientX, e.clientY, e.pointerId);
    };
    const onWinUp = (e: PointerEvent) => finishDrag(e.pointerId);
    const onWinCancel = (e: PointerEvent) => finishDrag(e.pointerId); // اگر جابه‌جایی بود ذخیره می‌شود
    const onTouchMove = (e: TouchEvent) => {
      const d = dragRef.current;
      if (!d) return;
      e.preventDefault(); // حین کشیدن اسکرول/ژست بومی ممنوع — حتی اگر touch-action گم شده باشد
      if (e.touches.length !== 1) return; // چندانگشتی غیرعادی — با pointer استریم یا هیچ
      if (performance.now() - lastPtrMoveRef.current < 120) return; // pointermove زنده است
      const t = e.touches[0];
      if (t) driveMove(t.clientX, t.clientY, d.pid);
    };
    const onTouchEnd = (e: TouchEvent) => {
      const d = dragRef.current;
      if (!d) return; // pointerup خودش تمام کرده
      if (e.touches.length > 0) return; // انگشت دیگری هنوز پایین است
      finishDrag(d.pid);
    };
    const onWinCtx = (e: Event) => { if (dragRef.current) e.preventDefault(); };
    const onWinSelect = (e: Event) => { if (dragRef.current) e.preventDefault(); };
    window.addEventListener("pointermove", onWinMove, { passive: true });
    window.addEventListener("pointerup", onWinUp);
    window.addEventListener("pointercancel", onWinCancel);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("contextmenu", onWinCtx, true);
    window.addEventListener("selectstart", onWinSelect, true);
    detachDragRef.current = () => {
      window.removeEventListener("pointermove", onWinMove);
      window.removeEventListener("pointerup", onWinUp);
      window.removeEventListener("pointercancel", onWinCancel);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("contextmenu", onWinCtx, true);
      window.removeEventListener("selectstart", onWinSelect, true);
    };
  }, [driveMove, finishDrag]);

  function onDown(key: KnobKey) {
    return (e: React.PointerEvent<HTMLDivElement>) => {
      if (dragRef.current) return; // کشیدن دوم (لمس همزمان) نادیده گرفته می‌شود
      if (!spanAlive(stRef.current)) { reloadSpan(); measure(); }
      const g = geomRef.current;
      const st = stRef.current;
      if (!st || !g) return;
      e.preventDefault();
      e.stopPropagation();
      const el = e.currentTarget;
      try { el.setPointerCapture(e.pointerId); } catch { /* بی‌اثر */ }
      const which = rolesRef.current[key];
      const edge = which === "start" ? g.start : g.end;
      lastPtrMoveRef.current = performance.now();
      dragRef.current = {
        key,
        which,
        h: Math.max(8, edge.bottom - edge.top),
        el,
        // فاصلهٔ انگشت تا لبهٔ حرف حفظ می‌شود — نقطهٔ آزمون همیشه وسط همان خط است
        offX: e.clientX - edge.x,
        offY: e.clientY - (edge.top + edge.bottom) / 2,
        pid: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        x: e.clientX,
        y: e.clientY,
        moved: false,
        s0: st.s,
        e0: st.e,
        raf: 0,
      };
      attachWindowDrag();
    };
  }

  if (!geom || typeof document === "undefined") return null;
  const { geo } = geom;

  const knob = (key: KnobKey) => {
    const role = roles[key];
    let edge: Edge = role === "start" ? geom.start : geom.end;
    if (dragPos && dragPos.key === key) {
      edge = { x: dragPos.x, top: dragPos.y - dragPos.h / 2, bottom: dragPos.y + dragPos.h / 2 };
    }
    const x = geo.fx(edge.x);
    const top = geo.fy(edge.top);
    const bottom = geo.fy(edge.bottom);
    const h = Math.max(8, bottom - top);
    return (
      <div
        key={key}
        data-mark-toolbar="1"
        data-mark-handle={role}
        aria-label={role === "start" ? "ابتدای نشان" : "انتهای نشان"}
        onPointerDown={onDown(key)}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          position: "fixed",
          zIndex: 91,
          left: x - 28,
          top: bottom - 2,
          width: 56,
          height: 56,
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
          WebkitTapHighlightColor: "transparent",
        } as React.CSSProperties}
      >
        {/* میلهٔ نشانگر دقیقاً روی لبهٔ حرف + سر گرد زیر خط */}
        <span
          aria-hidden
          style={{ position: "absolute", left: 27, top: 2 - h, width: 2, height: h, borderRadius: 1, background: "var(--bronze)", pointerEvents: "none" }}
        />
        <span
          aria-hidden
          className="shadow-card"
          style={{
            position: "absolute", left: 17, top: 3, width: 22, height: 22, borderRadius: "50%",
            background: "var(--bronze)", border: "2px solid #fff", pointerEvents: "none",
          }}
        />
      </div>
    );
  };

  return createPortal(
    <>
      {overlay && geom.boxes.map((b, i) => {
        const f = geo.f(b);
        return (
          <span
            key={i}
            aria-hidden
            style={{
              position: "fixed", zIndex: 89, pointerEvents: "none", borderRadius: 3,
              left: f.left, top: f.top, width: f.right - f.left, height: f.bottom - f.top, background: markBg(color),
            }}
          />
        );
      })}
      {knob("a")}
      {knob("b")}
    </>,
    document.body,
  );
}
