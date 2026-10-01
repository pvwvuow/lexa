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
  if(!supaConfigured()) return "ساپابیس تنظیم نشده است";
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
  if(!supaConfigured()) return "ساپابیس تنظیم نشده است";
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
