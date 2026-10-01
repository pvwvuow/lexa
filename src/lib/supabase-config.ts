export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://tldjbpfcibangzmvzwfw.supabase.co";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_IaPGLBkmRkcsGlVE865PZw_krAWWmsz";
export function supaUrl(){ try{ return localStorage.getItem("lexa-supabase-url") || SUPABASE_URL; }catch{ return SUPABASE_URL; } }
export function supaKey(){ try{ return localStorage.getItem("lexa-supabase-key") || SUPABASE_ANON_KEY; }catch{ return SUPABASE_ANON_KEY; } }
export function supaConfigured(){ return !!supaUrl() && !!supaKey(); }
