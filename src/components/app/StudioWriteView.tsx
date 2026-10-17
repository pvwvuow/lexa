"use client";

/* === صفحهٔ نوشتن مطلب / دوره (اتاق استاد) — نسخهٔ دوم ===
 * مطلب: عنوان همیشه بالا + سه زبانهٔ «محتوا / مشخصات / آزمون»؛ بخش‌ها فشرده و
 * فقط یکی باز؛ پیش‌نمایش زنده کنار صفحه (دسکتاپ) یا با یک لمس (موبایل).
 * دوره: فهرست فصل‌ها و جلسه‌ها کنار صفحه؛ در هر لحظه فقط همان جلسه/فصلی که
 * انتخاب شده ویرایش می‌شود؛ آزمون جلسه در زبانهٔ خودش.
 * هر دو: واگرد/ازنو (Ctrl+Z / Ctrl+Shift+Z)، ذخیره با Ctrl+S، پیش‌نویس خودکار
 * روی همین دستگاه، چک‌لیست انتشار با پرش به ایراد، و «انتشار به نام سازمان».
 * دادهٔ ذخیره‌شده همان قالب قبلی است (LessonSection[] و فصل/جلسه/آزمون).
 * --- */
import * as React from "react";
import {
  Loader2, Save, ArrowRight, Newspaper, GraduationCap, BookOpen, Plus, Trash2,
  ChevronDown, ChevronUp, History, Sparkles, ListTree, Clock3, PenSquare, Eye, Undo2, Redo2,
  ListChecks, CircleAlert, CheckCircle2, ChevronLeft, ChevronRight, Settings2, Layers3,
} from "lucide-react";
import type { LessonSection, QuizQuestion, Chapter } from "@/lib/law/types";
import { navigate } from "@/lib/router";
import { fa } from "@/lib/fa";
import { useAuth } from "@/lib/auth-client";
import { QuizEditor, ThumbnailPicker, draftToQuizPayload, quizPayloadToDraft, type QuizDraft } from "./studio-widgets";
import {
  inputCls, labelCls, CategoryChips,
  type PostDraft, EMPTY_POST, type CourseDraft, EMPTY_COURSE, type TChapter, type TLesson, uid,
} from "./StudioView";
import {
  SectionsEditor, SectionsPreview, sectionIssues, countIssues, wordCountOf,
  useHistoryState, useEditorShortcuts,
} from "./studio-editor";
import { OrgPublishPicker } from "./OrgView";

type PostD = PostDraft & { orgId?: string };
type CourseD = CourseDraft & { orgId?: string };

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
            برای نوشتن مطلب یا دوره، با حساب استادی وارد شو. حساب استادی نداری؟ از «دانشگاه‌ها و موسسه‌ها» درخواستش را بفرست.
          </p>
          <button onClick={() => navigate({ view: "org" })} className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground">درخواست حساب استادی</button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

/* ── پیش‌نویس محلی: ذخیرهٔ خودکار روی همین دستگاه ── */
interface DraftEnvelope { savedAt: string; data: unknown }
function draftKeyOf(kind: "post" | "course", id?: string) {
  return `studio-draft:${kind}:${id || "new"}`;
}
function readDraft(key: string): DraftEnvelope | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const j = JSON.parse(raw) as DraftEnvelope;
    return j && typeof j.savedAt === "string" && j.data != null ? j : null;
  } catch { return null; }
}
function writeDraft(key: string, data: unknown) {
  try { localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), data })); } catch {}
}
function clearDraft(key: string) {
  try { localStorage.removeItem(key); } catch {}
}
function faDraftTime(iso: string) {
  return new Date(iso).toLocaleString("fa-IR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function RestoreBanner({ savedAt, onRestore, onDiscard }: { savedAt: string; onRestore: () => void; onDiscard: () => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-400/50 bg-amber-400/10 px-4 py-3">
      <History className="h-4.5 w-4.5 shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="min-w-0 flex-1 text-[12px] font-semibold leading-relaxed text-amber-700 dark:text-amber-300">
        پیش‌نویس ذخیره‌نشده‌ای از {faDraftTime(savedAt)} روی همین دستگاه پیدا شد — بازیابی شود؟
      </p>
      <button type="button" onClick={onRestore} className="rounded-xl bg-amber-500 px-3.5 py-2 text-[11.5px] font-bold text-amber-950 shadow-card transition-colors hover:brightness-105">بازیابی</button>
      <button type="button" onClick={onDiscard} className="rounded-xl border border-border bg-card px-3 py-2 text-[11.5px] font-bold text-muted-foreground transition-colors hover:text-foreground">رد کردن</button>
    </div>
  );
}

function useDraftGuard(key: string, d: unknown, ready: boolean) {
  const baselineRef = React.useRef("");
  const [restore, setRestore] = React.useState<DraftEnvelope | null>(null);
  const [checked, setChecked] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const json = React.useMemo(() => (ready ? JSON.stringify(d) : ""), [d, ready]);

  React.useEffect(() => {
    if (!ready || checked) return;
    setChecked(true);
    baselineRef.current = json;
    const local = readDraft(key);
    if (local && JSON.stringify(local.data) !== json) setRestore(local);
  }, [ready, checked, json, key]);

  React.useEffect(() => {
    if (!checked || !json || json === baselineRef.current) return;
    setDirty(true);
    const t = setTimeout(() => {
      writeDraft(key, JSON.parse(json));
      baselineRef.current = json;
      setDirty(false);
    }, 800);
    return () => clearTimeout(t);
  }, [json, checked, key]);

  React.useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  return {
    restore,
    dropRestore: () => { clearDraft(key); setRestore(null); },
    applyRestore: () => {
      if (!restore) return;
      const next = restore.data;
      clearDraft(key);
      setRestore(null);
      return next;
    },
    markSaved: () => { clearDraft(key); baselineRef.current = ""; setDirty(false); setChecked(false); },
    savedHint: dirty ? "در حال ذخیرهٔ محلی…" : "پیش‌نویس روی همین دستگاه ذخیره می‌شود",
  };
}

/* ── نوار عملیات چسبان ── */
function WriteBar({ icon: Icon, title, busy, saveDisabled, onSave, saveLabel, hist }: {
  icon: React.ComponentType<{ className?: string }>; title: string; busy: boolean; saveDisabled: boolean;
  onSave: () => void; saveLabel: string;
  hist: { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean };
}) {
  const iconBtn = "grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border text-muted-foreground transition-colors hover:border-bronze/60 hover:text-bronze disabled:opacity-30";
  return (
    <div className="sticky top-[74px] z-20 mb-4 flex items-center gap-2 rounded-2xl border border-border bg-card/95 px-3 py-2.5 shadow-card backdrop-blur sm:gap-3 sm:px-4">
      <button onClick={() => navigate({ view: "studio" })} aria-label="بازگشت به اتاق استاد" title="بازگشت به اتاق استاد" className={iconBtn}><ArrowRight className="h-4 w-4" /></button>
      <span className="hidden h-9 w-9 shrink-0 place-items-center rounded-xl bg-bronze/15 text-bronze sm:grid"><Icon className="h-4.5 w-4.5" /></span>
      <h1 className="min-w-0 flex-1 truncate text-[14px] font-extrabold sm:text-[15px]">{title}</h1>
      <button onClick={hist.undo} disabled={!hist.canUndo} aria-label="واگرد" title="واگرد (Ctrl+Z)" className={iconBtn}><Undo2 className="h-4 w-4" /></button>
      <button onClick={hist.redo} disabled={!hist.canRedo} aria-label="ازنو" title="ازنو (Ctrl+Shift+Z)" className={iconBtn}><Redo2 className="h-4 w-4" /></button>
      <button onClick={onSave} disabled={busy || saveDisabled} title="ذخیره (Ctrl+S)"
        className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-[12.5px] font-bold text-primary-foreground shadow-card transition-all hover:brightness-110 disabled:opacity-45 sm:px-4">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        <span className="hidden sm:inline">{busy ? "در حال ذخیره…" : saveLabel}</span>
      </button>
    </div>
  );
}

function Segmented<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { key: T; label: string; Icon?: React.ComponentType<{ className?: string }> }[] }) {
  return (
    <div className="inline-flex rounded-xl bg-muted/60 p-1">
      {items.map((it) => (
        <button key={it.key} type="button" onClick={() => onChange(it.key)} aria-pressed={value === it.key}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold transition-all ${value === it.key ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"}`}>
          {it.Icon && <it.Icon className="h-3.5 w-3.5" />} {it.label}
        </button>
      ))}
    </div>
  );
}

/* ── چک‌لیست انتشار ── */
interface CheckItem { level: "error" | "warn"; text: string; go?: () => void }
function Checklist({ items, okText }: { items: CheckItem[]; okText: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <p className="mb-2 flex items-center gap-2 text-[12px] font-extrabold text-bronze"><ListChecks className="h-4 w-4" /> چک‌لیست انتشار</p>
      {items.length === 0 ? (
        <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-success"><CheckCircle2 className="h-4 w-4" /> {okText}</p>
      ) : (
        <ul className="max-h-60 space-y-1 overflow-y-auto">
          {items.slice(0, 40).map((c, i) => (
            <li key={i}>
              <button type="button" onClick={c.go} disabled={!c.go}
                className={`flex w-full items-start gap-1.5 rounded-lg px-2 py-1.5 text-start text-[11px] font-semibold leading-relaxed transition-colors ${c.level === "error" ? "text-destructive hover:bg-destructive/10" : "text-amber-700 hover:bg-amber-400/10 dark:text-amber-300"}`}>
                <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {c.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* === صفحهٔ نوشتن مطلب === */
type PostTab = "content" | "meta" | "quiz";

function WritePostPage({ id }: { id?: string }) {
  const isNew = !id || id === "new";
  const h = useHistoryState<PostD>();
  const d = h.value;
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [tab, setTab] = React.useState<PostTab>("content");
  const [mobileView, setMobileView] = React.useState<"edit" | "preview">("edit");
  const [showPreview, setShowPreview] = React.useState(true);
  const [focusId, setFocusId] = React.useState<string | null>(null);
  const draft = useDraftGuard(draftKeyOf("post", id), d, !!d);
  const set = (fn: (x: PostD) => PostD, key = "") => h.set(fn, key);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (isNew) { h.reset({ ...EMPTY_POST, orgId: "" }); return; }
      try {
        const res = await fetch(`/api/posts/${id}`);
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? "مطلب پیدا نشد");
        if (!alive) return;
        h.reset({
          id: j.post.id, title: j.post.title, summary: j.post.summary, tags: j.post.tags ?? "",
          category: j.post.category ?? "",
          categories: Array.isArray(j.post.categories) ? j.post.categories : (j.post.category ? [j.post.category] : []),
          thumbnail: j.post.thumbnail ?? "",
          quiz: quizPayloadToDraft(j.post.quiz ?? []),
          blocks: (j.post.blocks as LessonSection[]) ?? [],
          orgId: j.post.orgId ?? "",
        });
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "خطا در بارگذاری مطلب");
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew]);

  const checks: CheckItem[] = React.useMemo(() => {
    if (!d) return [];
    const out: CheckItem[] = [];
    if (!d.title.trim()) out.push({ level: "error", text: "عنوان مطلب خالی است" });
    if (!d.blocks.length) out.push({ level: "error", text: "هنوز بخشی ننوشته‌ای", go: () => setTab("content") });
    d.blocks.forEach((s, i) => sectionIssues(s).forEach((iss) => out.push({
      level: iss.level, text: `بخش ${fa(i + 1)}: ${iss.text}`,
      go: () => { setTab("content"); setMobileView("edit"); setFocusId(s.id); },
    })));
    if (!d.summary.trim()) out.push({ level: "warn", text: "خلاصه برای فید ننوشته‌ای", go: () => setTab("meta") });
    return out;
  }, [d]);

  async function save() {
    if (!d || busy) return;
    if (!d.title.trim()) { setErr("عنوان مطلب لازم است."); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    const { errors } = countIssues(d.blocks);
    const valid = d.blocks.filter((s) => !sectionIssues(s).some((i) => i.level === "error"));
    if (!valid.length) { setErr("دست‌کم یک بخش کامل لازم است — چک‌لیست انتشار را ببین."); setTab("content"); return; }
    if (errors > 0 && !window.confirm(`${fa(errors)} ایراد در بخش‌ها هست؛ بخش‌های ناقص هنگام ذخیره حذف یا ساده می‌شوند. با همین وضع ذخیره شود؟`)) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch(d.id ? `/api/posts/${d.id}` : "/api/posts", {
        method: d.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...d, orgId: d.orgId || null, quiz: draftToQuizPayload(d.quiz) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "ذخیره ناموفق بود.");
      draft.markSaved();
      navigate({ view: "studio" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطایی رخ داد.");
      setBusy(false);
    }
  }

  useEditorShortcuts({ undo: h.undo, redo: h.redo, save: () => void save() });

  if (err && !d) return <p className="mx-auto mt-10 max-w-xl rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{err}</p>;
  if (!d) return <div className="flex justify-center py-24 text-bronze"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const words = wordCountOf(d.blocks);
  const errN = checks.filter((c) => c.level === "error").length;

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-28 pt-4 sm:px-6">
      <WriteBar icon={Newspaper} title={isNew ? "مطلب جدید" : `ویرایش مطلب — ${d.title || "بدون عنوان"}`} busy={busy}
        saveDisabled={!d.title.trim()} onSave={() => void save()} saveLabel={isNew ? "انتشار مطلب" : "ذخیرهٔ تغییرات"} hist={h} />

      {draft.restore && (
        <RestoreBanner savedAt={draft.restore.savedAt} onDiscard={draft.dropRestore}
          onRestore={() => {
            const next = draft.applyRestore() as PostD | undefined;
            if (next && typeof next === "object" && "blocks" in next) h.set({ ...EMPTY_POST, orgId: "", ...next });
          }} />
      )}

      <div className={`grid gap-5 ${showPreview ? "lg:grid-cols-[minmax(0,1fr)_380px]" : ""}`}>
        <div className="min-w-0 space-y-4">
          <input value={d.title} onChange={(e) => set((x) => ({ ...x, title: e.target.value }), "title")} maxLength={140}
            placeholder="عنوان مطلب…" aria-label="عنوان مطلب"
            className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 font-display text-lg font-extrabold shadow-card outline-none placeholder:text-muted-foreground/40 focus:border-bronze" />

          <div className="flex flex-wrap items-center gap-2">
            <Segmented value={tab} onChange={setTab} items={[
              { key: "content", label: `محتوا (${fa(d.blocks.length)})`, Icon: BookOpen },
              { key: "meta", label: "مشخصات و انتشار", Icon: Settings2 },
              { key: "quiz", label: `آزمون (${fa(d.quiz.length)})`, Icon: ListChecks },
            ]} />
            <span className="flex-1" />
            <span className="lg:hidden"><Segmented value={mobileView} onChange={setMobileView} items={[{ key: "edit", label: "ویرایش", Icon: PenSquare }, { key: "preview", label: "پیش‌نمایش", Icon: Eye }]} /></span>
            <button type="button" onClick={() => setShowPreview((v) => !v)} className="hidden items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-[11.5px] font-bold text-muted-foreground hover:text-foreground lg:inline-flex">
              <Eye className="h-3.5 w-3.5" /> {showPreview ? "پنهان کردن پیش‌نمایش" : "نمایش پیش‌نمایش"}
            </button>
          </div>

          {mobileView === "preview" ? (
            <div className="rounded-2xl border border-dashed border-bronze/40 bg-gradient-to-b from-background to-card p-4 lg:hidden">
              <SectionsPreview sections={d.blocks} title={d.title} />
            </div>
          ) : null}

          <div className={mobileView === "preview" ? "hidden lg:block" : ""}>
            {tab === "content" && (
              <section className="rounded-2xl border border-border bg-card p-3 shadow-card sm:p-4">
                <SectionsEditor sections={d.blocks} onChange={(blocks, key) => set((x) => ({ ...x, blocks }), key)}
                  focusId={focusId} onFocusChange={setFocusId} />
              </section>
            )}

            {tab === "meta" && (
              <section className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>خلاصه (برای فید خانه)</label>
                    <textarea value={d.summary} onChange={(e) => set((x) => ({ ...x, summary: e.target.value }), "summary")} maxLength={280} rows={3} className={`${inputCls} resize-y`} />
                    <p className="mt-1 text-[10px] text-muted-foreground">{fa(d.summary.length)} از ۲۸۰</p>
                  </div>
                  <div>
                    <label className={labelCls}>برچسب‌ها (با کاما)</label>
                    <input value={d.tags} onChange={(e) => set((x) => ({ ...x, tags: e.target.value }), "tags")} placeholder="قراردادها، بیع، نکته امتحانی" className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>شاخه‌های کتابخانهٔ عمومی (چند گزینه مجاز است)</label>
                  <CategoryChips value={d.categories} onChange={(cats) => set((x) => ({ ...x, categories: cats, category: cats[0] ?? "" }))} />
                </div>
                <ThumbnailPicker value={d.thumbnail} onChange={(thumbnail) => set((x) => ({ ...x, thumbnail }))} />
                <OrgPublishPicker value={d.orgId ?? ""} onChange={(orgId) => set((x) => ({ ...x, orgId }))} />
              </section>
            )}

            {tab === "quiz" && (
              <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <p className="mb-2 text-[11.5px] leading-relaxed text-muted-foreground">آزمون چهارگزینه‌ای پایان مطلب — دلخواه؛ دانشجو بعد از خواندن خودش را می‌سنجد.</p>
                <QuizEditor label="آزمون پایان این مبحث" questions={d.quiz} onChange={(quiz) => set((x) => ({ ...x, quiz }), "quiz")} />
              </section>
            )}
          </div>

          {err && <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{err}</p>}
          <div className="lg:hidden"><Checklist items={checks} okText="همه‌چیز آمادهٔ انتشار است." /></div>
        </div>

        {showPreview && (
          <aside className="hidden lg:block">
            <div className="sticky top-[140px] space-y-3">
              <div className="flex flex-wrap gap-2 text-[10px] font-bold text-muted-foreground">
                <span className="rounded-full bg-muted px-2.5 py-1">{fa(d.blocks.length)} بخش</span>
                <span className="rounded-full bg-muted px-2.5 py-1">{fa(words)} واژه</span>
                <span className="rounded-full bg-muted px-2.5 py-1">{fa(d.quiz.length)} سؤال</span>
                {errN > 0 && <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-destructive">{fa(errN)} ایراد</span>}
              </div>
              <Checklist items={checks} okText="همه‌چیز آمادهٔ انتشار است." />
              <div className="max-h-[calc(100vh-360px)] overflow-y-auto rounded-2xl border border-dashed border-bronze/40 bg-gradient-to-b from-background to-card p-4">
                <p className="mb-3 flex items-center gap-2 text-[12px] font-extrabold text-bronze"><Eye className="h-4 w-4" /> پیش‌نمایش زنده</p>
                <SectionsPreview sections={d.blocks} />
              </div>
              <p className="text-[10px] leading-relaxed text-muted-foreground/70">{draft.savedHint}</p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

/* === صفحهٔ ساخت دوره === */
const COURSE_STATUS: { key: string; label: string; desc: string }[] = [
  { key: "published", label: "منتشر شده", desc: "همه می‌بینند و قابل افزودن به کتابخانه است" },
  { key: "prep", label: "در حال آماده‌سازی", desc: "قابل دیدن و افزودن؛ با برچسبِ زردِ آماده‌سازی" },
  { key: "draft", label: "پیش‌نویس — فقط من", desc: "فقط خودت در اتاق استاد می‌بینی" },
];

type Sel = { kind: "info" } | { kind: "chapter"; ch: string } | { kind: "lesson"; ch: string; ls: string };

function lessonIssueCount(l: TLesson): number {
  return l.sections.reduce((n, s) => n + sectionIssues(s).filter((i) => i.level === "error").length, 0) + (l.title.trim() ? 0 : 1);
}

function CourseOutline({ d, sel, onSel, mutate }: {
  d: CourseD; sel: Sel; onSel: (s: Sel) => void; mutate: (fn: (x: CourseD) => CourseD) => void;
}) {
  const moveCh = (ci: number, dir: -1 | 1) => mutate((x) => {
    const j = ci + dir;
    if (j < 0 || j >= x.chapters.length) return x;
    const ch = [...x.chapters];
    [ch[ci], ch[j]] = [ch[j], ch[ci]];
    return { ...x, chapters: ch };
  });
  const moveLs = (chKey: string, li: number, dir: -1 | 1) => mutate((x) => ({
    ...x,
    chapters: x.chapters.map((c) => {
      if (c.key !== chKey) return c;
      const j = li + dir;
      if (j < 0 || j >= c.lessons.length) return c;
      const ls = [...c.lessons];
      [ls[li], ls[j]] = [ls[j], ls[li]];
      return { ...c, lessons: ls };
    }),
  }));
  const addLesson = (chKey: string) => {
    const l: TLesson = { key: uid(), title: "", sections: [], quiz: [] };
    mutate((x) => ({ ...x, chapters: x.chapters.map((c) => (c.key === chKey ? { ...c, lessons: [...c.lessons, l] } : c)) }));
    onSel({ kind: "lesson", ch: chKey, ls: l.key });
  };
  const addChapter = () => {
    const ch: TChapter = { key: uid(), title: "", lessons: [], quiz: [] };
    mutate((x) => ({ ...x, chapters: [...x.chapters, ch] }));
    onSel({ kind: "chapter", ch: ch.key });
  };
  const rowCls = (on: boolean) => `flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-start text-[12px] transition-colors ${on ? "bg-bronze/15 font-bold text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`;
  const arrow = "rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-25";
  return (
    <nav aria-label="ساختار دوره" className="space-y-1.5">
      <button type="button" onClick={() => onSel({ kind: "info" })} className={rowCls(sel.kind === "info")}>
        <Settings2 className="h-4 w-4 shrink-0 text-bronze" /> مشخصات دوره
      </button>
      {d.chapters.map((ch, ci) => (
        <div key={ch.key} className="rounded-xl border border-border bg-background/60 p-1.5">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => onSel({ kind: "chapter", ch: ch.key })} className={rowCls(sel.kind === "chapter" && sel.ch === ch.key)}>
              <Layers3 className="h-4 w-4 shrink-0 text-bronze" />
              <span className="min-w-0 flex-1 truncate">فصل {fa(ci + 1)}{ch.title ? ` — ${ch.title}` : ""}</span>
              {ch.quiz.length > 0 && <span className="shrink-0 rounded-full bg-bronze/10 px-1.5 text-[9.5px] font-bold text-bronze">{fa(ch.quiz.length)} تست</span>}
            </button>
            <button type="button" className={arrow} disabled={ci === 0} onClick={() => moveCh(ci, -1)} aria-label="فصل بالا"><ChevronUp className="h-3.5 w-3.5" /></button>
            <button type="button" className={arrow} disabled={ci === d.chapters.length - 1} onClick={() => moveCh(ci, 1)} aria-label="فصل پایین"><ChevronDown className="h-3.5 w-3.5" /></button>
          </div>
          <div className="mt-0.5 space-y-0.5 ps-4">
            {ch.lessons.map((ls, li) => {
              const bad = lessonIssueCount(ls);
              const on = sel.kind === "lesson" && sel.ls === ls.key;
              return (
                <div key={ls.key} className="flex items-center gap-1">
                  <button type="button" onClick={() => onSel({ kind: "lesson", ch: ch.key, ls: ls.key })} className={rowCls(on)}>
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{fa(li + 1)}</span>
                    <span className="min-w-0 flex-1 truncate">{ls.title || "جلسهٔ بی‌عنوان"}</span>
                    {bad > 0 && <CircleAlert className="h-3.5 w-3.5 shrink-0 text-destructive" aria-label="ایراد دارد" />}
                    {ls.quiz.length > 0 && <span className="shrink-0 rounded-full bg-muted px-1.5 text-[9.5px]">{fa(ls.quiz.length)}✓</span>}
                  </button>
                  <button type="button" className={arrow} disabled={li === 0} onClick={() => moveLs(ch.key, li, -1)} aria-label="جلسه بالا"><ChevronUp className="h-3 w-3" /></button>
                  <button type="button" className={arrow} disabled={li === ch.lessons.length - 1} onClick={() => moveLs(ch.key, li, 1)} aria-label="جلسه پایین"><ChevronDown className="h-3 w-3" /></button>
                </div>
              );
            })}
            <button type="button" onClick={() => addLesson(ch.key)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-success hover:bg-success/10"><Plus className="h-3 w-3" /> جلسه</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={addChapter} disabled={d.chapters.length >= 24} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/50 bg-primary/5 px-3 py-2 text-[11.5px] font-bold text-primary hover:bg-primary/10 disabled:opacity-40">
        <Plus className="h-3.5 w-3.5" /> فصل جدید
      </button>
    </nav>
  );
}

function WriteCoursePage({ id }: { id?: string }) {
  const isNew = !id || id === "new";
  const h = useHistoryState<CourseD>();
  const d = h.value;
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [sel, setSel] = React.useState<Sel>({ kind: "info" });
  const [lessonTab, setLessonTab] = React.useState<"content" | "quiz" | "preview">("content");
  const [outlineOpen, setOutlineOpen] = React.useState(false);
  const [focusId, setFocusId] = React.useState<string | null>(null);
  const draft = useDraftGuard(draftKeyOf("course", id), d, !!d);
  const mutate = (fn: (x: CourseD) => CourseD, key = "") => h.set(fn, key);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (isNew) { h.reset({ ...EMPTY_COURSE, chapters: [], orgId: "" }); return; }
      try {
        const res = await fetch(`/api/tcourses/${id}`);
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? "دوره پیدا نشد");
        if (!alive) return;
        const c = j.course as Record<string, unknown> & { chapters?: Chapter[] };
        const chapters: TChapter[] = (c.chapters ?? []).map((chc) => ({
          key: uid(),
          title: chc.title,
          quiz: quizPayloadToDraft(((chc as { quiz?: unknown }).quiz ?? []) as QuizQuestion[]),
          lessons: chc.lessons.map((l) => ({
            key: uid(), title: l.title, minutes: l.minutes,
            sections: (l.sections ?? []) as LessonSection[],
            quiz: quizPayloadToDraft(l.quiz ?? []),
          })),
        }));
        h.reset({
          id: c.id as string, title: c.title as string, tagline: (c.tagline as string) ?? "", description: (c.description as string) ?? "",
          icon: (c.icon as string) ?? "Scale", accent: (c.accent as string) ?? "bronze",
          category: (c._category as string) ?? "other",
          categories: (c._categories as string[]) ?? [(c._category as string) ?? "other"],
          status: (c._status as string) ?? "published",
          thumbnail: (c._thumbnail as string) ?? "",
          chapters,
          orgId: (c._orgId as string) ?? "",
        });
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "خطا در بارگذاری دوره");
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew]);

  // انتخاب نامعتبر (مثلاً پس از واگرد/حذف) → مشخصات دوره
  const curCh = d && sel.kind !== "info" ? d.chapters.find((c) => c.key === sel.ch) : undefined;
  const curLs = curCh && sel.kind === "lesson" ? curCh.lessons.find((l) => l.key === sel.ls) : undefined;
  React.useEffect(() => {
    if (!d) return;
    if ((sel.kind === "chapter" && !curCh) || (sel.kind === "lesson" && !curLs)) setSel({ kind: "info" });
  }, [d, sel, curCh, curLs]);

  const pick = (s: Sel) => { setSel(s); setLessonTab("content"); setFocusId(null); setOutlineOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const checks: CheckItem[] = React.useMemo(() => {
    if (!d) return [];
    const out: CheckItem[] = [];
    if (!d.title.trim()) out.push({ level: "error", text: "عنوان دوره خالی است", go: () => setSel({ kind: "info" }) });
    if (!d.chapters.length) out.push({ level: "error", text: "دست‌کم یک فصل بساز" });
    else if (!d.chapters.some((c) => c.lessons.length)) out.push({ level: "error", text: "هیچ فصلی جلسه ندارد", go: () => setSel({ kind: "chapter", ch: d.chapters[0].key }) });
    d.chapters.forEach((ch, ci) => {
      if (!ch.lessons.length) out.push({ level: "warn", text: `فصل ${fa(ci + 1)} جلسه ندارد`, go: () => setSel({ kind: "chapter", ch: ch.key }) });
      ch.lessons.forEach((ls, li) => {
        const where = `فصل ${fa(ci + 1)}، جلسهٔ ${fa(li + 1)}`;
        const go = (secId?: string) => () => { setSel({ kind: "lesson", ch: ch.key, ls: ls.key }); setLessonTab("content"); setFocusId(secId ?? null); };
        if (!ls.title.trim()) out.push({ level: "error", text: `${where}: عنوان ندارد`, go: go() });
        if (!ls.sections.length) out.push({ level: "warn", text: `${where}: هنوز محتوایی ندارد`, go: go() });
        ls.sections.forEach((s, si) => sectionIssues(s).forEach((iss) => out.push({ level: iss.level, text: `${where}، بخش ${fa(si + 1)}: ${iss.text}`, go: go(s.id) })));
      });
    });
    return out;
  }, [d]);

  async function save() {
    if (!d || busy) return;
    if (!d.title.trim()) { setErr("عنوان دوره لازم است."); setSel({ kind: "info" }); return; }
    if (!d.chapters.length || !d.chapters.some((c) => c.lessons.length)) { setErr("دست‌کم یک فصل با یک جلسه لازم است."); return; }
    const untitled = checks.find((c) => c.level === "error" && c.text.endsWith("عنوان ندارد"));
    if (untitled) { setErr(`${untitled.text} — عنوان جلسه لازم است.`); untitled.go?.(); return; }
    const errs = checks.filter((c) => c.level === "error").length;
    if (errs > 0 && !window.confirm(`${fa(errs)} ایراد در بخش‌های جلسه‌ها هست؛ بخش‌های ناقص هنگام ذخیره حذف یا ساده می‌شوند. ذخیره شود؟`)) return;
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
        body: JSON.stringify({ ...d, orgId: d.orgId || null, chapters }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "ذخیره ناموفق بود.");
      draft.markSaved();
      navigate({ view: "studio" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطایی رخ داد.");
      setBusy(false);
    }
  }

  useEditorShortcuts({ undo: h.undo, redo: h.redo, save: () => void save() });

  if (err && !d) return <p className="mx-auto mt-10 max-w-xl rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{err}</p>;
  if (!d) return <div className="flex justify-center py-24 text-bronze"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const lessonsN = d.chapters.reduce((n, c) => n + c.lessons.length, 0);
  const quizN = d.chapters.reduce((n, c) => n + c.quiz.length + c.lessons.reduce((m, l) => m + l.quiz.length, 0), 0);
  const flat = d.chapters.flatMap((c) => c.lessons.map((l) => ({ ch: c.key, ls: l.key })));
  const pos = curLs ? flat.findIndex((x) => x.ls === curLs.key) : -1;
  const chIndex = curCh ? d.chapters.findIndex((c) => c.key === curCh.key) : -1;

  const patchLesson = (p: Partial<TLesson>, key = "") => {
    if (!curCh || !curLs) return;
    mutate((x) => ({
      ...x,
      chapters: x.chapters.map((c) => (c.key === curCh.key ? { ...c, lessons: c.lessons.map((l) => (l.key === curLs.key ? { ...l, ...p } : l)) } : c)),
    }), key);
  };
  const patchChapter = (p: Partial<TChapter>, key = "") => {
    if (!curCh) return;
    mutate((x) => ({ ...x, chapters: x.chapters.map((c) => (c.key === curCh.key ? { ...c, ...p } : c)) }), key);
  };

  const outline = (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
        <div className="mb-2 flex flex-wrap gap-1.5 text-[10px] font-bold text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-0.5">{fa(d.chapters.length)} فصل</span>
          <span className="rounded-full bg-muted px-2 py-0.5">{fa(lessonsN)} جلسه</span>
          <span className="rounded-full bg-muted px-2 py-0.5">{fa(quizN)} سؤال</span>
        </div>
        <CourseOutline d={d} sel={sel} onSel={pick} mutate={(fn) => mutate(fn)} />
      </div>
      <Checklist items={checks} okText="دوره آمادهٔ انتشار است." />
      <p className="px-1 text-[10px] leading-relaxed text-muted-foreground/70">{draft.savedHint}</p>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-28 pt-4 sm:px-6">
      <WriteBar icon={GraduationCap} title={isNew ? "دورهٔ جدید" : `ویرایش دوره — ${d.title || "بدون عنوان"}`} busy={busy}
        saveDisabled={!d.title.trim()} onSave={() => void save()} saveLabel={isNew ? "انتشار دوره" : "ذخیرهٔ دوره"} hist={h} />

      {draft.restore && (
        <RestoreBanner savedAt={draft.restore.savedAt} onDiscard={draft.dropRestore}
          onRestore={() => {
            const next = draft.applyRestore() as CourseD | undefined;
            if (next && typeof next === "object" && "chapters" in next) { h.set({ ...EMPTY_COURSE, orgId: "", ...next }); setSel({ kind: "info" }); }
          }} />
      )}

      <input value={d.title} onChange={(e) => mutate((x) => ({ ...x, title: e.target.value }), "title")} maxLength={140}
        placeholder="عنوان دوره…" aria-label="عنوان دوره"
        className="mb-4 w-full rounded-2xl border border-border bg-card px-4 py-3.5 font-display text-lg font-extrabold shadow-card outline-none placeholder:text-muted-foreground/40 focus:border-bronze" />

      {/* موبایل: فهرست دوره جمع‌شونده */}
      <div className="mb-4 lg:hidden">
        <button type="button" onClick={() => setOutlineOpen((v) => !v)} aria-expanded={outlineOpen}
          className="flex w-full items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-[13px] font-bold shadow-card">
          <ListTree className="h-4 w-4 text-bronze" />
          <span className="min-w-0 flex-1 truncate text-start">
            {sel.kind === "info" ? "مشخصات دوره" : curLs ? `فصل ${fa(chIndex + 1)} · ${curLs.title || "جلسهٔ بی‌عنوان"}` : `فصل ${fa(chIndex + 1)}`}
          </span>
          {checks.some((c) => c.level === "error") && <CircleAlert className="h-4 w-4 text-destructive" />}
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${outlineOpen ? "rotate-180" : ""}`} />
        </button>
        {outlineOpen && <div className="mt-2">{outline}</div>}
      </div>

      <div className="grid gap-5 lg:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="hidden lg:block"><div className="sticky top-[140px] max-h-[calc(100vh-160px)] overflow-y-auto pb-4">{outline}</div></aside>

        <div className="min-w-0 space-y-4">
          {/* ── مشخصات دوره ── */}
          {sel.kind === "info" && (
            <section className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-card">
              <h2 className="flex items-center gap-2 text-[13px] font-extrabold text-bronze"><Settings2 className="h-4 w-4" /> مشخصات دوره</h2>
              <div className="grid gap-3 sm:grid-cols-[1fr_170px]">
                <div>
                  <label className={labelCls}>شعار کوتاه</label>
                  <input value={d.tagline} onChange={(e) => mutate((x) => ({ ...x, tagline: e.target.value }), "tagline")} maxLength={160} className={inputCls} />
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
                <textarea value={d.description} onChange={(e) => mutate((x) => ({ ...x, description: e.target.value }), "desc")} rows={3} maxLength={2000} className={`${inputCls} resize-y`} />
              </div>
              <ThumbnailPicker value={d.thumbnail} onChange={(thumbnail) => mutate((x) => ({ ...x, thumbnail }))} />
              <div>
                <label className={labelCls}>شاخه‌های کتابخانهٔ عمومی (چند گزینه مجاز است)</label>
                <CategoryChips value={d.categories} onChange={(cats) => mutate((x) => ({ ...x, categories: cats, category: cats[0] ?? "other" }))} />
              </div>
              <div>
                <label className={labelCls}>وضعیت انتشار</label>
                <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-muted/60 p-1.5">
                  {COURSE_STATUS.map((s) => (
                    <button key={s.key} type="button" onClick={() => mutate((x) => ({ ...x, status: s.key }))} aria-pressed={d.status === s.key} title={s.desc}
                      className={`rounded-lg px-2 py-2 text-[11px] font-bold leading-tight transition-all ${
                        d.status === s.key
                          ? s.key === "prep" ? "bg-amber-400 text-amber-950 shadow-card" : s.key === "draft" ? "bg-muted-foreground/80 text-background shadow-card" : "bg-success text-success-foreground shadow-card"
                          : "text-muted-foreground hover:text-foreground"}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <OrgPublishPicker value={d.orgId ?? ""} onChange={(orgId) => mutate((x) => ({ ...x, orgId }))} />
              <div className="rounded-xl border border-dashed border-bronze/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
                <p className="mb-1 flex items-center gap-1.5 font-extrabold text-bronze"><Sparkles className="h-3.5 w-3.5" /> نقشهٔ ساخت</p>
                از فهرست کنار صفحه فصل بساز، داخل هر فصل جلسه اضافه کن و روی هر جلسه بزن تا فقط همان باز شود. الگوی پیشنهادی هر جلسه: درآمد ← مفهوم ← مستند قانونی ← نکات ← مثال یا جدول ← سؤال ← جمع‌بندی + آزمون.
              </div>
              {d.chapters.length === 0 && (
                <button type="button" onClick={() => {
                  const ch: TChapter = { key: uid(), title: "", lessons: [{ key: uid(), title: "", sections: [], quiz: [] }], quiz: [] };
                  mutate((x) => ({ ...x, chapters: [ch] }));
                  pick({ kind: "lesson", ch: ch.key, ls: ch.lessons[0].key });
                }} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[12.5px] font-bold text-primary-foreground shadow-card">
                  <Plus className="h-4 w-4" /> ساخت فصل و جلسهٔ اول
                </button>
              )}
            </section>
          )}

          {/* ── فصل ── */}
          {sel.kind === "chapter" && curCh && (
            <section className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center gap-2">
                <h2 className="flex items-center gap-2 text-[13px] font-extrabold text-bronze"><Layers3 className="h-4 w-4" /> فصل {fa(chIndex + 1)}</h2>
                <span className="flex-1" />
                <button type="button" onClick={() => {
                  if (curCh.lessons.length && !window.confirm(`فصل و ${fa(curCh.lessons.length)} جلسه‌اش حذف شود؟ (با واگرد برمی‌گردد)`)) return;
                  mutate((x) => ({ ...x, chapters: x.chapters.filter((c) => c.key !== curCh.key) }));
                  setSel({ kind: "info" });
                }} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /> حذف فصل</button>
              </div>
              <div>
                <label className={labelCls}>عنوان فصل</label>
                <input value={curCh.title} onChange={(e) => patchChapter({ title: e.target.value }, `ch:${curCh.key}`)} placeholder="مثلاً: ارکان مسئولیت مدنی" className={inputCls} />
              </div>
              <div>
                <p className={labelCls}>جلسه‌های این فصل</p>
                <div className="space-y-1.5">
                  {curCh.lessons.map((l, li) => (
                    <button key={l.key} type="button" onClick={() => pick({ kind: "lesson", ch: curCh.key, ls: l.key })} className="flex w-full items-center gap-2 rounded-xl border border-border px-3 py-2 text-start text-[12.5px] hover:border-bronze/50">
                      <span className="text-[10.5px] font-bold text-muted-foreground">جلسهٔ {fa(li + 1)}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold">{l.title || "بی‌عنوان"}</span>
                      <span className="text-[10.5px] text-muted-foreground">{fa(l.sections.length)} بخش</span>
                      <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                  <button type="button" onClick={() => {
                    const l: TLesson = { key: uid(), title: "", sections: [], quiz: [] };
                    mutate((x) => ({ ...x, chapters: x.chapters.map((c) => (c.key === curCh.key ? { ...c, lessons: [...c.lessons, l] } : c)) }));
                    pick({ kind: "lesson", ch: curCh.key, ls: l.key });
                  }} disabled={curCh.lessons.length >= 40} className="inline-flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-1.5 text-[11.5px] font-bold text-success disabled:opacity-40"><Plus className="h-3.5 w-3.5" /> جلسهٔ جدید در این فصل</button>
                </div>
              </div>
              <QuizEditor label="آزمون پایان این فصل" questions={curCh.quiz} onChange={(quiz: QuizDraft[]) => patchChapter({ quiz }, `chq:${curCh.key}`)} />
            </section>
          )}

          {/* ── جلسه ── */}
          {sel.kind === "lesson" && curCh && curLs && (
            <section className="space-y-3">
              <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-bronze">فصل {fa(chIndex + 1)}{curCh.title ? ` — ${curCh.title}` : ""}</span>
                  <span className="flex-1" />
                  <button type="button" disabled={pos <= 0} onClick={() => pos > 0 && pick({ kind: "lesson", ch: flat[pos - 1].ch, ls: flat[pos - 1].ls })} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-muted-foreground hover:bg-muted disabled:opacity-30"><ChevronRight className="h-3.5 w-3.5" /> جلسهٔ قبل</button>
                  <button type="button" disabled={pos < 0 || pos >= flat.length - 1} onClick={() => pos < flat.length - 1 && pick({ kind: "lesson", ch: flat[pos + 1].ch, ls: flat[pos + 1].ls })} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-muted-foreground hover:bg-muted disabled:opacity-30">جلسهٔ بعد <ChevronLeft className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => {
                    if (curLs.sections.length && !window.confirm("این جلسه حذف شود؟ (با واگرد برمی‌گردد)")) return;
                    mutate((x) => ({ ...x, chapters: x.chapters.map((c) => (c.key === curCh.key ? { ...c, lessons: c.lessons.filter((l) => l.key !== curLs.key) } : c)) }));
                    setSel({ kind: "chapter", ch: curCh.key });
                  }} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10" aria-label="حذف جلسه" title="حذف جلسه"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
                  <input value={curLs.title} onChange={(e) => patchLesson({ title: e.target.value }, `ls:${curLs.key}`)} placeholder="عنوان جلسه *" aria-label="عنوان جلسه"
                    className={`${inputCls} text-[15px] font-bold ${!curLs.title.trim() ? "border-destructive/60" : ""}`} />
                  <label className="flex items-center gap-1.5 rounded-xl border border-input bg-background px-3" title="زمان مطالعهٔ این جلسه (دقیقه)">
                    <Clock3 className="h-4 w-4 shrink-0 text-bronze" />
                    <input type="number" min={1} max={600} value={curLs.minutes ?? ""} dir="ltr" placeholder="۱۵" aria-label="زمان مطالعه به دقیقه"
                      onChange={(e) => patchLesson({ minutes: e.target.value ? Number(e.target.value) : undefined }, `min:${curLs.key}`)}
                      className="w-full min-w-0 bg-transparent py-2.5 text-sm tabular-nums outline-none" />
                    <span className="text-[10.5px] text-muted-foreground">دقیقه</span>
                  </label>
                </div>
                <Segmented value={lessonTab} onChange={setLessonTab} items={[
                  { key: "content", label: `محتوا (${fa(curLs.sections.length)})`, Icon: BookOpen },
                  { key: "quiz", label: `آزمون جلسه (${fa(curLs.quiz.length)})`, Icon: ListChecks },
                  { key: "preview", label: "پیش‌نمایش", Icon: Eye },
                ]} />
              </div>

              {lessonTab === "content" && (
                <div className="rounded-2xl border border-border bg-card p-3 shadow-card sm:p-4">
                  <SectionsEditor key={curLs.key} sections={curLs.sections} focusId={focusId} onFocusChange={setFocusId}
                    onChange={(sections, key) => patchLesson({ sections }, key ? `sec:${curLs.key}:${key}` : "")}
                    emptyHint="این جلسه هنوز محتوایی ندارد؛ با «قالب آمادهٔ درس» ساختار کامل یک جلسه را بساز و فقط متن‌ها را پر کن." />
                </div>
              )}
              {lessonTab === "quiz" && (
                <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
                  <QuizEditor label="آزمون این جلسه" questions={curLs.quiz} onChange={(quiz: QuizDraft[]) => patchLesson({ quiz }, `lq:${curLs.key}`)} />
                </div>
              )}
              {lessonTab === "preview" && (
                <div className="rounded-2xl border border-dashed border-bronze/40 bg-gradient-to-b from-background to-card p-4">
                  <SectionsPreview sections={curLs.sections} title={curLs.title} />
                </div>
              )}
            </section>
          )}

          {err && <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{err}</p>}
        </div>
      </div>
    </div>
  );
}

/* === ورودی اصلی — بر اساس مسیر === */
export function StudioWriteView({ kind, id }: { kind: "post" | "course"; id?: string }) {
  return (
    <TeacherOnly>
      {kind === "post" ? <WritePostPage key={id ?? "new"} id={id} /> : <WriteCoursePage key={id ?? "new"} id={id} />}
    </TeacherOnly>
  );
}
