# Lexa API for centres (v1)

> خلاصهٔ فارسی: سامانهٔ آموزشی مرکز (مثلاً سامانهٔ گلستان یا نرم‌افزار آموزشگاه) با این API دانشجوها، مدرسان، کلاس‌ها، ثبت‌نام‌ها، نمره‌ها و معدل قبلی را گروهی به Lexa می‌فرستد و گزارش می‌گیرد. کلید را مدیر مرکز در پنل مرکز ← تب «API» می‌سازد. هر درخواست با «رمز کلید» امضا می‌شود و خود رمز هرگز فرستاده نمی‌شود. اول با کلید «آزمایشی» کار کنید: همه چیز بررسی می‌شود ولی چیزی ذخیره نمی‌شود.

Base URL: `https://<project>.supabase.co/functions/v1/org-api` (shown in the centre panel, API tab).
Machine-readable spec: `GET {base}/v1/openapi.json`. HTTPS only. JSON in, JSON out (UTF-8).

## Keys
- Made by an owner or manager of the centre (two-factor session) in the API tab: name, scopes, expiry, optional IP allow-list, sandbox or live.
- You get a **key id** (`lxk_live_<uuid>` or `lxk_test_<uuid>`) and a **secret**. The secret is shown once; Lexa does not store it. Keep it in your server's settings only.
- Rotate: "new key instead of this one" makes a new key and the old one stops 24 hours later. Revoke stops a key immediately.
- At most 10 active keys per centre.

| scope | allows |
|---|---|
| `students:write` | `POST /v1/students` |
| `staff:write` | `POST /v1/staff` |
| `status:write` | `POST /v1/students/{ref}/status` |
| `classes:write` | `POST /v1/classes` |
| `enrollments:write` | `POST /v1/enrollments` |
| `grades:write` | `POST /v1/grades`, `POST /v1/prior-gpa` |
| `reports:read` | `GET /v1/reports/*` |

## Signing every request
Headers:
```
X-Lexa-Key:       lxk_live_6d1f...           (key id)
X-Lexa-Timestamp: 1760780000                 (unix seconds, must be within 5 minutes of Lexa's clock)
X-Lexa-Signature: v1=<hex>                   (see below)
Idempotency-Key:  <your unique id>           (every POST, up to 100 characters)
Content-Type:     application/json
```
```
string_to_sign = timestamp + "\n" + METHOD + "\n" + path_and_query + "\n" + hex(sha256(body bytes))
signature      = hex(HMAC_SHA256(key = secret as UTF-8, message = string_to_sign))
```
- `path_and_query` starts at `/v1/`, exactly as sent (for example `/v1/reports/study?from=2025-09-23&to=2026-01-20`).
- GET has an empty body: its hash is `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
- Sign the exact bytes you send (do not re-serialise the JSON after signing).

### bash (curl + openssl)
```bash
BASE="https://<project>.supabase.co/functions/v1/org-api"
KEY="lxk_test_..."; SECRET="..."
BODY='{"items":[{"username":"s4001","student_no":"4001","full_name":"Sara Ahmadi"}]}'
P="/v1/students"; TS=$(date +%s)
BH=$(printf '%s' "$BODY" | openssl dgst -sha256 -hex | sed 's/^.* //')
SIG=$(printf '%s\n%s\n%s\n%s' "$TS" POST "$P" "$BH" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/^.* //')
curl -sS "$BASE$P" -H "X-Lexa-Key: $KEY" -H "X-Lexa-Timestamp: $TS" -H "X-Lexa-Signature: v1=$SIG" \
  -H "Idempotency-Key: students-2025-09-23-1" -H "Content-Type: application/json" --data "$BODY"
```

### Python 3
```python
import hashlib, hmac, json, time, urllib.request

BASE, KEY, SECRET = "https://<project>.supabase.co/functions/v1/org-api", "lxk_test_...", "..."

def lexa(method, path, body=None, idem=None):
    raw = b"" if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    ts = str(int(time.time()))
    msg = f"{ts}\n{method}\n{path}\n{hashlib.sha256(raw).hexdigest()}".encode()
    sig = hmac.new(SECRET.encode(), msg, hashlib.sha256).hexdigest()
    headers = {"X-Lexa-Key": KEY, "X-Lexa-Timestamp": ts, "X-Lexa-Signature": "v1=" + sig,
               "Content-Type": "application/json"}
    if idem: headers["Idempotency-Key"] = idem
    req = urllib.request.Request(BASE + path, data=raw if body is not None else None, method=method, headers=headers)
    with urllib.request.urlopen(req) as r:
        return json.load(r)

print(lexa("GET", "/v1/ping"))
```

### Node.js 18+
```js
import { createHash, createHmac } from "node:crypto";
const BASE = "https://<project>.supabase.co/functions/v1/org-api", KEY = "lxk_test_...", SECRET = "...";
export async function lexa(method, path, body, idem) {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const ts = String(Math.floor(Date.now() / 1000));
  const bh = createHash("sha256").update(raw).digest("hex");
  const sig = createHmac("sha256", SECRET).update(`${ts}\n${method}\n${path}\n${bh}`).digest("hex");
  const res = await fetch(BASE + path, {
    method, body: body === undefined ? undefined : raw,
    headers: { "X-Lexa-Key": KEY, "X-Lexa-Timestamp": ts, "X-Lexa-Signature": `v1=${sig}`,
               "Content-Type": "application/json", ...(idem ? { "Idempotency-Key": idem } : {}) },
  });
  return { status: res.status, body: await res.json() };
}
```

## Idempotency and retries
- Every POST needs an `Idempotency-Key`. The same key with the same request returns the stored answer (header `Idempotent-Replayed: true`) for 24 hours; nothing runs twice.
- The same key with a different body: `422 idempotency_key_reused`. While the first request still runs: `409 request_in_progress`.
- **Passwords and activation codes are never stored**, so a replayed answer has them as `null` with `"secret_redacted": true`. If you lost them, reset the password in the centre panel.
- Server errors (5xx) are not stored; retry with the same key.

## Limits
120 requests per key per minute (`429 rate_limited`, `Retry-After: 60`), 1 MB body. Rows per request: students and staff 300, classes 500, enrolments and grades 2000, prior GPA 5000.

## Matching
- Students: `external_id` first, then `username`; for enrolments, grades and status also student number. Matching rows are updated, others created.
- Classes: `external_id` (required). Terms by `code` (else title), subjects by `code` (else title); missing ones are created.
- Teachers: the centre username of a staff account (`POST /v1/staff`).

## Endpoints
All bulk writes take `{"items": [...]}` and answer `{"ok": true, "sandbox": false, "results": [{"row": 1, "result": "...", ...}], "summary": {"created": 1}}`. One bad row never stops the others; see `result` / `error` per row.

### POST /v1/students
```json
{"items": [{"username": "s4001", "student_no": "4001", "external_id": "st-4001", "full_name": "Sara Ahmadi",
            "field": "Law", "entry_year": "1403", "existing_account": false}]}
```
- New row: a centre account is created; the answer carries a random 12-character `password` (shown once). The student must change it at first sign-in and accept the centre's terms.
- `existing_account: true`: no account is made; the answer carries a one-time 7-day `activation_code` the student enters in their own Lexa account.
- Existing row: name, student number, field and entry year are updated (`result: "updated"`).
- Results: `created`, `code`, `updated`, `error` (`bad_username`, `duplicate_username`, `duplicate_external_id`, `username_taken`). Whole request: `409 no_student_seats`.
- Usernames: 2-40 of `A-Z a-z 0-9 . _ -`. National ID numbers are not accepted anywhere.

### POST /v1/staff
`{"items": [{"username": "t-karimi", "full_name": "Dr Karimi"}]}` makes teacher accounts (`created` with `password`, or `exists`). `409 no_teacher_seats`.

### POST /v1/students/{ref}/status
`ref` = external_id, username or student number (URL-encoded).
```json
{"status": "graduated", "access_after_exit": "open"}
{"status": "withdrawn", "access_after_exit": "until", "access_until": "2026-03-20"}
{"status": "suspended"}
```
Statuses: `active`, `suspended`, `graduated`, `withdrawn`. Access after leaving: `open` (centre content and completed classes stay open), `limited` (public content only), `until` a date. Suspending a centre-made account blocks its sign-in and ends its sessions.

### POST /v1/classes
```json
{"items": [{"external_id": "1404-1-LAW101-g1", "title": "group 1", "teacher": "t-karimi",
            "term": {"code": "1404-1", "title": "1404 autumn", "starts_on": "2025-09-23", "ends_on": "2026-01-20"},
            "course": {"code": "LAW101", "title": "Civil law 1", "units": 3}}]}
```
`term.status` = `planned` | `current` | `closed` (closing a term marks its enrolments completed). Class `status` = `active` | `archived`. Errors: `missing_external_id`, `missing_term`, `missing_course`, `teacher_not_found`, `bad_status`, `bad_value`.

### POST /v1/enrollments
`{"items": [{"class": "1404-1-LAW101-g1", "student": "st-4001", "status": "enrolled"}]}` with `enrolled` | `completed` | `dropped`. Results `created`, `updated`, `same`, `error` (`class_not_found`, `student_not_found`, `student_not_active`, `not_enrolled`).

### POST /v1/grades
`{"items": [{"class": "1404-1-LAW101-g1", "student": "4001", "component": "final", "score": 17.25, "max": 20}]}`
`component` = `midterm` | `final_exam` | `final` (the final mark is what the comparison report uses). `max` defaults to 20. Results `saved`, `same`, `skipped` (empty score), `not_found`, `not_enrolled`, `bad_component`, `bad_score`, `class_not_found`, `student_not_found`. Every change is in the centre's audit log; grades can only be deleted by the centre owner in the panel.

### POST /v1/prior-gpa
`{"items": [{"student": "st-4001", "gpa": 16.4, "as_of": "1403-2"}]}` (0-20). Used by the comparison report to control for earlier performance.

### GET /v1/reports/...
- `/v1/reports/students`: roster (username, numbers, name, field, status, access, official since, linked, terms accepted).
- `/v1/reports/classes`: classes with term, subject, teacher username, student count.
- `/v1/reports/grades?term=1404-1`: grades (term optional).
- `/v1/reports/study?from=YYYY-MM-DD&to=YYYY-MM-DD`: active study minutes per official student, only for days the person was an official, active student of this centre (max 400 days).

### GET /v1/ping
Checks key and signature: `{"ok": true, "org_id": "...", "scopes": [...], "sandbox": true}`.

## Errors
`{"error": "<code>"}` with HTTP status: `401 unauthorized` (missing or wrong key / signature), `401 timestamp_out_of_range`, `401 key_revoked`, `401 key_expired`, `401 ip_not_allowed`, `403 org_not_active`, `403 missing_scope`, `400 bad_json`, `400 bad_batch`, `400 idempotency_key_required`, `404 not_found`, `409 ...`, `413 body_too_large`, `422 idempotency_key_reused`, `429 rate_limited`, `500 server_error`.

## Privacy and logs
Lexa logs method, path, status, duration and row count per request; never bodies, secrets, passwords, codes or personal data. Every write is also in the centre's audit log with the key id as the actor.
