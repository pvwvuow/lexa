"use client";
/* Sign-in for accounts made by an education centre: centre code + centre username + password.
 * Shown as a second mode next to the normal Lexa sign-in (see docs/ORG_P1_SETUP.md). */
import * as React from "react";
import { Building2, KeyRound, Loader2, LogIn, UserRound } from "lucide-react";
import { orgAccountError, orgSignIn, toLatinDigits } from "@/lib/cloud-api/org-accounts";

const INPUT =
  "w-full rounded-xl border border-border bg-background px-4 py-2.5 pe-10 text-start text-sm shadow-inner outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-bronze";

export function OrgSignInForm({ onDone }: { onDone?: (r: { mustChange: boolean }) => void }) {
  const [org, setOrg] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const r = await orgSignIn(org, toLatinDigits(username), password);
      setPassword("");
      onDone?.(r);
    } catch (err) {
      setError(orgAccountError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" dir="rtl">
      <p className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
        اگر دانشگاه یا مؤسسهٔ شما برایتان حساب ساخته است، با کد مرکز و نام کاربری‌ای که مرکز داده (مثلاً شمارهٔ دانشجویی) وارد شوید.
      </p>
      <label className="block space-y-1.5">
        <span className="text-xs font-bold text-muted-foreground">کد مرکز آموزشی</span>
        <div className="relative">
          <Building2 className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <input dir="ltr" autoCapitalize="off" autoComplete="organization" value={org}
            onChange={(e) => setOrg(e.target.value.toLowerCase())} placeholder="مثلاً ut" className={INPUT} required />
        </div>
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-bold text-muted-foreground">نام کاربری مرکز</span>
        <div className="relative">
          <UserRound className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <input dir="ltr" autoCapitalize="off" autoComplete="username" value={username}
            onChange={(e) => setUsername(e.target.value)} placeholder="مثلاً 4001234" className={INPUT} required />
        </div>
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-bold text-muted-foreground">رمز عبور</span>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <input type="password" dir="ltr" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} className={INPUT} required />
        </div>
      </label>
      {error && (
        <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-xs font-medium leading-relaxed text-destructive">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy || !org.trim() || !username.trim() || !password}
        className="btn-carbon inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-bronze">
        <span className="btn-carbon-glow" aria-hidden />
        {busy ? <Loader2 className="relative z-10 h-4 w-4 animate-spin" /> : <LogIn className="relative z-10 h-4 w-4" />}
        ورود با حساب مرکز
      </button>
    </form>
  );
}
