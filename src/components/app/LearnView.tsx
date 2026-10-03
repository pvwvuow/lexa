"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  ArrowDownCircle, HelpCircle, Lightbulb, ClipboardList, StickyNote,
  ListOrdered, ListChecks, Scale, Plus, Trash2, Send, RotateCcw, BookMarked, Sparkles, ArrowLeft, MessageSquareWarning,
  MoreHorizontal, CheckCircle2, AlertCircle, Loader2, Copy, ZoomIn, ZoomOut,
} from "lucide-react";
import type { Course, LessonSection } from "@/lib/law/types";
import { builtinCourses } from "@/lib/law/courses";
import { useApp } from "@/lib/store";
import { mergeAll } from "@/lib/books";
import { fa } from "@/lib/fa";
import { navigate } from "@/lib/router";
import { IS_APK } from "@/lib/app-mode";
import { askAi } from "@/lib/aiClient";
import { AIThinking, SECTION_META, SectionHead, SectionBody, LawBox } from "./common";
import { lessonToContextText } from "@/lib/law/lessonText";
import { ensureLessonContent, isLazyLesson, useLessonContent } from "@/lib/law/texts";
import { FeedbackDialog } from "./FeedbackDialog";
import { MARK_COLORS, applyMarksToSections, locateSelection, isSelectableNode, isMarkColor } from "@/lib/marks";

interface AiNote { sectionId: string; text: string }
const EMPTY_NOTES: { id: string; text: string; quote?: string; createdAt: number }[] = [];

/**
 * درس یافت نشد — با مهلت آماده‌سازی: دوره‌های بستهٔ محتوایی (مثل تدریس اساتید)
 * به‌صورت ناهمگام از IndexedDB/CDN ادغام می‌شوند؛ اگر همین حالا پیام «پیدا نشد»
 * بدهیم، کاربر صفحهٔ خالی می‌بیند. تا ۳.۵ ثانیه لودر، بعد پیام واقعی.
 */
function LessonNotFoundGrace() {
  const [graceOver, setGraceOver] = React.useState(false);
  React.useEffect(() => {
    const t = window.setTimeout(() => setGraceOver(true), 3500);
    return () => window.clearTimeout(t);
  }, []);
  if (!graceOver) {
    return (
      <div className="flex flex-col items-center gap-3 p-14 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-bronze" />
        <p className="text-sm text-muted-foreground">در حال آماده‌سازی درس…</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3 p-14 text-center">
      <AlertCircle className="h-6 w-6 text-bronze/70" />
      <p className="text-sm leading-relaxed text-muted-foreground">جلسه پیدا نشد.</p>
      <button onClick={() => navigate({ view: "home" })} className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-bold shadow-card hover:border-bronze/50 hover:text-bronze">
        بازگشت به خانه
      </button>
    </div>
  );
}
const EMPTY_MARKS: import("@/lib/store").LessonMark[] = [];

/** زوم متن درس — مرز منطقی ۹۰٪ تا ۱۶۰٪ با گام ۱۰٪ (درخواست کاربر) */
const LESSON_ZOOM = {
  min: 0.9,
  max: 1.6,
  step: 0.1,
  clamp(v: number): number {
    const snapped = Math.round(v / this.step) * this.step;
    return Math.min(this.max, Math.max(this.min, Math.round(snapped * 100) / 100));
  },
};
const ZOOM_KEY = "lexa-lesson-zoom";

/** کپی متن در کلیپ‌بورد — Clipboard API + فال‌بک execCommand برای WebView قدیمی */
async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* فال‌بک */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;top:-999px;opacity:0;pointer-events:none";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** فاصلهٔ عمودی امن نوار شناور از انتخاب — دسته‌های انتخاب اندروید دقیقاً روی
 * جمله می‌نشینند؛ نوار باید همیشه یک‌تکه بالاتر باشد تا جمله پوشانده نشود */
const TOOLBAR_GAP = 36;

/** نوار ابزار شناور نشان‌گذاری — کپی + پنج رنگ + حذف؛ تنظیم بازه با دستگیره‌های بومی انتخاب */
function MarkToolbar({
  mode, rect, lessonId, markId, text, secId, occ, pfx, sfx, getLive, onDone,
}: {
  mode: "new" | "edit";
  rect: { top: number; bottom: number; centerX: number };
  lessonId: string;
  markId?: string;
  text?: string;
  secId?: string;
  occ?: number;
  pfx?: string;
  sfx?: string;
  /** وضعیت زندهٔ انتخاب — کاربر با دستگیره‌های موبایل بازه را کشیده و بی‌درنگ رنگ می‌زند */
  getLive?: () => { text: string; occ: number; pfx: string; sfx: string; secId: string } | null;
  onDone: () => void;
}) {
  const applyMark = useApp((s) => s.applyMark);
  const removeMark = useApp((s) => s.removeMark);
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null);
  const [copied, setCopied] = React.useState(false);
  const boxRef = React.useRef<HTMLDivElement | null>(null);

  React.useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const x = Math.min(Math.max(12, rect.centerX - w / 2), window.innerWidth - w - 12);
    const y = rect.top > h + TOOLBAR_GAP + 70 ? rect.top - h - TOOLBAR_GAP : rect.bottom + TOOLBAR_GAP;
    setPos({ x, y });
  }, [rect]);

  function pick(color: string) {
    if (!isMarkColor(color)) return;
    if (mode === "new" && text && secId) {
      applyMark(lessonId, { id: Math.random().toString(36).slice(2) + Date.now().toString(36), secId, text, color, occ, pfx, sfx });
      try { window.getSelection()?.removeAllRanges(); } catch {}
    } else if (mode === "edit" && markId) {
      // بازهٔ زندهٔ دستگیره‌ها مقدم است — کاربر ممکن است بازه را کشیده و بلافاصله رنگ زده باشد
      const live = getLive?.() ?? null;
      const base = live && live.secId === (secId ?? "")
        ? live
        : { text: text ?? "", occ, pfx, sfx, secId: secId ?? "" };
      applyMark(lessonId, { id: markId, secId: base.secId || (secId ?? ""), text: base.text, color, occ: base.occ, pfx: base.pfx, sfx: base.sfx });
      try { window.getSelection()?.removeAllRanges(); } catch {}
    }
    onDone();
  }

  async function copySel() {
    const ok = await copyTextToClipboard(text ?? "");
    if (ok) {
      setCopied(true);
      setTimeout(() => onDone(), 800);
    } else {
      onDone();
    }
  }

  return (
    <div
      ref={boxRef}
      className="fixed z-[90] flex max-w-[min(96vw,42rem)] flex-wrap items-center gap-1.5 rounded-2xl border border-border bg-card p-1.5 shadow-card"
      style={{ visibility: pos ? "visible" : "hidden", left: pos?.x ?? 0, top: pos?.y ?? 0 }}
      onMouseDown={(e) => e.preventDefault()}
      data-mark-toolbar="1"
      role="toolbar"
      aria-label="نشان‌گذاری و کپی متن"
    >
      {mode === "new" && <span className="ms-1 text-[11px] font-bold text-muted-foreground">نشان کن:</span>}
      {mode === "edit" && <span className="ms-1 text-[11px] font-bold text-muted-foreground">بازه را با دستگیره بکش، بعد رنگ بزن:</span>}
      {Object.entries(MARK_COLORS).map(([key, c]) => (
        <button
          key={key}
          onClick={() => pick(key)}
          title="رنگ نشان"
          aria-label={`نشان با رنگ ${key}`}
          className="h-8 w-8 rounded-full border border-black/10 transition-transform hover:scale-110 active:scale-95 sm:h-7 sm:w-7"
          style={{ background: c.dot, boxShadow: `inset 0 -3px 6px rgba(0,0,0,.12), 0 1px 3px rgba(0,0,0,.18)` }}
        />
      ))}
      <span className="mx-0.5 h-5 w-px bg-border" />
      <button
        onClick={() => void copySel()}
        title="کپی متن"
        aria-label="کپی متن انتخاب‌شده"
        className={`inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-bold transition-colors sm:h-7 ${copied ? "bg-success/10 text-success" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
      >
        {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "کپی شد" : "کپی"}
      </button>
      {mode === "edit" && markId && (
        <>
          <span className="mx-0.5 h-5 w-px bg-border" />
          <button
            onClick={() => { removeMark(lessonId, markId); onDone(); }}
            className="grid h-8 w-8 place-items-center rounded-lg text-danger transition-colors hover:bg-destructive/10 sm:h-7 sm:w-7"
            title="حذف نشان"
            aria-label="حذف نشان"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

export function LearnView({ id }: { id: string }) {
  const custom = useApp((s) => s.customCourses);
  const tBooks = useApp((s) => s.tBooks);
  const upsertCourse = useApp((s) => s.upsertCourse);
  const openLesson = useApp((s) => s.openLesson);
  const seen = useApp((s) => s.setSectionSeen);
  const complete = useApp((s) => s.completeLesson);
  const prog = useApp((s) => s.progress[id]);
  const notesAll = useApp((s) => s.notes);
  const notes = notesAll[id] ?? EMPTY_NOTES;
  const addNote = useApp((s) => s.addNote);
  const removeNote = useApp((s) => s.removeNote);

  // ── نشان‌گذاری متن ──
  const marksAll = useApp((s) => s.marks);
  const marksForLesson = marksAll[id] ?? EMPTY_MARKS;
  const applyMark = useApp((s) => s.applyMark);
  const articleRef = React.useRef<HTMLElement | null>(null);
  const [markBar, setMarkBar] = React.useState<
    | null
    | { mode: "new"; rect: { top: number; bottom: number; centerX: number }; text: string; secId: string; occ?: number; pfx?: string; sfx?: string }
    | { mode: "edit"; rect: { top: number; bottom: number; centerX: number }; markId: string; secId: string; text: string; occ?: number; pfx?: string; sfx?: string }
  >(null);
  const secIdOf = React.useCallback((el: Element | null): { secEl: Element | null; secId: string | null } => {
    const host = el?.closest("[data-sec-id]") ?? null;
    return { secEl: host, secId: host?.getAttribute("data-sec-id") ?? null };
  }, []);

  // ── یافتن جلسه و دوره ──
  let ctx: { lesson: any; chapter: any; course: Course; index: number; total: number } | null = null;
  for (const c of mergeAll({ customCourses: custom, tBooks })) {
    for (let ci = 0; ci < c.chapters.length; ci++) {
      const li = c.chapters[ci].lessons.findIndex((l) => l.id === id);
      if (li >= 0) ctx = { lesson: c.chapters[ci].lessons[li], chapter: c.chapters[ci], course: c, index: li, total: 0 };
    }
  }

  const [aiPendingBusy, setAiPendingBusy] = React.useState(false);
  const [aiErr, setAiErr] = React.useState("");
  const [aiNotes, setAiNotes] = React.useState<AiNote[]>([]);
  const [loadingFor, setLoadingFor] = React.useState<string | null>(null); // نوع دکمه فعال
  const [questionInput, setQuestionInput] = React.useState("");
  const [showTocMobile, setShowTocMobile] = React.useState(false);
  const [tab, setTab] = React.useState<"teach" | "toc" | "laws">("teach");
  const [feedbackOpen, setFeedbackOpen] = React.useState(false);
  // شیت درون‌خطی «بیشتر» — بدون پورتال؛ الگوی همان نوار نشان که روی اندروید پایدار است
  const [moreOpen, setMoreOpen] = React.useState(false);
  React.useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMoreOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);
  const runMoreAction = React.useCallback((fn: () => void) => {
    setMoreOpen(false);
    fn();
  }, []);

  // ── زوم متن درس — بزرگ/کوچک کردن اندازهٔ متون با مرز منطقی و ماندگاری ──
  const [zoom, setZoomState] = React.useState(1);
  React.useEffect(() => {
    try {
      const v = Number(localStorage.getItem(ZOOM_KEY) || "1");
      if (Number.isFinite(v) && v > 0) setZoomState(LESSON_ZOOM.clamp(v));
    } catch { /* بی‌اثر */ }
  }, []);
  const setZoom = React.useCallback((v: number) => {
    const z = LESSON_ZOOM.clamp(v);
    setZoomState(z);
    try { localStorage.setItem(ZOOM_KEY, String(z)); } catch { /* بی‌اثر */ }
  }, []);

  React.useEffect(() => {
    if (ctx?.lesson && ctx.lesson.status !== "ai-pending") openLesson(id);
     
  }, [id]);

  // ── گیت لود تنبل محتوا: متن جلسه‌های داخلی به‌محض باز شدن از شبکه می‌آید ──
  const textState = useLessonContent(ctx?.lesson);

  // ── رندر نشان‌های ذخیره‌شده روی DOM (بعد از هر تغییر مرتبط) ──
  // گارد امضا: اگر همان نشان‌ها با همان رنگ/متن سالم روی همین DOM هستند، دست
  // نمی‌زنیم — چون unwrap/rewrap نودهای متنی را عوض می‌کند و انتخاب بومیِ
  // دستگیره‌های موبایل (در حال کشیدن) از بین می‌رود. تغییر محتوا (طول متن) یا
  // نشان‌های ناموجود در DOM → اعمال دوباره، مثل قبل.
  React.useLayoutEffect(() => {
    const root = articleRef.current;
    if (!root) return;
    const sectionEls = new Map<string, Element>();
    root.querySelectorAll("[data-sec-id]").forEach((el) => {
      const sid = el.getAttribute("data-sec-id");
      if (sid) sectionEls.set(sid, el);
    });
    if (!sectionEls.size) return;
    const sig =
      marksForLesson.map((m) => `${m.id}|${m.color}|${m.text}`).join("§") +
      "#" + (root.textContent?.length ?? 0);
    const allPresent = marksForLesson.every((m) =>
      root.querySelector(`mark[data-lexa-mark][data-mid="${CSS.escape(m.id)}"]`));
    if (root.getAttribute("data-marks-sig") === sig && allPresent) return;
    applyMarksToSections(sectionEls, marksForLesson);
    root.setAttribute("data-marks-sig", sig);
  }); // بدون آرگومان — اما با گارد امضا؛ اعمال فقط وقتی لازم است

  // ── تشخیص انتخاب متن → نوار ابزار نشان‌گذاری ──
  // انتخابِ روی یک نشان موجود → همان نشان «ویرایش» می‌شود (تغییر بازه با دستگیره‌های
  // بومی موبایل)؛ انتخاب روی متن ساده → «نشان جدید». این همان جایگزین دکمه‌های
  // ابتدا/انتهاست: کاربر مثل انتخاب معمولی، سر و ته بازه را می‌کشد.
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    function check() {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
      const range = sel.getRangeAt(0);
      const anchor = range.startContainer.parentElement ?? null;
      const root = articleRef.current;
      if (!anchor || !root || !root.contains(anchor)) return;
      if (!isSelectableNode(anchor)) return;
      const { secEl, secId } = secIdOf(anchor);
      if (!secEl || !secId) return;
      const located = locateSelection(secEl, range);
      if (!located) return;
      const r = range.getBoundingClientRect();
      if (!r || (!r.width && !r.height)) return;
      const rect = { top: r.top, bottom: r.bottom, centerX: r.left + r.width / 2 };
      const hits = Array.from(secEl.querySelectorAll("mark[data-lexa-mark]")).filter((mk) => range.intersectsNode(mk));
      if (hits.length === 1) {
        const mid = (hits[0] as HTMLElement).dataset.mid;
        const mark = mid ? marksForLesson.find((m) => m.id === mid) : undefined;
        if (mark) {
          setMarkBar({ mode: "edit", markId: mark.id, secId: mark.secId, text: located.text, occ: located.occ, pfx: located.pfx, sfx: located.sfx, rect });
          return;
        }
      }
      setMarkBar({ mode: "new", rect, text: located.text, secId, occ: located.occ, pfx: located.pfx, sfx: located.sfx });
    }
    function settle() {
      timer = null;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) { setMarkBar(null); return; }
      check();
    }
    function onChange() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(settle, 260);
    }
    function onPointerDown(e: Event) {
      const t = e.target as Element | null;
      if (t?.closest?.("[data-mark-toolbar]")) return;
      setMarkBar(null);
    }
    function onScroll() {
      setMarkBar((cur) => {
        if (!cur) return cur;
        if (cur.mode === "new") return null;
        // ویرایش: کشیدن دستگیره می‌تواند صفحه را اسکرول کند — نوار با انتخاب زنده جابه‌جا می‌شود
        const sel = window.getSelection();
        if (sel && sel.rangeCount && !sel.isCollapsed) {
          const r = sel.getRangeAt(0).getBoundingClientRect();
          if (r && (r.width || r.height) && Math.abs(r.top - cur.rect.top) > 8) {
            return { ...cur, rect: { top: r.top, bottom: r.bottom, centerX: r.left + r.width / 2 } };
          }
          return cur;
        }
        return null;
      });
    }
    document.addEventListener("selectionchange", onChange);
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("selectionchange", onChange);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll);
    };
  }, [secIdOf, marksForLesson]);

  /** آخرین وضعیت انتخاب زنده — برای ذخیرهٔ بی‌وقفهٔ بازهٔ کشیده‌شده با دستگیره‌ها */
  const getLiveSelection = React.useCallback((): { text: string; occ: number; pfx: string; sfx: string; secId: string } | null => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    const anchor = range.startContainer.parentElement ?? null;
    const root = articleRef.current;
    if (!anchor || !root || !root.contains(anchor)) return null;
    if (!isSelectableNode(anchor)) return null;
    const { secEl, secId } = secIdOf(anchor);
    if (!secEl || !secId) return null;
    const located = locateSelection(secEl, range);
    return located ? { ...located, secId } : null;
  }, [secIdOf]);

  // ── کلیک/لمس روی نشان موجود → انتخاب بومی متن نشان (دستگیره‌های موبایل) + نوار ویرایش ──
  function handleArticleClick(e: React.MouseEvent) {
    const target = e.target as Element;
    const mk = target.closest?.("mark[data-lexa-mark]") as HTMLElement | null;
    if (!mk) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return; // انتخاب دستی فعال است — selectionchange خودش نوار را می‌سازد
    const mid = mk.dataset.mid;
    if (!mid) return;
    const mark = marksForLesson.find((m) => m.id === mid);
    if (!mark) return;
    // انتخاب بومی متن نشان — دو دستگیرهٔ پیش‌فرض موبایل سر و ته انتخاب می‌نشینند و
    // کاربر با کشیدن همان‌ها بازه را گسترش/کوچک می‌کند (جایگزین ۴ دکمهٔ ابتدا/انتها)
    const segs = Array.from(articleRef.current?.querySelectorAll(`mark[data-lexa-mark][data-mid="${CSS.escape(mid)}"]`) ?? []);
    if (!segs.length) return;
    const first = segs[0].firstChild;
    const last = segs[segs.length - 1].lastChild;
    if (!first || !last) return;
    try {
      const range = document.createRange();
      range.setStart(first, 0);
      range.setEnd(last, last.nodeValue?.length ?? 0);
      sel?.removeAllRanges();
      sel?.addRange(range);
    } catch {
      return;
    }
    const r = sel && sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : mk.getBoundingClientRect();
    setMarkBar({
      mode: "edit",
      markId: mid,
      secId: mark.secId,
      text: mark.text,
      occ: mark.occ,
      pfx: mark.pfx,
      sfx: mark.sfx,
      rect: { top: r.top, bottom: r.bottom, centerX: r.left + r.width / 2 },
    });
  }

  if (!ctx) return <LessonNotFoundGrace />;

  const { lesson, chapter, course } = ctx;
  const sections: LessonSection[] = lesson.sections ?? [];
  const laws = sections.flatMap((s) => s.law ?? []);

  // فصل بعدیِ همین درس (برای دکمهٔ پایان جلسه)
  const chaptersOrdered = [...course.chapters].sort((a, b) => a.order - b.order);
  const chiIdx = chaptersOrdered.findIndex((ch) => ch.id === chapter.id);
  const nextChapter = chiIdx >= 0 ? chaptersOrdered[chiIdx + 1] ?? null : null;

  /** تولید جلسه برای جلسات وارداتی (ai-pending) */
  async function generateAiLesson() {
    setAiPendingBusy(true);
    setAiErr("");
    try {
      const res = await askAi<{ lesson: { title: string; sections: LessonSection[]; quiz?: never[] } }>({
        task: "generate_lesson",
        question: lesson.title,
        content: lesson.sourceSlice ?? "",
        context: { courseTitle: course.title, chapterTitle: chapter.title },
      });
      const generated = res.lesson;
      generated.title = lesson.title;
      const updatedCourse: Course = {
        ...course,
        chapters: course.chapters.map((ch) => ({
          ...ch,
          lessons: ch.lessons.map((l) =>
            l.id === id
              ? { ...l, status: "ready", sections: generated.sections, quiz: normalizeQuiz(generated.quiz) }
              : l,
          ),
        })),
      };
      upsertCourse(updatedCourse);
    } catch (e) {
      setAiErr(e instanceof Error ? e.message : "تولید جلسه ناموفق بود.");
    } finally {
      setAiPendingBusy(false);
    }
  }

  function normalizeQuiz(q: unknown[] | undefined): never[] {
    if (!Array.isArray(q)) return [] as never[];
    return q.filter((x) => x && typeof x === "object") as never[];
  }

  const visibleCount = Math.min(prog?.sectionsSeen ?? 1, sections.length);
  const atEnd = visibleCount >= sections.length;

  async function handleAction(kind: "simple" | "examples" | "ask" | "free", textOverride?: string) {
    const lastVisible = sections[Math.max(0, visibleCount - 1)];
    setLoadingFor(kind + (textOverride ?? ""));
    setAiErr("");
    // متن واقعی همان بخش‌هایی که دانشجو دیده + فهرست مواد معتبر — منبع پاسخ استاد
    const ground = lessonToContextText(sections.slice(0, visibleCount));
    try {
      const res = await askAi<{ text: string }>({
        task: "free",
        mode: kind === "simple" ? "QA" : kind === "examples" ? "TEACH" : "QA",
        modeDirective:
          kind === "simple"
            ? "دانشجو گفت متوجه نشد؛ مفهوم را با یک تشبیه ساده و مثال روزمره دوباره توضیح بده، نه با تکرار متن."
            : kind === "examples"
              ? "دانشجو مثال بیشتر می‌خواهد؛ دو مثال تازه با اعداد فرضی ارائه کن و ماده مرتبط را یادآوری کن."
              : undefined,
        question: kind === "free" || kind === "ask" ? textOverride : `درباره «${lesson.title}» توضیح بیشتر`,
        context: {
          courseTitle: course.title,
          chapterTitle: chapter.title,
          lessonTitle: lesson.title,
          seenSections: sections.slice(0, visibleCount).map((s) => s.title ?? ""),
          extra: ground.text,
          lawRegistry: ground.lawRegistry,
        },
      });
      setAiNotes((n) => [{ sectionId: lastVisible.id, text: res.text }, ...n]);
    } catch (e) {
      setAiErr(e instanceof Error ? e.message : "پاسخی دریافت نشد.");
    } finally {
      setLoadingFor(null);
    }
  }

  function revealNext() {
    seen(id, visibleCount + 1);
    setTimeout(() => {
      document.getElementById(`sec-${visibleCount}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }

  const Sidebar = (
    <aside className="hidden lg:block">
      <div className="sticky top-24 space-y-4">
        <nav className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="mb-3 flex items-center gap-2 border-b border-dashed border-border pb-2.5 text-sm font-bold"><ListOrdered className="h-4 w-4 text-bronze" /> فهرست مطالب جلسه</p>
          <ol className="space-y-0.5 text-[13px]">
            {sections.map((s, i) => (
              <li key={s.id}>
                {i < visibleCount ? (
                  <button onClick={() => document.getElementById(`sec-${i}`)?.scrollIntoView({ behavior: "smooth" })} className={`w-full rounded-lg px-2.5 py-1.5 text-start transition-colors ${i === visibleCount - 1 ? "bg-bronze/10 font-semibold text-bronze" : "text-muted-foreground hover:bg-muted hover:text-primary"}`}>
                    <span className="me-1.5 inline-block w-5 text-left text-[11px] opacity-60" dir="ltr">{fa(i + 1)}</span>
                    {SECTION_META[s.type].title}
                  </button>
                ) : (
                  <span className="block px-2.5 py-1.5 text-muted-foreground/35">{fa(i + 1)}. ▒▒▒</span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        {/* پرسش آزاد از استاد — دسکتاپ: کارت در سایدبار به‌جای نوار شناور */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold"><Send className="h-4 w-4 -scale-x-100 text-bronze" /> از استاد بپرس</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!questionInput.trim()) return;
              handleAction("free", questionInput.trim());
              setQuestionInput("");
            }}
            className="flex items-center gap-2"
          >
            <input
              value={questionInput}
              onChange={(e) => setQuestionInput(e.target.value)}
              placeholder="سوالی از استاد داری؟ بپرس…"
              className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-bronze"
              aria-label="سؤال آزاد از استاد"
            />
            <button type="submit" disabled={!!loadingFor} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40" aria-label="ارسال سوال">
              <Send className="h-4 w-4 -scale-x-100" />
            </button>
          </form>
        </div>
        {laws.length > 0 && (
          <div className="max-h-[46vh] space-y-2.5 overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-card">
            <p className="flex items-center gap-2 border-b border-dashed border-border pb-2.5 text-sm font-bold"><Scale className="h-4 w-4 text-bronze" /> مواد قانونی مرتبط</p>
            {laws.map((l, i) => (
              <p key={i} className="law-text rounded-lg border-s-2 border-bronze/60 bg-gradient-to-l from-bronze/[0.07] to-transparent px-3 py-2 text-[14px] leading-[1.75] sm:text-[15px]">
                <span className="font-display font-bold text-bronze">مادهٔ {l.no}</span> — {l.text.slice(0, 110)}…
              </p>
            ))}
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold"><StickyNote className="h-4 w-4 text-bronze" /> یادداشت من</p>
          <NoteBox onSave={(t) => addNote(id, t)} />
          <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto text-xs">
            {notes.map((n) => (
              <li key={n.id} className="group rounded-lg bg-muted px-3 py-2">
                {n.text}
                <button onClick={() => removeNote(id, n.id)} aria-label="حذف یادداشت" className="float-left opacity-0 transition-opacity group-hover:opacity-100">
                  <Trash2 className="h-3 w-3 text-danger" />
                </button>
              </li>
            ))}
            {notes.length === 0 && <li className="text-muted-foreground/60">هنوز یادداشتی نداری؛ اولین نکته مهم را ثبت کن.</li>}
          </ul>
        </div>
      </div>
    </aside>
  );

  // ─── حالت تولید هوشمند جلسه وارداتی ───
  if (lesson.status === "ai-pending") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <BookMarked className="mx-auto mb-4 h-10 w-10 text-bronze" />
        <h1 className="mb-2 text-xl font-bold">{lesson.title}</h1>
        <p className="mx-auto mb-6 max-w-md text-sm leading-loose text-muted-foreground">
          این جلسه از کتاب وارداتی استخراج شده و هنوز محتوای کامل ندارد. دکمه زیر را بزن تا «استاد حقوقی هوشمند» بر اساس متن اصلی همین کتاب، جلسه را طبق الگوی هشت‌بخشی تدریس کند.
        </p>
        {aiPendingBusy ? (
          <AIThinking label="در حال تحلیل متن کتاب و تنظیم طرح درس" />
        ) : (
          <button onClick={generateAiLesson} className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition-transform active:scale-[.98]">
            <Sparkles className="h-5 w-5" /> تدریس این جلسه توسط استاد
          </button>
        )}
        {aiErr && <p className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{aiErr}</p>}
      </div>
    );
  }

  // ─── لود تنبل: متن هنوز از شبکه نرسیده ───
  if (isLazyLesson(lesson) && lesson.sections.length === 0 && textState !== "ready") {
    return (
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 pt-6 pb-[124px] sm:px-6 lg:grid-cols-[1fr_320px] lg:pb-12">
        <main className="min-w-0">
          <header className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
            <p className="text-xs font-medium text-bronze">{course.title} · فصل {fa(chapter.order)}</p>
            <h1 className="mt-1.5 text-xl font-bold leading-relaxed sm:text-2xl">{lesson.title}</h1>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              {textState === "error" ? (
                <>
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span>دریافت متن جلسه ناموفق بود — اتصال اینترنت را بررسی کن.</span>
                  <button
                    onClick={() => void ensureLessonContent(lesson)}
                    className="ms-auto inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 font-semibold text-bronze hover:border-bronze"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> تلاش دوباره
                  </button>
                </>
              ) : (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-bronze" />
                  <span>در حال دریافت متن جلسه…</span>
                </>
              )}
            </div>
          </header>
          {/* اسکلت بخش‌ها — تا متن برسد؛ شکل‌ها همان بخش‌های هشت‌گانهٔ تدریس است */}
          <div className="space-y-6" aria-busy="true" aria-label="در حال بارگذاری متن جلسه">
            {[92, 78, 64].map((w, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-border bg-card p-5 shadow-card sm:p-7">
                <div className="mb-4 flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-muted" />
                  <div className="h-3.5 rounded bg-muted" style={{ width: `${w * 0.45}%` }} />
                </div>
                <div className="space-y-2.5">
                  <div className="h-3 rounded bg-muted" style={{ width: `${w}%` }} />
                  <div className="h-3 rounded bg-muted" style={{ width: `${Math.max(30, w - 14)}%` }} />
                  <div className="h-3 rounded bg-muted/70" style={{ width: `${Math.max(24, w - 28)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  const bodyTabContent =
    tab === "toc" ? (
      <nav className="space-y-1 lg:hidden">
        {sections.map((s, i) => (
          <button key={s.id} disabled={i >= visibleCount} onClick={() => setTab("teach")} className={`block w-full rounded-lg px-3 py-2 text-start text-sm ${i < visibleCount ? "bg-muted" : "opacity-40"}`}>
            {fa(i + 1)}. {SECTION_META[s.type].title}
          </button>
        ))}
      </nav>
    ) : tab === "laws" ? (
      <LawBox laws={laws} />
    ) : null;

  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 pt-6 pb-[124px] sm:px-6 lg:grid-cols-[1fr_320px] lg:pb-12">
      {/* ستون اصلی */}
      <main className="min-w-0">
        {/* نوار پیشرفت جلسه */}
        <header className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-6">
          <p className="text-xs font-medium text-bronze">{course.title} · فصل {fa(chapter.order)}</p>
          <h1 className="mt-1.5 text-xl font-bold leading-relaxed sm:text-2xl">{lesson.title}</h1>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-border/80">
            <motion.div
              className="progress-sheen h-full rounded-full"
              style={{ background: "linear-gradient(to left, var(--bronze), color-mix(in srgb, var(--primary) 82%, var(--bronze)))" }}
              animate={{ width: `${(visibleCount / Math.max(1, sections.length)) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">بخش {fa(visibleCount)} از {fa(sections.length)} — هر بار یکی را با دقت بخوان، استاد ادامه می‌دهد.</p>

          {/* تب‌های موبایل */}
          <div className="mt-3 flex gap-2 lg:hidden">
            {[["teach", "تدریس"], ["toc", "فهرست"], ["laws", `مواد (${fa(laws.length)})`]].map(([k, t]) => (
              <button key={k} onClick={() => setTab(k as never)} className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${tab === k ? "border-bronze bg-bronze/10 text-bronze" : "border-border text-muted-foreground"}`}>
                {t}
              </button>
            ))}
          </div>
          {tab !== "teach" && <div className="lg:hidden" style={{ zoom } as React.CSSProperties}>{bodyTabContent}</div>}

          {/* زوم متن درس — بزرگ/کوچک‌کردن اندازهٔ متون (۹۰٪ تا ۱۶۰٪) */}
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-border bg-background/50 px-2.5 py-1.5">
            <span className="ps-1 text-[11px] font-bold text-muted-foreground">اندازهٔ متن</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setZoom(zoom - LESSON_ZOOM.step)}
                disabled={zoom <= LESSON_ZOOM.min + 0.001}
                title="کوچک‌تر"
                aria-label="کوچک‌کردن اندازهٔ متن"
                className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-bronze/60 hover:text-bronze disabled:opacity-35"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span dir="ltr" className="min-w-[42px] text-center text-[11px] font-bold tabular-nums text-bronze">{fa(Math.round(zoom * 100))}٪</span>
              <button
                onClick={() => setZoom(zoom + LESSON_ZOOM.step)}
                disabled={zoom >= LESSON_ZOOM.max - 0.001}
                title="بزرگ‌تر"
                aria-label="بزرگ‌کردن اندازهٔ متن"
                className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-bronze/60 hover:text-bronze disabled:opacity-35"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                onClick={() => setZoom(1)}
                disabled={Math.abs(zoom - 1) < 0.001}
                title="اندازهٔ پیش‌فرض"
                aria-label="بازنشانی اندازهٔ متن"
                className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-bronze/60 hover:text-bronze disabled:opacity-35"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </header>

        {/* بخش‌های تدریس */}
        <article
          key={id}
          ref={articleRef}
          className="space-y-6"
          style={{ display: tab === "teach" ? undefined : "none", WebkitTouchCallout: "none", zoom } as React.CSSProperties}
          onClick={handleArticleClick}
          // منوی انتخاب پیش‌فرض مرورگر/وب‌ویو (کپی/انتخاب همه/…) حذف می‌شود تا فقط
          // نوار خود اپ (نشان‌گذاری + کپی) بالا بیاید — درخواست کاربر نسخهٔ اندروید
          onContextMenu={(e) => e.preventDefault()}
        >
          {sections.slice(0, visibleCount).map((s, i) => {
            const meta = SECTION_META[s.type];
            return (
              <motion.section
                key={s.id}
                id={`sec-${i}`}
                data-sec-id={s.id}
                initial={IS_APK ? false : { opacity: 0, y: 14 }}
                animate={IS_APK ? undefined : { opacity: 1, y: 0 }}
                transition={IS_APK ? undefined : { duration: 0.25 }}
                className="scroll-mt-28 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-7"
              >
                <SectionHead n={i + 1} type={s.type} title={s.title ?? meta.title} />

                {/* موتور رندر مشترک — همان المان‌هایی که مطالب اساتید هم استفاده می‌کنند */}
                <SectionBody s={s} />

                {/* پاسخ‌های AI پیوست‌شده — مستندهای 📜 در باکس جدا رندر می‌شوند */}
                {aiNotes.filter((a) => a.sectionId === s.id).map((a, k) => (
                  <div key={k} className="relative mt-4 rounded-xl border border-dashed border-bronze/50 bg-bronze/5 p-4">
                    <Sparkles aria-hidden className="absolute -top-2.5 end-4 grid h-5 w-5 place-items-center rounded-full bg-card text-bronze" />
                    <p className="mb-1 flex items-center gap-1 text-xs font-bold text-bronze"><HelpCircle className="h-3.5 w-3.5" /> تکمیل استاد</p>
                    <AiAnswerRich text={a.text} />
                  </div>
                ))}
              </motion.section>
            );
          })}

          <AnimatePresence>
            {loadingFor && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <AIThinking label={loadingFor.startsWith("simple") ? "در حال بازتعریف ساده‌تر" : loadingFor.startsWith("examples") ? "در حال طراحی مثال‌های تازه" : "در حال بررسی پرسش شما"} />
              </motion.div>
            )}
          </AnimatePresence>

          {aiErr && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{aiErr}</p>}

          {/* نوار کنش جلسه — مینیمال: یک کنش اصلی + منوی بیشتر برای بقیه */}
          <div className="flex flex-wrap items-center gap-2.5">
            {!atEnd ? (
              <button onClick={revealNext} className="inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-3 font-semibold text-primary-foreground shadow-card transition-all duration-200 hover:-translate-y-px hover:brightness-110 active:scale-[.98]">
                <ArrowDownCircle className="h-5 w-5" /> ادامه بده
              </button>
            ) : (
              <>
                <button
                  onClick={() => { complete(id); navigate({ view: "quiz", id }); }}
                  className="inline-flex items-center gap-2 rounded-xl bg-success px-6 py-3 font-semibold text-white shadow-card transition-transform active:scale-[.98]"
                >
                  <ClipboardList className="h-5 w-5" /> برو به تست
                </button>
                {nextChapter && nextChapter.lessons[0] && (
                  <button
                    onClick={() => {
                      complete(id);
                      const first = nextChapter.lessons[0];
                      window.scrollTo({ top: 0, behavior: "smooth" });
                      setTimeout(() => navigate({ view: "learn", id: first.id }), 120);
                    }}
                    title={`رفتن به ${nextChapter.title}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-bronze/50 bg-bronze/10 px-5 py-3 text-sm font-bold text-bronze transition-colors hover:bg-bronze/20 active:scale-[.99]"
                  >
                    <ArrowLeft className="h-4 w-4 shrink-0" />
                    فصل بعدی
                    <span className="hidden max-w-[140px] truncate opacity-75 md:inline">· {nextChapter.title}</span>
                  </button>
                )}
                {!nextChapter && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-success" /> این آخرین فصل این درس است
                  </span>
                )}
              </>
            )}

            {/* همهٔ کنش‌های فرعی فقط داخل شیت «بیشتر» — بدون شلوغی پایین صفحه */}
            <button
              onClick={() => setMoreOpen((v) => !v)}
              disabled={!!loadingFor}
              aria-label="کنش‌های بیشتر"
              aria-expanded={moreOpen}
              title="موارد کمکی و تکمیلی"
              className={`inline-flex h-[46px] items-center gap-1.5 rounded-xl border px-4 text-sm font-semibold shadow-card transition-colors disabled:opacity-45 ${
                moreOpen ? "border-bronze/60 bg-bronze/10 text-bronze" : "border-border bg-card text-muted-foreground hover:border-bronze/60 hover:text-bronze"
              }`}
            >
              <MoreHorizontal className="h-5 w-5" /> بیشتر
            </button>
          </div>
        </article>
      </main>

      {Sidebar}

      {/* شیت «بیشتر» — درون‌خطی و fixed (بدون پورتال/بدون فوکوس-اسکرول)؛ بالای داک موبایل */}
      {moreOpen && (
        <div className="fixed inset-0 z-[85]" onMouseDown={() => setMoreOpen(false)} onTouchStart={() => setMoreOpen(false)} aria-hidden />
      )}
      {moreOpen && (
        <div
          role="menu"
          aria-label="کنش‌های بیشتر جلسه"
          className="fixed inset-x-3 z-[90] mx-auto max-w-md overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-card"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)" }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            role="menuitem"
            onClick={() => runMoreAction(() => handleAction("simple"))}
            disabled={!!loadingFor}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-start text-sm hover:bg-bronze/10 disabled:opacity-45"
          >
            <HelpCircle className="h-4 w-4 shrink-0 text-bronze" /> متوجه نشدم؛ ساده‌تر توضیح بده
          </button>
          <button
            role="menuitem"
            onClick={() => runMoreAction(() => handleAction("examples"))}
            disabled={!!loadingFor}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-start text-sm hover:bg-bronze/10 disabled:opacity-45"
          >
            <Lightbulb className="h-4 w-4 shrink-0 text-bronze" /> مثال بیشتر بده
          </button>
          <div className="mx-2 my-1 h-px bg-border/70" />
          <button
            role="menuitem"
            onClick={() => runMoreAction(() => setFeedbackOpen(true))}
            disabled={!!loadingFor}
            title="انتقاد از تدریس این جلسه؛ تحلیل با جزوه و ارسال به مدیر"
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-start text-sm hover:bg-bronze/10 disabled:opacity-45"
          >
            <MessageSquareWarning className="h-4 w-4 shrink-0 text-bronze" /> نقد تدریس این جلسه…
          </button>
          {atEnd && (
            <button
              role="menuitem"
              onClick={() => runMoreAction(() => navigate({ view: "case", id }))}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-start text-sm hover:bg-bronze/10"
            >
              <Scale className="h-4 w-4 shrink-0 text-bronze" /> تمرین کیس واقعی
            </button>
          )}
          <div className="mx-2 my-1 h-px bg-border/70" />
          <button
            role="menuitem"
            onClick={() => runMoreAction(() => navigate({ view: "course", id: course.id }))}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-start text-sm hover:bg-bronze/10"
          >
            <RotateCcw className="h-4 w-4 shrink-0 text-bronze" /> بازگشت به فهرست درس
          </button>
        </div>
      )}

      {/* نوار ابزار نشان‌گذاری متن — پنج رنگ یا ویرایش/حذف/تنظیم بازهٔ نشان موجود */}
      {markBar && markBar.mode === "new" && (
        <MarkToolbar
          mode="new"
          rect={markBar.rect}
          lessonId={id}
          text={markBar.text}
          secId={markBar.secId}
          occ={markBar.occ}
          pfx={markBar.pfx}
          sfx={markBar.sfx}
          onDone={() => setMarkBar(null)}
        />
      )}
      {markBar && markBar.mode === "edit" && (
        <MarkToolbar
          mode="edit"
          rect={markBar.rect}
          lessonId={id}
          markId={markBar.markId}
          secId={markBar.secId}
          text={markBar.text}
          occ={markBar.occ}
          pfx={markBar.pfx}
          sfx={markBar.sfx}
          getLive={getLiveSelection}
          onDone={() => setMarkBar(null)}
        />
      )}

      {/* گفت‌وگوی بازخورد: انتقاد → تحلیل AI نسبت به جزوه → ثبت پیشنهاد برای مدیر */}
      <FeedbackDialog
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        courseId={course.id}
        chapterTitle={chapter.title}
        lessonId={id}
        lessonTitle={lesson.title}
        getContext={() => {
          const ground = lessonToContextText(sections.slice(0, visibleCount));
          return {
            courseTitle: course.title,
            chapterTitle: chapter.title,
            lessonTitle: lesson.title,
            seenSections: sections.slice(0, visibleCount).map((s) => s.title ?? ""),
            extra: ground.text,
            lawRegistry: ground.lawRegistry,
          };
        }}
      />
    </div>
  );
}

/** پاسخ استاد: متن Markdown + خطوط 📜 (مستند قانونی) در باکس‌های جدا */
function AiAnswerRich({ text }: { text: string }) {
  const { prose, laws } = React.useMemo(() => {
    const lawLines: string[] = [];
    const proseLines: string[] = [];
    for (const ln of text.split("\n")) {
      const t = ln.trim();
      if (t.startsWith("📜")) lawLines.push(t.replace(/^📜\s*/, ""));
      else proseLines.push(ln);
    }
    return { prose: proseLines.join("\n").replace(/\n{3,}/g, "\n\n").trim(), laws: lawLines };
  }, [text]);
  return (
    <>
      {prose && (
        <div className="teach-body prose-p:leading-[1.85] text-[14.5px] sm:text-[15.5px] [&_p]:my-1 [&_strong]:text-foreground">
          <ReactMarkdown>{prose}</ReactMarkdown>
        </div>
      )}
      {laws.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] font-bold text-muted-foreground">مستند قانونی پاسخ:</p>
          {laws.map((l, i) => (
            <p key={i} className="law-text flex gap-2 rounded-lg border-s-2 border-bronze/60 bg-background/70 px-3 py-2.5 text-[14.5px] leading-[1.8] sm:text-[15.5px] sm:leading-[1.9]">
              <Scale className="mt-1.5 h-3.5 w-3.5 shrink-0 text-bronze" />
              <span>{l}</span>
            </p>
          ))}
        </div>
      )}
    </>
  );
}

function NoteBox({ onSave }: { onSave: (t: string) => void }) {
  const [v, setV] = React.useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!v.trim()) return; onSave(v.trim()); setV(""); }}>
      <textarea
        value={v}
        onChange={(e) => setV(e.target.value)}
        rows={2}
        placeholder="یک نکته برای خودت بنویس…"
        className="w-full resize-none rounded-lg border border-input bg-background p-2 text-xs outline-none focus:border-bronze"
      />
      <button type="submit" className="mt-1 inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
        <Plus className="h-3 w-3" /> افزودن
      </button>
    </form>
  );
}
