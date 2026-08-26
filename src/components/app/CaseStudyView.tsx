"use client";

import * as React from "react";
import { FolderOpen, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { builtinCourses } from "@/lib/law/courses";
import { useApp } from "@/lib/store";
import { navigate } from "@/lib/router";
import { askAi } from "@/lib/aiClient";
import { lessonToContextText } from "@/lib/law/lessonText";
import { AIThinking, EmptyState } from "./common";

interface Feedback { strengths: string[]; gaps: string[]; verdict: string; suggestedOutline: string[] }

export function CaseStudyView({ id }: { id?: string }) {
  const custom = useApp((s) => s.customCourses);
  const all = [...builtinCourses, ...custom];
  const ctx = React.useMemo(() => {
    if (id) {
      for (const c of all) for (const ch of c.chapters) {
        const l = ch.lessons.find((x) => x.id === id);
        if (l) return { course: c, lesson: l };
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, custom]);

  const exampleSection = ctx?.lesson.sections.find((s) => s.type === "example");
  const caseText =
    exampleSection?.body ?? "پروندهٔ فرضی پیشفرض: خانمی چکی به مبلغ دویست میلیون تومان دریافت کرده که در صیاد ثبت نشده و برگشت خورده است؛ صادرکننده مدعی است چک بابت وام ضمانت بوده است. تحلیل کنید.";

  const [answer, setAnswer] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [fb, setFb] = React.useState<Feedback | null>(null);
  const [err, setErr] = React.useState("");

  async function submit() {
    if (!answer.trim()) return;
    setBusy(true); setErr(""); setFb(null);
    try {
      const res = await askAi<Feedback>({
        task: "case_feedback",
        question: `پرونده:\n${caseText.slice(0, 900)}\n\nپاسخ دانشجو:\n${answer}`,
        context: {
          courseTitle: ctx?.course.title,
          chapterTitle: undefined,
          lessonTitle: ctx?.lesson.title,
          extra: ctx ? lessonToContextText(ctx.lesson.sections).text : undefined,
          lawRegistry: ctx ? lessonToContextText(ctx.lesson.sections).lawRegistry : undefined,
        },
      });
      setFb(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "نقد استاد ارسال نشد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-24 pt-6 sm:px-6">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-bold"><FolderOpen className="h-6 w-6 text-bronze" /> کیس‌استادی — تحلیل پرونده فرضی</h1>
        <p className="mt-1 text-xs text-muted-foreground">{ctx ? `${ctx.course.title} — ${ctx.lesson.title}` : "تمرین تحلیلی آزاد"} — یادآوری: این ابزار آموزشی است، جایگزین مشاوره حقوقی نیست.</p>
      </header>

      {/* متن پرونده با ظاهر «پروندهٔ رسمی» */}
      <section className="law-box rounded-2xl p-6">
        <div className="relative z-10 mb-2 flex items-center justify-between">
          <p className="flex items-center gap-2 font-display text-sm font-bold text-bronze"><FolderOpen className="h-4 w-4" /> متن پروندهٔ فرضی</p>
          <span className="rotate-[-4deg] rounded-md border-2 border-bronze/50 px-2.5 py-0.5 font-display text-[10px] font-bold tracking-wide text-bronze/80">پروندهٔ فرضی</span>
        </div>
        <p className="font-body relative z-10 whitespace-pre-line text-[15.5px] leading-loose">{caseText}</p>
      </section>

      {/* ناحیه پاسخ */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <label htmlFor="cs-answer" className="mb-2 block text-sm font-semibold">تحلیل حقوقی خودت را بنویس…</label>
        <textarea
          id="cs-answer"
          rows={7}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="مثلاً: موضوع اسناد تجاری است؛ به طرفیت براتگیر/صادرکننده…"
          className="w-full resize-y rounded-xl border border-input bg-background p-4 text-[15px] leading-loose outline-none transition-colors focus:border-bronze"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{answer.trim().split(/\s+/).filter(Boolean).length} واژه</span>
          <button onClick={submit} disabled={busy || !answer.trim()} className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-95 disabled:opacity-40 active:scale-[.98]">
            <Send className="h-4 w-4 -scale-x-100" /> ارسال برای نقد استاد
          </button>
        </div>
      </section>

      {busy && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><AIThinking label="استاد مشغول نقد پاسخ شما" /></section>
      )}
      {err && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{err}</p>}

      {/* نقد ساختاریافته */}
      {fb && (
        <section className="space-y-4">
          {fb.verdict && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <p className="mb-1 flex items-center gap-2 font-display font-bold"><AlertCircle className="h-4 w-4 text-primary" /> جمع‌بندی استاد</p>
              <p className="font-body whitespace-pre-line text-[15px] leading-loose text-foreground/90">{fb.verdict}</p>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <FeedbackCard title="نقاط قوت پاسخ شما" items={fb.strengths ?? []} tone="success" icon={<CheckCircle2 className="h-4 w-4 text-success" />} />
            <FeedbackCard title="نکات جامانده" items={fb.gaps ?? []} tone="warn" icon={<AlertCircle className="h-4 w-4 text-warn" />} />
          </div>
          {!!fb.suggestedOutline?.length && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <p className="mb-2 font-display font-bold">نقشهٔ پاسخ استاندارد</p>
              <ol className="list-inside list-decimal space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                {fb.suggestedOutline.map((o, i) => <li key={i}>{o}</li>)}
              </ol>
            </div>
          )}
        </section>
      )}

      {!id && !fb && (
        <EmptyState title="از چه مبحثی شروع کنیم؟" desc="از جلسات هر درس میتوانی وارد شو یا همین پرونده نمونه را تمرین کن." action={<button onClick={() => navigate({ view: "home" })} className="rounded-xl border border-border px-4 py-2 text-sm">انتخاب جلسه</button>} />
      )}
    </div>
  );
}

function FeedbackCard({ title, items, tone, icon }: { title: string; items: string[]; tone: "success" | "warn"; icon: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${tone === "success" ? "border-success/30 bg-success/5" : "border-warn/30 bg-warn/5"}`}>
      <p className="mb-3 flex items-center gap-2 font-bold">{icon}{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">موردی ثبت نشد.</p>
      ) : (
        <ul className="space-y-2 text-[14.5px] leading-relaxed">
          {items.map((it, i) => <li key={i} className="flex gap-2"><span className={`mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full ${tone === "success" ? "bg-success" : "bg-warn"}`} />{it}</li>)}
        </ul>
      )}
    </div>
  );
}
