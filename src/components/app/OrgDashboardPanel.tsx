"use client";
/* Centre dashboard (phase 4): managers get the 30-day summary and a per-student study report
 * (two-factor session); teachers get one row per own class with the last 14 days. */
import * as React from "react";
import { Download, LayoutDashboard, RefreshCw } from "lucide-react";
import { downloadText, statusLabel } from "@/lib/cloud-api/org-accounts";
import {
  addDays, faDay, fmtDuration, hours, orgDashboard, orgStudyReport, studyError, studyReportCsv, teacherOverview, tehranToday,
  type OrgDashboard, type StudentStudyRow, type TeacherClassRow,
} from "@/lib/cloud-api/study";
import { StatCard, StudyBars } from "./StudyBars";

const btn = "inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted disabled:opacity-50";
const input = "rounded-xl border border-border bg-background px-2 py-1 text-xs";
const fa = (n: number | null, d = 1) => (n === null ? "-" : n.toLocaleString("fa-IR", { maximumFractionDigits: d }));

function ErrorLine({ text }: { text: string }) {
  return text ? <p className="rounded-xl border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/30">{text}</p> : null;
}

export function OrgDashboardPanel({ orgId, orgName, canManage }: { orgId: string; orgName: string; canManage: boolean }) {
  return (
    <div className="space-y-5" dir="rtl">
      <h3 className="flex items-center gap-1 text-sm font-bold"><LayoutDashboard className="h-4 w-4" /> داشبورد {orgName}</h3>
      {canManage && <ManagerSummary orgId={orgId} />}
      <TeacherClasses orgId={orgId} canManage={canManage} />
      {canManage && <StudentReport orgId={orgId} orgName={orgName} />}
    </div>
  );
}

function ManagerSummary({ orgId }: { orgId: string }) {
  const [d, setD] = React.useState<OrgDashboard | null>(null);
  const [err, setErr] = React.useState("");
  const load = React.useCallback(async () => {
    setErr("");
    try { setD(await orgDashboard(orgId)); } catch (e) { setErr(studyError(e)); }
  }, [orgId]);
  React.useEffect(() => { void load(); }, [load]);
  const today = tehranToday();
  if (err) return <ErrorLine text={err} />;
  if (!d) return <p className="text-xs text-muted-foreground">در حال بارگذاری…</p>;
  const avgPerActive = d.active30d ? d.seconds30d / d.active30d : 0;
  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="دانشجوی فعال" value={`${fa(d.students, 0)} از ${fa(d.seats, 0)}`} hint="ظرفیت حساب‌های دانشجویی" />
        <StatCard label="مطالعه کرده در ۷ روز" value={`${fa(d.active7d, 0)} نفر`} hint={`${fa(d.active30d, 0)} نفر در ۳۰ روز`} />
        <StatCard label="ساعت مطالعه (۳۰ روز)" value={hours(d.seconds30d)} hint={`میانگین هر نفر فعال: ${fmtDuration(avgPerActive)}`} />
        <StatCard label="روی محتوای مرکز (۳۰ روز)" value={`${hours(d.orgSeconds30d)} ساعت`} />
        <StatCard label="کلاس فعال" value={fa(d.classes, 0)} />
        <StatCard label="آزمون رسمی پیش رو" value={fa(d.examsUpcoming, 0)} />
        <StatCard label="میانگین نمرهٔ نهایی" value={fa(d.avgFinal, 2)} hint="ترم‌های باز، از ۲۰" />
        <StatCard label="ساعت مطالعه (۷ روز)" value={hours(d.seconds7d)} />
      </div>
      <div className="rounded-xl border border-border p-3">
        <p className="mb-2 text-xs font-bold">ساعت مطالعهٔ دانشجوها در ۳۰ روز اخیر</p>
        <StudyBars from={addDays(today, -29)} to={today} data={d.daily} />
      </div>
    </section>
  );
}

function TeacherClasses({ orgId, canManage }: { orgId: string; canManage: boolean }) {
  const [rows, setRows] = React.useState<TeacherClassRow[] | null>(null);
  const [err, setErr] = React.useState("");
  React.useEffect(() => {
    let alive = true;
    teacherOverview(orgId).then((r) => { if (alive) setRows(r); }).catch((e) => { if (alive) setErr(studyError(e)); });
    return () => { alive = false; };
  }, [orgId]);
  if (err) return <ErrorLine text={err} />;
  if (!rows) return null;
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-bold">{canManage ? "همهٔ کلاس‌های فعال" : "کلاس‌های من"} (۷ روز اخیر)</h4>
      {!rows.length && <p className="text-xs text-muted-foreground">کلاس فعالی نیست.</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="p-2 text-start">کلاس</th><th className="p-2 text-start">دانشجو</th><th className="p-2 text-start">فعال</th>
              <th className="p-2 text-start">ساعت مطالعه</th><th className="p-2 text-start">نسبت به هفتهٔ قبل</th>
              <th className="p-2 text-start">میان‌ترم</th><th className="p-2 text-start">نهایی</th><th className="p-2 text-start">آزمون پیش رو</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const change = r.secondsPrev7d ? Math.round(((r.seconds7d - r.secondsPrev7d) / r.secondsPrev7d) * 100) : null;
              return (
                <tr key={r.classId} className="border-t border-border">
                  <td className="p-2">{r.courseTitle}{r.title ? ` (${r.title})` : ""}<span className="block text-[10px] text-muted-foreground">{r.termTitle}</span></td>
                  <td className="p-2">{fa(r.students, 0)}</td>
                  <td className="p-2">{fa(r.active7d, 0)}</td>
                  <td className="p-2">{hours(r.seconds7d)}</td>
                  <td className={`p-2 ${change !== null && change < -30 ? "font-bold text-red-700" : ""}`}>
                    {change === null ? "-" : `${change > 0 ? "+" : ""}${change.toLocaleString("fa-IR")}٪`}
                  </td>
                  <td className="p-2">{fa(r.avgMidterm, 2)}</td>
                  <td className="p-2">{fa(r.avgFinal, 2)}</td>
                  <td className="p-2">{fa(r.examsUpcoming, 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StudentReport({ orgId, orgName }: { orgId: string; orgName: string }) {
  const today = tehranToday();
  const [from, setFrom] = React.useState(addDays(today, -29));
  const [to, setTo] = React.useState(today);
  const [rows, setRows] = React.useState<StudentStudyRow[]>([]);
  const [q, setQ] = React.useState("");
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const load = React.useCallback(async () => {
    setBusy(true);
    setErr("");
    try { setRows(await orgStudyReport(orgId, from, to)); } catch (e) { setErr(studyError(e)); } finally { setBusy(false); }
  }, [orgId, from, to]);
  React.useEffect(() => { void load(); }, [load]);
  const shown = rows.filter((r) => !q || `${r.fullName} ${r.username} ${r.studentNo}`.toLowerCase().includes(q.toLowerCase()));
  const preset = (n: number) => { setFrom(addDays(today, -(n - 1))); setTo(today); };
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="flex-1 text-xs font-bold">زمان مطالعهٔ دانشجوها</h4>
        <button className={btn} onClick={() => preset(7)}>۷ روز</button>
        <button className={btn} onClick={() => preset(30)}>۳۰ روز</button>
        <button className={btn} onClick={() => preset(120)}>۱۲۰ روز</button>
        <input type="date" className={input} value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className={input} value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
        <button className={btn} onClick={() => void load()} disabled={busy}><RefreshCw className="h-3.5 w-3.5" /></button>
        <button className={btn} disabled={!rows.length} onClick={() => { const c = studyReportCsv(orgName, from, to, rows); downloadText(c.name, c.text); }}>
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </div>
      <input className={`${input} w-full`} placeholder="جست‌وجو در نام، نام کاربری یا شماره" value={q} onChange={(e) => setQ(e.target.value)} />
      <p className="text-[11px] text-muted-foreground">
        فقط روزهایی شمرده می‌شود که دانشجو رسمیِ همین مرکز و فعال بوده است. «روی محتوای مرکز» یعنی زمانی که روی مطالب، دوره‌ها و آزمون‌های همین مرکز گذاشته.
      </p>
      <ErrorLine text={err} />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="p-2 text-start">دانشجو</th><th className="p-2 text-start">وضعیت</th><th className="p-2 text-start">کل زمان</th>
              <th className="p-2 text-start">روی محتوای مرکز</th><th className="p-2 text-start">روز فعال</th><th className="p-2 text-start">آخرین فعالیت</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.studentId} className="border-t border-border">
                <td className="p-2">{r.fullName || r.username} <span className="text-muted-foreground" dir="ltr">{r.studentNo}</span></td>
                <td className="p-2">{statusLabel(r.status)}</td>
                <td className="p-2">{fmtDuration(r.seconds)}</td>
                <td className="p-2">{fmtDuration(r.orgSeconds)}</td>
                <td className="p-2">{fa(r.activeDays, 0)}</td>
                <td className="p-2">{r.lastDay ? faDay(r.lastDay) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
