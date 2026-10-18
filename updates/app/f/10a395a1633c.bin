// Lexa org-api: the Lexa API for centres (phase 5 of docs/ORG_LEARNING.md; reference in docs/ORG_API.md).
// Deploy:  supabase functions deploy org-api --no-verify-jwt
// (API callers have no Supabase session; every request is checked here.)
//
// Secrets (Edge Function settings):
//   LEXA_SERVICE_KEY      secret / service_role key (falls back to SUPABASE_SERVICE_ROLE_KEY)
//   LEXA_PUBLISHABLE_KEY  publishable / anon key   (falls back to SUPABASE_ANON_KEY)
//   LEXA_API_PEPPER       long random string (at least 32 characters). Every API secret is
//                         HMAC(pepper, key id + salt); the database never holds a secret.
//                         Changing the pepper invalidates every key.
//   LEXA_INTERNAL_EMAIL_DOMAIN  optional, same as org-auth (default "accounts.lexa.invalid")
//   LEXA_API_RATE_PER_MIN optional, requests per key and minute (default 120)
//
// Routes (prefix /functions/v1/org-api):
//   POST /manage                      app only (user session): create_key, rotate_key
//   GET  /v1/openapi.json             no auth
//   GET  /v1/ping                     any scope
//   POST /v1/students                 students:write    (accounts; passwords shown once)
//   POST /v1/staff                    staff:write       (teacher accounts)
//   POST /v1/students/{ref}/status    status:write
//   POST /v1/classes                  classes:write
//   POST /v1/enrollments              enrollments:write
//   POST /v1/grades                   grades:write
//   POST /v1/prior-gpa                grades:write
//   GET  /v1/reports/students|classes|grades|study   reports:read
// Signed requests: X-Lexa-Key, X-Lexa-Timestamp, X-Lexa-Signature (see docs/ORG_API.md).
// POST needs an Idempotency-Key. Sandbox keys run every write as a dry run.
// No secret, password, code, token or request body is ever logged.

const SB_URL = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const SERVICE_KEY = Deno.env.get("LEXA_SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PUBLIC_KEY = Deno.env.get("LEXA_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const PEPPER = Deno.env.get("LEXA_API_PEPPER") ?? "";
const EMAIL_DOMAIN = Deno.env.get("LEXA_INTERNAL_EMAIL_DOMAIN") ?? "accounts.lexa.invalid";
const RATE_PER_MIN = Math.max(1, Number(Deno.env.get("LEXA_API_RATE_PER_MIN") ?? "120") || 120);

const VERSION = "1.0.0";
const MAX_BODY = 1_000_000;
const MAX_PEOPLE = 300;
const CLOCK_SKEW_S = 300;
const USERNAME_RE = /^[A-Za-z0-9._-]{2,40}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY_RE = /^lxk_(live|test)_([0-9a-f-]{36})$/i;

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

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
  });
}

// --- service-key REST helpers (same as org-auth) ---
function svcHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { apikey: SERVICE_KEY, "Content-Type": "application/json", ...extra };
  if (SERVICE_KEY.startsWith("eyJ")) h.Authorization = `Bearer ${SERVICE_KEY}`;
  return h;
}

async function rest<T = unknown>(path: string, init: RequestInit & { prefer?: string } = {}): Promise<T> {
  const headers = svcHeaders(init.prefer ? { Prefer: init.prefer } : {});
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    const m = t.match(/"message"\s*:\s*"([a-z_]{3,40})"/);
    console.error("rest", path.split("?")[0], res.status, t.slice(0, 300));
    if (m && /^(org_not_active|bad_batch|bad_input|not_found)$/.test(m[1])) throw new Fail(400, m[1]);
    throw new Fail(500, "db_error");
  }
  const t = await res.text();
  return (t ? JSON.parse(t) : null) as T;
}

async function restAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  for (let off = 0; off < 200_000; off += 1000) {
    const page = await rest<T[]>(`${path}&limit=1000&offset=${off}`);
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

const rpc = <T = unknown>(fn: string, args: Record<string, unknown>) =>
  rest<T>(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });

async function authAdmin<T = unknown>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${SB_URL}/auth/v1/admin/${path}`, {
    method, headers: svcHeaders(), body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error("auth admin", path.split("/")[0], res.status, t.slice(0, 300));
    throw new Fail(500, "auth_error");
  }
  const t = await res.text();
  return (t ? JSON.parse(t) : null) as T;
}

async function audit(org: string | null, action: string, target: string | null, detail: Record<string, unknown> = {}) {
  await rest("lexa_audit_log", {
    method: "POST", prefer: "return=minimal", body: JSON.stringify({ actor: null, org_id: org, action, target, detail }),
  }).catch(() => {});
}

// --- crypto ---
const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
function b64url(b: ArrayBuffer): string {
  let s = "";
  for (const x of new Uint8Array(b)) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function hmac(key: string, msg: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, enc.encode(msg));
}
async function sha256Hex(s: string | Uint8Array): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", typeof s === "string" ? enc.encode(s) : s));
}
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const secretFor = async (keyId: string, salt: string) => b64url(await hmac(PEPPER, `lexa-api-key:v1:${keyId.toLowerCase()}:${salt}`));

function randomFrom(alphabet: string, n: number): string {
  const out: string[] = [];
  const max = 256 - (256 % alphabet.length);
  while (out.length < n) {
    const buf = new Uint8Array(n * 2);
    crypto.getRandomValues(buf);
    for (const b of buf) {
      if (b < max) out.push(alphabet[b % alphabet.length]);
      if (out.length === n) break;
    }
  }
  return out.join("");
}
const newPassword = () => randomFrom("ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789", 12);
function newCode(): string {
  const c = randomFrom("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 12);
  return `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}`;
}
const normCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "");
const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

// --- key management from the app (user session; the SQL checks manager + aal2) ---
async function asUserRpc<T>(token: string, fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: PUBLIC_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const t = await res.text();
  if (!res.ok) {
    const m = t.match(/"message"\s*:\s*"([^"]{1,80})"/);
    const msg = m?.[1] ?? "error";
    if (/mfa required/.test(msg)) throw new Fail(403, "mfa_required");
    if (/not a manager|not signed in|not_found/.test(msg)) throw new Fail(403, "not_manager");
    if (/^(bad_scopes|bad_ips|bad_input|too_many_keys|org_not_active)$/.test(msg)) throw new Fail(400, msg);
    console.error("user rpc", fn, res.status, t.slice(0, 200));
    throw new Fail(500, "db_error");
  }
  return (t ? JSON.parse(t) : null) as T;
}

type KeyRow = { id: string; name: string; scopes: string[]; allowed_ips: string[]; sandbox: boolean; expires_at: string | null; revoked_at: string | null };

async function issueKey(token: string, orgId: string, name: string, scopes: string[], ips: string[], days: number | null, sandbox: boolean) {
  const made = await asUserRpc<{ id: string; salt: string }>(token, "lexa_org_api_key_new", {
    o: orgId, k_name: name, k_scopes: scopes, k_ips: ips, k_days: days, k_sandbox: sandbox,
  });
  const secret = await secretFor(made.id, made.salt);
  const hint = (await sha256Hex(secret)).slice(0, 8);
  await rest(`lexa_org_api_keys?id=eq.${made.id}`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ hint }) });
  return { id: made.id, key: `lxk_${sandbox ? "test" : "live"}_${made.id}`, secret, hint, sandbox };
}

async function manage(req: Request): Promise<Response> {
  const cors = (r: Response) => { for (const [k, v] of Object.entries(CORS)) r.headers.set(k, v); return r; };
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return cors(json(405, { error: "method_not_allowed" }));
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) throw new Fail(401, "not_signed_in");
    const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: PUBLIC_KEY, Authorization: `Bearer ${token}` } });
    if (!u.ok) throw new Fail(401, "not_signed_in");
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const orgId = String(body.org_id ?? "");
    if (!UUID_RE.test(orgId)) throw new Fail(400, "bad_input");
    if (body.action === "create_key") {
      const scopes = Array.isArray(body.scopes) ? body.scopes.map(String).slice(0, 20) : [];
      const ips = Array.isArray(body.ips) ? body.ips.map((x) => String(x).trim()).filter(Boolean).slice(0, 20) : [];
      const days = body.days === null || body.days === undefined || body.days === "" ? null : Math.floor(Number(body.days));
      const k = await issueKey(token, orgId, clip(body.name, 60), scopes, ips, days, body.sandbox === true);
      return cors(json(200, k));
    }
    if (body.action === "rotate_key") {
      const old = String(body.key_id ?? "");
      if (!UUID_RE.test(old)) throw new Fail(400, "bad_input");
      const grace = Math.max(0, Math.min(168, Math.floor(Number(body.grace_hours ?? 24)) || 0));
      const list = await asUserRpc<KeyRow[]>(token, "lexa_org_api_keys", { o: orgId });
      const k = list.find((x) => x.id === old && !x.revoked_at);
      if (!k) throw new Fail(404, "not_found");
      const left = k.expires_at ? Math.ceil((Date.parse(k.expires_at) - Date.now()) / 86_400_000) : null;
      const made = await issueKey(token, orgId, k.name, k.scopes, k.allowed_ips, left && left > 0 ? Math.min(left, 730) : null, k.sandbox);
      await asUserRpc(token, "lexa_org_api_key_revoke", { k: old, grace_hours: grace });
      return cors(json(200, { ...made, old_key_ends_in_hours: grace }));
    }
    throw new Fail(400, "unknown_action");
  } catch (e) {
    if (e instanceof Fail) return cors(json(e.status, { error: e.code }));
    console.error("org-api manage", e instanceof Error ? e.message : "error");
    return cors(json(500, { error: "server_error" }));
  }
}

// --- API context ---
type Ctx = {
  keyId: string; orgId: string; scopes: string[]; sandbox: boolean; method: string; route: string;
  body: Record<string, unknown>; query: URLSearchParams; rows: number;
};
type OrgRow = { id: string; status: string; expires_at: string | null; seats: number; student_seats: number };

function need(c: Ctx, scope: string) {
  if (!c.scopes.includes(scope)) throw new Fail(403, "missing_scope");
}
function items(c: Ctx, max: number): Record<string, unknown>[] {
  const it = c.body.items;
  if (!Array.isArray(it) || !it.length || it.length > max) throw new Fail(400, "bad_batch");
  if (!it.every((x) => x && typeof x === "object" && !Array.isArray(x))) throw new Fail(400, "bad_batch");
  c.rows = it.length;
  return it as Record<string, unknown>[];
}
async function loadOrg(orgId: string): Promise<OrgRow> {
  const rows = await rest<OrgRow[]>(`lexa_orgs?id=eq.${orgId}&select=id,status,expires_at,seats,student_seats&limit=1`);
  if (!rows[0]) throw new Fail(403, "org_not_active");
  return rows[0];
}
function summary(results: { result: string }[]) {
  const s: Record<string, number> = {};
  for (const r of results) s[r.result] = (s[r.result] ?? 0) + 1;
  return s;
}

// --- accounts (ported from org-auth "provision"; actor = the API key) ---
async function createAuthUser(displayName: string, orgId: string): Promise<{ id: string; password: string }> {
  const password = newPassword();
  const email = `u_${crypto.randomUUID().replace(/-/g, "")}@${EMAIL_DOMAIN}`;
  const u = await authAdmin<{ id: string }>("users", "POST", {
    email, password, email_confirm: true, app_metadata: { lexa_managed: true, lexa_org: orgId },
  });
  try {
    await rest(`lexa_profiles?id=eq.${u.id}`, {
      method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ display_name: displayName.slice(0, 60) || null }),
    });
    await rest("lexa_account_flags", {
      method: "POST", prefer: "return=minimal",
      body: JSON.stringify({ user_id: u.id, managed_by_org: orgId, must_change_password: true }),
    });
  } catch (e) {
    await authAdmin(`users/${u.id}`, "DELETE").catch(() => {});
    throw e;
  }
  return { id: u.id, password };
}

async function issueCode(orgId: string, studentId: string): Promise<string> {
  const code = newCode();
  await rest(`lexa_org_activation_codes?student_id=eq.${studentId}&used_at=is.null`, {
    method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ expires_at: new Date().toISOString() }),
  });
  await rest("lexa_org_activation_codes", {
    method: "POST", prefer: "return=minimal",
    body: JSON.stringify({
      org_id: orgId, student_id: studentId, code_hash: await sha256Hex(normCode(code)),
      expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(), created_by: null,
    }),
  });
  return code;
}

type PersonResult = {
  row: number; username: string; external_id?: string; result: string;
  password?: string | null; activation_code?: string | null; error?: string;
};

async function postStudents(c: Ctx): Promise<Response> {
  need(c, "students:write");
  const list = items(c, MAX_PEOPLE);
  const org = await loadOrg(c.orgId);
  const seen = new Set<string>();
  const rows = list.map((p, i) => {
    const student_no = clip(p.student_no, 40);
    const username = clip(p.username, 40) || student_no;
    const external_id = clip(p.external_id, 80);
    let problem = "";
    if (!USERNAME_RE.test(username)) problem = "bad_username";
    else if (seen.has(username.toLowerCase())) problem = "duplicate_username";
    else if (external_id && seen.has(`#${external_id}`)) problem = "duplicate_external_id";
    seen.add(username.toLowerCase());
    if (external_id) seen.add(`#${external_id}`);
    return {
      i, username, student_no, external_id, problem, full_name: clip(p.full_name, 80), field: clip(p.field, 80),
      entry_year: clip(p.entry_year, 10), existing: p.existing_account === true,
    };
  });
  const roster = await restAll<{ id: string; org_username: string; external_id: string; status: string }>(
    `lexa_org_students?org_id=eq.${c.orgId}&select=id,org_username,external_id,status&order=created_at`,
  );
  const logins = await restAll<{ org_username: string }>(`lexa_org_logins?org_id=eq.${c.orgId}&select=org_username&order=created_at`);
  const byName = new Map(roster.map((r) => [r.org_username.toLowerCase(), r]));
  const byExt = new Map(roster.filter((r) => r.external_id).map((r) => [r.external_id, r]));
  const takenLogin = new Set(logins.map((l) => l.org_username.toLowerCase()));
  const prevOf = (r: (typeof rows)[number]) => (r.external_id && byExt.get(r.external_id)) || byName.get(r.username.toLowerCase());

  const fresh = rows.filter((r) => !r.problem && !prevOf(r)).length;
  const active = roster.filter((r) => r.status === "active").length;
  if (active + fresh > org.student_seats) throw new Fail(409, "no_student_seats");

  const out: PersonResult[] = [];
  for (const r of rows) {
    const base: PersonResult = { row: r.i + 1, username: r.username, ...(r.external_id ? { external_id: r.external_id } : {}), result: "error" };
    if (r.problem) { out.push({ ...base, error: r.problem }); continue; }
    try {
      const prev = prevOf(r);
      if (prev) {
        if (!c.sandbox) {
          await rest(`lexa_org_students?id=eq.${prev.id}`, {
            method: "PATCH", prefer: "return=minimal",
            body: JSON.stringify({
              student_no: r.student_no, full_name: r.full_name, field: r.field, entry_year: r.entry_year,
              ...(r.external_id ? { external_id: r.external_id } : {}),
            }),
          });
        }
        out.push({ ...base, username: prev.org_username, result: "updated" });
        continue;
      }
      if (takenLogin.has(r.username.toLowerCase())) throw new Fail(409, "username_taken");
      if (c.sandbox) {
        out.push({ ...base, result: r.existing ? "code" : "created", ...(r.existing ? { activation_code: null } : { password: null }) });
        takenLogin.add(r.username.toLowerCase());
        continue;
      }
      const st = {
        org_id: c.orgId, org_username: r.username, student_no: r.student_no, external_id: r.external_id,
        full_name: r.full_name, field: r.field, entry_year: r.entry_year, status: "active", created_by: null,
      };
      if (r.existing) {
        const [row] = await rest<{ id: string }[]>("lexa_org_students?select=id", {
          method: "POST", prefer: "return=representation", body: JSON.stringify(st),
        });
        const code = await issueCode(c.orgId, row.id);
        await audit(c.orgId, "api.student_code", null, { key: c.keyId, student: row.id });
        out.push({ ...base, result: "code", activation_code: code });
        continue;
      }
      const acc = await createAuthUser(r.full_name, c.orgId);
      try {
        await rest("lexa_org_students", {
          method: "POST", prefer: "return=minimal",
          body: JSON.stringify({ ...st, user_id: acc.id, official_since: new Date().toISOString() }),
        });
        await rest("lexa_org_logins", {
          method: "POST", prefer: "return=minimal",
          body: JSON.stringify({ org_id: c.orgId, org_username: r.username, user_id: acc.id, kind: "student" }),
        });
      } catch (e) {
        await rest(`lexa_org_students?user_id=eq.${acc.id}`, { method: "DELETE", prefer: "return=minimal" }).catch(() => {});
        await authAdmin(`users/${acc.id}`, "DELETE").catch(() => {});
        throw e;
      }
      takenLogin.add(r.username.toLowerCase());
      await audit(c.orgId, "api.student_account", acc.id, { key: c.keyId, username: r.username });
      out.push({ ...base, result: "created", password: acc.password });
    } catch (e) {
      out.push({ ...base, error: e instanceof Fail ? e.code : "error" });
    }
  }
  return json(200, { ok: true, sandbox: c.sandbox, results: out, summary: summary(out) });
}

async function postStaff(c: Ctx): Promise<Response> {
  need(c, "staff:write");
  const list = items(c, MAX_PEOPLE);
  const org = await loadOrg(c.orgId);
  const logins = await restAll<{ org_username: string }>(`lexa_org_logins?org_id=eq.${c.orgId}&select=org_username&order=created_at`);
  const taken = new Set(logins.map((l) => l.org_username.toLowerCase()));
  const seen = new Set<string>();
  const rows = list.map((p, i) => {
    const username = clip(p.username, 40);
    const problem = !USERNAME_RE.test(username) ? "bad_username" : seen.has(username.toLowerCase()) ? "duplicate_username" : "";
    seen.add(username.toLowerCase());
    return { i, username, full_name: clip(p.full_name, 80), problem };
  });
  const fresh = rows.filter((r) => !r.problem && !taken.has(r.username.toLowerCase())).length;
  if (fresh) {
    const used = Number(await rpc<number>("lexa_org_seats_used", { o: c.orgId }).catch(() => 0));
    if (used + fresh > org.seats) throw new Fail(409, "no_teacher_seats");
  }
  const out: PersonResult[] = [];
  for (const r of rows) {
    const base: PersonResult = { row: r.i + 1, username: r.username, result: "error" };
    if (r.problem) { out.push({ ...base, error: r.problem }); continue; }
    if (taken.has(r.username.toLowerCase())) { out.push({ ...base, result: "exists" }); continue; }
    if (c.sandbox) { out.push({ ...base, result: "created", password: null }); taken.add(r.username.toLowerCase()); continue; }
    try {
      const acc = await createAuthUser(r.full_name, c.orgId);
      try {
        await rest(`lexa_profiles?id=eq.${acc.id}`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ role: "teacher" }) });
        await rest("lexa_org_members", {
          method: "POST", prefer: "return=minimal",
          body: JSON.stringify({ org_id: c.orgId, user_id: acc.id, role: "teacher", status: "active", invited_by: null }),
        });
        await rest("lexa_org_logins", {
          method: "POST", prefer: "return=minimal",
          body: JSON.stringify({ org_id: c.orgId, org_username: r.username, user_id: acc.id, kind: "staff" }),
        });
      } catch (e) {
        await authAdmin(`users/${acc.id}`, "DELETE").catch(() => {});
        throw e;
      }
      taken.add(r.username.toLowerCase());
      await audit(c.orgId, "api.staff_account", acc.id, { key: c.keyId, username: r.username });
      out.push({ ...base, result: "created", password: acc.password });
    } catch (e) {
      out.push({ ...base, error: e instanceof Fail ? e.code : "error" });
    }
  }
  return json(200, { ok: true, sandbox: c.sandbox, results: out, summary: summary(out) });
}

async function postStatus(c: Ctx, ref: string): Promise<Response> {
  need(c, "status:write");
  c.rows = 1;
  const org = await loadOrg(c.orgId);
  const sid = await rpc<string | null>("lexa_api_find_student", { o: c.orgId, ref: ref.slice(0, 80) });
  if (!sid) throw new Fail(404, "student_not_found");
  const [st] = await rest<{ id: string; user_id: string | null; status: string }[]>(
    `lexa_org_students?id=eq.${sid}&org_id=eq.${c.orgId}&select=id,user_id,status&limit=1`,
  );
  if (!st) throw new Fail(404, "student_not_found");
  const status = String(c.body.status ?? st.status);
  const after = String(c.body.access_after_exit ?? "open");
  const until = c.body.access_until ? String(c.body.access_until) : null;
  if (!["active", "suspended", "graduated", "withdrawn"].includes(status)) throw new Fail(400, "bad_status");
  if (!["open", "limited", "until"].includes(after)) throw new Fail(400, "bad_access");
  if (after === "until" && (!until || !/^\d{4}-\d{2}-\d{2}$/.test(until))) throw new Fail(400, "bad_access");
  if (status === "active" && st.status !== "active") {
    const used = Number(await rpc<number>("lexa_org_students_used", { o: c.orgId }).catch(() => 0));
    if (used + 1 > org.student_seats) throw new Fail(409, "no_student_seats");
  }
  if (c.sandbox) return json(200, { ok: true, sandbox: true, from: st.status, to: status });
  await rest(`lexa_org_students?id=eq.${st.id}`, {
    method: "PATCH", prefer: "return=minimal",
    body: JSON.stringify({ status, access_after_exit: after, access_until: after === "until" ? until : null }),
  });
  let revoked = false;
  if (st.user_id) {
    const f = await rest<{ managed_by_org: string | null }[]>(`lexa_account_flags?user_id=eq.${st.user_id}&select=managed_by_org&limit=1`);
    if (f[0]?.managed_by_org === c.orgId) {
      if (status === "suspended" && st.status !== "suspended") {
        await authAdmin(`users/${st.user_id}`, "PUT", { ban_duration: "876000h" });
        revoked = !!(await rpc<boolean>("lexa_svc_revoke_sessions", { uid: st.user_id }).catch(() => false));
      } else if (status !== "suspended" && st.status === "suspended") {
        await authAdmin(`users/${st.user_id}`, "PUT", { ban_duration: "none" });
      }
    }
  }
  await audit(c.orgId, "api.student_status", st.user_id, { key: c.keyId, student: st.id, from: st.status, to: status, access: after, until });
  return json(200, { ok: true, sandbox: false, from: st.status, to: status, sessions_revoked: revoked });
}

async function postBulk(c: Ctx, scope: string, fn: string, max: number, action: string): Promise<Response> {
  need(c, scope);
  const list = items(c, max);
  const results = await rpc<{ result: string }[]>(fn, { o: c.orgId, items: list, dry: c.sandbox });
  if (!c.sandbox) await audit(c.orgId, action, null, { key: c.keyId, rows: list.length, summary: summary(results ?? []) });
  return json(200, { ok: true, sandbox: c.sandbox, results: results ?? [], summary: summary(results ?? []) });
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
async function getReport(c: Ctx, which: string): Promise<Response> {
  need(c, "reports:read");
  let data: unknown;
  if (which === "students") data = await rpc("lexa_api_report_students", { o: c.orgId });
  else if (which === "classes") data = await rpc("lexa_api_report_classes", { o: c.orgId });
  else if (which === "grades") data = await rpc("lexa_api_report_grades", { o: c.orgId, term_code: clip(c.query.get("term"), 30) });
  else if (which === "study") {
    const from = c.query.get("from") ?? "";
    const to = c.query.get("to") ?? "";
    if (!DAY_RE.test(from) || !DAY_RE.test(to) || to < from) throw new Fail(400, "bad_range");
    const rows = await rpc<Record<string, unknown>[]>("lexa_org_study_report", { o: c.orgId, d_from: from, d_to: to });
    data = (rows ?? []).map((r) => ({
      username: r.org_username, student_no: r.student_no, full_name: r.full_name, status: r.status,
      minutes: Math.round(Number(r.seconds ?? 0) / 60), org_content_minutes: Math.round(Number(r.org_seconds ?? 0) / 60),
      active_days: r.active_days, last_day: r.last_day, events: r.events,
    }));
  } else throw new Fail(404, "not_found");
  if (Array.isArray(data)) c.rows = data.length;
  await audit(c.orgId, "api.report", null, { key: c.keyId, report: which, rows: c.rows });
  return json(200, { ok: true, data });
}

// --- OpenAPI (kept short; docs/ORG_API.md has the prose) ---
function openapi(base: string) {
  const bulk = (name: string, scope: string, item: Record<string, unknown>) => ({
    post: {
      summary: `Create or update ${name} (max per request in description)`, description: `Scope ${scope}.`,
      parameters: [{ $ref: "#/components/parameters/Idem" }],
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["items"], properties: { items: { type: "array", items: { type: "object", properties: item } } } } } } },
      responses: { 200: { $ref: "#/components/responses/Bulk" }, default: { $ref: "#/components/responses/Error" } },
    },
  });
  const s = { type: "string" };
  const n = { type: "number" };
  return {
    openapi: "3.0.3",
    info: { title: "Lexa API for centres", version: VERSION, description: "Signed requests (X-Lexa-Key, X-Lexa-Timestamp, X-Lexa-Signature). See docs/ORG_API.md." },
    servers: [{ url: base }],
    security: [{ LexaKey: [], LexaTimestamp: [], LexaSignature: [] }],
    components: {
      securitySchemes: {
        LexaKey: { type: "apiKey", in: "header", name: "X-Lexa-Key" },
        LexaTimestamp: { type: "apiKey", in: "header", name: "X-Lexa-Timestamp" },
        LexaSignature: { type: "apiKey", in: "header", name: "X-Lexa-Signature" },
      },
      parameters: { Idem: { name: "Idempotency-Key", in: "header", required: true, schema: { type: "string", maxLength: 100 } } },
      responses: {
        Bulk: { description: "Per-row results", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, sandbox: { type: "boolean" }, results: { type: "array", items: { type: "object" } }, summary: { type: "object" } } } } } },
        Error: { description: "Error", content: { "application/json": { schema: { type: "object", properties: { error: s } } } } },
      },
    },
    paths: {
      "/v1/ping": { get: { summary: "Check the key", responses: { 200: { description: "ok" } } } },
      "/v1/students": bulk("students (max 300)", "students:write", { username: s, student_no: s, external_id: s, full_name: s, field: s, entry_year: s, existing_account: { type: "boolean" } }),
      "/v1/staff": bulk("teachers (max 300)", "staff:write", { username: s, full_name: s }),
      "/v1/students/{ref}/status": {
        post: {
          summary: "Change a student's status", description: "Scope status:write. ref = external_id, username or student number.",
          parameters: [{ name: "ref", in: "path", required: true, schema: s }, { $ref: "#/components/parameters/Idem" }],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { status: { type: "string", enum: ["active", "suspended", "graduated", "withdrawn"] }, access_after_exit: { type: "string", enum: ["open", "limited", "until"] }, access_until: { type: "string", format: "date" } } } } } },
          responses: { 200: { description: "ok" }, default: { $ref: "#/components/responses/Error" } },
        },
      },
      "/v1/classes": bulk("classes (max 500)", "classes:write", { external_id: s, title: s, status: s, teacher: s, term: { type: "object", properties: { code: s, title: s, starts_on: s, ends_on: s, status: s } }, course: { type: "object", properties: { code: s, title: s, units: n } } }),
      "/v1/enrollments": bulk("enrolments (max 2000)", "enrollments:write", { class: s, student: s, status: { type: "string", enum: ["enrolled", "completed", "dropped"] } }),
      "/v1/grades": bulk("grades (max 2000)", "grades:write", { class: s, student: s, component: { type: "string", enum: ["midterm", "final_exam", "final"] }, score: n, max: n, note: s }),
      "/v1/prior-gpa": bulk("prior GPA (max 5000)", "grades:write", { student: s, gpa: n, as_of: s }),
      "/v1/reports/students": { get: { summary: "Roster", responses: { 200: { description: "ok" } } } },
      "/v1/reports/classes": { get: { summary: "Classes", responses: { 200: { description: "ok" } } } },
      "/v1/reports/grades": { get: { summary: "Grades", parameters: [{ name: "term", in: "query", schema: s }], responses: { 200: { description: "ok" } } } },
      "/v1/reports/study": { get: { summary: "Study time per official student", parameters: [{ name: "from", in: "query", required: true, schema: s }, { name: "to", in: "query", required: true, schema: s }], responses: { 200: { description: "ok" } } } },
    },
  };
}

// --- request pipeline ---
function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || (req.headers.get("x-real-ip") ?? "").trim();
}

async function logRequest(keyId: string | null, orgId: string | null, method: string, path: string, status: number, ms: number, rows: number, error: string, sandbox: boolean) {
  if (!orgId) return;
  await rest("lexa_org_api_log", {
    method: "POST", prefer: "return=minimal",
    body: JSON.stringify({ key_id: keyId, org_id: orgId, method, path: path.slice(0, 120), status, ms, n_rows: rows, error: error.slice(0, 80), sandbox }),
  }).catch(() => {});
}

async function api(req: Request, route: string, url: URL): Promise<Response> {
  const t0 = Date.now();
  const method = req.method.toUpperCase();
  if (route === "/v1/openapi.json" && method === "GET") {
    return json(200, openapi(`${SB_URL}/functions/v1/org-api`));
  }
  const raw = new Uint8Array(await req.arrayBuffer());
  if (raw.length > MAX_BODY) return json(413, { error: "body_too_large" });

  // 1. who is calling (the signature is checked before anything is revealed)
  const keyHeader = (req.headers.get("x-lexa-key") ?? "").trim();
  const ts = (req.headers.get("x-lexa-timestamp") ?? "").trim();
  const sig = (req.headers.get("x-lexa-signature") ?? "").trim().replace(/^v1=/, "").toLowerCase();
  const m = keyHeader.match(KEY_RE);
  if (!m || !/^\d{9,11}$/.test(ts) || !/^[0-9a-f]{64}$/.test(sig)) return json(401, { error: "unauthorized" });
  if (Math.abs(Date.now() / 1000 - Number(ts)) > CLOCK_SKEW_S) return json(401, { error: "timestamp_out_of_range" });
  const keyId = m[2].toLowerCase();
  const chk = await rpc<{ found: boolean; ok?: boolean; reason?: string; org_id?: string; salt?: string; scopes?: string[]; sandbox?: boolean }>(
    "lexa_api_key_check", { k: keyId, ip: clientIp(req) },
  );
  const secret = chk.found && chk.salt ? await secretFor(keyId, chk.salt) : await secretFor(keyId, "missing");
  const pathAndQuery = route + url.search;
  const expected = hex(await hmac(secret, `${ts}\n${method}\n${pathAndQuery}\n${await sha256Hex(raw)}`));
  if (!chk.found || !sameText(expected, sig)) return json(401, { error: "unauthorized" });
  const orgId = String(chk.org_id);
  const sandbox = !!chk.sandbox;
  if (m[1].toLowerCase() !== (sandbox ? "test" : "live")) return json(401, { error: "unauthorized" });
  if (!chk.ok) {
    const st = chk.reason === "org_not_active" ? 403 : 401;
    await logRequest(keyId, orgId, method, route, st, Date.now() - t0, 0, chk.reason ?? "", sandbox);
    return json(st, { error: chk.reason });
  }

  // 2. rate limit
  if (!(await rpc<boolean>("lexa_api_rate_hit", { k: keyId, per_min: RATE_PER_MIN }))) {
    await logRequest(keyId, orgId, method, route, 429, Date.now() - t0, 0, "rate_limited", sandbox);
    return json(429, { error: "rate_limited" }, { "Retry-After": "60" });
  }

  let body: Record<string, unknown> = {};
  if (method === "POST") {
    try {
      const parsed = raw.length ? JSON.parse(new TextDecoder().decode(raw)) : {};
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("bad");
      body = parsed as Record<string, unknown>;
    } catch {
      await logRequest(keyId, orgId, method, route, 400, Date.now() - t0, 0, "bad_json", sandbox);
      return json(400, { error: "bad_json" });
    }
  }
  const c: Ctx = { keyId, orgId, scopes: chk.scopes ?? [], sandbox, method, route, body, query: url.searchParams, rows: 0 };

  // 3. idempotency for writes
  const idem = (req.headers.get("idempotency-key") ?? "").trim();
  let idemOpen = false;
  if (method === "POST") {
    if (!idem || idem.length > 100) {
      await logRequest(keyId, orgId, method, route, 400, Date.now() - t0, 0, "idempotency_key_required", sandbox);
      return json(400, { error: "idempotency_key_required" });
    }
    const h = await sha256Hex(`${method}\n${pathAndQuery}\n${await sha256Hex(raw)}`);
    const st = await rpc<{ state: string; status?: number; response?: unknown }>("lexa_api_idem_begin", { k: keyId, ikey: idem, h });
    if (st.state === "replay") {
      await logRequest(keyId, orgId, method, route, Number(st.status), Date.now() - t0, 0, "replayed", sandbox);
      return json(Number(st.status) || 200, st.response ?? {}, { "Idempotent-Replayed": "true" });
    }
    if (st.state === "conflict") return json(422, { error: "idempotency_key_reused" });
    if (st.state === "busy") return json(409, { error: "request_in_progress" });
    idemOpen = true;
  }

  // 4. route
  let res: Response;
  let errCode = "";
  try {
    const statusMatch = route.match(/^\/v1\/students\/([^/]{1,200})\/status$/);
    if (method === "GET" && route === "/v1/ping") {
      res = json(200, { ok: true, org_id: orgId, scopes: c.scopes, sandbox, version: VERSION, time: new Date().toISOString() });
    } else if (method === "GET" && route.startsWith("/v1/reports/")) {
      res = await getReport(c, route.slice("/v1/reports/".length));
    } else if (method === "POST" && route === "/v1/students") res = await postStudents(c);
    else if (method === "POST" && route === "/v1/staff") res = await postStaff(c);
    else if (method === "POST" && statusMatch) res = await postStatus(c, decodeURIComponent(statusMatch[1]));
    else if (method === "POST" && route === "/v1/classes") res = await postBulk(c, "classes:write", "lexa_api_classes", 500, "api.classes");
    else if (method === "POST" && route === "/v1/enrollments") res = await postBulk(c, "enrollments:write", "lexa_api_enrollments", 2000, "api.enrollments");
    else if (method === "POST" && route === "/v1/grades") res = await postBulk(c, "grades:write", "lexa_api_grades", 2000, "api.grades");
    else if (method === "POST" && route === "/v1/prior-gpa") res = await postBulk(c, "grades:write", "lexa_api_prior_gpa", 5000, "api.prior_gpa");
    else throw new Fail(404, "not_found");
  } catch (e) {
    if (e instanceof Fail) { errCode = e.code; res = json(e.status, { error: e.code }); }
    else { errCode = "server_error"; console.error("org-api", e instanceof Error ? e.message : "error"); res = json(500, { error: "server_error" }); }
  }

  // 5. store the answer for retries, without passwords or activation codes
  if (idemOpen) {
    let stored: unknown = null;
    if (res.status < 500) {
      const j = (await res.clone().json().catch(() => null)) as { results?: PersonResult[] } | null;
      if (j && Array.isArray(j.results)) {
        j.results = j.results.map((r) => ({
          ...r,
          ...(r.password ? { password: null, secret_redacted: true } : {}),
          ...(r.activation_code ? { activation_code: null, secret_redacted: true } : {}),
        }));
      }
      stored = j;
    }
    await rpc("lexa_api_idem_end", { k: keyId, ikey: idem, code: res.status, resp: stored }).catch(() => {});
  }
  await logRequest(keyId, orgId, method, route, res.status, Date.now() - t0, c.rows, errCode, sandbox);
  return res;
}

Deno.serve(async (req) => {
  if (!SB_URL || !SERVICE_KEY || !PUBLIC_KEY || PEPPER.length < 32) return json(500, { error: "not_configured" });
  const url = new URL(req.url);
  const at = url.pathname.indexOf("/org-api");
  const route = (at >= 0 ? url.pathname.slice(at + "/org-api".length) : url.pathname) || "/";
  if (route === "/manage") return manage(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (!route.startsWith("/v1/")) return json(404, { error: "not_found" });
  try {
    return await api(req, route, url);
  } catch (e) {
    console.error("org-api", e instanceof Error ? e.message : "error");
    return json(500, { error: "server_error" });
  }
});
