// Lexa org-connector: Lexa reads a centre's own server (phase 7 of docs/ORG_LEARNING.md; centre guide
// in docs/ORG_CONNECTOR.md). Deploy:  supabase functions deploy org-connector --no-verify-jwt
//
// Secrets (Edge Function settings):
//   LEXA_SERVICE_KEY      secret / service_role key (falls back to SUPABASE_SERVICE_ROLE_KEY)
//   LEXA_PUBLISHABLE_KEY  publishable / anon key   (falls back to SUPABASE_ANON_KEY)
//   LEXA_API_PEPPER       the same value as org-api (the connector signs its calls to org-api with it)
//   LEXA_CRON_SECRET      long random string; pg_cron sends it to /tick (see docs/ORG_P7_SETUP.md)
//
// Routes (prefix /functions/v1/org-connector):
//   POST /test   app (manager session): read the first page of each resource; answers row counts and
//                field names only, never values
//   POST /run    app (manager session): { org_id, integration_id, dry } runs now; dry = read, map and
//                check without writing anything
//   POST /tick   pg_cron (x-lexa-cron header): runs the integrations that are due
//
// What it does: GET (HTTPS only, same host as the configured address, no redirects, 20 s, 5 MB per
// response) -> keep only the mapped fields -> students and staff to org-api with the integration's
// own key; classes, enrolments, grades and prior GPA to lexa_connector_bulk (source = connector).
// The credential comes from Supabase Vault for each run and is never logged or returned. New
// accounts get a random password nobody sees: the centre prints login cards (password reset) later.

const SB_URL = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const SERVICE_KEY = Deno.env.get("LEXA_SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PUBLIC_KEY = Deno.env.get("LEXA_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const PEPPER = Deno.env.get("LEXA_API_PEPPER") ?? "";
const CRON_SECRET = Deno.env.get("LEXA_CRON_SECRET") ?? "";

const FETCH_TIMEOUT_MS = 20_000;
const MAX_BYTES = 5_000_000;
const MAX_ROWS = 20_000;
const MAX_PAGES = 50;
const MAX_STATUS_CHANGES = 100;
const MAX_ERRORS = 100;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Res = "staff" | "students" | "classes" | "enrollments" | "grades" | "prior_gpa";
const ORDER: Res[] = ["staff", "students", "classes", "enrollments", "grades", "prior_gpa"];
const FIELDS: Record<Res, string[]> = {
  students: ["username", "student_no", "external_id", "full_name", "field", "entry_year", "status"],
  staff: ["username", "full_name"],
  classes: ["external_id", "title", "teacher", "status", "term_code", "term_title", "term_starts_on", "term_ends_on",
            "term_status", "course_code", "course_title", "course_units"],
  enrollments: ["class", "student", "status"],
  grades: ["class", "student", "component", "score", "max"],
  prior_gpa: ["student", "gpa", "as_of"],
};
const BATCH: Record<Res, number> = { staff: 300, students: 300, classes: 500, enrollments: 2000, grades: 2000, prior_gpa: 5000 };
const OK_RESULTS = new Set(["created", "updated", "same", "saved", "skipped", "exists", "code"]);
const STATUS_WORDS: Record<string, string> = {
  active: "active", suspended: "suspended", graduated: "graduated", withdrawn: "withdrawn",
  "\u0641\u0639\u0627\u0644": "active", "\u0645\u0639\u0644\u0642": "suspended",
  "\u0641\u0627\u0631\u063a\u200c\u0627\u0644\u062a\u062d\u0635\u06cc\u0644": "graduated",
  "\u0641\u0627\u0631\u063a \u0627\u0644\u062a\u062d\u0635\u06cc\u0644": "graduated",
  "\u0627\u0646\u0635\u0631\u0627\u0641\u06cc": "withdrawn", "\u0627\u0646\u0635\u0631\u0627\u0641": "withdrawn",
};

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

// --- Supabase helpers ---
function svcHeaders(): Record<string, string> {
  const h: Record<string, string> = { apikey: SERVICE_KEY, "Content-Type": "application/json" };
  if (SERVICE_KEY.startsWith("eyJ")) h.Authorization = `Bearer ${SERVICE_KEY}`;
  return h;
}
async function rest<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers: { ...svcHeaders(), ...(init.headers ?? {}) } });
  const t = await res.text();
  if (!res.ok) {
    const m = t.match(/"message"\s*:\s*"([a-z_:]{3,60})"/);
    console.error("rest", path.split("?")[0], res.status, t.slice(0, 200));
    throw new Fail(500, m?.[1] ?? "db_error");
  }
  return (t ? JSON.parse(t) : null) as T;
}
const rpc = <T = unknown>(fn: string, args: Record<string, unknown>) =>
  rest<T>(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });

async function asUserRpc<T>(token: string, fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: PUBLIC_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const t = await res.text();
  if (!res.ok) {
    const msg = t.match(/"message"\s*:\s*"([^"]{1,80})"/)?.[1] ?? "error";
    if (/mfa required/.test(msg)) throw new Fail(403, "mfa_required");
    if (/not a manager|not signed in/.test(msg)) throw new Fail(403, "not_manager");
    throw new Fail(500, "db_error");
  }
  return (t ? JSON.parse(t) : null) as T;
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

// --- crypto (same scheme as org-api) ---
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
const sha256Hex = async (s: string) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function b64(s: string): string {
  let out = "";
  for (const x of enc.encode(s)) out += String.fromCharCode(x);
  return btoa(out);
}

// --- reading the centre's server ---
class SourceError extends Error {}

function privateIp(ip: string): boolean {
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
  }
  const s = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (!s.includes(":")) return false;
  if (s === "::" || s === "::1" || /^f[cd]/.test(s) || /^fe[89ab]/.test(s)) return true;
  const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? privateIp(mapped[1]) : false;
}

async function checkHost(host: string): Promise<void> {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (!h || h === "localhost" || /\.(localhost|local|internal|lan|home|arpa)$/.test(h) || !h.includes(".")) {
    throw new SourceError("host_not_allowed");
  }
  if (privateIp(h)) throw new SourceError("host_not_allowed");
  const resolve = (Deno as unknown as { resolveDns?: (n: string, t: string) => Promise<string[]> }).resolveDns;
  if (typeof resolve !== "function" || /^[\d.]+$/.test(h) || h.includes(":")) return;
  const found: string[] = [];
  for (const t of ["A", "AAAA"]) {
    try { found.push(...(await resolve(h, t))); } catch { /* no record of this type */ }
  }
  if (!found.length) throw new SourceError("source_unreachable");
  if (found.some(privateIp)) throw new SourceError("host_not_allowed");
}

type Integration = {
  id: string; org_id: string; name: string; kind: "rest_json" | "csv_url"; base_url: string;
  auth_kind: "none" | "bearer" | "basic" | "header"; auth_user: string; secret: string | null;
  resources: Partial<Record<Res, ResCfg>>; options: Options; enabled: boolean; org_active: boolean;
  key_id: string | null; key_salt: string | null;
};
type ResCfg = {
  enabled?: boolean; path?: string; list_key?: string; map?: Record<string, string>;
  defaults?: Record<string, string>; values?: Record<string, Record<string, string>>;
};
type Options = {
  pagination?: "none" | "page" | "offset"; page_param?: string; size_param?: string; page_size?: number;
  csv_delimiter?: string; date_format?: "gregorian" | "jalali"; create_students?: boolean; status_sync?: boolean;
  exit_access?: "open" | "limited";
};
type Row = Record<string, unknown>;

function sourceUrl(cfg: Integration, path: string, extra: Record<string, string> = {}): URL {
  const base = new URL(cfg.base_url);
  const p = path || "";
  const u = p.startsWith("?") || !p ? new URL(cfg.base_url + p) : new URL(cfg.base_url.replace(/\/+$/, "") + p);
  if (u.protocol !== "https:" || u.host !== base.host || u.username || u.password) throw new SourceError("bad_path");
  for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v);
  return u;
}

function authHeaders(cfg: Integration): Record<string, string> {
  const h: Record<string, string> = { Accept: cfg.kind === "csv_url" ? "text/csv, text/plain, */*" : "application/json" };
  if (cfg.auth_kind === "none") return h;
  if (!cfg.secret) throw new SourceError("no_secret");
  if (cfg.auth_kind === "bearer") h.Authorization = `Bearer ${cfg.secret}`;
  else if (cfg.auth_kind === "basic") h.Authorization = `Basic ${b64(`${cfg.auth_user}:${cfg.secret}`)}`;
  else if (cfg.auth_kind === "header") h[cfg.auth_user] = cfg.secret;
  return h;
}

async function getText(u: URL, headers: Record<string, string>): Promise<string> {
  await checkHost(u.hostname);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(u, { headers, redirect: "manual", signal: ctl.signal });
    if (res.status >= 300 && res.status < 400) throw new SourceError("redirect_not_allowed");
    if (res.status === 401 || res.status === 403) throw new SourceError("source_auth_failed");
    if (res.status === 404) throw new SourceError("source_not_found");
    if (!res.ok) throw new SourceError(`source_http_${res.status}`);
    if (Number(res.headers.get("content-length") ?? "0") > MAX_BYTES) throw new SourceError("source_too_large");
    const reader = res.body?.getReader();
    if (!reader) return "";
    const parts: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) { await reader.cancel().catch(() => {}); throw new SourceError("source_too_large"); }
      parts.push(value);
    }
    const all = new Uint8Array(size);
    let at = 0;
    for (const p of parts) { all.set(p, at); at += p.length; }
    return new TextDecoder().decode(all).replace(/^\uFEFF/, "");
  } catch (e) {
    if (e instanceof SourceError) throw e;
    if (e instanceof Error && e.name === "AbortError") throw new SourceError("source_timeout");
    throw new SourceError("source_unreachable");
  } finally {
    clearTimeout(timer);
  }
}

export function parseCsv(text: string, delim = ","): Row[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  if (rows.length < 1) return [];
  const head = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const o: Row = {};
    head.forEach((h, j) => { if (h) o[h] = r[j] ?? ""; });
    return o;
  });
}

function pick(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function listOf(body: unknown, key: string | undefined): Row[] {
  const v = key ? pick(body, key) : body;
  if (Array.isArray(v)) return v.filter((x) => x && typeof x === "object") as Row[];
  if (!key && v && typeof v === "object") {
    for (const k of ["data", "items", "results", "rows", "records"]) {
      const inner = (v as Record<string, unknown>)[k];
      if (Array.isArray(inner)) return inner.filter((x) => x && typeof x === "object") as Row[];
    }
  }
  throw new SourceError("source_bad_shape");
}

async function readResource(cfg: Integration, rc: ResCfg, firstPageOnly = false): Promise<Row[]> {
  const headers = authHeaders(cfg);
  if (cfg.kind === "csv_url") {
    const d = cfg.options.csv_delimiter === ";" || cfg.options.csv_delimiter === "\t" ? cfg.options.csv_delimiter : ",";
    const rows = parseCsv(await getText(sourceUrl(cfg, rc.path ?? ""), headers), d);
    if (rows.length > MAX_ROWS) throw new SourceError("too_many_rows");
    return rows;
  }
  const mode = cfg.options.pagination ?? "none";
  const parse = (t: string) => {
    try { return JSON.parse(t) as unknown; } catch { throw new SourceError("source_bad_json"); }
  };
  if (mode === "none") {
    const rows = listOf(parse(await getText(sourceUrl(cfg, rc.path ?? ""), headers)), rc.list_key);
    if (rows.length > MAX_ROWS) throw new SourceError("too_many_rows");
    return rows;
  }
  const size = Math.max(1, Math.min(5000, Math.floor(Number(cfg.options.page_size) || 500)));
  const pageParam = (cfg.options.page_param || (mode === "page" ? "page" : "offset")).slice(0, 40);
  const sizeParam = (cfg.options.size_param || (mode === "page" ? "" : "limit")).slice(0, 40);
  const out: Row[] = [];
  for (let n = 0; n < MAX_PAGES; n++) {
    const extra: Record<string, string> = { [pageParam]: String(mode === "page" ? n + 1 : n * size) };
    if (sizeParam) extra[sizeParam] = String(size);
    const rows = listOf(parse(await getText(sourceUrl(cfg, rc.path ?? "", extra), headers)), rc.list_key);
    out.push(...rows);
    if (out.length > MAX_ROWS) throw new SourceError("too_many_rows");
    if (firstPageOnly || !rows.length || (sizeParam && rows.length < size)) break;
  }
  return out;
}

// --- mapping ---
const DIGITS: Record<string, string> = {};
for (let i = 0; i < 10; i++) {
  DIGITS[String.fromCharCode(0x06f0 + i)] = String(i);
  DIGITS[String.fromCharCode(0x0660 + i)] = String(i);
}
const latin = (s: string) => s.replace(/[\u06f0-\u06f9\u0660-\u0669]/g, (c) => DIGITS[c] ?? c).replace(/\u066b/g, ".").replace(/\u066c/g, "");

const div = (a: number, b: number) => Math.trunc(a / b);
const mod = (a: number, b: number) => a - Math.trunc(a / b) * b;
function jalCal(jy: number) {
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jump = 0;
  for (let i = 1; i < breaks.length; i++) {
    const jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  return { gy, march: 20 + leapJ - leapG };
}
function g2d(gy: number, gm: number, gd: number): number {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}
function d2g(jdn: number): [number, number, number] {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return [gy, gm, gd];
}
export function jalaliToIso(jy: number, jm: number, jd: number): string {
  const r = jalCal(jy);
  const jdn = g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
  const [y, m, d] = d2g(jdn);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
export function toIsoDate(v: string, fmt: "gregorian" | "jalali" | undefined): string | null {
  const m = latin(v).trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  if (fmt === "jalali" || (fmt === undefined && y < 1700)) return jalaliToIso(y, mo, d);
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const NUMERIC = new Set(["score", "max", "gpa", "course_units"]);
const DATES = new Set(["term_starts_on", "term_ends_on"]);

export function mapRow(res: Res, rc: ResCfg, row: Row, opt: Options): { item: Row; status?: string } | { error: string } {
  const v: Record<string, string> = {};
  for (const f of FIELDS[res]) {
    const src = rc.map?.[f];
    let raw = src ? pick(row, src) ?? (row as Record<string, unknown>)[src] : undefined;
    if (raw === undefined && src && typeof row === "object") {
      const k = Object.keys(row).find((x) => x.toLowerCase() === src.toLowerCase());
      if (k) raw = row[k];
    }
    let s = raw === null || raw === undefined ? "" : typeof raw === "object" ? "" : String(raw).trim();
    if (!s && rc.defaults?.[f]) s = String(rc.defaults[f]).trim();
    const vm = rc.values?.[f];
    if (s && vm && Object.prototype.hasOwnProperty.call(vm, s)) s = String(vm[s]);
    if (NUMERIC.has(f) && s) s = latin(s).replace(/,/g, ".").replace(/\s/g, "");
    if (DATES.has(f) && s) {
      const iso = toIsoDate(s, opt.date_format);
      if (!iso) return { error: `bad_date_${f}` };
      s = iso;
    }
    if (["username", "student_no", "student", "external_id", "class", "teacher", "entry_year"].includes(f)) s = latin(s);
    v[f] = s.slice(0, 200);
  }
  const need = (...fs: string[]) => fs.find((f) => !v[f]);
  switch (res) {
    case "students": {
      if (!v.username && !v.student_no) return { error: "missing_username" };
      const item: Row = { username: v.username || v.student_no, student_no: v.student_no, external_id: v.external_id,
        full_name: v.full_name, field: v.field, entry_year: v.entry_year };
      const st = v.status ? STATUS_WORDS[v.status.toLowerCase()] ?? STATUS_WORDS[v.status] ?? "" : "";
      if (v.status && !st) return { error: "bad_status" };
      return { item, status: st || undefined };
    }
    case "staff": {
      const miss = need("username");
      return miss ? { error: `missing_${miss}` } : { item: { username: v.username, full_name: v.full_name } };
    }
    case "classes": {
      if (!v.external_id) return { error: "missing_external_id" };
      if (!v.term_code && !v.term_title) return { error: "missing_term" };
      if (!v.course_code && !v.course_title) return { error: "missing_course" };
      const term: Row = { code: v.term_code, title: v.term_title || v.term_code };
      if (v.term_starts_on) term.starts_on = v.term_starts_on;
      if (v.term_ends_on) term.ends_on = v.term_ends_on;
      if (v.term_status) term.status = v.term_status;
      const course: Row = { code: v.course_code, title: v.course_title || v.course_code };
      if (v.course_units) course.units = Number(v.course_units);
      const item: Row = { external_id: v.external_id, title: v.title, term, course };
      if (v.teacher) item.teacher = v.teacher;
      if (v.status) item.status = v.status;
      return { item };
    }
    case "enrollments": {
      const miss = need("class", "student");
      return miss ? { error: `missing_${miss}` } : { item: { class: v.class, student: v.student, status: v.status || "enrolled" } };
    }
    case "grades": {
      const miss = need("class", "student", "score");
      if (miss) return { error: `missing_${miss}` };
      return { item: { class: v.class, student: v.student, component: v.component || "final", score: v.score, max: v.max || "20" } };
    }
    case "prior_gpa": {
      const miss = need("student", "gpa");
      return miss ? { error: `missing_${miss}` } : { item: { student: v.student, gpa: v.gpa, as_of: v.as_of } };
    }
  }
}

// --- calling org-api with the integration's key ---
async function signedPost(cfg: Integration, route: string, body: unknown, idem: string): Promise<{ status: number; body: Row }> {
  if (!cfg.key_id || !cfg.key_salt) throw new SourceError("key_missing");
  const secret = b64url(await hmac(PEPPER, `lexa-api-key:v1:${cfg.key_id.toLowerCase()}:${cfg.key_salt}`));
  const raw = JSON.stringify(body);
  for (let attempt = 0; attempt < 3; attempt++) {
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = hex(await hmac(secret, `${ts}\nPOST\n${route}\n${await sha256Hex(raw)}`));
    const res = await fetch(`${SB_URL}/functions/v1/org-api${route}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json", "X-Lexa-Key": `lxk_live_${cfg.key_id}`, "X-Lexa-Timestamp": ts,
        "X-Lexa-Signature": `v1=${sig}`, "Idempotency-Key": idem,
      },
      body: raw,
    });
    const out = (await res.json().catch(() => ({}))) as Row;
    if ((res.status === 429 || res.status === 409) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
      continue;
    }
    return { status: res.status, body: out };
  }
  return { status: 429, body: { error: "rate_limited" } };
}

// --- one run ---
type Counts = Record<string, { fetched: number; mapped: number; results: Record<string, number>; error?: string }>;
type RunOut = { status: "ok" | "partial" | "failed"; counts: Counts; errors: { r: string; row: number; e: string }[]; message: string };

async function execute(cfg: Integration, runId: string, dry: boolean): Promise<RunOut> {
  const counts: Counts = {};
  const errors: RunOut["errors"] = [];
  const addErr = (r: string, row: number, e: string) => { if (errors.length < MAX_ERRORS) errors.push({ r, row, e }); };
  let failed = 0;
  let enabled = 0;
  let rowProblems = 0;
  const statusWanted: { ref: string; status: string }[] = [];

  for (const res of ORDER) {
    const rc = cfg.resources[res];
    if (!rc || rc.enabled === false || !rc.map || !Object.values(rc.map).some(Boolean)) continue;
    enabled++;
    const c: Counts[string] = (counts[res] = { fetched: 0, mapped: 0, results: {} });
    const bump = (k: string, n = 1) => { c.results[k] = (c.results[k] ?? 0) + n; };
    try {
      const rows = await readResource(cfg, rc);
      c.fetched = rows.length;
      let items: { item: Row; row: number; status?: string }[] = [];
      rows.forEach((r, i) => {
        const m = mapRow(res, rc, r, cfg.options);
        if ("error" in m) { bump("invalid"); rowProblems++; addErr(res, i + 1, m.error); }
        else items.push({ item: m.item, row: i + 1, status: m.status });
      });
      c.mapped = items.length;

      if (res === "students") {
        const roster = await rest<{ org_username: string; student_no: string; external_id: string; status: string }[]>(
          `lexa_org_students?org_id=eq.${cfg.org_id}&select=org_username,student_no,external_id,status&limit=50000`,
        );
        const byKey = new Map<string, string>();
        for (const s of roster) {
          if (s.external_id) byKey.set(`e:${s.external_id}`, s.status);
          byKey.set(`u:${s.org_username.toLowerCase()}`, s.status);
          if (s.student_no) byKey.set(`n:${s.student_no}`, s.status);
        }
        const known = (it: Row) => {
          const e = String(it.external_id ?? ""), u = String(it.username ?? "").toLowerCase(), n = String(it.student_no ?? "");
          return (e && byKey.get(`e:${e}`)) || byKey.get(`u:${u}`) || (n && byKey.get(`n:${n}`)) || null;
        };
        if (cfg.options.create_students === false) {
          const before = items.length;
          items = items.filter((x) => known(x.item) !== null);
          if (before > items.length) bump("not_in_lexa_skipped", before - items.length);
        }
        if (cfg.options.status_sync) {
          for (const x of items) {
            const cur = known(x.item);
            if (x.status && cur && cur !== x.status) {
              statusWanted.push({ ref: String(x.item.external_id || x.item.username || x.item.student_no), status: x.status });
            }
          }
        }
      }

      if (dry && (res === "students" || res === "staff")) {
        bump("checked", items.length);
        continue;
      }
      const size = BATCH[res];
      for (let b = 0; b * size < items.length; b++) {
        const part = items.slice(b * size, (b + 1) * size);
        let results: { row?: number; result?: string; error?: string }[] = [];
        if (res === "students" || res === "staff") {
          const r = await signedPost(cfg, `/v1/${res}`, { items: part.map((x) => x.item) }, `conn-${runId}-${res}-${b}`);
          if (r.status !== 200) throw new SourceError(String(r.body.error ?? `api_${r.status}`).slice(0, 60));
          results = (r.body.results as typeof results) ?? [];
        } else {
          results = await rpc<typeof results>("lexa_connector_bulk", {
            o: cfg.org_id, which: res, items: part.map((x) => x.item), dry,
          });
        }
        results.forEach((r, j) => {
          const k = String(r.result ?? "error");
          bump(k);
          const src = part[(Number(r.row) || j + 1) - 1] ?? part[j];
          if (!OK_RESULTS.has(k)) { rowProblems++; addErr(res, src?.row ?? 0, String(r.error ?? k).slice(0, 60)); }
        });
      }
    } catch (e) {
      failed++;
      c.error = e instanceof SourceError || e instanceof Fail ? (e instanceof Fail ? e.code : e.message) : "error";
      if (!(e instanceof SourceError || e instanceof Fail)) console.error("connector", res, e instanceof Error ? e.message : "error");
      if (c.error === "no_secret" || c.error === "key_missing") break;
    }
  }

  if (statusWanted.length) {
    const sc = (counts.status = { fetched: statusWanted.length, mapped: statusWanted.length, results: {} as Record<string, number> });
    const todo = statusWanted.slice(0, MAX_STATUS_CHANGES);
    if (statusWanted.length > todo.length) sc.results.left_for_next_run = statusWanted.length - todo.length;
    if (dry) sc.results.checked = todo.length;
    else {
      for (let i = 0; i < todo.length; i++) {
        const body: Row = { status: todo[i].status };
        if (todo[i].status === "graduated" || todo[i].status === "withdrawn") body.access_after_exit = cfg.options.exit_access === "limited" ? "limited" : "open";
        const r = await signedPost(cfg, `/v1/students/${encodeURIComponent(todo[i].ref)}/status`, body, `conn-${runId}-st-${i}`);
        const k = r.status === 200 ? "updated" : String(r.body.error ?? `api_${r.status}`).slice(0, 60);
        sc.results[k] = (sc.results[k] ?? 0) + 1;
        if (r.status !== 200) { rowProblems++; addErr("status", i + 1, k); }
      }
    }
  }

  const status = enabled === 0 || failed === enabled ? "failed" : failed || rowProblems ? "partial" : "ok";
  return { status, counts, errors, message: enabled === 0 ? "nothing_to_read" : "" };
}

async function runOne(id: string, via: "manual" | "schedule", dry: boolean, by: string | null): Promise<Row> {
  const runId = await rpc<string | null>("lexa_connector_run_begin", { i: id, trig: via, p_dry: dry, by_user: by });
  if (!runId) return { busy: true };
  let out: RunOut;
  try {
    const cfg = await rpc<Integration>("lexa_connector_get", { i: id });
    if (!cfg.org_active) out = { status: "failed", counts: {}, errors: [], message: "org_not_active" };
    else if (!cfg.enabled && via === "schedule") out = { status: "failed", counts: {}, errors: [], message: "disabled" };
    else if (cfg.auth_kind !== "none" && !cfg.secret) out = { status: "failed", counts: {}, errors: [], message: "no_secret" };
    else if (!cfg.key_id) out = { status: "failed", counts: {}, errors: [], message: "key_missing" };
    else {
      cfg.resources = cfg.resources ?? {};
      cfg.options = cfg.options ?? {};
      out = await execute(cfg, runId, dry);
    }
  } catch (e) {
    console.error("connector run", e instanceof Error ? e.message : "error");
    out = { status: "failed", counts: {}, errors: [], message: e instanceof Fail ? e.code : "server_error" };
  }
  await rpc("lexa_connector_run_end", { run: runId, st: out.status, p_counts: out.counts, p_errors: out.errors, msg: out.message });
  return { run_id: runId, ...out };
}

// --- routes ---
async function managerIntegration(req: Request): Promise<{ user: { token: string; id: string }; body: Row; id: string }> {
  const user = await userFrom(req);
  const body = (await req.json().catch(() => ({}))) as Row;
  const orgId = String(body.org_id ?? "");
  const id = String(body.integration_id ?? "");
  if (!UUID_RE.test(orgId) || !UUID_RE.test(id)) throw new Fail(400, "bad_input");
  const list = await asUserRpc<{ id: string }[]>(user.token, "lexa_org_integrations", { o: orgId });
  if (!(list ?? []).some((x) => x.id === id)) throw new Fail(404, "not_found");
  return { user, body, id };
}

async function test(req: Request): Promise<Response> {
  const { id } = await managerIntegration(req);
  const cfg = await rpc<Integration>("lexa_connector_get", { i: id });
  cfg.resources = cfg.resources ?? {};
  cfg.options = cfg.options ?? {};
  const out: Record<string, { rows?: number; fields?: string[]; error?: string }> = {};
  for (const res of ORDER) {
    const rc = cfg.resources[res];
    if (!rc || rc.enabled === false) continue;
    try {
      const rows = await readResource(cfg, rc, true);
      const fields = new Set<string>();
      const walk = (o: Row, prefix: string, depth: number) => {
        for (const [k, v] of Object.entries(o)) {
          if (fields.size >= 60) return;
          if (v && typeof v === "object" && !Array.isArray(v) && depth < 2) walk(v as Row, `${prefix}${k}.`, depth + 1);
          else fields.add(`${prefix}${k}`);
        }
      };
      for (const r of rows.slice(0, 20)) walk(r, "", 0);
      out[res] = { rows: rows.length, fields: [...fields] };
    } catch (e) {
      out[res] = { error: e instanceof SourceError ? e.message : "error" };
      if (e instanceof SourceError && e.message === "no_secret") break;
    }
  }
  return json(200, { ok: true, resources: out });
}

async function run(req: Request): Promise<Response> {
  const { user, body, id } = await managerIntegration(req);
  const r = await runOne(id, "manual", body.dry === true, user.id);
  if (r.busy) return json(409, { error: "run_in_progress" });
  return json(200, r);
}

async function tick(req: Request): Promise<Response> {
  const given = req.headers.get("x-lexa-cron") ?? "";
  if (CRON_SECRET.length < 24 || !sameText(given, CRON_SECRET)) return json(401, { error: "unauthorized" });
  const ids = (await rpc<string[]>("lexa_connector_due", { lim: 3 })) ?? [];
  const done: Row[] = [];
  for (const id of ids) {
    const r = await runOne(id, "schedule", false, null);
    done.push({ id, status: r.status ?? (r.busy ? "busy" : "failed") });
  }
  return json(200, { ran: done.length, runs: done });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!SB_URL || !SERVICE_KEY || !PUBLIC_KEY || PEPPER.length < 32) return json(500, { error: "not_configured" });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  const url = new URL(req.url);
  const at = url.pathname.indexOf("/org-connector");
  const route = (at >= 0 ? url.pathname.slice(at + "/org-connector".length) : url.pathname) || "/";
  try {
    if (route === "/test") return await test(req);
    if (route === "/run") return await run(req);
    if (route === "/tick") return await tick(req);
    return json(404, { error: "not_found" });
  } catch (e) {
    if (e instanceof Fail) return json(e.status, { error: e.code });
    if (e instanceof SourceError) return json(400, { error: e.message });
    console.error("org-connector", e instanceof Error ? e.message : "error");
    return json(500, { error: "server_error" });
  }
});
