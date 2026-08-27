"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Scale, UserRound, KeyRound, Loader2, CloudUpload, ShieldCheck, LogIn, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth-client";

type Tab = "login" | "register";

/** پنجرهٔ ورود / ثبت‌نام — با اطلاع‌رسانی انتقال پیشرفت محلی به حساب */
export function AuthDialog({
  open,
  onOpenChange,
  initialTab = "login",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialTab?: Tab;
}) {
  const auth = useAuth();
  const [tab, setTab] = React.useState<Tab>(initialTab);
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setTab(initialTab);
      setError(null);
      setPassword("");
      setConfirm("");
    }
  }, [open, initialTab]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setError(null);
    const uname = username.trim();
    if (tab === "register" && password !== confirm) {
      setError("تکرار رمز عبور با رمز اصلی یکسان نیست.");
      return;
    }
    setBusy(true);
    const res =
      tab === "login"
        ? await auth.login(uname, password)
        : await auth.register(uname, password);
    setBusy(false);
    if (res.ok) {
      onOpenChange(false);
      setUsername("");
    } else {
      setError(res.error ?? "خطای ناشناخته.");
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
              حساب کاربری همیار حقوق
            </DialogTitle>
            <p className="text-xs leading-relaxed opacity-85">
              با ساخت حساب، همهٔ پیشرفت شما امن در پایگاه داده ذخیره و برای همیشه نگه‌داری می‌شود.
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
              onClick={() => { setTab(t); setError(null); }}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition-all duration-200 ${
                tab === t ? "bg-card text-bronze shadow-card" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "login" ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {t === "login" ? "ورود" : "ثبت‌نام"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4 p-6">
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-muted-foreground">نام کاربری</span>
            <div className="relative">
              <UserRound className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
              <input
                dir="ltr"
                autoCapitalize="off"
                autoComplete={tab === "login" ? "username" : "username new-password"}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="مثلاً ali_rahnama یا رضا۱"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 pe-10 text-start text-sm shadow-inner outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-bronze"
                required
              />
            </div>
            <span className="block text-[10.5px] leading-relaxed text-muted-foreground/70">
              حروف فارسی یا لاتین، رقم، زیرخط و نقطه؛ بین ۳ تا ۲۰ نویسه.
            </span>
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
                required
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
                  required
                />
              </div>
            </label>
          )}

          {error && (
            <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-xs font-medium leading-relaxed text-destructive">
              {error}
            </p>
          )}

          {tab === "login" && (
            <p className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
              با ورود، وضعیت ذخیره‌شدهٔ خودِ حساب شما بارگذاری می‌شود؛ مطالعهٔ مهمانِ همین دستگاه
              به حساب شما ادغام نمی‌شود و فقط از آن نسخهٔ پشتیبان محلی برداشته می‌شود.
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !username.trim() || !password}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-card transition-all duration-200 hover:brightness-110 disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> در حال پردازش…
              </>
            ) : tab === "login" ? (
              <>
                <LogIn className="h-4 w-4" /> ورود به حساب
              </>
            ) : (
              <>
                <CloudUpload className="h-4 w-4" /> ساخت حساب و انتقال پیشرفت من
              </>
            )}
          </button>

          {tab === "register" && (
            <p className="rounded-xl border border-dashed border-bronze/40 bg-bronze/[0.06] px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
              هرچه تا این‌جا بدون حساب مطالعه کرده‌اید (جلسات، تست‌ها، یادداشت‌ها)
              دقیقاً بعد از ثبت‌نام به حساب‌تان منتقل می‌شود و دیگر هیچ‌وقت از دست نمی‌رود.
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
