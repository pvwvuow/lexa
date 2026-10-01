"use client";

/* ─── حساب ابری Lexa — ثبت‌نام/ورود و سینک کامل داده‌ها روی Supabase ──────────
 * هر کاربر یک ردیف در lexa_state دارد (RLS: فقط مالک). سینک شامل کل فروشگاه
 * برنامه (پیشرفت، کتابخانهٔ شخصی، درس‌های وارداتی، تنظیمات) + مباحث ضعیف و
 * نشانک‌های قانون است. آفلاین کامل کار می‌کند؛ سینک دستی + خودکار پس از ورود.
 * ─────────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { CloudUpload, CloudDownload, Loader2, LogIn, LogOut, UserPlus, CheckCircle2, CloudCog, TriangleAlert } from "lucide-react";
import { sbUser, sbSignUp, sbSignIn, sbSignOut, sbPushState, sbPullState, onAuthChange, type SbUser } from "@/lib/supabase";

const STORE_KEY = "lexa-store-v1";
const WEAK_KEY = "hoh_weak_topics";
const MARKS_KEY = "lexa-law-marks";

function collectLocal(): Record<string, unknown> {
  const read = (k: string) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };
  return { store: read(STORE_KEY), weakTopics: read(WEAK_KEY), lawMarks: read(MARKS_KEY), savedAt: Date.now() };
}

function applyLocal(data: Record<string, unknown>): string[] {
  const done: string[] = [];
  const put = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); done.push(k); } catch { /* ignore */ } };
  const d = data as { store?: unknown; weakTopics?: unknown; lawMarks?: unknown };
  if (d.store) put(STORE_KEY, d.store);
  if (d.weakTopics) put(WEAK_KEY, d.weakTopics);
  if (d.lawMarks) put(MARKS_KEY, d.lawMarks);
  return done;
}

export function CloudSyncCard() {
  const [user, setUser] = React.useState<SbUser | null>(() => sbUser());
  const [mode, setMode] = React.useState<"in" | "up">("in");
  const [email, setEmail] = React.useState("");
  const [pw, setPw] = React.useState("");
  const [busy, setBusy] = React.useState<"" | "auth" | "push" | "pull">("");
  const [msg, setMsg] = React.useState("");
  const [err, setErr] = React.useState("");

  React.useEffect(() => onAuthChange(() => setUser(sbUser())), []);

  const valid = /.+@.+\..+/.test(email) && pw.length >= 6;

  async function doAuth() {
    setBusy("auth"); setMsg(""); setErr("");
    const e = mode === "in" ? await sbSignIn(email.trim(), pw) : await sbSignUp(email.trim(), pw);
    setBusy("");
    if (e) setErr(e); else { setMsg(mode === "in" ? "خوش آمدی! حالا می‌توانی سینک کنی." : "ثبت‌نام انجام شد."); setPw(""); }
  }

  async function doPush() {
    setBusy("push"); setMsg(""); setErr("");
    const e = await sbPushState(collectLocal());
    setBusy("");
    if (e) setErr("ارسال به ابر ناموفق بود (" + e + ")");
    else setMsg("همهٔ داده‌هایت روی ابر ذخیره شد ✅");
  }

  async function doPull() {
    if (!window.confirm("داده‌های این دستگاه با نسخهٔ ابر جایگزین می‌شود و صفحه تازه‌سازی می‌گردد. ادامه می‌دهی؟")) return;
    setBusy("pull"); setMsg(""); setErr("");
    const { err: e, data } = await sbPullState();
    setBusy("");
    if (e) { setErr("دریافت از ابر ناموفق بود (" + e + ")"); return; }
    if (!data) { setMsg("روی ابر هنوز داده‌ای نداری — اول «همگام‌سازی روی ابر» را بزن."); return; }
    const done = applyLocal(data as Record<string, unknown>);
    setMsg(done.length ? "بازیابی شد؛ صفحه تازه‌سازی می‌شود…" : "دادهٔ ابر خالی بود.");
    if (done.length) setTimeout(() => window.location.reload(), 900);
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <h2 className="mb-1 flex items-center gap-2 font-bold">
        <CloudCog className="h-5 w-5 text-bronze" /> حساب ابری و سینک
      </h2>
      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
        با حساب ابری، پیشرفت درس‌ها، کتابخانهٔ شخصی، تلاش‌های آزمون و تنظیماتت روی سرور امن ذخیره می‌شود و روی هر دستگاهی با ورود بازیابی می‌شود.
      </p>

      {user ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-success/10 px-4 py-3 text-sm">
            <span className="flex items-center gap-2 font-bold text-success"><CheckCircle2 className="h-4 w-4" /> {user.email}</span>
            <button onClick={() => { sbSignOut(); setMsg("از حساب ابری خارج شدی."); }} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted/50">
              <LogOut className="h-3.5 w-3.5" /> خروج
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={doPush} disabled={busy !== ""} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-45">
              {busy === "push" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />} همگام‌سازی روی ابر
            </button>
            <button onClick={doPull} disabled={busy !== ""} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold hover:bg-muted/50 disabled:opacity-45">
              {busy === "pull" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />} بازیابی از ابر
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-bold">ایمیل</span>
              <input dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-bronze" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-bold">رمز عبور</span>
              <input dir="ltr" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="دست‌کم ۶ نویسه"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-bronze" />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={doAuth} disabled={!valid || busy !== ""} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-45">
              {busy === "auth" ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "in" ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {mode === "in" ? "ورود" : "ثبت‌نام"}
            </button>
            <button onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(""); setErr(""); }} className="text-xs font-bold text-bronze underline-offset-4 hover:underline">
              {mode === "in" ? "حساب نداری؟ ثبت‌نام کن" : "حساب داری؟ وارد شو"}
            </button>
          </div>
        </div>
      )}

      {msg && <p className="mt-3 rounded-xl bg-success/10 px-3 py-2 text-sm text-success">{msg}</p>}
      {err && <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {err}</p>}
    </section>
  );
}
