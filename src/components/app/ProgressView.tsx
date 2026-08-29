"use client";

/* ─── پیشرفت من — داشبورد حرفه‌ای و کارآمد ─────────────────────────────────
   ساختار: نوار KPI → هیتمپ هفته‌ای → ردیف پیشرفت هر کتاب با دکمهٔ «ادامه»
   → نقشهٔ تسلط درس انتخابی (رادار + فصل‌ها) → روند دفترچه‌های آزمون
   → مباحث ضعیف → بهترین نمرات جلسات. همه از دادهٔ واقعی کاربر. */

import * as React from "react";
import {
  Flame, TrendingUp, BookOpenCheck, ArrowLeft, Activity, Target,
  GraduationCap, PlayCircle, ClipboardList, Layers, Percent, Library,
} from "lucide-react";
import { useApp, weakTopics, clearWeakTopic } from "@/lib/store";
import { mergeVisible } from "@/lib/books";
import { getExamPack } from "@/lib/law/examPacks";
import { fa } from "@/lib/fa";
import { navigate } from "@/lib/router";
import type { Course } from "@/lib/law/types";
import { Donut, EmptyState, CourseIcon } from "./common";

/* ─── نمودار رادار تسلط بر فصل‌ها ─────────────────────────────────────────── */
function MasteryRadar({ data }: { data: { label: string; v: number }[] }) {
  const S = 260, cx = S / 2, cy = S / 2, R = 86;
  const n = Math.max(3, data.length);
  const pt = (i: number, frac: number) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + R * frac * Math.cos(ang), cy + R * frac * Math.sin(ang)] as const;
  };
  const poly = data.map((d, i) => pt(i, d.v / 100).join(",")).join(" ");

  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto w-full max-w-[280px]" role="img" aria-label="نمودار راداری تسلط بر فصل‌ها">
      <defs>
        <linearGradient id="radar-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--bronze)" stopOpacity="0.22" />
        </linearGradient>
      </defs>

      {/* شبکه‌های هم‌مرکز */}
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon
          key={f}
          points={Array.from({ length: n }, (_, i) => pt(i, f).join(",")).join(" ")}
          fill="none"
          stroke="currentColor"
          className="text-border"
          strokeWidth={f === 1 ? 1 : 0.6}
        />
      ))}

      {/* پره‌ها */}
      {data.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="currentColor" className="text-border" strokeWidth="0.6" />;
      })}

      {/* وجه داده */}
      <polygon points={poly} fill="url(#radar-fill)" stroke="var(--bronze)" strokeWidth="2" strokeLinejoin="round" />
      {data.map((d, i) => {
        const [x, y] = pt(i, d.v / 100);
        return <circle key={i} cx={x} cy={y} r="3.2" fill="var(--bronze)" />;
      })}

      {/* برچسب فصل‌ها */}
      {data.map((d, i) => {
        const [x, y] = pt(i, 1.22);
        return (
          <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground" fontSize="9.5">
            {d.label.length > 14 ? d.label.slice(0, 13) + "…" : d.label}
          </text>
        );
      })}
    </svg>
  );
}

/* ─── هیتمپ فعالیت ۴ هفته — هم‌تراز با روزهای هفته (ش ی د س چ پ ج) ────────── */
const WEEK_DAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

function Heatmap({ activeDays }: { activeDays: string[] }) {
  const { weeks, onCount } = React.useMemo(() => {
    const today = new Date();
    const active = new Set(activeDays);
    // ۲۸ روز اخیر، هم‌تراز ستون‌های هفتهٔ فارسی (شنبه اول هفته)
    const cells: { iso: string; on: boolean; col: number; isToday: boolean }[] = [];
    for (let d = 27; d >= 0; d--) {
      const dt = new Date(today.getTime() - d * 86_400_000);
      dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
      const iso = dt.toISOString().slice(0, 10);
      cells.push({ iso, on: active.has(iso), col: (dt.getDay() + 1) % 7, isToday: d === 0 });
    }
    const weeks: (typeof cells)[] = Array.from({ length: 4 }, () => []);
    cells.forEach((c, i) => weeks[Math.min(3, Math.floor(i / 7))].push(c));
    // سلول‌های خالی ابتدای هفتهٔ اول را پیش از اولین روز می‌گذاریم
    const first = weeks[0][0]?.col ?? 0;
    for (let i = 0; i < first; i++) weeks[0].unshift({ iso: "", on: false, col: i, isToday: false });
    return { weeks, onCount: cells.filter((c) => c.on).length };
  }, [activeDays]);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5">
        {WEEK_DAYS.map((d) => (
          <span key={d} className="text-center text-[9.5px] font-bold text-muted-foreground/70">{d}</span>
        ))}
      </div>
      <div className="mt-1 space-y-1.5">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1.5">
            {week.map((c, ci) =>
              c.iso ? (
                <span
                  key={`${wi}-${ci}`}
                  title={c.iso}
                  aria-label={c.on ? "روز فعال" : "بدون مطالعه"}
                  className={`heat-cell h-6 ${c.on ? (c.isToday ? "heat-4" : "heat-3") : "heat-0"} ring-1 ring-inset ring-black/[0.04] ${c.isToday ? "outline outline-1 outline-offset-1 outline-bronze/60" : ""}`}
                />
              ) : (
                <span key={`${wi}-${ci}`} className="h-6 rounded-[6px] bg-transparent" />
              ),
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{fa(onCount)} روز فعال از ۲۸ روز اخیر</span>
        <span className="flex items-center gap-1">کم<span aria-hidden className="mx-1 inline-flex gap-0.5">
          <i className="heat-0 h-2.5 w-2.5 rounded-[3px] ring-1 ring-border/60" />
          <i className="heat-2 h-2.5 w-2.5 rounded-[3px]" />
          <i className="heat-4 h-2.5 w-2.5 rounded-[3px]" />
        </span>زیاد</span>
      </p>
    </div>
  );
}

/* ─── کاشی KPI ─────────────────────────────────────────────────────────────── */
function Kpi({ icon: Icon, label, value, sub, tone = "default" }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; sub?: string; tone?: "default" | "gold" | "green";
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 shadow-card ${
      tone === "gold" ? "border-bronze/30 bg-gradient-to-bl from-bronze/[0.1] to-transparent" :
      tone === "green" ? "border-primary/20 bg-primary text-primary-foreground" :
      "border-border bg-card"
    }`}>
      {tone === "green" && <div aria-hidden className="pattern-quilt absolute inset-0 opacity-40" />}
      <div className="relative">
        <p className={`flex items-center gap-1.5 text-[11px] font-bold ${tone === "green" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
          <Icon className="h-3.5 w-3.5 text-bronze" /> {label}
        </p>
        <p className="mt-1.5 font-display text-2xl font-extrabold leading-none">{value}</p>
        {sub && <p className={`mt-1 text-[10.5px] ${tone === "green" ? "text-primary-foreground/65" : "text-muted-foreground"}`}>{sub}</p>}
      </div>
    </div>
  );
}

/* ─── صفحهٔ اصلی ───────────────────────────────────────────────────────────── */
export function ProgressView() {
  const progress = useApp((s) => s.progress);
  const streak = useApp((s) => s.streak);
  const activity = useApp((s) => s.activity);
  const examAttempts = useApp((s) => s.examAttempts);
  const custom = useApp((s) => s.customCourses);
  const tBooks = useApp((s) => s.tBooks);
  const hiddenBuiltins = useApp((s) => s.hiddenBuiltins);
  const courses = mergeVisible({ customCourses: custom, tBooks, hiddenBuiltins });

  const [courseId, setCourseId] = React.useState<string | null>(null);
  const course = courses.find((c) => c.id === courseId) ?? courses[0];

  const weak = weakTopics();

  /* آمار کل کتابخانه */
  const lib = React.useMemo(() => {
    let total = 0, done = 0, half = 0;
    let quizSum = 0, quizN = 0;
    for (const c of courses) for (const ch of c.chapters) for (const l of ch.lessons) {
      total += 1;
      const p = progress[l.id];
      if (p?.status === "completed") done += 1;
      else if (p) half += 1;
      if (p?.quizBest != null && p.quizBest > 0) { quizSum += p.quizBest; quizN += 1; }
    }
    const pctAll = total ? Math.round(((done + half * 0.5) / total) * 100) : 0;
    const avgQuiz = quizN ? Math.round(quizSum / quizN) : 0;
    return { total, done, half, pctAll, avgQuiz, quizN };
  }, [courses, progress]);

  /* آمار فصل‌های درس انتخابی */
  const chapters = React.useMemo(() => {
    if (!course) return [];
    return course.chapters.map((ch) => {
      const n = ch.lessons.length;
      let done = 0;
      ch.lessons.forEach((l) => {
        const p = progress[l.id];
        if (p?.status === "completed") done += 1;
        else if (p) done += 0.5;
      });
      return { title: ch.title, pctv: Math.round((done / Math.max(1, n)) * 100) };
    });
  }, [course, progress]);
  const overall = Math.round(chapters.reduce((a, c) => a + c.pctv, 0) / Math.max(1, chapters.length));

  /* ردیف هر کتاب: درصد، جلسات، میانگین تست، مقصد «ادامه» */
  const rows = React.useMemo(() => {
    return courses.map((c) => {
      const flat = c.chapters.flatMap((ch) => ch.lessons);
      let done = 0;
      let quizSum = 0, quizN = 0;
      for (const l of flat) {
        const p = progress[l.id];
        if (p?.status === "completed") done += 1;
        if (p?.quizBest != null && p.quizBest > 0) { quizSum += p.quizBest; quizN += 1; }
      }
      const next = flat.find((l) => progress[l.id]?.status !== "completed") ?? flat[0];
      return {
        course: c, done, total: flat.length,
        pctv: Math.round((done / Math.max(1, flat.length)) * 100),
        avgQuiz: quizN ? Math.round(quizSum / quizN) : 0,
        nextId: next?.id, nextTitle: next?.title,
      };
    }).sort((a, b) => b.pctv - a.pctv);
  }, [courses, progress]);

  /* روند دفترچه‌های آزمون — بهترین نمره و ۸ اجرای اخیر هر بسته */
  const packRows = React.useMemo(() => {
    return Object.entries(examAttempts)
      .filter(([, atts]) => atts.length > 0)
      .map(([pid, atts]) => ({
        id: pid,
        title: getExamPack(pid)?.title ?? pid,
        best: Math.max(...atts.map((a) => a.score)),
        last: atts[atts.length - 1],
        count: atts.length,
        recent: atts.slice(-8),
        lastAt: atts[atts.length - 1]?.date ?? "",
      }))
      .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1))
      .slice(0, 6);
  }, [examAttempts]);

  /* بهترین نمره جلسات اخیر */
  const bestScores = React.useMemo(() => Object.entries(progress)
    .filter(([, p]) => p.quizBest != null && p.quizBest > 0)
    .slice(-6).reverse()
    .map(([lid, p]) => {
      let label = lid;
      outer: for (const c of courses) for (const ch of c.chapters) for (const l of ch.lessons)
        if (l.id === lid) { label = `${c.title} — ${l.title}`; break outer; }
      return { lid, label, score: p.quizBest ?? 0 };
    }), [progress, courses]);

  if (courses.length === 0) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 pb-28 pt-6 sm:px-6">
        <h1 className="mb-6 text-2xl font-bold">پیشرفت من</h1>
        <EmptyState title="هنوز کتابی در کتابخانه‌ات نیست" desc="از «کتابخانهٔ عمومی» یک درس اضافه کن تا نقشهٔ پیشرفتت اینجا ساخته شود." />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 pb-28 pt-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-bold">پیشرفت من</h1>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">تصویر واقعی مسیر مطالعه‌ات — از جلسه‌های خوانده‌شده تا نمرهٔ تست‌ها و نقاط ضعف.</p>
      </header>

      {/* ── نوار KPI ── */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi tone="green" icon={Layers} label="پیشرفت کل کتابخانه" value={`${fa(lib.pctAll)}٪`} sub={`${fa(lib.done)} از ${fa(lib.total)} جلسه`} />
        <Kpi icon={Percent} label="میانگین تست‌ها" value={lib.quizN ? `${fa(lib.avgQuiz)}٪` : "—"} sub={lib.quizN ? `${fa(lib.quizN)} جلسه تست‌داده‌شده` : "هنوز تستی نزدی"} />
        <Kpi tone="gold" icon={Flame} label="استریک روزانه" value={fa(streak.count)} sub="روز مطالعهٔ پیوسته" />
        <Kpi icon={GraduationCap} label="دفترچه‌های آزمون" value={fa(Object.values(examAttempts).filter((a) => a.length).length)} sub="بستهٔ اجراشده" />
      </section>

      {/* ── فعالیت ۴ هفته ── */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <p className="flex items-center gap-2 font-bold"><Activity className="h-4 w-4 text-bronze" /> فعالیت چهار هفتهٔ اخیر</p>
        <div className="mt-4">
          <Heatmap activeDays={activity} />
        </div>
      </section>

      {/* ── کتابخانهٔ من — پیشرفت هر کتاب + دکمهٔ ادامه ── */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Library className="h-5 w-5 text-bronze" /> پیشرفت کتاب‌ها</h2>
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          {rows.map(({ course: c, done, total, pctv, avgQuiz, nextId, nextTitle }) => (
            <li key={c.id} className="p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/5 shadow-card">
                  <CourseIcon icon={c.icon} className="h-5 w-5 text-bronze" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[13.5px] font-bold">{c.title}</p>
                    <p className="shrink-0 font-display text-xs font-bold text-muted-foreground">{fa(done)}/{fa(total)} جلسه · {fa(pctv)}٪</p>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-border/70">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pctv}%`, background: pctv === 100 ? "var(--success)" : "linear-gradient(to left, var(--bronze), color-mix(in srgb, var(--primary) 85%, var(--bronze)))" }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    {avgQuiz > 0 ? (
                      <span className="text-[10.5px] font-bold text-muted-foreground">میانگین تست: <span className={avgQuiz >= 80 ? "text-success" : avgQuiz >= 50 ? "text-warn" : "text-danger"}>{fa(avgQuiz)}٪</span></span>
                    ) : <span />}
                    <span className="flex items-center gap-2">
                      <button onClick={() => navigate({ view: "course", id: c.id })} className="rounded-lg px-2 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:text-bronze">
                        فهرست درس
                      </button>
                      {nextId && (
                        <button onClick={() => navigate({ view: "learn", id: nextId })} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground transition-transform active:scale-95">
                          <PlayCircle className="h-3.5 w-3.5" /> ادامه: {nextTitle?.slice(0, 22)}{nextTitle && nextTitle.length > 22 ? "…" : ""}
                        </button>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ── نقشهٔ تسلط درس انتخابی ── */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 font-bold"><Target className="h-4 w-4 text-bronze" /> نقشهٔ تسلط</p>
          <div className="-mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
            {courses.map((c) => (
              <button
                key={c.id}
                onClick={() => setCourseId(c.id)}
                aria-pressed={course?.id === c.id}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors ${
                  course?.id === c.id ? "border-bronze bg-bronze/15 text-bronze" : "border-border bg-background text-muted-foreground hover:border-bronze/40"
                }`}
              >
                {c.title.length > 24 ? c.title.slice(0, 23) + "…" : c.title}
              </button>
            ))}
          </div>
        </div>
        <p className="mb-2 text-xs text-muted-foreground">هر ضلع نشان می‌دهد از فصل‌های «{course?.title}» چقدر مسلط شده‌ای.</p>
        <div className="grid items-center gap-2 sm:grid-cols-[auto_1fr]">
          <MasteryRadar data={chapters.map((c) => ({ label: c.title, v: c.pctv }))} />
          <div className="space-y-4 px-2">
            <div className="mx-auto w-fit rounded-xl bg-accent px-3 py-2 text-center"><Donut value={overall} size={96} stroke={9} label="تکمیل درس" /></div>
            {chapters.map((c, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm"><span className="font-medium">{c.title}</span><span className="font-display text-xs font-bold text-muted-foreground">{fa(c.pctv)}٪</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-border/80">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${c.pctv}%`,
                      background: c.pctv === 100 ? "var(--success)" : `linear-gradient(to left, var(--bronze), color-mix(in srgb, var(--primary) 85%, var(--bronze)))`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── روند دفترچه‌های آزمون ── */}
      {packRows.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold"><ClipboardList className="h-5 w-5 text-bronze" /> کارنامهٔ دفترچه‌های آزمون</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {packRows.map((p) => (
              <li key={p.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-1 text-[13px] font-bold">{p.title}</p>
                  <span className={`shrink-0 rounded-md px-2 py-0.5 font-display text-xs font-bold ${p.best >= 80 ? "bg-success/15 text-success" : p.best >= 50 ? "bg-warn/15 text-warn" : "bg-danger/15 text-danger"}`}>
                    بهترین {fa(p.best)}٪
                  </span>
                </div>
                <div className="mt-3 flex items-end gap-1" aria-hidden>
                  {p.recent.map((a, i) => (
                    <span
                      key={i}
                      title={`${fa(a.score)}٪`}
                      className={`w-full rounded-t-sm ${a.score >= 80 ? "bg-success/70" : a.score >= 50 ? "bg-warn/70" : "bg-danger/60"}`}
                      style={{ height: `${Math.max(8, Math.round(a.score * 0.42))}px` }}
                    />
                  ))}
                </div>
                <p className="mt-2 text-[10.5px] text-muted-foreground">{fa(p.count)} بار اجرا · آخرین: {fa(p.last?.score ?? 0)}٪ با {fa(p.last?.correct ?? 0)} پاسخ درست از {fa(p.last?.total ?? 0)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── مباحث ضعیف ── */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">مباحثی که به مرور نیاز دارند</h2>
        {weak.length === 0 ? (
          <EmptyState title="عالیه! هنوز نقطه ضعفی پیدا نکردیم" desc="با برگشت هوشمند، مبحث‌هایی که اشتباه میزنی خودکار اینجا میآیند تا همه با هم برطرف شوند." />
        ) : (
          <ul className="space-y-2">
            {weak.map((t) => (
              <li key={t} className="flex items-center justify-between rounded-xl border border-warn/40 bg-warn/[0.07] px-4 py-3 shadow-card">
                <span className="font-body text-sm">{t}</span>
                <span className="flex items-center gap-2">
                  <button onClick={() => navigate({ view: "cards" })} className="inline-flex items-center gap-1 rounded-lg bg-warn px-3 py-1.5 font-display text-xs font-bold text-white transition-transform active:scale-95">مرور کن<ArrowLeft className="h-3 w-3" /></button>
                  <button onClick={() => clearWeakTopic(t)} aria-label="حذف از لیست" className="grid h-8 w-8 place-items-center rounded-lg transition-colors hover:bg-muted"><BookOpenCheck className="h-4 w-4 text-muted-foreground" /></button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── بهترین نمره جلسات اخیر ── */}
      {bestScores.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold"><TrendingUp className="h-5 w-5 text-bronze" /> بهترین تستهای تو</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            {bestScores.map(({ lid, label, score }) => (
              <li key={lid} className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-muted/40">
                <span className="truncate font-body">{label}</span>
                <span className={`shrink-0 rounded-md px-2.5 py-0.5 font-display text-xs font-bold ${score >= 80 ? "bg-success/15 text-success" : score >= 50 ? "bg-warn/15 text-warn" : "bg-danger/15 text-danger"}`}>
                  {fa(score)}٪
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
