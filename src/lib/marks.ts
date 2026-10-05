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

/** نودهای متنی مجاز — داخل دکمه/ورودی نمی‌رویم؛ متن نشان‌های موجود بسته به حالت */
function collectTextNodes(rootEl: Element, includeMarks = false): Text[] {
  const nodes: Text[] = [];
  const skip = includeMarks
    ? "button,input,textarea,select,script,style"
    : "button,input,textarea,select,script,style,mark[data-lexa-mark]";
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = n.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      if (p.closest(skip)) return NodeFilter.FILTER_REJECT;
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

/** ایندکس کاراکتری یک بخش — مبنای مشترک ذخیره، اعمال و ویرایش بازهٔ نشان */
export interface SectionIndex {
  full: string;
  /** به‌ازای هر کاراکتر از full: نود مبدأ + آفست محلی + شمارهٔ نود در nodes */
  map: { node: Text; local: number; ni: number }[];
  nodes: Text[];
  pos: Map<Text, number>;
}
type TextIndex = SectionIndex;

/** ایندکس متن نرمال‌شدهٔ یکپارچه از نودها (فاصله‌های تکراری جمع می‌شوند) */
function indexFromNodes(nodes: Text[]): TextIndex {
  let full = "";
  const map: TextIndex["map"] = [];
  const pos = new Map<Text, number>();
  nodes.forEach((node, ni) => {
    pos.set(node, ni);
    const v = node.nodeValue ?? "";
    for (let i = 0; i < v.length; i++) {
      const ch = v[i];
      if (/\s/.test(ch)) {
        if (full.length === 0 || full.endsWith(" ")) continue;
        full += " ";
        map.push({ node, local: i, ni });
      } else {
        full += ch;
        map.push({ node, local: i, ni });
      }
    }
  });
  return { full, map, nodes, pos };
}

/** ایندکس متن نرمال‌شدهٔ یکپارچهٔ بخش */
function buildIndex(secEl: Element, includeMarks = false): TextIndex {
  // includeMarks=true: متن نشان‌های موجود هم جزو ایندکس می‌آید — برای ویرایش/گسترش نشان
  // و برای انتخاب متنی که روی نشان قبلی می‌افتد. اعمال نشان همیشه بعد از unwrap است و به این فلگ نیازی ندارد.
  return indexFromNodes(collectTextNodes(secEl, includeMarks));
}

/** ایندکس کامل بخش همراه متن نشان‌های موجود — برای ویرایش بازه */
export function sectionIndex(secEl: Element): SectionIndex {
  return buildIndex(secEl, true);
}

/** نقطهٔ DOM ← اندیس اولین نویسهٔ ایندکس که در آن نقطه یا بعد از آن است (0..full.length)
 *  ‎-1 یعنی نقطهٔ نامعتبر. */
export function pointToIndex(idx: SectionIndex, node: Node, offset: number): number {
  const map = idx.map;
  const pi = node.nodeType === Node.TEXT_NODE ? idx.pos.get(node as Text) : undefined;
  if (pi !== undefined) {
    // جستجوی دودویی روی (ni, local) — ترتیب سندی
    let lo = 0, hi = map.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const m = map[mid];
      if (m.ni < pi || (m.ni === pi && m.local < offset)) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
  const r = document.createRange();
  try {
    r.setStart(node, offset);
    r.collapse(true);
  } catch {
    return -1;
  }
  let lo = 0, hi = map.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    let c = 0;
    try { c = r.comparePoint(map[mid].node, map[mid].local); } catch { return -1; }
    if (c < 0) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** بازهٔ [s,e) ایندکس ← متن، اندیس وقوع و لنگر متنی (همان قالب ذخیره) */
export function spanInfo(
  idx: SectionIndex,
  s: number,
  e: number,
): { text: string; occ: number; pfx: string; sfx: string; s: number; e: number } | null {
  const full = idx.full;
  s = Math.max(0, s);
  e = Math.min(full.length, e);
  while (s < e && full[s] === " ") s++;
  while (e > s && full[e - 1] === " ") e--;
  if (e <= s) return null;
  const text = full.slice(s, e);
  if (text.length < 2) return null;
  // چندمین وقوع از این عبارت در متنِ قبل از بازه؟ (هم‌خوان با applyMarksToSections)
  let occ = 0;
  let p = full.indexOf(text);
  while (p >= 0 && p < s) {
    occ++;
    p = full.indexOf(text, p + text.length);
  }
  return { text, occ, pfx: ctxBefore(full, s), sfx: ctxAfter(full, e), s, e };
}

/** بازهٔ [s,e) ایندکس ← Range واقعی DOM (از اولین تا آخرین نویسه) */
export function spanRange(idx: SectionIndex, s: number, e: number): Range | null {
  if (s < 0 || e > idx.map.length || e <= s) return null;
  const a = idx.map[s];
  const b = idx.map[e - 1];
  const r = document.createRange();
  try {
    r.setStart(a.node, a.local);
    r.setEnd(b.node, b.local + 1);
  } catch {
    return null;
  }
  return r;
}

/** قطعه‌های متنی بازهٔ [s,e) به ترتیب سند — هر نود یک قطعه */
export function spanSegments(idx: SectionIndex, s: number, e: number): { t: Text; s: number; e: number }[] {
  const out: { t: Text; s: number; e: number }[] = [];
  for (let i = Math.max(0, s); i < e && i < idx.map.length; i++) {
    const m = idx.map[i];
    const last = out[out.length - 1];
    if (last && last.t === m.node) last.e = m.local + 1;
    else out.push({ t: m.node, s: m.local, e: m.local + 1 });
  }
  return out;
}

/** بازهٔ فعلی یک نشان در ایندکس — از اولین تا آخرین نویسه‌ای که داخل <mark> همان id است */
export function markSpan(idx: SectionIndex, mid: string): { s: number; e: number } | null {
  let s = -1;
  let e = -1;
  let lastNode: Text | null = null;
  let inMark = false;
  for (let i = 0; i < idx.map.length; i++) {
    const m = idx.map[i];
    if (m.node !== lastNode) {
      lastNode = m.node;
      const mk = m.node.parentElement?.closest("mark[data-lexa-mark]") as HTMLElement | null;
      inMark = !!mk && mk.dataset.mid === mid;
      if (!inMark && mk) {
        // نشان تودرتو: نشان کوتاه‌تر داخل این نشان — والدهای بالاتر هم بررسی شوند
        let up = mk.parentElement?.closest("mark[data-lexa-mark]") as HTMLElement | null;
        while (up && !inMark) {
          inMark = up.dataset.mid === mid;
          up = up.parentElement?.closest("mark[data-lexa-mark]") as HTMLElement | null;
        }
      }
    }
    if (inMark) {
      if (s < 0) s = i;
      e = i + 1;
    }
  }
  return s >= 0 && e > s ? { s, e } : null;
}

/* ── لنگر متنی (context anchor) — حفظ نشان در برابر آپدیت محتوا ──────────────
 * مشکل: نشان با «متن + اندیس وقوع» جایابی می‌شد؛ اگر آپدیت محتوا جایی قبل از
 * جملهٔ نشان‌شده تغییر می‌داد، تعداد وقوع‌ها جابه‌جا می‌شد و نشان می‌پرید
 * روی وقوع اشتباه. راه‌حل: هنگام ذخیره، چند نویسهٔ قبل/بعدِ جمله هم ذخیره می‌شود
 * (pfx/sfx) و هنگام اعمال، وقوعی انتخاب می‌شود که بافتِ اطرافش با لنگر جور باشد.
 * اگر جملهٔ نشان‌شده خودش دیگر در متن نباشد (آپدیت شامل همان بخش شده)، نشان
 * رها می‌شود — دقیقاً طبق خواست کاربر: «اگر ربطی نداشت، مارک نباید بپرد». */
const CTX_LEN = 28;

function ctxBefore(full: string, pos: number): string {
  return full.slice(Math.max(0, pos - CTX_LEN), pos).trimStart();
}

function ctxAfter(full: string, pos: number): string {
  return full.slice(pos, pos + CTX_LEN).trimEnd();
}

/** همهٔ وقوع‌های needle در haystack */
function occurrences(haystack: string, needle: string): number[] {
  const at: number[] = [];
  let p = haystack.indexOf(needle);
  while (p >= 0) {
    at.push(p);
    p = haystack.indexOf(needle, p + needle.length);
  }
  return at;
}

/** نسبت جور بودن بافت اطراف یک وقوع با لنگر ذخیره‌شده — ۰ تا ۱ */
function scoreOccurrence(haystack: string, pos: number, len: number, pfx: string, sfx: string): number {
  let match = 0;
  let total = 0;
  if (pfx) {
    const n = Math.min(pfx.length, pos);
    total += pfx.length;
    for (let i = 0; i < n; i++) if (haystack[pos - n + i] === pfx[i]) match++;
  }
  if (sfx) {
    const e = pos + len;
    const n = Math.min(sfx.length, haystack.length - e);
    total += sfx.length;
    for (let i = 0; i < n; i++) if (haystack[e + i] === sfx[i]) match++;
  }
  return total ? match / total : 0;
}

const CTX_MIN_SCORE = 0.5;

/** وقوع درست را برمی‌گزیند: با لنگر اگر بود، وگرنه اندیس وقوع قدیمی */
function pickOccurrence(haystack: string, needle: string, at: number[], mark: { occ?: number; pfx?: string; sfx?: string }): number {
  if (at.length === 1) return at[0];
  const pfx = (mark.pfx ?? "").trim();
  const sfx = (mark.sfx ?? "").trim();
  if (pfx || sfx) {
    let best = at[0];
    let bestScore = -1;
    for (const p of at) {
      const s = scoreOccurrence(haystack, p, needle.length, pfx, sfx);
      if (s > bestScore) { bestScore = s; best = p; }
    }
    if (bestScore >= CTX_MIN_SCORE) return best;
  }
  return at[Math.min(mark.occ ?? 0, at.length - 1)];
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
    // برش دقیق [from..to) — باگ قدیمی: وقتی from=0 بود، بعد از splitText(to)
    // متغیر به «دم» اشاره می‌کرد و نشان تا انتهای نود متنی کش می‌آمد
    let target: Text = node;
    if (to < node.length) node.splitText(to); // node اکنون فقط [0..to) است
    if (from > 0) target = node.splitText(from); // node = سر [0..from) ؛ target = [from..to)
    const mk = document.createElement("mark");
    mk.className = "lexa-mark";
    mk.dataset.lexaMark = "1";
    mk.dataset.mid = markId;
    mk.style.setProperty("--mk-bg", markBg(color));
    target.parentNode?.insertBefore(mk, target);
    mk.appendChild(target);
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

/** اندیس وقوع + لنگر متنی یک بازهٔ انتخاب‌شده را در بخش پیدا می‌کند — زمان ذخیره
 *  0.10.11: مبتنی بر pointToIndex (ترتیب سندی دقیق، حتی وقتی سر/تهٔ انتخاب روی المان است) */
export function locateSelection(
  secEl: Element | null,
  range: Range,
): { text: string; occ: number; pfx: string; sfx: string } | null {
  if (!secEl) return null;
  // includeMarks: انتخاب ممکن است روی متن نشان قبلی بیفتد — باید کامل دیده شود
  const idx = buildIndex(secEl, true);
  const s = pointToIndex(idx, range.startContainer, range.startOffset);
  const e = pointToIndex(idx, range.endContainer, range.endOffset);
  if (s < 0 || e < 0 || e <= s) return null;
  const info = spanInfo(idx, s, e);
  if (!info) return null;
  return { text: norm(info.text), occ: info.occ, pfx: info.pfx, sfx: info.sfx };
}

/** همهٔ نشان‌های ذخیره‌شده را روی DOM بخش‌ها اعمال می‌کند (idempotent) */
export function applyMarksToSections(
  sectionEls: Map<string, Element>,
  marks: { id: string; secId: string; text: string; color: string; occ?: number; pfx?: string; sfx?: string }[],
): void {
  // ۱) پاک‌سازی نشان‌های قبلی
  for (const el of sectionEls.values()) unwrapAll(el);

  // ایندکس هر بخش یک‌بار ساخته می‌شود — بعد از unwrap هیچ نشان چیزی باقی نمانده
  const idxCache = new Map<string, TextIndex>();
  const indexOf = (sid: string): TextIndex | null => {
    const el = sectionEls.get(sid);
    if (!el) return null;
    let idx = idxCache.get(sid);
    if (!idx) { idx = buildIndex(el); idxCache.set(sid, idx); }
    return idx;
  };

  // ۲) اعمال نشان‌ها — بلندترین عبارت‌ها اول تا هم‌پوشانی حداقلی شود
  const sorted = [...marks].sort((a, b) => (b.text?.length ?? 0) - (a.text?.length ?? 0));
  for (const mark of sorted) {
    if (!mark.text || mark.text.length < 2) continue;
    const needle = norm(mark.text).trim();
    if (!needle) continue;

    let secId = mark.secId;
    let idx = indexOf(secId);
    let chosen = -1;
    if (idx) {
      const at = occurrences(idx.full, needle);
      if (at.length) chosen = pickOccurrence(idx.full, needle, at, mark);
    }

    // ۳) جستجوی سراسری — اگر بخش نشان دیگر جای خودش نبود (آپدیت ساختار بخش‌ها را
    // جابه‌جا کرده) اما جملهٔ نشان‌شده با همان بافت جایی دیگر هست، نشان همان‌جا
    // می‌نشیند و نمی‌پرد. بدون لنگر متنی این مسیر انجام نمی‌شود تا نشان تصادفی
    // به بخش بی‌ربط نچسبد.
    if (chosen < 0 && (mark.pfx || mark.sfx)) {
      const pfx = (mark.pfx ?? "").trim();
      const sfx = (mark.sfx ?? "").trim();
      let bestScore = 0;
      let bestSid = "";
      let bestPos = -1;
      for (const sid of sectionEls.keys()) {
        if (sid === secId) continue;
        const i2 = indexOf(sid);
        if (!i2) continue;
        for (const p of occurrences(i2.full, needle)) {
          const s = scoreOccurrence(i2.full, p, needle.length, pfx, sfx);
          if (s > bestScore) { bestScore = s; bestSid = sid; bestPos = p; }
        }
      }
      if (bestPos >= 0 && bestScore >= 0.6) {
        secId = bestSid;
        idx = indexOf(bestSid);
        chosen = bestPos;
      }
    }

    if (!idx || chosen < 0) continue; // جملهٔ نشان‌شده دیگر وجود ندارد — رها می‌شود
    const segs = rangeToSegments(idx, chosen, chosen + needle.length);
    for (const seg of segs) {
      if (seg.to <= seg.from) continue;
      wrapSegment(seg.node, seg.from, seg.to, mark.id, mark.color);
    }
  }
}

/* ── ویرایش بازهٔ نشان ───────────────────────────────────────────────────────────
 * لمس سادهٔ نشان → دو دستگیرهٔ اختصاصی روی سر و ته نشان (MarkHandles.tsx).
 * 0.10.11: ویرایش کاملاً روی اندیس‌های همین ایندکس کاراکتری انجام می‌شود
 * (sectionIndex/markSpan/pointToIndex/spanInfo) — همان مبنایی که نشان با آن ذخیره و
 * اعمال می‌شود؛ پس بازهٔ پیش‌نمایش و بازهٔ ذخیره‌شده هرگز از هم جدا نمی‌افتند. */

/** آیا المان داخل یک ناحیهٔ قابل انتخاب است (نه دکمه و ورودی) */
export function isSelectableNode(el: Element | null): boolean {
  if (!el) return false;
  return !el.closest("button,input,textarea,select,a,[contenteditable],mark[data-lexa-mark] .law-actions,summary");
}
