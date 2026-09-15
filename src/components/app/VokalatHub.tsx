"use client";

// ─── هاب اختصاصی «آزمون وکالت» — دفترچه‌های واقعی اسکودا با کلید رسمی ─────────
// مسیر: #/quiz/vokalat — از QuizView با id === "vokalat" رندر می‌شود.
import * as React from "react";
import { motion } from "framer-motion";
import {
  Scale, ArrowRight, Landmark, FileQuestion, Timer, MinusCircle,
  GraduationCap, ScrollText, BadgeCheck, BookOpenCheck, Sparkles,
} from "lucide-react";
import { examPacks, VOKALAT_SLUG, type ExamPack } from "@/lib/law/examPacks";
import { fa } from "@/lib/fa";
import { navigate } from "@/lib/router";
import { ExamPackCard } from "./ExamPacksView";
import { useApp } from "@/lib/store";

/** سال دفترچه از عنوان — برای گروه‌بندی */
function yearLabelOf(pack: ExamPack): string {
  if (pack.title.includes("۱۳۸۸")) return "دفترچهٔ آزمون ۱۳۸۸";
  if (pack.title.includes("۱۳۹۹")) return "دفترچهٔ آزمون ۱۳۹۹";
  if (pack.title.includes("۱۳۹۸")) return "دفترچهٔ آزمون ۱۳۹۸";
  return "دفترچه‌های نمونهٔ تمرینی";
}
const YEAR_ORDER = ["دفترچهٔ آزمون ۱۳۸۸", "دفترچهٔ آزمون ۱۳۹۹", "دفترچهٔ آزمون ۱۳۹۸", "دفترچه‌های نمونهٔ تمرینی"];

const EXAM_STRUCTURE = [
  { icon: BookOpenCheck, title: "۸ درس تخصصی", desc: "مدنی، تجارت، دادرسی مدنی و کیفری، جزا، اصول، حقوق اساسی و بین‌الملل خصوصی" },
  { icon: FileQuestion, title: "۳۲۰ سؤال چهارگزینه‌ای", desc: "هر درس ۴۰ سؤال؛ آزمون پایهٔ یک در دو نیمه‌روز برگزار می‌شود" },
  { icon: MinusCircle, title: "نمرهٔ منفی", desc: "هر ۳ پاسخ نادرست، یک پاسخ صحیح را از بین می‌برد — نزد وکالت آزمون ما چنین است" },
  { icon: Timer, title: "زمان‌سنج واقعی", desc: "همان حال‌وهوای جلسهٔ آزمون: یکجا، زمان‌دار و با گزارش عملکرد" },
];

export function VokalatHub() {
  const vokalat = React.useMemo(() => examPacks.filter((p) => p.examSlug === VOKALAT_SLUG), []);
  const groups = React.useMemo(() => {
    const map = new Map<string, ExamPack[]>();
    for (const p of vokalat) {
      const y = yearLabelOf(p);
      if (!map.has(y)) map.set(y, []);
      map.get(y)!.push(p);
    }
    return YEAR_ORDER.filter((y) => map.has(y)).map((y) => ({ year: y, packs: map.get(y)! }));
  }, [vokalat]);

  const totalQ = vokalat.reduce((s, p) => s + p.questions.length, 0);
  const attempts = useApp((s) => s.examAttempts);
  const doneIds = new Set(Object.keys(attempts).filter((id) => (attempts[id]?.length ?? 0) > 0));
  const solvedPacks = vokalat.filter((p) => doneIds.has(p.id)).length;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-24 pt-6 lg:px-8">
      {/* ═══ هیرو ═══ */}
      <motion.section
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl border border-bronze/30 bg-gradient-to-bl from-bronze/[0.13] via-card to-card p-6 shadow-card sm:p-8"
      >
        <span aria-hidden className="absolute -end-14 -top-14 h-44 w-44 rounded-full bg-bronze/10 blur-2xl" />
        <span aria-hidden className="absolute -bottom-16 -start-10 h-40 w-40 rounded-full bg-primary/5 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#d9b877] via-bronze to-[#8a6a30] text-[#132018] shadow-card">
              <Scale className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[11px] font-bold text-bronze">بخش اختصاصی · کانون وکلای دادگستری (اسکودا)</p>
              <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">آزمون وکالت</h1>
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
            دفترچه‌های <b className="text-foreground">واقعی</b> آزمون وکالت — سؤال‌به‌سؤال با کلید رسمی و پاسخ تشریحی ماده‌به‌ماده.
            مثل جلسهٔ واقعی یکجا و زمان‌دار امتحان بده، بعد تشریح هر سؤال را ببین و نقطه‌ضعفت را بساز.
          </p>

          {/* آمار */}
          <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-bold">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-primary"><ScrollText className="h-3.5 w-3.5" /> {fa(vokalat.length)} دفترچه</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-primary"><FileQuestion className="h-3.5 w-3.5" /> {fa(totalQ)} سؤال واقعی</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-bronze/10 px-3 py-1.5 text-bronze"><BadgeCheck className="h-3.5 w-3.5" /> کلید رسمی + تشریح</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-muted-foreground"><GraduationCap className="h-3.5 w-3.5" /> {fa(solvedPacks)} دفترچه از خودت</span>
          </div>

          <button
            onClick={() => navigate({ view: "quiz" })}
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-muted-foreground transition-colors hover:border-bronze/40 hover:text-foreground"
          >
            <ArrowRight className="h-3.5 w-3.5" /> بازگشت به مرکز آزمون
          </button>
        </div>
      </motion.section>

      {/* ═══ ساختار آزمون وکالت ═══ */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-bronze/10 text-bronze"><Landmark className="h-4 w-4" /></span>
          ساختار آزمون وکالت پایهٔ یک
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {EXAM_STRUCTURE.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 * i, duration: 0.35 }}
              className="rounded-2xl border border-border bg-card p-4 shadow-card"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><s.icon className="h-4.5 w-4.5" /></span>
              <h3 className="mt-2.5 text-[13px] font-bold">{s.title}</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ دفترچه‌ها به تفکیک سال ═══ */}
      {groups.map((g) => (
        <section key={g.year} className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-bronze/10 text-bronze"><ScrollText className="h-4 w-4" /></span>
            {g.year}
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{fa(g.packs.length)} دفترچه</span>
            {g.year !== "دفترچه‌های نمونهٔ تمرینی" && (
              <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">سؤال‌های اصیل</span>
            )}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {g.packs.map((p) => <ExamPackCard key={p.id} pack={p} showExam={false} />)}
          </div>
        </section>
      ))}

      {vokalat.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground shadow-card">
          فعلاً دفترچه‌ای در این بخش نیست.
        </p>
      )}

      <p className="flex items-start gap-2 rounded-2xl border border-dashed border-bronze/30 bg-bronze/[0.05] p-4 text-[11px] leading-relaxed text-muted-foreground">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-bronze" />
        <span>
          سؤال‌های سال‌های ۱۳۸۸ و ۱۳۹۸ و ۱۳۹۹ از دفترچه‌های واقعی برگرفته شده‌اند؛ کلید ۱۳۸۸ رسمی (اسکودا) و کلید ۱۳۹۹ تحلیلی و بر پایهٔ متن مواد قانونی است.
          دفترچه‌های نمونهٔ تمرینی هم به سبک همین آزمون تألیف شده‌اند.
        </span>
      </p>
    </div>
  );
}
