export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://tldjbpfcibangzmvzwfw.supabase.co";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_IaPGLBkmRkcsGlVE865PZw_krAWWmsz";

// localStorage overrides make the client send the user's session token to
// whatever URL is stored there, so they only work in dev or in builds that
// opt in with NEXT_PUBLIC_ALLOW_SUPABASE_OVERRIDE=1.
const ALLOW_OVERRIDE =
  process.env.NEXT_PUBLIC_ALLOW_SUPABASE_OVERRIDE === "1" || process.env.NODE_ENV === "development";

function override(key: string): string | null {
  if (!ALLOW_OVERRIDE) return null;
  try { return localStorage.getItem(key); } catch { return null; }
}

export function supaUrl(){ return override("lexa-supabase-url") || SUPABASE_URL; }
export function supaKey(){ return override("lexa-supabase-key") || SUPABASE_ANON_KEY; }
export function supaConfigured(){ return !!supaUrl() && !!supaKey(); }
