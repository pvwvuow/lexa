"use client";
/* "My stats" (phase 4): my active study time, streak, what I studied, finished lessons, and
 * what my centres can see. Data: supabase/009_study_time.sql via src/lib/cloud-api/study.ts. */
import * as React from "react";
import { BarChart3, Flame, RefreshCw, Trash2 } from "lucide-react";
import {
  EVENT_LABELS, KIND_LABELS, addDays, faDay, fmtDuration, forgetMyStudy, myLearning, myStudy, studyError, summarize,
  tehranToday, type StudyDay,
} from "@/lib/cloud-api/study";
import { myOrgAccounts, type MyOrgAccount } from "@/lib/cloud-api/org-accounts";
import { clearStudyQueue, flushStudy, onStudyTick, unsentSeconds } from "@/lib/study-tracker";
import { StatCard, StudyBars } from "./StudyBars";

const btn = "inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted disabled:opacity-50";

export function MyStatsView() {
  const [rows, setRows] = React.useState<StudyDay[]>([]);
  const [events, setEvents] = React.useState<Record<string, { n: number; total: number }>>({});
  const [orgs, setOrgs] = React.useState<MyOrgAccount[]>([]);
  const [pending, setPending] = React.useState(0);
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const today = tehranToday();

  const load = React.useCallback(async () => {
    setBusy(true);
    setErr("");
    try {
      await flushStudy();
      const [r, e, o] = await Promise.all([myStudy(365), myLearning(90), myOrgAccounts().catch(() => [])]);
      setRows(r);
      setEvents(e);
      setOrgs(o.filter((x) => x.termsAcceptedAt));
      setPending(unsentSeconds());
    } catch (e) {
      setErr(studyError(e));
    } finally {
      setBusy(false);
    }
  }, []);
  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => onStudyTick(() => setPending(unsentSeconds())), []);

  const sum = summarize(rows, today);
  const forget = async () => {
    if (!window.confirm("همهٔ زمان‌های مطالعه و فعالیت‌های ثبت‌شدهٔ شما پاک شود؟ نمره‌ها و نتیجهٔ آزمون‌های رسمی پاک نمی‌شوند. این کار برگشت ندارد.")) return;
    try {
      await forgetMyStudy();
      clearStudyQueue();
      void load();
    } catch (e) {
      setErr(studyError(e));
    }
  };

  const from30 = addDays(today, -29);
  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center gap-2">
        <h2 className="flex flex-1 items-center gap-1 text-base font-bold"><BarChart3 className="h-5 w-5" /> آمار من</h2>
        <button className={btn} onClick={() => void load()} disabled={busy}><RefreshCw className="h-3.5 w-3.5" /> تازه‌سازی</button>
      </div>
      {err && <p className="rounded-xl border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/30">{err}</p>}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="امروز" value={fmtDuration(sum.today + pending)} hint={pending > 0 ? "بخشی هنوز در حال ارسال است" : undefined} />
        <StatCard label="۷ روز اخیر" value={fmtDuration(sum.last7)} />
        <StatCard label="۳۰ روز اخیر" value={fmtDuration(sum.last30)} hint={`${sum.activeDays30.toLocaleString("fa-IR")} روز فعال`} />
        <StatCard label="روزهای پشت‌سرهم" value={`${sum.streak.toLocaleString("fa-IR")} روز`} hint="روزی دست‌کم ۵ دقیقه" />
      </div>

      <section className="space-y-2 rounded-xl border border-border p-3">
        <h3 className="flex items-center gap-1 text-sm font-bold"><Flame className="h-4 w-4 text-bronze" /> ۳۰ روز اخیر</h3>
        <StudyBars from={from30} to={today} data={rows} />
        {sum.bestDay && <p className="text-[11px] text-muted-foreground">بهترین روز: {faDay(sum.bestDay.day, { dateStyle: "medium" })} با {fmtDuration(sum.bestDay.seconds)}</p>}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <section className="space-y-2 rounded-xl border border-border p-3">
          <h3 className="text-sm font-bold">چه چیزی خواندم (یک سال اخیر)</h3>
          {!sum.byKind.length && <p className="text-xs text-muted-foreground">هنوز زمانی ثبت نشده است.</p>}
          <ul className="space-y-1 text-xs">
            {sum.byKind.map(([k, v]) => (
              <li key={k} className="flex items-center gap-2">
                <span className="w-28 shrink-0">{KIND_LABELS[k] ?? k}</span>
                <span className="h-2 flex-1 overflow-hidden rounded bg-muted">
                  <span className="block h-full bg-bronze" style={{ width: `${Math.round((v / Math.max(1, sum.total)) * 100)}%` }} />
                </span>
                <span className="w-28 shrink-0 text-end text-muted-foreground">{fmtDuration(v)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-2 rounded-xl border border-border p-3">
          <h3 className="text-sm font-bold">فعالیت‌ها (۹۰ روز اخیر)</h3>
          {!Object.keys(events).length && <p className="text-xs text-muted-foreground">هنوز فعالیتی ثبت نشده است.</p>}
          <ul className="space-y-1 text-xs">
            {Object.entries(events).map(([k, v]) => (
              <li key={k} className="flex justify-between"><span>{EVENT_LABELS[k] ?? k}</span><span className="font-bold">{v.n.toLocaleString("fa-IR")}</span></li>
            ))}
          </ul>
        </section>
      </div>

      <section className="space-y-2 rounded-xl border border-border p-3 text-xs text-muted-foreground">
        <h3 className="text-sm font-bold text-foreground">چه کسی این آمار را می‌بیند؟</h3>
        <p>فقط زمان فعال شمرده می‌شود: وقتی صفحهٔ Lexa جلوی چشم شماست و در دو دقیقهٔ اخیر کاری کرده‌اید؛ حداکثر ۱۲ ساعت در روز.</p>
        <p>طبق شرایط استفاده، مدیر Lexa آمار کلی همهٔ کاربران را می‌بیند.</p>
        {orgs.length > 0 ? (
          <p>
            {orgs.map((o) => o.orgName).join("، ")}: فقط زمان مطالعهٔ شما از روزی که دانشجوی رسمی شدید تا وقتی دانشجوی فعال هستید،
            و زمانی که روی محتوای همان مرکز گذاشته‌اید. هیچ مرکزی دادهٔ مرکز دیگر را نمی‌بیند.
          </p>
        ) : (
          <p>شما دانشجوی رسمی هیچ مرکزی نیستید؛ هیچ مرکز آموزشی این آمار را نمی‌بیند.</p>
        )}
        <button className={`${btn} text-red-700`} onClick={() => void forget()}><Trash2 className="h-3.5 w-3.5" /> پاک کردن زمان‌های مطالعهٔ من</button>
      </section>
    </div>
  );
}
