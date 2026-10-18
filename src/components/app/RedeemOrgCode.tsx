"use client";
/* For people who already have a Lexa account: enter the one-time code the centre gave you to
 * become an official student with the same account (notes and progress stay). */
import * as React from "react";
import { Loader2, Ticket } from "lucide-react";
import { orgAccountError, redeemActivationCode } from "@/lib/cloud-api/org-accounts";

export function RedeemOrgCode({ onDone }: { onDone?: (orgId: string) => void }) {
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await redeemActivationCode(code);
      if (r.ok) {
        setCode("");
        setMsg({ ok: true, text: "حساب شما به مرکز آموزشی وصل شد؛ شرایط مرکز را تأیید کنید." });
        onDone?.(r.orgId);
        // the first-login gate shows the terms
        window.dispatchEvent(new Event("lexa-org-accounts-changed"));
      } else setMsg({ ok: false, text: r.reason });
    } catch (err) {
      setMsg({ ok: false, text: orgAccountError(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-card p-4" dir="rtl">
      <div className="flex items-center gap-2 text-sm font-bold"><Ticket className="h-4 w-4 text-bronze" /> کد فعال‌سازی مرکز آموزشی</div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        اگر دانشگاه یا مؤسسه به شما کد فعال‌سازی داده، اینجا وارد کنید تا با همین حساب دانشجوی رسمی آن مرکز شوید.
      </p>
      <div className="flex gap-2">
        <input dir="ltr" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX-XXXX"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-center font-mono text-sm tracking-widest outline-none focus:border-bronze" />
        <button type="submit" disabled={busy || !code.trim()} className="inline-flex items-center gap-1 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} ثبت
        </button>
      </div>
      {msg && <p className={`text-xs ${msg.ok ? "text-emerald-600" : "text-destructive"}`}>{msg.text}</p>}
    </form>
  );
}
