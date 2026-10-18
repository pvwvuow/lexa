// Lexa org-auth: centre sign-in and centre-made accounts (phase 1 of docs/ORG_LEARNING.md).
// Deploy:  supabase functions deploy org-auth --no-verify-jwt
// (sign-in has no session yet; every other action checks the caller's token itself).
//
// Secrets (Edge Function settings):
//   LEXA_SERVICE_KEY      secret / service_role key (falls back to SUPABASE_SERVICE_ROLE_KEY)
//   LEXA_PUBLISHABLE_KEY  publishable / anon key   (falls back to SUPABASE_ANON_KEY)
//   LEXA_INTERNAL_EMAIL_DOMAIN  optional, default "accounts.lexa.invalid". It must be a domain
//                         that can never receive mail, otherwise a password-reset e-mail for a
//                         centre-made account could reach a stranger.
// No password, code or token is ever written to a log or to the audit log.

const SB_URL = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const SERVICE_KEY = Deno.env.get("LEXA_SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PUBLIC_KEY = Deno.env.get("LEXA_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const EMAIL_DOMAIN = Deno.env.get("LEXA_INTERNAL_EMAIL_DOMAIN") ?? "accounts.lexa.invalid";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const USERNAME_RE = /^[A-Za-z0-9._-]{2,40}$/;
const CODE_RE = /^[a-z0-9][a-z0-9-]{1,23}$/;
const MAX_BATCH = 300;

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
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// --- service-key REST helpers ---
function svcHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { apikey: SERVICE_KEY, "Content-Type": "application/json", ...extra };
  // legacy service_role keys are JWTs and go in Authorization too; new sb_secret_ keys do not
  if (SERVICE_KEY.startsWith("eyJ")) h.Authorization = `Bearer ${SERVICE_KEY}`;
  return h;
}

async function rest<T = unknown>(path: string, init: RequestInit & { prefer?: string } = {}): Promise<T> {
  const headers = svcHeaders(init.prefer ? { Prefer: init.prefer } : {});
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error("rest", path.split("?")[0], res.status, t.slice(0, 300));
    throw new Fail(500, "db_error");
  }
  const t = await res.text();
  return (t ? JSON.parse(t) : null) as T;
}

/** every row of a filtered select (PostgREST caps one response at "max rows", often 1000) */
async function restAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  for (let off = 0; off < 200_000; off += 1000) {
    const page = await rest<T[]>(`${path}&limit=1000&offset=${off}`);
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  return rest<T>(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
}

async function authAdmin<T = unknown>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${SB_URL}/auth/v1/admin/${path}`, {
    method,
    headers: svcHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error("auth admin", path.split("/")[0], res.status, t.slice(0, 300));
    throw new Fail(500, "auth_error");
  }
  const t = await res.text();
  return (t ? JSON.parse(t) : null) as T;
}

// --- random secrets ---
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
async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const normCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "");

// --- rate limits ---
async function tooMany(key: string, max: number, minutes: number): Promise<boolean> {
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const rows = await rest<unknown[]>(
    `lexa_rate_events?key=eq.${encodeURIComponent(key)}&at=gt.${encodeURIComponent(since)}&select=at&limit=${max}`,
  );
  return rows.length >= max;
}
async function hit(key: string): Promise<void> {
  await rest("lexa_rate_events", { method: "POST", body: JSON.stringify({ key }), prefer: "return=minimal" });
}
async function clearHits(key: string): Promise<void> {
  await rest(`lexa_rate_events?key=eq.${encodeURIComponent(key)}`, { method: "DELETE", prefer: "return=minimal" });
}
async function sweepOld(): Promise<void> {
  if (Math.random() > 0.02) return;
  const before = new Date(Date.now() - 86_400_000).toISOString();
  await rest(`lexa_rate_events?at=lt.${encodeURIComponent(before)}`, { method: "DELETE", prefer: "return=minimal" }).catch(() => {});
}

async function audit(actor: string | null, org: string | null, action: string, target: string | null, detail: Record<string, unknown> = {}) {
  await rest("lexa_audit_log", {
    method: "POST",
    prefer: "return=minimal",
    body: JSON.stringify({ actor, org_id: org, action, target, detail }),
  });
}

// --- caller ---
type Caller = { id: string; aal: string };

function jwtPayload(token: string): Record<string, unknown> {
  try {
    const p = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(p + "=".repeat((4 - (p.length % 4)) % 4)));
  } catch {
    return {};
  }
}

async function caller(req: Request): Promise<Caller> {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new Fail(401, "not_signed_in");
  // GoTrue validates the token (signature, expiry, revoked session)
  const res = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: PUBLIC_KEY, Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Fail(401, "not_signed_in");
  const u = (await res.json()) as { id?: string };
  if (!u.id) throw new Fail(401, "not_signed_in");
  return { id: u.id, aal: String(jwtPayload(token).aal ?? "aal1") };
}

type OrgRow = { id: string; name: string; code: string | null; status: string; expires_at: string | null; seats: number; student_seats: number };

async function loadOrg(orgId: string): Promise<OrgRow> {
  if (!/^[0-9a-f-]{36}$/i.test(orgId)) throw new Fail(400, "bad_request");
  const rows = await rest<OrgRow[]>(`lexa_orgs?id=eq.${orgId}&select=id,name,code,status,expires_at,seats,student_seats&limit=1`);
  if (!rows[0]) throw new Fail(404, "org_not_found");
  return rows[0];
}
const orgLive = (o: OrgRow) => o.status === "active" && (!o.expires_at || new Date(o.expires_at).getTime() > Date.now());

/** owner / manager of an active centre, or a Lexa admin; always with a second factor */
async function requireManager(c: Caller, orgId: string): Promise<OrgRow> {
  if (c.aal !== "aal2") throw new Fail(403, "mfa_required");
  const org = await loadOrg(orgId);
  const prof = await rest<{ role: string }[]>(`lexa_profiles?id=eq.${c.id}&select=role&limit=1`);
  const isAdmin = prof[0]?.role === "admin";
  if (!isAdmin) {
    const m = await rest<unknown[]>(
      `lexa_org_members?org_id=eq.${orgId}&user_id=eq.${c.id}&status=eq.active&role=in.(owner,manager)&select=user_id&limit=1`,
    );
    if (!m.length) throw new Fail(403, "not_manager");
  }
  if (!orgLive(org)) throw new Fail(403, "org_not_active");
  return org;
}

// --- actions ---
async function actLogin(req: Request, body: Record<string, unknown>): Promise<Response> {
  const code = String(body.org ?? "").trim().toLowerCase();
  const uname = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  if (!CODE_RE.test(code) || !USERNAME_RE.test(uname) || !password || password.length > 200) {
    throw new Fail(401, "bad_credentials");
  }
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const kUser = `login:${code}:${uname.toLowerCase()}`;
  const kIp = `loginip:${ip}`;
  await sweepOld();
  if ((await tooMany(kUser, 5, 15)) || (await tooMany(kIp, 30, 15))) throw new Fail(429, "too_many_attempts");

  const failWith = async (): Promise<never> => {
    await hit(kUser);
    await hit(kIp);
    // a little jitter so a wrong username and a wrong password look the same
    await new Promise((r) => setTimeout(r, 150 + Math.floor(Math.random() * 250)));
    throw new Fail(401, "bad_credentials");
  };

  const orgs = await rest<{ id: string }[]>(`lexa_orgs?code=eq.${encodeURIComponent(code)}&select=id&limit=1`);
  if (!orgs[0]) return failWith();
  const logins = await rest<{ user_id: string; org_username: string }[]>(
    `lexa_org_logins?org_id=eq.${orgs[0].id}&select=user_id,org_username&limit=500&org_username=ilike.${encodeURIComponent(uname.replace(/[\\%_*]/g, (m) => "\\" + m))}`,
  );
  const row = logins.find((l) => l.org_username.toLowerCase() === uname.toLowerCase());
  if (!row) return failWith();
  const user = await authAdmin<{ email?: string }>(`users/${row.user_id}`, "GET").catch(() => null);
  if (!user?.email) return failWith();

  const res = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: PUBLIC_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email, password }),
  });
  if (!res.ok) return failWith();
  const tok = (await res.json()) as { access_token: string; refresh_token: string; expires_in?: number; user?: { id: string } };
  await clearHits(kUser);
  const flags = await rest<{ must_change_password: boolean }[]>(
    `lexa_account_flags?user_id=eq.${row.user_id}&select=must_change_password&limit=1`,
  );
  return json(200, {
    access_token: tok.access_token,
    refresh_token: tok.refresh_token,
    expires_in: tok.expires_in ?? 3600,
    user: { id: row.user_id },
    must_change_password: !!flags[0]?.must_change_password,
  });
}

type Person = {
  kind?: string; username?: string; student_no?: string; external_id?: string;
  full_name?: string; field?: string; entry_year?: string; existing_account?: boolean;
};
type Result = { row: number; username: string; result: string; password?: string; code?: string; error?: string };

const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

async function issueCode(orgId: string, studentId: string, actor: string): Promise<string> {
  const code = newCode();
  // older unused codes of this row stop working
  await rest(`lexa_org_activation_codes?student_id=eq.${studentId}&used_at=is.null`, {
    method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ expires_at: new Date().toISOString() }),
  });
  await rest("lexa_org_activation_codes", {
    method: "POST", prefer: "return=minimal",
    body: JSON.stringify({
      org_id: orgId, student_id: studentId, code_hash: await sha256Hex(normCode(code)),
      expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(), created_by: actor,
    }),
  });
  return code;
}

async function createAuthUser(displayName: string, orgId: string): Promise<{ id: string; password: string }> {
  const password = newPassword();
  const email = `u_${crypto.randomUUID().replace(/-/g, "")}@${EMAIL_DOMAIN}`;
  const u = await authAdmin<{ id: string }>("users", "POST", {
    email, password, email_confirm: true, app_metadata: { lexa_managed: true, lexa_org: orgId },
  });
  try {
    // the 002/004 trigger made the profile row; the guard lets the service key set the name
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

async function actProvision(c: Caller, body: Record<string, unknown>): Promise<Response> {
  const org = await requireManager(c, String(body.org_id ?? ""));
  const people = Array.isArray(body.people) ? (body.people as Person[]) : [];
  if (!people.length || people.length > MAX_BATCH) throw new Fail(400, "bad_batch");

  // validate everything first: nothing is created when a row is bad
  const seen = new Set<string>();
  const rows = people.map((p, i) => {
    const kind = p.kind === "staff" ? "staff" : "student";
    const student_no = clip(p.student_no, 40);
    const username = clip(p.username, 40) || student_no;
    if (!USERNAME_RE.test(username)) throw new Fail(400, `bad_username:${i + 1}`);
    const key = username.toLowerCase();
    if (seen.has(key)) throw new Fail(400, `duplicate_username:${i + 1}`);
    seen.add(key);
    return {
      i, kind, username, student_no, external_id: clip(p.external_id, 80), full_name: clip(p.full_name, 80),
      field: clip(p.field, 80), entry_year: clip(p.entry_year, 10), existing: !!p.existing_account,
    };
  });

  const roster = await restAll<{ id: string; org_username: string; external_id: string; user_id: string | null; status: string }>(
    `lexa_org_students?org_id=eq.${org.id}&select=id,org_username,external_id,user_id,status&order=created_at`,
  );
  const logins = await restAll<{ org_username: string }>(`lexa_org_logins?org_id=eq.${org.id}&select=org_username&order=created_at`);
  const byName = new Map(roster.map((r) => [r.org_username.toLowerCase(), r]));
  const byExt = new Map(roster.filter((r) => r.external_id).map((r) => [r.external_id, r]));
  const takenLogin = new Set(logins.map((l) => l.org_username.toLowerCase()));

  const newStudents = rows.filter((r) => r.kind === "student" && !(r.external_id && byExt.has(r.external_id)) && !byName.has(r.username.toLowerCase())).length;
  const active = roster.filter((r) => r.status === "active").length;
  if (active + newStudents > org.student_seats) throw new Fail(409, "no_student_seats");
  const newStaff = rows.filter((r) => r.kind === "staff" && !takenLogin.has(r.username.toLowerCase())).length;
  if (newStaff) {
    const used = await rpc<number>("lexa_org_seats_used", { o: org.id }).catch(() => 0);
    if (Number(used) + newStaff > org.seats) throw new Fail(409, "no_teacher_seats");
  }

  const out: Result[] = [];
  for (const r of rows) {
    try {
      if (r.kind === "student") {
        const prev = (r.external_id && byExt.get(r.external_id)) || byName.get(r.username.toLowerCase());
        if (prev) {
          await rest(`lexa_org_students?id=eq.${prev.id}`, {
            method: "PATCH", prefer: "return=minimal",
            body: JSON.stringify({ student_no: r.student_no, full_name: r.full_name, field: r.field, entry_year: r.entry_year, ...(r.external_id ? { external_id: r.external_id } : {}) }),
          });
          out.push({ row: r.i + 1, username: prev.org_username, result: "updated" });
          continue;
        }
        if (takenLogin.has(r.username.toLowerCase())) throw new Fail(409, "username_taken");
        const base = {
          org_id: org.id, org_username: r.username, student_no: r.student_no, external_id: r.external_id,
          full_name: r.full_name, field: r.field, entry_year: r.entry_year, status: "active", created_by: c.id,
        };
        if (r.existing) {
          const [st] = await rest<{ id: string }[]>("lexa_org_students?select=id", {
            method: "POST", prefer: "return=representation", body: JSON.stringify(base),
          });
          const code = await issueCode(org.id, st.id, c.id);
          await audit(c.id, org.id, "student.create_code", null, { student: st.id, username: r.username });
          out.push({ row: r.i + 1, username: r.username, result: "code", code });
          continue;
        }
        const acc = await createAuthUser(r.full_name, org.id);
        try {
          await rest("lexa_org_students", {
            method: "POST", prefer: "return=minimal",
            body: JSON.stringify({ ...base, user_id: acc.id, official_since: new Date().toISOString() }),
          });
          await rest("lexa_org_logins", {
            method: "POST", prefer: "return=minimal",
            body: JSON.stringify({ org_id: org.id, org_username: r.username, user_id: acc.id, kind: "student" }),
          });
        } catch (e) {
          await rest(`lexa_org_students?user_id=eq.${acc.id}`, { method: "DELETE", prefer: "return=minimal" }).catch(() => {});
          await authAdmin(`users/${acc.id}`, "DELETE").catch(() => {});
          throw e;
        }
        takenLogin.add(r.username.toLowerCase());
        await audit(c.id, org.id, "student.create_account", acc.id, { username: r.username });
        out.push({ row: r.i + 1, username: r.username, result: "created", password: acc.password });
      } else {
        if (takenLogin.has(r.username.toLowerCase())) {
          out.push({ row: r.i + 1, username: r.username, result: "exists" });
          continue;
        }
        const acc = await createAuthUser(r.full_name, org.id);
        try {
          await rest(`lexa_profiles?id=eq.${acc.id}`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ role: "teacher" }) });
          await rest("lexa_org_members", {
            method: "POST", prefer: "return=minimal",
            body: JSON.stringify({ org_id: org.id, user_id: acc.id, role: "teacher", status: "active", invited_by: c.id }),
          });
          await rest("lexa_org_logins", {
            method: "POST", prefer: "return=minimal",
            body: JSON.stringify({ org_id: org.id, org_username: r.username, user_id: acc.id, kind: "staff" }),
          });
        } catch (e) {
          await authAdmin(`users/${acc.id}`, "DELETE").catch(() => {});
          throw e;
        }
        takenLogin.add(r.username.toLowerCase());
        await audit(c.id, org.id, "staff.create_account", acc.id, { username: r.username });
        out.push({ row: r.i + 1, username: r.username, result: "created", password: acc.password });
      }
    } catch (e) {
      out.push({ row: r.i + 1, username: r.username, result: "error", error: e instanceof Fail ? e.code : "error" });
    }
  }
  return json(200, { results: out });
}

async function studentOf(orgId: string, studentId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(studentId)) throw new Fail(400, "bad_request");
  const rows = await rest<{ id: string; user_id: string | null; status: string; org_username: string }[]>(
    `lexa_org_students?id=eq.${studentId}&org_id=eq.${orgId}&select=id,user_id,status,org_username&limit=1`,
  );
  if (!rows[0]) throw new Fail(404, "student_not_found");
  return rows[0];
}

async function managedBy(userId: string, orgId: string): Promise<boolean> {
  const f = await rest<{ managed_by_org: string | null }[]>(`lexa_account_flags?user_id=eq.${userId}&select=managed_by_org&limit=1`);
  return f[0]?.managed_by_org === orgId;
}

async function revoke(userId: string): Promise<boolean> {
  return !!(await rpc<boolean>("lexa_svc_revoke_sessions", { uid: userId }).catch(() => false));
}

async function actResetPassword(c: Caller, body: Record<string, unknown>): Promise<Response> {
  const org = await requireManager(c, String(body.org_id ?? ""));
  const userId = String(body.user_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Fail(400, "bad_request");
  const inOrg = await rest<unknown[]>(`lexa_org_logins?org_id=eq.${org.id}&user_id=eq.${userId}&select=user_id&limit=1`);
  if (!inOrg.length) throw new Fail(404, "student_not_found");
  // a person's own Lexa account (linked with a code) is never reset by a centre
  if (!(await managedBy(userId, org.id))) throw new Fail(403, "not_managed");
  const password = newPassword();
  await authAdmin(`users/${userId}`, "PUT", { password });
  await rest(`lexa_account_flags?user_id=eq.${userId}`, {
    method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ must_change_password: true }),
  });
  const revoked = await revoke(userId);
  await audit(c.id, org.id, "account.reset_password", userId, { revoked });
  return json(200, { password, sessions_revoked: revoked });
}

async function actSetStatus(c: Caller, body: Record<string, unknown>): Promise<Response> {
  const org = await requireManager(c, String(body.org_id ?? ""));
  const st = await studentOf(org.id, String(body.student_id ?? ""));
  const status = String(body.status ?? st.status);
  const after = String(body.access_after_exit ?? "open");
  const until = body.access_until ? String(body.access_until) : null;
  if (!["active", "suspended", "graduated", "withdrawn"].includes(status)) throw new Fail(400, "bad_status");
  if (!["open", "limited", "until"].includes(after)) throw new Fail(400, "bad_access");
  if (after === "until" && (!until || !/^\d{4}-\d{2}-\d{2}$/.test(until))) throw new Fail(400, "bad_access");
  if (status === "active" && st.status !== "active") {
    const used = await restAll<unknown>(`lexa_org_students?org_id=eq.${org.id}&status=eq.active&select=id&order=created_at`);
    if (used.length + 1 > org.student_seats) throw new Fail(409, "no_student_seats");
  }
  await rest(`lexa_org_students?id=eq.${st.id}`, {
    method: "PATCH", prefer: "return=minimal",
    body: JSON.stringify({ status, access_after_exit: after, access_until: after === "until" ? until : null }),
  });
  let revoked = false;
  if (st.user_id && (await managedBy(st.user_id, org.id))) {
    // a suspended centre-made account cannot sign in at all; others only lose centre access (RLS)
    if (status === "suspended" && st.status !== "suspended") {
      await authAdmin(`users/${st.user_id}`, "PUT", { ban_duration: "876000h" });
      revoked = await revoke(st.user_id);
    } else if (status !== "suspended" && st.status === "suspended") {
      await authAdmin(`users/${st.user_id}`, "PUT", { ban_duration: "none" });
    }
  }
  await audit(c.id, org.id, "student.set_status", st.user_id, { student: st.id, from: st.status, to: status, access: after, until });
  return json(200, { ok: true, sessions_revoked: revoked });
}

async function actIssueCode(c: Caller, body: Record<string, unknown>): Promise<Response> {
  const org = await requireManager(c, String(body.org_id ?? ""));
  const st = await studentOf(org.id, String(body.student_id ?? ""));
  if (st.user_id) throw new Fail(409, "already_linked");
  const code = await issueCode(org.id, st.id, c.id);
  await audit(c.id, org.id, "student.issue_code", null, { student: st.id });
  return json(200, { code, username: st.org_username });
}

async function actSetPassword(c: Caller, body: Record<string, unknown>): Promise<Response> {
  const pw = String(body.new_password ?? "");
  const flags = await rest<{ must_change_password: boolean; managed_by_org: string | null }[]>(
    `lexa_account_flags?user_id=eq.${c.id}&select=must_change_password,managed_by_org&limit=1`,
  );
  if (!flags[0]?.must_change_password) throw new Fail(409, "nothing_to_change");
  if (pw.length < 8 || pw.length > 128) throw new Fail(400, "weak_password");
  const names = await rest<{ org_username: string }[]>(`lexa_org_logins?user_id=eq.${c.id}&select=org_username`);
  const nums = await rest<{ student_no: string }[]>(`lexa_org_students?user_id=eq.${c.id}&select=student_no`);
  const bad = [...names.map((n) => n.org_username), ...nums.map((n) => n.student_no)].filter((s) => s && s.length >= 4).map((s) => s.toLowerCase());
  if (bad.some((b) => pw.toLowerCase().includes(b)) || /^(\d)\1+$/.test(pw) || /^(0123456789|12345678|123456789|87654321)$/.test(pw)) {
    throw new Fail(400, "weak_password");
  }
  await authAdmin(`users/${c.id}`, "PUT", { password: pw });
  await rest(`lexa_account_flags?user_id=eq.${c.id}`, {
    method: "PATCH", prefer: "return=minimal",
    body: JSON.stringify({ must_change_password: false, password_changed_at: new Date().toISOString() }),
  });
  if (body.accept_terms === true) {
    await rest(`lexa_org_students?user_id=eq.${c.id}&terms_accepted_at=is.null`, {
      method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ terms_accepted_at: new Date().toISOString() }),
    });
  }
  await audit(c.id, flags[0].managed_by_org, "account.first_password", c.id, { accepted_terms: body.accept_terms === true });
  return json(200, { ok: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (!SB_URL || !SERVICE_KEY || !PUBLIC_KEY) return json(500, { error: "not_configured" });
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "");
    if (action === "login") return await actLogin(req, body);
    const c = await caller(req);
    switch (action) {
      case "provision": return await actProvision(c, body);
      case "reset_password": return await actResetPassword(c, body);
      case "set_status": return await actSetStatus(c, body);
      case "issue_code": return await actIssueCode(c, body);
      case "set_password": return await actSetPassword(c, body);
      default: return json(400, { error: "unknown_action" });
    }
  } catch (e) {
    if (e instanceof Fail) return json(e.status, { error: e.code });
    console.error("org-auth", e instanceof Error ? e.message : "error");
    return json(500, { error: "server_error" });
  }
});
