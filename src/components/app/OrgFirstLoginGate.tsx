"use client";
/* Mounted once in the app shell. After a centre-made account signs in for the first time it
 * must change the first password and accept the centre's terms; someone who linked an
 * existing account with an activation code only accepts the terms. Until then the account is
 * not an official student (RLS: lexa_org_official). */
import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KeyRound, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { onAuthChange, sbSignOut, sbUser } from "@/lib/supabase";
import {
  acceptOrgTerms, mustChangePassword, myOrgAccounts, orgAccountError, setFirstPassword, type MyOrgAccount,
} from "@/lib/cloud-api/org-accounts";

const INPUT =
  "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-start text-sm shadow-inner outline-none focus:border-bronze";

export function OrgFirstLoginGate() {
  const [uid, setUid] = React.useState<string | null>(() => sbUser()?.id ?? null);
  const [mustChange, setMustChange] = React.useState(false);
  const [pending, setPending] = React.useState<MyOrgAccount[]>([]);
  const [pw, setPw] = React.useState("");
  const [pw2, setPw2] = React.useState("");
  const [agree, setAgree] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => onAuthChange(() => setUid(sbUser()?.id ?? null)), []);

  const check = React.useCallback(async () => {
    if (!sbUser()) { setMustChange(false); setPending([]); return; }
    try {
      const [mc, accounts] = await Promise.all([mustChangePassword(), myOrgAccounts()]);
      setMustChange(mc);
      setPending(accounts.filter((a) => !a.termsAcceptedAt && a.status !== "suspended"));
    } catch {
      // 006 not installed yet or offline: never block the app because of this check
      setMustChange(false);
      setPending([]);
    }
  }, []);
  React.useEffect(() => { void check(); }, [check, uid]);
  React.useEffect(() => {
    const f = () => { void check(); };
    window.addEventListener("lexa-org-accounts-changed", f);
    return () => window.removeEventListener("lexa-org-accounts-changed", f);
  }, [check]);

  const open = !!uid && (mustChange || pending.length > 0);
  const names = pending.map((p) => p.orgName).filter(Boolean).join("، ") || "مرکز آموزشی شما";

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setError("");
    if (mustChange) {
      if (pw.length < 8) return setError("رمز تازه باید دست‌کم ۸ نویسه باشد.");
      if (pw !== pw2) return setError("تکرار رمز با رمز تازه یکسان نیست.");
    }
    if (pending.length && !agree) return setError("برای ادامه، شرایط را تأیید کنید.");
    setBusy(true);
    try {
      if (mustChange) await setFirstPassword(pw, pending.length > 0 && agree);
      else for (const p of pending) await acceptOrgTerms(p.orgId);
      setPw(""); setPw2(""); setAgree(false);
      await check();
    } catch (err) {
      setError(orgAccountError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  return (
    <Dialog open={open} onOpenChange={() => { /* cannot be dismissed; sign out instead */ }}>
      <DialogContent className="max-w-[440px] rounded-2xl border-border bg-card p-6" dir="rtl">
        <DialogHeader className="space-y-1 text-start">
          <DialogTitle className="flex items-center gap-2 font-display text-lg font-bold">
            <ShieldCheck className="h-5 w-5 text-bronze" />
            {mustChange ? "رمز اولیه را عوض کنید" : "تأیید حساب دانشجویی"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="mt-3 space-y-4">
          {mustChange && (
            <>
              <p className="text-xs leading-relaxed text-muted-foreground">
                این حساب را مرکز آموزشی ساخته است. برای امنیت، رمز اولیه را با رمزی که فقط خودتان می‌دانید عوض کنید
                (دست‌کم ۸ نویسه، بدون نام کاربری یا شمارهٔ دانشجویی).
              </p>
              <label className="block space-y-1.5">
                <span className="flex items-center gap-1 text-xs font-bold text-muted-foreground"><KeyRound className="h-3.5 w-3.5" /> رمز تازه</span>
                <input type="password" dir="ltr" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className={INPUT} required />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-muted-foreground">تکرار رمز تازه</span>
                <input type="password" dir="ltr" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={INPUT} required />
              </label>
            </>
          )}
          {pending.length > 0 && (
            <label className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-xs leading-relaxed">
              <input type="checkbox" className="mt-0.5" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>
                می‌پذیرم که <b>{names}</b> زمان مطالعه، پیشرفت، نتیجهٔ آزمون‌ها و نمره‌های من در Lexa را ببیند و
                حساب دانشجویی‌ام را مدیریت کند. داده‌های شخصی‌ام (یادداشت‌ها و پیشرفت) را هر وقت بخواهم می‌توانم پاک کنم.
              </span>
            </label>
          )}
          {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn-carbon inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-bronze">
              <span className="btn-carbon-glow" aria-hidden />
              {busy && <Loader2 className="relative z-10 h-4 w-4 animate-spin" />}
              تأیید و ادامه
            </button>
            <button type="button" onClick={() => void sbSignOut()} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4" /> خروج
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
