"use client";

import * as React from "react";
import { Flame, TrendingUp, BookOpenCheck, ArrowLeft, Activity, Target } from "lucide-react";
import { builtinCourses } from "@/lib/law/courses";
import { useApp, weakTopics, clearWeakTopic } from "@/lib/store";
import { mergeAll } from "@/lib/books";
import { fa } from "@/lib/fa";
import { navigate } from "@/lib/router";
import { Donut, EmptyState } from "./common";

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

/* ─── هیتمپ فعالیت ۴ هفته ─────────────────────────────────────────────────── */
function Heatmap({ activeDays }: { activeDays: string[] }) {
  const cells = React.useMemo(() => {
    const out: { iso: string; on: boolean }[] = [];
    for (let d = 27; d >= 0; d--) {
      const dt = new Date(Date.now() - d * 86_400_000);
      dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
      const iso = dt.toISOString().slice(0, 10);
      out.push({ iso, on: activeDays.includes(iso) });
    }
    return out;
  }, [activeDays]);

  const onCount = cells.filter((c) => c.on).length;

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((c, i) => (
          <span
            key={c.iso}
            title={c.iso}
            aria-label={c.on ? "روز فعال" : "بدون مطالعه"}
            className={`heat-cell h-6 ${c.on ? (i === cells.length - 1 ? "heat-4" : "heat-3") : "heat-0"} ring-1 ring-inset ring-black/[0.04]`}
          />
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

export function ProgressView() {
  const progress = useApp((s) => s.progress);
  const streak = useApp((s) => s.streak);
  const activity = useApp((s) => s.activity);
  const custom = useApp((s) => s.customCourses);
  const tBooks = useApp((s) => s.tBooks);
  const courses = mergeAll({ customCourses: custom, tBooks });
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

  // بهترین نمرات
  const bestScores = Object.entries(progress)
    .filter(([, p]) => p.quizBest != null && p.quizBest > 0)
    .slice(-6).reverse()
    .map(([lid, p]) => {
      let label = lid;
      outer: for (const c of courses) for (const ch of c.chapters) for (const l of ch.lessons)
        if (l.id === lid) { label = `${c.title} — ${l.title}`; break outer; }
      return { lid, label, score: p.quizBest ?? 0 };
    });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 pb-28 pt-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">پیشرفت من</h1>
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm shadow-card outline-none focus:border-bronze"
          aria-label="انتخاب درس"
        >
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </header>

      {/* استریک + گیج کلی */}
      <section className="grid gap-4 sm:grid-cols-[auto_1fr]">
        <div className="relative overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground shadow-card">
          <div aria-hidden className="pattern-quilt absolute inset-0 opacity-50" />
          <div className="relative">
            <p className="flex items-center gap-2 font-bold"><Flame className="h-5 w-5 text-bronze" /> استریک روزانه</p>
            <p className="mt-2 font-display text-4xl font-bold">{fa(streak.count)}</p>
            <p className="text-xs text-primary-foreground/70">روز مطالعهٔ پیوسته</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="flex items-center gap-2 font-bold"><Activity className="h-4 w-4 text-bronze" /> فعالیت چهار هفتهٔ اخیر</p>
          <div className="mt-4">
            <Heatmap activeDays={activity} />
          </div>
        </div>
      </section>

      {/* رادار + گیج */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <p className="mb-1 flex items-center gap-2 font-bold"><Target className="h-4 w-4 text-bronze" /> نقشهٔ تسلط — {course.title}</p>
        <p className="mb-2 text-xs text-muted-foreground">هر ضلع نشان می‌دهد بر آن فصل چقدر مسلط شده‌ای.</p>
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

      {/* مباحث ضعیف */}
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

      {/* بهترین نمره جلسات اخیر */}
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
