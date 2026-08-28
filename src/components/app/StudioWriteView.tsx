"use client";

/* ═══ صفحهٔ کامل و تخصصی نوشتن مطلب / دوره (اتاق استاد) ═══════════════════════
 * به‌جای پاپ‌آپ: یک صفحهٔ تمام‌عیار با نوار عملیات چسبان، ستون پیش‌نمایش زندهٔ
 * کنار نوشتن، تمام المان‌های تدریس (درآمد، مفهوم، مستند قانونی، نکات، مثال،
 * جدول مقایسه، سؤال، جمع‌بندی)، آزمون پایان مبحث/جلسه/فصل و زمان مطالعهٔ جلسه.
 * ──────────────────────────────────────────────────────────────────────────── */
import * as React from "react";
import {
  Loader2, Save, ArrowRight, Newspaper, GraduationCap, BookOpen, Plus, Trash2,
  ChevronDown, Sparkles, ListTree, Clock3, PenSquare, Eye,
} from "lucide-react";
import type { LessonSection } from "@/lib/law/types";
import { navigate } from "@/lib/router";
import { fa } from "@/lib/fa";
import { SectionBody } from "./common";
import { useAuth } from "@/lib/auth-client";
import {
  QuizEditor, ThumbnailPicker,
  draftToQuizPayload, quizPayloadToDraft,
} from "./studio-widgets";
import {
  inputCls, labelCls, BlockEditor, CategoryChips,
  PostDraft, EMPTY_POST, CourseDraft, EMPTY_COURSE, TChapter, uid, LABEL_OF,
} from "./StudioView";

/* ── محافظ دسترسی: فقط استاد/مدیر ── */
function TeacherOnly({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth();
  if (status === "loading") {
    return <div className="flex justify-center py-24 text-bronze"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return (
      <div className="mx-auto max-w-md pt-20">
        <div className="rounded-2xl border border-dashed border-destructive/50 bg-card p-8 text-center shadow-card">
          <GraduationCap className="mx-auto mb-4 h-10 w-10 text-bronze" />
          <h2 className="font-display text-lg font-bold">این صفحه مخصوص حساب‌های استادی است</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            برای نوشتن مطلب یا دوره، با حساب استاد وارد شو.
          </p>
          <button onClick={() => navigate({ view: "studio" })} className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground">رفتن به اتاق استاد</button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

/* ── نوار عملیات چسبان بالای صفحهٔ نوشتن ── */
function WriteBar({
  icon: Icon, title, busy, saveDisabled, onSave, saveLabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  busy: boolean;
  saveDisabled: boolean;
  onSave: () => void;
  saveLabel: string;
}) {
  return (
    <div className="sticky top-[74px] z-20 mb-5 flex items-center gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-card backdrop-blur">
      <button
        onClick={() => navigate({ view: "studio" })}
        aria-label="بازگشت به اتاق استاد"
        title="بازگشت به اتاق استاد"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border text-muted-foreground transition-colors hover:border-bronze/60 hover:text-bronze"
      >
        <ArrowRight className="h-4 w-4" />
      </button>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-bronze/15 text-bronze"><Icon className="h-4.5 w-4.5" /></span>
      <h1 className="min-w-0 flex-1 truncate text-[15px] font-extrabold">{title}</h1>
      <button
        onClick={onSave}
        disabled={busy || saveDisabled}
        className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[12.5px] font-bold text-primary-foreground shadow-card transition-all hover:brightness-110 disabled:opacity-45"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {busy ? "در حال ذخیره…" : saveLabel}
      </button>
    </div>
  );
}

/* ── آمار متن برای ستون کناری ── */
function wordCountOf(blocks: LessonSection[]): number {
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

/* ═══ صفحهٔ نوشتن مطلب ══════════════════════════════════════════════════════ */
function WritePostPage({ id }: { id?: string }) {
  const isNew = !id || id === "new";
  const [d, setD] = React.useState<PostDraft | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (isNew) { setD({ ...EMPTY_POST }); return; }
      try {
        const res = await fetch(`/api/posts/${id}`);
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? "مطلب پیدا نشد");
        if (!alive) return;
        setD({
          id: j.post.id, title: j.post.title, summary: j.post.summary, tags: j.post.tags ?? "",
          category: j.post.category ?? "",
          categories: Array.isArray(j.post.categories) ? j.post.categories : (j.post.category ? [j.post.category] : []),
          thumbnail: j.post.thumbnail ?? "",
          quiz: quizPayloadToDraft(j.post.quiz ?? []),
          blocks: (j.post.blocks as LessonSection[]) ?? [],
        });
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "خطا در بارگذاری مطلب");
      }
    })();
    return () => { alive = false; };
  }, [id, isNew]);

  async function save() {
    if (!d) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch(d.id ? `/api/posts/${d.id}` : "/api/posts", {
        method: d.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...d, quiz: draftToQuizPayload(d.quiz) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "ذخیره ناموفق بود.");
      navigate({ view: "studio" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطایی رخ داد.");
      setBusy(false);
    }
  }

  if (err && !d) return <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{err}</p>;
  if (!d) return <div className="flex justify-center py-24 text-bronze"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const words = wordCountOf(d.blocks);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-4 sm:px-6">
      <WriteBar
        icon={Newspaper}
        title={isNew ? "مطلب جدید" : `ویرایش مطلب — ${d.title || "بدون عنوان"}`}
        busy={busy}
        saveDisabled={!d.title.trim()}
        onSave={() => void save()}
        saveLabel={isNew ? "انتشار مطلب" : "ذخیرهٔ تغییرات"}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
        {/* ── ستون نوشتن ── */}
        <div className="min-w-0 space-y-4">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="mb-3 flex items-center gap-2 text-[13px] font-extrabold text-bronze"><PenSquare className="h-4 w-4" /> مشخصات مطلب</h2>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>عنوان مطلب *</label>
                <input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="مثلاً: سه اشتباه رایج در قرارداد بیع" className={`${inputCls} text-[15px] font-bold`} />
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
              <div>
                <label className={labelCls}>شاخه‌های کتابخانهٔ عمومی (چند گزینه مجاز است)</label>
                <CategoryChips
                  value={d.categories}
                  onChange={(cats) => setD({ ...d, categories: cats, category: cats[0] ?? "" })}
                />
                <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">اگر شاخه انتخاب کنی، این مطلب در هر یک از آن دسته‌ها هم نمایش داده می‌شود؛ بدون انتخاب فقط در فید دیده می‌شود.</p>
              </div>
              <ThumbnailPicker value={d.thumbnail} onChange={(thumbnail) => setD({ ...d, thumbnail })} />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="mb-3 flex items-center gap-2 text-[13px] font-extrabold text-bronze"><BookOpen className="h-4 w-4" /> محتوا — با المان‌های حرفه‌ای تدریس</h2>
            <BlockEditor blocks={d.blocks} onChange={(blocks) => setD({ ...d, blocks })} />
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <QuizEditor
              label="آزمون پایان این مبحث"
              questions={d.quiz}
              onChange={(quiz) => setD({ ...d, quiz })}
            />
          </section>

          {err && <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{err}</p>}
        </div>

        {/* ── ستون پیش‌نمایش زنده (دسکتاپ) ── */}
        <aside className="hidden lg:block">
          <div className="sticky top-[140px] space-y-3">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <p className="flex items-center gap-2 text-[12px] font-extrabold text-bronze"><Eye className="h-4 w-4" /> پیش‌نمایش زنده</p>
              <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">همان‌طور که می‌نویسی، دقیقاً شکلی که دانشجو می‌بیند اینجا رندر می‌شود.</p>
              <div className="mt-3 flex gap-2 text-[10px] font-bold text-muted-foreground">
                <span className="rounded-full bg-muted px-2.5 py-1">{fa(d.blocks.length)} المان</span>
                <span className="rounded-full bg-muted px-2.5 py-1">{fa(words)} واژه</span>
                <span className="rounded-full bg-muted px-2.5 py-1">{fa(d.quiz.length)} سؤال آزمون</span>
              </div>
            </div>
            <div className="max-h-[calc(100vh-300px)] space-y-4 overflow-y-auto rounded-2xl border border-dashed border-bronze/40 bg-gradient-to-b from-background to-card p-4">
              {d.blocks.length === 0 && (
                <p className="py-8 text-center text-[11px] text-muted-foreground">با افزودن اولین المان، پیش‌نمایش اینجا جان می‌گیرد.</p>
              )}
              {d.blocks.map((s, i) => (
                <section key={s.id}>
                  <p className="mb-1.5 font-display text-[11.5px] font-bold text-bronze">{fa(i + 1)}. {LABEL_OF[s.type]}{s.title ? ` — ${s.title}` : ""}</p>
                  <div className="rounded-xl border border-border bg-card p-3.5">
                    <SectionBody s={s} decorativeHeadless />
                  </div>
                </section>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ═══ صفحهٔ ساخت دورهٔ آنلاین ═══════════════════════════════════════════════ */
const COURSE_STATUS: { key: string; label: string; desc: string }[] = [
  { key: "published", label: "منتشر شده", desc: "همه می‌بینند و قابل افزودن به کتابخانه است" },
  { key: "prep", label: "در حال آماده‌سازی", desc: "قابل دیدن و افزودن؛ با برچسبِ زردِ آماده‌سازی" },
  { key: "draft", label: "پیش‌نویس — فقط من", desc: "فقط خودت در اتاق استاد می‌بینی" },
];

function WriteCoursePage({ id }: { id?: string }) {
  const isNew = !id || id === "new";
  const [d, setD] = React.useState<CourseDraft | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [openCh, setOpenCh] = React.useState<string>("");

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (isNew) {
        setD({ ...EMPTY_COURSE, chapters: [] });
        return;
      }
      try {
        const res = await fetch(`/api/tcourses/${id}`);
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? "دوره پیدا نشد");
        if (!alive) return;
        const c = j.course;
        const chapters: TChapter[] = (c.chapters ?? []).map((ch: never) => {
          const chc = ch as unknown as import("@/lib/law/types").Chapter;
          return {
            key: uid(),
            title: chc.title,
            quiz: quizPayloadToDraft(((chc as { quiz?: unknown }).quiz ?? []) as import("@/lib/law/types").QuizQuestion[]),
            lessons: chc.lessons.map((l) => ({
              key: uid(), title: l.title, minutes: l.minutes,
              sections: (l.sections ?? []) as LessonSection[],
              quiz: quizPayloadToDraft(l.quiz ?? []),
            })),
          };
        });
        setD({
          id: c.id, title: c.title, tagline: c.tagline, description: c.description,
          icon: c.icon ?? "Scale", accent: c.accent ?? "bronze",
          category: (c as unknown as { _category?: string })._category ?? "other",
          categories: ((c as unknown as { _categories?: string[] })._categories) ?? [(c as unknown as { _category?: string })._category ?? "other"],
          status: (c as unknown as { _status?: string })._status ?? "published",
          thumbnail: (c as unknown as { _thumbnail?: string })._thumbnail ?? "",
          chapters,
        });
        setOpenCh(chapters[0]?.key ?? "");
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "خطا در بارگذاری دوره");
      }
    })();
    return () => { alive = false; };
  }, [id, isNew]);

  function mutate(fn: (x: CourseDraft) => CourseDraft) { setD((prev) => (prev ? fn(prev) : prev)); }

  async function save() {
    if (!d) return;
    setBusy(true); setErr("");
    try {
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
      navigate({ view: "studio" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطایی رخ داد.");
      setBusy(false);
    }
  }

  if (err && !d) return <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{err}</p>;
  if (!d) return <div className="flex justify-center py-24 text-bronze"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const lessonsN = d.chapters.reduce((n, c) => n + c.lessons.length, 0);
  const quizN = d.chapters.reduce((n, c) => n + c.quiz.length + c.lessons.reduce((m, l) => m + l.quiz.length, 0), 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-4 sm:px-6">
      <WriteBar
        icon={GraduationCap}
        title={isNew ? "دورهٔ جدید" : `ویرایش دوره — ${d.title || "بدون عنوان"}`}
        busy={busy}
        saveDisabled={!d.title.trim()}
        onSave={() => void save()}
        saveLabel={isNew ? "انتشار دوره" : "ذخیرهٔ دوره"}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
        {/* ── ستون نوشتن ── */}
        <div className="min-w-0 space-y-4">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="mb-3 flex items-center gap-2 text-[13px] font-extrabold text-bronze"><GraduationCap className="h-4 w-4" /> مشخصات دوره</h2>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>عنوان دوره *</label>
                <input value={d.title} onChange={(e) => mutate((x) => ({ ...x, title: e.target.value }))} placeholder="مثلاً: مسئولیت مدنی در ده جلسه" className={`${inputCls} text-[15px] font-bold`} />
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_170px]">
                <div>
                  <label className={labelCls}>شعار کوتاه</label>
                  <input value={d.tagline} onChange={(e) => mutate((x) => ({ ...x, tagline: e.target.value }))} maxLength={160} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>آیکون دوره</label>
                  <select value={d.icon} onChange={(e) => mutate((x) => ({ ...x, icon: e.target.value }))} className={inputCls}>
                    <option value="Scale">ترازو (پیش‌فرض)</option>
                    <option value="FileText">سند</option>
                    <option value="BookOpenCheck">کتاب تیک‌دار</option>
                    <option value="Handshake">توافق</option>
                    <option value="Globe">جهان</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>توضیح دوره</label>
                <textarea value={d.description} onChange={(e) => mutate((x) => ({ ...x, description: e.target.value }))} rows={3} maxLength={2000} className={`${inputCls} resize-y`} />
              </div>
              <ThumbnailPicker value={d.thumbnail} onChange={(thumbnail) => mutate((x) => ({ ...x, thumbnail }))} />
              <div>
                <label className={labelCls}>شاخه‌های کتابخانهٔ عمومی (چند گزینه مجاز است)</label>
                <CategoryChips
                  value={d.categories}
                  onChange={(cats) => mutate((x) => ({ ...x, categories: cats, category: cats[0] ?? "other" }))}
                />
              </div>
              <div>
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
              </div>
            </div>
          </section>

          {/* فصل‌ها و جلسات */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[13px] font-extrabold text-bronze"><ListTree className="h-4 w-4" /> فصل‌ها و جلسات دوره</h2>
              <button
                type="button"
                onClick={() => {
                  const ch = { key: uid(), title: "", lessons: [], quiz: [] };
                  setOpenCh(ch.key);
                  mutate((x) => ({ ...x, chapters: [...x.chapters, ch] }));
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-[11.5px] font-bold text-primary"
              >
                <Plus className="h-3.5 w-3.5" /> فصل جدید
              </button>
            </div>

            {d.chapters.length === 0 && (
              <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                ساختار دوره را اینجا بساز: فصل → جلسه → درسِ جلسه با المان‌های تدریس + آزمون.
              </p>
            )}

            <div className="space-y-3">
              {d.chapters.map((ch, ci) => (
                <div key={ch.key} className="overflow-hidden rounded-xl border border-border">
                  <div className="flex items-center gap-2 bg-muted/50 px-3 py-2">
                    <span className="shrink-0 font-display text-[11.5px] font-bold text-bronze">فصل {fa(ci + 1)}</span>
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
                          <div className="mb-2 flex flex-wrap items-center gap-2">
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
                            <span className="inline-flex items-center gap-1 rounded-lg border border-input bg-background px-2 py-1" title="زمان مطالعهٔ این جلسه (دقیقه)">
                              <Clock3 className="h-3.5 w-3.5 text-bronze" />
                              <input
                                type="number" min={1} max={600}
                                value={ls.minutes ?? ""}
                                onChange={(e) => mutate((x) => ({
                                  ...x,
                                  chapters: x.chapters.map((c) => (c.key === ch.key ? { ...c, lessons: c.lessons.map((l) => (l.key === ls.key ? { ...l, minutes: e.target.value ? Number(e.target.value) : undefined } : l)) } : c)),
                                }))}
                                placeholder="۱۵"
                                dir="ltr"
                                className="w-14 bg-transparent text-[12px] tabular-nums outline-none"
                                aria-label="زمان مطالعه به دقیقه"
                              />
                              <span className="text-[10px] text-muted-foreground">دقیقه</span>
                            </span>
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
          </section>

          {err && <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{err}</p>}
        </div>

        {/* ── ستون راهنما و آمار (دسکتاپ) ── */}
        <aside className="hidden lg:block">
          <div className="sticky top-[140px] space-y-3">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <p className="flex items-center gap-2 text-[12px] font-extrabold text-bronze"><Sparkles className="h-4 w-4" /> آمار دوره</p>
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold text-muted-foreground">
                <span className="rounded-full bg-muted px-2.5 py-1">{fa(d.chapters.length)} فصل</span>
                <span className="rounded-full bg-muted px-2.5 py-1">{fa(lessonsN)} جلسه</span>
                <span className="rounded-full bg-muted px-2.5 py-1">{fa(quizN)} سؤال آزمون</span>
              </div>
              <p className="mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
                الگوی پیشنهادی هر جلسه مثل درس‌های آمادهٔ اپ: «درآمد» → دو سه «مفهوم» → «مستند قانونی» → «نکات کلیدی» → «مثال» یا «جدول مقایسه» → «سؤال تعاملی» → «جمع‌بندی» + آزمون.
              </p>
            </div>
            <div className="rounded-2xl border border-dashed border-bronze/40 bg-gradient-to-b from-background to-card p-4">
              <p className="text-[11.5px] font-extrabold text-bronze">نقشهٔ ساخت دوره</p>
              <ol className="mt-2 space-y-2 text-[10.5px] leading-relaxed text-muted-foreground">
                <li>۱. مشخصات و شاخه‌ها را کامل کن — همین‌ها در کتابخانهٔ عمومی نمایش داده می‌شود.</li>
                <li>۲. فصل‌ها را مثل کتاب بیافرین؛ هر فصل چند جلسه دارد.</li>
                <li>۳. درسِ هر جلسه را با المان‌های تدریس بنویس (همان موتور درس‌های آماده).</li>
                <li>۴. برای جلسه و فصل، آزمون چهارگزینه‌ای بساز تا دانشجو خودش را بسنجد.</li>
                <li>۵. اگر دوره ناتمام است «در حال آماده‌سازی» بگذار تا دانشجوها از همان حالا دنبالش کنند.</li>
              </ol>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ═══ ورودی اصلی — بر اساس مسیر ════════════════════════════════════════════ */
export function StudioWriteView({ kind, id }: { kind: "post" | "course"; id?: string }) {
  return (
    <TeacherOnly>
      {kind === "post" ? <WritePostPage key={id ?? "new"} id={id} /> : <WriteCoursePage key={id ?? "new"} id={id} />}
    </TeacherOnly>
  );
}
