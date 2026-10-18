"use client";

/* ─── حساب ابری Lexa — همه‌چیز خودکار ────────────────────────────────────────
 * سینک کاملاً خودکار است (useCloudAutoSync): هر تغییر با چند ثانیه تأخیر بی‌صدا
 * روی ابر ذخیره می‌شود و با ورود در هر دستگاهی خودش برمی‌گردد. این کارت فقط
 * وضعیت را نشان می‌دهد و ورود/خروج + یک بازیابی اضطراری کوچک دارد.
 * ورود/ثبت‌نام این‌جا همان دیالوگ حساب ابری است (نام کاربری دلخواه، تشخیص تعویض
 * حساب، دریافت ابر پیش از هر پوش) — دو نسخهٔ جدا از منطق ورود دیگر وجود ندارد.
 * کارت «نام کاربری» بالای آن برای هر حساب (ابری یا محلی دسکتاپ) دیده می‌شود.
 * ─────────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { Loader2, LogIn, LogOut, UserPlus, CheckCircle2, CloudCog, TriangleAlert, CloudCheck, AtSign, PenLine } from "lucide-react";
import { sbUser, sbSignOut, sbPushState, sbPullState, collectLocal, applyLocal, onAuthChange, type SbUser } from "@/lib/supabase";
import { wipeLocalUserData, cloudLastPushAt, noteCloudPushed } from "@/lib/cloud-sync";
import { useAuth } from "@/lib/auth-client";
import { CloudAuthDialog, UsernameDialog } from "./CloudAuth";

/** پیام خطای دوستانه — جزئیات فنی هرگز به کاربر نشان داده نمی‌شود */
function friendlyCloudError(): string {
  return "اتصال به حساب برقرار نشد؛ اتصال اینترنت را بررسی کنید و دوباره تلاش کنید. داده‌های این دستگاه حفظ شده‌اند.";
}

/** نام کاربری حساب فعلی + دکمهٔ تغییر (ابری و محلی) */
function UsernameCard() {
  const auth = useAuth();
  const [open, setOpen] = React.useState(false);
  const u = auth.user;
  if (!u) return null;
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-bold"><AtSign className="h-5 w-5 text-bronze" /> نام کاربری</h2>
          <p dir="ltr" className="mt-1 truncate text-start text-sm font-bold">@{u.username}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">این نام در پروفایل، نظرها و دعوت‌نامه‌ها نمایش داده می‌شود.</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2 text-xs font-bold transition-colors hover:border-bronze hover:text-bronze"
        >
          <PenLine className="h-3.5 w-3.5" /> تغییر نام کاربری
        </button>
      </div>
      <UsernameDialog open={open} onOpenChange={setOpen} current={u.username} />
    </section>
  );
}

export function CloudSyncCard() {
  const auth = useAuth();
  const [user, setUser] = React.useState<SbUser | null>(() => sbUser());
  const [authOpen, setAuthOpen] = React.useState(false);
  const [authTab, setAuthTab] = React.useState<"login" | "register">("login");
  const [busy, setBusy] = React.useState<"" | "restore" | "out">("");
  const [msg, setMsg] = React.useState("");
  const [err, setErr] = React.useState("");
  const [lastPush, setLastPush] = React.useState<number>(() => cloudLastPushAt());

  React.useEffect(() => onAuthChange(() => { setUser(sbUser()); setLastPush(cloudLastPushAt()); }), []);

  // زمان «آخرین ذخیره» هر از گاهی تازه شود (سینک خودکار در پس‌زمینه در جریان است)
  React.useEffect(() => {
    const iv = setInterval(() => setLastPush(cloudLastPushAt()), 30_000);
    return () => clearInterval(iv);
  }, []);

  function openAuth(tab: "login" | "register") {
    setMsg("");
    setErr("");
    setAuthTab(tab);
    setAuthOpen(true);
  }

  /** بازیابی اضطراری — فقط برای مواقعی که کاربر فکر می‌کند چیزی گم شده؛ در حالت عادی هرگز لازم نیست */
  async function doRestore() {
    if (!window.confirm("داده‌های این دستگاه با آخرین نسخهٔ ذخیره‌شده در حساب جایگزین می‌شود و صفحه دوباره بارگذاری می‌شود. ادامه می‌دهید؟")) return;
    setBusy("restore"); setMsg(""); setErr("");
    const { err: e, data } = await sbPullState();
    setBusy("");
    if (e) { setErr(friendlyCloudError()); return; }
    if (!data) { setMsg("هنوز داده‌ای در حساب ذخیره نشده است."); return; }
    const done = applyLocal(data as Record<string, unknown>);
    setMsg(done.length ? "بازیابی انجام شد؛ صفحه دوباره بارگذاری می‌شود…" : "داده‌ای برای بازیابی نبود.");
    if (done.length) setTimeout(() => window.location.reload(), 900);
  }

  async function doLogout() {
    setBusy("out"); setMsg(""); setErr("");
    // آخرین ذخیره باید واقعاً موفق باشد — وگرنه پاک‌سازی دستگاه داده را برای همیشه می‌برد
    const blob = collectLocal();
    const pushErr = await sbPushState(blob).catch(() => "net");
    if (pushErr) {
      setBusy("");
      setErr("آخرین تغییرات ذخیره نشد، به همین دلیل خروج انجام نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.");
      return;
    }
    noteCloudPushed(blob.savedAt);
    await sbSignOut();
    // خروج کامل: نشست اپ (و نشست سروری پل) هم بسته می‌شود
    try { await auth.logout(); } catch {}
    wipeLocalUserData();
    setUser(null);
    setBusy("");
    setMsg("از حساب خارج شدید. با ورود دوباره، اطلاعات شما در دسترس خواهد بود.");
  }

  const savedTime = lastPush
    ? new Date(lastPush).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <>
      <UsernameCard />
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h2 className="mb-1 flex items-center gap-2 font-bold">
          <CloudCog className="h-5 w-5 text-bronze" /> حساب Lexa
        </h2>
        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
          پیشرفت درس‌ها، کتابخانهٔ شخصی و نتایج آزمون‌هایت به‌صورت خودکار در حسابت ذخیره می‌شود و روی هر دستگاهی
          که وارد شوی در دسترس است.
        </p>

        {user ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-success/10 px-4 py-3 text-sm">
              <span className="flex items-center gap-2 font-bold text-success"><CheckCircle2 className="h-4 w-4" /> {user.email}</span>
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-success/90">
                <CloudCheck className="h-3.5 w-3.5" />
                ذخیرهٔ خودکار فعال{savedTime ? ` · آخرین ذخیره: ${savedTime}` : ""}
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
                title="فقط در صورت نیاز؛ در حالت عادی ذخیره و بازیابی خودکار انجام می‌شود"
                className="text-[11px] font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-45"
              >
                {busy === "restore" ? <Loader2 className="me-1 inline h-3 w-3 animate-spin" /> : null}
                بازیابی آخرین نسخهٔ حساب روی این دستگاه
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => openAuth("login")} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">
              <LogIn className="h-4 w-4" /> ورود
            </button>
            <button onClick={() => openAuth("register")} className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-bold transition-colors hover:border-bronze hover:text-bronze">
              <UserPlus className="h-4 w-4" /> ثبت‌نام
            </button>
          </div>
        )}

        {msg && <p className="mt-3 rounded-xl bg-success/10 px-3 py-2 text-sm text-success">{msg}</p>}
        {err && <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {err}</p>}
        <CloudAuthDialog open={authOpen} onOpenChange={setAuthOpen} initialTab={authTab} />
      </section>
    </>
  );
}
