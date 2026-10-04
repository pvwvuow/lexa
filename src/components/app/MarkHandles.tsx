"use client";
/* ─── دستگیره‌های اختصاصی تنظیم بازهٔ نشان (بازنویسی 0.10.10) ───────────────
 * با لمس یک نشان، دو دستگیره دقیقاً روی اولین و آخرین حرف نشان می‌نشینند.
 * چرا قبلاً «جای رندوم» می‌نشستند و حالا چه شد:
 *  • پورتال به body + کالیبراسیون fixed (mark-geom): دیگر هیچ transform/filter والدی
 *    مرجع مختصات را جابه‌جا نمی‌کند؛ زوم متن درس هم جبران می‌شود.
 *  • لبهٔ هر دستگیره از مستطیل خودِ حرف اول/آخر و جهت همان حرف (فارسی راست‌به‌چپ،
 *    اعداد/لاتین چپ‌به‌راست) محاسبه می‌شود — نه از جهت کلی بلوک؛ فاصله/نیم‌فاصله رد می‌شود.
 *  • اندازه‌گیری خودترمیم: اسکرول، تغییر اندازه، لود فونت، بازچینی DOM نشان‌ها (نودهای
 *    جداشده → بازخوانی از DOM).
 *  • پیش‌نمایش زنده با CSS Highlight API (بدون هیچ محاسبهٔ مختصات)؛ فال‌بک: مستطیل‌ها.
 *  • ناحیهٔ مردهٔ ۴ پیکسلی: لمس سادهٔ دستگیره بازه را تکان نمی‌دهد.
 * با رها کردن، همان نشان (همان id و رنگ) با بازهٔ تازه ذخیره می‌شود.
 * ─────────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { createPortal } from "react-dom";
import { useApp } from "@/lib/store";
import { locateSelection, markBg } from "@/lib/marks";
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
/** لبهٔ دستگیره در فضای true */
interface Edge { x: number; top: number; bottom: number }
interface Geom { start: Edge; end: Edge; boxes: Box[]; rect: Box; geo: Geo }

const SKIP = "button,input,textarea,select,script,style";
const DIGIT = /[0-9\u0660-\u0669\u06F0-\u06F9]/;
const RTL_CH = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const LTR_CH = /[A-Za-z\u00C0-\u024F\u0370-\u04FF]/;
const INVISIBLE = /[\s\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/;

function isRtlChar(ch: string, paraRtl: boolean): boolean {
  if (DIGIT.test(ch)) return false; // اعداد حتی فارسی چپ‌به‌راست چیده می‌شوند
  if (RTL_CH.test(ch)) return true;
  if (LTR_CH.test(ch)) return false;
  return paraRtl; // علائم خنثی جهت پاراگراف را می‌گیرند
}

function textNodesIn(el: Node): Text[] {
  const out: Text[] = [];
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let n = w.nextNode();
  while (n) {
    if ((n as Text).length) out.push(n as Text);
    n = w.nextNode();
  }
  return out;
}

function markEls(root: Element, mid: string): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(`mark[data-lexa-mark][data-mid="${CSS.escape(mid)}"]`));
}

/** بازهٔ کامل نشان (از اولین تا آخرین قطعهٔ <mark> با همان id) روی نودهای متنی */
function rangeOfMark(root: Element, mid: string): { range: Range; secEl: Element } | null {
  const els = markEls(root, mid);
  if (!els.length) return null;
  const secEl = els[0].closest("[data-sec-id]");
  if (!secEl) return null;
  const first = textNodesIn(els[0])[0];
  const tail = textNodesIn(els[els.length - 1]);
  const last = tail[tail.length - 1];
  if (!first || !last) return null;
  const r = document.createRange();
  r.setStart(first, 0);
  r.setEnd(last, last.length);
  return { range: r, secEl };
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

/** ترتیب سندی دو نقطه: ‎-1 یعنی a قبل از b */
function order(a: Pt, b: Pt): number {
  if (a.node === b.node) return a.offset === b.offset ? 0 : a.offset < b.offset ? -1 : 1;
  const r = document.createRange();
  r.setStart(a.node, a.offset);
  r.collapse(true);
  return -r.comparePoint(b.node, b.offset);
}

/** ابتدا نباید «انتهای» یک نود باشد و انتها نباید «ابتدای» نود — هم‌خوان با locateSelection */
function normStart(p: Pt, nodes: Text[]): Pt {
  if (p.offset < p.node.length) return p;
  const i = nodes.indexOf(p.node);
  return i >= 0 && i + 1 < nodes.length ? { node: nodes[i + 1], offset: 0 } : p;
}
function normEnd(p: Pt, nodes: Text[]): Pt {
  if (p.offset > 0) return p;
  const i = nodes.indexOf(p.node);
  return i > 0 ? { node: nodes[i - 1], offset: nodes[i - 1].length } : p;
}

/** قطعه‌های متنی بازه به ترتیب سند */
function segsOf(range: Range): { t: Text; s: number; e: number }[] {
  const out: { t: Text; s: number; e: number }[] = [];
  const c = range.commonAncestorContainer;
  const host: Node | null = c.nodeType === Node.TEXT_NODE ? c.parentNode : c;
  if (!host) return out;
  for (const t of textNodesIn(host)) {
    if (!range.intersectsNode(t)) continue;
    const s = t === range.startContainer ? range.startOffset : 0;
    const e = t === range.endContainer ? range.endOffset : t.length;
    if (e > s) out.push({ t, s, e });
  }
  return out;
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
function startEdge(segs: { t: Text; s: number; e: number }[], geo: Geo): Edge | null {
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
function endEdge(segs: { t: Text; s: number; e: number }[], geo: Geo): Edge | null {
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

function boxesOf(segs: { t: Text; s: number; e: number }[], geo: Geo): Box[] {
  const out: Box[] = [];
  for (const { t, s, e } of segs) {
    const r = document.createRange();
    r.setStart(t, s);
    r.setEnd(t, e);
    for (const b of Array.from(r.getClientRects())) if (b.width > 0.5 && b.height > 0.5) out.push(geo.t(b));
  }
  return out;
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
  const stRef = React.useRef<{ range: Range; secEl: Element } | null>(null);
  const dragRef = React.useRef<{
    which: "start" | "end"; offX: number; offY: number; pid: number; nodes: Text[];
    x0: number; y0: number; moved: boolean;
  } | null>(null);
  const zoomRef = React.useRef(zoom);
  const colorRef = React.useRef(color);
  const cbRef = React.useRef({ onDragChange, onCommit });
  React.useEffect(() => {
    zoomRef.current = zoom;
    colorRef.current = color;
    cbRef.current = { onDragChange, onCommit };
  }, [zoom, color, onDragChange, onCommit]);

  const reloadRange = React.useCallback(() => {
    const root = rootRef.current;
    stRef.current = root ? rangeOfMark(root, markId) : null;
  }, [rootRef, markId]);

  const measure = React.useCallback(() => {
    let st = stRef.current;
    // بازچینی DOM نشان‌ها نودها را عوض می‌کند — بازهٔ کهنه هرگز اندازه گرفته نمی‌شود
    if (!dragRef.current && (!st || !st.range.startContainer.isConnected || !st.range.endContainer.isConnected)) {
      reloadRange();
      st = stRef.current;
    }
    if (!st) { setGeom(null); return; }
    const geo = makeGeo(rootRef.current, zoomRef.current);
    const segs = segsOf(st.range);
    const start = startEdge(segs, geo);
    const end = endEdge(segs, geo);
    if (!start || !end) { setGeom(null); return; }
    const boxes = boxesOf(segs, geo);
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const x of boxes) {
      l = Math.min(l, x.left); t = Math.min(t, x.top); r = Math.max(r, x.right); b = Math.max(b, x.bottom);
    }
    const rect = Number.isFinite(l) ? { left: l, top: t, right: r, bottom: b } : { left: start.x, top: start.top, right: end.x, bottom: end.bottom };
    setGeom({ start, end, boxes, rect, geo });
  }, [rootRef, reloadRange]);

  // بازخوانی بازه بعد از هر تغییر نشان‌ها/زوم + یک اندازه‌گیری دوم بعد از چیدمان نهایی
  React.useEffect(() => {
    if (dragRef.current) return;
    reloadRange();
    measure();
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      measure();
      raf2 = requestAnimationFrame(() => measure());
    });
    return () => { cancelAnimationFrame(raf1); if (raf2) cancelAnimationFrame(raf2); };
  }, [reloadRange, measure, version, zoom]);

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
  }, [hideMarks]);

  React.useEffect(() => () => {
    if (dragRef.current) {
      const moved = dragRef.current.moved;
      dragRef.current = null;
      endVisuals();
      if (moved) cbRef.current.onDragChange?.(false);
    }
  }, [endVisuals]);

  function onDown(which: "start" | "end") {
    return (e: React.PointerEvent<HTMLDivElement>) => {
      const st = stRef.current;
      if (!st || !geom) return;
      e.preventDefault();
      e.stopPropagation();
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* بی‌اثر */ }
      const edge = which === "start" ? geom.start : geom.end;
      const nodes = textNodesIn(st.secEl).filter((t) => !t.parentElement?.closest(SKIP));
      dragRef.current = {
        which,
        offX: e.clientX - edge.x,
        offY: e.clientY - (edge.top + edge.bottom) / 2,
        pid: e.pointerId,
        nodes,
        x0: e.clientX,
        y0: e.clientY,
        moved: false,
      };
    };
  }

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    const st = stRef.current;
    if (!d || !st || e.pointerId !== d.pid) return;
    e.preventDefault();
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < DEAD_ZONE) return;
      d.moved = true;
      hideMarks(true);
      const ok = showHighlight(st.range, markBg(colorRef.current));
      setOverlay(!ok);
      cbRef.current.onDragChange?.(true);
    }
    const raw = caretFromPoint(e.clientX - d.offX, e.clientY - d.offY);
    if (!raw || !d.nodes.includes(raw.node)) return;
    const curS: Pt = { node: st.range.startContainer as Text, offset: st.range.startOffset };
    const curE: Pt = { node: st.range.endContainer as Text, offset: st.range.endOffset };
    let ns = d.which === "start" ? normStart(raw, d.nodes) : curS;
    let ne = d.which === "end" ? normEnd(raw, d.nodes) : curE;
    const o = order(ns, ne);
    if (o === 0) return;
    const crossed = o > 0;
    if (crossed) {
      // دستگیره از روی دیگری رد شد — نقش‌ها جابه‌جا می‌شوند (مثل دستگیره‌های بومی)
      const a = ne;
      ne = normEnd(ns, d.nodes);
      ns = normStart(a, d.nodes);
    }
    if (ns.node === curS.node && ns.offset === curS.offset && ne.node === curE.node && ne.offset === curE.offset) return;
    const r = document.createRange();
    try {
      r.setStart(ns.node, ns.offset);
      r.setEnd(ne.node, ne.offset);
    } catch {
      return;
    }
    if (r.collapsed || r.toString().replace(/\s+/g, "").length < 2) return;
    if (crossed) d.which = d.which === "start" ? "end" : "start";
    st.range = r;
    showHighlight(r, markBg(colorRef.current));
    measure();
  }

  function onUp(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pid) return;
    dragRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* بی‌اثر */ }
    if (!d.moved) return; // لمس سادهٔ دستگیره — هیچ تغییری
    endVisuals();
    cbRef.current.onDragChange?.(false);
    const st = stRef.current;
    if (!st) return;
    const secId = st.secEl.getAttribute("data-sec-id") ?? "";
    const located = secId ? locateSelection(st.secEl, st.range) : null;
    const mark = (useApp.getState().marks[lessonId] ?? []).find((m) => m.id === markId);
    if (!located || !mark) {
      reloadRange();
      measure();
      return;
    }
    const g = geom;
    const barRect = g
      ? (() => { const b = g.geo.f(g.rect); return { top: b.top, bottom: b.bottom, centerX: (b.left + b.right) / 2 }; })()
      : null;
    if (located.text !== mark.text || secId !== mark.secId) {
      applyMark(lessonId, {
        id: markId, secId, text: located.text, color: mark.color,
        occ: located.occ, pfx: located.pfx, sfx: located.sfx,
      });
    }
    cbRef.current.onCommit?.({ markId, secId, ...located, rect: barRect });
  }

  if (!geom || typeof document === "undefined") return null;
  const { geo } = geom;

  const knob = (which: "start" | "end", edge: Edge) => {
    const x = geo.fx(edge.x);
    const top = geo.fy(edge.top);
    const bottom = geo.fy(edge.bottom);
    const h = Math.max(8, bottom - top);
    return (
      <div
        key={which}
        data-mark-toolbar="1"
        data-mark-handle={which}
        aria-label={which === "start" ? "ابتدای نشان" : "انتهای نشان"}
        onPointerDown={onDown(which)}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          position: "fixed",
          zIndex: 91,
          left: x - 22,
          top: bottom - 2,
          width: 44,
          height: 46,
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
          style={{ position: "absolute", left: 21, top: 2 - h, width: 2, height: h, borderRadius: 1, background: "var(--bronze)", pointerEvents: "none" }}
        />
        <span
          aria-hidden
          className="shadow-card"
          style={{
            position: "absolute", left: 12, top: 3, width: 20, height: 20, borderRadius: "50%",
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
      {knob("start", geom.start)}
      {knob("end", geom.end)}
    </>,
    document.body,
  );
}
