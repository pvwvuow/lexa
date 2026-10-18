// Lexa admin-users: account actions of the platform admin console (phase A1 of docs/ADMIN_PLATFORM.md,
// setup in docs/ADMIN_A1_SETUP.md). Deploy:  supabase functions deploy admin-users --no-verify-jwt
//
// Secrets (Edge Function settings):
//   LEXA_SERVICE_KEY      secret / service_role key (falls back to SUPABASE_SERVICE_ROLE_KEY)
//   LEXA_PUBLISHABLE_KEY  publishable / anon key   (falls back to SUPABASE_ANON_KEY)
//
// POST /functions/v1/admin-users  { action, user_id, reason }
//   action: suspend | unsuspend | revoke_sessions | reset_mfa
//
// Order: 1) lexa_admin_user_authorize runs with the caller's own token, so the database decides
// (Lexa admin, two-factor session, reason, not on yourself, never an admin) and writes the audit
// entry; 2) only then the auth admin API is called with the service key; 3) the result is audited.
// The answer never contains e-mail addresses, tokens or factor secrets.

const SB_URL = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const SERVICE_KEY = Deno.env.get("LEXA_SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PUBLIC_KEY = Deno.env.get("LEXA_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS = new Set(["suspend", "unsuspend", "revoke_sessions", "reset_mfa"]);
const BAN_FOREVER = "876000h"; // 100 years

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

class Fail extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS },
  });
}

function svcHeaders(): Record<string, string> {
  const h: Record<string, string> = { apikey: SERVICE_KEY, "Content-Type": "application/json" };
  if (SERVICE_KEY.startsWith("eyJ")) h.Authorization = `Bearer ${SERVICE_KEY}`;
  return h;
}

async function svcRpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: svcHeaders(), body: JSON.stringify(args) });
  const t = await res.text();
  if (!res.ok) {
    console.error("svc rpc", fn, res.status, t.slice(0, 200));
    throw new Fail(500, "db_error");
  }
  return t ? JSON.parse(t) : null;
}

async function authAdmin(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SB_URL}/auth/v1/admin/${path}`, { ...init, headers: { ...svcHeaders(), ...(init.headers ?? {}) } });
}

async function userFrom(req: Request): Promise<{ token: string; id: string }> {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new Fail(401, "not_signed_in");
  const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: PUBLIC_KEY, Authorization: `Bearer ${token}` } });
  if (!u.ok) throw new Fail(401, "not_signed_in");
  const body = (await u.json().catch(() => ({}))) as { id?: string };
  if (!body.id) throw new Fail(401, "not_signed_in");
  return { token, id: body.id };
}

// the database check, as the caller
const DB_ERRORS: [RegExp, number, string][] = [
  [/admin only/, 403, "admin_only"],
  [/mfa required/, 403, "mfa_required"],
  [/reason required/, 400, "reason_required"],
  [/not on yourself/, 400, "not_on_yourself"],
  [/demote the admin first/, 400, "admin_target"],
  [/user not found/, 404, "user_not_found"],
  [/bad action/, 400, "bad_action"],
];
async function authorize(token: string, uid: string, action: string, reason: string): Promise<void> {
  const res = await fetch(`${SB_URL}/rest/v1/rpc/lexa_admin_user_authorize`, {
    method: "POST",
    headers: { apikey: PUBLIC_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ uid, act: action, reason }),
  });
  if (res.ok) return;
  const t = await res.text();
  const msg = t.match(/"message"\s*:\s*"([^"]{1,80})"/)?.[1] ?? "";
  for (const [re, status, code] of DB_ERRORS) if (re.test(msg)) throw new Fail(status, code);
  console.error("authorize", res.status, t.slice(0, 200));
  throw new Fail(500, "db_error");
}

async function setBan(uid: string, duration: string): Promise<void> {
  const res = await authAdmin(`users/${uid}`, { method: "PUT", body: JSON.stringify({ ban_duration: duration }) });
  if (!res.ok) {
    console.error("ban", res.status, (await res.text()).slice(0, 200));
    throw new Fail(502, "auth_failed");
  }
}

async function revoke(uid: string): Promise<boolean> {
  return Boolean(await svcRpc("lexa_svc_revoke_sessions", { uid }));
}

async function resetMfa(uid: string): Promise<number> {
  const res = await authAdmin(`users/${uid}/factors`);
  if (!res.ok) {
    console.error("factors", res.status, (await res.text()).slice(0, 200));
    throw new Fail(502, "auth_failed");
  }
  const list = (await res.json().catch(() => [])) as { id?: string }[] | { factors?: { id?: string }[] };
  const factors = Array.isArray(list) ? list : list.factors ?? [];
  let n = 0;
  for (const f of factors) {
    if (!f.id || !UUID_RE.test(f.id)) continue;
    const d = await authAdmin(`users/${uid}/factors/${f.id}`, { method: "DELETE" });
    if (!d.ok) {
      console.error("factor delete", d.status);
      throw new Fail(502, "auth_failed");
    }
    n += 1;
  }
  return n;
}

async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") throw new Fail(405, "method_not_allowed");
  if (!SB_URL || !SERVICE_KEY || !PUBLIC_KEY) throw new Fail(500, "not_configured");

  const me = await userFrom(req);
  const body = (await req.json().catch(() => ({}))) as { action?: unknown; user_id?: unknown; reason?: unknown };
  const action = String(body.action ?? "");
  const uid = String(body.user_id ?? "");
  const reason = String(body.reason ?? "").trim().slice(0, 300);
  if (!ACTIONS.has(action)) throw new Fail(400, "bad_action");
  if (!UUID_RE.test(uid)) throw new Fail(400, "bad_user");

  await authorize(me.token, uid, action, reason);

  let detail: Record<string, unknown> = {};
  try {
    if (action === "suspend") {
      await setBan(uid, BAN_FOREVER);
      const ended = await revoke(uid);
      await svcRpc("lexa_svc_user_flag", { uid, p_suspended: true, by_user: me.id, p_reason: reason });
      detail = { sessions_ended: ended };
    } else if (action === "unsuspend") {
      await setBan(uid, "none");
      await svcRpc("lexa_svc_user_flag", { uid, p_suspended: false, by_user: me.id, p_reason: reason });
    } else if (action === "revoke_sessions") {
      detail = { sessions_ended: await revoke(uid) };
    } else {
      const removed = await resetMfa(uid);
      const ended = await revoke(uid);
      detail = { factors_removed: removed, sessions_ended: ended };
    }
  } catch (e) {
    const code = e instanceof Fail ? e.code : "error";
    await svcRpc("lexa_svc_admin_audit", {
      by_user: me.id, act: `admin.user.${action}`, tgt: uid, info: { stage: "failed", reason, error: code },
    }).catch(() => undefined);
    throw e;
  }
  await svcRpc("lexa_svc_admin_audit", {
    by_user: me.id, act: `admin.user.${action}`, tgt: uid, info: { stage: "done", reason, ...detail },
  });
  return json(200, { ok: true, action, ...detail });
}

Deno.serve(async (req) => {
  try {
    return await handle(req);
  } catch (e) {
    if (e instanceof Fail) return json(e.status, { ok: false, error: e.code });
    console.error("unhandled", e instanceof Error ? e.message : String(e));
    return json(500, { ok: false, error: "error" });
  }
});
