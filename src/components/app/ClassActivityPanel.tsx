"use client";
/* "Activity" tab of a class (phase 4): study time of the class's students, grades and hints for
 * students who may be falling behind. Teacher of the class, or a manager with two-factor. */
import * as React from "react";
import { AlertTriangle, Download } from "lucide-react";
import { downloadText, toCsv } from "@/lib/cloud-api/org-accounts";
import { componentLabel } from "@/lib/cloud-api/org-classes";
import {
  addDays, classStudyReport, faDay, fallingBehind, fmtDuration, studyError, tehranToday, type ClassStudyRow,
} from "@/lib/cloud-api/study";

const btn = "inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted disabled:opacity-50";
const input = "rounded-xl border border-border bg-background px-2 py-1 text-xs";

export function ClassActivityPanel({ classId, className }: { classId: string; className: string }) {
  const today = tehranToday();
  const [from, setFrom] = React.useState(addDays(today, -29));
  const [to, setTo] = React.useState(today);
  const [rows, setRows] = React.useState<ClassStudyRow[]>([]);
  const [onlyRisk, setOnlyRisk] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const load = React.useCallback(async () => {
    setBusy(true);
    setErr("");
    try { setRows(await classStudyReport(classId, from, to)); } catch (e) { setErr(studyError(e)); } finally { setBusy(false); }
  }, [classId, from, to]);
  React.useEffect(() => { void load(); }, [load]);

  const withRisk = rows.map((r) => ({ r, risk: fallingBehind(r, today) }));
  const shown = onlyRisk ? withRisk.filter((x) => x.risk.length) : withRisk;
  const total = rows.reduce((a, r) => a + r.seconds, 0);
  const exportCsv = () => {
    const head = ["نام کاربری", "شماره دانشجویی", "نام", "زمان مطالعه (دقیقه)", "روی محتوای مرکز (دقیقه)", "روز فعال", "آخرین فعالیت", "دو هفتهٔ اخیر (دقیقه)", "دو هفتهٔ قبل (دقیقه)", "میان‌ترم", "پایان‌ترم", "نهایی", "هشدار"];
    const body = withRisk.map(({ r, risk }) => [
      r.username, r.studentNo, r.fullName, Math.round(r.seconds / 60), Math.round(r.orgSeconds / 60), r.activeDays, r.lastDay ?? "",
      Math.round(r.recentSeconds / 60), Math.round(r.prevSeconds / 60), r.grades.midterm ?? "", r.grades.final_exam ?? "", r.grades.final ?? "", risk.join("؛ "),
    ]);
    downloadText(`activity-${className.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 40)}-${from}-${to}.csv`, toCsv([head, ...body]));
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" className={input} value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className={input} value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={onlyRisk} onChange={(e) => setOnlyRisk(e.target.checked)} /> فقط کسانی که هشدار دارند
        </label>
        <span className="flex-1" />
        <button className={btn} onClick={exportCsv} disabled={!rows.length}><Download className="h-3.5 w-3.5" /> CSV</button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {busy ? "در حال بارگذاری…" : `جمع زمان مطالعهٔ کلاس در این بازه: ${fmtDuration(total)} · ${withRisk.filter((x) => x.risk.length).length.toLocaleString("fa-IR")} نفر هشدار دارند`}.
        هشدارها فقط راهنمای مدرس است و به دانشجو نشان داده نمی‌شود.
      </p>
      {err && <p className="rounded-xl border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/30">{err}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="p-2 text-start">دانشجو</th><th className="p-2 text-start">زمان مطالعه</th><th className="p-2 text-start">روی محتوای مرکز</th>
              <th className="p-2 text-start">روز فعال</th><th className="p-2 text-start">آخرین فعالیت</th><th className="p-2 text-start">نمره‌ها</th>
              <th className="p-2 text-start">هشدار</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ r, risk }) => (
              <tr key={r.studentId} className="border-t border-border align-top">
                <td className="p-2">{r.fullName || r.username} <span className="text-muted-foreground" dir="ltr">{r.studentNo}</span></td>
                <td className="p-2">{fmtDuration(r.seconds)}</td>
                <td className="p-2">{fmtDuration(r.orgSeconds)}</td>
                <td className="p-2">{r.activeDays.toLocaleString("fa-IR")}</td>
                <td className="p-2">{r.lastDay ? faDay(r.lastDay) : "-"}</td>
                <td className="p-2">
                  {Object.entries(r.grades).map(([k, v]) => (
                    <span key={k} className="block">{componentLabel(k)}: {v.toLocaleString("fa-IR", { maximumFractionDigits: 2 })}</span>
                  ))}
                </td>
                <td className="p-2">
                  {risk.map((x) => <span key={x} className="flex items-center gap-1 text-amber-700"><AlertTriangle className="h-3 w-3" /> {x}</span>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
