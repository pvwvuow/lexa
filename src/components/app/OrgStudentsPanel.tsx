"use client";
/* Centre panel: official student and staff accounts (phase 1 of docs/ORG_LEARNING.md).
 * Owners / managers (and Lexa admins) with a two-factor session create accounts one by one or
 * from a CSV file, print the one-time sign-in cards, change status / access after graduation,
 * reset passwords of centre-made accounts, issue activation codes and read the audit log. */
import * as React from "react";
import {
  Download, FileUp, History, KeyRound, ListChecks, Loader2, Printer, RefreshCw, Search, Ticket, UserPlus, Users,
} from "lucide-react";
import { MfaRequired } from "./MfaPanel";
import {
  ACCESS_AFTER_EXIT, STUDENT_STATUSES, downloadText, issueActivationCode, orgAccountError, orgAuditLog, orgCapacity,
  orgRoster, parseCsv, peopleFromCsv, personProblem, provisionPeople, resetPassword, setStudentStatus, statusLabel,
  toCsv, toLatinDigits,
  type AccessAfterExit, type AuditRow, type OrgCapacity, type PersonInput, type ProvisionResult, type RosterRow,
  type StudentStatus,
} from "@/lib/cloud-api/org-accounts";

type Tab = "list" | "add" | "import" | "audit";
type Cred = { username: string; fullName: string; password?: string; code?: string; note: string };

const BTN = "inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold hover:border-bronze disabled:opacity-50";
const BTN_MAIN = "inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50";
const INPUT = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-bronze";
const faDate = (s: string | null) => (s ? new Date(s).toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" }) : "-");
const EMPTY: PersonInput = { kind: "student", username: "", studentNo: "", externalId: "", fullName: "", field: "", entryYear: "", existingAccount: false };

export function OrgStudentsPanel({ orgId, orgName }: { orgId: string; orgName: string }) {
  return (
    <MfaRequired>
      <Inner orgId={orgId} orgName={orgName} />
    </MfaRequired>
  );
}

function Inner({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [tab, setTab] = React.useState<Tab>("list");
  const [rows, setRows] = React.useState<RosterRow[] | null>(null);
  const [cap, setCap] = React.useState<OrgCapacity | null>(null);
  const [error, setError] = React.useState("");
  const [creds, setCreds] = React.useState<Cred[]>([]);

  const reload = React.useCallback(async () => {
    setError("");
    try {
      const [r, c] = await Promise.all([orgRoster(orgId), orgCapacity(orgId)]);
      setRows(r);
      setCap(c);
    } catch (e) {
      setError(orgAccountError(e));
      setRows((x) => x ?? []);
    }
  }, [orgId]);
  React.useEffect(() => { void reload(); }, [reload]);

  const addResults = React.useCallback((res: ProvisionResult[], people: PersonInput[]) => {
    const byName = new Map(people.map((p) => [p.username.toLowerCase(), p]));
    const next: Cred[] = res.map((r) => ({
      username: r.username,
      fullName: byName.get(r.username.toLowerCase())?.fullName ?? "",
      password: r.password,
      code: r.code,
      note: r.result === "created" ? "حساب ساخته شد" : r.result === "code" ? "کد فعال‌سازی (حساب قبلی)" :
        r.result === "updated" ? "اطلاعات به‌روز شد" : r.result === "exists" ? "قبلاً وجود داشت" : `خطا: ${orgAccountError(new Error(r.error ?? ""))}`,
    }));
    setCreds((c) => [...next, ...c]);
  }, []);

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "list", label: "دانشجویان", icon: <Users className="h-4 w-4" /> },
    { key: "add", label: "افزودن", icon: <UserPlus className="h-4 w-4" /> },
    { key: "import", label: "ورود از فایل", icon: <FileUp className="h-4 w-4" /> },
    { key: "audit", label: "رویدادها", icon: <History className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {cap ? (
            <>کد مرکز برای ورود: <b dir="ltr" className="font-mono text-foreground">{cap.code || "تعیین نشده"}</b>
              {"  ·  "}حساب‌های دانشجویی فعال: <b className="text-foreground">{cap.studentsUsed}</b> از {cap.studentSeats}
              {"  ·  "}مدرسان: <b className="text-foreground">{cap.teachersUsed}</b> از {cap.teacherSeats}</>
          ) : "در حال بارگذاری…"}
        </div>
        <button type="button" className={BTN} onClick={() => void reload()}><RefreshCw className="h-3.5 w-3.5" /> تازه‌سازی</button>
      </div>
      <div className="flex flex-wrap gap-1 rounded-2xl border border-border bg-background/60 p-1" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold ${tab === t.key ? "bg-card text-bronze shadow-card" : "text-muted-foreground hover:text-foreground"}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>
      {error && (
        <div role="alert" className="flex items-center justify-between gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}<button type="button" className={BTN} onClick={() => void reload()}>تلاش دوباره</button>
        </div>
      )}
      {creds.length > 0 && <Credentials creds={creds} orgName={orgName} orgCode={cap?.code ?? ""} onClear={() => setCreds([])} />}
      {tab === "list" && <Roster orgId={orgId} rows={rows} onChanged={reload} onCred={(c) => setCreds((x) => [c, ...x])} />}
      {tab === "add" && <AddOne orgId={orgId} onDone={(res, p) => { addResults(res, p); void reload(); }} />}
      {tab === "import" && <ImportCsv orgId={orgId} onDone={(res, p) => { addResults(res, p); void reload(); }} />}
      {tab === "audit" && <Audit orgId={orgId} />}
    </div>
  );
}

function Roster({ orgId, rows, onChanged, onCred }: {
  orgId: string; rows: RosterRow[] | null; onChanged: () => Promise<void>; onCred: (c: Cred) => void;
}) {
  const [q, setQ] = React.useState("");
  const [st, setSt] = React.useState<"" | StudentStatus>("");
  const [edit, setEdit] = React.useState<string | null>(null);
  if (!rows) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  const qq = toLatinDigits(q.trim().toLowerCase());
  const shown = rows.filter((r) => (!st || r.status === st) &&
    (!qq || [r.fullName, r.orgUsername, r.studentNo, r.field, r.entryYear].some((v) => v.toLowerCase().includes(qq))));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جست‌وجو: نام، نام کاربری، شماره، رشته…" className={INPUT} />
        </div>
        <select value={st} onChange={(e) => setSt(e.target.value as StudentStatus | "")} className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
          <option value="">همهٔ وضعیت‌ها</option>
          {STUDENT_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>
      <p className="text-[11px] text-muted-foreground">{shown.length} نفر</p>
      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">دانشجویی با این شرایط نیست؛ از «افزودن» یا «ورود از فایل» حساب بسازید.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="p-2 text-start">نام</th><th className="p-2 text-start">نام کاربری</th><th className="p-2 text-start">شماره</th>
                <th className="p-2 text-start">رشته / ورودی</th><th className="p-2 text-start">وضعیت</th><th className="p-2 text-start">آخرین ورود</th>
                <th className="p-2 text-start">کارها</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <React.Fragment key={r.id}>
                  <tr className="border-t border-border align-top">
                    <td className="p-2">{r.fullName || "-"}
                      {!r.userId && <span className="ms-1 rounded bg-amber-500/15 px-1.5 text-[10px] text-amber-700">{r.pendingCode ? "منتظر کد" : "بدون حساب"}</span>}
                      {r.userId && !r.termsAcceptedAt && <span className="ms-1 rounded bg-muted px-1.5 text-[10px] text-muted-foreground">هنوز وارد نشده</span>}
                    </td>
                    <td className="p-2 font-mono text-xs" dir="ltr">{r.orgUsername}</td>
                    <td className="p-2 font-mono text-xs" dir="ltr">{r.studentNo}</td>
                    <td className="p-2 text-xs">{[r.field, r.entryYear].filter(Boolean).join(" · ") || "-"}</td>
                    <td className="p-2 text-xs">{statusLabel(r.status)}{r.status !== "active" && r.status !== "suspended" && (
                      <span className="block text-[10px] text-muted-foreground">{ACCESS_AFTER_EXIT.find((a) => a.key === r.accessAfterExit)?.label}{r.accessAfterExit === "until" && r.accessUntil ? ` (${new Date(r.accessUntil).toLocaleDateString("fa-IR")})` : ""}</span>
                    )}</td>
                    <td className="p-2 text-xs">{faDate(r.lastSignInAt)}</td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-1">
                        <button type="button" className={BTN} onClick={() => setEdit(edit === r.id ? null : r.id)}><ListChecks className="h-3.5 w-3.5" /> وضعیت</button>
                        {r.userId && r.managed && <ResetBtn orgId={orgId} row={r} onCred={onCred} />}
                        {!r.userId && <CodeBtn orgId={orgId} row={r} onCred={onCred} onChanged={onChanged} />}
                      </div>
                    </td>
                  </tr>
                  {edit === r.id && (
                    <tr className="border-t border-dashed border-border bg-muted/20">
                      <td colSpan={7} className="p-3"><StatusEditor orgId={orgId} row={r} onSaved={async () => { setEdit(null); await onChanged(); }} /></td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusEditor({ orgId, row, onSaved }: { orgId: string; row: RosterRow; onSaved: () => Promise<void> }) {
  const [status, setStatus] = React.useState<StudentStatus>(row.status);
  const [after, setAfter] = React.useState<AccessAfterExit>(row.accessAfterExit);
  const [until, setUntil] = React.useState(row.accessUntil ?? "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const exited = status === "graduated" || status === "withdrawn";
  async function save() {
    setBusy(true); setError("");
    try {
      await setStudentStatus(orgId, row.id, status, exited ? after : "open", exited && after === "until" ? until : null);
      await onSaved();
    } catch (e) { setError(orgAccountError(e)); } finally { setBusy(false); }
  }
  return (
    <div className="flex flex-wrap items-end gap-2 text-xs">
      <label className="space-y-1"><span className="block font-bold text-muted-foreground">وضعیت</span>
        <select value={status} onChange={(e) => setStatus(e.target.value as StudentStatus)} className="rounded-xl border border-border bg-background px-3 py-2">
          {STUDENT_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </label>
      {exited && (
        <label className="space-y-1"><span className="block font-bold text-muted-foreground">دسترسی بعد از خروج</span>
          <select value={after} onChange={(e) => setAfter(e.target.value as AccessAfterExit)} className="rounded-xl border border-border bg-background px-3 py-2">
            {ACCESS_AFTER_EXIT.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
        </label>
      )}
      {exited && after === "until" && (
        <label className="space-y-1"><span className="block font-bold text-muted-foreground">تا تاریخ (میلادی)</span>
          <input type="date" dir="ltr" value={until} onChange={(e) => setUntil(e.target.value)} className="rounded-xl border border-border bg-background px-3 py-2" />
        </label>
      )}
      <button type="button" className={BTN_MAIN} disabled={busy || (exited && after === "until" && !until)} onClick={() => void save()}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} ذخیره
      </button>
      {status === "suspended" && row.managed && <span className="text-amber-700">حساب معلق نمی‌تواند وارد شود و نشست‌هایش بسته می‌شود.</span>}
      {status === "suspended" && !row.managed && <span className="text-muted-foreground">این حساب را خود کاربر ساخته؛ فقط دسترسی او به محتوای مرکز قطع می‌شود.</span>}
      {error && <span className="text-destructive">{error}</span>}
    </div>
  );
}

function ResetBtn({ orgId, row, onCred }: { orgId: string; row: RosterRow; onCred: (c: Cred) => void }) {
  const [busy, setBusy] = React.useState(false);
  async function go() {
    if (!window.confirm(`رمز «${row.orgUsername}» عوض شود؟ رمز قبلی دیگر کار نمی‌کند.`)) return;
    setBusy(true);
    try {
      const r = await resetPassword(orgId, row.userId!);
      onCred({ username: row.orgUsername, fullName: row.fullName, password: r.password, note: "رمز تازه" });
    } catch (e) { window.alert(orgAccountError(e)); } finally { setBusy(false); }
  }
  return <button type="button" className={BTN} disabled={busy} onClick={() => void go()}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />} رمز تازه</button>;
}

function CodeBtn({ orgId, row, onCred, onChanged }: { orgId: string; row: RosterRow; onCred: (c: Cred) => void; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = React.useState(false);
  async function go() {
    setBusy(true);
    try {
      const r = await issueActivationCode(orgId, row.id);
      onCred({ username: row.orgUsername, fullName: row.fullName, code: r.code, note: "کد فعال‌سازی ۷ روزه" });
      await onChanged();
    } catch (e) { window.alert(orgAccountError(e)); } finally { setBusy(false); }
  }
  return <button type="button" className={BTN} disabled={busy} onClick={() => void go()}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ticket className="h-3.5 w-3.5" />} کد تازه</button>;
}

function AddOne({ orgId, onDone }: { orgId: string; onDone: (r: ProvisionResult[], p: PersonInput[]) => void }) {
  const [p, setP] = React.useState<PersonInput>(EMPTY);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const set = (k: keyof PersonInput, v: string | boolean) => setP((x) => ({ ...x, [k]: v }));
  const person = { ...p, studentNo: toLatinDigits(p.studentNo.trim()), username: toLatinDigits((p.username || p.studentNo).trim()), entryYear: toLatinDigits(p.entryYear.trim()) };
  const problem = personProblem(person);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (problem) return setError(problem);
    setBusy(true); setError("");
    try { onDone(await provisionPeople(orgId, [person]), [person]); setP(EMPTY); }
    catch (err) { setError(orgAccountError(err)); } finally { setBusy(false); }
  }
  const field = (k: keyof PersonInput, label: string, ltr = false, ph = "") => (
    <label className="block space-y-1"><span className="text-xs font-bold text-muted-foreground">{label}</span>
      <input dir={ltr ? "ltr" : "rtl"} value={String(p[k])} placeholder={ph} onChange={(e) => set(k, e.target.value)} className={INPUT} />
    </label>
  );
  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex gap-2 text-sm">
        {(["student", "staff"] as const).map((k) => (
          <label key={k} className="flex items-center gap-1"><input type="radio" checked={p.kind === k} onChange={() => set("kind", k)} />{k === "student" ? "دانشجو" : "مدرس"}</label>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("fullName", "نام و نام خانوادگی")}
        {field("studentNo", p.kind === "student" ? "شمارهٔ دانشجویی" : "کد پرسنلی", true)}
        {field("username", "نام کاربری مرکز (خالی = همان شماره)", true, "4001234")}
        {p.kind === "student" && field("field", "رشته")}
        {p.kind === "student" && field("entryYear", "ورودی", true, "1403")}
        {field("externalId", "شناسه در سیستم مرکز (اختیاری)", true)}
      </div>
      {p.kind === "student" && (
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={p.existingAccount} onChange={(e) => set("existingAccount", e.target.checked)} className="mt-0.5" />
          این دانشجو از قبل حساب Lexa دارد: به‌جای ساخت حساب، کد فعال‌سازی ۷ روزه بساز.
        </label>
      )}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <button type="submit" className={BTN_MAIN} disabled={busy || !person.username}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} ساخت حساب</button>
    </form>
  );
}

const TEMPLATE_HEAD = ["نام کاربری", "شماره دانشجویی", "نام و نام خانوادگی", "رشته", "ورودی", "شناسه", "نوع", "حساب قبلی"];

function ImportCsv({ orgId, onDone }: { orgId: string; onDone: (r: ProvisionResult[], p: PersonInput[]) => void }) {
  const [people, setPeople] = React.useState<PersonInput[] | null>(null);
  const [missing, setMissing] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(0);
  const [error, setError] = React.useState("");
  function load(text: string) {
    setError("");
    const rows = parseCsv(text);
    if (rows.length > 5001) return setError("حداکثر ۵۰۰۰ ردیف در هر فایل.");
    const r = peopleFromCsv(rows);
    setPeople(r.people);
    setMissing(r.missing);
  }
  async function file(f: File | undefined) {
    if (!f) return;
    if (f.size > 2_000_000) return setError("حجم فایل بیش از ۲ مگابایت است.");
    load(await f.text());
  }
  const problems = (people ?? []).map(personProblem);
  const dup = new Set<string>();
  const dupRows = (people ?? []).map((p) => { const k = p.username.toLowerCase(); const d = dup.has(k); dup.add(k); return d; });
  const bad = problems.filter(Boolean).length + dupRows.filter(Boolean).length;
  async function submit() {
    if (!people?.length || bad) return;
    setBusy(true); setError(""); setDone(0);
    const all: ProvisionResult[] = [];
    try {
      for (let i = 0; i < people.length; i += 100) {
        const chunk = people.slice(i, i + 100);
        const res = await provisionPeople(orgId, chunk);
        all.push(...res.map((r) => ({ ...r, row: r.row + i })));
        setDone(Math.min(i + 100, people.length));
      }
      setPeople(null);
    } catch (e) {
      setError(`${orgAccountError(e)} (${all.length} ردیف اول انجام شد.)`);
    } finally {
      setBusy(false);
      if (all.length) onDone(all, people);
    }
  }
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <p className="text-xs leading-relaxed text-muted-foreground">
        فایل CSV (از Excel با «ذخیره به‌صورت CSV UTF-8») با سرستون‌های زیر. ستون «نام کاربری» یا «شماره دانشجویی» لازم است؛
        در ستون «نوع» برای مدرس بنویسید «مدرس» و در «حساب قبلی» برای کسی که از قبل حساب Lexa دارد «بله».
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BTN} onClick={() => downloadText("lexa-students-template.csv", toCsv([TEMPLATE_HEAD, ["4001234", "4001234", "زهرا محمدی", "حقوق", "1403", "", "دانشجو", "خیر"]]))}>
          <Download className="h-3.5 w-3.5" /> دریافت قالب
        </button>
        <label className={`${BTN} cursor-pointer`}><FileUp className="h-3.5 w-3.5" /> انتخاب فایل
          <input type="file" accept=".csv,.txt,text/csv" className="hidden" onChange={(e) => void file(e.target.files?.[0])} />
        </label>
      </div>
      {missing.length > 0 && <p className="text-xs text-destructive">ستون «نام کاربری» یا «شماره دانشجویی» در فایل پیدا نشد.</p>}
      {people && people.length > 0 && (
        <>
          <p className="text-xs">{people.length} ردیف؛ {bad ? <b className="text-destructive">{bad} ردیف ایراد دارد و باید در فایل درست شود.</b> : "همه ردیف‌ها درست‌اند."}</p>
          <div className="max-h-80 overflow-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted"><tr><th className="p-1.5">#</th><th className="p-1.5 text-start">نام کاربری</th><th className="p-1.5 text-start">نام</th><th className="p-1.5 text-start">رشته / ورودی</th><th className="p-1.5 text-start">نوع</th><th className="p-1.5 text-start">ایراد</th></tr></thead>
              <tbody>
                {people.slice(0, 500).map((p, i) => (
                  <tr key={i} className={`border-t border-border ${problems[i] || dupRows[i] ? "bg-destructive/10" : ""}`}>
                    <td className="p-1.5 text-center">{i + 1}</td>
                    <td className="p-1.5 font-mono" dir="ltr">{p.username}</td>
                    <td className="p-1.5">{p.fullName}</td>
                    <td className="p-1.5">{[p.field, p.entryYear].filter(Boolean).join(" · ")}</td>
                    <td className="p-1.5">{p.kind === "staff" ? "مدرس" : p.existingAccount ? "دانشجو (کد)" : "دانشجو"}</td>
                    <td className="p-1.5 text-destructive">{problems[i] || (dupRows[i] ? "نام کاربری تکراری" : "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className={BTN_MAIN} disabled={busy || bad > 0} onClick={() => void submit()}>
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> {done} از {people.length}</> : <>ساخت {people.length} حساب</>}
          </button>
        </>
      )}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

function Credentials({ creds, orgName, orgCode, onClear }: { creds: Cred[]; orgName: string; orgCode: string; onClear: () => void }) {
  const secret = creds.filter((c) => c.password || c.code);
  function csv() {
    downloadText(`lexa-${orgCode || "org"}-accounts.csv`, toCsv([
      ["نام", "کد مرکز", "نام کاربری", "رمز اولیه", "کد فعال‌سازی", "توضیح"],
      ...creds.map((c) => [c.fullName, orgCode, c.username, c.password ?? "", c.code ?? "", c.note]),
    ]));
  }
  function print() {
    const cards = secret.map((c) => `<div class="c"><h3>${esc(orgName)}</h3><p><b>${esc(c.fullName)}</b></p>
      ${c.password ? `<p>کد مرکز: <code>${esc(orgCode)}</code></p><p>نام کاربری: <code>${esc(c.username)}</code></p><p>رمز اولیه: <code>${esc(c.password)}</code></p><small>در اولین ورود باید رمز را عوض کنید. «ورود با حساب مرکز» را در Lexa بزنید.</small>`
        : `<p>کد فعال‌سازی: <code>${esc(c.code ?? "")}</code></p><small>در Lexa وارد حساب خود شوید و از تنظیمات «کد فعال‌سازی مرکز آموزشی» را وارد کنید. اعتبار: ۷ روز.</small>`}</div>`).join("");
    const html = `<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><title>Lexa</title><style>
      body{font-family:Tahoma,sans-serif;margin:12px}.g{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .c{border:1px dashed #555;border-radius:10px;padding:10px;break-inside:avoid}h3{margin:0 0 6px;font-size:14px}
      p{margin:3px 0;font-size:13px}code{font-family:monospace;font-size:14px;direction:ltr;display:inline-block}small{color:#555}
      </style></head><body><div class="g">${cards}</div><script>window.onload=function(){window.print()}</script></body></html>`;
    // the APK / desktop shells may block pop-ups: then save the cards as an HTML file to print
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return downloadText(`lexa-${orgCode || "org"}-cards.html`, html, "text/html;charset=utf-8");
    w.document.write(html);
    w.document.close();
  }
  return (
    <div className="space-y-2 rounded-2xl border border-bronze/50 bg-bronze/[0.06] p-4">
      <p className="text-xs font-bold text-bronze">رمزها و کدها فقط همین یک بار نمایش داده می‌شوند؛ پیش از بستن، دریافت یا چاپ کنید.</p>
      <div className="max-h-60 overflow-auto rounded-xl border border-border bg-background">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted"><tr><th className="p-1.5 text-start">نام کاربری</th><th className="p-1.5 text-start">نام</th><th className="p-1.5 text-start">رمز / کد</th><th className="p-1.5 text-start">نتیجه</th></tr></thead>
          <tbody>{creds.map((c, i) => (
            <tr key={i} className="border-t border-border">
              <td className="p-1.5 font-mono" dir="ltr">{c.username}</td><td className="p-1.5">{c.fullName}</td>
              <td className="p-1.5 select-all font-mono" dir="ltr">{c.password ?? c.code ?? ""}</td><td className="p-1.5">{c.note}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BTN} onClick={csv}><Download className="h-3.5 w-3.5" /> دریافت CSV</button>
        <button type="button" className={BTN} onClick={print} disabled={!secret.length}><Printer className="h-3.5 w-3.5" /> چاپ کارت‌های ورود</button>
        <button type="button" className={BTN} onClick={() => { if (window.confirm("رمزها دیگر قابل نمایش نیستند. بسته شود؟")) onClear(); }}>بستن</button>
      </div>
    </div>
  );
}

const ACTIONS: Record<string, string> = {
  "student.create_account": "ساخت حساب دانشجو",
  "student.create_code": "ثبت دانشجو با کد فعال‌سازی",
  "student.issue_code": "صدور کد فعال‌سازی",
  "student.redeem_code": "وصل شدن حساب با کد",
  "student.accept_terms": "تأیید شرایط توسط دانشجو",
  "student.set_status": "تغییر وضعیت دانشجو",
  "staff.create_account": "ساخت حساب مدرس",
  "account.reset_password": "رمز تازه",
  "account.first_password": "تغییر رمز اولیه",
  "admin.set_accounts": "تنظیم کد و ظرفیت توسط Lexa",
};

function Audit({ orgId }: { orgId: string }) {
  const [rows, setRows] = React.useState<AuditRow[] | null>(null);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    orgAuditLog(orgId).then(setRows).catch((e) => { setError(orgAccountError(e)); setRows([]); });
  }, [orgId]);
  if (!rows) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  if (error) return <p className="text-xs text-destructive">{error}</p>;
  if (!rows.length) return <p className="text-sm text-muted-foreground">رویدادی ثبت نشده است.</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 text-muted-foreground"><tr><th className="p-2 text-start">زمان</th><th className="p-2 text-start">رویداد</th><th className="p-2 text-start">جزئیات</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id} className="border-t border-border">
            <td className="p-2 whitespace-nowrap">{faDate(r.at)}</td>
            <td className="p-2">{ACTIONS[r.action] ?? r.action}</td>
            <td className="p-2 font-mono text-[10px] text-muted-foreground" dir="ltr">{
              Object.entries(r.detail).filter(([k]) => k !== "student").map(([k, v]) => `${k}: ${String(v)}`).join("  ")
            }</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
