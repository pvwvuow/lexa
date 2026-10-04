"use client";
/* ─── دستگیره‌های اختصاصی تنظیم بازهٔ نشان (0.10.9) ─────────────────────────
 * روی وب‌ویو اندروید انتخابِ برنامه‌ای هیچ دستگیرهٔ بومی نمی‌سازد و لمس طولانی
 * فقط یک کلمه را انتخاب می‌کند (نه سر و ته جملهٔ نشان‌شده). پس با لمس یک نشان،
 * دو دستگیرهٔ خودِ اپ دقیقاً روی ابتدا و انتهای نشان می‌نشینند؛ با کشیدن هرکدام
 * بازه بزرگ/کوچک می‌شود (پیش‌نمایش زنده) و با رها کردن، همان نشان (همان id و
 * همان رنگ) با بازهٔ تازه ذخیره می‌شود. هیچ انتخاب بومی ساخته یا خوانده نمی‌شود.
 * ─────────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { useApp } from "@/lib/store";
import { locateSelection, markBg } from "@/lib/marks";

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
interface Edge { x: number; top: number; bottom: number }
interface Geom {
  boxes: { left: number; top: number; width: number; height: number }[];
  start: Edge;
  end: Edge;
  rect: { top: number; bottom: number; centerX: number };
}

const SKIP = "button,input,textarea,select,script,style";

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

/** نقطهٔ متنی زیر مختصات صفحه — استاندارد و فال‌بک وبکیت */
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

/** ابتدای بازه نباید «انتهای» یک نود باشد و انتها نباید «ابتدای» نود — هم‌خوان با locateSelection */
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

/** مستطیل‌های واقعی متن بازه (فقط نودهای متنی — بدون جعبهٔ المان‌ها) */
function textRects(range: Range): DOMRect[] {
  const out: DOMRect[] = [];
  const c = range.commonAncestorContainer;
  const host: Node | null = c.nodeType === Node.TEXT_NODE ? c.parentNode : c;
  if (!host) return out;
  for (const t of textNodesIn(host)) {
    if (!range.intersectsNode(t)) continue;
    const s = t === range.startContainer ? range.startOffset : 0;
    const e = t === range.endContainer ? range.endOffset : t.length;
    if (e <= s) continue;
    const r = document.createRange();
    r.setStart(t, s);
    r.setEnd(t, e);
    for (const b of Array.from(r.getClientRects())) if (b.width > 0.5 && b.height > 0.5) out.push(b);
  }
  return out;
}

function geomOf(range: Range, rtl: boolean): Geom | null {
  const rects = textRects(range);
  if (!rects.length) return null;
  const f = rects[0];
  const l = rects[rects.length - 1];
  let top = Infinity;
  let bottom = -Infinity;
  let left = Infinity;
  let right = -Infinity;
  for (const r of rects) {
    top = Math.min(top, r.top);
    bottom = Math.max(bottom, r.bottom);
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
  }
  return {
    boxes: rects.map((r) => ({ left: r.left, top: r.top, width: r.width, height: r.height })),
    start: { x: rtl ? f.right : f.left, top: f.top, bottom: f.bottom },
    end: { x: rtl ? l.left : l.right, top: l.top, bottom: l.bottom },
    rect: { top, bottom, centerX: (left + right) / 2 },
  };
}

export function MarkHandles({
  rootRef, lessonId, markId, color, version, onDragChange, onCommit,
}: {
  rootRef: React.RefObject<HTMLElement | null>;
  lessonId: string;
  markId: string;
  color: string;
  /** هر تغییر نشان‌های جلسه — بعد از بازچینی DOM، بازه از نو خوانده می‌شود */
  version: unknown;
  onDragChange?: (dragging: boolean) => void;
  onCommit?: (c: MarkHandlesCommit) => void;
}) {
  const applyMark = useApp((s) => s.applyMark);
  const [geom, setGeom] = React.useState<Geom | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const stRef = React.useRef<{ range: Range; secEl: Element; rtl: boolean } | null>(null);
  const dragRef = React.useRef<{ which: "start" | "end"; offX: number; offY: number; pid: number; nodes: Text[] } | null>(null);
  const cbRef = React.useRef({ onDragChange, onCommit });
  React.useEffect(() => {
    cbRef.current = { onDragChange, onCommit };
  }, [onDragChange, onCommit]);

  const measure = React.useCallback(() => {
    const st = stRef.current;
    setGeom(st ? geomOf(st.range, st.rtl) : null);
  }, []);

  const reload = React.useCallback(() => {
    const root = rootRef.current;
    const mr = root ? rangeOfMark(root, markId) : null;
    stRef.current = mr ? { ...mr, rtl: getComputedStyle(mr.secEl).direction === "rtl" } : null;
    measure();
  }, [rootRef, markId, measure]);

  React.useEffect(() => {
    if (dragRef.current) return;
    reload();
  }, [reload, version]);

  React.useEffect(() => {
    const on = () => measure();
    window.addEventListener("scroll", on, true);
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on, true);
      window.removeEventListener("resize", on);
    };
  }, [measure]);

  /** حین کشیدن، رنگ قطعه‌های قدیمی پنهان می‌شود و پیش‌نمایش زنده جایش می‌نشیند */
  const hideMarks = React.useCallback((hidden: boolean) => {
    const root = rootRef.current;
    if (!root) return;
    for (const el of markEls(root, markId)) {
      if (hidden) el.style.setProperty("background", "transparent", "important");
      else el.style.removeProperty("background");
    }
  }, [rootRef, markId]);

  React.useEffect(() => () => {
    if (dragRef.current) {
      dragRef.current = null;
      hideMarks(false);
      cbRef.current.onDragChange?.(false);
    }
  }, [hideMarks]);

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
      };
      hideMarks(true);
      setDragging(true);
      cbRef.current.onDragChange?.(true);
    };
  }

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    const st = stRef.current;
    if (!d || !st || e.pointerId !== d.pid) return;
    e.preventDefault();
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
    measure();
  }

  function onUp(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pid) return;
    dragRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* بی‌اثر */ }
    hideMarks(false);
    setDragging(false);
    cbRef.current.onDragChange?.(false);
    const st = stRef.current;
    if (!st) return;
    const secId = st.secEl.getAttribute("data-sec-id") ?? "";
    const located = secId ? locateSelection(st.secEl, st.range) : null;
    const mark = (useApp.getState().marks[lessonId] ?? []).find((m) => m.id === markId);
    if (!located || !mark) {
      reload();
      return;
    }
    const g = geomOf(st.range, st.rtl);
    if (located.text !== mark.text || secId !== mark.secId) {
      applyMark(lessonId, {
        id: markId, secId, text: located.text, color: mark.color,
        occ: located.occ, pfx: located.pfx, sfx: located.sfx,
      });
    }
    cbRef.current.onCommit?.({ markId, secId, ...located, rect: g?.rect ?? null });
  }

  if (!geom) return null;

  const knob = (which: "start" | "end", edge: Edge) => {
    const h = Math.max(8, edge.bottom - edge.top);
    return (
      <div
        key={which}
        data-mark-toolbar="1"
        aria-label={which === "start" ? "ابتدای نشان" : "انتهای نشان"}
        onPointerDown={onDown(which)}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={(e) => e.preventDefault()}
        className="fixed z-[91] select-none"
        style={{
          left: edge.x - 22,
          top: edge.bottom - 2,
          width: 44,
          height: 46,
          touchAction: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
        } as React.CSSProperties}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute rounded-full"
          style={{ left: 21, top: 2 - h, width: 2.5, height: h, background: "var(--bronze)" }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute rounded-full border-2 border-white shadow-card"
          style={{ left: 12, top: 4, width: 20, height: 20, background: "var(--bronze)" }}
        />
      </div>
    );
  };

  return (
    <>
      {dragging && geom.boxes.map((b, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none fixed z-[89] rounded-[3px]"
          style={{ left: b.left, top: b.top, width: b.width, height: b.height, background: markBg(color) }}
        />
      ))}
      {knob("start", geom.start)}
      {knob("end", geom.end)}
    </>
  );
}
