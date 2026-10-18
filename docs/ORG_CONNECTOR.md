# Lexa connector: what the centre's server must offer

> خلاصهٔ فارسی: با کانکتور، Lexa خودش در زمان مشخص از سرور مرکز می‌خواند (برعکس API که مرکز می‌فرستد). مرکز فقط چند نشانی HTTPS فقط‌خواندنی می‌سازد که فهرست دانشجوها، مدرسان، کلاس‌ها، ثبت‌نام‌ها، نمره‌ها و معدل قبلی را به JSON یا CSV برمی‌گردانند. مدیر مرکز در پنل، تب «کانکتور»، نشانی، رمز یا توکن فقط‌خواندنی و تطبیق فیلدها را وارد می‌کند.

## In short
- Lexa sends `GET` requests to your HTTPS server, on a schedule (hourly, daily or weekly at a Tehran hour) or when a manager presses "run now".
- You give Lexa a **read-only** account: a bearer token, a username + password (Basic), or a custom header (for example `X-Api-Key`). It is stored encrypted in Supabase Vault and is never shown again.
- Lexa keeps only the fields you map; everything else in the response is ignored and nothing raw is stored.
- Prefer the [Lexa API](ORG_API.md) when your system can push changes itself; use the connector when it can only be read.

## Requirements
- Public HTTPS address with a valid certificate. No redirects (give the final address). Private / local addresses are refused.
- Every resource path is on the same host as the base address.
- Response within 20 seconds, at most 5 MB per response, at most 20,000 rows per resource and run.
- JSON: an array of objects, or an object holding the array (`data`, `items`, `results`, `rows`, `records`, or any key you set as "list key", dotted paths like `payload.list` work). Nested fields can be mapped with dots (`term.code`).
- CSV: first row = column names; comma, semicolon or tab; UTF-8.
- Paging (JSON only, optional): `?page=1,2,…` with an optional size parameter, or `?offset=0&limit=500`. Lexa stops at an empty or short page (at most 50 pages).
- Persian or Arabic digits are fine; dates can be Jalali (`1404/07/01`) or Gregorian (`2025-09-23`).

## Resources and fields
Lexa reads them in this order, so teachers exist before classes and classes before enrolments.

| resource | Lexa field | required | notes |
|---|---|---|---|
| staff | `username`, `full_name` | username | new teacher accounts get a random password nobody sees |
| students | `username`, `student_no`, `external_id`, `full_name`, `field`, `entry_year`, `status` | username or student_no | matched by external_id, then username; status optional (see below) |
| classes | `external_id`, `title`, `teacher`, `status`, `term_code`, `term_title`, `term_starts_on`, `term_ends_on`, `term_status`, `course_code`, `course_title`, `course_units` | external_id, term, course | teacher = staff username |
| enrollments | `class`, `student`, `status` | class, student | status `enrolled` (default), `completed`, `dropped` |
| grades | `class`, `student`, `score`, `max`, `component` | class, student, score | max default 20, component default `final` |
| prior_gpa | `student`, `gpa`, `as_of` | student, gpa | 0-20; used by the comparison report |

`class` = the class external_id; `student` = external_id, username or student number.

Student status values: `active`, `suspended`, `graduated`, `withdrawn` (or فعال, معلق, فارغ‌التحصیل, انصرافی). Status is only changed when the manager turns on "update status", at most 100 changes per run.

A national ID number is never needed; do not send it.

## Example (JSON)
```
GET https://edu.example.ac.ir/lexa/students?page=1
Authorization: Bearer <read-only token>

{"data": [{"id": "st-4001", "user": "s4001", "no": "4001", "name": "Sara Ahmadi", "major": "Law", "year": "1403", "state": "active"}]}
```
Map: username = `user`, student_no = `no`, external_id = `id`, full_name = `name`, field = `major`, entry_year = `year`, status = `state`.

## What Lexa does with the data
- Students and staff are created or updated through the same checks as the API (seats, unique usernames, first sign-in with password change and terms). Passwords of new accounts are never shown or stored by the connector: the centre prints login cards from the students panel (password reset).
- Classes, enrolments, grades and prior GPA go through the same SQL as the API; grades show the source "connector" in the grade list.
- Rows are never deleted by the connector. A student missing from the response is not removed or suspended.
- Every run is logged: counts per resource and error codes with row numbers. No names, grades, passwords or response bodies are logged.

## Security checklist for the centre
- A separate read-only account only for Lexa, limited to these views. Rotate it any time in the panel; the old value is overwritten.
- Allow only Lexa's outgoing addresses if your firewall can (Supabase Edge Functions; ask Lexa support for the current list).
- Do not put the token in the URL; use a header.
