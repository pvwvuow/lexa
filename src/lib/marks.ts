"use client";
/* ─── موتور نشان‌گذاری (هایلایت) متن درس — نسخهٔ ۲ (بازسازی کامل 0.10.14) ────────
 *
 * ریشهٔ باگ‌های نسخهٔ قبل: نشان‌ها با شکستن نودهای متنی و پیچیدن <mark> دورشان
 * رندر می‌شدند؛ هر بازچینی نودها را عوض می‌کرد و ایندکس، انتخاب بومی، دستگیره‌ها و حتی
 * React را از هم جدا می‌انداخت («دستگیره جای رندوم»، «نشان می‌پرد»، «ری‌مارک خراب»).
 *
 * طرح تازه:
 *  ۱) مدل فقط‌خواندنی: برای هر بخش یک ایندکس کاراکتری نرمال‌شده ساخته و هر نشان
 *     به بازهٔ [s,e) همان ایندکس تبدیل می‌شود. همهٔ محاسبات (لمس، انتخاب، دستگیره،
 *     ذخیره) روی همین اندیس‌های متنی است؛ نه روی المان‌های DOM.
 *  ۲) رنگ‌آمیزی بی‌دستکاری DOM با CSS Custom Highlight API (یک Highlight برای هر رنگ).
 *     نودهای متنی هرگز عوض نمی‌شوند، پس بازه‌ها حین کشیدن و بعد از ذخیره معتبر می‌مانند.
 *     وب‌ویوهای خیلی قدیمی (بدون این API): فال‌بک <mark> با برش از انتها به ابتدا (بدون نود کهنه).
 *  ۳) لمس روی نشان = آزمون نقطه (caret → اندیس → نشانِ شامل آن اندیس)، نه closest("mark").
 *  ۴) ذخیره = «نقشهٔ تغییر»: نشان تازه/ویرایش‌شده برنده است و نشان‌های هم‌پوشان،
 *     تراش خورده/دونیمه/حذف می‌شوند — هیچ‌وقت دو نشان روی هم نمی‌افتند.
 * قالب ذخیره (متن + وقوع + لنگر بافت) همان قبلی است — سینک و دادهٔ قدیمی سالم.
 * ─────────────────────────────────────────────────────────────────────────── */

import { makeGeo, type Box } from "./mark-geom";

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

/** المان‌هایی که متنشان جزو متن قابل نشان‌گذاری نیست */
const SKIP = "button,input,textarea,select,script,style,[data-mark-ui]";

function collectTextNodes(rootEl: Element): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = n.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      if (p.closest(SKIP)) return NodeFilter.FILTER_REJECT;
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

/* ═══ ایندکس کاراکتری بخش ═══════════════════════════════════════════════════════════════════ */

/** متن نرمال‌شدهٔ یک بخش (فاصله‌های پیاپی یکی) + نگاشت هر کاراکتر به نود/آفست واقعی */
export interface SectionIndex {
  full: string;
  map: { node: Text; local: number; ni: number }[];
  nodes: Text[];
  pos: Map<Text, number>;
}

function indexFromNodes(nodes: Text[]): SectionIndex {
  let full = "";
  const map: SectionIndex["map"] = [];
  const pos = new Map<Text, number>();
  nodes.forEach((node, ni) => {
    pos.set(node, ni);
    const v = node.nodeValue ?? "";
    for (let i = 0; i < v.length; i++) {
      const ch = v[i];
      if (/\s/.test(ch)) {
        if (full.length === 0 || full.endsWith(" ")) continue;
        full += " ";
      } else {
        full += ch;
      }
      map.push({ node, local: i, ni });
    }
  });
  return { full, map, nodes, pos };
}

export function sectionIndex(secEl: Element): SectionIndex {
  return indexFromNodes(collectTextNodes(secEl));
}

/** نقطهٔ DOM ← اندیس اولین نویسهٔ ایندکس که در آن نقطه یا بعد از آن است (0..full.length)؛ ‎-1 نامعتبر */
export function pointToIndex(idx: SectionIndex, node: Node, offset: number): number {
  const map = idx.map;
  const pi = node.nodeType === Node.TEXT_NODE ? idx.pos.get(node as Text) : undefined;
  if (pi !== undefined) {
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

/* ── لنگر متنی: چند نویسهٔ قبل/بعد جمله تا با آپدیت محتوا نشان نپرد ── */
const CTX_LEN = 28;
const CTX_MIN_SCORE = 0.5;

function ctxBefore(full: string, pos: number): string {
  return full.slice(Math.max(0, pos - CTX_LEN), pos).trimStart();
}
function ctxAfter(full: string, pos: number): string {
  return full.slice(pos, pos + CTX_LEN).trimEnd();
}

function occurrences(haystack: string, needle: string): number[] {
  const at: number[] = [];
  let p = haystack.indexOf(needle);
  while (p >= 0) {
    at.push(p);
    p = haystack.indexOf(needle, p + needle.length);
  }
  return at;
}

function scoreOccurrence(haystack: string, pos: number, len: number, pfx: string, sfx: string): number {
  let match = 0;
  let total = 0;
  if (pfx) {
    const n = Math.min(pfx.length, pos);
    total += pfx.length;
    for (let i = 0; i < n; i++) if (haystack[pos - n + i] === pfx[pfx.length - n + i]) match++;
  }
  if (sfx) {
    const e = pos + len;
    const n = Math.min(sfx.length, haystack.length - e);
    total += sfx.length;
    for (let i = 0; i < n; i++) if (haystack[e + i] === sfx[i]) match++;
  }
  return total ? match / total : 0;
}

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

/** بازهٔ [s,e) ← متن، اندیس وقوع و لنگر (قالب ذخیره)؛ فاصلهٔ سر و ته حذف می‌شود */
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
  if (text.replace(/\s+/g, "").length < 2) return null;
  // شمارش وقوع دقیقاً همان شیوهٔ occurrences() در جایابی
  let occ = 0;
  let p = full.indexOf(text);
  while (p >= 0 && p < s) {
    occ++;
    p = full.indexOf(text, p + text.length);
  }
  return { text, occ, pfx: ctxBefore(full, s), sfx: ctxAfter(full, e), s, e };
}

/** بازهٔ [s,e) ← Range واقعی DOM */
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
export function spanSegments(idx: SectionIndex, s: number, e: number): { t: Text; s: number; e: number; ni: number }[] {
  const out: { t: Text; s: number; e: number; ni: number }[] = [];
  for (let i = Math.max(0, s); i < e && i < idx.map.length; i++) {
    const m = idx.map[i];
    const last = out[out.length - 1];
    if (last && last.t === m.node) last.e = m.local + 1;
    else out.push({ t: m.node, s: m.local, e: m.local + 1, ni: m.ni });
  }
  return out;
}

/* ── چسبیدن به کلمه (نیم‌فاصله مرز نیست تا «می‌شود» یک کلمه بماند) ── */
const BOUNDARY = /[\s\u060C\u061B\u061F.,;:!?()[\]{}\u00AB\u00BB"'\u201C\u201D\u2018\u2019\-\u2013\u2014/\\]/;
const isB = (c: string | undefined) => c === undefined || BOUNDARY.test(c);

/** ابتدای بازه ← ابتدای کلمه (روی مرز بود: اولین کلمهٔ بعدی) */
export function snapStart(full: string, i: number): number {
  const len = full.length;
  if (!len) return 0;
  i = Math.max(0, Math.min(i, len - 1));
  if (isB(full[i])) { while (i < len - 1 && isB(full[i])) i++; }
  else { while (i > 0 && !isB(full[i - 1])) i--; }
  return i;
}

/** انتهای بازه (انحصاری) ← انتهای کلمه (بعد از مرز بود: انتهای کلمهٔ قبلی) */
export function snapEnd(full: string, j: number): number {
  const len = full.length;
  if (!len) return 0;
  j = Math.max(1, Math.min(j, len));
  if (isB(full[j - 1])) { while (j > 1 && isB(full[j - 1])) j--; }
  else { while (j < len && !isB(full[j])) j++; }
  return j;
}

/* ═══ مدل نشان‌های یک جلسه ══════════════════════════════════════════════════════════════════ */

export interface StoredMark {
  id: string;
  secId: string;
  text: string;
  color: string;
  occ?: number;
  pfx?: string;
  sfx?: string;
  createdAt?: number;
}

/** نشانِ جایابی‌شده روی ایندکس بخش */
export interface ResolvedMark {
  id: string;
  secId: string;
  color: string;
  s: number;
  e: number;
  createdAt: number;
}

export interface MarkModel {
  root: Element;
  sig: string;
  sections: Map<string, Element>;
  idx: Map<string, SectionIndex>;
  resolved: ResolvedMark[];
  byId: Map<string, ResolvedMark>;
}

function rootSig(root: Element, nSections: number): string {
  return `${nSections}:${root.textContent?.length ?? 0}`;
}

function collectSections(root: Element): Map<string, Element> {
  const sections = new Map<string, Element>();
  root.querySelectorAll("[data-sec-id]").forEach((el) => {
    const sid = el.getAttribute("data-sec-id");
    if (sid && !sections.has(sid)) sections.set(sid, el);
  });
  return sections;
}

function resolveAll(idx: Map<string, SectionIndex>, marks: StoredMark[]): ResolvedMark[] {
  const out: ResolvedMark[] = [];
  for (const m of marks) {
    if (!m || typeof m.id !== "string" || typeof m.text !== "string") continue;
    const needle = norm(m.text).trim();
    if (needle.replace(/\s+/g, "").length < 2) continue;
    let sid = m.secId;
    let pos = -1;
    const own = idx.get(sid);
    if (own) {
      const at = occurrences(own.full, needle);
      if (at.length) pos = pickOccurrence(own.full, needle, at, m);
    }
    // بخش خودش نبود (آپدیت محتوا بخش‌ها را جابه‌جا کرده): فقط با لنگر متنی قوی جای دیگر
    if (pos < 0 && (m.pfx || m.sfx)) {
      const pfx = (m.pfx ?? "").trim();
      const sfx = (m.sfx ?? "").trim();
      let bestScore = 0;
      for (const [osid, ix] of idx) {
        if (osid === m.secId) continue;
        for (const p of occurrences(ix.full, needle)) {
          const sc = scoreOccurrence(ix.full, p, needle.length, pfx, sfx);
          if (sc > bestScore) { bestScore = sc; sid = osid; pos = p; }
        }
      }
      if (bestScore < 0.6) pos = -1;
    }
    if (pos < 0) continue; // جملهٔ نشان‌شده دیگر وجود ندارد — نشان رها می‌شود (نمی‌پرد)
    out.push({
      id: m.id,
      secId: sid,
      color: isMarkColor(m.color) ? m.color : DEFAULT_MARK_COLOR,
      s: pos,
      e: pos + needle.length,
      createdAt: typeof m.createdAt === "number" ? m.createdAt : 0,
    });
  }
  return out;
}

/** مدل تازهٔ نشان‌های یک ریشه (مثلاً article جلسه) — هیچ تغییری در DOM نمی‌دهد */
export function buildModel(root: Element, marks: StoredMark[]): MarkModel {
  const sections = collectSections(root);
  const idx = new Map<string, SectionIndex>();
  for (const [sid, el] of sections) idx.set(sid, sectionIndex(el));
  const resolved = resolveAll(idx, marks);
  return { root, sig: rootSig(root, sections.size), sections, idx, resolved, byId: new Map(resolved.map((r) => [r.id, r])) };
}

/** ایندکس تازه با همان بازه‌ها — متن عوض نشده، فقط نودها (فال‌بک DOM) */
function reindex(model: MarkModel): MarkModel {
  const sections = collectSections(model.root);
  const idx = new Map<string, SectionIndex>();
  for (const [sid, el] of sections) idx.set(sid, sectionIndex(el));
  return { ...model, sig: rootSig(model.root, sections.size), sections, idx };
}

/** آیا مدل هنوز با DOM فعلی می‌خواند؟ (محتوای تازه، بخش تازه، نود عوض‌شده = نه) */
export function modelFresh(model: MarkModel | null, root: Element | null): boolean {
  if (!model || !root || model.root !== root || !root.isConnected) return false;
  const n = root.querySelectorAll("[data-sec-id]").length;
  if (rootSig(root, n) !== model.sig) return false;
  for (const [sid, el] of model.sections) {
    if (!el.isConnected) return false;
    const ix = model.idx.get(sid);
    if (!ix || !ix.nodes.length) continue;
    if (!ix.nodes[0].isConnected || !ix.nodes[ix.nodes.length - 1].isConnected) return false;
    if (ix.nodes.length > 2 && !ix.nodes[ix.nodes.length >> 1].isConnected) return false;
  }
  return true;
}

/* ═══ رنگ‌آمیزی ════════════════════════════════════════════════════════════════════════════ */

type HlRegistry = { set(name: string, h: unknown): unknown; delete(name: string): unknown };
function hlApi(): { reg: HlRegistry; Ctor: new (...r: Range[]) => unknown } | null {
  if (typeof globalThis === "undefined") return null;
  const g = globalThis as unknown as { CSS?: { highlights?: HlRegistry }; Highlight?: new (...r: Range[]) => unknown };
  if (!g.CSS?.highlights || typeof g.Highlight !== "function") return null;
  return { reg: g.CSS.highlights, Ctor: g.Highlight };
}

/** آیا رنگ‌آمیزی بی‌دستکاری DOM ممکن است (وب‌ویو/مرورگر امروزی) */
export function highlightSupported(): boolean {
  return !!hlApi();
}

const HL_PREFIX = "lexa-mk-";

function ensureHlCss(): void {
  if (document.getElementById("lexa-mk-style")) return;
  const st = document.createElement("style");
  st.id = "lexa-mk-style";
  st.textContent = Object.entries(MARK_COLORS)
    .map(([k, c]) => `::highlight(${HL_PREFIX}${k}){background-color:${c.bg};}`)
    .join("\n");
  document.head.appendChild(st);
}

/** بازهٔ موقت یک نشان حین کشیدن دستگیره (پیش‌نمایش زنده) */
export interface SpanOverride { id: string; s: number; e: number }

function unwrapAll(rootEl: Element) {
  const marks = rootEl.querySelectorAll("mark[data-lexa-mark]");
  if (!marks.length) return;
  marks.forEach((mk) => {
    const parent = mk.parentNode;
    if (!parent) return;
    while (mk.firstChild) parent.insertBefore(mk.firstChild, mk);
    mk.remove();
  });
  try { rootEl.normalize(); } catch { /* بی‌اثر */ }
}

/** فال‌بک وب‌ویوهای قدیمی: <mark> — قطعه‌ها از انتهای هر نود به ابتدا بریده می‌شوند
 *  تا آفست‌های قطعه‌های بعدی همیشه معتبر بمانند (باگ «نشان کش می‌آید/می‌پرد» نسخهٔ قبل) */
function wrapResolved(model: MarkModel, override: SpanOverride | null): void {
  type Seg = { t: Text; s: number; e: number; ni: number; id: string; color: string; sec: string };
  const segs: Seg[] = [];
  for (const r of model.resolved) {
    const ix = model.idx.get(r.secId);
    if (!ix) continue;
    const s = override && override.id === r.id ? override.s : r.s;
    const e = override && override.id === r.id ? override.e : r.e;
    for (const g of spanSegments(ix, s, e)) segs.push({ ...g, id: r.id, color: r.color, sec: r.secId });
  }
  segs.sort((a, b) => (a.sec === b.sec ? (b.ni - a.ni) || (b.s - a.s) : a.sec < b.sec ? -1 : 1));
  const taken = new Map<Text, [number, number][]>();
  for (const g of segs) {
    if (g.e <= g.s) continue;
    const used = taken.get(g.t) ?? [];
    if (used.some(([a, b]) => g.s < b && g.e > a)) continue; // هم‌پوشانی قدیمی — اولی برنده
    used.push([g.s, g.e]);
    taken.set(g.t, used);
    try {
      const node = g.t;
      if (g.e < node.length) node.splitText(g.e);
      const target = g.s > 0 ? node.splitText(g.s) : node;
      const mk = document.createElement("mark");
      mk.className = "lexa-mark";
      mk.dataset.lexaMark = "1";
      mk.dataset.mid = g.id;
      mk.style.setProperty("--mk-bg", markBg(g.color));
      target.parentNode?.insertBefore(mk, target);
      mk.appendChild(target);
    } catch { /* قطعهٔ نامعتبر — رد می‌شود */ }
  }
}

/**
 * رنگ‌آمیزی همهٔ نشان‌های مدل (با پیش‌نمایش اختیاری). خروجی: مدل معتبر بعد از رنگ‌آمیزی
 * (در حالت Highlight همان مدل؛ در فال‌بک DOM ایندکس تازه با همان بازه‌ها).
 */
export function paintMarks(model: MarkModel, override: SpanOverride | null = null): MarkModel {
  const api = hlApi();
  if (api) {
    ensureHlCss();
    // بقایای <mark> نسخه‌های قبل (یا HMR) یک‌بار پاک می‌شود
    if (model.root.querySelector("mark[data-lexa-mark]")) {
      unwrapAll(model.root);
      model = reindex(model);
    }
    const groups = new Map<string, Range[]>();
    for (const r of model.resolved) {
      const ix = model.idx.get(r.secId);
      if (!ix) continue;
      const s = override && override.id === r.id ? override.s : r.s;
      const e = override && override.id === r.id ? override.e : r.e;
      const range = spanRange(ix, s, e);
      if (!range) continue;
      const list = groups.get(r.color);
      if (list) list.push(range);
      else groups.set(r.color, [range]);
    }
    for (const k of Object.keys(MARK_COLORS)) {
      const list = groups.get(k);
      try {
        if (list && list.length) api.reg.set(HL_PREFIX + k, new api.Ctor(...list));
        else api.reg.delete(HL_PREFIX + k);
      } catch { /* بی‌اثر */ }
    }
    return model;
  }
  unwrapAll(model.root);
  const clean = reindex(model);
  wrapResolved(clean, override);
  return reindex(clean);
}

/** پاک‌کردن همهٔ رنگ‌آمیزی‌ها (خروج از جلسه) */
export function clearMarkPaint(): void {
  const api = hlApi();
  if (!api) return;
  for (const k of Object.keys(MARK_COLORS)) {
    try { api.reg.delete(HL_PREFIX + k); } catch { /* بی‌اثر */ }
  }
}

/* ═══ لمس و انتخاب ══════════════════════════════════════════════════════════════════════════ */

/** نقطهٔ متنی زیر مختصات واقعی صفحه — استاندارد و فال‌بک وبکیت */
export function caretPoint(x: number, y: number): { node: Text; offset: number } | null {
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

function charHit(ix: SectionIndex, c: number, x: number, y: number, t: (r: Box) => Box): boolean {
  const m = ix.map[c];
  if (!m) return false;
  const r = document.createRange();
  try {
    r.setStart(m.node, m.local);
    r.setEnd(m.node, m.local + 1);
  } catch {
    return false;
  }
  for (const b of Array.from(r.getClientRects())) {
    if (b.height < 0.5) continue;
    const tb = t(b);
    if (x >= tb.left - 6 && x <= tb.right + 6 && y >= tb.top - 4 && y <= tb.bottom + 4) return true;
  }
  return false;
}

/** نشانِ زیر انگشت (مختصات واقعی صفحه) — اگر چند تا بود، کوتاه‌ترین */
export function hitTest(model: MarkModel, x: number, y: number, zoom: number): ResolvedMark | null {
  if (!model.resolved.length) return null;
  const pt = caretPoint(x, y);
  if (!pt || !model.root.contains(pt.node)) return null;
  const secEl = pt.node.parentElement?.closest("[data-sec-id]");
  const sid = secEl?.getAttribute("data-sec-id");
  if (!sid) return null;
  const ix = model.idx.get(sid);
  if (!ix) return null;
  const p = pointToIndex(ix, pt.node, pt.offset);
  if (p < 0) return null;
  const geo = makeGeo(model.root, zoom);
  for (const c of [p, p - 1]) {
    if (c < 0 || c >= ix.map.length) continue;
    let best: ResolvedMark | null = null;
    for (const r of model.resolved) {
      if (r.secId !== sid || c < r.s || c >= r.e) continue;
      if (!best || r.e - r.s < best.e - best.s) best = r;
    }
    if (best && charHit(ix, c, x, y, geo.t)) return best;
  }
  return null;
}

/** انتخاب بومی ← بازهٔ ایندکس (اگر از بخش بیرون زد، به بخش شروع بریده می‌شود) */
export function selectionSpan(model: MarkModel, range: Range): { secId: string; s: number; e: number } | null {
  const startNode = range.startContainer;
  const startEl = startNode.nodeType === Node.TEXT_NODE ? startNode.parentElement : (startNode as Element);
  const secEl = startEl?.closest?.("[data-sec-id]");
  if (!secEl || !model.root.contains(secEl)) return null;
  const sid = secEl.getAttribute("data-sec-id");
  if (!sid) return null;
  const ix = model.idx.get(sid);
  if (!ix) return null;
  const s = pointToIndex(ix, range.startContainer, range.startOffset);
  const e = secEl.contains(range.endContainer)
    ? pointToIndex(ix, range.endContainer, range.endOffset)
    : ix.full.length;
  if (s < 0 || e < 0 || e <= s) return null;
  const info = spanInfo(ix, s, e);
  if (!info) return null;
  return { secId: sid, s: info.s, e: info.e };
}

/** متن بازه (برای کپی) */
export function spanText(model: MarkModel, secId: string, s: number, e: number): string {
  const ix = model.idx.get(secId);
  return ix ? ix.full.slice(Math.max(0, s), Math.max(0, e)).trim() : "";
}

/** مستطیل گزارش‌شدهٔ کل بازه — برای جایگیری نوار */
export function spanBox(model: MarkModel, secId: string, s: number, e: number): Box | null {
  const ix = model.idx.get(secId);
  if (!ix) return null;
  const range = spanRange(ix, s, e);
  if (!range) return null;
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const r of Array.from(range.getClientRects())) {
    if (r.width < 0.5 && r.height < 0.5) continue;
    left = Math.min(left, r.left); top = Math.min(top, r.top);
    right = Math.max(right, r.right); bottom = Math.max(bottom, r.bottom);
  }
  return Number.isFinite(top) ? { left, top, right, bottom } : null;
}

/* ═══ نقشهٔ ذخیره — نشان تازه برنده، هم‌پوشان‌ها تراش/دونیمه/حذف ════════════════════ */

export interface MarkPatch {
  id: string;
  secId: string;
  text: string;
  color: string;
  occ: number;
  pfx: string;
  sfx: string;
}

export interface MarkPlan {
  upserts: MarkPatch[];
  removes: string[];
}

export function newMarkId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function patchFor(ix: SectionIndex, secId: string, id: string, color: string, s: number, e: number): MarkPatch | null {
  const info = spanInfo(ix, s, e);
  if (!info) return null;
  return { id, secId, text: norm(info.text), color, occ: info.occ, pfx: info.pfx, sfx: info.sfx };
}

function carve(model: MarkModel, secId: string, s: number, e: number, exceptId: string, plan: MarkPlan): void {
  const ix = model.idx.get(secId);
  if (!ix) return;
  for (const r of model.resolved) {
    if (r.secId !== secId || r.id === exceptId) continue;
    if (r.e <= s || r.s >= e) continue;
    const left = r.s < s ? patchFor(ix, secId, r.id, r.color, r.s, s) : null;
    const right = r.e > e ? patchFor(ix, secId, left ? newMarkId() : r.id, r.color, e, r.e) : null;
    if (!left && !right) plan.removes.push(r.id);
    if (left) plan.upserts.push(left);
    if (right) plan.upserts.push(right);
  }
}

/** ذخیرهٔ نشان (تازه یا ویرایش‌شده) روی [s,e) — بدون هیچ هم‌پوشانی با بقیه */
export function planCommit(model: MarkModel, secId: string, s: number, e: number, color: string, id: string): MarkPlan | null {
  const ix = model.idx.get(secId);
  if (!ix) return null;
  const self = patchFor(ix, secId, id, isMarkColor(color) ? color : DEFAULT_MARK_COLOR, s, e);
  if (!self) return null;
  const info = spanInfo(ix, s, e);
  if (!info) return null;
  const plan: MarkPlan = { upserts: [], removes: [] };
  carve(model, secId, info.s, info.e, id, plan);
  plan.upserts.unshift(self);
  return plan;
}

/** پاک‌کردن نشان از بازهٔ [s,e) (پاک‌کن) */
export function planErase(model: MarkModel, secId: string, s: number, e: number): MarkPlan | null {
  const plan: MarkPlan = { upserts: [], removes: [] };
  carve(model, secId, s, e, "", plan);
  return plan.upserts.length || plan.removes.length ? plan : null;
}

/** آیا بازه روی نشانی می‌افتد */
export function spanOverlapsMarks(model: MarkModel, secId: string, s: number, e: number): boolean {
  return model.resolved.some((r) => r.secId === secId && r.s < e && r.e > s);
}

/* ═══ سازگاری با کد قدیمی ═══════════════════════════════════════════════════════════════════════ */

/** آیا المان داخل یک ناحیهٔ قابل انتخاب است (نه دکمه و ورودی) */
export function isSelectableNode(el: Element | null): boolean {
  if (!el) return false;
  return !el.closest("button,input,textarea,select,a,[contenteditable],summary,[data-mark-ui]");
}

/** اندیس وقوع + لنگر متنی یک بازهٔ انتخاب‌شده در بخش (قالب ذخیره) */
export function locateSelection(
  secEl: Element | null,
  range: Range,
): { text: string; occ: number; pfx: string; sfx: string } | null {
  if (!secEl) return null;
  const idx = sectionIndex(secEl);
  const s = pointToIndex(idx, range.startContainer, range.startOffset);
  const e = pointToIndex(idx, range.endContainer, range.endOffset);
  if (s < 0 || e < 0 || e <= s) return null;
  const info = spanInfo(idx, s, e);
  if (!info) return null;
  return { text: norm(info.text), occ: info.occ, pfx: info.pfx, sfx: info.sfx };
}
