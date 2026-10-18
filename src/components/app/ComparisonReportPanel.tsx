"use client";
/* Comparison report (phase 6): final grades against study time in the same term. Centre mode
 * (orgId): one term, all or some classes. Lexa admin mode (admin, no orgId): terms of every centre
 * that started in a date range, pooled or one centre. The disclaimer is always on screen. */
import * as React from "react";
import { BarChart3, Download, Play } from "lucide-react";
import { downloadText } from "@/lib/cloud-api/org-accounts";
import { classDisplayName, classList, type ClassRow } from "@/lib/cloud-api/org-classes";
import { addDays, tehranToday } from "@/lib/cloud-api/study";
import {
  adminCompareReport, checkOptions, COMPARE_DISCLAIMER, compareCsv, compareError, compareReport, compareTerms,
  DEFAULT_COMPARE, GROUP_COLORS, GROUP_SHORT, groupLabel,
  type CompareBasis, type CompareOptions, type CompareResult, type CompareTerm,
} from "@/lib/cloud-api/compare";
import type { GroupKey, Point } from "@/lib/compare-stats";

const btn = "inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted disabled:opacity-50";
const input = "rounded-xl border border-border bg-background px-2 py-1 text-xs";
const fa = (n: number | null | undefined, d = 2) =>
  n === null || n === undefined || !isFinite(n) ? "-" : n.toLocaleString("fa-IR", { maximumFractionDigits: d });
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fa(Math.abs(n))}`;
const ci = (low: number, high: number) => `${signed(low)} تا ${signed(high)}`;

function ErrorLine({ text }: { text: string }) {
  return text ? <p className="rounded-xl border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/30">{text}</p> : null;
}

export function ComparisonReportPanel({ orgId, orgName, admin = false, orgs = [] }: {
  orgId?: string;
  orgName?: string;
  admin?: boolean;
  orgs?: { id: string; name: string }[];
}) {
  const centre = !!orgId;
  const today = tehranToday();
  const [terms, setTerms] = React.useState<CompareTerm[]>([]);
  const [classes, setClasses] = React.useState<ClassRow[]>([]);
  const [termId, setTermId] = React.useState("");
  const [picked, setPicked] = React.useState<string[] | null>(null);
  const [from, setFrom] = React.useState(addDays(today, -365));
  const [to, setTo] = React.useState(today);
  const [adminOrg, setAdminOrg] = React.useState("");
  const [opt, setOpt] = React.useState<CompareOptions>(DEFAULT_COMPARE);
  const [res, setRes] = React.useState<CompareResult | null>(null);
  const [title, setTitle] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");

  React.useEffect(() => {
    if (!orgId) return;
    let live = true;
    Promise.all([compareTerms(orgId), classList(orgId)])
      .then(([t, c]) => {
        if (!live) return;
        setTerms(t);
        setClasses(c);
        setTermId((cur) => cur || (t.find((x) => x.finals > 0) ?? t[0])?.id || "");
      })
      .catch((e) => live && setErr(compareError(e)));
    return () => { live = false; };
  }, [orgId]);

  const termClasses = classes.filter((c) => c.termId === termId);
  const term = terms.find((t) => t.id === termId);

  const run = async () => {
    const bad = checkOptions(opt);
    if (bad) { setErr(bad); return; }
    setErr(""); setBusy(true); setRes(null);
    try {
      if (orgId) {
        const ids = picked && picked.length < termClasses.length ? picked : null;
        if (ids && !ids.length) throw new Error("bad_input");
        setRes(await compareReport(orgId, termId, ids, opt));
        setTitle(`${orgName ?? ""} ${term?.title ?? ""}`.trim());
      } else {
        setRes(await adminCompareReport(from, to, adminOrg || null, opt));
        setTitle(`${adminOrg ? orgs.find((o) => o.id === adminOrg)?.name ?? "" : "همهٔ مراکز"} ${from}..${to}`);
      }
    } catch (e) {
      setErr(compareError(e));
    } finally {
      setBusy(false);
    }
  };

  if (!centre && !admin) return null;
  return (
    <div className="space-y-4" dir="rtl">
      <h3 className="flex items-center gap-1 text-sm font-bold"><BarChart3 className="h-4 w-4" /> گزارش مقایسه{orgName ? ` ${orgName}` : ""}</h3>
      <p className="rounded-xl border border-amber-300 bg-amber-50 p-2 text-xs font-bold text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{COMPARE_DISCLAIMER}</p>
      <p className="text-xs leading-6 text-muted-foreground">
        هر نقطه یک دانشجوی رسمی در یک ترم است: نمره = میانگین نمرهٔ نهایی او در کلاس‌های انتخاب‌شده (از ۲۰)،
        زمان = زمان مطالعهٔ فعال در تاریخ‌های همان ترم. کاربران آزاد، انصراف‌ها و کسانی که کمتر از ۸۰٪ ترم حساب رسمی داشتند حساب نمی‌شوند.
        گروه کمتر از ۱۰ نفر نمایش داده نمی‌شود.
      </p>

      <section className="space-y-2 rounded-xl border border-border p-3">
        {centre ? (
          <>
            <label className="flex flex-wrap items-center gap-2 text-xs">ترم
              <select className={input} value={termId} onChange={(e) => { setTermId(e.target.value); setPicked(null); setRes(null); }}>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>{t.title} ({fa(t.finals, 0)} نمرهٔ نهایی){!t.startsOn || !t.endsOn ? " - بدون تاریخ" : ""}</option>
                ))}
              </select>
            </label>
            {term && (!term.startsOn || !term.endsOn) && (
              <p className="text-xs text-red-700">برای این ترم تاریخ شروع و پایان ثبت نشده؛ بدون تاریخ، زمان مطالعهٔ ترم معلوم نیست.</p>
            )}
            {termClasses.length > 1 && (
              <details className="text-xs">
                <summary className="cursor-pointer">کلاس‌ها ({picked ? `${fa(picked.length, 0)} از ${fa(termClasses.length, 0)}` : "همه"})</summary>
                <div className="mt-2 grid gap-1 sm:grid-cols-2">
                  {termClasses.map((c) => {
                    const on = !picked || picked.includes(c.id);
                    return (
                      <label key={c.id} className="flex items-center gap-1">
                        <input type="checkbox" checked={on} onChange={() => {
                          const cur = picked ?? termClasses.map((x) => x.id);
                          setPicked(on ? cur.filter((x) => x !== c.id) : [...cur, c.id]);
                        }} />
                        {classDisplayName(c)}{c.teacherName ? ` - ${c.teacherName}` : ""}
                      </label>
                    );
                  })}
                </div>
              </details>
            )}
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            ترم‌هایی که شروعشان بین
            <input type="date" className={input} value={from} onChange={(e) => setFrom(e.target.value)} />
            و
            <input type="date" className={input} value={to} onChange={(e) => setTo(e.target.value)} />
            {orgs.length > 0 && (
              <select className={input} value={adminOrg} onChange={(e) => setAdminOrg(e.target.value)}>
                <option value="">همهٔ مراکز</option>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          مرز گروه‌ها (ساعت در ترم):
          <input type="number" min={0.1} step={0.5} className={`${input} w-20`} value={opt.cutLow}
            onChange={(e) => setOpt({ ...opt, cutLow: Number(e.target.value) })} />
          و
          <input type="number" min={0.5} step={1} className={`${input} w-20`} value={opt.cutHigh}
            onChange={(e) => setOpt({ ...opt, cutHigh: Number(e.target.value) })} />
          <select className={input} value={opt.basis} onChange={(e) => setOpt({ ...opt, basis: e.target.value as CompareBasis })}>
            <option value="all">زمان مطالعه در همهٔ Lexa</option>
            <option value="org">فقط روی محتوای مرکز</option>
          </select>
          <button className={btn} disabled={busy || (centre && !termId)} onClick={() => void run()}>
            <Play className="h-3 w-3" /> {busy ? "در حال ساخت…" : "ساخت گزارش"}
          </button>
        </div>
      </section>

      <ErrorLine text={err} />
      {res && <Result res={res} title={title} />}
    </div>
  );
}

function Result({ res, title }: { res: CompareResult; title: string }) {
  const c = res.counts;
  const shown = res.groups.filter((g) => !g.hidden).length;
  const base = res.diffs[0]?.base;
  return (
    <section className="space-y-4">
      <p className="text-xs leading-6 text-muted-foreground">
        {fa(c.enrolled, 0)} ثبت‌نام (دانشجو در ترم){c.terms > 1 ? ` در ${fa(c.terms, 0)} ترم` : ""}؛
        در گزارش: {fa(res.points.length, 0)} نفر.
        کنار گذاشته: بدون حساب رسمی {fa(c.noAccount, 0)}، بدون نمرهٔ نهایی {fa(c.noFinal, 0)}،
        رسمی در کمتر از ۸۰٪ ترم {fa(c.partial, 0)}{c.noDates ? `، ترم بدون تاریخ یا شروع‌نشده ${fa(c.noDates, 0)}` : ""}.
      </p>

      {shown === 0 ? (
        <p className="rounded-xl border border-border p-3 text-xs">هیچ گروهی ۱۰ نفر یا بیشتر ندارد؛ گزارشی برای نمایش نیست.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border text-right">
                  <th className="p-1">گروه</th><th className="p-1">تعداد</th><th className="p-1">میانگین</th><th className="p-1">میانه</th>
                  <th className="p-1">انحراف معیار</th><th className="p-1">اختلاف با «{base ? GROUP_SHORT[base] : "-"}»</th><th className="p-1">بازهٔ اطمینان ۹۵٪</th>
                </tr>
              </thead>
              <tbody>
                {res.groups.map((g) => {
                  const s = res.stats.find((x) => x.k === g.k);
                  const d = res.diffs.find((x) => x.k === g.k);
                  return (
                    <tr key={g.k} className="border-b border-border/50">
                      <td className="p-1"><span className="ml-1 inline-block h-2 w-2 rounded-full" style={{ background: GROUP_COLORS[g.k] }} />{groupLabel(g.k, res.cuts)}</td>
                      {g.hidden || !s ? (
                        <td className="p-1 text-muted-foreground" colSpan={6}>کمتر از {fa(res.minGroup, 0)} نفر؛ نمایش داده نمی‌شود</td>
                      ) : (
                        <>
                          <td className="p-1">{fa(s.n, 0)}</td><td className="p-1">{fa(s.mean)}</td><td className="p-1">{fa(s.median)}</td>
                          <td className="p-1">{fa(s.sd)}</td><td className="p-1">{d ? signed(d.diff) : "-"}</td>
                          <td className="p-1">{d ? ci(d.low, d.high) : "-"}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-1 text-[11px] text-muted-foreground">اگر بازهٔ اطمینان از صفر بگذرد، اختلاف از نظر آماری روشن نیست.</p>
          </div>

          <div className="rounded-xl border border-border p-3 text-xs leading-6">
            <p className="font-bold">نسخهٔ کنترل‌شده با معدل قبلی</p>
            {res.controlled ? (
              <>
                <p className="text-muted-foreground">
                  {fa(res.controlled.n, 0)} نفر با معدل قبلی؛ اختلاف نمره پس از یکسان فرض کردن معدل قبلی (رگرسیون خطی):
                </p>
                <ul className="list-inside list-disc">
                  {res.controlled.diffs.map((d) => (
                    <li key={d.k}>«{GROUP_SHORT[d.k]}» نسبت به «{GROUP_SHORT[d.base]}»: {signed(d.diff)} (بازهٔ ۹۵٪: {ci(d.low, d.high)})</li>
                  ))}
                  <li>هر یک نمره معدل قبلی بیشتر: {signed(res.controlled.gpaSlope)} نمره (بازهٔ ۹۵٪: {ci(res.controlled.gpaLow, res.controlled.gpaHigh)})</li>
                </ul>
                {res.controlled.dropped.length > 0 && (
                  <p className="text-muted-foreground">گروه {res.controlled.dropped.map((k) => `«${GROUP_SHORT[k]}»`).join("، ")} کمتر از ۱۰ نفر با معدل قبلی دارد و در این نسخه نیست.</p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">معدل قبلی برای دست‌کم دو گروه (هر کدام ۱۰ نفر) ثبت نشده. معدل قبلی را از بخش کلاس‌ها (CSV)، API یا کانکتور وارد کنید.</p>
            )}
          </div>

          {res.correlation && (
            <p className="text-xs">
              همبستگی رتبه‌ای ساعت مطالعه و نمره (اسپیرمن): {fa(res.correlation.rho)} (بازهٔ ۹۵٪: {fa(res.correlation.low)} تا {fa(res.correlation.high)})
            </p>
          )}

          <Scatter points={res.points} cuts={res.cuts} />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-amber-800 dark:text-amber-200">{COMPARE_DISCLAIMER}</p>
            <button className={btn} onClick={() => { const f = compareCsv(title, res); downloadText(f.name, f.text, "text/csv"); }}>
              <Download className="h-3 w-3" /> CSV اعداد
            </button>
          </div>
        </>
      )}
    </section>
  );
}

/** grade (0..20) against study hours on a square-root axis; dashed lines at the group borders */
function Scatter({ points, cuts }: { points: Point[]; cuts: [number, number] }) {
  const W = 600, H = 300, L = 36, R = 12, T = 10, B = 30;
  const maxH = Math.max(cuts[1] * 1.5, ...points.map((p) => p.h), 1);
  const x = (h: number) => L + (Math.sqrt(Math.max(0, h)) / Math.sqrt(maxH)) * (W - L - R);
  const y = (g: number) => T + (1 - Math.min(20, Math.max(0, g)) / 20) * (H - T - B);
  const ticks = [0, 1, 5, 10, 25, 50, 100, 200, 400, 800].filter((t) => t <= maxH);
  const keys: GroupKey[] = ["none", "low", "high"];
  return (
    <figure className="rounded-xl border border-border p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="نمودار پراکندگی نمره و ساعت مطالعه">
        {[0, 5, 10, 15, 20].map((g) => (
          <g key={g}>
            <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="currentColor" strokeOpacity={0.1} />
            <text x={L - 6} y={y(g) + 3} fontSize={10} textAnchor="end" fill="currentColor" opacity={0.6}>{fa(g, 0)}</text>
          </g>
        ))}
        {ticks.map((t) => (
          <text key={t} x={x(t)} y={H - B + 14} fontSize={10} textAnchor="middle" fill="currentColor" opacity={0.6}>{fa(t, 0)}</text>
        ))}
        {cuts.map((c) => <line key={c} x1={x(c)} x2={x(c)} y1={T} y2={H - B} stroke="currentColor" strokeOpacity={0.4} strokeDasharray="4 4" />)}
        {points.map((p, i) => <circle key={i} cx={x(p.h)} cy={y(p.g)} r={3.2} fill={GROUP_COLORS[p.k]} fillOpacity={0.7} />)}
        <text x={(L + W - R) / 2} y={H - 4} fontSize={10} textAnchor="middle" fill="currentColor" opacity={0.7}>ساعت مطالعه در ترم (محور جذری)</text>
      </svg>
      <figcaption className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span>محور عمودی: نمرهٔ نهایی از ۲۰</span>
        {keys.filter((k) => points.some((p) => p.k === k)).map((k) => (
          <span key={k} className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: GROUP_COLORS[k] }} />{GROUP_SHORT[k]}</span>
        ))}
      </figcaption>
    </figure>
  );
}
