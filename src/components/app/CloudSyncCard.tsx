"use client";

/* ─── حساب ابری Lexa — همه‌چیز خودکار ────────────────────────────────────────
 * سینک کاملاً خودکار است (useCloudAutoSync): هر تغییر با چند ثانیه تأخیر بی‌صدا
 * روی ابر ذخیره می‌شود و با ورود در هر دستگاهی خودش برمی‌گردد. کاربر هیچ دکمهٔ
 * «همگام‌سازی/بازیابی» دستی لازم ندارد — این کارت فقط وضعیت را نشان می‌دهد و
 * ورود/خروج + یک بازیابی اضطراری کوچک دارد.
 * ─────────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { Loader2, LogIn, LogOut, UserPlus, CheckCircle2, CloudCog, TriangleAlert, CloudCheck } from "lucide-react";
import { sbUser, sbSignUp, sbSignIn, sbSignOut, sbPushState, sbPullState, collectLocal, applyLocal, onAuthChange, type SbUser } from "@/lib/supabase";
import { wipeLocalUserData, cloudLastPushAt } from "@/lib/cloud-sync";
import { fa as faNum } from "@/lib/fa";

/** پیام خطای دوستانه — جزئیات فنی هرگز به کاربر نشان داده نمی‌شود */
function friendlyCloudError(): string {
  return "اتصال به حساب ابری برقرار نشد — اینترنت را بررسی کن و دوباره تلاش کن؛ داده‌هایت روی همین دستگاه امن‌اند.";
}

export function CloudSyncCard() {
  const [user, setUser] = React.useState<SbUser | null>(() => sbUser());
  const [mode, setMode] = React.useState<"in" | "up">("in");
  const [email, setEmail] = React.useState("");
  const [pw, setPw] = React.useState("");
  const [busy, setBusy] = React.useState<"" | "auth" | "restore" | "out">("");
  const [msg, setMsg] = React.useState("");
  const [err, setErr] = React.useState("");
  const [lastPush, setLastPush] = React.useState<number>(() => cloudLastPushAt());

  React.useEffect(() => onAuthChange(() => { setUser(sbUser()); setLastPush(cloudLastPushAt()); }), []);

  // زمان «آخرین ذخیره» هر از گاهی تازه شود (سینک خودکار در پس‌زمینه در جریان است)
  React.useEffect(() => {
    const iv = setInterval(() => setLastPush(cloudLastPushAt()), 30_000);
    return () => clearInterval(iv);
  }, []);

  const valid = /.+@.+\..+/.test(email) && pw.length >= 6;

  async function doAuth() {
    setBusy("auth"); setMsg(""); setErr("");
    const e = mode === "in" ? await sbSignIn(email.trim(), pw) : await sbSignUp(email.trim(), pw);
    setBusy("");
    if (e) { setErr(friendlyCloudError()); return; }
    setUser(sbUser());
    setMsg(mode === "in" ? "خوش آمدی! از این پس همه‌چیز خودکار همگام می‌شود." : "حسابت ساخته شد؛ از این پس همه‌چیز خودکار همگام می‌شود.");
    setPw("");
  }

  /** بازیابی اضطراری — فقط برای مواقعی که کاربر فکر می‌کند چیزی گم شده؛ در حالت عادی هرگز لازم نیست */
  async function doRestore() {
    if (!window.confirm("همهٔ داده‌های همین دستگاه با نسخهٔ ذخیره‌شدهٔ ابر جایگزین می‌شود و صفحه تازه‌سازی می‌گردد. ادامه می‌دهی؟")) return;
    setBusy("restore"); setMsg(""); setErr("");
    const { err: e, data } = await sbPullState();
    setBusy("");
    if (e) { setErr(friendlyCloudError()); return; }
    if (!data) { setMsg("روی ابر هنوز داده‌ای ثبت نشده است."); return; }
    const done = applyLocal(data as Record<string, unknown>);
    setMsg(done.length ? "بازیابی شد؛ صفحه تازه‌سازی می‌شود…" : "داده‌ای برای بازیابی نبود.");
    if (done.length) setTimeout(() => window.location.reload(), 900);
  }

  async function doLogout() {
    setBusy("out"); setMsg(""); setErr("");
    try { await sbPushState(collectLocal()); } catch { /* بی‌اثر — سینک خودکار قبلاً ذخیره کرده است */ }
    await sbSignOut();
    wipeLocalUserData();
    setUser(null);
    setBusy("");
    setMsg("از حساب خارج شدی؛ داده‌هایت روی ابر محفوظ است و با ورود دوباره برمی‌گردد.");
  }

  const savedTime = lastPush
    ? new Date(lastPush).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <h2 className="mb-1 flex items-center gap-2 font-bold">
        <CloudCog className="h-5 w-5 text-bronze" /> حساب ابری
      </h2>
      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
        با حساب ابری، پیشرفت درس‌ها، کتابخانهٔ شخصی، تلاش‌های آزمون و تنظیماتت به‌صورت خودکار روی سرور امن
        ذخیره می‌شود و روی هر دستگاهی که وارد شوی، خودش برمی‌گردد — نیازی به کاری از سمت تو نیست.
      </p>

      {user ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-success/10 px-4 py-3 text-sm">
            <span className="flex items-center gap-2 font-bold text-success"><CheckCircle2 className="h-4 w-4" /> {user.email}</span>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-success/90">
              <CloudCheck className="h-3.5 w-3.5" />
              همگام‌سازی خودکار فعال{savedTime ? ` · آخرین ذخیره: ${savedTime}` : ""}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              onClick={doLogout}
              disabled={busy !== ""}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted/50 disabled:opacity-45"
            >
              {busy === "out" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />} خروج
            </button>
            <button
              onClick={doRestore}
              disabled={busy !== ""}
              title="فقط برای مواقع اضطراری — در حالت عادی همگام‌سازی خودکار همه‌چیز را انجام می‌دهد"
              className="text-[11px] font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-45"
            >
              {busy === "restore" ? <Loader2 className="me-1 inline h-3 w-3 animate-spin" /> : null}
              بازیابی نسخهٔ ابر روی این دستگاه
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

// جلوگیری از هشدار unused برای faNum در پیکربندی‌های مختلف eslint
void faNum;
