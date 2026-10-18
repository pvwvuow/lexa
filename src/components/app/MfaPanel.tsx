"use client";
/* Two-factor sign-in for centre managers and Lexa admins. Student data (roster, activity,
 * grades, audit log) is only readable from an "aal2" session. */
import * as React from "react";
import { KeyRound, Loader2, ShieldAlert, ShieldCheck, Smartphone } from "lucide-react";
import { enrollTotp, listFactors, useAal, verifyTotp, type Factor } from "@/lib/mfa";

export function MfaPanel({ compact = false }: { compact?: boolean }) {
  const aal = useAal();
  const [factors, setFactors] = React.useState<Factor[] | null>(null);
  const [enroll, setEnroll] = React.useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const reload = React.useCallback(async () => {
    try { setFactors(await listFactors()); } catch { setFactors([]); }
  }, []);
  React.useEffect(() => { void reload(); }, [reload, aal]);

  const verified = factors?.find((f) => f.status === "verified") ?? null;

  async function start() {
    setBusy(true); setError("");
    try { setEnroll(await enrollTotp()); } catch (e) { setError(e instanceof Error ? e.message : "شروع ثبت ناموفق بود."); }
    finally { setBusy(false); }
  }
  async function confirm(e?: React.FormEvent) {
    e?.preventDefault();
    const id = enroll?.factorId ?? verified?.id;
    if (!id || busy) return;
    setBusy(true); setError("");
    try {
      await verifyTotp(id, code);
      setCode(""); setEnroll(null);
      await reload();
    } catch {
      setError("کد نادرست یا منقضی است؛ کد تازهٔ برنامه را وارد کنید.");
    } finally { setBusy(false); }
  }

  if (aal === "aal2") {
    return compact ? null : (
      <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-700 dark:text-emerald-400" dir="rtl">
        <ShieldCheck className="h-4 w-4" /> ورود دومرحله‌ای تأیید شده است.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4" dir="rtl">
      <div className="flex items-center gap-2 text-sm font-bold"><ShieldAlert className="h-4 w-4 text-amber-600" /> ورود دومرحله‌ای لازم است</div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        برای دیدن و مدیریت اطلاعات دانشجویان، مدیران مرکز و مدیران Lexa باید با کد شش‌رقمی برنامهٔ احراز هویت
        (مثل Google Authenticator یا Microsoft Authenticator) هم وارد شوند.
      </p>
      {factors === null ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : !verified && !enroll ? (
        <button type="button" onClick={() => void start()} disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />} فعال‌سازی ورود دومرحله‌ای
        </button>
      ) : (
        <form onSubmit={confirm} className="space-y-3">
          {enroll && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">این تصویر را با برنامهٔ احراز هویت اسکن کنید، سپس کد شش‌رقمی را وارد کنید:</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={enroll.qr} alt="QR" className="h-44 w-44 rounded-xl bg-white p-2" />
              <p className="text-[11px] text-muted-foreground">اگر اسکن ممکن نیست، این کلید را دستی وارد کنید:</p>
              <code dir="ltr" className="block select-all break-all rounded-lg bg-muted px-2 py-1 text-xs">{enroll.secret}</code>
            </div>
          )}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <KeyRound className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
              <input dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^\d۰-۹]/g, "").replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)))}
                placeholder="123456" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-center font-mono tracking-widest outline-none focus:border-bronze" />
            </div>
            <button type="submit" disabled={busy || code.length < 6} className="inline-flex items-center gap-1 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} تأیید
            </button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** renders children only from a two-factor session; otherwise the MFA panel */
export function MfaRequired({ children }: { children: React.ReactNode }) {
  const aal = useAal();
  if (aal !== "aal2") return <MfaPanel />;
  return <>{children}</>;
}
