"use client";

/* ─── حساب ابری Lexa — دیالوگ ثبت‌نام/ورود نسخهٔ اندروید (APK) ─────────────────
 * APK سرور محلی ندارد؛ حساب کاربری روی «حساب ابری» (Supabase) ساخته می‌شود.
 * پس از ورود: دادهٔ ابر اگر بود بازیابی و اپ تازه‌سازی می‌شود؛ اگر ابر خالی بود
 * دادهٔ همین دستگاه به ابر فرستاده می‌شود تا حساب از همان لحظهٔ ساخت پر باشد.
 * اگر دریافت ابر ناموفق بود هیچ چیزی به ابر نمی‌رود (وگرنه دادهٔ حساب با دادهٔ خالی
 * دستگاه له می‌شد) — کاربر خارج و دعوت به تلاش دوباره می‌شود.
 * از تنظیمات → عمومی هم کارت «حساب ابری و سینک» با کنترل دستی در دسترس است.
 * ─────────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Scale, UserRound, KeyRound, Loader2, CloudUpload, CloudCheck,
  ShieldCheck, LogIn, UserPlus, LogOut, TriangleAlert, Settings,
} from "lucide-react";
import {
  sbUser, sbSignUp, sbSignIn, sbSignOut, sbPushState, sbPullState,
  collectLocal, onAuthChange, type SbUser,
} from "@/lib/supabase";
import { adoptCloudBlob, wipeLocalUserData, handleAccountSwitch, holdCloudPush, noteCloudPushed } from "@/lib/cloud-sync";
import { navigate } from "@/lib/router";
import { builtinCourses } from "@/lib/law/courses";
import { useApp } from "@/lib/store";

type Tab = "login" | "register";

/** دیالوگ ورود/ثبت‌نام حساب ابری — هم‌شکل دیالوگ حساب دسکتاپ */
export function CloudAuthDialog({
  open,
  onOpenChange,
  initialTab = "login",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialTab?: Tab;
}) {
  const [tab, setTab] = React.useState<Tab>(initialTab);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setTab(initialTab);
      setError(null);
      setInfo(null);
      setPassword("");
      setConfirm("");
    }
  }, [open, initialTab]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setError(null);
    setInfo(null);
    // اعتبارسنجی این‌جا انجام می‌شود نه با disabled دکمه — دکمهٔ همیشه‌فعال تا
    // کاربر با کلیک، پیام دقیق خطا را ببیند (مشکل «دکمهٔ روشن نمی‌شود» در موبایل)
    const em = email.trim();
    if (!/.+@.+\..+/.test(em)) {
      setError("ایمیل معتبر نیست — نمونه: name@example.com");
      return;
    }
    if (password.length < 6) {
      setError("رمز عبور باید دست‌کم ۶ نویسه باشد.");
      return;
    }
    if (tab === "register" && password !== confirm) {
      setError("تکرار رمز عبور با رمز اصلی یکسان نیست.");
      return;
    }
    setBusy(true);
    const err = tab === "login"
      ? await sbSignIn(em, password)
      : await sbSignUp(em, password);
    if (err) {
      setBusy(false);
      setError(err);
      return;
    }
    if (!sbUser()) {
      // ثبت‌نام بدون نشست خودکار (تأیید ایمیل روشن است)
      setBusy(false);
      setInfo("ثبت‌نام انجام شد؛ ایمیل خود را تأیید کن و دوباره وارد شو.");
      setTab("login");
      return;
    }
    // ── ورود موفق: همگام‌سازی هوشمند ──
    // تا پایان بررسی ابر، پوش خودکار معلق است — وگرنه دادهٔ پاک‌شدهٔ تعویض حساب
    // می‌توانست قبل از رسیدن دادهٔ ابر روی حساب بنشیند.
    holdCloudPush(true);
    try {
      // تشخیص تعویض حساب: اگر قبلاً حساب دیگری روی این دستگاه وارد شده بود، دادهٔ
      // محلی (نشان‌ها/پیشرفت/کتاب‌ها) متعلق به آن حساب است و هرگز به حساب جدید نباید برسد.
      handleAccountSwitch(sbUser()!.id);
      // سیاست «کتابخانهٔ خالی برای حساب تازه» — هم‌سو با ثبت‌نام سروری: همهٔ دوره‌های
      // آماده «حذف‌شده» ثبت می‌شوند تا کاربر خودش از کتابخانهٔ عمومی انتخاب کند.
      if (tab === "register") {
        useApp.getState().setHiddenBuiltins(builtinCourses.map((c) => c.id));
      }
      const { err: pullErr, data } = await sbPullState();
      if (pullErr) {
        // دادهٔ حساب معلوم نیست — هیچ پوشی نه؛ خروج تا سینک خودکار هم چیزی نفرستد
        await sbSignOut();
        setError("داده‌های حساب از ابر دریافت نشد؛ برای حفظ اطلاعاتت کمی بعد دوباره وارد شو.");
        return;
      }
      setPassword("");
      const hasData = !!data && typeof data === "object" && Object.keys(data as object).length > 0;
      if (hasData) {
        if (adoptCloudBlob(data)) {
          // دادهٔ ابر (تازه‌تر) جایگزین شد — اپ با وضعیت حساب بارگذاری می‌شود
          onOpenChange(false);
          setTimeout(() => window.location.reload(), 350);
          return;
        }
        onOpenChange(false);
        return;
      }
      // ابر خالی بود → دادهٔ همین دستگاه به ابر می‌رود
      const blob = collectLocal();
      const pushErr = await sbPushState(blob).catch(() => "net");
      if (!pushErr) noteCloudPushed(blob.savedAt);
      onOpenChange(false);
    } finally {
      holdCloudPush(false);
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] gap-0 overflow-hidden rounded-2xl border-border bg-card p-0 sm:rounded-2xl">
        {/* نوار سرمه‌ای با نشان ترازو */}
        <div className="relative bg-gradient-to-l from-primary to-primary/80 px-6 py-5 text-primary-foreground">
          <span aria-hidden className="pointer-events-none absolute inset-0 opacity-10">
            <Scale className="absolute -start-3 -bottom-5 h-20 w-20 rotate-[-12deg]" />
          </span>
          <DialogHeader className="space-y-1 text-start">
            <DialogTitle className="flex items-center gap-2 font-display text-lg font-bold">
              <ShieldCheck className="h-5 w-5 text-bronze-foreground/90" />
              حساب ابری Lexa
            </DialogTitle>
            <p className="text-xs leading-relaxed opacity-85">
              با ایمیل حساب بساز تا پیشرفتت روی سرور امن ذخیره شود و روی هر دستگاهی با ورود برگردد.
            </p>
          </DialogHeader>
        </div>

        {/* زبانه‌ها */}
        <div className="grid grid-cols-2 border-b border-border bg-background/60 p-1" role="tablist">
          {(["login", "register"] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => { setTab(t); setError(null); setInfo(null); }}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition-all duration-200 ${
                tab === t ? "bg-card text-bronze shadow-card" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "login" ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {t === "login" ? "ورود" : "ثبت‌نام"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} noValidate className="space-y-4 p-6">
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-muted-foreground">ایمیل</span>
            <div className="relative">
              <UserRound className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
              <input
                type="email"
                dir="ltr"
                autoCapitalize="off"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 pe-10 text-start text-sm shadow-inner outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-bronze"
              />
            </div>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-muted-foreground">رمز عبور</span>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
              <input
                type="password"
                dir="ltr"
                autoComplete={tab === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="دست‌کم ۶ نویسه"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 pe-10 text-start text-sm shadow-inner outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-bronze"
              />
            </div>
          </label>

          {tab === "register" && (
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-muted-foreground">تکرار رمز عبور</span>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                <input
                  type="password"
                  dir="ltr"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="همان رمز را دوباره بنویسید"
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 pe-10 text-start text-sm shadow-inner outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-bronze"
                />
              </div>
            </label>
          )}

          {error && (
            <p role="alert" className="flex items-start gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-xs font-medium leading-relaxed text-destructive">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
            </p>
          )}
          {info && (
            <p className="rounded-xl border border-bronze/40 bg-bronze/[0.08] px-4 py-2.5 text-xs font-medium leading-relaxed text-bronze">{info}</p>
          )}

          {tab === "login" && (
            <p className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
              با ورود، پیشرفت ذخیره‌شدهٔ حساب‌ات روی همین دستگاه بارگذاری می‌شود؛
              دادهٔ مهمانِ فعلی به‌صورت خودکار به ابر فرستاده و محفوظ می‌ماند.
            </p>
          )}

          {/* دکمهٔ اصلی فیبر کربن — هم‌شکل دیالوگ دسکتاپ */}
          <button
            type="submit"
            disabled={busy}
            className="btn-carbon inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-bronze disabled:opacity-60"
          >
            <span className="btn-carbon-glow" aria-hidden />
            {busy ? (
              <>
                <Loader2 className="relative z-10 h-4 w-4 animate-spin" /> در حال پردازش…
              </>
            ) : tab === "login" ? (
              <>
                <LogIn className="relative z-10 h-4 w-4" /> ورود به حساب ابری
              </>
            ) : (
              <>
                <CloudUpload className="relative z-10 h-4 w-4" /> ساخت حساب و انتقال پیشرفت من
              </>
            )}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** بخش حساب ابری در هدر APK: مهمان → دکمهٔ ورود؛ واردشده → منوی حساب (همه‌چیز خودکار) */
export function CloudAccountArea() {
  const [user, setUser] = React.useState<SbUser | null>(() => sbUser());
  const [open, setOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<"" | "out">("");

  React.useEffect(() => onAuthChange(() => setUser(sbUser())), []);

  if (!user) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          title="ورود یا ساخت حساب ابری"
          className="btn-carbon inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-bold text-bronze"
        >
          <span className="btn-carbon-glow" aria-hidden />
          <LogIn className="relative z-10 h-[18px] w-[18px]" />
          <span className="relative z-10 hidden sm:inline">ورود / ثبت‌نام</span>
        </button>
        <CloudAuthDialog open={open} onOpenChange={setOpen} />
      </>
    );
  }

  return (
    <>
      <CloudAuthDialog open={open} onOpenChange={setOpen} />
      {/* منوی حساب — رادیکس با پورتال؛ اگر داخل هدر می‌ماند با overflow-hidden هدر کلیپ می‌شد و با لمس آواتار هیچی دیده نمی‌شد */}
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-2 pe-2.5 ps-1.5 shadow-card transition-colors hover:border-bronze/60"
            aria-label={`حساب ابری ${user.email}`}
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-bl from-primary/90 to-bronze text-[11px] font-bold text-primary-foreground">
              {(user.email || "؟").slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden max-w-[120px] truncate text-start text-xs font-bold sm:block" dir="ltr">
              {user.email}
            </span>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" sideOffset={8} className="w-64 rounded-xl p-1.5">
          <DropdownMenuLabel dir="rtl" className="space-y-0.5 px-2">
            <p className="text-[10px] font-bold text-muted-foreground">حساب ابری</p>
            <p className="truncate text-xs font-bold" dir="ltr">{user.email}</p>
            <p className="flex items-center gap-1 pt-0.5 text-[10.5px] text-success">
              <CloudCheck className="h-3 w-3" /> همگام‌سازی خودکار فعال — همه‌چیز ذخیره می‌شود
            </p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => { setMenuOpen(false); navigate({ view: "settings" }); }}
            className="cursor-pointer rounded-lg gap-2.5 py-2.5"
          >
            <Settings className="h-4 w-4 shrink-0 text-bronze" />
            تنظیمات و پروفایل
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={async () => {
              setBusy("out");
              // آخرین ذخیره باید موفق باشد — وگرنه پاک‌سازی دستگاه داده را برای همیشه می‌برد
              const blob = collectLocal();
              const pushErr = await sbPushState(blob).catch(() => "net");
              if (pushErr) {
                setBusy("");
                window.alert("ذخیرهٔ آخر روی ابر انجام نشد؛ برای اینکه چیزی گم نشود هنوز خارج نشدی. اینترنت را بررسی کن و دوباره بزن.");
                return;
              }
              noteCloudPushed(blob.savedAt);
              await sbSignOut();
              // خروج یعنی دادهٔ حساب روی دستگاه نماند — با ورود، از ابر برمی‌گردد
              wipeLocalUserData();
              setBusy("");
            }}
            disabled={busy !== ""}
            className="cursor-pointer rounded-lg gap-2.5 py-2.5 text-danger focus:text-danger"
          >
            {busy === "out" ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <LogOut className="h-4 w-4 shrink-0" />}
            خروج
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
