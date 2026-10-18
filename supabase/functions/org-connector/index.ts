// Lexa org-connector: WE read from the centre's own system (phase 7 of docs/ORG_LEARNING.md).
// verify_jwt=true — only a manager with a two-factor session can run it, through
// lexa_integration_secret(o) which checks lexa_org_require_manager(o, true).
// The read-only password never leaves the Vault boundary: it is fetched inside the
// function, used for Basic auth against the centre's HTTPS endpoint, and dropped.
//
// Contract: the centre exposes an HTTPS endpoint that returns JSON, either
//   {"students":[...], "staff":[...], "classes":[...], "enrollments":[...], "grades":[...]}
// (any subset; the same row shapes as the phase-5 API) or a bare array of students.
// Every run writes one row into lexa_integration_runs with its stats or failure.
// Duplicate rows are matched by external_id / username and updated (never duplicated).

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USERNAME_RE = /^[A-Za-z0-9._-]{2,40}$/;
const STUDENT_STATUS = new Set(["active", "suspended", "graduated", "withdrawn"]);
const ENROLL_STATUS = new Set(["enrolled", "completed", "dropped"]);
const COMPONENTS = new Set(["midterm", "final_exam", "final"]);
const MAX_ROWS = 500;

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
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function svcHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { apikey: SERVICE_KEY, "Content-Type": "application/json", ...extra };
  if (SERVICE_KEY.startsWith("eyJ")) h.Authorization = `Bearer ${SERVICE_KEY}`;
  return h;
}

async function svcRest<T = unknown>(path: string, init: RequestInit & { prefer?: string } = {}): Promise<T> {
  const headers = svcHeaders(init.prefer ? { Prefer: init.prefer } : {});
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error("svc rest", path.split("?")[0], res.status, t.slice(0, 200));
    throw new Fail(500, "db_error");
  }
  const t = await res.text();
  return (t ? JSON.parse(t) : null) as T;
}

/** a call with the USER's JWT — RLS and the guard RPCs run as the manager */
async function userRpc<T = unknown>(auth: string, fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const t = await res.text();
  if (!res.ok) throw new Fail(res.status === 400 ? 403 : res.status, t.slice(0, 120));
  return (t ? JSON.parse(t) : null) as T;
}

const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : "";

type State = {
  students: { id: string; org_username: string; external_id: string; status: string }[];
  classes: { id: string; external_id: string; term_id: string; course_id: string; title: string }[];
  terms: { id: string; title: string }[];
  subjects: { id: string; code: string; title: string }[];
};

async function loadState(org: string): Promise<State> {
  const [students, classes, terms, subjects] = await Promise.all([
    svcRest<State["students"]>(`lexa_org_students?org_id=eq.${org}&select=id,org_username,external_id,status&limit=2000`),
    svcRest<State["classes"]>(`lexa_org_classes?org_id=eq.${org}&select=id,external_id,term_id,course_id,title&limit=1000`),
    svcRest<State["terms"]>(`lexa_org_terms?org_id=eq.${org}&select=id,title&limit=200`),
    svcRest<State["subjects"]>(`lexa_org_courses?org_id=eq.${org}&select=id,code,title&limit=500`),
  ]);
  return { students, classes, terms, subjects };
}

function findStudent(st: State["students"], ref: string) {
  const r = (ref ?? "").trim();
  if (!r) return undefined;
  return st.find((s) => s.external_id === r) ?? st.find((s) => s.org_username.toLowerCase() === r.toLowerCase())
    ?? (UUID_RE.test(r) ? st.find((s) => s.id === r) : undefined);
}

function findClass(cl: State["classes"], ref: string) {
  const r = (ref ?? "").trim();
  if (!r) return undefined;
  return cl.find((c) => c.external_id === r) ?? cl.find((c) => c.title === r)
    ?? (UUID_RE.test(r) ? cl.find((c) => c.id === r) : undefined);
}

type Stats = { students: number; staff: number; classes: number; enrollments: number; grades: number; errors: number };

async function ingest(org: string, payload: any, st: State): Promise<Stats> {
  const stats: Stats = { students: 0, staff: 0, classes: 0, enrollments: 0, grades: 0, errors: 0 };
  const take = (v: unknown) => (Array.isArray(v) ? v.slice(0, MAX_ROWS) : []);

  // students
  for (const row of take(payload.students)) {
    try {
      const username = str(row.username, 40);
      const external = str(row.external_id, 80);
      const status = str(row.status, 20) || "active";
      if ((!username && !external) || !STUDENT_STATUS.has(status)) { stats.errors++; continue; }
      const dup = username ? st.students.find((s) => s.org_username.toLowerCase() === username.toLowerCase()) : undefined;
      const target = dup ?? (external ? st.students.find((s) => s.external_id === external) : undefined);
      const body = {
        ...(username ? { org_username: username } : {}), ...(external ? { external_id: external } : {}),
        ...(row.student_no !== undefined ? { student_no: str(row.student_no, 40) } : {}),
        ...(row.full_name !== undefined ? { full_name: str(row.full_name, 80) } : {}),
        ...(row.field !== undefined ? { field: str(row.field, 80) } : {}),
        ...(row.entry_year !== undefined ? { entry_year: str(row.entry_year, 10) } : {}),
        status,
      };
      if (target) {
        await svcRest(`lexa_org_students?id=eq.${target.id}`, { method: "PATCH", body: JSON.stringify(body), prefer: "return=minimal" });
        Object.assign(target, body as any);
      } else {
        const created = await svcRest<{ id: string }[]>("lexa_org_students", { method: "POST", body: JSON.stringify({ ...body, org_id: org }), prefer: "return=representation" });
        if (created?.[0]) st.students.push({ id: created[0].id, org_username: username || external, external_id: external, status });
      }
      stats.students++;
    } catch { stats.errors++; }
  }

  // staff (link existing profiles only)
  for (const row of take(payload.staff)) {
    try {
      const email = str(row.email, 120).toLowerCase();
      const username = str(row.username, 40);
      if (!email.includes("@") || !USERNAME_RE.test(username)) { stats.errors++; continue; }
      const prof = await svcRest<{ id: string }[]>(`lexa_profiles?email=eq.${encodeURIComponent(email)}&select=id&limit=1`);
      if (!prof?.length) { stats.errors++; continue; }
      const dup = await svcRest<{ org_username: string }[]>(`lexa_org_logins?org_id=eq.${org}&org_username=eq.${encodeURIComponent(username)}&select=org_username&limit=1`);
      if (dup?.length) await svcRest(`lexa_org_logins?org_id=eq.${org}&org_username=eq.${encodeURIComponent(username)}`, { method: "PATCH", body: JSON.stringify({ user_id: prof[0].id, kind: "staff" }), prefer: "return=minimal" });
      else await svcRest("lexa_org_logins", { method: "POST", body: JSON.stringify({ org_id: org, org_username: username, user_id: prof[0].id, kind: "staff" }), prefer: "return=minimal" });
      stats.staff++;
    } catch { stats.errors++; }
  }

  // classes (term/subject found or created by title/code)
  for (const row of take(payload.classes)) {
    try {
      const external = str(row.external_id, 80);
      const title = str(row.title, 120);
      if (external && st.classes.find((c) => c.external_id === external)) { stats.classes++; continue; }
      if (!external && !title) { stats.errors++; continue; }
      const termRef = typeof row.term === "string" || typeof row.term === "number" ? str(row.term, 60) : str(row.term?.title, 60);
      if (!termRef) { stats.errors++; continue; }
      let term = UUID_RE.test(termRef) ? st.terms.find((t) => t.id === termRef) : st.terms.find((t) => t.title === termRef);
      if (!term) {
        const created = await svcRest<{ id: string }[]>("lexa_org_terms", { method: "POST", body: JSON.stringify({ org_id: org, title: termRef }), prefer: "return=representation" });
        term = { id: created?.[0]?.id ?? "", title: termRef };
        if (term.id) st.terms.push(term);
      }
      const cRef = typeof row.course === "string" || typeof row.course === "number" ? str(row.course, 60) : str(row.course?.code, 60);
      const cTitle = typeof row.course === "object" && row.course ? str(row.course.title, 120) : cRef;
      if (!cRef && !cTitle) { stats.errors++; continue; }
      let subj = st.subjects.find((s) => (cRef && s.code === cRef) || (cTitle && s.title === cTitle));
      if (!subj) {
        const created = await svcRest<{ id: string }[]>("lexa_org_courses", { method: "POST", body: JSON.stringify({ org_id: org, code: cRef || "", title: cTitle || cRef }), prefer: "return=representation" });
        subj = { id: created?.[0]?.id ?? "", code: cRef || "", title: cTitle || cRef };
        if (subj.id) st.subjects.push(subj);
      }
      if (!term?.id || !subj?.id) { stats.errors++; continue; }
      const titleFinal = title || cTitle || cRef;
      const dup2 = st.classes.find((c) => c.title === titleFinal && c.term_id === term!.id && !c.external_id);
      const body = { org_id: org, term_id: term.id, course_id: subj.id, title: titleFinal, ...(external ? { external_id: external } : {}) };
      if (dup2) await svcRest(`lexa_org_classes?id=eq.${dup2.id}`, { method: "PATCH", body: JSON.stringify(body), prefer: "return=minimal" });
      else {
        const created = await svcRest<{ id: string }[]>("lexa_org_classes", { method: "POST", body: JSON.stringify(body), prefer: "return=representation" });
        if (created?.[0]) st.classes.push({ id: created[0].id, external_id: external, term_id: term.id, course_id: subj.id, title: titleFinal });
      }
      stats.classes++;
    } catch { stats.errors++; }
  }

  // enrollments
  for (const row of take(payload.enrollments)) {
    try {
      const cls = findClass(st.classes, str(row.class, 80));
      const student = findStudent(st.students, str(row.student, 80));
      const status = str(row.status, 20) || "enrolled";
      if (!cls || !student || !ENROLL_STATUS.has(status)) { stats.errors++; continue; }
      const dup = await svcRest<{ class_id: string }[]>(`lexa_org_enrollments?class_id=eq.${cls.id}&student_id=eq.${student.id}&select=class_id&limit=1`);
      if (dup?.length) await svcRest(`lexa_org_enrollments?class_id=eq.${cls.id}&student_id=eq.${student.id}`, { method: "PATCH", body: JSON.stringify({ status }), prefer: "return=minimal" });
      else await svcRest("lexa_org_enrollments", { method: "POST", body: JSON.stringify({ class_id: cls.id, student_id: student.id, org_id: org, status }), prefer: "return=minimal" });
      stats.enrollments++;
    } catch { stats.errors++; }
  }

  // grades
  for (const row of take(payload.grades)) {
    try {
      const cls = findClass(st.classes, str(row.class, 80));
      const student = findStudent(st.students, str(row.student, 80));
      const component = str(row.component, 20);
      const score = Number(row.score);
      const max = row.max_score === undefined ? 20 : Number(row.max_score);
      if (!cls || !student || !COMPONENTS.has(component) || !isFinite(score) || score < 0 || score > max || max <= 0) { stats.errors++; continue; }
      await svcRest("lexa_org_grades?on_conflict=class_id,student_id,component", { method: "POST", body: JSON.stringify({ org_id: org, class_id: cls.id, student_id: student.id, component, score, max_score: max, source: "connector", note: str(row.note, 200) }), prefer: "resolution=merge-duplicates,return=minimal" });
      stats.grades++;
    } catch { stats.errors++; }
  }
  return stats;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  try {
    if (req.method !== "POST") return json(405, { error: "method" });
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json(401, { error: "not_signed_in" });
    let body: any = {};
    try { body = await req.json(); } catch { return json(400, { error: "bad_json" }); }
    const action = str(body.action, 20);
    const org = str(body.org, 40);
    if (!UUID_RE.test(org)) return json(400, { error: "bad_org" });

    if (action === "runs") {
      return json(200, { ok: true, rows: await userRpc(auth, "lexa_integration_runs_list", { o: org, p_limit: 20 }) });
    }

    if (action === "run" || action === "ping") {
      // guard + credentials (manager + aal2; enabled check inside)
      const cfg = await userRpc<{ base_url: string; username: string; password: string }>(auth, "lexa_integration_secret", { o: org });
      const run = await svcRest<{ id: string }[]>("lexa_integration_runs", { method: "POST", body: JSON.stringify({ org_id: org, trigger: "manual", status: "running", stats: {} }), prefer: "return=representation" });
      const runId = run?.[0]?.id ?? "";
      const setRun = async (status: string, stats: Stats | { http?: number }, message: string) => {
        if (!runId) return;
        await svcRest(`lexa_integration_runs?id=eq.${runId}`, { method: "PATCH", body: JSON.stringify({ status, stats, message: message.slice(0, 500), finished_at: new Date().toISOString() }), prefer: "return=minimal" }).catch(() => {});
        await svcRest(`lexa_org_integrations?org_id=eq.${org}`, { method: "PATCH", body: JSON.stringify({ last_status: status, last_run_at: new Date().toISOString() }), prefer: "return=minimal" }).catch(() => {});
      };
      try {
        const res = await fetch(cfg.base_url, {
          headers: { Authorization: "Basic " + btoa(`${cfg.username}:${cfg.password}`), Accept: "application/json" },
        });
        if (!res.ok) { await setRun("failed", { http: res.status }, `HTTP ${res.status}`); return json(502, { ok: false, error: "upstream_http_" + res.status, run_id: runId }); }
        let payload = await res.json().catch(() => null);
        if (action === "ping") {
          await setRun("ok", { http: res.status }, "اتصال آزمایشی موفق");
          return json(200, { ok: true, run_id: runId, ping: true });
        }
        if (Array.isArray(payload)) payload = { students: payload };
        if (!payload || typeof payload !== "object") { await setRun("failed", {}, "پاسخ JSON نامعتبر"); return json(502, { ok: false, error: "bad_upstream_json", run_id: runId }); }
        const st = await loadState(org);
        const stats = await ingest(org, payload, st);
        await setRun("ok", stats, "");
        await svcRest("rpc/lexa_svc_audit", { method: "POST", headers: svcHeaders(), body: JSON.stringify({ o: org, act: "connector.run", tgt: org, info: { stats } }) }).catch(() => {});
        return json(200, { ok: true, run_id: runId, stats });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "fetch_failed";
        await setRun("failed", {}, msg);
        return json(502, { ok: false, error: "upstream_failed", detail: msg, run_id: runId });
      }
    }

    return json(400, { error: "bad_action" });
  } catch (e) {
    if (e instanceof Fail) return json(e.status, { error: e.code });
    console.error("org-connector", e);
    return json(500, { error: "internal" });
  }
});
