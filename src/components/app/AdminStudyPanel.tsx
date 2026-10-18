"use client";
/* Lexa admin: study time of all users and per centre (phase 4, two-factor session). */
import * as React from "react";
import { Download, RefreshCw } from "lucide-react";
import { downloadText, toCsv } from "@/lib/cloud-api/org-accounts";
import { addDays, adminStudyOverview, fmtDuration, hours, studyError, tehranToday, type AdminStudyOverview } from "@/lib/cloud-api/study";
import { StatCard, StudyBars } from "./StudyBars";

const btn = "inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted disabled:opacity-50";
const input = "rounded-xl border border-border bg-background px-2 py-1 text-xs";

export function AdminStudyPanel() {
  const today = tehranToday();
  const [from, setFrom] = React.useState(addDays(today, -29));
  const [to, setTo] = React.useState(today);
  const [d, setD] = React.useState<AdminStudyOverview | null>(null);
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const load = React.useCallback(async () => {
    setBusy(true);
    setErr("");
    try { setD(await adminStudyOverview(from, to)); } catch (e) { setErr(studyError(e)); } finally { setBusy(false); }
  }, [from, to]);
  React.useEffect(() => { void load(); }, [load]);
  const exportCsv = () => {
    if (!d) return;
    const head = ["مرکز", "وضعیت", "دانشجوی فعال", "دانشجوی دارای مطالعه", "ساعت روی محتوای مرکز"];
    const body = d.orgs.map((o) => [o.name, o.status, o.students, o.activeStudents, Math.round((o.orgSeconds / 3600) * 10) / 10]);
    downloadText(`lexa-study-orgs-${from}-${to}.csv`, toCsv([head, ...body]));
  };
  const fa = (n: number) => n.toLocaleString("fa-IR");
  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex-1 text-sm font-bold">زمان مطالعه در Lexa</h3>
        <input type="date" className={input} value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className={input} value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
        <button className={btn} onClick={() => void load()} disabled={busy}><RefreshCw className="h-3.5 w-3.5" /></button>
        <button className={btn} onClick={exportCsv} disabled={!d}><Download className="h-3.5 w-3.5" /> CSV مراکز</button>
      </div>
      {err && <p className="rounded-xl border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/30">{err}</p>}
      {d && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard label="کاربر دارای مطالعه" value={fa(d.usersActive)} />
            <StatCard label="از این میان دانشجوی رسمی" value={fa(d.officialActive)} hint={`${fa(d.usersActive - d.officialActive)} کاربر آزاد`} />
            <StatCard label="کل ساعت مطالعه" value={hours(d.seconds)} />
            <StatCard label="میانگین هر کاربر" value={fmtDuration(d.usersActive ? d.seconds / d.usersActive : 0)} />
          </div>
          <div className="rounded-xl border border-border p-3"><StudyBars from={from} to={to} data={d.daily} /></div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="p-2 text-start">مرکز</th><th className="p-2 text-start">دانشجوی فعال</th>
                  <th className="p-2 text-start">دارای مطالعه</th><th className="p-2 text-start">ساعت روی محتوای مرکز</th>
                </tr>
              </thead>
              <tbody>
                {d.orgs.map((o) => (
                  <tr key={o.orgId} className={`border-t border-border ${o.status !== "active" ? "opacity-60" : ""}`}>
                    <td className="p-2">{o.name}</td>
                    <td className="p-2">{fa(o.students)}</td>
                    <td className="p-2">{fa(o.activeStudents)}</td>
                    <td className="p-2">{hours(o.orgSeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
