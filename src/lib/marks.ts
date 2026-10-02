"use client";
/* ─── موتور نشان‌گذاری (هایلایت) متن درس ────────────────────────────────────
 * متن انتخاب‌شدهٔ کاربر با رنگ دلخواه به‌صورت <mark data-lexa-mark> در همان
 * ناحیه رندر می‌شود. برای مقاومت در برابر عبارت تکراری، اندیس وقوع (occ)
 * ذخیره می‌شود؛ برای متن‌هایی که چند نود متنی را می‌پوشانند، ایندکسِ کاراکتر
 * به‌کاراکتر نرمال‌شده ساخته و بازهٔ تطبیق روی نودها پخش می‌شود.
 * همهٔ تغییرها فقط داخل المان‌های متنی است؛ دکمه/ورودی/نشان قبلی دست‌نخورده.
 * ─────────────────────────────────────────────────────────────────────────── */

export interface MarkColorDef { dot: string; bg: string }

/** پنج رنگ پیش‌فرض نشان — پس‌زمینهٔ نیمه‌شفاف تا در تم روز/شب هر دو خوانا باشد */
export const MARK_COLORS: Record<string, MarkColorDef> = {
  yellow: { dot: "#facc15", bg: "rgba(250,204,21,0.42)" },
  green:  { dot: "#4ade80", bg: "rgba(74,222,128,0.38)" },
  blue:   { dot: "#60a5fa", bg: "rgba(96,165,250,0.38)" },
  pink:   { dot: "#f472b6", bg: "rgba(244,114,182,0.36)" },
  orange: { dot: "#fb923c", bg: "rgba(251,146,60,0.38)" },
};

export const DEFAULT_MARK_COLOR = "yellow";

export function markBg(color: string): string {
  return (MARK_COLORS[color] ?? MARK_COLORS.yellow).bg;
}

export function isMarkColor(c: string): boolean {
  return Object.prototype.hasOwnProperty.call(MARK_COLORS, c);
}

const norm = (s: string) => s.replace(/\s+/g, " ");

/** نودهای متنی مجاز — داخل دکمه/ورودی/نشان موجود نمی‌رویم */
function collectTextNodes(rootEl: Element): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = n.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      if (p.closest("button,input,textarea,select,script,style,mark[data-lexa-mark]"))
        return NodeFilter.FILTER_REJECT;
      return n.nodeValue && n.nodeValue.length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  let cur: Node | null = walker.nextNode();
  while (cur) {
    nodes.push(cur as Text);
    cur = walker.nextNode();
  }
  return nodes;
}

interface TextIndex {
  full: string;
  /** به‌ازای هر کاراکتر از full: نود مبدأ + آفست محلی */
  map: { node: Text; local: number }[];
}

/** ایندکس متن نرمال‌شدهٔ یکپارچهٔ بخش (فاصله‌های تکراری جمع می‌شوند) */
function buildIndex(secEl: Element): TextIndex {
  let full = "";
  const map: TextIndex["map"] = [];
  for (const node of collectTextNodes(secEl)) {
    const v = node.nodeValue ?? "";
    for (let i = 0; i < v.length; i++) {
      const ch = v[i];
      if (/\s/.test(ch)) {
        if (full.length === 0 || full.endsWith(" ")) continue;
        full += " ";
        map.push({ node, local: i });
      } else {
        full += ch;
        map.push({ node, local: i });
      }
    }
  }
  return { full, map };
}

/** بازهٔ [start,end) در full را روی نودهای واقعی برمی‌گرداند */
function rangeToSegments(
  idx: TextIndex,
  start: number,
  end: number,
): { node: Text; from: number; to: number }[] {
  const segs: { node: Text; from: number; to: number }[] = [];
  for (let i = start; i < end && i < idx.map.length; i++) {
    const m = idx.map[i];
    const last = segs[segs.length - 1];
    if (last && last.node === m.node) {
      last.to = m.local + 1;
    } else {
      segs.push({ node: m.node, from: m.local, to: m.local + 1 });
    }
  }
  // به‌هم‌چسباندن بازه‌های پیوستهٔ یک نود
  for (let i = segs.length - 1; i > 0; i--) {
    const a = segs[i - 1];
    const b = segs[i];
    if (a.node === b.node && b.from - a.to <= 2) {
      a.to = b.to;
      segs.splice(i, 1);
    }
  }
  return segs;
}

function wrapSegment(node: Text, from: number, to: number, markId: string, color: string): HTMLElement | null {
  try {
    let mid: Text = node;
    if (to < node.length) mid = node.splitText(to);
    if (from > 0) mid = node.splitText(from);
    const mk = document.createElement("mark");
    mk.className = "lexa-mark";
    mk.dataset.lexaMark = "1";
    mk.dataset.mid = markId;
    mk.style.setProperty("--mk-bg", markBg(color));
    mid.parentNode?.insertBefore(mk, mid);
    mk.appendChild(mid);
    return mk;
  } catch {
    return null;
  }
}

function unwrapAll(rootEl: Element) {
  const marks = rootEl.querySelectorAll("mark[data-lexa-mark]");
  marks.forEach((mk) => {
    const parent = mk.parentNode;
    if (!parent) return;
    while (mk.firstChild) parent.insertBefore(mk.firstChild, mk);
    mk.remove();
  });
  try {
    rootEl.normalize();
  } catch { /* بی‌اثر */ }
}

/** اندیس وقوع (occ) یک بازهٔ انتخاب‌شده را در بخش پیدا می‌کند — زمان ذخیره */
export function locateSelection(
  secEl: Element | null,
  range: Range,
): { text: string; occ: number } | null {
  if (!secEl) return null;
  const idx = buildIndex(secEl);
  const sc = range.startContainer;
  const ec = range.endContainer;
  const so = range.startOffset;
  const eo = range.endOffset;
  let start = -1;
  let end = -1;
  for (let i = 0; i < idx.map.length; i++) {
    const m = idx.map[i];
    if (start < 0 && m.node === sc && m.local >= so - 1) start = i;
    if (start >= 0 && m.node === ec && m.local >= eo - 1) { end = i + 1; break; }
  }
  if (start < 0) {
    // کل نود شروع انتخاب است
    for (let i = 0; i < idx.map.length; i++) {
      if (idx.map[i].node === sc) { start = i; break; }
    }
  }
  if (end < 0) {
    for (let i = idx.map.length - 1; i >= 0; i--) {
      if (idx.map[i].node === ec) { end = i + 1; break; }
    }
  }
  if (start < 0 || end <= start) return null;
  const text = norm(idx.full.slice(start, end)).trim();
  if (text.length < 2) return null;
  // چندمین وقوع از این عبارت در متنِ قبل از انتخاب؟
  let occ = 0;
  let p = idx.full.indexOf(text);
  while (p >= 0 && p < start) {
    occ++;
    p = idx.full.indexOf(text, p + text.length);
  }
  return { text, occ };
}

/** همهٔ نشان‌های ذخیره‌شده را روی DOM بخش‌ها اعمال می‌کند (idempotent) */
export function applyMarksToSections(
  sectionEls: Map<string, Element>,
  marks: { id: string; secId: string; text: string; color: string; occ?: number }[],
): void {
  // ۱) پاک‌سازی نشان‌های قبلی
  for (const el of sectionEls.values()) unwrapAll(el);

  // ۲) اعمال نشان‌ها — بلندترین عبارت‌ها اول تا هم‌پوشانی حداقلی شود
  const sorted = [...marks].sort((a, b) => (b.text?.length ?? 0) - (a.text?.length ?? 0));
  for (const mark of sorted) {
    const secEl = sectionEls.get(mark.secId);
    if (!secEl || !mark.text || mark.text.length < 2) continue;
    const idx = buildIndex(secEl);
    const haystack = idx.full;
    const needle = norm(mark.text).trim();
    if (!needle) continue;
    // همهٔ وقوع‌ها
    const at: number[] = [];
    let p = haystack.indexOf(needle);
    while (p >= 0) {
      at.push(p);
      p = haystack.indexOf(needle, p + needle.length);
    }
    if (!at.length) continue;
    const chosen = at[Math.min(mark.occ ?? 0, at.length - 1)];
    const segs = rangeToSegments(idx, chosen, chosen + needle.length);
    for (const seg of segs) {
      if (seg.to <= seg.from) continue;
      wrapSegment(seg.node, seg.from, seg.to, mark.id, mark.color);
    }
  }
}

/** آیا المان داخل یک ناحیهٔ قابل انتخاب است (نه دکمه و ورودی) */
export function isSelectableNode(el: Element | null): boolean {
  if (!el) return false;
  return !el.closest("button,input,textarea,select,a,[contenteditable],mark[data-lexa-mark] .law-actions,summary");
}
