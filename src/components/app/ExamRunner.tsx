"use client";
/* A student taking an official exam (phase 3). The server keeps the clock: the countdown uses
 * the server time, every answer is saved at once, and the attempt is handed in automatically
 * when the time is up. Questions arrive without the answer key. */
import * as React from "react";
import { AlertTriangle, CheckCircle2, Clock, Send } from "lucide-react";
import { answerExam, faNum, orgClassError, startExam, submitExam, type RunningExam } from "@/lib/cloud-api/org-classes";

const btn = "inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted disabled:opacity-50";
const btnMain = "inline-flex items-center gap-1 rounded-xl bg-bronze px-4 py-2 text-sm font-bold text-white disabled:opacity-50";

function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return (h ? `${h}:${p(m)}:${p(r)}` : `${p(m)}:${p(r)}`).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

export function ExamRunner({ examId, onDone }: { examId: string; onDone: () => void }) {
  const [exam, setExam] = React.useState<RunningExam | null>(null);
  const [answers, setAnswers] = React.useState<Record<string, number>>({});
  const [unsaved, setUnsaved] = React.useState<Record<string, number | null>>({});
  const [left, setLeft] = React.useState(0);
  const [err, setErr] = React.useState("");
  const [state, setState] = React.useState<"loading" | "running" | "submitting" | "done">("loading");
  const [score, setScore] = React.useState<number | null>(null);
  const submitted = React.useRef(false);
  const unsavedRef = React.useRef(unsaved);
  unsavedRef.current = unsaved;

  React.useEffect(() => {
    let alive = true;
    startExam(examId).then((r) => {
      if (!alive) return;
      setExam(r);
      setAnswers(r.answers);
      setState("running");
    }).catch((e) => { if (alive) { setErr(orgClassError(e)); setState("done"); } });
    return () => { alive = false; };
  }, [examId]);

  const flush = React.useCallback(async (attemptId: string): Promise<boolean> => {
    const pending = Object.entries(unsavedRef.current);
    let closed = false;
    for (const [qid, choice] of pending) {
      try {
        const r = await answerExam(attemptId, qid, choice);
        if (r === "closed") { closed = true; break; }
        setUnsaved((u) => {
          if (u[qid] !== choice) return u;
          const n = { ...u };
          delete n[qid];
          return n;
        });
      } catch {
        /* keep it in the queue; retried on the next tick */
      }
    }
    return !closed;
  }, []);

  const submit = React.useCallback(async (auto: boolean) => {
    if (!exam || submitted.current) return;
    if (!auto) {
      const missing = exam.questions.filter((q) => answers[q.id] === undefined).length;
      const text = missing
        ? `${faNum(missing, 0)} سؤال بی‌پاسخ مانده. آزمون تحویل داده شود؟ بعد از تحویل نمی‌شود پاسخ‌ها را تغییر داد.`
        : "آزمون تحویل داده شود؟ بعد از تحویل نمی‌شود پاسخ‌ها را تغییر داد.";
      if (!window.confirm(text)) return;
    }
    submitted.current = true;
    setState("submitting");
    await flush(exam.attemptId);
    try {
      const r = await submitExam(exam.attemptId);
      setScore(r.score);
      setState("done");
    } catch (e) {
      submitted.current = false;
      setErr(orgClassError(e));
      setState("running");
    }
  }, [exam, answers, flush]);

  // countdown on the server clock + retry of unsaved answers
  React.useEffect(() => {
    if (!exam || state !== "running") return;
    const tick = () => {
      const ms = Date.parse(exam.deadlineAt) - (Date.now() + exam.clockSkew);
      setLeft(ms);
      if (ms <= 0) void submit(true);
    };
    tick();
    const t = window.setInterval(tick, 1000);
    const r = window.setInterval(() => { if (Object.keys(unsavedRef.current).length) void flush(exam.attemptId); }, 5000);
    return () => { window.clearInterval(t); window.clearInterval(r); };
  }, [exam, state, submit, flush]);

  React.useEffect(() => {
    if (state !== "running") return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state]);

  const choose = (qid: string, choice: number) => {
    if (!exam || state !== "running") return;
    const next = answers[qid] === choice ? null : choice;
    setAnswers((a) => {
      const n = { ...a };
      if (next === null) delete n[qid]; else n[qid] = next;
      return n;
    });
    setUnsaved((u) => ({ ...u, [qid]: next }));
    void answerExam(exam.attemptId, qid, next).then((r) => {
      if (r === "closed") { void submit(true); return; }
      setUnsaved((u) => {
        if (u[qid] !== next) return u;
        const n = { ...u };
        delete n[qid];
        return n;
      });
    }).catch(() => { /* stays unsaved; retried */ });
  };

  if (state === "loading") return <p className="p-4 text-sm text-muted-foreground" dir="rtl">در حال آماده‌سازی آزمون…</p>;
  if (state === "done") {
    return (
      <div className="space-y-3 p-4 text-center" dir="rtl">
        {err ? (
          <p className="flex items-center justify-center gap-1 text-sm text-red-700"><AlertTriangle className="h-4 w-4" /> {err}</p>
        ) : (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
            <p className="text-sm font-bold">آزمون تحویل داده شد.</p>
            <p className="text-xs text-muted-foreground">
              {score !== null && exam ? `نمرهٔ شما: ${faNum(score)} از ${faNum(exam.maxScore)}` : "نتیجه بعد از پایان آزمون یا انتشار مدرس نمایش داده می‌شود."}
            </p>
          </>
        )}
        <button className={btn} onClick={onDone}>بازگشت</button>
      </div>
    );
  }
  if (!exam) return null;
  const answered = exam.questions.filter((q) => answers[q.id] !== undefined).length;
  const pending = Object.keys(unsaved).length;
  return (
    <div className="space-y-4" dir="rtl">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background/95 p-3 backdrop-blur">
        <span className="flex-1 text-sm font-bold">{exam.title}</span>
        <span className={`flex items-center gap-1 font-mono text-sm font-bold ${left < 60_000 ? "text-red-600" : ""}`}><Clock className="h-4 w-4" /> {clock(left)}</span>
        <span className="text-xs text-muted-foreground">{faNum(answered, 0)} از {faNum(exam.questions.length, 0)} پاسخ</span>
        {pending > 0 && <span className="text-[11px] text-amber-600">{faNum(pending, 0)} پاسخ هنوز ذخیره نشده</span>}
        <button className={btnMain} onClick={() => void submit(false)} disabled={state !== "running"}><Send className="h-4 w-4" /> تحویل</button>
      </div>
      {exam.instructions && <p className="whitespace-pre-wrap rounded-xl bg-muted p-3 text-xs">{exam.instructions}</p>}
      {err && <p className="text-xs text-red-700">{err}</p>}
      <ol className="space-y-3">
        {exam.questions.map((q, i) => (
          <li key={q.id} className="space-y-2 rounded-xl border border-border p-3">
            <p className="whitespace-pre-wrap text-sm">
              <span className="font-bold">{faNum(i + 1, 0)}. </span>{q.text}
              {q.points !== 1 && <span className="text-[11px] text-muted-foreground"> ({faNum(q.points)} نمره)</span>}
            </p>
            <div className="grid gap-2">
              {q.options.map((o, j) => (
                <button key={j} onClick={() => choose(q.id, j)} disabled={state !== "running"}
                  className={`rounded-xl border p-2 text-start text-sm ${answers[q.id] === j ? "border-bronze bg-bronze/[0.08] font-bold" : "border-border hover:bg-muted"}`}>
                  {faNum(j + 1, 0)}) {o}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <div className="flex justify-center pb-6">
        <button className={btnMain} onClick={() => void submit(false)} disabled={state !== "running"}><Send className="h-4 w-4" /> تحویل آزمون</button>
      </div>
    </div>
  );
}
