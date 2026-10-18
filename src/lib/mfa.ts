"use client";
/* Two-factor sign-in (TOTP) over the Supabase Auth REST API. Managers of a centre and Lexa
 * admins need an "aal2" session to read student data (supabase/006_org_accounts.sql). */
import * as React from "react";
import { onAuthChange, sbAal, sbAdoptSession, sbFetch, sbUser } from "@/lib/supabase";

export interface Factor { id: string; type: string; status: "verified" | "unverified"; name: string }

async function authJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await sbFetch(`/auth/v1/${path}`, init);
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(j.msg ?? j.error_description ?? j.error ?? `auth ${res.status}`));
  return j as T;
}

export async function listFactors(): Promise<Factor[]> {
  if (!sbUser()) return [];
  const u = await authJson<{ factors?: { id: string; factor_type: string; status: string; friendly_name?: string }[] }>("user");
  return (u.factors ?? []).map((f) => ({
    id: f.id, type: f.factor_type, status: f.status === "verified" ? "verified" : "unverified", name: f.friendly_name ?? "",
  }));
}

/** start TOTP enrolment: QR image (data URL or SVG) + secret for manual entry */
export async function enrollTotp(): Promise<{ factorId: string; qr: string; secret: string }> {
  // a half-finished enrolment blocks a new one with the same name
  for (const f of await listFactors()) {
    if (f.status === "unverified") await authJson(`factors/${f.id}`, { method: "DELETE" }).catch(() => null);
  }
  const r = await authJson<{ id: string; totp: { qr_code: string; secret: string } }>("factors", {
    method: "POST",
    body: JSON.stringify({ factor_type: "totp", friendly_name: `Lexa ${new Date().toISOString().slice(0, 10)}`, issuer: "Lexa" }),
  });
  const qr = r.totp.qr_code.startsWith("data:") ? r.totp.qr_code : `data:image/svg+xml;utf8,${encodeURIComponent(r.totp.qr_code)}`;
  return { factorId: r.id, qr, secret: r.totp.secret };
}

/** verify a 6-digit code; on success the session becomes aal2 */
export async function verifyTotp(factorId: string, code: string): Promise<void> {
  const ch = await authJson<{ id: string }>(`factors/${factorId}/challenge`, { method: "POST", body: "{}" });
  const s = await authJson<{ access_token: string; refresh_token: string; user: { id: string; email?: string } }>(
    `factors/${factorId}/verify`,
    { method: "POST", body: JSON.stringify({ challenge_id: ch.id, code: code.replace(/\D/g, "") }) },
  );
  sbAdoptSession(s);
}

/** current assurance level, re-read on every sign-in / token change */
export function useAal(): string {
  const [aal, setAal] = React.useState(() => sbAal());
  React.useEffect(() => onAuthChange(() => setAal(sbAal())), []);
  return aal;
}
