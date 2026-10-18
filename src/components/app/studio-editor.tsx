"use client";

/* === ویرایشگر بخش‌ها — نسخهٔ دوم پنل مدرس ===
 * به‌جای فرم‌های بلندِ همه‌باز: فهرست فشردهٔ بخش‌ها، فقط یک بخش باز، درج «+» بین
 * بخش‌ها، کشیدن‌ورها کردن (dnd-kit)، تکثیر، واگرد/ازنو، نوار قالب‌بندی متن،
 * ویرایش ردیفیِ نکته‌ها، جدول خانه‌به‌خانه، انتخاب ماده از کتابخانهٔ قوانین و
 * اعلام ایرادها کنار همان بخش.
 * خروجی همان LessonSection[] قبلی است؛ مطالب و دوره‌های موجود دست نمی‌خورند.
 * --- */
import * as React from "react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical, Plus, Trash2, Copy, ChevronDown, ChevronUp, X, Wand2, List, ListOrdered, Tag, Target,
  AlertTriangle, Lightbulb, BellRing, Siren, BookMarked, Search, Loader2, HelpCircle, Columns3,
  Rows3, ClipboardPaste, CircleAlert,
} from "lucide-react";
import type { LessonSection, LawRef } from "@/lib/law/types";
import { LAW_CODES, flatLawArticles, type LawBook } from "@/lib/law/statutes";
import { fa } from "@/lib/fa";
import { SectionBody } from "./common";
import { PALETTE, LABEL_OF, newBlock, standardLessonTemplate, inputCls, labelCls } from "./StudioView";

/* --- واگرد / ازنو --- */
interface Hist<T> { past: T[]; present: T | null; future: T[] }

/** وضعیت با تاریخچه؛ تایپ پشت‌سرهم در یک فیلد (کلید یکسان، کمتر از ۹۰۰ms) یک قدم حساب می‌شود */
export function useHistoryState<T>() {
  const [h, setH] = React.useState<Hist<T>>({ past: [], present: null, future: [] });
  const last = React.useRef({ key: "", at: 0 });
  const set = React.useCallback((next: T | ((cur: T) => T), key = "") => {
    setH((s) => {
      if (s.present === null) return s;
      const val = typeof next === "function" ? (next as (c: T) => T)(s.present) : next;
      if (val === s.present) return s;
      const now = Date.now();
      const merge = !!key && key === last.current.key && now - last.current.at < 900;
      last.current = { key, at: now };
      return { past: merge ? s.past : [...s.past, s.present].slice(-100), present: val, future: [] };
    });
  }, []);
  const reset = React.useCallback((v: T) => {
    last.current = { key: "", at: 0 };
    setH({ past: [], present: v, future: [] });
  }, []);
  const undo = React.useCallback(() => {
    last.current = { key: "", at: 0 };
    setH((s) => (s.past.length && s.present !== null
      ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] }
      : s));
  }, []);
  const redo = React.useCallback(() => {
    last.current = { key: "", at: 0 };
    setH((s) => (s.future.length && s.present !== null
      ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) }
      : s));
  }, []);
  return { value: h.present, set, reset, undo, redo, canUndo: h.past.length > 0, canRedo: h.future.length > 0 };
}

/** میان‌برها: Ctrl/Cmd+Z واگرد، Ctrl/Cmd+Shift+Z یا Ctrl+Y ازنو، Ctrl/Cmd+S ذخیره */
export function useEditorShortcuts(opts: { undo: () => void; redo: () => void; save: () => void }) {
  const ref = React.useRef(opts);
  ref.current = opts;
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); ref.current.undo(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); ref.current.redo(); }
      else if (k === "s") { e.preventDefault(); ref.current.save(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/* --- ایرادهای هر بخش --- */
export interface Issue { level: "error" | "warn"; text: string }

const BODY_TYPES = ["intro", "concept", "example", "summary"];
const filled = (s?: string) => !!s && !!s.trim();

/** ایرادها؛ error یعنی هنگام ذخیره حذف یا به «مفهوم» تبدیل می‌شود */
export function sectionIssues(s: LessonSection): Issue[] {
  const out: Issue[] = [];
  if (BODY_TYPES.includes(s.type) && !filled(s.body) && !(s.bullets ?? []).some(filled)) {
    out.push({ level: "error", text: "متن این بخش خالی است" });
  }
  if (s.type === "law") {
    const rows = s.law ?? [];
    if (!rows.some((r) => filled(r.text))) out.push({ level: "error", text: "متن ماده خالی است (بخش ذخیره نمی‌شود)" });
    else if (rows.some((r) => filled(r.text) && !filled(r.no))) out.push({ level: "warn", text: "شمارهٔ ماده نوشته نشده" });
  }
  if (s.type === "notes" && !(s.bullets ?? []).some(filled)) out.push({ level: "error", text: "هنوز نکته‌ای ننوشته‌ای" });
  if (s.type === "compare") {
    const h = (s.table?.headers ?? []).filter(filled);
    const rowsOk = (s.table?.rows ?? []).some((r) => r.some(filled));
    if (h.length < 2 || !rowsOk) out.push({ level: "error", text: "جدول دست‌کم دو سرستون و یک ردیف پر لازم دارد" });
  }
  if (s.type === "question") {
    if (!filled(s.questionText)) out.push({ level: "error", text: "متن سؤال خالی است" });
    else if (!filled(s.suggestedAnswer)) out.push({ level: "warn", text: "پاسخ پیشنهادی ندارد" });
  }
  return out;
}

export function countIssues(sections: LessonSection[]) {
  let errors = 0;
  let warns = 0;
  for (const s of sections) for (const i of sectionIssues(s)) (i.level === "error" ? errors++ : warns++);
  return { errors, warns };
}

/* --- تبدیل نوع بخش (بدون از دست رفتن متن) --- */
function convertType(s: LessonSection, type: string): LessonSection {
  const base = newBlock(type);
  const next: LessonSection = { ...s, type: base.type };
  if (type === "law" && !next.law?.length) next.law = base.law;
  if (type === "notes" && !next.bullets?.length) next.bullets = s.body ? s.body.split("\n").map((x) => x.replace(/^[-–•*]\s+/, "")).filter(Boolean) : [""];
  if (type === "compare" && !next.table) next.table = base.table;
  if (type === "question" && next.questionText === undefined) next.questionText = s.body ?? "";
  if (BODY_TYPES.includes(type) && next.body === undefined) next.body = s.questionText ?? (s.bullets ?? []).map((b) => `- ${b}`).join("\n");
  return next;
}

function cloneSection(s: LessonSection): LessonSection {
  return { ...JSON.parse(JSON.stringify(s)), id: newBlock(s.type).id };
}

function summaryOf(s: LessonSection): string {
  const t = s.title?.trim();
  if (t) return t;
  const raw = s.body || s.questionText || s.bullets?.find(filled) || (s.law?.[0] ? `مادهٔ ${s.law[0].no || "؟"} ${s.law[0].source ?? ""}` : "")
    || (s.table ? s.table.headers.filter(filled).join(" / ") : "");
  return (raw || "").replace(/\s+/g, " ").trim().slice(0, 70) || "بدون متن";
}

const ICON_OF: Record<string, React.ComponentType<{ className?: string }>> = Object.fromEntries(PALETTE.map((p) => [p.type, p.Icon]));

/* --- نوار قالب‌بندی متن (همان نحوی که رندرر درس می‌فهمد) --- */
const toPersianDigits = (n: number) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

function RichBodyField({ value, onChange, placeholder, rows = 6 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const [help, setHelp] = React.useState(false);

  function apply(fn: (text: string, a: number, b: number) => { text: string; caret: number }) {
    const el = ref.current;
    const a = el?.selectionStart ?? value.length;
    const b = el?.selectionEnd ?? value.length;
    const r = fn(value, a, b);
    onChange(r.text);
    requestAnimationFrame(() => {
      if (!ref.current) return;
      ref.current.focus();
      ref.current.setSelectionRange(r.caret, r.caret);
    });
  }
  /** خطوط انتخاب‌شده را پیشوند بده؛ بدون انتخاب، یک خط تازه با پیشوند بساز */
  const prefixLines = (make: (i: number) => string) => apply((text, a, b) => {
    if (a === b) {
      const before = text.slice(0, a);
      const lead = before && !before.endsWith("\n") ? "\n" : "";
      const ins = `${lead}${make(0)}`;
      return { text: before + ins + text.slice(b), caret: a + ins.length };
    }
    const start = text.lastIndexOf("\n", a - 1) + 1;
    const lines = text.slice(start, b).split("\n");
    const done = lines.map((l, i) => (l.trim() ? make(i) + l.replace(/^([-–•*]|[0-9۰-۹]{1,2}\s*[-–.)])\s*/, "") : l)).join("\n");
    return { text: text.slice(0, start) + done + text.slice(b), caret: start + done.length };
  });
  const insertBlock = (snippet: string, caretBack = 0) => apply((text, a, b) => {
    const before = text.slice(0, a);
    const lead = before && !before.endsWith("\n") ? "\n" : "";
    const ins = lead + snippet;
    return { text: before + ins + text.slice(b), caret: a + ins.length - caretBack };
  });

  const tools: { label: string; title: string; Icon: React.ComponentType<{ className?: string }>; run: () => void }[] = [
    { label: "فهرست", title: "هر خط با «- » — فهرست گلوله‌ای", Icon: List, run: () => prefixLines(() => "- ") },
    { label: "مراحل", title: "۱. ۲. ۳. — فهرست مرحله‌ای", Icon: ListOrdered, run: () => prefixLines((i) => `${toPersianDigits(i + 1)}. `) },
    { label: "کارت اصطلاح", title: "- اصطلاح: توضیح — کارت تعریف", Icon: Tag, run: () => insertBlock("- اصطلاح: توضیح") },
    { label: "اهداف", title: "اهداف این جلسه: + فهرست شماره‌دار", Icon: Target, run: () => insertBlock("اهداف این جلسه:\n۱. \n۲. ", 4) },
    { label: "مهم", title: "کادر زرد «مهم»", Icon: AlertTriangle, run: () => insertBlock("مهم: ") },
    { label: "هشدار", title: "کادر قرمز «هشدار»", Icon: Siren, run: () => insertBlock("هشدار: ") },
    { label: "ترفند", title: "کادر سبز «ترفند»", Icon: Lightbulb, run: () => insertBlock("ترفند: ") },
    { label: "یادآوری", title: "کادر آبی «یادآوری»", Icon: BellRing, run: () => insertBlock("یادآوری: ") },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-input bg-background focus-within:border-bronze">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/40 px-2 py-1.5">
        {tools.map((t) => (
          <button key={t.label} type="button" title={t.title} onMouseDown={(e) => e.preventDefault()} onClick={t.run}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-card hover:text-bronze">
            <t.Icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
        <button type="button" onClick={() => setHelp((v) => !v)} className="ms-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-bronze" aria-expanded={help}>
          <HelpCircle className="h-3.5 w-3.5" /> راهنما
        </button>
      </div>
      {help && (
        <div className="space-y-1 border-b border-border bg-card px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
          <p><b className="text-foreground">پاراگراف:</b> متن ساده. <b className="text-foreground">فهرست:</b> خط‌هایی که با «- » شروع شوند.</p>
          <p><b className="text-foreground">کارت اصطلاح:</b> «- اصطلاح: توضیح» (بعد از دونقطه فاصله لازم است؛ اصطلاح ۲ تا ۴۴ حرف).</p>
          <p><b className="text-foreground">مراحل:</b> خط‌های «۱. …» یا «1) …» پشت‌سرهم. <b className="text-foreground">اهداف:</b> خط «اهداف این جلسه:» و بعد مراحل.</p>
          <p><b className="text-foreground">کادرها:</b> اول خط «مهم:»، «نکته مهم:»، «توجه:»، «هشدار:»، «ترفند:» یا «یادآوری:».</p>
        </div>
      )}
      <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder}
        className="block w-full resize-y bg-transparent px-3 py-2.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50" />
    </div>
  );
}

/* --- فهرست ردیفی (نکته‌ها) --- */
function ListField({ items, onChange, placeholder, hint }: {
  items: string[]; onChange: (v: string[]) => void; placeholder: string; hint?: string;
}) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  const [focusIdx, setFocusIdx] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (focusIdx !== null) { refs.current[focusIdx]?.focus(); setFocusIdx(null); }
  }, [focusIdx, items.length]);
  const rows = items.length ? items : [""];
  const set = (i: number, v: string) => onChange(rows.map((x, k) => (k === i ? v : x)));
  return (
    <div className="space-y-1.5">
      {rows.map((it, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-5 shrink-0 text-center text-[10.5px] font-bold text-muted-foreground">{fa(i + 1)}</span>
          <input
            ref={(el) => { refs.current[i] = el; }}
            value={it}
            onChange={(e) => set(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); const n = [...rows]; n.splice(i + 1, 0, ""); onChange(n.slice(0, 30)); setFocusIdx(i + 1); }
              if (e.key === "Backspace" && !it && rows.length > 1) { e.preventDefault(); onChange(rows.filter((_, k) => k !== i)); setFocusIdx(Math.max(0, i - 1)); }
            }}
            onPaste={(e) => {
              const t = e.clipboardData.getData("text");
              if (!t.includes("\n")) return;
              e.preventDefault();
              const parts = t.split(/\r?\n/).map((x) => x.replace(/^[-–•*]\s+/, "").trim()).filter(Boolean);
              const n = [...rows];
              n.splice(i, 1, ...(it ? [it, ...parts] : parts));
              onChange(n.slice(0, 30));
            }}
            placeholder={placeholder}
            className={`${inputCls} py-2`}
          />
          <button type="button" aria-label="بالا" disabled={i === 0} onClick={() => { const n = [...rows]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; onChange(n); }} className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-25"><ChevronUp className="h-3.5 w-3.5" /></button>
          <button type="button" aria-label="پایین" disabled={i === rows.length - 1} onClick={() => { const n = [...rows]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; onChange(n); }} className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-25"><ChevronDown className="h-3.5 w-3.5" /></button>
          <button type="button" aria-label="حذف" onClick={() => onChange(rows.length > 1 ? rows.filter((_, k) => k !== i) : [""])} className="rounded-md p-1 text-destructive hover:bg-destructive/10"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2 ps-6">
        <button type="button" disabled={rows.length >= 30} onClick={() => { onChange([...rows, ""]); setFocusIdx(rows.length); }} className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary disabled:opacity-40"><Plus className="h-3 w-3" /> ردیف</button>
        <span className="text-[10.5px] text-muted-foreground">{hint ?? "Enter = ردیف بعد · چسباندن چندخطی = چند ردیف"}</span>
      </div>
    </div>
  );
}

/* --- جدول خانه‌به‌خانه --- */
function TableField({ table, onChange }: { table: { headers: string[]; rows: string[][] }; onChange: (t: { headers: string[]; rows: string[][] }) => void }) {
  const [bulk, setBulk] = React.useState(false);
  const cols = Math.max(2, table.headers.length);
  const headers = Array.from({ length: cols }, (_, i) => table.headers[i] ?? "");
  const rows = (table.rows.length ? table.rows : [[]]).map((r) => Array.from({ length: cols }, (_, i) => r[i] ?? ""));
  const setCell = (ri: number, ci: number, v: string) => onChange({ headers, rows: rows.map((r, k) => (k === ri ? r.map((c, j) => (j === ci ? v : c)) : r)) });
  const addCol = () => cols < 8 && onChange({ headers: [...headers, ""], rows: rows.map((r) => [...r, ""]) });
  const delCol = (ci: number) => cols > 2 && onChange({ headers: headers.filter((_, j) => j !== ci), rows: rows.map((r) => r.filter((_, j) => j !== ci)) });
  const addRow = () => rows.length < 30 && onChange({ headers, rows: [...rows, Array(cols).fill("")] });
  const delRow = (ri: number) => onChange({ headers, rows: rows.length > 1 ? rows.filter((_, k) => k !== ri) : [Array(cols).fill("")] });
  const bulkText = rows.map((r) => r.join(" | ")).join("\n");
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[420px] border-collapse text-[12.5px]">
          <thead>
            <tr className="bg-muted/50">
              {headers.map((h, ci) => (
                <th key={ci} className="border-b border-border p-1.5 align-top">
                  <div className="flex items-center gap-1">
                    <input value={h} onChange={(e) => onChange({ headers: headers.map((x, j) => (j === ci ? e.target.value : x)), rows })} placeholder={ci === 0 ? "وجه تمایز" : `ستون ${fa(ci + 1)}`} className="w-full min-w-0 rounded-lg border border-input bg-background px-2 py-1.5 text-[12px] font-bold outline-none focus:border-bronze" aria-label={`سرستون ${ci + 1}`} />
                    {cols > 2 && <button type="button" onClick={() => delCol(ci)} aria-label="حذف ستون" className="rounded p-0.5 text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>}
                  </div>
                </th>
              ))}
              <th className="w-8 border-b border-border" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                {r.map((c, ci) => (
                  <td key={ci} className="border-b border-border/60 p-1.5 align-top">
                    <textarea value={c} rows={1} onChange={(e) => setCell(ri, ci, e.target.value)} className={`w-full min-w-0 resize-y rounded-lg border border-input bg-background px-2 py-1.5 text-[12px] outline-none focus:border-bronze ${ci === 0 ? "font-semibold" : ""}`} aria-label={`ردیف ${ri + 1} ستون ${ci + 1}`} />
                  </td>
                ))}
                <td className="border-b border-border/60 p-1 align-top"><button type="button" onClick={() => delRow(ri)} aria-label="حذف ردیف" className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={addRow} disabled={rows.length >= 30} className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary disabled:opacity-40"><Rows3 className="h-3.5 w-3.5" /> ردیف</button>
        <button type="button" onClick={addCol} disabled={cols >= 8} className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary disabled:opacity-40"><Columns3 className="h-3.5 w-3.5" /> ستون</button>
        <button type="button" onClick={() => setBulk((v) => !v)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-bold text-muted-foreground hover:text-foreground"><ClipboardPaste className="h-3.5 w-3.5" /> ورود متنی</button>
        <span className="text-[10.5px] text-muted-foreground">ستون اول (راست) پررنگ دیده می‌شود.</span>
      </div>
      {bulk && (
        <textarea defaultValue={bulkText} rows={4} dir="rtl"
          onBlur={(e) => onChange({ headers, rows: e.target.value.split("\n").filter((l) => l.trim()).map((ln) => ln.split("|").map((x) => x.trim())).slice(0, 30) })}
          placeholder="هر خط یک ردیف؛ خانه‌ها با | جدا (بعد از بیرون آمدن از کادر اعمال می‌شود)" className={`${inputCls} resize-y`} />
      )}
    </div>
  );
}

/* --- انتخاب ماده از کتابخانهٔ قوانین --- */
const normDigits = (s: string) => s.replace(/[0-9٠-٩]/g, (d) => {
  const c = d.charCodeAt(0);
  return "۰۱۲۳۴۵۶۷۸۹"[c >= 0x660 ? c - 0x660 : c - 48];
}).replace(/\s+/g, " ").trim();

function LawPicker({ onPick, onClose }: { onPick: (r: LawRef) => void; onClose: () => void }) {
  const [lawId, setLawId] = React.useState(LAW_CODES[0]?.id ?? "");
  const [q, setQ] = React.useState("");
  const [books, setBooks] = React.useState<Record<string, LawBook[]>>({});
  const [loadingFull, setLoadingFull] = React.useState(true);
  React.useEffect(() => {
    let alive = true;
    // متن کامل قانون‌ها (وقتی سرور یا کش آن را دارد) — وگرنه همان گزیدهٔ داخل اپ
    import("./LawLibraryView")
      .then((m) => (m as { fetchFullLaws?: () => Promise<Record<string, { books?: LawBook[] }> | null> }).fetchFullLaws?.())
      .then((full) => {
        if (!alive || !full) return;
        const out: Record<string, LawBook[]> = {};
        for (const [id, v] of Object.entries(full)) if (v?.books?.length) out[id] = v.books;
        setBooks(out);
      })
      .catch(() => {})
      .finally(() => alive && setLoadingFull(false));
    return () => { alive = false; };
  }, []);
  const law = LAW_CODES.find((l) => l.id === lawId);
  const list = React.useMemo(() => {
    if (!law) return [];
    const src = books[law.id] ? { ...law, books: books[law.id] } : law;
    const all = flatLawArticles(src);
    const v = normDigits(q);
    if (!v) return all.slice(0, 40);
    const isNo = /^[۰-۹]+/.test(v);
    return all
      .filter((x) => (isNo ? normDigits(x.article.no).startsWith(v) : x.article.text.includes(q.trim())))
      .slice(0, 60);
  }, [law, books, q]);
  return (
    <div className="mt-2 space-y-2 rounded-xl border border-bronze/40 bg-card p-3 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <BookMarked className="h-4 w-4 text-bronze" />
        <span className="text-[12px] font-bold">انتخاب از کتابخانهٔ قوانین</span>
        {loadingFull && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        <button type="button" onClick={onClose} className="ms-auto rounded p-1 text-muted-foreground hover:text-foreground" aria-label="بستن"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-2 sm:grid-cols-[200px_1fr]">
        <select value={lawId} onChange={(e) => setLawId(e.target.value)} className={inputCls} aria-label="قانون">
          {LAW_CODES.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
        </select>
        <label className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="شمارهٔ ماده (مثلاً ۱۹۰) یا یک واژه از متن" className={`${inputCls} ps-9`} />
        </label>
      </div>
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {list.length === 0 && <p className="py-3 text-center text-[11.5px] text-muted-foreground">ماده‌ای پیدا نشد؛ می‌توانی متن را دستی بنویسی.</p>}
        {list.map((x, i) => (
          <button key={`${x.article.no}-${i}`} type="button"
            onClick={() => onPick({ no: x.article.no, source: law!.title, text: x.article.text })}
            className="block w-full rounded-lg border border-transparent px-2.5 py-2 text-start transition-colors hover:border-bronze/40 hover:bg-bronze/[0.05]">
            <span className="text-[11.5px] font-extrabold text-bronze">{law!.articleWord ?? "ماده"} {x.article.no}</span>
            {x.article.gist && <span className="ms-1.5 rounded bg-muted px-1.5 text-[9.5px] text-muted-foreground">گزیده</span>}
            <span className="mt-0.5 line-clamp-2 block text-[11.5px] leading-relaxed text-muted-foreground">{x.article.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function LawField({ rows, onChange }: { rows: LawRef[]; onChange: (r: LawRef[]) => void }) {
  const [picking, setPicking] = React.useState<number | null>(null);
  const list = rows.length ? rows : [{ no: "", source: "", text: "" }];
  const set = (i: number, p: Partial<LawRef>) => onChange(list.map((x, k) => (k === i ? { ...x, ...p } : x)));
  return (
    <div className="space-y-3">
      {list.map((l, i) => (
        <div key={i} className="rounded-xl border border-border bg-background/60 p-2.5">
          <div className="grid gap-2 sm:grid-cols-[120px_1fr_auto_auto]">
            <input value={l.no} onChange={(e) => set(i, { no: e.target.value })} placeholder="شمارهٔ ماده" className={inputCls} aria-label="شمارهٔ ماده" />
            <input value={l.source ?? ""} onChange={(e) => set(i, { source: e.target.value })} placeholder="منبع (پیش‌فرض: قانون مدنی)" className={inputCls} aria-label="منبع" />
            <button type="button" onClick={() => setPicking(picking === i ? null : i)} className="inline-flex items-center justify-center gap-1 rounded-xl border border-bronze/50 bg-bronze/10 px-3 text-[11.5px] font-bold text-bronze hover:bg-bronze/20"><BookMarked className="h-4 w-4" /> از کتابخانه</button>
            <button type="button" onClick={() => onChange(list.length > 1 ? list.filter((_, k) => k !== i) : [{ no: "", source: "", text: "" }])} aria-label="حذف ماده" className="self-center rounded-lg p-2 text-destructive hover:bg-destructive/10"><X className="h-4 w-4" /></button>
          </div>
          <textarea value={l.text} onChange={(e) => set(i, { text: e.target.value })} rows={3} placeholder="نص ماده…" className={`${inputCls} mt-2 resize-y leading-relaxed`} aria-label="متن ماده" />
          {picking === i && <LawPicker onClose={() => setPicking(null)} onPick={(r) => { set(i, r); setPicking(null); }} />}
        </div>
      ))}
      <button type="button" disabled={list.length >= 12} onClick={() => onChange([...list, { no: "", source: list[list.length - 1]?.source ?? "", text: "" }])} className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary disabled:opacity-40"><Plus className="h-3 w-3" /> مادهٔ دیگر</button>
    </div>
  );
}

/* --- فرم کامل یک بخش --- */
function SectionFields({ s, onPatch, onReplace }: {
  s: LessonSection;
  onPatch: (p: Partial<LessonSection>, field: string) => void;
  onReplace: (next: LessonSection) => void;
}) {
  const hasBodyField = BODY_TYPES.includes(s.type) || s.body !== undefined;
  const hasBullets = s.type === "notes" || s.bullets !== undefined;
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
        <div>
          <label className={labelCls}>نوع بخش</label>
          <select value={s.type} onChange={(e) => onReplace(convertType(s, e.target.value))} className={inputCls}>
            {PALETTE.map((p) => <option key={p.type} value={p.type}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>عنوان بخش (اختیاری)</label>
          <input value={s.title ?? ""} onChange={(e) => onPatch({ title: e.target.value }, "title")} placeholder={s.type === "law" ? "مثل: مستند اصلی" : s.type === "question" ? "مثل: برای فکر کردن" : "عنوانی که بالای بخش می‌آید"} className={inputCls} />
        </div>
      </div>

      {s.type === "law" && (
        <div>
          <label className={labelCls}>مواد قانونی</label>
          <LawField rows={s.law ?? []} onChange={(law) => onPatch({ law }, "law")} />
        </div>
      )}

      {s.type === "question" && (
        <div className="space-y-2">
          <div>
            <label className={labelCls}>متن سؤال *</label>
            <textarea value={s.questionText ?? ""} onChange={(e) => onPatch({ questionText: e.target.value }, "q")} rows={2} className={`${inputCls} resize-y`} placeholder="سؤالی که دانشجو باید رویش فکر کند…" />
          </div>
          <div>
            <label className={labelCls}>پاسخ پیشنهادی (با لمس دانشجو باز می‌شود)</label>
            <textarea value={s.suggestedAnswer ?? ""} onChange={(e) => onPatch({ suggestedAnswer: e.target.value }, "a")} rows={3} className={`${inputCls} resize-y`} />
          </div>
        </div>
      )}

      {s.type === "compare" && (
        <div>
          <label className={labelCls}>جدول مقایسه</label>
          <TableField table={s.table ?? { headers: ["", ""], rows: [["", ""]] }} onChange={(table) => onPatch({ table }, "table")} />
        </div>
      )}

      {hasBodyField ? (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className={`${labelCls} mb-0`}>{BODY_TYPES.includes(s.type) ? "متن" : "متن توضیحی (اختیاری)"}</label>
            {!BODY_TYPES.includes(s.type) && <button type="button" onClick={() => onReplace({ ...s, body: undefined })} className="text-[10.5px] font-bold text-muted-foreground hover:text-destructive">برداشتن</button>}
          </div>
          <RichBodyField value={s.body ?? ""} onChange={(body) => onPatch({ body }, "body")} placeholder="متن را بنویس؛ برای فهرست، مراحل، کارت اصطلاح و کادرهای مهم از نوار بالا کمک بگیر." rows={s.type === "summary" ? 4 : 6} />
        </div>
      ) : null}

      {hasBullets ? (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className={`${labelCls} mb-0`}>{s.type === "notes" ? "نکته‌ها *" : s.type === "summary" ? "خلاصه‌های یک‌خطی (کارت مرور)" : "نکته‌های کوتاه این بخش"}</label>
            {s.type !== "notes" && <button type="button" onClick={() => onReplace({ ...s, bullets: undefined })} className="text-[10.5px] font-bold text-muted-foreground hover:text-destructive">برداشتن</button>}
          </div>
          <ListField items={s.bullets ?? []} onChange={(bullets) => onPatch({ bullets }, "bullets")} placeholder="کلیدواژه: توضیح — یا یک جملهٔ کوتاه" hint="«کلیدواژه: توضیح» کارت رنگی می‌شود · Enter = ردیف بعد" />
        </div>
      ) : null}

      {(!hasBodyField || !hasBullets) && (
        <div className="flex flex-wrap gap-2 border-t border-dashed border-border pt-2.5">
          {!hasBodyField && <button type="button" onClick={() => onReplace({ ...s, body: "" })} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-bold text-muted-foreground hover:border-bronze/50 hover:text-bronze"><Plus className="h-3 w-3" /> متن توضیحی</button>}
          {!hasBullets && <button type="button" onClick={() => onReplace({ ...s, bullets: [""] })} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-bold text-muted-foreground hover:border-bronze/50 hover:text-bronze"><Plus className="h-3 w-3" /> {s.type === "summary" ? "کارت‌های مرور" : "نکته‌های کوتاه"}</button>}
        </div>
      )}
    </div>
  );
}

/* --- منوی درج بخش --- */
function InsertMenu({ onPick, onTemplate, compact }: { onPick: (type: string) => void; onTemplate?: () => void; compact?: boolean }) {
  return (
    <div className={`grid gap-1.5 ${compact ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-4"}`}>
      {PALETTE.map((p) => (
        <button key={p.type} type="button" onClick={() => onPick(p.type)}
          className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-start text-[11.5px] font-semibold text-muted-foreground shadow-card transition-colors hover:border-bronze/60 hover:text-bronze">
          <p.Icon className="h-4 w-4 shrink-0 text-bronze" /> {p.label}
        </button>
      ))}
      {onTemplate && (
        <button type="button" onClick={onTemplate}
          className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-[11.5px] font-bold text-primary transition-colors hover:bg-primary/20 sm:col-span-4">
          <Wand2 className="h-4 w-4" /> قالب آمادهٔ درس (۸ بخش: درآمد تا جمع‌بندی)
        </button>
      )}
    </div>
  );
}

function InsertPoint({ onPick }: { onPick: (type: string) => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative py-0.5">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} aria-label="درج بخش در اینجا" title="درج بخش در اینجا"
          className="group flex w-full items-center gap-2 py-0.5 opacity-60 transition-opacity hover:opacity-100 focus:opacity-100">
          <span className="h-px flex-1 bg-border group-hover:bg-bronze/50" />
          <span className="grid h-5 w-5 place-items-center rounded-full border border-border bg-card text-muted-foreground group-hover:border-bronze group-hover:text-bronze"><Plus className="h-3 w-3" /></span>
          <span className="h-px flex-1 bg-border group-hover:bg-bronze/50" />
        </button>
      ) : (
        <div className="rounded-xl border border-dashed border-bronze/50 bg-bronze/[0.04] p-2">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold text-bronze">درج بخش در اینجا <button type="button" onClick={() => setOpen(false)} aria-label="بستن"><X className="h-3.5 w-3.5" /></button></div>
          <InsertMenu compact onPick={(t) => { onPick(t); setOpen(false); }} />
        </div>
      )}
    </div>
  );
}

/* --- کارت قابل‌کشیدن یک بخش --- */
function SectionCard({ s, index, open, onToggle, onPatch, onReplace, onDuplicate, onDelete, onMove, isFirst, isLast }: {
  s: LessonSection; index: number; open: boolean; onToggle: () => void;
  onPatch: (p: Partial<LessonSection>, field: string) => void; onReplace: (n: LessonSection) => void;
  onDuplicate: () => void; onDelete: () => void; onMove: (dir: -1 | 1) => void; isFirst: boolean; isLast: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 30 : undefined };
  const issues = sectionIssues(s);
  const hasErr = issues.some((i) => i.level === "error");
  const Icon = ICON_OF[s.type] ?? Lightbulb;
  return (
    <div ref={setNodeRef} style={style} id={`sec-${s.id}`}
      className={`rounded-xl border bg-card shadow-card transition-colors ${open ? "border-bronze/60" : hasErr ? "border-destructive/40" : "border-border"} ${isDragging ? "opacity-80 ring-2 ring-bronze/40" : ""}`}>
      <div className="flex items-center gap-1.5 px-2 py-2">
        <button type="button" {...attributes} {...listeners} aria-label="کشیدن برای جابه‌جایی" title="بکش و جابه‌جا کن"
          className="cursor-grab touch-none rounded-md p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"><GripVertical className="h-4 w-4" /></button>
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-start" aria-expanded={open}>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-bronze/10 text-bronze"><Icon className="h-3.5 w-3.5" /></span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-[10.5px] font-bold text-bronze">{fa(index + 1)}. {LABEL_OF[s.type]}
              {issues.length > 0 && (
                <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 text-[9.5px] ${hasErr ? "bg-destructive/10 text-destructive" : "bg-amber-400/15 text-amber-700 dark:text-amber-300"}`}>
                  <CircleAlert className="h-3 w-3" /> {issues[0].text}
                </span>
              )}
            </span>
            <span className="block truncate text-[12.5px] font-semibold text-foreground/90">{summaryOf(s)}</span>
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        <span className="hidden items-center sm:flex">
          <button type="button" onClick={() => onMove(-1)} disabled={isFirst} aria-label="بالا" className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-25"><ChevronUp className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => onMove(1)} disabled={isLast} aria-label="پایین" className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-25"><ChevronDown className="h-3.5 w-3.5" /></button>
        </span>
        <button type="button" onClick={onDuplicate} aria-label="تکثیر بخش" title="تکثیر" className="rounded-md p-1 text-muted-foreground hover:bg-muted"><Copy className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={onDelete} aria-label="حذف بخش" title="حذف (با Ctrl+Z برمی‌گردد)" className="rounded-md p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
      {open && (
        <div className="space-y-2 border-t border-border px-3 pb-3 pt-3">
          {issues.length > 0 && (
            <ul className="space-y-1">
              {issues.map((i, k) => (
                <li key={k} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${i.level === "error" ? "bg-destructive/10 text-destructive" : "bg-amber-400/10 text-amber-700 dark:text-amber-300"}`}><CircleAlert className="h-3.5 w-3.5" /> {i.text}</li>
              ))}
            </ul>
          )}
          <SectionFields s={s} onPatch={onPatch} onReplace={onReplace} />
        </div>
      )}
    </div>
  );
}

/* === ویرایشگر فهرست بخش‌ها === */
export function SectionsEditor({ sections, onChange, focusId, onFocusChange, emptyHint }: {
  sections: LessonSection[];
  onChange: (next: LessonSection[], key?: string) => void;
  /** بخش باز (از بیرون هم قابل تعیین — مثل کلیک روی ایراد در چک‌لیست) */
  focusId?: string | null;
  onFocusChange?: (id: string | null) => void;
  emptyHint?: string;
}) {
  const [innerOpen, setInnerOpen] = React.useState<string | null>(null);
  const openId = focusId !== undefined ? focusId : innerOpen;
  const setOpen = (id: string | null) => { setInnerOpen(id); onFocusChange?.(id); };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  React.useEffect(() => {
    if (!openId) return;
    const el = document.getElementById(`sec-${openId}`);
    if (el) requestAnimationFrame(() => el.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }, [openId]);

  const insertAt = (i: number, items: LessonSection[]) => {
    const n = [...sections];
    n.splice(i, 0, ...items);
    onChange(n.slice(0, 80));
    setOpen(items[0]?.id ?? null);
  };
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = sections.findIndex((x) => x.id === active.id);
    const to = sections.findIndex((x) => x.id === over.id);
    if (from >= 0 && to >= 0) onChange(arrayMove(sections, from, to));
  }

  return (
    <div className="space-y-1">
      {sections.length === 0 && (
        <p className="mb-2 rounded-xl border border-dashed border-border px-4 py-5 text-center text-xs leading-relaxed text-muted-foreground">
          {emptyHint ?? "هنوز بخشی نداری؛ یکی از المان‌های زیر را بزن یا با «قالب آمادهٔ درس» شروع کن."}
        </p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {sections.map((s, i) => (
            <React.Fragment key={s.id}>
              {i > 0 && <InsertPoint onPick={(t) => insertAt(i, [newBlock(t)])} />}
              <SectionCard
                s={s} index={i} open={openId === s.id} isFirst={i === 0} isLast={i === sections.length - 1}
                onToggle={() => setOpen(openId === s.id ? null : s.id)}
                onPatch={(p, field) => onChange(sections.map((x) => (x.id === s.id ? { ...x, ...p } : x)), `${s.id}:${field}`)}
                onReplace={(nx) => onChange(sections.map((x) => (x.id === s.id ? nx : x)))}
                onDuplicate={() => insertAt(i + 1, [cloneSection(s)])}
                onDelete={() => { onChange(sections.filter((x) => x.id !== s.id)); if (openId === s.id) setOpen(null); }}
                onMove={(dir) => { const j = i + dir; if (j >= 0 && j < sections.length) onChange(arrayMove(sections, i, j)); }}
              />
            </React.Fragment>
          ))}
        </SortableContext>
      </DndContext>
      <div className="pt-3">
        <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">افزودن بخش به انتها</p>
        <InsertMenu
          onPick={(t) => insertAt(sections.length, [newBlock(t)])}
          onTemplate={() => {
            if (sections.length > 0 && !window.confirm("قالب آماده، ۸ بخش استاندارد را به انتهای همین بخش‌ها اضافه می‌کند. ادامه؟")) return;
            insertAt(sections.length, standardLessonTemplate());
          }}
        />
      </div>
    </div>
  );
}

/* === پیش‌نمایش — دقیقاً همان رندرر صفحهٔ مطلب/درس === */
export function SectionsPreview({ sections, title }: { sections: LessonSection[]; title?: string }) {
  return (
    <div className="space-y-4">
      {title && <h2 className="font-display text-lg font-extrabold">{title}</h2>}
      {sections.length === 0 && <p className="py-8 text-center text-[11.5px] text-muted-foreground">با افزودن اولین بخش، پیش‌نمایش اینجا ساخته می‌شود.</p>}
      {sections.map((s, i) => (
        <section key={s.id}>
          <p className="mb-1.5 font-display text-[12px] font-bold text-bronze">{fa(i + 1)}. {s.title || LABEL_OF[s.type]}</p>
          <div className="rounded-xl border border-border bg-card p-4">
            <SectionBody s={s} decorativeHeadless />
          </div>
        </section>
      ))}
    </div>
  );
}

/** شمار واژه — برای نوار وضعیت */
export function wordCountOf(blocks: LessonSection[]): number {
  const wc = (s?: string) => (s ?? "").trim().split(/\s+/).filter(Boolean).length;
  let n = 0;
  for (const b of blocks) {
    n += wc(b.title) + wc(b.body) + wc(b.questionText) + wc(b.suggestedAnswer);
    n += (b.bullets ?? []).reduce((m, x) => m + wc(x), 0);
    n += (b.law ?? []).reduce((m, x) => m + wc(x.text) + wc(x.no) + wc(x.source ?? ""), 0);
    n += (b.table?.rows ?? []).reduce((m, r) => m + r.reduce((k, c) => k + wc(c), 0), 0);
  }
  return n;
}

