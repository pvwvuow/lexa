"use client";

import * as React from "react";
import { Flame, TrendingUp, BookOpenCheck, ArrowLeft } from "lucide-react";
import { builtinCourses } from "@/lib/law/courses";
import { useApp, weakTopics, clearWeakTopic } from "@/lib/store";
import { fa } from "@/lib/fa";
import { navigate } from "@/lib/router";
import { Donut, EmptyState } from "./common";

export function ProgressView() {
  const progress = useApp((s) => s.progress);
  const streak = useApp((s) => s.streak);
  const custom = useApp((s) => s.customCourses);
  const courses = [...builtinCourses, ...custom];
  const [courseId, setCourseId] = React.useState(courses[0].id);
  const course = courses.find((c) => c.id === courseId) ?? courses[0];

  const weak = weakTopics();

  // آمار فصل‌ها
  const chapters = course.chapters.map((ch) => {
    const n = ch.lessons.length;
    let done = 0;
    ch.lessons.forEach((l) => {
      const p = progress[l.id];
      if (p?.status === "completed") done += 1;
      else if (p) done += 0.5;
    });
    return { title: ch.title, pctv: Math.round((done / Math.max(1, n)) * 100) };
  });
  const overall = Math.round(chapters.reduce((a, c) => a + c.pctv, 0) / Math.max(1, chapters.length));

  // هفت روز اخیر برای دات‌های استریک
  const days = React.useMemo(() => {
    const out: { label: string; active: boolean }[] = [];
    for (let d = 6; d >= 0; d--) {
      const dt = new Date(Date.now() - d * 86_400_000);
      dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
      out.push({ label: ["ی", "د", "س", "چ", "پ", "ج", "ش"][dt.getDay()], active: false });
    }
    return out;
  }, []);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 pb-24 pt-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">پیشرفت من</h1>
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-bronze"
          aria-label="انتخاب درس"
        >
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </header>

      {/* کارت استریک */}
      <section className="flex items-center justify-between rounded-2xl border border-bronze/40 bg-gradient-to-l from-bronze/10 to-transparent p-5">
        <div className="space-y-1">
          <p className="flex items-center gap-2 font-bold"><Flame className="h-5 w-5 text-bronze" /> استریک روزانه</p>
          <p className="text-sm text-muted-foreground">{fa(streak.count)} روز مطالعه پیوسته — سر بلند شد!</p>
        </div>
        <div className="flex gap-1.5">
          {days.map((d, i) => (
            <span key={i} className={`grid h-7 w-7 place-items-center rounded-lg text-xs ${i === days.length - 1 ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`} title={d.label}>
              {d.label}
            </span>
          ))}
        </div>
      </section>

      {/* نمودار کلی و فصل‌ها */}
      <section className="grid items-start gap-6 rounded-2xl border border-border bg-card p-6 shadow-sm sm:grid-cols-[auto_1fr]">
        <div className="mx-auto"><Donut value={overall} size={130} stroke={11} label="تکمیل درس" /></div>
        <div className="space-y-4">
          <p className="flex items-center gap-2 font-bold"><TrendingUp className="h-4 w-4 text-bronze" /> تسلط بر هر فصل</p>
          {chapters.map((c, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm"><span>{c.title}</span><span className="font-semibold text-muted-foreground">{fa(c.pctv)}٪</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-border">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${c.pctv === 100 ? "bg-success" : c.pctv >= 50 ? "bg-primary" : "bg-warn"}`}
                  style={{ width: `${c.pctv}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* مباحث ضعیف */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">مباحثی که به مرور نیاز دارند</h2>
        {weak.length === 0 ? (
          <EmptyState title="عالیه! هنوز نقطه ضعفی پیدا نکردیم" desc="با برگشت هوشمند، مبحث‌هایی که اشتباه میزنی خودکار اینجا میآیند تا همه با هم برطرف شوند." />
        ) : (
          <ul className="space-y-2">
            {weak.map((t) => (
              <li key={t} className="flex items-center justify-between rounded-xl border border-warn/40 bg-warn/10 px-4 py-3">
                <span className="text-sm font-medium">{t}</span>
                <span className="flex items-center gap-2">
                  <button onClick={() => navigate({ view: "cards" })} className="rounded-lg bg-warn px-3 py-1.5 text-xs font-bold text-white inline-flex items-center gap-1">مرور کن<ArrowLeft className="h-3 w-3" /></button>
                  <button onClick={() => clearWeakTopic(t)} aria-label="حذف از لیست" className="grid h-7 w-7 place-items-center rounded-lg hover:bg-white/40"><BookOpenCheck className="h-3.5 w-3.5 text-muted-foreground" /></button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* بهترین نمره جلسات اخیر */}
      {Object.keys(progress).length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">بهترین تستهای تو</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {Object.entries(progress)
              .filter(([, p]) => p.quizBest != null && p.quizBest > 0)
              .slice(-6).reverse()
              .map(([lid, p]) => {
                let label = lid;
                outer: for (const c of courses) for (const ch of c.chapters) for (const l of ch.lessons)
                  if (l.id === lid) { label = `${c.title} — ${l.title}`; break outer; }
                return (
                  <li key={lid} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="truncate">{label}</span>
                    <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${p.quizBest! >= 80 ? "bg-success/15 text-success" : p.quizBest! >= 50 ? "bg-warn/15 text-warn" : "bg-danger/15 text-danger"}`}>
                      {fa(p.quizBest ?? 0)}٪
                    </span>
                  </li>
                );
              })}
          </ul>
        </section>
      )}
    </div>
  );
}
