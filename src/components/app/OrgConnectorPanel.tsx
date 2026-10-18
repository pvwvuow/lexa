"use client";
/* "Connector" tab of a centre (phase 7): Lexa reads the centre's own server (JSON or CSV over HTTPS)
 * with a read-only credential kept in Supabase Vault, on a schedule, with a run log.
 * Owner / manager / Lexa admin with a two-factor session. */
import * as React from "react";
import { FlaskConical, KeyRound, Play, Plug, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import {
  CONN_RESOURCES, codeLabel, connectorError, deleteIntegration, emptyConfig, integrationRuns, listIntegrations,
  rekeyIntegration, runIntegration, RUN_STATUS, saveIntegration, SCHEDULE_LABELS, setIntegrationSecret, testIntegration,
  type ConnConfig, type ConnRes, type ConnRun, type Integration, type TestResult,
} from "@/lib/cloud-api/org-connector";

const btn = "inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted disabled:opacity-50";
const btnMain = "inline-flex items-center gap-1 rounded-xl bg-bronze px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50";
const input = "rounded-xl border border-border bg-background px-2 py-1 text-xs";
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short" }) : "-");
const fa = (n: number) => n.toLocaleString("fa-IR");
const RES_LABEL = Object.fromEntries(CONN_RESOURCES.map((r) => [r.key, r.label])) as Record<string, string>;
const RESULT_LABELS: Record<string, string> = {
  created: "ساخته شد", updated: "به‌روز شد", same: "بدون تغییر", saved: "ثبت شد", skipped: "خالی", exists: "از قبل بود",
  code: "کد فعال‌سازی", invalid: "ردیف نامعتبر", checked: "بررسی شد", not_in_lexa_skipped: "در Lexa نبود (رد شد)",
  left_for_next_run: "برای اجرای بعد", error: "خطا",
};

function ErrorLine({ text }: { text: string }) {
  return text ? <p className="rounded-xl border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/30">{text}</p> : null;
}

export function OrgConnectorPanel({ orgId }: { orgId: string }) {
  const [list, setList] = React.useState<Integration[]>([]);
  const [runs, setRuns] = React.useState<ConnRun[]>([]);
  const [edit, setEdit] = React.useState<{ id: string | null; cfg: ConnConfig; hasSecret: boolean; keyOk: boolean } | null>(null);
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setErr("");
    try {
      const [l, r] = await Promise.all([listIntegrations(orgId), integrationRuns(orgId, null, 30)]);
      setList(l);
      setRuns(r);
    } catch (e) {
      setErr(connectorError(e));
    }
  }, [orgId]);
  React.useEffect(() => { void load(); }, [load]);

  const open = (x: Integration | null) => {
    if (!x) { setEdit({ id: null, cfg: emptyConfig(), hasSecret: false, keyOk: true }); return; }
    const { id, hasSecret, keyOk, nextRunAt: _n, lastRunAt: _l, lastStatus: _s, ...cfg } = x;
    void _n; void _l; void _s;
    setEdit({ id, cfg: { ...emptyConfig(), ...cfg, options: { ...emptyConfig().options, ...cfg.options } }, hasSecret, keyOk });
  };

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex flex-1 items-center gap-1 text-sm font-bold"><Plug className="h-4 w-4" /> کانکتور (خواندن از سامانهٔ مرکز)</h3>
        <button className={btn} onClick={() => void load()} disabled={busy}><RefreshCw className="h-3.5 w-3.5" /></button>
        <button className={btnMain} onClick={() => open(null)} disabled={list.length >= 5}><Plus className="h-3.5 w-3.5" /> اتصال تازه</button>
      </div>
      <p className="rounded-xl border border-border p-3 text-xs leading-6">
        Lexa به‌صورت زمان‌بندی‌شده از سرور مرکز (JSON یا CSV روی HTTPS) فقط فیلدهایی را که تطبیق می‌دهید می‌خواند.
        برای سامانهٔ مرکز یک حساب <b>فقط‌خواندنی</b> بسازید؛ رمز یا توکن آن رمزنگاری‌شده در Supabase Vault می‌ماند و دیگر نمایش داده نمی‌شود.
        حساب‌های تازه رمز تصادفی می‌گیرند؛ کارت ورود را از بخش دانشجوها (بازنشانی رمز) چاپ کنید. راهنمای سرور مرکز: <span dir="ltr">docs/ORG_CONNECTOR.md</span>.
      </p>
      <ErrorLine text={err} />

      {edit ? (
        <Editor orgId={orgId} state={edit} busy={busy} setBusy={setBusy} onError={setErr}
          onClose={() => { setEdit(null); void load(); }} onSaved={(id) => { setEdit((s) => (s ? { ...s, id } : s)); void load(); }} />
      ) : (
        <ul className="space-y-2">
          {!list.length && <li className="text-xs text-muted-foreground">هنوز اتصالی ساخته نشده است.</li>}
          {list.map((x) => (
            <li key={x.id} className={`space-y-1 rounded-xl border border-border p-3 text-xs ${x.enabled ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{x.name}</span>
                <code className="text-[11px] text-muted-foreground" dir="ltr">{x.base_url}</code>
                <span className="flex-1" />
                <button className={btn} onClick={() => open(x)}>تنظیمات</button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {SCHEDULE_LABELS[x.schedule]}{x.schedule !== "manual" && x.schedule !== "hourly" ? ` ساعت ${fa(x.run_hour)}` : ""}
                {" · "}بخش‌ها: {Object.entries(x.resources).filter(([, r]) => r && r.enabled !== false).map(([k]) => RES_LABEL[k]).join("، ") || "-"}
                {" · "}آخرین اجرا: {when(x.lastRunAt)} {x.lastStatus ? `(${RUN_STATUS[x.lastStatus] ?? x.lastStatus})` : ""}
                {x.enabled && x.schedule !== "manual" ? ` · اجرای بعد: ${when(x.nextRunAt)}` : ""}
              </p>
              {x.auth_kind !== "none" && !x.hasSecret && <p className="text-[11px] text-red-700">رمز یا توکن دسترسی ذخیره نشده است.</p>}
              {!x.keyOk && <p className="text-[11px] text-red-700">کلید داخلی این اتصال باطل شده؛ در تنظیمات «کلید تازه» را بزنید.</p>}
            </li>
          ))}
        </ul>
      )}

      <RunLog runs={edit?.id ? runs.filter((r) => r.integrationId === edit.id) : runs} />
    </div>
  );
}

function Editor({ orgId, state, busy, setBusy, onError, onClose, onSaved }: {
  orgId: string;
  state: { id: string | null; cfg: ConnConfig; hasSecret: boolean; keyOk: boolean };
  busy: boolean;
  setBusy: (b: boolean) => void;
  onError: (m: string) => void;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [cfg, setCfg] = React.useState<ConnConfig>(state.cfg);
  const [secret, setSecret] = React.useState("");
  const [test, setTest] = React.useState<TestResult | null>(null);
  const [note, setNote] = React.useState("");
  const id = state.id;
  const set = (p: Partial<ConnConfig>) => setCfg((c) => ({ ...c, ...p }));
  const setOpt = (p: Partial<ConnConfig["options"]>) => setCfg((c) => ({ ...c, options: { ...c.options, ...p } }));
  const setRes = (k: ConnRes, p: Partial<NonNullable<ConnConfig["resources"][ConnRes]>>) =>
    setCfg((c) => ({ ...c, resources: { ...c.resources, [k]: { ...(c.resources[k] ?? { enabled: true, map: {} }), ...p } } }));

  const act = async (f: () => Promise<void>) => {
    setBusy(true); onError(""); setNote("");
    try { await f(); } catch (e) { onError(connectorError(e)); } finally { setBusy(false); }
  };
  const save = () => act(async () => {
    const newId = await saveIntegration(orgId, id, cfg);
    if (secret) { await setIntegrationSecret(newId, secret); setSecret(""); }
    onSaved(newId);
    setNote("ذخیره شد.");
  });
  const fieldsOf = (k: ConnRes) => test?.resources[k]?.fields ?? [];

  return (
    <section className="space-y-4 rounded-xl border border-border p-3 text-xs">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1"><span className="font-bold">نام</span>
          <input className={`${input} w-full`} maxLength={60} value={cfg.name} onChange={(e) => set({ name: e.target.value })} placeholder="مثلاً سامانهٔ آموزش" />
        </label>
        <label className="space-y-1"><span className="font-bold">نشانی پایه (HTTPS)</span>
          <input className={`${input} w-full`} dir="ltr" value={cfg.base_url} onChange={(e) => set({ base_url: e.target.value.trim() })} placeholder="https://edu.example.ac.ir/lexa" />
        </label>
        <label className="space-y-1"><span className="font-bold">قالب پاسخ</span>
          <select className={`${input} w-full`} value={cfg.kind} onChange={(e) => set({ kind: e.target.value as ConnConfig["kind"] })}>
            <option value="rest_json">JSON</option><option value="csv_url">CSV</option>
          </select>
        </label>
        <label className="space-y-1"><span className="font-bold">ورود به سرور مرکز</span>
          <select className={`${input} w-full`} value={cfg.auth_kind} onChange={(e) => set({ auth_kind: e.target.value as ConnConfig["auth_kind"] })}>
            <option value="bearer">توکن (Bearer)</option><option value="basic">نام کاربری و رمز (Basic)</option>
            <option value="header">سربرگ دلخواه</option><option value="none">بدون ورود</option>
          </select>
        </label>
        {(cfg.auth_kind === "basic" || cfg.auth_kind === "header") && (
          <label className="space-y-1"><span className="font-bold">{cfg.auth_kind === "basic" ? "نام کاربری فقط‌خواندنی" : "نام سربرگ (مثلاً X-Api-Key)"}</span>
            <input className={`${input} w-full`} dir="ltr" value={cfg.auth_user} onChange={(e) => set({ auth_user: e.target.value.trim() })} />
          </label>
        )}
        {cfg.auth_kind !== "none" && (
          <label className="space-y-1"><span className="font-bold">{state.hasSecret ? "رمز / توکن (ذخیره شده؛ برای عوض کردن بنویسید)" : "رمز / توکن"}</span>
            <input className={`${input} w-full`} dir="ltr" type="password" autoComplete="new-password" value={secret} onChange={(e) => setSecret(e.target.value)} />
          </label>
        )}
        <label className="space-y-1"><span className="font-bold">زمان‌بندی</span>
          <div className="flex gap-2">
            <select className={input} value={cfg.schedule} onChange={(e) => set({ schedule: e.target.value as ConnConfig["schedule"] })}>
              {Object.entries(SCHEDULE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {(cfg.schedule === "daily" || cfg.schedule === "weekly") && (
              <select className={input} value={cfg.run_hour} onChange={(e) => set({ run_hour: Number(e.target.value) })}>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>ساعت {fa(h)}</option>)}
              </select>
            )}
          </div>
        </label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.enabled} onChange={(e) => set({ enabled: e.target.checked })} /> فعال</label>
      </div>

      <details className="rounded-xl border border-border p-2">
        <summary className="cursor-pointer font-bold">تنظیمات بیشتر</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {cfg.kind === "rest_json" ? (
            <>
              <label className="space-y-1"><span>صفحه‌بندی</span>
                <select className={`${input} w-full`} value={cfg.options.pagination ?? "none"} onChange={(e) => setOpt({ pagination: e.target.value as "none" | "page" | "offset" })}>
                  <option value="none">ندارد</option><option value="page">شمارهٔ صفحه (page=1,2,…)</option><option value="offset">offset و limit</option>
                </select>
              </label>
              {cfg.options.pagination && cfg.options.pagination !== "none" && (
                <>
                  <label className="space-y-1"><span>اندازهٔ صفحه</span>
                    <input className={`${input} w-full`} type="number" min={1} max={5000} value={cfg.options.page_size ?? 500} onChange={(e) => setOpt({ page_size: Number(e.target.value) })} />
                  </label>
                  <label className="space-y-1"><span>نام پارامتر صفحه / offset</span>
                    <input className={`${input} w-full`} dir="ltr" value={cfg.options.page_param ?? ""} placeholder={cfg.options.pagination === "page" ? "page" : "offset"} onChange={(e) => setOpt({ page_param: e.target.value.trim() })} />
                  </label>
                  <label className="space-y-1"><span>نام پارامتر اندازه</span>
                    <input className={`${input} w-full`} dir="ltr" value={cfg.options.size_param ?? ""} placeholder={cfg.options.pagination === "page" ? "per_page" : "limit"} onChange={(e) => setOpt({ size_param: e.target.value.trim() })} />
                  </label>
                </>
              )}
            </>
          ) : (
            <label className="space-y-1"><span>جداکننده</span>
              <select className={`${input} w-full`} value={cfg.options.csv_delimiter ?? ","} onChange={(e) => setOpt({ csv_delimiter: e.target.value })}>
                <option value=",">کاما</option><option value=";">نقطه‌ویرگول</option><option value={"\t"}>Tab</option>
              </select>
            </label>
          )}
          <label className="space-y-1"><span>تاریخ‌ها</span>
            <select className={`${input} w-full`} value={cfg.options.date_format ?? "jalali"} onChange={(e) => setOpt({ date_format: e.target.value as "jalali" | "gregorian" })}>
              <option value="jalali">شمسی (۱۴۰۴/۰۷/۰۱)</option><option value="gregorian">میلادی (2025-09-23)</option>
            </select>
          </label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.options.create_students !== false} onChange={(e) => setOpt({ create_students: e.target.checked })} /> دانشجوی تازه حساب بگیرد</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={!!cfg.options.status_sync} onChange={(e) => setOpt({ status_sync: e.target.checked })} /> وضعیت دانشجو (تعلیق، فارغ‌التحصیلی، …) هم به‌روز شود</label>
          {cfg.options.status_sync && (
            <label className="space-y-1"><span>دسترسی بعد از خروج</span>
              <select className={`${input} w-full`} value={cfg.options.exit_access ?? "open"} onChange={(e) => setOpt({ exit_access: e.target.value as "open" | "limited" })}>
                <option value="open">باز بماند</option><option value="limited">فقط محتوای عمومی</option>
              </select>
            </label>
          )}
        </div>
      </details>

      <div className="space-y-2">
        <p className="font-bold">چه چیزی خوانده شود (فقط فیلدهای تطبیق‌داده‌شده)</p>
        {CONN_RESOURCES.map((r) => {
          const rc = cfg.resources[r.key];
          const on = !!rc && rc.enabled !== false;
          const t = test?.resources[r.key];
          return (
            <div key={r.key} className="rounded-xl border border-border p-2">
              <label className="flex items-center gap-2 font-bold">
                <input type="checkbox" checked={on} onChange={(e) => setRes(r.key, { enabled: e.target.checked })} /> {r.label}
                {t && (t.error ? <span className="font-normal text-red-700">{codeLabel(t.error)}</span>
                  : <span className="font-normal text-muted-foreground">{fa(t.rows ?? 0)} ردیف در صفحهٔ اول</span>)}
              </label>
              {on && (
                <div className="mt-2 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="space-y-1"><span>مسیر</span>
                      <input className={`${input} w-full`} dir="ltr" value={rc?.path ?? ""} placeholder={`/${r.key}`} onChange={(e) => setRes(r.key, { path: e.target.value.trim() })} />
                    </label>
                    {cfg.kind === "rest_json" && (
                      <label className="space-y-1"><span>کلید فهرست در پاسخ (اختیاری)</span>
                        <input className={`${input} w-full`} dir="ltr" value={rc?.list_key ?? ""} placeholder="data" onChange={(e) => setRes(r.key, { list_key: e.target.value.trim() })} />
                      </label>
                    )}
                  </div>
                  <datalist id={`conn-f-${r.key}`}>{fieldsOf(r.key).map((f) => <option key={f} value={f} />)}</datalist>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {r.fields.map((f) => (
                      <label key={f.key} className="flex items-center gap-2">
                        <span className="w-40 shrink-0">{f.label}{f.required ? " *" : ""}</span>
                        <input className={`${input} min-w-0 flex-1`} dir="ltr" list={`conn-f-${r.key}`} value={rc?.map?.[f.key] ?? ""}
                          placeholder="نام فیلد در سرور مرکز"
                          onChange={(e) => setRes(r.key, { map: { ...(rc?.map ?? {}), [f.key]: e.target.value.trim() } })} />
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {note && <p className="text-xs text-emerald-700">{note}</p>}
      <div className="flex flex-wrap gap-2">
        <button className={btnMain} disabled={busy || !cfg.name.trim()} onClick={() => void save()}><Save className="h-3.5 w-3.5" /> ذخیره</button>
        {id && (
          <>
            <button className={btn} disabled={busy} onClick={() => void act(async () => { setTest(await testIntegration(orgId, id)); setNote("فقط نام فیلدها و تعداد ردیف‌ها خوانده شد؛ هیچ مقداری نمایش داده یا ذخیره نشد."); })}>
              <FlaskConical className="h-3.5 w-3.5" /> آزمایش اتصال
            </button>
            <button className={btn} disabled={busy} onClick={() => void act(async () => { const r = await runIntegration(orgId, id, true); setNote(`اجرای آزمایشی: ${RUN_STATUS[r.status] ?? r.status}؛ چیزی ذخیره نشد. جزئیات در گزارش اجرا.`); onSaved(id); })}>
              <FlaskConical className="h-3.5 w-3.5" /> اجرای آزمایشی
            </button>
            <button className={btn} disabled={busy} onClick={() => void act(async () => {
              if (!window.confirm("همین حالا از سرور مرکز خوانده و در Lexa ثبت شود؟")) return;
              const r = await runIntegration(orgId, id, false); setNote(`اجرا: ${RUN_STATUS[r.status] ?? r.status}.`); onSaved(id);
            })}>
              <Play className="h-3.5 w-3.5" /> اجرای الان
            </button>
            {!state.keyOk && (
              <button className={btn} disabled={busy} onClick={() => void act(async () => { await rekeyIntegration(id); setNote("کلید داخلی تازه ساخته شد."); onSaved(id); })}>
                <KeyRound className="h-3.5 w-3.5" /> کلید تازه
              </button>
            )}
            <button className={`${btn} text-red-700`} disabled={busy} onClick={() => void act(async () => {
              if (!window.confirm(`اتصال «${cfg.name}» حذف شود؟ رمز ذخیره‌شده و کلید داخلی آن هم پاک می‌شوند؛ داده‌های واردشده می‌مانند.`)) return;
              await deleteIntegration(id); onClose();
            })}>
              <Trash2 className="h-3.5 w-3.5" /> حذف
            </button>
          </>
        )}
        <button className={btn} onClick={onClose}>بستن</button>
      </div>
    </section>
  );
}

function RunLog({ runs }: { runs: ConnRun[] }) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-bold">گزارش اجرا</h4>
      <p className="text-[11px] text-muted-foreground">فقط تعدادها و کد خطا با شمارهٔ ردیف؛ هیچ نام، نمره یا رمزی ثبت نمی‌شود.</p>
      {!runs.length && <p className="text-xs text-muted-foreground">هنوز اجرایی نبوده است.</p>}
      <ul className="space-y-2">
        {runs.map((r) => (
          <li key={r.id} className="rounded-xl border border-border p-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`font-bold ${r.status === "failed" ? "text-red-700" : r.status === "partial" ? "text-amber-700" : ""}`}>{RUN_STATUS[r.status] ?? r.status}</span>
              <span>{r.integrationName}</span>
              {r.dry && <span className="rounded bg-amber-100 px-1.5 text-[10px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">آزمایشی</span>}
              <span className="text-muted-foreground">{r.via === "schedule" ? "زمان‌بندی" : r.startedByName || "دستی"} · {when(r.startedAt)}</span>
            </div>
            {r.message && <p className="text-red-700">{codeLabel(r.message)}</p>}
            {Object.entries(r.counts).map(([k, c]) => (
              <p key={k} className="text-[11px]">
                <b>{RES_LABEL[k] ?? (k === "status" ? "وضعیت دانشجو" : k)}:</b> {fa(c.fetched)} خوانده، {fa(c.mapped)} معتبر
                {Object.entries(c.results).map(([rk, n]) => ` · ${RESULT_LABELS[rk] ?? codeLabel(rk)} ${fa(n)}`).join("")}
                {c.error ? <span className="text-red-700"> · {codeLabel(c.error)}</span> : null}
              </p>
            ))}
            {r.errors.length > 0 && (
              <details className="text-[11px]">
                <summary className="cursor-pointer">{fa(r.errors.length)} خطای ردیف</summary>
                <ul className="mt-1 list-inside list-disc" dir="ltr">
                  {r.errors.map((e, i) => <li key={i}>{e.r} #{e.row}: {e.e}</li>)}
                </ul>
              </details>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
