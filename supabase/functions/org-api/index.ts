// Lexa org-api: the HTTP API of a centre (phase 5 of docs/ORG_LEARNING.md).
// verify_jwt=false — authentication is an API key with HMAC request signing:
//   X-Lexa-Key:       lxk_<prefix>            (the prefix identifies the key)
//   X-Lexa-Timestamp: unix seconds
//   X-Lexa-Signature: hex HMAC-SHA256(secret, timestamp + "." + sha256hex(body))
//   X-Lexa-Idempotency: optional idempotency key for POSTs (48 h, same answer replayed)
//   X-Lexa-Sandbox: 1  optional — everything is validated, nothing is written
// The secret lives in Supabase Vault only; the server verifies through lexa_api_verify.
//
// Endpoints (bulk rows are validated one by one; errors carry the row index):
//   POST /v1/students      {rows:[{external_id?, username, student_no?, full_name?, field?, entry_year?, status?}]}
//   POST /v1/staff         {rows:[{email, username, kind?}]}         (links existing profiles)
//   POST /v1/classes       {rows:[{external_id?, term: id|title, course: code|title, title?, teacher_username?}]}
//   POST /v1/enrollments   {rows:[{class, student, status?}]}        (refs: external_id or uuid)
//   POST /v1/grades        {rows:[{class, student, component, score, max_score?, note?}]}
//   POST /v1/students/{ref}/status   {status}
//   GET  /v1/reports/study?from=&to=                 (per-student active seconds)
//   GET  /v1/reports/grades?class=                   (final marks of a class)
//   GET  /v1/reports/comparison?class=&term=&inactive=&low=
// Limits: 900 requests per 5 minutes per centre, 500 rows per post, no personal data in logs.

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const MAX_ROWS = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USERNAME_RE = /^[A-Za-z0-9._-]{2,40}$/;
const STUDENT_STATUS = new Set(["active", "suspended", "graduated", "withdrawn"]);
const ENROLL_STATUS = new Set(["enrolled", "completed", "dropped"]);
const COMPONENTS = new Set(["midterm", "final_exam", "final"]);

class Fail extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-lexa-key, x-lexa-timestamp, x-lexa-signature, x-lexa-idempotency, x-lexa-sandbox",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// --- service-key REST helpers (same pattern as org-auth) ---
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
    console.error("rest", path.split("?")[0], res.status, t.slice(0, 200));
    throw new Fail(500, "db_error");
  }
  const t = await res.text();
  return (t ? JSON.parse(t) : null) as T;
}

async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  return rest<T>(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
}

// --- crypto ---
async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// --- small helpers ---
const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : "";

// the whole roster + classes + terms + subjects of the centre, once per request
type Student = { id: string; org_username: string; external_id: string; user_id: string | null; status: string };
type Cls = { id: string; external_id: string; term_id: string; course_id: string; title: string };
type Term = { id: string; title: string };
type Subject = { id: string; code: string; title: string };

async function loadState(org: string) {
  const [students, classes, terms, subjects] = await Promise.all([
    rest<Student[]>(`lexa_org_students?org_id=eq.${org}&select=id,org_username,external_id,user_id,status&order=created_at&limit=2000`),
    rest<Cls[]>(`lexa_org_classes?org_id=eq.${org}&select=id,external_id,term_id,course_id,title&order=created_at&limit=1000`),
    rest<Term[]>(`lexa_org_terms?org_id=eq.${org}&select=id,title&limit=200`),
    rest<Subject[]>(`lexa_org_courses?org_id=eq.${org}&select=id,code,title&limit=500`),
  ]);
  return { students, classes, terms, subjects };
}

function findStudent(st: Student[], ref: string): Student | undefined {
  const r = (ref ?? "").trim();
  if (!r) return undefined;
  return st.find((s) => s.external_id === r) ?? st.find((s) => s.org_username.toLowerCase() === r.toLowerCase())
    ?? (UUID_RE.test(r) ? st.find((s) => s.id === r) : undefined);
}

function findClass(cl: Cls[], ref: string): Cls | undefined {
  const r = (ref ?? "").trim();
  if (!r) return undefined;
  return cl.find((c) => c.external_id === r) ?? cl.find((c) => c.title === r)
    ?? (UUID_RE.test(r) ? cl.find((c) => c.id === r) : undefined);
}

// --- ingest actions (validated row by row; sandbox skips every write) ---
type Outcome = { processed: number; errors: { index: number; code: string }[] };

async function ingestStudents(org: string, rows: any[], sandbox: boolean): Promise<Outcome> {
  const { students } = await loadState(org);
  const out: Outcome = { processed: 0, errors: [] };
  const inserts: any[] = [];
  const updates: { id: string; row: any }[] = [];
  rows.forEach((row, i) => {
    const username = str(row.username, 40);
    const external = str(row.external_id, 80);
    const status = str(row.status, 20) || "active";
    if (!username && !external) { out.errors.push({ index: i, code: "username_or_external_required" }); return; }
    if (username && !USERNAME_RE.test(username)) { out.errors.push({ index: i, code: "bad_username" }); return; }
    if (!STUDENT_STATUS.has(status)) { out.errors.push({ index: i, code: "bad_status" }); return; }
    const dup = username ? students.find((s) => s.org_username.toLowerCase() === username.toLowerCase()) : undefined;
    if (dup && external && dup.external_id && dup.external_id !== external) { out.errors.push({ index: i, code: "username_taken" }); return; }
    const target = dup ?? (external ? students.find((s) => s.external_id === external) : undefined);
    const body = {
      ...(username ? { org_username: username } : {}),
      ...(external ? { external_id: external } : {}),
      ...(row.student_no !== undefined ? { student_no: str(row.student_no, 40) } : {}),
      ...(row.full_name !== undefined ? { full_name: str(row.full_name, 80) } : {}),
      ...(row.field !== undefined ? { field: str(row.field, 80) } : {}),
      ...(row.entry_year !== undefined ? { entry_year: str(row.entry_year, 10) } : {}),
      status,
    };
    if (target) updates.push({ id: target.id, row: body });
    else inserts.push(body);
  });
  if (!sandbox && inserts.length) {
    try {
      await rest(`lexa_org_students`, { method: "POST", body: JSON.stringify(inserts.map((b) => ({ ...b, org_id: org }))), prefer: "return=minimal" });
    } catch {
      for (const b of inserts) {
        try { await rest(`lexa_org_students`, { method: "POST", body: JSON.stringify({ ...b, org_id: org }), prefer: "return=minimal" }); }
        catch { out.errors.push({ index: -1, code: "insert_failed" }); }
      }
    }
  }
  if (!sandbox) {
    for (const u of updates) {
      try { await rest(`lexa_org_students?id=eq.${u.id}`, { method: "PATCH", body: JSON.stringify(u.row), prefer: "return=minimal" }); }
      catch { out.errors.push({ index: -1, code: "update_failed" }); }
    }
  }
  out.processed = rows.length - out.errors.length;
  return out;
}

async function ingestStaff(org: string, rows: any[], sandbox: boolean): Promise<Outcome> {
  const out: Outcome = { processed: 0, errors: [] };
  for (let i = 0; i < rows.length; i++) {
    const email = str(rows[i].email, 120).toLowerCase();
    const username = str(rows[i].username, 40);
    if (!email || !email.includes("@") || !USERNAME_RE.test(username)) {
      out.errors.push({ index: i, code: "bad_row" });
      continue;
    }
    try {
      const prof = await rest<{ id: string }[]>(`lexa_profiles?email=eq.${encodeURIComponent(email)}&select=id&limit=1`);
      if (!prof?.length) { out.errors.push({ index: i, code: "profile_not_found" }); continue; }
      const dup = await rest<{ org_username: string }[]>(`lexa_org_logins?org_id=eq.${org}&org_username=eq.${encodeURIComponent(username)}&select=org_username&limit=1`);
      if (sandbox) { out.processed++; continue; }
      if (dup?.length) {
        await rest(`lexa_org_logins?org_id=eq.${org}&org_username=eq.${encodeURIComponent(username)}`,
          { method: "PATCH", body: JSON.stringify({ user_id: prof[0].id, kind: "staff" }), prefer: "return=minimal" });
      } else {
        await rest("lexa_org_logins", { method: "POST", body: JSON.stringify({ org_id: org, org_username: username, user_id: prof[0].id, kind: "staff" }), prefer: "return=minimal" });
      }
      out.processed++;
    } catch { out.errors.push({ index: i, code: "row_failed" }); }
  }
  return out;
}

async function ingestClasses(org: string, rows: any[], sandbox: boolean): Promise<Outcome> {
  const st = await loadState(org);
  const out: Outcome = { processed: 0, errors: [] };
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const external = str(row.external_id, 80);
    const title = str(row.title, 120);
    if (external && st.classes.find((c) => c.external_id === external)) { out.processed++; continue; } // exists → idempotent
    if (!external && !title) { out.errors.push({ index: i, code: "external_or_title_required" }); continue; }
    // term: uuid or title (created on demand)
    let termId = "";
    const termRef = typeof row.term === "string" || typeof row.term === "number" ? str(row.term, 60) : str(row.term?.title, 60);
    if (!termRef) { out.errors.push({ index: i, code: "term_required" }); continue; }
    const termFound = UUID_RE.test(termRef) ? st.terms.find((t) => t.id === termRef) : st.terms.find((t) => t.title === termRef);
    if (termFound) termId = termFound.id;
    else if (!sandbox) {
      const created = await rest<{ id: string }[]>("lexa_org_terms", { method: "POST", body: JSON.stringify({ org_id: org, title: termRef }), prefer: "return=representation" });
      termId = created?.[0]?.id ?? "";
      if (termId) st.terms.push({ id: termId, title: termRef });
    } else { out.processed++; continue; }
    // subject: code or title (created on demand)
    let courseId = "";
    const cRef = typeof row.course === "string" || typeof row.course === "number" ? str(row.course, 60) : str(row.course?.code, 60);
    const cTitle = typeof row.course === "object" && row.course ? str(row.course.title, 120) : cRef;
    if (!cRef && !cTitle) { out.errors.push({ index: i, code: "course_required" }); continue; }
    const subjFound = st.subjects.find((s) => (cRef && s.code === cRef) || (cTitle && s.title === cTitle));
    if (subjFound) courseId = subjFound.id;
    else if (!sandbox) {
      const created = await rest<{ id: string }[]>("lexa_org_courses", { method: "POST", body: JSON.stringify({ org_id: org, code: cRef || "", title: cTitle || cRef }), prefer: "return=representation" });
      courseId = created?.[0]?.id ?? "";
      if (courseId) st.subjects.push({ id: courseId, code: cRef || "", title: cTitle || cRef });
    } else { out.processed++; continue; }
    if (sandbox) { out.processed++; continue; }
    if (!termId || !courseId) { out.errors.push({ index: i, code: "term_or_course_failed" }); continue; }
    // teacher by centre username (optional, must already be linked as staff)
    let teacherId: string | null = null;
    const tRef = str(row.teacher_username, 40);
    if (tRef) {
      const prof = await rest<{ user_id: string }[]>(`lexa_org_logins?org_id=eq.${org}&org_username=eq.${encodeURIComponent(tRef)}&kind=eq.staff&select=user_id&limit=1`);
      teacherId = prof?.[0]?.user_id ?? null;
    }
    const titleFinal = title || cTitle || cRef;
    const dup2 = st.classes.find((c) => c.title === titleFinal && c.term_id === termId && !c.external_id);
    const body = { org_id: org, term_id: termId, course_id: courseId, title: titleFinal, ...(external ? { external_id: external } : {}), ...(teacherId ? { teacher_id: teacherId } : {}) };
    try {
      if (dup2) await rest(`lexa_org_classes?id=eq.${dup2.id}`, { method: "PATCH", body: JSON.stringify(body), prefer: "return=minimal" });
      else await rest("lexa_org_classes", { method: "POST", body: JSON.stringify(body), prefer: "return=minimal" });
      st.classes.push({ id: "new-" + i, external_id: external, term_id: termId, course_id: courseId, title: titleFinal });
      out.processed++;
    } catch { out.errors.push({ index: i, code: "class_failed" }); }
  }
  return out;
}

async function ingestEnrollments(org: string, rows: any[], sandbox: boolean): Promise<Outcome> {
  const st = await loadState(org);
  const out: Outcome = { processed: 0, errors: [] };
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cls = findClass(st.classes, str(row.class, 80));
    const student = findStudent(st.students, str(row.student, 80));
    const status = str(row.status, 20) || "enrolled";
    if (!cls || !student) { out.errors.push({ index: i, code: !cls ? "class_not_found" : "student_not_found" }); continue; }
    if (!ENROLL_STATUS.has(status)) { out.errors.push({ index: i, code: "bad_status" }); continue; }
    if (sandbox) { out.processed++; continue; }
    try {
      const dup = await rest<{ class_id: string }[]>(`lexa_org_enrollments?class_id=eq.${cls.id}&student_id=eq.${student.id}&select=class_id&limit=1`);
      if (dup?.length) await rest(`lexa_org_enrollments?class_id=eq.${cls.id}&student_id=eq.${student.id}`, { method: "PATCH", body: JSON.stringify({ status }), prefer: "return=minimal" });
      else await rest("lexa_org_enrollments", { method: "POST", body: JSON.stringify({ class_id: cls.id, student_id: student.id, org_id: org, status }), prefer: "return=minimal" });
      out.processed++;
    } catch { out.errors.push({ index: i, code: "row_failed" }); }
  }
  return out;
}

async function ingestGrades(org: string, rows: any[], sandbox: boolean): Promise<Outcome> {
  const st = await loadState(org);
  const out: Outcome = { processed: 0, errors: [] };
  const upserts: any[] = [];
  rows.forEach((row, i) => {
    const cls = findClass(st.classes, str(row.class, 80));
    const student = findStudent(st.students, str(row.student, 80));
    const component = str(row.component, 20);
    const score = Number(row.score);
    const max = row.max_score === undefined ? 20 : Number(row.max_score);
    if (!cls || !student) { out.errors.push({ index: i, code: !cls ? "class_not_found" : "student_not_found" }); return; }
    if (!COMPONENTS.has(component)) { out.errors.push({ index: i, code: "bad_component" }); return; }
    if (!isFinite(score) || score < 0 || score > max || !isFinite(max) || max <= 0 || max > 100) { out.errors.push({ index: i, code: "bad_score" }); return; }
    upserts.push({ org_id: org, class_id: cls.id, student_id: student.id, component, score, max_score: max, source: "api", note: str(row.note, 200) });
  });
  if (!sandbox && upserts.length) {
    try {
      await rest("lexa_org_grades?on_conflict=class_id,student_id,component", { method: "POST", body: JSON.stringify(upserts), prefer: "resolution=merge-duplicates,return=minimal" });
    } catch {
      for (const u of upserts) {
        try { await rest("lexa_org_grades?on_conflict=class_id,student_id,component", { method: "POST", body: JSON.stringify(u), prefer: "resolution=merge-duplicates,return=minimal" }); }
        catch { out.errors.push({ index: -1, code: "row_failed" }); }
      }
    }
  }
  out.processed = rows.length - out.errors.length;
  return out;
}

async function setStudentStatus(org: string, ref: string, status: string, sandbox: boolean): Promise<Outcome> {
  const st = await loadState(org);
  const out: Outcome = { processed: 0, errors: [] };
  const student = findStudent(st.students, ref);
  if (!student) { out.errors.push({ index: 0, code: "student_not_found" }); return out; }
  if (!STUDENT_STATUS.has(status)) { out.errors.push({ index: 0, code: "bad_status" }); return out; }
  if (!sandbox) await rest(`lexa_org_students?id=eq.${student.id}`, { method: "PATCH", body: JSON.stringify({ status }), prefer: "return=minimal" });
  out.processed = 1;
  return out;
}

// --- reports (read scope) ---
async function reportStudy(org: string, from: string | null, to: string | null) {
  return rpc(`lexa_study_org`, { o: org, p_from: from, p_to: to });
}

async function reportGrades(org: string, classRef: string) {
  const st = await loadState(org);
  const cls = findClass(st.classes, classRef);
  if (!cls) throw new Fail(404, "class_not_found");
  const rows = await rest<{ student_id: string; score: number; max_score: number; updated_at: string }[]>(
    `lexa_org_grades?class_id=eq.${cls.id}&component=eq.final&select=student_id,score,max_score,updated_at`);
  return rows.map((r) => {
    const s = st.students.find((x) => x.id === r.student_id);
    return { student: s?.external_id || s?.org_username || r.student_id, score: r.score, max_score: r.max_score, updated_at: r.updated_at };
  });
}

async function reportComparison(org: string, params: URLSearchParams) {
  const st = await loadState(org);
  const cls = findClass(st.classes, params.get("class") ?? "");
  const termRef = params.get("term") ?? "";
  const term = UUID_RE.test(termRef) ? termRef : st.terms.find((t) => t.title === termRef)?.id;
  if (!cls || !term) throw new Fail(404, "class_or_term_not_found");
  const num = (k: string) => (params.get(k) ? Number(params.get(k)) : undefined);
  return rpc(`lexa_compare_report`, { o: org, p_class: cls.id, p_term: term, p_inactive: num("inactive") ?? 1, p_low: num("low") ?? 10 });
}

// --- main ---
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const url = new URL(req.url);
  const seg = url.pathname.split("/").filter(Boolean);
  const api = seg.indexOf("org-api");
  const path = seg.slice(api + 1).join("/"); // v1/students | v1/reports/study | ...
  const method = req.method;

  try {
    if (!SB_URL || !SERVICE_KEY) return json(500, { error: "server_config" });
    if (!path.startsWith("v1/")) return json(404, { error: "not_found" });

    // --- key + signature ---
    const prefix = req.headers.get("x-lexa-key")?.trim() ?? "";
    const ts = req.headers.get("x-lexa-timestamp")?.trim() ?? "";
    const sig = (req.headers.get("x-lexa-signature")?.trim() ?? "").toLowerCase();
    if (!prefix || !ts || !sig) return json(401, { error: "missing_auth" });
    const rawBody = method === "POST" ? await req.text() : "";
    const bodyHash = await sha256Hex(rawBody);
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
    let auth: { org_id: string; key_id: string; scopes: string[] };
    try {
      auth = await rpc<{ org_id: string; key_id: string; scopes: string[] }>("lexa_api_verify", { p_prefix: prefix, p_ts: ts, p_sig: sig, p_body_hash: bodyHash, p_ip: ip });
    } catch (e) {
      const code = e instanceof Error ? e.message : "bad_auth";
      return json(401, { error: code.includes(" ") || !code.startsWith("bad_") ? "bad_auth" : code });
    }
    const sandbox = req.headers.get("x-lexa-sandbox") === "1";

    // --- rate limit per centre ---
    const okRate = await rpc<boolean>("lexa_svc_rate_ok", { p_key: `orgapi:${auth.org_id}`, p_max: 900, p_window_s: 300 });
    if (!okRate) return json(429, { error: "rate_limited" });

    const sub = path.slice(3); // students | reports/study | students/<ref>/status
    const isRead = method === "GET";
    if (isRead && !auth.scopes.includes("read")) return json(403, { error: "scope_read_required" });
    if (!isRead && !auth.scopes.includes("write")) return json(403, { error: "scope_write_required" });

    // --- idempotency (POST only) ---
    const idem = req.headers.get("x-lexa-idempotency")?.trim() ?? "";
    if (method === "POST" && idem) {
      if (idem.length < 8 || idem.length > 100) return json(400, { error: "bad_idempotency_key" });
      const prior = await rest<{ body_hash: string; status: number; response: unknown }[]>(
        `lexa_api_idempotency?org_id=eq.${auth.org_id}&idem=eq.${encodeURIComponent(idem)}&select=body_hash,status,response&limit=1`);
      if (prior?.length) {
        if (prior[0].body_hash !== bodyHash) return json(409, { error: "idempotency_key_reused" });
        return json(prior[0].status, prior[0].response);
      }
    }

    const finish = async (status: number, body: unknown): Promise<Response> => {
      if (method === "POST" && idem && status < 500 && !sandbox) {
        try {
          await rest("lexa_api_idempotency", { method: "POST", body: JSON.stringify({ org_id: auth.org_id, idem, endpoint: sub.slice(0, 120), body_hash: bodyHash, status, response: body }), prefer: "resolution=ignore-duplicates,return=minimal" });
          await rest(`lexa_api_idempotency?created_at=lt.${encodeURIComponent(new Date(Date.now() - 48 * 3600 * 1000).toISOString())}`, { method: "DELETE", prefer: "return=minimal" });
        } catch { /* best effort */ }
      }
      return json(status, body);
    };

    // --- route ---
    if (method === "POST" && sub.startsWith("students/") && sub.endsWith("/status")) {
      const ref = decodeURIComponent(sub.slice("students/".length, -"/status".length));
      let body: any = {};
      try { body = JSON.parse(rawBody || "{}"); } catch { return finish(400, { error: "bad_json" }); }
      const out = await setStudentStatus(auth.org_id, ref, str(body.status, 20), sandbox);
      if (out.errors.length && !out.processed) return finish(404, { ok: false, errors: out.errors });
      await rpc("lexa_svc_audit", { o: auth.org_id, act: `api.status${sandbox ? ".sandbox" : ""}`, tgt: auth.org_id, info: { ref_len: ref.length, key: auth.key_id } }).catch(() => {});
      return finish(200, { ok: true, ...out });
    }

    if (method === "POST") {
      const map: Record<string, (o: string, r: any[], s: boolean) => Promise<Outcome>> = {
        "students": ingestStudents, "staff": ingestStaff, "classes": ingestClasses,
        "enrollments": ingestEnrollments, "grades": ingestGrades,
      };
      const fn = map[sub];
      if (!fn) return json(404, { error: "not_found" });
      let body: any = {};
      try { body = JSON.parse(rawBody || "{}"); } catch { return finish(400, { error: "bad_json" }); }
      const rows = body.rows;
      if (!Array.isArray(rows) || !rows.length) return finish(400, { error: "rows_required" });
      if (rows.length > MAX_ROWS) return finish(413, { error: "too_many_rows", max: MAX_ROWS });
      const out = await fn(auth.org_id, rows, sandbox);
      await rpc("lexa_svc_audit", { o: auth.org_id, act: `api.${sub}${sandbox ? ".sandbox" : ""}`, tgt: auth.org_id, info: { rows: rows.length, errors: out.errors.length, key: auth.key_id } }).catch(() => {});
      return finish(200, { ok: true, sandbox: sandbox || undefined, ...out });
    }

    if (method === "GET" && sub.startsWith("reports/")) {
      const which = sub.slice("reports/".length);
      if (which === "study") return finish(200, { ok: true, rows: await reportStudy(auth.org_id, url.searchParams.get("from"), url.searchParams.get("to")) });
      if (which === "grades") {
        const ref = url.searchParams.get("class") ?? "";
        return finish(200, { ok: true, rows: await reportGrades(auth.org_id, ref) });
      }
      if (which === "comparison") return finish(200, { ok: true, report: await reportComparison(auth.org_id, url.searchParams) });
      return json(404, { error: "not_found" });
    }

    return json(404, { error: "not_found" });
  } catch (e) {
    if (e instanceof Fail) return json(e.status, { error: e.code });
    console.error("org-api", e);
    return json(500, { error: "internal" });
  }
});
