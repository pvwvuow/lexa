"use client";
/* Phase 4/5/6/7 panels inside the centre page (docs/ORG_LEARNING.md):
 *  - OrgStudyCard    (phase 4): per-student active study time of the roster
 *  - OrgCompareTab   (phase 6): the comparison report with privacy rules
 *  - OrgApiKeysTab   (phase 5): API keys with HMAC signing (secret shown once)
 *  - OrgConnectorTab (phase 7): the read-only connector of the centre's own system */
import * as React from "react";
import {
  Activity, ArrowLeftRight, Copy, KeyRound, Link2, Loader2, PlayCircle, Plus, RefreshCw, ShieldCheck, Trash2,
} from "lucide-react";
import { MfaRequired } from "./MfaPanel";
import { classDisplayName, classList, listTerms, orgClassError, type ClassRow, type Term } from "@/lib/cloud-api/org-classes";
import { compareReport, fa, faHours, faShortHours, orgStudy, studyError, type CompareReport, type StudyPerson } from "@/lib/cloud-api/study";
import { HttpError, sbRpc } from "@/lib/cloud-api/rest";
import { supaUrl } from "@/lib/supabase-config";
import { sbAccessToken } from "@/lib/supabase";

const BTN = "inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold hover:border-bronze disabled:opacity-50";
const BTN_MAIN = "inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50";
const BTN_DANGER = "inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-background px-2.5 py-1.5 text-[11px] font-bold text-red-700 hover:border-red-500 disabled:opacity-50 dark:border-red-800 dark:text-red-300";
const INPUT = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-bronze";
const CARD = "rounded-2xl border border-border bg-card p-4 shadow-card";

const GROUP_LABELS: Record<string, string> = {
  inactive: "فعال‌نشده",
  low: "کم",
  high: "زیاد",
};

export const DISCLAIMER = "این مقایسه همبستگی است و به‌تنهایی اثر لکسا را ثابت نمی‌کند.";

/* ───────────────────────── phase 4: study card ───────────────────────── */
export function OrgStudyCard({ orgId }: { orgId: string }) {
  const [rows, setRows] = React.useState<StudyPerson[] | null>(null);
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setBusy(true);
    setErr("");
    try {
      setRows(await orgStudy(orgId));
    } catch (e) {
      setErr(studyError(e));
    } finally {
      setBusy(false);
    }
  }, [orgId]);
  React.useEffect(() => { void load(); }, [load]);

  const total = (rows ?? []).reduce((a, r) => a + r.seconds, 0);

  return (
    <MfaRequired>
      <section className={CARD}>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="flex flex-1 items-center gap-1.5 text-sm font-bold"><Activity className="h-4 w-4 text-bronze" /> زمان مطالعهٔ فعال دانشجویان (۳۰ روز گذشته)</h3>
          <button className={BTN} onClick={() => void load()} disabled={busy}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} تازه‌سازی</button>
        </div>
        {err && <p className="rounded-xl border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">{err}</p>}
        {rows && (
          <>
            <p className="mb-2 text-xs text-muted-foreground">
              مجموع ثبت‌شدهٔ همه: <b className="text-foreground">{faHours(total)}</b> · فقط زمانِ فعال شمرده می‌شود (صفحه جلوی چشم + فعالیت در ۲ دقیقهٔ آخر، سقف ۱۲ ساعت در روز).
            </p>
            {rows.length ? (
              <div className="max-h-80 overflow-auto rounded-xl border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                    <tr className="text-start text-muted-foreground">
                      <th className="p-2 text-start font-bold">دانشجو</th>
                      <th className="p-2 text-start font-bold">وضعیت</th>
                      <th className="p-2 text-start font-bold">روزها</th>
                      <th className="p-2 text-start font-bold">زمان فعال</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.student_id} className="border-t border-border">
                        <td className="p-2 font-bold">{r.full_name || r.org_username}</td>
                        <td className="p-2 text-muted-foreground">{r.status === "active" ? "فعال" : r.status === "graduated" ? "فارغ‌التحصیل" : r.status === "withdrawn" ? "انصرافی" : "معلق"}</td>
                        <td className="p-2 text-muted-foreground">{fa(r.days)}</td>
                        <td className="p-2 font-bold">{faShortHours(r.seconds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-xs text-muted-foreground">هنوز زمانی برای دانشجویان این مرکز ثبت نشده است.</p>}
          </>
        )}
      </section>
    </MfaRequired>
  );
}

/* ───────────────────────── phase 6: comparison report ───────────────────────── */
function Scatter({ points }: { points: CompareReport["scatter"] }) {
  const W = 460, H = 260, PAD = 34;
  const maxH = Math.max(1, ...points.map((p) => p.h));
  const maxG = Math.max(20, ...points.map((p) => p.g));
  const colors: Record<string, string> = { inactive: "#9ca3af", low: "#C08A3E", high: "#1D4B40" };
  const x = (h: number) => PAD + (h / maxH) * (W - PAD - 10);
  const y = (g: number) => H - PAD - (g / maxG) * (H - PAD - 12);
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[380px]" role="img" aria-label="نمودار پراکندگی زمان مطالعه و نمرهٔ نهایی">
        <line x1={PAD} y1={H - PAD} x2={W - 10} y2={H - PAD} className="stroke-border" />
        <line x1={PAD} y1={10} x2={PAD} y2={H - PAD} className="stroke-border" />
        <text x={W / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground" fontSize="10">ساعت مطالعهٔ فعال در ترم</text>
        <text x={12} y={H / 2} textAnchor="middle" transform={`rotate(-90 12 ${H / 2})`} className="fill-muted-foreground" fontSize="10">نمرهٔ نهایی (از ۲۰)</text>
        {points.map((p, i) => (
          <circle key={i} cx={x(p.h)} cy={y(p.g)} r="4" fill={colors[p.k] ?? "#888"} opacity="0.75">
            <title>{`${GROUP_LABELS[p.k] ?? p.k} — ${fa(p.h)} ساعت · نمرهٔ ${fa(p.g)}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        {Object.entries(GROUP_LABELS).map(([k, l]) => (
          <span key={k} className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: colors[k] }} /> {l}</span>
        ))}
      </div>
    </div>
  );
}

export function OrgCompareTab({ orgId }: { orgId: string }) {
  const [terms, setTerms] = React.useState<Term[]>([]);
  const [classes, setClasses] = React.useState<ClassRow[]>([]);
  const [termId, setTermId] = React.useState("");
  const [classId, setClassId] = React.useState("");
  const [inactive, setInactive] = React.useState("1");
  const [low, setLow] = React.useState("10");
  const [report, setReport] = React.useState<CompareReport | null>(null);
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    void (async () => {
      try {
        const [t, k] = await Promise.all([listTerms(orgId), classList(orgId)]);
        setTerms(t);
        setClasses(k);
        const cur = t.find((x) => x.status === "current");
        if (cur) setTermId(cur.id);
        const curClass = k.find((x) => x.termId === (cur?.id ?? ""));
        if (curClass) setClassId(curClass.id);
      } catch (e) {
        setErr(orgClassError(e));
      }
    })();
  }, [orgId]);

  const run = async () => {
    if (!termId || !classId) return;
    setBusy(true);
    setErr("");
    try {
      setReport(await compareReport(orgId, classId, termId, Number(inactive) || 1, Number(low) || 10));
    } catch (e) {
      setErr(orgClassError(e));
      setReport(null);
    } finally {
      setBusy(false);
    }
  };

  const classOfTerm = classes.filter((c) => c.termId === termId);

  return (
    <MfaRequired>
      <section className={`${CARD} space-y-3`}>
        <h3 className="flex items-center gap-1.5 text-sm font-bold"><ArrowLeftRight className="h-4 w-4 text-bronze" /> گزارش مقایسه (زمان مطالعه ↔ نمرهٔ نهایی)</h3>
        <p className="text-xs text-muted-foreground">
          دانشجوهای ثبت‌نام‌شدهٔ یک کلاس در یک ترم، فقط نمرهٔ نهایی، بدون کاربران آزاد. گروه‌های زیر ۱۰ نفر هرگز نمایش داده نمی‌شوند.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs">
            <span className="mb-1 block font-bold">ترم</span>
            <select className={INPUT} value={termId} onChange={(e) => { setTermId(e.target.value); setClassId(""); }}>
              <option value="">— انتخاب ترم —</option>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-bold">کلاس</span>
            <select className={INPUT} value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">— انتخاب کلاس —</option>
              {classOfTerm.map((c) => <option key={c.id} value={c.id}>{classDisplayName(c)}</option>)}
            </select>
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-bold">مرز «فعال‌نشده» (ساعت)</span>
            <input className={INPUT} type="number" min="0.1" max="24" step="0.1" value={inactive} onChange={(e) => setInactive(e.target.value)} />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-bold">مرز «زیاد» (ساعت)</span>
            <input className={INPUT} type="number" min="0.5" max="40" step="0.5" value={low} onChange={(e) => setLow(e.target.value)} />
          </label>
        </div>
        <button className={BTN_MAIN} onClick={() => void run()} disabled={busy || !termId || !classId}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />} محاسبهٔ گزارش
        </button>
        {err && <p className="rounded-xl border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">{err}</p>}

        {report && (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-muted-foreground">
              بازه: {new Date(`${report.window.from}T00:00:00`).toLocaleDateString("fa-IR")} تا {new Date(`${report.window.to}T00:00:00`).toLocaleDateString("fa-IR")} · {fa(report.n)} دانشجو · نمرهٔ نهایی {fa(report.with_final)} نفر
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {["inactive", "low", "high"].map((k) => {
                const g = report.groups.find((x) => x.key === k);
                return (
                  <div key={k} className="rounded-xl border border-border p-3 text-xs">
                    <p className="font-bold">{GROUP_LABELS[k]}{g ? ` — ${fa(g.n)} نفر` : ""}</p>
                    {!g || !g.shown ? (
                      <p className="mt-1 text-muted-foreground">{!g || g.n < 10 ? "زیر ۱۰ نفر — نمایش داده نمی‌شود" : "بدون نمره"}</p>
                    ) : (
                      <p className="mt-1">میانگین نمره: <b>{g.mean !== null ? fa(g.mean) : "—"}</b> · میانه: {g.median !== null ? fa(g.median) : "—"}</p>
                    )}
                  </div>
                );
              })}
            </div>
            {report.diff.shown ? (
              <div className="rounded-xl border border-border p-3 text-xs">
                <p className="font-bold">اختلاف میانگین (زیاد نسبت به بقیه)</p>
                <p className="mt-1">
                  {fa(report.diff.high_mean ?? 0)} در برابر {fa(report.diff.rest_mean ?? 0)} → اختلاف <b className="text-bronze">{fa(report.diff.diff ?? 0)}</b> نمره
                  (بازهٔ اطمینان ۹۵٪: {fa(report.diff.lo ?? 0)} تا {fa(report.diff.hi ?? 0)})
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">اختلاف گروه‌ها زمانی محاسبه می‌شود که هر دو گروه دست‌کم ۱۰ دانشجوی نمره‌دار داشته باشند.</p>
            )}
            {report.control.shown ? (
              <div className="rounded-xl border border-border p-3 text-xs">
                <p className="font-bold">نسخهٔ کنترل‌شده با معدل قبلی ({fa(report.control.n)} نفر)</p>
                <p className="mt-1">همبستگی خام: {fa(report.control.r_raw ?? 0)} · پس از کنترل معدل قبلی: <b>{fa(report.control.r_partial ?? 0)}</b></p>
              </div>
            ) : null}
            {report.scatter.length >= 5 && <div className="rounded-xl border border-border p-3"><Scatter points={report.scatter} /></div>}
            <p className="flex items-start gap-2 rounded-xl border border-dashed border-bronze/40 bg-bronze/5 p-3 text-xs font-bold text-bronze">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> {DISCLAIMER}
            </p>
          </div>
        )}
      </section>
    </MfaRequired>
  );
}

/* ───────────────────────── phase 5: API keys ───────────────────────── */
type ApiKeyRow = {
  id: string; name: string; prefix: string; scopes: string[]; ip_allowlist: string[];
  expires_at: string | null; last_used_at: string | null; revoked_at: string | null; created_at: string;
};

const faDateTime = (s: string | null) => (s ? new Date(s).toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" }) : "—");

export function OrgApiKeysTab({ orgId }: { orgId: string }) {
  const [rows, setRows] = React.useState<ApiKeyRow[] | null>(null);
  const [err, setErr] = React.useState("");
  const [msg, setMsg] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [name, setName] = React.useState("");
  const [read, setRead] = React.useState(true);
  const [write, setWrite] = React.useState(true);
  const [ips, setIps] = React.useState("");
  const [fresh, setFresh] = React.useState<{ name: string; key: string } | null>(null);
  const [copied, setCopied] = React.useState(false);

  const load = React.useCallback(async () => {
    setBusy(true);
    setErr("");
    try {
      setRows(await sbRpc<ApiKeyRow[]>("lexa_api_key_list", { o: orgId }));
    } catch (e) {
      setErr(orgClassError(e));
    } finally {
      setBusy(false);
    }
  }, [orgId]);
  React.useEffect(() => { void load(); }, [load]);

  const create = async () => {
    if (!name.trim()) { setErr("نام کلید را بنویسید."); return; }
    const scopes = [read ? "read" : "", write ? "write" : ""].filter(Boolean);
    if (!scopes.length) { setErr("دست‌کم یک دسترسی (خواندن یا نوشتن) انتخاب کنید."); return; }
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const list = ips.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
      const r = await sbRpc<{ id: string; prefix: string; key: string }[]>("lexa_api_key_create", { o: orgId, p_name: name.trim(), p_scopes: scopes, p_expires: null, p_ips: list });
      setFresh({ name: name.trim(), key: r?.[0]?.key ?? "" });
      setName(""); setIps("");
      void load();
    } catch (e) {
      setErr(orgClassError(e));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    if (!window.confirm("این کلید برای همیشه باطل می‌شود؛ ادامه می‌دهید؟")) return;
    setBusy(true);
    try {
      await sbRpc("lexa_api_key_revoke", { o: orgId, p_key: id });
      setMsg("کلید باطل شد.");
      void load();
    } catch (e) {
      setErr(orgClassError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <MfaRequired>
      <section className={`${CARD} space-y-3`}>
        <h3 className="flex items-center gap-1.5 text-sm font-bold"><KeyRound className="h-4 w-4 text-bronze" /> کلیدهای API (اتصال سازمان)</h3>
        <p className="text-xs leading-5 text-muted-foreground">
          با کلید API، سامانهٔ مرکز می‌تواند دانشجوها، کلاس‌ها، ثبت‌نام‌ها و نمره‌ها را به‌صورت گروهی بفرستد و گزارش بگیرد.
          هر درخواست باید امضای HMAC با مُهر زمان داشته باشد؛ راز کلید فقط یک بار نمایش داده می‌شود و در Vault ذخیره است.
          سند کامل: <code className="rounded bg-muted px-1">docs/ORG_API_OPENAPI.yaml</code>
        </p>

        <div className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-2">
          <label className="block text-xs">
            <span className="mb-1 block font-bold">نام کلید (مثلاً «سامانهٔ آموزشیار»)</span>
            <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-bold">محدودیت IP (اختیاری، با ویرگول)</span>
            <input className={INPUT} value={ips} onChange={(e) => setIps(e.target.value)} placeholder="185.10.2.4" dir="ltr" />
          </label>
          <div className="flex items-center gap-4 text-xs">
            <label className="inline-flex items-center gap-1.5 font-bold">
              <input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} /> خواندن گزارش‌ها
            </label>
            <label className="inline-flex items-center gap-1.5 font-bold">
              <input type="checkbox" checked={write} onChange={(e) => setWrite(e.target.checked)} /> ثبت گروهی داده
            </label>
          </div>
          <div className="flex items-end">
            <button className={BTN_MAIN} onClick={() => void create()} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} ساخت کلید</button>
          </div>
        </div>

        {fresh && (
          <div className="space-y-2 rounded-xl border border-bronze/50 bg-bronze/5 p-3 text-xs">
            <p className="font-bold">کلید «{fresh.name}» ساخته شد — این راز فقط همین یک بار نمایش داده می‌شود:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-lg bg-background p-2 text-[11px]" dir="ltr">{fresh.key}</code>
              <button className={BTN} onClick={() => { void navigator.clipboard?.writeText(fresh.key); setCopied(true); }}>
                <Copy className="h-3.5 w-3.5" /> {copied ? "کپی شد" : "کپی"}
              </button>
            </div>
            <button className={BTN} onClick={() => setFresh(null)}>نمایش را بستم</button>
          </div>
        )}

        {err && <p className="rounded-xl border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">{err}</p>}
        {msg && <p className="text-xs text-muted-foreground">{msg}</p>}

        {rows && (rows.length ? (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/80">
                <tr className="text-muted-foreground">
                  <th className="p-2 text-start font-bold">نام</th>
                  <th className="p-2 text-start font-bold">پیشوند</th>
                  <th className="p-2 text-start font-bold">دسترسی‌ها</th>
                  <th className="p-2 text-start font-bold">آخرین استفاده</th>
                  <th className="p-2 text-start font-bold">وضعیت</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((k) => (
                  <tr key={k.id} className="border-t border-border">
                    <td className="p-2 font-bold">{k.name}</td>
                    <td className="p-2 font-mono text-[11px]" dir="ltr">{k.prefix}_…</td>
                    <td className="p-2 text-muted-foreground">{k.scopes.map((s) => (s === "read" ? "خواندن" : "نوشتن")).join(" + ")}</td>
                    <td className="p-2 text-muted-foreground">{faDateTime(k.last_used_at)}</td>
                    <td className="p-2">{k.revoked_at ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300">باطل‌شده</span> : <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">فعال</span>}</td>
                    <td className="p-2 text-end">{!k.revoked_at && <button className={BTN_DANGER} onClick={() => void revoke(k.id)}><Trash2 className="h-3.5 w-3.5" /> باطل کردن</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-xs text-muted-foreground">هنوز کلیدی نساخته‌اید.</p>)}
      </section>
    </MfaRequired>
  );
}

/* ───────────────────────── phase 7: connector ───────────────────────── */
type IntegrationCfg = { base_url: string; username: string; schedule: string; enabled: boolean; has_password: boolean; last_status: string; last_run_at: string | null; updated_at: string | null };
type RunRow = { id: string; trigger: string; status: string; stats: Record<string, number>; message: string; started_at: string; finished_at: string | null };

const SCHEDULES: Record<string, string> = { manual: "دستی", hourly: "هر ساعت", "6h": "هر ۶ ساعت", daily: "روزانه" };

export function OrgConnectorTab({ orgId }: { orgId: string }) {
  const [cfg, setCfg] = React.useState<IntegrationCfg | null>(null);
  const [baseUrl, setBaseUrl] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [schedule, setSchedule] = React.useState("manual");
  const [enabled, setEnabled] = React.useState(true);
  const [runs, setRuns] = React.useState<RunRow[]>([]);
  const [err, setErr] = React.useState("");
  const [msg, setMsg] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setBusy(true);
    setErr("");
    try {
      const c = await sbRpc<IntegrationCfg>("lexa_integration_get", { o: orgId });
      setCfg(c);
      setBaseUrl(c.base_url || "");
      setUsername(c.username || "");
      setSchedule(c.schedule || "manual");
      setEnabled(c.enabled);
      const r = await sbRpc<RunRow[]>("lexa_integration_runs_list", { o: orgId, p_limit: 12 });
      setRuns(r ?? []);
    } catch (e) {
      setErr(e instanceof HttpError || e instanceof Error ? orgClassError(e) : "خطا");
    } finally {
      setBusy(false);
    }
  }, [orgId]);
  React.useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      await sbRpc("lexa_integration_save", { o: orgId, p_base_url: baseUrl.trim(), p_username: username.trim(), p_password: password || null, p_schedule: schedule, p_enabled: enabled });
      setPassword("");
      setMsg("پیکربندی اتصال ذخیره شد.");
      void load();
    } catch (e) {
      setErr(orgClassError(e));
    } finally {
      setBusy(false);
    }
  };

  const act = async (action: "ping" | "run") => {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const token = sbAccessToken();
      const res = await fetch(`${supaUrl()}/functions/v1/org-connector`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action, org: orgId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        setErr(action === "ping" ? "اتصال آزمایشی ناموفق بود." : "اجرای کانکتور ناموفق بود.");
        if (body.error) setErr((p) => `${p} (${body.error})`);
      } else if (action === "ping") {
        setMsg("اتصال آزمایشی موفق بود.");
      } else {
        const s = body.stats as Record<string, number> | undefined;
        setMsg(s ? `اجرای کامل شد — دانشجو ${fa(s.students ?? 0)}، مدرس ${fa(s.staff ?? 0)}، کلاس ${fa(s.classes ?? 0)}، ثبت‌نام ${fa(s.enrollments ?? 0)}، نمره ${fa(s.grades ?? 0)}${s.errors ? ` · خطاها: ${fa(s.errors)}` : ""}` : "اجرای کامل شد.");
      }
      void load();
    } catch {
      setErr("اتصال به Lexa برقرار نشد.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <MfaRequired>
      <section className={`${CARD} space-y-3`}>
        <h3 className="flex items-center gap-1.5 text-sm font-bold"><Link2 className="h-4 w-4 text-bronze" /> اتصال سازمان (کانکتور فقط‌خواندنی)</h3>
        <p className="text-xs leading-5 text-muted-foreground">
          نشانی سامانهٔ خودتان را بدهید؛ Lexa با حساب فقط‌خواندنی که تعیین می‌کنید همان شکل دادهٔ API (دانشجو، مدرس، کلاس، ثبت‌نام، نمره) را می‌خواند و با تطبیق
          شناسهٔ بیرونی/نام کاربری به‌روزرسانی می‌کند. رمز فقط در Vault ذخیره می‌شود و هر اجرا در گزارش پایین ثبت می‌گردد.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs sm:col-span-2">
            <span className="mb-1 block font-bold">نشانی HTTPS خوراک JSON</span>
            <input className={INPUT} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://uni.example.edu/lexa-feed.json" dir="ltr" />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-bold">نام کاربری فقط‌خواندنی</span>
            <input className={INPUT} value={username} onChange={(e) => setUsername(e.target.value)} dir="ltr" />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-bold">رمز {cfg?.has_password ? "(برای تغییر، جدید را بنویسید)" : ""}</span>
            <input className={INPUT} type="password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-bold">زمان‌بندی</span>
            <select className={INPUT} value={schedule} onChange={(e) => setSchedule(e.target.value)}>
              {Object.entries(SCHEDULES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <div className="flex items-end gap-3">
            <label className="inline-flex items-center gap-1.5 text-xs font-bold">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> فعال
            </label>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={BTN_MAIN} onClick={() => void save()} disabled={busy || !baseUrl.trim()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} ذخیرهٔ پیکربندی</button>
          <button className={BTN} onClick={() => void act("ping")} disabled={busy || !cfg?.has_password}><PlayCircle className="h-3.5 w-3.5" /> اتصال آزمایشی</button>
          <button className={BTN} onClick={() => void act("run")} disabled={busy || !cfg?.has_password}><RefreshCw className="h-3.5 w-3.5" /> اجرای هم‌اکنون</button>
        </div>
        {err && <p className="rounded-xl border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">{err}</p>}
        {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
        {cfg && <p className="text-[11px] text-muted-foreground">وضعیت آخرین اجرا: {cfg.last_status === "ok" ? "موفق" : cfg.last_status === "failed" ? "ناموفق" : cfg.last_status === "running" ? "در حال اجرا" : "هنوز اجرا نشده"}{cfg.last_run_at ? ` — ${faDateTime(cfg.last_run_at)}` : ""}</p>}

        {runs.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/80">
                <tr className="text-muted-foreground">
                  <th className="p-2 text-start font-bold">زمان</th>
                  <th className="p-2 text-start font-bold">وضعیت</th>
                  <th className="p-2 text-start font-bold">نتیجه</th>
                  <th className="p-2 text-start font-bold">پیام</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-2 text-muted-foreground">{faDateTime(r.started_at)}</td>
                    <td className="p-2">{r.status === "ok" ? <span className="font-bold text-emerald-600 dark:text-emerald-400">موفق</span> : r.status === "failed" ? <span className="font-bold text-red-600 dark:text-red-400">ناموفق</span> : "در حال اجرا"}</td>
                    <td className="p-2 text-muted-foreground">{r.stats?.students !== undefined ? `دانشجو ${fa(r.stats.students)} · کلاس ${fa(r.stats.classes ?? 0)} · نمره ${fa(r.stats.grades ?? 0)}` : (r.stats?.http ? `HTTP ${fa(r.stats.http)}` : "—")}</td>
                    <td className="p-2 text-muted-foreground">{r.message || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </MfaRequired>
  );
}
