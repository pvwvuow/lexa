"use client";
/* "API" tab of a centre (phase 5): keys for the centre's own systems, shown once, plus the
 * request log. Owner / manager / Lexa admin with a two-factor session. */
import * as React from "react";
import { Copy, KeyRound, Plus, RefreshCw, RotateCw, Trash2 } from "lucide-react";
import {
  API_SCOPES, apiBaseUrl, apiLog, createApiKey, keyLabel, keyState, listApiKeys, orgApiError, revokeApiKey, rotateApiKey,
  scopeLabel, type ApiKeyRow, type ApiLogRow, type NewApiKey,
} from "@/lib/cloud-api/org-api";

const btn = "inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted disabled:opacity-50";
const btnMain = "inline-flex items-center gap-1 rounded-xl bg-bronze px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50";
const input = "rounded-xl border border-border bg-background px-2 py-1 text-xs";
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short" }) : "-");
const STATE_LABEL = { active: "فعال", revoked: "باطل‌شده", expired: "منقضی" } as const;

function CopyButton({ text, label = "کپی" }: { text: string; label?: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <button className={btn} onClick={() => { void navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }); }}>
      <Copy className="h-3.5 w-3.5" /> {done ? "کپی شد" : label}
    </button>
  );
}

export function OrgApiPanel({ orgId }: { orgId: string }) {
  const [keys, setKeys] = React.useState<ApiKeyRow[]>([]);
  const [log, setLog] = React.useState<ApiLogRow[]>([]);
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [fresh, setFresh] = React.useState<NewApiKey | null>(null);
  const [showForm, setShowForm] = React.useState(false);

  const load = React.useCallback(async () => {
    setBusy(true);
    setErr("");
    try {
      const [k, l] = await Promise.all([listApiKeys(orgId), apiLog(orgId, 200)]);
      setKeys(k);
      setLog(l);
    } catch (e) {
      setErr(orgApiError(e));
    } finally {
      setBusy(false);
    }
  }, [orgId]);
  React.useEffect(() => { void load(); }, [load]);

  const revoke = async (k: ApiKeyRow) => {
    if (!window.confirm(`کلید «${k.name}» همین حالا باطل شود؟ سامانه‌ای که با آن کار می‌کند دیگر به Lexa دسترسی ندارد.`)) return;
    try { await revokeApiKey(k.id); void load(); } catch (e) { setErr(orgApiError(e)); }
  };
  const rotate = async (k: ApiKeyRow) => {
    if (!window.confirm(`برای «${k.name}» کلید تازه ساخته شود؟ کلید فعلی ۲۴ ساعت دیگر از کار می‌افتد؛ در این فاصله کلید تازه را در سامانهٔ خود بگذارید.`)) return;
    try { setFresh(await rotateApiKey(orgId, k.id, 24)); void load(); } catch (e) { setErr(orgApiError(e)); }
  };

  const base = apiBaseUrl();
  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex flex-1 items-center gap-1 text-sm font-bold"><KeyRound className="h-4 w-4" /> API لکسا</h3>
        <button className={btn} onClick={() => void load()} disabled={busy}><RefreshCw className="h-3.5 w-3.5" /></button>
        <button className={btnMain} onClick={() => { setShowForm((v) => !v); setFresh(null); }}><Plus className="h-3.5 w-3.5" /> کلید تازه</button>
      </div>
      <section className="space-y-2 rounded-xl border border-border p-3 text-xs">
        <p>
          سامانهٔ آموزشی مرکز می‌تواند دانشجوها، مدرسان، کلاس‌ها، ثبت‌نام‌ها و نمره‌ها را به‌صورت گروهی به Lexa بفرستد و گزارش بگیرد.
          هر درخواست با کلید امضا می‌شود و خود کلید هرگز فرستاده نمی‌شود. راهنمای کامل برای برنامه‌نویس سامانه: <span dir="ltr">docs/ORG_API.md</span>.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">نشانی پایه:</span>
          <code className="rounded bg-muted px-2 py-1" dir="ltr">{base}</code>
          <CopyButton text={base} />
          <CopyButton text={`${base}/v1/openapi.json`} label="نشانی OpenAPI" />
        </div>
        <p className="text-muted-foreground">کلید «آزمایشی» (sandbox) همه چیز را بررسی می‌کند و نتیجه را برمی‌گرداند ولی چیزی ذخیره نمی‌کند؛ اول با آن آزمایش کنید.</p>
      </section>

      {err && <p className="rounded-xl border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/30">{err}</p>}
      {fresh && <FreshKey k={fresh} onClose={() => setFresh(null)} />}
      {showForm && !fresh && (
        <NewKeyForm orgId={orgId} onDone={(k) => { setFresh(k); setShowForm(false); void load(); }} onError={setErr} />
      )}

      <section className="space-y-2">
        <h4 className="text-xs font-bold">کلیدها</h4>
        {!keys.length && <p className="text-xs text-muted-foreground">هنوز کلیدی ساخته نشده است.</p>}
        <ul className="space-y-2">
          {keys.map((k) => {
            const st = keyState(k);
            return (
              <li key={k.id} className={`space-y-1 rounded-xl border border-border p-3 text-xs ${st !== "active" ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{k.name}</span>
                  {k.sandbox && <span className="rounded bg-amber-100 px-1.5 text-[10px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">آزمایشی</span>}
                  <span className="rounded bg-muted px-1.5 text-[10px]">{STATE_LABEL[st]}</span>
                  <span className="flex-1" />
                  {st === "active" && <button className={btn} onClick={() => void rotate(k)}><RotateCw className="h-3.5 w-3.5" /> کلید تازه به‌جای این</button>}
                  {st === "active" && <button className={`${btn} text-red-700`} onClick={() => void revoke(k)}><Trash2 className="h-3.5 w-3.5" /> باطل کردن</button>}
                </div>
                <code className="block text-[11px] text-muted-foreground" dir="ltr">{keyLabel(k)}{k.hint ? `  ·  #${k.hint}` : ""}</code>
                <div className="flex flex-wrap gap-1">{k.scopes.map((s) => <span key={s} className="rounded bg-muted px-1.5 text-[10px]">{scopeLabel(s)}</span>)}</div>
                <p className="text-[11px] text-muted-foreground">
                  ساخته‌شده {when(k.createdAt)}{k.createdByName ? ` توسط ${k.createdByName}` : ""} · آخرین استفاده {when(k.lastUsedAt)} · انقضا {k.expiresAt ? when(k.expiresAt) : "ندارد"}
                  {k.allowedIps.length > 0 && <> · فقط از <span dir="ltr">{k.allowedIps.join(", ")}</span></>}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-2">
        <h4 className="text-xs font-bold">آخرین درخواست‌ها</h4>
        <p className="text-[11px] text-muted-foreground">بدنهٔ درخواست‌ها، رمزها و دادهٔ شخصی ثبت نمی‌شود؛ فقط مسیر، نتیجه و تعداد ردیف‌ها.</p>
        {!log.length && <p className="text-xs text-muted-foreground">هنوز درخواستی نرسیده است.</p>}
        {log.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="p-2 text-start">زمان</th><th className="p-2 text-start">کلید</th><th className="p-2 text-start">درخواست</th>
                  <th className="p-2 text-start">نتیجه</th><th className="p-2 text-start">ردیف</th><th className="p-2 text-start">مدت</th>
                </tr>
              </thead>
              <tbody>
                {log.map((l, i) => (
                  <tr key={`${l.at}-${i}`} className="border-t border-border">
                    <td className="p-2">{when(l.at)}</td>
                    <td className="p-2">{l.keyName}{l.sandbox ? " (آزمایشی)" : ""}</td>
                    <td className="p-2" dir="ltr">{l.method} {l.path}</td>
                    <td className={`p-2 ${l.status >= 400 ? "text-red-700" : ""}`} dir="ltr">{l.status}{l.error ? ` ${l.error}` : ""}</td>
                    <td className="p-2">{l.rows.toLocaleString("fa-IR")}</td>
                    <td className="p-2" dir="ltr">{l.ms} ms</td>
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

function NewKeyForm({ orgId, onDone, onError }: { orgId: string; onDone: (k: NewApiKey) => void; onError: (m: string) => void }) {
  const [name, setName] = React.useState("");
  const [scopes, setScopes] = React.useState<string[]>(["reports:read"]);
  const [sandbox, setSandbox] = React.useState(true);
  const [days, setDays] = React.useState("365");
  const [ips, setIps] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const toggle = (s: string) => setScopes((v) => (v.includes(s) ? v.filter((x) => x !== s) : [...v, s]));
  const submit = async () => {
    setBusy(true);
    onError("");
    try {
      const list = ips.split(/[\s,،]+/).map((x) => x.trim()).filter(Boolean);
      onDone(await createApiKey(orgId, { name: name.trim(), scopes, ips: list, days: days ? Number(days) : null, sandbox }));
    } catch (e) {
      onError(orgApiError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-3 rounded-xl border border-border p-3 text-xs">
      <label className="block space-y-1">
        <span className="font-bold">نام کلید</span>
        <input className={`${input} w-full`} value={name} maxLength={60} placeholder="مثلاً سامانهٔ آموزش (گلستان)" onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="space-y-1">
        <span className="font-bold">دسترسی‌ها (فقط آنچه لازم است)</span>
        {API_SCOPES.map((s) => (
          <label key={s.key} className="flex items-center gap-2">
            <input type="checkbox" checked={scopes.includes(s.key)} onChange={() => toggle(s.key)} /> {s.label}
            <code className="text-[10px] text-muted-foreground" dir="ltr">{s.key}</code>
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={sandbox} onChange={(e) => setSandbox(e.target.checked)} /> کلید آزمایشی (چیزی ذخیره نمی‌شود)
      </label>
      <label className="flex items-center gap-2">
        <span className="font-bold">مدت اعتبار</span>
        <select className={input} value={days} onChange={(e) => setDays(e.target.value)}>
          <option value="30">۳۰ روز</option>
          <option value="90">۹۰ روز</option>
          <option value="180">۱۸۰ روز</option>
          <option value="365">یک سال</option>
          <option value="730">دو سال</option>
          <option value="">بدون انقضا</option>
        </select>
      </label>
      <label className="block space-y-1">
        <span className="font-bold">فقط از این IPها (اختیاری)</span>
        <textarea className={`${input} h-16 w-full`} dir="ltr" value={ips} placeholder="203.0.113.10, 198.51.100.0/24" onChange={(e) => setIps(e.target.value)} />
      </label>
      <button className={btnMain} disabled={busy || !name.trim() || !scopes.length} onClick={() => void submit()}><KeyRound className="h-3.5 w-3.5" /> ساخت کلید</button>
    </section>
  );
}

function FreshKey({ k, onClose }: { k: NewApiKey; onClose: () => void }) {
  return (
    <section className="space-y-2 rounded-xl border-2 border-bronze p-3 text-xs">
      <p className="font-bold">کلید ساخته شد{k.sandbox ? " (آزمایشی)" : ""}. «رمز کلید» فقط همین یک بار نمایش داده می‌شود و Lexa آن را نگه نمی‌دارد.</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-20 text-muted-foreground">شناسهٔ کلید</span>
        <code className="rounded bg-muted px-2 py-1" dir="ltr">{k.key}</code>
        <CopyButton text={k.key} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-20 text-muted-foreground">رمز کلید</span>
        <code className="break-all rounded bg-muted px-2 py-1" dir="ltr">{k.secret}</code>
        <CopyButton text={k.secret} />
      </div>
      <p className="text-muted-foreground">رمز را فقط در تنظیمات سرور سامانه بگذارید (نه در کد، ایمیل یا پیام‌رسان). اگر لو رفت، همین‌جا آن را باطل کنید.</p>
      <button className={btn} onClick={onClose}>ذخیره کردم</button>
    </section>
  );
}
