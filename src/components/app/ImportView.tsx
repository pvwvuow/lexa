"use client";

import * as React from "react";
import { Upload, FileText, Sparkles, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import type { Course } from "@/lib/law/types";
import { useApp } from "@/lib/store";
import { navigate } from "@/lib/router";
import { askAi } from "@/lib/aiClient";
import { useAuth } from "@/lib/auth-client";
import { Lock } from "lucide-react";

interface SliceRes { titleGuess: string; length: number; slices: string[]; preview: string }
interface Outline { courseTitle: string; chapters: { title: string; sessions: { title: string; keywords: string[] }[] }[] }

export function ImportView() {
  const auth = useAuth();
  const addCourse = useApp((s) => s.addCourse);
  const [mode, setMode] = React.useState<"url" | "text">("url");
  const [url, setUrl] = React.useState("");
  const [rawText, setRawText] = React.useState("");
  const [busyStep, setBusyStep] = React.useState<"extract" | "outline" | null>(null);
  const [err, setErr] = React.useState("");
  const [slices, setSlices] = React.useState<SliceRes | null>(null);
  const [outline, setOutline] = React.useState<Outline | null>(null);
  const [savedId, setSavedId] = React.useState("");

  // افزودن کتاب صرفاً ابزار مدیر است — تضمین سمت کلاینت (بعد از همهٔ هوک‌ها)
  if (auth.user?.role !== "admin") {
    return (
      <div className="mx-auto max-w-md pt-20">
        <div className="rounded-2xl border border-dashed border-destructive/50 bg-card p-8 text-center shadow-card">
          <Lock className="mx-auto mb-4 h-10 w-10 text-destructive/70" />
          <h2 className="font-display text-lg font-bold">افزودن کتاب فقط برای مدیر است</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            تنها حساب مدیریت می‌تواند کتاب جدید وارد کند. اگر استاد هستید، از «اتاق استاد» برای ساخت دورهٔ آنلاین خود استفاده کنید.
          </p>
        </div>
      </div>
    );
  }

  async function extract() {
    setErr(""); setBusyStep("extract");
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "url" ? { url } : { rawText }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "استخراج ناموفق بود.");
      setSlices(json as SliceRes);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyStep(null);
    }
  }

  async function outlineIt() {
    if (!slices) return;
    setErr(""); setBusyStep("outline");
    try {
      // نقشه از روی آغاز متن؛ اگر AI در دسترس نبود، نقشه ساده خودکار میسازیم
      let o: Outline | null = null;
      try {
        const r = await askAi<Outline>({ task: "outline_import", content: slices.preview + "\n" + slices.slices.slice(0, 3).join("\n") });
        o = r.chapters?.length ? r : null;
      } catch { o = null; }
      if (!o) {
        // fallback هوشمند محلی
        const per = Math.min(4, Math.max(2, Math.ceil(slices.slices.length / 6)));
        const chapters = Array.from({ length: per }, (_, ci) => ({
          title: `فصل ${ci + 1}`,
          sessions: slices.slices.filter((_, si) => si % per === ci).slice(0, 3).map((_, j) => ({
            title: `جلسهٔ ${ci * 3 + j + 1} — مبحث در جریان کتاب`,
            keywords: [],
          })),
        }));
        o = { courseTitle: slices.titleGuess || "دورهٔ وارداتی", chapters };
      }
      setOutline(o);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyStep(null);
    }
  }

  function saveCourse() {
    if (!outline || !slices) return;
    const chapters = outline.chapters.map((ch, ci) => ({
      id: `ic-${Date.now()}-${ci}`,
      order: ci + 1,
      title: ch.title,
      subtitle: "",
      lessons: ch.sessions.map((se, si) => ({
        id: `il-${Date.now()}-${ci}-${si}`,
        title: se.title,
        status: "ai-pending" as const,
        sourceSlice: bestSlice(slices, ci),
        sections: [],
        quiz: [],
        minutes: 15,
      })),
    }));
    const course: Course = {
      id: `import-${Date.now()}`,
      title: outline.courseTitle.slice(0, 40) || "دورهٔ وارداتی",
      tagline: "وارداتی از کتاب شخصی",
      description: "این دوره از متن کتاب/جزوهٔ شما ساخته شده است؛ هر جلسه با یک کلیک توسط استاد هوشمند تدریس کامل میشود.",
      icon: "FileText",
      accent: "green",
      origin: "imported",
      sourceLabel: "کتاب واردشده توسط کاربر",
      chapters,
    };
    addCourse(course);
    setSavedId(course.id);
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-7 px-4 pb-24 pt-6 sm:px-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Upload className="h-6 w-6 text-bronze" /> افزودن کتاب جدید</h1>
        <p className="mt-1 text-sm text-muted-foreground">جزوه یا کتاب حقوقی را به سه گام وارد کن؛ استاد آن را فصل‌بندی و جلسه‌به‌جلسه تدریس خواهد کرد — دقیقاً مثل تجارت ۳.</p>
      </header>

      {/* گام ۱: ورودی */}
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-card">
        <p className="flex items-center gap-2 text-sm font-bold"><span className="grid h-6 w-6 place-items-center rounded-md bg-primary/10 font-display text-xs font-bold text-primary">۱</span> منبع کتاب را بده</p>
        <div className="flex gap-2">
          <TabBtn active={mode === "url"} onClick={() => setMode("url")}>لینک PDF</TabBtn>
          <TabBtn active={mode === "text"} onClick={() => setMode("text")}>چسباندن متن</TabBtn>
        </div>
        {mode === "url" ? (
          <input dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/book.pdf"
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-left text-sm outline-none focus:border-bronze" />
        ) : (
          <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} rows={6} placeholder="متن کتاب را اینجا بچسبان (حداقل چند پاراگراف)…"
            className="w-full resize-y rounded-xl border border-input bg-background p-3 text-sm leading-loose outline-none focus:border-bronze" />
        )}
        <div className="flex items-center justify-between">
          <button onClick={extract} disabled={busyStep !== null || (mode === "url" ? !url.trim() : rawText.trim().length < 200)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40 active:scale-[.98]">
            {busyStep === "extract" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            استخراج متن فصل‌ها
          </button>
          {slices && <span className="text-xs text-success">✓ {slices.slices.length} قطعه آماده شد</span>}
        </div>
      </section>

      {/* گام ۲: نقشه دوره */}
      {slices && !outline && (
        <section className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-bold"><Sparkles className="me-1 inline h-4 w-4 text-bronze" /> گام ۲: ساخت نقشهٔ فصل‌ها با استاد</h2>
          <button onClick={outlineIt} disabled={busyStep !== null} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busyStep === "outline" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} تحلیل و بندی فصل‌ها
          </button>
        </section>
      )}

      {/* پیش‌نمایش نقشه */}
      {outline && (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="flex items-center justify-between font-bold">
            گام ۳: مرور و ذخیره
            <CheckCircle2 className="h-5 w-5 text-success" />
          </h2>
          <input defaultValue={outline.courseTitle}
            onChange={(e) => (outline.courseTitle = e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-semibold outline-none focus:border-bronze"
            aria-label="عنوان دوره" />
          <div className="max-h-72 space-y-3 overflow-y-auto pe-1">
            {outline.chapters.map((c, i) => (
              <div key={i} className="rounded-xl border border-border p-3">
                <p className="text-sm font-bold">فصل {i + 1}: {c.title}</p>
                <ul className="mt-1.5 list-inside list-disc space-y-1 text-xs text-muted-foreground">
                  {c.sessions.map((s, j) => <li key={j}>{s.title}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <button onClick={saveCourse} className="w-full rounded-xl bg-success px-5 py-3 text-sm font-bold text-white active:scale-[.99]">ذخیرهٔ دوره و رفتن به صفحهٔ درس</button>
          {savedId && (
            <p className="rounded-xl bg-success/10 p-3 text-center text-sm text-success">
              ذخیره شد! <button onClick={() => navigate({ view: "course", id: savedId })} className="inline-flex items-center gap-1 font-bold underline underline-offset-4">رفتن به دوره <ArrowLeft className="h-3.5 w-3.5" /></button>
            </p>
          )}
        </section>
      )}

      {err && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{err}</p>}
    </div>
  );
}

function bestSlice(slices: SliceRes, chapterIdx: number): string {
  const n = slices.slices.length;
  const start = Math.floor((chapterIdx % Math.max(1, n)) / Math.max(1, n) * n);
  return slices.slices[start] ?? "";
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{children}</button>
  );
}
