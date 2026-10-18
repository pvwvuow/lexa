"use client";
/* «آمار من» (phase 4 of docs/ORG_LEARNING.md): the user's own active study time.
 * Daily bars of the last 30 days + totals. Only ACTIVE time counts — the page in
 * front of the eyes with activity in the last two minutes; a heartbeat per minute. */
import * as React from "react";
import { Activity, Info, Loader2, RefreshCw, Timer } from "lucide-react";
import { faDayLabel, faShortHours, myStudy, studyError, type StudyDay } from "@/lib/cloud-api/study";

const BTN = "inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold hover:border-bronze disabled:opacity-50";

function Chart({ rows }: { rows: StudyDay[] }) {
  const data = [...rows].reverse(); // oldest → newest
  const max = Math.max(3600, ...data.map((d) => d.seconds));
  const W = 700, H = 180, GAP = 4;
  const bw = data.length ? (W - GAP * (data.length - 1)) / data.length : W;
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 26}`} className="min-w-[560px]" role="img" aria-label="نمودار زمان مطالعهٔ روزانه">
        {[0.5, 1].map((f) => (
          <line key={f} x1="0" x2={W} y1={H - (H - 18) * f} y2={H - (H - 18) * f} className="stroke-border" strokeDasharray="3 5" strokeWidth="1" />
        ))}
        {data.map((d, i) => {
          const h = Math.max(3, ((H - 18) * d.seconds) / max);
          const x = i * (bw + GAP);
          return (
            <g key={d.day}>
              <title>{`${faDayLabel(d.day)} — ${faShortHours(d.seconds)}`}</title>
              <rect x={x} y={H - h} width={Math.max(6, bw)} height={h} rx={Math.min(6, Math.max(3, bw / 3))}
                className={d.seconds > 0 ? "fill-bronze" : "fill-muted-foreground/25"} opacity={d.seconds > 0 ? 0.9 : 1} />
              {(i === data.length - 1 || i % 7 === 0) && (
                <text x={x + Math.max(6, bw) / 2} y={H + 14} textAnchor="middle" className="fill-muted-foreground" fontSize="9">
                  {new Date(`${d.day}T00:00:00`).toLocaleDateString("fa-IR", { day: "numeric", month: "short" })}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function MyStatsView() {
  const [rows, setRows] = React.useState<StudyDay[] | null>(null);
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setBusy(true);
    setErr("");
    try {
      setRows(await myStudy());
    } catch (e) {
      setErr(studyError(e));
    } finally {
      setBusy(false);
    }
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  const sum = (days: number) => {
    const cutoff = Date.now() - days * 86400000;
    return (rows ?? []).filter((r) => Date.parse(`${r.day}T00:00:00Z`) >= cutoff).reduce((a, r) => a + r.seconds, 0);
  };
  const today = sum(1); // «امروز» = the row whose day started in the last 24 h

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 pb-28 pt-6 sm:px-6" dir="rtl">
      <div className="flex items-center gap-2">
        <h1 className="flex flex-1 items-center gap-2 text-lg font-extrabold"><Timer className="h-5 w-5 text-bronze" /> آمار من</h1>
        <button className={BTN} onClick={() => void load()} disabled={busy}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} تازه‌سازی</button>
      </div>

      {err && (
        <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">{err}</p>
      )}

      {rows === null && !err && (
        <div className="flex justify-center py-20 text-bronze"><Loader2 className="h-6 w-6 animate-spin" /></div>
      )}

      {rows !== null && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "امروز", sec: today, hot: true },
              { label: "۷ روز گذشته", sec: sum(7) },
              { label: "۳۰ روز گذشته", sec: sum(30) },
              { label: "مجموع ثبت‌شده", sec: (rows ?? []).reduce((a, r) => a + r.seconds, 0) },
            ].map((c) => (
              <div key={c.label} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <p className="text-[11px] text-muted-foreground">{c.label}</p>
                <p className={`mt-1 text-lg font-extrabold ${c.hot ? "text-bronze" : ""}`}>{faShortHours(c.sec)}</p>
              </div>
            ))}
          </div>

          <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold"><Activity className="h-4 w-4 text-bronze" /> زمان فعال روزانه (۳۰ روز گذشته)</h2>
            {rows.length ? <Chart rows={rows} /> : <p className="text-xs text-muted-foreground">هنوز زمانی ثبت نشده است. با مطالعهٔ فعال در Lexa، هر دقیقه فقط وقتی ثبت می‌شود که صفحه جلوی چشم شما و در حال کار با آن باشید.</p>}
          </section>

          <section className="rounded-2xl border border-border bg-card p-4 text-xs shadow-card">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold"><Activity className="h-4 w-4 text-bronze" /> روزهای اخیر</h2>
            {rows.length ? (
              <ul className="divide-y divide-border">
                {[...rows].slice(0, 14).map((d) => (
                  <li key={d.day} className="flex items-center gap-3 py-2">
                    <span className="min-w-28 text-muted-foreground">{faDayLabel(d.day)}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-bronze/80" style={{ width: `${Math.min(100, (d.seconds / Math.max(3600, ...rows.map((x) => x.seconds))) * 100)}%` }} />
                    </span>
                    <span className="min-w-20 text-end font-bold">{faShortHours(d.seconds)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-muted-foreground">—</p>}
          </section>

          <p className="flex items-start gap-2 rounded-2xl border border-dashed border-border bg-muted/40 p-3 text-[11px] leading-5 text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            زمان مطالعه برای همهٔ کاربران واردشده ثبت می‌شود و در سقف ۱۲ ساعت در روز محاسبه می‌گردد. طبق شرایط استفاده، ادمین Lexa به زمان‌های ثبت‌شده دسترسی دارد؛ مراکز آموزشی نیز فقط زمان دانشجویان رسمی خودشان را می‌بینند.
          </p>
        </>
      )}
    </div>
  );
}
