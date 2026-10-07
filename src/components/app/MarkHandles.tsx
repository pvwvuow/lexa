"use client";
/* ─── دستگیره‌های تنظیم بازهٔ نشان — نسخهٔ ۲ (بازسازی کامل 0.10.14) ─────────────
 * با لمس یک نشان، دو دستگیره روی اولین و آخرین حرف نشان می‌نشینند.
 * تفاوت بنیادی با نسخهٔ قبل: بازه فقط دو عدد [s,e) روی ایندکس متنی بخش است و
 * رنگ‌آمیزی با CSS Highlight API انجام می‌شود — حین کشیدن هیچ نودی عوض نمی‌شود، پس
 * بازهٔ کهنه، «گیر کردن»، پرش دستگیره به جای رندوم و برگشت بازه بعد از رها کردن نداریم.
 *  • دستگیرهٔ در حال کشیدن زیر انگشت می‌ماند؛ رنگ پیش‌نمایش به کلمه می‌چسبد.
 *  • عبور از روی دستگیرهٔ دیگر: نقش‌ها جابه‌جا می‌شوند.
 *  • شنونده‌های کشیدن روی window + فال‌بک touchmove (وب‌ویو اندروید) + اسکرول خودکار لبه.
 *  • با رها کردن، بازهٔ تازه به والد داده می‌شود (onCommit) تا با planCommit ذخیره شود.
 * ─────────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { createPortal } from "react-dom";
import {
  caretPoint, highlightSupported, markBg, pointToIndex, snapEnd, snapStart, spanSegments,
  type MarkModel, type SectionIndex, type SpanOverride,
} from "@/lib/marks";
import { makeGeo, type Box, type Geo } from "@/lib/mark-geom";

export interface HandleSpan { secId: string; s: number; e: number }

type Seg = { t: Text; s: number; e: number };
type Role = "start" | "end";
type KnobKey = "a" | "b";
interface Edge { x: number; top: number; bottom: number }
interface Geom { start: Edge; end: Edge; boxes: Box[]; geo: Geo }
interface Span { secId: string; secEl: Element; ix: SectionIndex; s: number; e: number }

const DIGIT = /[0-9\u0660-\u0669\u06F0-\u06F9]/;
const RTL_CH = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const LTR_CH = /[A-Za-z\u00C0-\u024F\u0370-\u04FF]/;
const INVISIBLE = /[\s\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/;

function isRtlChar(ch: string, paraRtl: boolean): boolean {
  if (DIGIT.test(ch)) return false;
  if (RTL_CH.test(ch)) return true;
  if (LTR_CH.test(ch)) return false;
  return paraRtl;
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

function scrollerOf(el: Element | null): Element | null {
  let n = el?.parentElement ?? null;
  while (n && n !== document.body && n !== document.documentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight + 1) return n;
    n = n.parentElement;
  }
  return document.scrollingElement;
}

function spanAlive(sp: Span | null): boolean {
  if (!sp || !sp.secEl.isConnected) return false;
  const a = sp.ix.map[sp.s];
  const b = sp.ix.map[sp.e - 1];
  return !!a && !!b && a.node.isConnected && b.node.isConnected;
}

const DEAD_ZONE = 4;
const EDGE_TOP = 90;
const EDGE_BOTTOM = 110;
const MAX_SCROLL_STEP = 16;

interface Drag {
  key: KnobKey;
  which: Role;
  h: number;
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
  rootRef, markId, color, zoom, version, getModel, onPreview, onDragChange, onCommit,
}: {
  rootRef: React.RefObject<HTMLElement | null>;
  markId: string;
  color: string;
  zoom: number;
  /** هر تغییر نشان‌های جلسه — بازه از نو از مدل خوانده می‌شود */
  version: unknown;
  /** مدل تازهٔ نشان‌ها (والد از تازگی‌اش مطمئن می‌شود) */
  getModel: () => MarkModel | null;
  /** پیش‌نمایش زندهٔ بازه حین کشیدن (null = پایان) */
  onPreview: (o: SpanOverride | null) => void;
  onDragChange?: (dragging: boolean) => void;
  onCommit: (span: HandleSpan) => void;
}) {
  const [geom, setGeom] = React.useState<Geom | null>(null);
  const [overlay, setOverlay] = React.useState(false);
  const geomRef = React.useRef<Geom | null>(null);
  const spRef = React.useRef<Span | null>(null);
  const dragRef = React.useRef<Drag | null>(null);
  const [roles, setRoles] = React.useState<{ a: Role; b: Role }>({ a: "start", b: "end" });
  const rolesRef = React.useRef(roles);
  const setRolesBoth = React.useCallback((r: { a: Role; b: Role }) => {
    rolesRef.current = r;
    setRoles(r);
  }, []);
  const [dragPos, setDragPos] = React.useState<{ key: KnobKey; x: number; y: number; h: number } | null>(null);
  const detachDragRef = React.useRef<() => void>(() => {});
  const lastPtrMoveRef = React.useRef(0);
  const zoomRef = React.useRef(zoom);
  const cbRef = React.useRef({ getModel, onPreview, onDragChange, onCommit });
  React.useEffect(() => {
    zoomRef.current = zoom;
    cbRef.current = { getModel, onPreview, onDragChange, onCommit };
  }, [zoom, getModel, onPreview, onDragChange, onCommit]);
  const useHl = React.useMemo(() => highlightSupported(), []);

  /** بازهٔ فعلی نشان از مدل */
  const load = React.useCallback(() => {
    const m = cbRef.current.getModel();
    const r = m?.byId.get(markId);
    const ix = r ? m?.idx.get(r.secId) : undefined;
    const secEl = r ? m?.sections.get(r.secId) : undefined;
    spRef.current = m && r && ix && secEl ? { secId: r.secId, secEl, ix, s: r.s, e: r.e } : null;
  }, [markId]);

  const measure = React.useCallback(() => {
    if (!dragRef.current && !spanAlive(spRef.current)) load();
    const sp = spRef.current;
    if (!sp) { geomRef.current = null; setGeom(null); return; }
    const geo = makeGeo(rootRef.current, zoomRef.current);
    const segs = spanSegments(sp.ix, sp.s, sp.e);
    const start = startEdge(segs, geo);
    const end = endEdge(segs, geo);
    if (!start || !end) { geomRef.current = null; setGeom(null); return; }
    const g = { start, end, boxes: boxesOf(segs, geo), geo };
    geomRef.current = g;
    setGeom(g);
  }, [rootRef, load]);

  // بعد از هر تغییر نشان‌ها/زوم: بازه از مدل + دو اندازه‌گیری بعد از چیدمان نهایی
  React.useEffect(() => {
    if (dragRef.current) return;
    load();
    measure();
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      measure();
      raf2 = requestAnimationFrame(() => measure());
    });
    return () => { cancelAnimationFrame(raf1); if (raf2) cancelAnimationFrame(raf2); };
  }, [load, measure, version, zoom]);

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

  /** فال‌بک بدون Highlight API: رنگ قطعه‌های <mark> این نشان حین کشیدن پنهان */
  const hideDomMarks = React.useCallback((hidden: boolean) => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>(`mark[data-lexa-mark][data-mid="${CSS.escape(markId)}"]`).forEach((el) => {
      if (hidden) el.style.setProperty("background", "transparent", "important");
      else el.style.removeProperty("background");
    });
  }, [rootRef, markId]);

  const endVisuals = React.useCallback(() => {
    if (!useHl) hideDomMarks(false);
    setOverlay(false);
    setDragPos(null);
  }, [useHl, hideDomMarks]);

  const abortDrag = React.useCallback(() => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    detachDragRef.current?.();
    if (d.raf) cancelAnimationFrame(d.raf);
    setRolesBoth({ a: "start", b: "end" });
    endVisuals();
    if (d.moved) {
      if (useHl) cbRef.current.onPreview(null);
      cbRef.current.onDragChange?.(false);
    }
  }, [endVisuals, setRolesBoth, useHl]);

  React.useEffect(() => () => abortDrag(), [abortDrag]);

  /** اشاره‌گر ← بازهٔ تازه (اندیسی، چسبیده به کلمه) */
  const applyAt = React.useCallback((cx: number, cy: number) => {
    const d = dragRef.current;
    const sp = spRef.current;
    if (!d || !sp) return;
    if (!spanAlive(sp)) { abortDrag(); load(); measure(); return; }
    const px = cx - d.offX;
    const py = cy - d.offY;
    setDragPos({ key: d.key, x: px, y: py, h: d.h });
    const raw = caretPoint(px, py);
    // فقط متن همین بخش — نه نوار ابزار، نه بخش دیگر
    if (!raw || !sp.secEl.contains(raw.node)) return;
    const full = sp.ix.full;
    if (full.length < 2) return;
    const p = pointToIndex(sp.ix, raw.node, raw.offset);
    if (p < 0) return;
    let s = sp.s;
    let e = sp.e;
    let which = d.which;
    if (which === "start") {
      const ns = snapStart(full, p);
      if (ns >= e) {
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
      d.which = which;
      const other: Role = which === "start" ? "end" : "start";
      setRolesBoth(d.key === "a" ? { a: which, b: other } : { a: other, b: which });
    }
    if (s === sp.s && e === sp.e) return;
    spRef.current = { ...sp, s, e };
    if (useHl) cbRef.current.onPreview({ id: markId, s, e });
    measure();
  }, [abortDrag, load, measure, setRolesBoth, useHl, markId]);

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

  const driveMove = React.useCallback((cx: number, cy: number, pid: number) => {
    const d = dragRef.current;
    if (!d || !spRef.current || pid !== d.pid) return;
    d.x = cx;
    d.y = cy;
    if (!d.moved) {
      if (Math.hypot(cx - d.x0, cy - d.y0) < DEAD_ZONE) return;
      d.moved = true;
      if (!useHl) { hideDomMarks(true); setOverlay(true); }
      cbRef.current.onDragChange?.(true);
      d.raf = requestAnimationFrame(tick);
    }
    applyAt(cx, cy);
  }, [applyAt, tick, hideDomMarks, useHl]);

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
    const sp = spRef.current;
    if (sp && spanAlive(sp) && (sp.s !== d.s0 || sp.e !== d.e0)) {
      cbRef.current.onCommit({ secId: sp.secId, s: sp.s, e: sp.e });
    } else {
      if (useHl) cbRef.current.onPreview(null);
      load();
    }
    measure();
  }, [endVisuals, setRolesBoth, load, measure, useHl]);

  /** شنونده‌های کشیدن روی window — در وب‌ویو اندروید هدف رویداد ممکن است عوض شود؛
   *  فال‌بک touchmove اگر استریم pointer مُرد (>۱۲۰ms) */
  const attachWindowDrag = React.useCallback(() => {
    const onWinMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pid) return;
      lastPtrMoveRef.current = performance.now();
      driveMove(e.clientX, e.clientY, e.pointerId);
    };
    const onWinUp = (e: PointerEvent) => finishDrag(e.pointerId);
    const onTouchMove = (e: TouchEvent) => {
      const d = dragRef.current;
      if (!d) return;
      e.preventDefault();
      if (e.touches.length !== 1) return;
      if (performance.now() - lastPtrMoveRef.current < 120) return;
      const t = e.touches[0];
      if (t) driveMove(t.clientX, t.clientY, d.pid);
    };
    const onTouchEnd = (e: TouchEvent) => {
      const d = dragRef.current;
      if (!d || e.touches.length > 0) return;
      finishDrag(d.pid);
    };
    const block = (e: Event) => { if (dragRef.current) e.preventDefault(); };
    window.addEventListener("pointermove", onWinMove, { passive: true });
    window.addEventListener("pointerup", onWinUp);
    window.addEventListener("pointercancel", onWinUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    window.addEventListener("contextmenu", block, true);
    window.addEventListener("selectstart", block, true);
    detachDragRef.current = () => {
      window.removeEventListener("pointermove", onWinMove);
      window.removeEventListener("pointerup", onWinUp);
      window.removeEventListener("pointercancel", onWinUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("contextmenu", block, true);
      window.removeEventListener("selectstart", block, true);
    };
  }, [driveMove, finishDrag]);

  function onDown(key: KnobKey) {
    return (e: React.PointerEvent<HTMLDivElement>) => {
      if (dragRef.current) return;
      if (!spanAlive(spRef.current)) { load(); measure(); }
      const g = geomRef.current;
      const sp = spRef.current;
      if (!sp || !g) return;
      e.preventDefault();
      e.stopPropagation();
      const el = e.currentTarget;
      try { el.setPointerCapture(e.pointerId); } catch { /* بی‌اثر */ }
      try { window.getSelection()?.removeAllRanges(); } catch { /* بی‌اثر */ }
      const which = rolesRef.current[key];
      const edge = which === "start" ? g.start : g.end;
      lastPtrMoveRef.current = performance.now();
      dragRef.current = {
        key,
        which,
        h: Math.max(8, edge.bottom - edge.top),
        el,
        offX: e.clientX - edge.x,
        offY: e.clientY - (edge.top + edge.bottom) / 2,
        pid: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        x: e.clientX,
        y: e.clientY,
        moved: false,
        s0: sp.s,
        e0: sp.e,
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
        data-mark-ui="1"
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
