"use client";
/* Lexa — سینک ابری سبک روی Supabase (REST خالص، بدون SDK)
 * جدول: lexa_state (بلااب هر کاربر) — RLS: فقط مالک */
import { supaUrl, supaKey, supaConfigured } from "./supabase-config";

const TOK_KEY = "lexa-sb-auth-v1";
export type SbUser = { id: string; email: string };
type Tok = { access_token: string; refresh_token: string; user: SbUser };
let current: Tok | null = null;
const listeners = new Set<() => void>();

function load(){ try{ const r = localStorage.getItem(TOK_KEY); current = r ? JSON.parse(r) : null; }catch{ current = null; } }
function save(t: Tok | null){ current = t; try{ t ? localStorage.setItem(TOK_KEY, JSON.stringify(t)) : localStorage.removeItem(TOK_KEY); }catch{} listeners.forEach(f=>f()); }
if (typeof window !== "undefined") load();
export function onAuthChange(f: () => void){ listeners.add(f); return () => { listeners.delete(f); }; }
export function sbUser(){ return current?.user ?? null; }
export function sbReady(){ return supaConfigured(); }

async function call(path: string, opts: RequestInit = {}): Promise<Response>{
  const res = await fetch(supaUrl() + path, { ...opts, headers: { apikey: supaKey(), Authorization: "Bearer " + (current?.access_token ?? supaKey()), "Content-Type": "application/json", ...(opts.headers||{}) } });
  if (res.status === 401 && current?.refresh_token) { const ok = await refresh(); if (ok) return call(path, opts); }
  return res;
}
async function refresh(): Promise<boolean>{
  try{
    const res = await fetch(supaUrl()+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:{apikey:supaKey(),"Content-Type":"application/json"},body:JSON.stringify({refresh_token:current!.refresh_token})});
    if(!res.ok){ save(null); return false; }
    const j = await res.json();
    save({access_token:j.access_token,refresh_token:j.refresh_token,user:{id:j.user.id,email:j.user.email||""}});
    return true;
  }catch{ return false; }
}
export async function sbSignUp(email: string, password: string): Promise<string|null>{
  if(!supaConfigured()) return "اتصال به حساب ابری برقرار نشد — سرویس در دسترس نیست";
  try{
    const res = await fetch(supaUrl()+"/auth/v1/signup",{method:"POST",headers:{apikey:supaKey(),"Content-Type":"application/json"},body:JSON.stringify({email,password})});
    const j = await res.json();
    if(!res.ok) return j.msg || j.error_description || j.error || "خطا در ثبت‌نام";
    if(j.access_token) save({access_token:j.access_token,refresh_token:j.refresh_token,user:{id:j.user.id,email:j.user.email||""}});
    else return "ثبت‌نام شد؛ ایمیل خود را تأیید و وارد شوید";
    return null;
  }catch(e){ return String(e); }
}
export async function sbSignIn(email: string, password: string): Promise<string|null>{
  if(!supaConfigured()) return "اتصال به حساب ابری برقرار نشد — سرویس در دسترس نیست";
  try{
    const res = await fetch(supaUrl()+"/auth/v1/token?grant_type=password",{method:"POST",headers:{apikey:supaKey(),"Content-Type":"application/json"},body:JSON.stringify({email,password})});
    const j = await res.json();
    if(!res.ok) return j.error_description || j.msg || "ایمیل یا رمز درست نیست";
    save({access_token:j.access_token,refresh_token:j.refresh_token,user:{id:j.user.id,email:j.user.email||""}});
    return null;
  }catch(e){ return String(e); }
}
export async function sbSignOut(){ try{ await call("/auth/v1/logout",{method:"POST",body:"{}"}); }catch{} save(null); }
export async function sbPushState(blob: unknown): Promise<string|null>{
  if(!sbUser()) return "not-logged-in";
  const uid = sbUser()!.id;
  const res = await call("/rest/v1/lexa_state",{method:"POST",headers:{Prefer:"resolution=merge-duplicates"},body:JSON.stringify({user_id:uid,data:blob,updated_at:new Date().toISOString()})});
  return res.ok ? null : ("push:"+res.status);
}
export async function sbPullState(): Promise<{err:string|null,data:unknown|null}>{
  if(!sbUser()) return {err:"not-logged-in",data:null};
  const res = await call("/rest/v1/lexa_state?user_id=eq." + sbUser()!.id + "&select=data&limit=1");
  if(!res.ok) return {err:"pull:"+res.status,data:null};
  const rows = await res.json();
  return {err:null,data:rows?.[0]?.data ?? null};
}

/* ─── بلاب محلی کامل دستگاه (استور + مباحث ضعیف + نشان‌های قانون) ────────────
 * بین CloudSyncCard (تنظیمات) و دیالوگ حساب ابری مشترک است.
 * کلید API هوش مصنوعی (state.ai.apiKey) هرگز به ابر نمی‌رود و با اعمال بلاب ابر
 * هم از روی دستگاه پاک نمی‌شود. */
const STORE_KEY = "lexa-store-v1";
const WEAK_KEY = "hoh_weak_topics";
const MARKS_KEY = "lexa-law-marks";

type StoreBlob = { state?: { ai?: Record<string, unknown> } & Record<string, unknown> } & Record<string, unknown>;

function withApiKey(store: unknown, apiKey: unknown): unknown {
  const s = store as StoreBlob | null;
  if (!s || typeof s !== "object" || !s.state?.ai) return store;
  return { ...s, state: { ...s.state, ai: { ...s.state.ai, apiKey } } };
}

export function collectLocal(): Record<string, unknown> {
  const read = (k: string) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };
  // کلید شخصی API فقط روی همین دستگاه می‌ماند
  const store = withApiKey(read(STORE_KEY), "");
  return { store, weakTopics: read(WEAK_KEY), lawMarks: read(MARKS_KEY), savedAt: Date.now() };
}

export function applyLocal(data: Record<string, unknown>): string[] {
  const done: string[] = [];
  const put = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); done.push(k); } catch { /* ignore */ } };
  const d = data as { store?: unknown; weakTopics?: unknown; lawMarks?: unknown };
  if (d.store) {
    // کلید API محلی حفظ می‌شود (بلاب ابر آن را ندارد)
    let store = d.store;
    try {
      const cur = JSON.parse(localStorage.getItem(STORE_KEY) || "null") as StoreBlob | null;
      const localKey = cur?.state?.ai?.apiKey;
      const incoming = store as StoreBlob;
      if (localKey && incoming?.state?.ai && !incoming.state.ai.apiKey) store = withApiKey(store, localKey);
    } catch { /* ignore */ }
    put(STORE_KEY, store);
  }
  if (d.weakTopics) put(WEAK_KEY, d.weakTopics);
  if (d.lawMarks) put(MARKS_KEY, d.lawMarks);
  return done;
}
