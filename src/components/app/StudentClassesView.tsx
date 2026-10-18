"use client";
/* "My classes" for an official student (phase 3): classes, official exams (take / see results)
 * and grades. Grades stay visible after graduating; classes follow the access rules of 006/008. */
import * as React from "react";
import { BookOpen, ClipboardCheck, GraduationCap, RefreshCw } from "lucide-react";
import {
  ATTEMPT_STATES, componentLabel, examResult, faDateTime, faNum, myClasses, myExams, myGrades, orgClassError,
  type ExamResult, type MyClass, type MyExam, type MyGrade,
} from "@/lib/cloud-api/org-classes";
import { ExamRunner } from "./ExamRunner";

const btn = "inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted disabled:opacity-50";
const btnMain = "inline-flex items-center gap-1 rounded-xl bg-bronze px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50";

export function StudentClassesView() {
  const [classes, setClasses] = React.useState<MyClass[]>([]);
  const [exams, setExams] = React.useState<MyExam[]>([]);
  const [grades, setGrades] = React.useState<MyGrade[]>([]);
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [running, setRunning] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{ exam: MyExam; data: ExamResult } | null>(null);
  const [now, setNow] = React.useState(Date.now());

  const load = React.useCallback(async () => {
    setBusy(true);
    setErr("");
    try {
      const [c, x, g] = await Promise.all([myClasses(), myExams(), myGrades()]);
      setClasses(c);
      setExams(x);
      setGrades(g);
    } catch (e) {
      setErr(orgClassError(e));
    } finally {
      setBusy(false);
    }
  }, []);
  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(t);
  }, []);

  if (running) return <ExamRunner examId={running} onDone={() => { setRunning(null); void load(); }} />;
  if (result) return <ResultView exam={result.exam} data={result.data} onClose={() => setResult(null)} />;

  const openResult = async (x: MyExam) => {
    try {
      setResult({ exam: x, data: await examResult(x.examId) });
    } catch (e) {
      setErr(orgClassError(e));
    }
  };

  const stateOf = (x: MyExam): MyExam["state"] => {
    if (x.state === "in_progress" || x.state === "submitted") return x.state;
    const server = now + x.clockSkew;
    if (server < Date.parse(x.startsAt)) return "upcoming";
    if (server > Date.parse(x.endsAt)) return "missed";
    return "open";
  };

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center gap-2">
        <h2 className="flex flex-1 items-center gap-1 text-base font-bold"><GraduationCap className="h-5 w-5" /> کلاس‌های من</h2>
        <button className={btn} onClick={() => void load()} disabled={busy}><RefreshCw className="h-3.5 w-3.5" /> تازه‌سازی</button>
      </div>
      {err && <p className="rounded-xl border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/30">{err}</p>}

      <section className="space-y-2">
        <h3 className="flex items-center gap-1 text-sm font-bold"><ClipboardCheck className="h-4 w-4" /> آزمون‌های رسمی</h3>
        {!exams.length && <p className="text-xs text-muted-foreground">آزمون رسمی‌ای برای شما ثبت نشده است.</p>}
        <ul className="space-y-2">
          {exams.map((x) => {
            const st = stateOf(x);
            return (
              <li key={x.examId} className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-3 text-xs">
                <span className="flex-1">
                  <span className="block text-sm font-bold">{x.title}</span>
                  <span className="block text-muted-foreground">
                    {x.courseTitle}{x.classTitle ? ` (${x.classTitle})` : ""} · {x.orgName}
                  </span>
                  <span className="block text-muted-foreground">
                    {faDateTime(x.startsAt)} تا {faDateTime(x.endsAt)} · {faNum(x.durationMin, 0)} دقیقه · {faNum(x.questions, 0)} سؤال
                  </span>
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">{ATTEMPT_STATES[st] ?? st}</span>
                {x.score !== null && <span className="font-bold">{faNum(x.score)} از {faNum(x.maxScore)}</span>}
                {(st === "open" || st === "in_progress") && (
                  <button className={btnMain} onClick={() => {
                    if (st === "in_progress" || window.confirm(`با شروع، زمان ${faNum(x.durationMin, 0)} دقیقه‌ای آزمون شروع می‌شود و فقط یک بار می‌توانید شرکت کنید. شروع می‌کنید؟`)) setRunning(x.examId);
                  }}>
                    {st === "in_progress" ? "ادامهٔ آزمون" : "شروع آزمون"}
                  </button>
                )}
                {st === "submitted" && x.resultsOpen && <button className={btn} onClick={() => void openResult(x)}>پاسخ‌نامه</button>}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="flex items-center gap-1 text-sm font-bold"><BookOpen className="h-4 w-4" /> کلاس‌ها</h3>
        {!classes.length && <p className="text-xs text-muted-foreground">در حال حاضر در کلاسی ثبت‌نام نیستید.</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          {classes.map((c) => (
            <div key={c.classId} className="rounded-xl border border-border p-3 text-xs">
              <span className="block text-sm font-bold">{c.courseTitle}{c.title ? ` (${c.title})` : ""}</span>
              <span className="block text-muted-foreground">{c.termTitle} · {c.teacherName || "بدون مدرس"} · {c.orgName}</span>
              {c.enrollment === "completed" && <span className="block text-[10px] text-muted-foreground">گذرانده</span>}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-bold">نمره‌ها</h3>
        {!grades.length && <p className="text-xs text-muted-foreground">هنوز نمره‌ای ثبت نشده است.</p>}
        {grades.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="p-2 text-start">درس</th><th className="p-2 text-start">ترم</th>
                  <th className="p-2 text-start">نوع</th><th className="p-2 text-start">نمره</th>
                </tr>
              </thead>
              <tbody>
                {grades.map((g, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="p-2">{g.courseTitle}{g.classTitle ? ` (${g.classTitle})` : ""}<span className="block text-[10px] text-muted-foreground">{g.orgName}</span></td>
                    <td className="p-2">{g.termTitle}</td>
                    <td className="p-2">{componentLabel(g.component)}</td>
                    <td className="p-2 font-bold">{faNum(g.score)}{g.maxScore !== 20 ? ` از ${faNum(g.maxScore)}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function ResultView({ exam, data, onClose }: { exam: MyExam; data: ExamResult; onClose: () => void }) {
  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex items-center gap-2">
        <button className={btn} onClick={onClose}>بازگشت</button>
        <span className="flex-1 text-sm font-bold">{exam.title}</span>
        {data.open && <span className="text-sm font-bold">{faNum(data.score ?? null)} از {faNum(data.maxScore ?? exam.maxScore)}</span>}
      </div>
      {!data.open && <p className="text-xs text-muted-foreground">پاسخ‌نامه هنوز منتشر نشده است.</p>}
      <ol className="space-y-3">
        {(data.questions ?? []).map((q, i) => (
          <li key={q.id} className="space-y-2 rounded-xl border border-border p-3 text-sm">
            <p className="whitespace-pre-wrap"><span className="font-bold">{faNum(i + 1, 0)}. </span>{q.text}</p>
            <ul className="space-y-1">
              {q.options.map((o, j) => (
                <li key={j} className={`rounded-lg border p-2 text-xs ${j === q.correct ? "border-green-500 bg-green-50 dark:bg-green-950/30" : j === q.choice ? "border-red-400 bg-red-50 dark:bg-red-950/30" : "border-border"}`}>
                  {faNum(j + 1, 0)}) {o}
                  {j === q.correct && " ✓"}
                  {j === q.choice && j !== q.correct && " (پاسخ شما)"}
                </li>
              ))}
            </ul>
            {q.choice === null && <p className="text-[11px] text-muted-foreground">بی‌پاسخ</p>}
            {q.explanation && <p className="whitespace-pre-wrap rounded-lg bg-muted p-2 text-xs">{q.explanation}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
