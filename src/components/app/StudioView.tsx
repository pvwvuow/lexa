"use client";

// ─── اتاق استاد: انتشار مطلب وبلاگی + ساخت دورهٔ آنلاین ────────────────────────
// استاد موقع نوشتن از همان المان‌های تدریس اپ استفاده می‌کند (پاراگراف، مستند
// قانونی، نکات کلیدی، مثال، جدول مقایسه‌ای، سؤال تعاملی) — پیش‌نمایش زنده دارد.
import * as React from "react";
import {
  PenSquare, Plus, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, Loader2,
  BookOpen, Scale, ListChecks, Quote, GitCompareArrows, HelpCircle,
  GraduationCap, ChevronDown, Newspaper, Save, X, Lightbulb,
} from "lucide-react";
import type { LessonSection } from "@/lib/law/types";
import { navigate } from "@/lib/router";
import { fa } from "@/lib/fa";
import { CATEGORIES } from "@/lib/social-shared";
import { SectionBody } from "./common";
import { useAuth } from "@/lib/auth-client";
import { useTCourses } from "@/lib/social-client";
import {
  QuizEditor, ThumbnailPicker,
  draftToQuizPayload, quizPayloadToDraft, emptyQuestion,
  type QuizDraft,
} from "./studio-widgets";

/* ─── ابزار فرم ── */
const inputCls =
  "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-bronze placeholder:text-muted-foreground/50";
const labelCls = "mb-1 block text-[11.5px] font-bold text-muted-foreground";

function newBlock(type: string): LessonSection {
  const id = `b-${Math.random().toString(36).slice(2, 9)}`;
  switch (type) {
    case "law":
      return { id, type: "law", law: [{ no: "", source: "", text: "" }] };
    case "notes":
      return { id, type: "notes", bullets: [""] };
    case "compare":
      return { id, type: "compare", table: { headers: ["", ""], rows: [["", ""]] } };
    case "question":
      return { id, type: "question", questionText: "", suggestedAnswer: "" };
    case "example":
      return { id, type: "example", body: "" };
    case "intro":
      return { id, type: "intro", body: "" };
    default:
      return { id, type: "concept", body: "" };
  }
}

const PALETTE = [
  { type: "concept", label: "پاراگراف / مفهوم", Icon: Lightbulb },
  { type: "law", label: "مستند قانونی", Icon: Scale },
  { type: "notes", label: "نکات کلیدی", Icon: ListChecks },
  { type: "example", label: "مثال کاربردی", Icon: Quote },
  { type: "compare", label: "جدول مقایسه", Icon: GitCompareArrows },
  { type: "question", label: "سؤال تعاملی", Icon: HelpCircle },
] as const;

const LABEL_OF: Record<string, string> = {
  intro: "درآمد",
  concept: "پاراگراف / مفهوم",
  law: "مستند قانونی",
  notes: "نکات کلیدی",
  example: "مثال کاربردی",
  compare: "جدول مقایسه",
  question: "سؤال تعاملی",
  summary: "جمع‌بندی",
};

/* ═══ ویرایشگر بلوکی مشترک مطلب/جلسهٔ دوره ══════════════════════════════════ */
export function BlockEditor({ blocks, onChange }: {
  blocks: LessonSection[];
  onChange: (b: LessonSection[]) => void;
}) {
  const [preview, setPreview] = React.useState(false);

  const patch = (i: number, p: Partial<LessonSection>) =>
    onChange(blocks.map((b, k) => (k === i ? { ...b, ...p } : b)));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const n = [...blocks];
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };

  return (
    <div className="space-y-3">
      {/* جعبه‌ابزار المان‌ها */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold text-muted-foreground">افزودن:</span>
        {PALETTE.map((p) => (
          <button
            key={p.type}
            type="button"
            onClick={() => onChange([...blocks, newBlock(p.type)])}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11.5px] font-semibold text-muted-foreground shadow-card transition-colors hover:border-bronze/60 hover:text-bronze"
          >
            <p.Icon className="h-3.5 w-3.5 text-bronze" /> {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPreview((v) => !v)}
          className={`ms-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-bold transition-colors ${
            preview ? "bg-bronze text-bronze-foreground" : "border border-bronze/50 bg-bronze/10 text-bronze hover:bg-bronze/20"
          }`}
        >
          {preview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {preview ? "بستن پیش‌نمایش" : "پیش‌نمایش زنده"}
        </button>
      </div>

      {/* بلوک‌ها */}
      {blocks.length === 0 && (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
          هنوز بلوکی نداری؛ از جعبه‌ابزار بالا یکی از المان‌ها را اضافه کن.
        </p>
      )}

      {blocks.map((b, i) => (
        <div key={b.id} className="relative overflow-hidden rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-bronze/10 px-2.5 py-0.5 text-[10.5px] font-bold text-bronze">{LABEL_OF[b.type]}</span>
            <span className="flex-1" />
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="انتقال به بالا" className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} aria-label="انتقال به پایین" className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => onChange(blocks.filter((_, k) => k !== i))} aria-label="حذف بلوک" className="rounded-md p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>

          {["concept", "intro", "example"].includes(b.type) && (
            <>
              <input value={b.title ?? ""} onChange={(e) => patch(i, { title: e.target.value })} placeholder="عنوان اختیاری…" className={`${inputCls} mb-2`} aria-label="عنوان بلوک" />
              <textarea
                value={b.body ?? ""}
                onChange={(e) => patch(i, { body: e.target.value })}
                rows={5}
                placeholder={"متن را بنویس…\nنکته: هر خط با «-» شروع شود لیست می‌شود؛ «عنوان: توضیح» کارت اصطلاح می‌شود."}
                className={`${inputCls} resize-y leading-relaxed`}
                aria-label="متن بلوک"
              />
            </>
          )}

          {b.type === "law" && b.law && (
            <div className="space-y-2.5">
              {b.law.map((l, li) => (
                <div key={li} className="grid gap-2 sm:grid-cols-[130px_150px_1fr_auto]">
                  <input value={l.no} onChange={(e) => patch(i, { law: b.law!.map((x, k) => (k === li ? { ...x, no: e.target.value } : x)) })} placeholder="شماره ماده" className={inputCls} aria-label="شماره ماده" />
                  <input value={l.source ?? ""} onChange={(e) => patch(i, { law: b.law!.map((x, k) => (k === li ? { ...x, source: e.target.value } : x)) })} placeholder="منبع (اختیاری)" className={inputCls} aria-label="منبع قانون" />
                  <textarea value={l.text} onChange={(e) => patch(i, { law: b.law!.map((x, k) => (k === li ? { ...x, text: e.target.value } : x)) })} rows={2} placeholder="نص متن ماده…" className={`${inputCls} resize-y`} aria-label="متن ماده" />
                  <button type="button" onClick={() => patch(i, { law: b.law!.filter((_, k) => k !== li) })} aria-label="حذف ماده" className="self-start rounded-lg p-2 text-destructive hover:bg-destructive/10"><X className="h-4 w-4" /></button>
                </div>
              ))}
              <button type="button" onClick={() => patch(i, { law: [...b.law!, { no: "", source: "", text: "" }] })} className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary">
                <Plus className="h-3 w-3" /> افزودن مادهٔ دیگر
              </button>
            </div>
          )}

          {b.type === "notes" && (
            <>
              <input value={b.title ?? ""} onChange={(e) => patch(i, { title: e.target.value })} placeholder="عنوان اختیاری این گروه نکته…" className={`${inputCls} mb-2`} aria-label="عنوان نکات" />
              <textarea
                value={(b.bullets ?? []).join("\n")}
                onChange={(e) => patch(i, { bullets: e.target.value.split("\n") })}
                rows={Math.max(3, (b.bullets ?? []).length + 1)}
                placeholder={"هر خط = یک نکته\nشکل «کلیدواژه: توضیح» هم پشتیبانی می‌شود"}
                className={`${inputCls} resize-y leading-relaxed`}
                aria-label="نکات کلیدی"
              />
            </>
          )}

          {b.type === "compare" && b.table && (
            <div className="space-y-2.5">
              <input
                value={b.table.headers.join("، ")}
                onChange={(e) =>
                  patch(i, { table: { ...b.table!, headers: e.target.value.split(/[،,]/).map((s) => s.trim()) } })
                }
                placeholder="سرستون‌ها را با «،» جدا کن…"
                className={inputCls}
                aria-label="سرستون‌های جدول"
              />
              <textarea
                value={b.table.rows.map((r) => r.join(" | ")).join("\n")}
                onChange={(e) =>
                  patch(i, { table: { ...b.table!, rows: e.target.value.split("\n").map((ln) => ln.split("|").map((c) => c.trim())) } })
                }
                rows={4}
                placeholder={"هر خط = یک ردیف؛ سلول‌ها را با | جدا کن\nمثال: صغیر محجور است | محجوریت منوط به حکم دادگاه نیست"}
                className={`${inputCls} resize-y leading-relaxed`}
                dir="rtl"
                aria-label="ردیف‌های جدول"
              />
              <p className="text-[10px] text-muted-foreground">ستون اول (راست) پررنگ نمایش داده می‌شود.</p>
            </div>
          )}

          {b.type === "question" && (
            <div className="space-y-2">
              <textarea value={b.questionText ?? ""} onChange={(e) => patch(i, { questionText: e.target.value })} rows={2} placeholder="متن سؤال…" className={`${inputCls} resize-y`} aria-label="متن سؤال" />
              <textarea value={b.suggestedAnswer ?? ""} onChange={(e) => patch(i, { suggestedAnswer: e.target.value })} rows={3} placeholder="پاسخ پیشنهادی (با کلیک دانشجو باز می‌شود)…" className={`${inputCls} resize-y`} aria-label="پاسخ پیشنهادی" />
            </div>
          )}
        </div>
      ))}

      {/* پیش‌نمایش زنده */}
      {preview && blocks.length > 0 && (
        <div className="mt-4 space-y-5 rounded-2xl border border-dashed border-bronze/40 bg-gradient-to-b from-background to-card p-5">
          <p className="flex items-center gap-2 text-[11.5px] font-extrabold tracking-wide text-bronze">
            <SparklesIcon /> پیش‌نمایش زنده — دقیقاً همین شکل در صفحهٔ مطلب دیده می‌شود
          </p>
          {blocks.map((s, i) => (
            <section key={s.id}>
              <p className="mb-2 font-display text-[12.5px] font-bold text-bronze">{fa(i + 1)}. {LABEL_OF[s.type]}{s.title ? ` — ${s.title}` : ""}</p>
              <div className="rounded-xl border border-border bg-card p-4">
                <SectionBody s={s} decorativeHeadless />
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function SparklesIcon() {
  return <Newspaper className="h-3.5 w-3.5" />;
}

/* ═══ دیالوگ عمومی ═══════════════════════════════════════════════════════════ */
function Modal({ open, onClose, children, wide }: { open: boolean; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-start justify-items-center overflow-y-auto bg-black/45 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${wide ? "max-w-3xl" : "max-w-xl"} rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6 my-4 max-h-none`}
      >
        {children}
      </div>
    </div>
  );
}

/* ═══ ویرایشگر مطلب ══════════════════════════════════════════════════════════ */
interface PostDraft { id?: string; title: string; summary: string; tags: string; category: string; categories: string[]; blocks: LessonSection[]; thumbnail: string; quiz: QuizDraft[] }
const EMPTY_POST: PostDraft = { title: "", summary: "", tags: "", category: "", categories: [], blocks: [], thumbnail: "", quiz: [] };

/** چیپ‌های انتخاب چندشاخه — استاد می‌تواند هر چند گزینه که خواست انتخاب کند */
function CategoryChips({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CATEGORIES.map((c) => {
        const on = value.includes(c.slug);
        return (
          <button
            key={c.slug}
            type="button"
            onClick={() => onChange(on ? value.filter((v) => v !== c.slug) : [...value, c.slug])}
            aria-pressed={on}
            title={c.desc}
            className={`rounded-full border px-3.5 py-1.5 text-[11.5px] font-bold transition-all ${
              on
                ? "border-bronze bg-bronze/15 text-bronze shadow-card"
                : "border-border bg-background text-muted-foreground hover:border-bronze/40 hover:text-foreground"
            }`}
          >
            {on ? "✓ " : ""}{c.label}
          </button>
        );
      })}
    </div>
  );
}

export function PostEditor({ draft, onClose, onSaved }: { draft: PostDraft | null; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = React.useState<PostDraft>(draft ?? EMPTY_POST);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");

  React.useEffect(() => setD(draft ?? EMPTY_POST), [draft]);

  async function save() {
    setBusy(true); setErr("");
    try {
      const res = await fetch(d.id ? `/api/posts/${d.id}` : "/api/posts", {
        method: d.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...d, quiz: draftToQuizPayload(d.quiz) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "ذخیره ناموفق بود.");
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطایی رخ داد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!draft} onClose={onClose} wide>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><PenSquare className="h-5 w-5" /></span>
        <h2 className="font-display text-lg font-bold">{d.id ? "ویرایش مطلب" : "مطلب جدید"}</h2>
        <button onClick={onClose} aria-label="بستن" className="ms-auto rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
      </div>

      <div className="space-y-3">
        <div>
          <label className={labelCls}>عنوان مطلب *</label>
          <input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="مثلاً: سه اشتباه رایج در قرارداد بیع" className={inputCls} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>خلاصه (برای فید خانه)</label>
            <input value={d.summary} onChange={(e) => setD({ ...d, summary: e.target.value })} maxLength={280} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>برچسب‌ها (با کاما)</label>
            <input value={d.tags} onChange={(e) => setD({ ...d, tags: e.target.value })} placeholder="قراردادها، بیع، نکته امتحانی" className={inputCls} />
          </div>
        </div>
        {/* شاخه‌های کتابخانهٔ عمومی — چندگانه؛ مطلب در همهٔ دسته‌های انتخابی دیده می‌شود */}
        <div>
          <label className={labelCls}>شاخه‌های کتابخانهٔ عمومی (چند گزینه مجاز است)</label>
          <CategoryChips
            value={d.categories}
            onChange={(cats) => setD({ ...d, categories: cats, category: cats[0] ?? "" })}
          />
          <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">اگر شاخه انتخاب کنی، این مطلب در هر یک از آن دسته‌ها هم نمایش داده می‌شود؛ بدون انتخاب فقط در فید دیده می‌شود.</p>
        </div>
        {/* تصویر شاخص دلخواه — آپلود یا لینک؛ اگر خالی باشد جلد رنگی خودکار می‌آید */}
        <ThumbnailPicker value={d.thumbnail} onChange={(thumbnail) => setD({ ...d, thumbnail })} />
        <div>
          <label className={labelCls}>محتوا</label>
          <BlockEditor blocks={d.blocks} onChange={(blocks) => setD({ ...d, blocks })} />
        </div>
        {/* آزمون پایان مبحث — دلخواه؛ دانشجو بعد از مطالعه آن را می‌بیند */}
        <QuizEditor
          label="آزمون پایان این مبحث"
          questions={d.quiz}
          onChange={(quiz) => setD({ ...d, quiz })}
        />
        {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground">انصراف</button>
          <button onClick={save} disabled={busy || !d.title.trim()} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-45">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} انتشار / ذخیره
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ═══ ویرایشگر دورهٔ آنلاین ══════════════════════════════════════════════════ */
interface TLesson { key: string; title: string; minutes?: number; sections: LessonSection[]; quiz: QuizDraft[] }
interface TChapter { key: string; title: string; lessons: TLesson[]; quiz: QuizDraft[] }
interface CourseDraft {
  id?: string; title: string; tagline: string; description: string;
  icon: string; accent: string; category: string; categories: string[]; status: string; thumbnail: string; chapters: TChapter[];
}

const EMPTY_COURSE: CourseDraft = { title: "", tagline: "", description: "", icon: "Scale", accent: "bronze", category: "other", categories: ["other"], status: "published", thumbnail: "", chapters: [] };
const uid = () => Math.random().toString(36).slice(2, 9);

/** سه حالت انتشار دوره */
const COURSE_STATUS: { key: string; label: string; desc: string }[] = [
  { key: "published", label: "منتشر شده", desc: "همه می‌بینند و قابل افزودن به کتابخانه است" },
  { key: "prep", label: "در حال آماده‌سازی", desc: "قابل دیدن و افزودن؛ با برچسبِ زردِ آماده‌سازی" },
  { key: "draft", label: "پیش‌نویس — فقط من", desc: "فقط خودت در اتاق استاد می‌بینی" },
];

export function CourseEditor({ draft, onClose, onSaved }: { draft: CourseDraft | null; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = React.useState<CourseDraft>(draft ?? EMPTY_COURSE);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [openCh, setOpenCh] = React.useState<string>("");

  React.useEffect(() => {
    setD(draft ?? EMPTY_COURSE);
    setOpenCh((draft?.chapters ?? [])[0]?.key ?? "");
  }, [draft]);

  function mutate(fn: (x: CourseDraft) => CourseDraft) { setD(fn(d)); }

  async function save() {
    setBusy(true); setErr("");
    try {
      // اعتبارسنجی سرهٔ کلاینت: فصل خالی حذف نمی‌شود ولی جلسهٔ خالی رد می‌شود
      const chapters = d.chapters.map((c) => ({
        title: c.title,
        quiz: draftToQuizPayload(c.quiz),
        lessons: c.lessons.map((l) => ({ title: l.title, minutes: l.minutes, sections: l.sections, quiz: draftToQuizPayload(l.quiz) })),
      }));
      const res = await fetch("/api/tcourses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...d, chapters }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "ذخیره ناموفق بود.");
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطایی رخ داد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!draft} onClose={onClose} wide>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-bronze/15 text-bronze"><GraduationCap className="h-5 w-5" /></span>
        <h2 className="font-display text-lg font-bold">{d.id ? "ویرایش دوره" : "دورهٔ جدید"}</h2>
        <button onClick={onClose} aria-label="بستن" className="ms-auto rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
      </div>

      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>عنوان دوره *</label>
            <input value={d.title} onChange={(e) => mutate(() => ({ ...d, title: e.target.value }))} placeholder="مثلاً: مسئولیت مدنی در ده جلسه" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>شعار کوتاه</label>
            <input value={d.tagline} onChange={(e) => mutate(() => ({ ...d, tagline: e.target.value }))} maxLength={160} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>آیکون</label>
            <select value={d.icon} onChange={(e) => mutate(() => ({ ...d, icon: e.target.value }))} className={inputCls}>
              <option value="">ترازویی (پیش‌فرض)</option>
              <option value="FileText">سند</option>
              <option value="BookOpenCheck">کتاب تیک‌دار</option>
              <option value="Handshake">توافق</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>توضیح دوره</label>
            <textarea value={d.description} onChange={(e) => mutate(() => ({ ...d, description: e.target.value }))} rows={2} maxLength={2000} className={`${inputCls} resize-y`} />
          </div>
        </div>

        {/* تصویر شاخص دلخواه دوره */}
        <ThumbnailPicker value={d.thumbnail} onChange={(thumbnail) => mutate((x) => ({ ...x, thumbnail }))} />

        {/* شاخه و وضعیت انتشار */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <label className={labelCls}>شاخه‌های کتابخانهٔ عمومی (چند گزینه مجاز است)</label>
            <CategoryChips
              value={d.categories}
              onChange={(cats) => mutate((x) => ({ ...x, categories: cats, category: cats[0] ?? "other" }))}
            />
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              دوره در هر یک از دسته‌های انتخابی دیده می‌شود؛ مثلاً هم «تجارت» و هم «آزمون وکالت».
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>وضعیت انتشار</label>
            <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-muted/60 p-1.5">
              {COURSE_STATUS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => mutate((x) => ({ ...x, status: s.key }))}
                  aria-pressed={d.status === s.key}
                  title={s.desc}
                  className={`rounded-lg px-2 py-2 text-[11px] font-bold leading-tight transition-all ${
                    d.status === s.key
                      ? s.key === "prep"
                        ? "bg-amber-400 text-amber-950 shadow-card"
                        : s.key === "draft"
                          ? "bg-muted-foreground/80 text-background shadow-card"
                          : "bg-success text-success-foreground shadow-card"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              درس‌های ناقص را «در حال آماده‌سازی» بفرست تا دانشجوها بدانند هنوز کامل نشده، اما بتوانند از همان حالا به کتابخانه‌شان اضافه‌اش کنند.
            </p>
          </div>
        </div>

        {/* فصل‌ها */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className={`${labelCls} mb-0`}>فصل‌ها و جلسات دوره</label>
            <button
              type="button"
              onClick={() => {
                const ch: TChapter = { key: uid(), title: "", lessons: [], quiz: [] };
                setOpenCh(ch.key);
                mutate((x) => ({ ...x, chapters: [...x.chapters, ch] }));
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-[11.5px] font-bold text-primary"
            >
              <Plus className="h-3.5 w-3.5" /> فصل جدید
            </button>
          </div>

          {d.chapters.map((ch, ci) => (
            <div key={ch.key} className="overflow-hidden rounded-xl border border-border">
              <div className="flex items-center gap-2 bg-muted/50 px-3 py-2">
                <span className="font-display text-[11.5px] font-bold text-bronze">فصل {fa(ci + 1)}</span>
                <input
                  value={ch.title}
                  onChange={(e) => mutate((x) => ({ ...x, chapters: x.chapters.map((c) => (c.key === ch.key ? { ...c, title: e.target.value } : c)) }))}
                  placeholder="عنوان فصل…"
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                  aria-label="عنوان فصل"
                />
                <button type="button" onClick={() => setOpenCh(openCh === ch.key ? "" : ch.key)} aria-label="باز و بسته کردن فصل">
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openCh === ch.key ? "rotate-180" : ""}`} />
                </button>
                <button type="button" aria-label="حذف فصل" onClick={() => mutate((x) => ({ ...x, chapters: x.chapters.filter((c) => c.key !== ch.key) }))} className="rounded-md p-1 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {openCh === ch.key && (
                <div className="space-y-3 p-3">
                  {ch.lessons.map((ls, li) => (
                    <div key={ls.key} className="rounded-lg border border-dashed border-border p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-[11px] font-bold text-muted-foreground">جلسهٔ {fa(li + 1)}</span>
                        <input
                          value={ls.title}
                          onChange={(e) => mutate((x) => ({
                            ...x,
                            chapters: x.chapters.map((c) => (c.key === ch.key ? { ...c, lessons: c.lessons.map((l) => (l.key === ls.key ? { ...l, title: e.target.value } : l)) } : c)),
                          }))}
                          placeholder="عنوان جلسه *"
                          className="min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 py-1.5 text-[13px] outline-none focus:border-bronze"
                          aria-label="عنوان جلسه"
                        />
                        <button type="button" aria-label="حذف جلسه" onClick={() => mutate((x) => ({ ...x, chapters: x.chapters.map((c) => (c.key === ch.key ? { ...c, lessons: c.lessons.filter((l) => l.key !== ls.key) } : c)) }))} className="rounded-md p-1 text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <BlockEditor
                        blocks={ls.sections}
                        onChange={(sections) => mutate((x) => ({
                          ...x,
                          chapters: x.chapters.map((c) => (c.key === ch.key ? { ...c, lessons: c.lessons.map((l) => (l.key === ls.key ? { ...l, sections } : l)) } : c)),
                        }))}
                      />
                      {/* آزمون این جلسه — دلخواه؛ با همان موتور تست اپ اجرا می‌شود */}
                      <div className="mt-2.5">
                        <QuizEditor
                          label="آزمون این جلسه"
                          questions={ls.quiz}
                          onChange={(quiz) => mutate((x) => ({
                            ...x,
                            chapters: x.chapters.map((c) => (c.key === ch.key ? { ...c, lessons: c.lessons.map((l) => (l.key === ls.key ? { ...l, quiz } : l)) } : c)),
                          }))}
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => mutate((x) => ({ ...x, chapters: x.chapters.map((c) => (c.key === ch.key ? { ...c, lessons: [...c.lessons, { key: uid(), title: "", sections: [], quiz: [] }] } : c)) }))}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-1.5 text-[11.5px] font-bold text-success"
                  >
                    <Plus className="h-3.5 w-3.5" /> جلسهٔ جدید در این فصل
                  </button>
                  {/* آزمون پایان فصل — جمع‌بندی کل فصل با تست */}
                  <QuizEditor
                    label="آزمون پایان این فصل"
                    questions={ch.quiz}
                    onChange={(quiz) => mutate((x) => ({
                      ...x,
                      chapters: x.chapters.map((c) => (c.key === ch.key ? { ...c, quiz } : c)),
                    }))}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground">انصراف</button>
          <button onClick={save} disabled={busy || !d.title.trim()} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-45">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} ذخیرهٔ دوره
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ═══ ویوی اصلی اتاق استاد ═══════════════════════════════════════════════════ */
interface MyPost { id: string; title: string; summary: string; createdAt: string; commentsCount: number }

export function StudioView() {
  const { user, status } = useAuth();
  const { courses: myCourses, reload: reloadCourses } = useTCourses(true);
  const [posts, setPosts] = React.useState<MyPost[]>([]);
  const [tab, setTab] = React.useState<"posts" | "courses">("posts");
  const [postDraft, setPostDraft] = React.useState<PostDraft | null>(null);
  const [courseDraft, setCourseDraft] = React.useState<CourseDraft | null>(null);
  const [busyId, setBusyId] = React.useState("");

  const loadPosts = React.useCallback(async () => {
    try {
      const res = await fetch("/api/posts");
      const j = await res.json();
      if (res.ok) setPosts(j.posts ?? []);
    } catch {}
  }, []);

  React.useEffect(() => {
    if (user && (user.role === "teacher" || user.role === "admin")) void loadPosts();
  }, [user, loadPosts]);

  if (status === "loading") {
    return <div className="flex justify-center py-24 text-bronze"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return (
      <div className="mx-auto max-w-md pt-20">
        <div className="rounded-2xl border border-dashed border-destructive/50 bg-card p-8 text-center shadow-card">
          <GraduationCap className="mx-auto mb-4 h-10 w-10 text-bronze" />
          <h2 className="font-display text-lg font-bold">اتاق استاد</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            این فضا مخصوص حساب‌های استادی است. مدیر سامانه از «پنل مدیریت» برای شما حساب استاد می‌سازد؛
            سپس با همان یوزر و پسورد وارد شوید تا مطالب و دوره بسازید.
          </p>
        </div>
      </div>
    );
  }

  async function deletePost(id: string) {
    if (!confirm("این مطلب حذف شود؟ کامنت‌هایش هم پاک می‌شود.")) return;
    setBusyId(id);
    await fetch(`/api/posts/${id}`, { method: "DELETE" });
    await loadPosts();
    setBusyId("");
  }

  async function deleteCourse(id: string) {
    if (!confirm("این دوره حذف شود؟ نوشته‌هایی که آن را به کتابخانه گرفته‌اند دیگر دسترسی نخواهند داشت.")) return;
    setBusyId(id);
    await fetch(`/api/tcourses/${id}`, { method: "DELETE" });
    await reloadCourses();
    setBusyId("");
  }

  /** بارگذاری مطلب برای ویرایش */
  async function editPost(id: string) {
    try {
      const res = await fetch(`/api/posts/${id}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setPostDraft({
        id: j.post.id, title: j.post.title, summary: j.post.summary, tags: j.post.tags,
        category: j.post.category ?? "",
        categories: Array.isArray(j.post.categories) ? j.post.categories : (j.post.category ? [j.post.category] : []),
        thumbnail: j.post.thumbnail ?? "",
        quiz: quizPayloadToDraft(j.post.quiz ?? []),
        blocks: (j.post.blocks as LessonSection[]) ?? [],
      });
    } catch {}
  }

  /** بارگذاری دوره برای ویرایش — بازسازی جلوهٔ بلاک‌ها از Course */
  async function editCourse(id: string) {
    try {
      const res = await fetch(`/api/tcourses/${id}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      const c = j.course;
      const chapters: TChapter[] = (c.chapters ?? []).map((ch: never) => {
        const chc = ch as unknown as import("@/lib/law/types").Chapter;
        return {
          key: uid(),
          title: chc.title,
          lessons: chc.lessons.map((l) => ({ key: uid(), title: l.title, minutes: l.minutes, sections: (l.sections ?? []) as LessonSection[] })),
        };
      });
      setCourseDraft({ id: c.id, title: c.title, tagline: c.tagline, description: c.description, icon: c.icon ?? "", accent: c.accent ?? "bronze", category: (c as unknown as { _category?: string })._category ?? "other", categories: ((c as unknown as { _categories?: string[] })._categories) ?? [(c as unknown as { _category?: string })._category ?? "other"], status: (c as unknown as { _status?: string })._status ?? "published", thumbnail: (c as unknown as { _thumbnail?: string })._thumbnail ?? "", chapters });
    } catch {}
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 pb-28 pt-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-bronze text-bronze-foreground shadow-card"><PenSquare className="h-6 w-6" /></span>
            اتاق استاد — {user.username}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            مثل یک وبلاگ بنویس؛ اما با المان‌های حرفه‌ای تدریس همین اپ — و دورهٔ خودت را به‌عنوان کتاب به دانشجوها بده.
          </p>
        </div>
        <button onClick={() => navigate({ view: "teachers" })} className="text-xs font-semibold text-bronze hover:underline">صفحهٔ اساتید ←</button>
      </header>

      {/* تب‌ها */}
      <div className="flex gap-2">
        {([["posts", "مطالب من"], ["courses", "دوره‌های من"]] as const).map(([k, t]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
              tab === k ? "bg-primary text-primary-foreground shadow-card" : "border border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {k === "posts" ? <Newspaper className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
            {t}
          </button>
        ))}
        <span className="flex-1" />
        <button
          onClick={() => setPostDraft({ ...EMPTY_POST })}
          className="inline-flex items-center gap-2 rounded-xl bg-bronze px-4 py-2.5 text-sm font-bold text-bronze-foreground shadow-card transition-transform active:scale-[.98]"
        >
          <Plus className="h-4 w-4" /> مطلب جدید
        </button>
        <button
          onClick={() => setCourseDraft({ ...EMPTY_COURSE, chapters: [] })}
          className="inline-flex items-center gap-2 rounded-xl border border-bronze/50 bg-bronze/10 px-4 py-2.5 text-sm font-bold text-bronze transition-colors hover:bg-bronze/20"
        >
          <Plus className="h-4 w-4" /> دورهٔ جدید
        </button>
      </div>

      {/* مطالب من */}
      {tab === "posts" && (
        <section className="space-y-2.5">
          {posts.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground shadow-card">
              هنوز مطلبی منتشر نکرده‌ای — با «مطلب جدید» شروع کن.
            </p>
          )}
          {posts.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card transition-colors hover:border-bronze/50">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Newspaper className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{p.title}</p>
                <p className="text-[10.5px] text-muted-foreground">
                  {new Date(p.createdAt).toLocaleDateString("fa-IR", { month: "long", day: "numeric" })}
                  {" · "}
                  {fa(p.commentsCount)} نظر
                </p>
              </div>
              <button onClick={() => navigate({ view: "post", id: p.id })} className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:border-bronze hover:text-bronze">مشاهده</button>
              <button onClick={() => editPost(p.id)} className="rounded-lg border border-bronze/40 px-3 py-1.5 text-[11px] font-bold text-bronze transition-colors hover:bg-bronze/10">ویرایش</button>
              <button onClick={() => deletePost(p.id)} disabled={busyId === p.id} aria-label="حذف مطلب" className="rounded-lg p-1.5 text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-40">
                {busyId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </div>
          ))}
        </section>
      )}

      {/* دوره‌های من */}
      {tab === "courses" && (
        <section className="space-y-2.5">
          {myCourses.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground shadow-card">
              هنوز دوره‌ای نساخته‌ای — «دورهٔ جدید» را بزن و جلساتت را با المان‌های تدریس آماده کن.
            </p>
          )}
          {myCourses.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card transition-colors hover:border-bronze/50">
              <BookOpen className="h-8 w-8 shrink-0 text-bronze" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{c.title}</p>
                <p className="text-[10.5px] text-muted-foreground">{fa(c.lessonsCount)} جلسه · {fa(c.studentsCount)} دانشجو کتابخانه کرده</p>
              </div>
              <button onClick={() => editCourse(c.id)} className="rounded-lg border border-bronze/40 px-3 py-1.5 text-[11px] font-bold text-bronze transition-colors hover:bg-bronze/10">ویرایش</button>
              <button onClick={() => deleteCourse(c.id)} disabled={busyId === c.id} aria-label="حذف دوره" className="rounded-lg p-1.5 text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-40">
                {busyId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </div>
          ))}
        </section>
      )}

      <PostEditor draft={postDraft} onClose={() => setPostDraft(null)} onSaved={() => void loadPosts()} />
      <CourseEditor draft={courseDraft} onClose={() => setCourseDraft(null)} onSaved={() => void reloadCourses()} />
    </div>
  );
}
