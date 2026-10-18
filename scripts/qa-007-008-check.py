#!/usr/bin/env python3
"""qa-007-008-check.py — live probe: is phase 2+3 Supabase side (007+008) applied?
Checks columns (007), tables+RPCs (008), and the lexa-org-media bucket, all with the
service key from gitignored .supabase-secret. Exit 0 = all green, 1 = missing items.
"""
import json
import sys
import urllib.request

BASE = "https://tldjbpfcibangzmvzwfw.supabase.co"
KEY = open("/home/z/my-project/.supabase-secret").read().strip()


def req(path, method="GET", body=None):
    r = urllib.request.Request(BASE + path, method=method)
    r.add_header("apikey", KEY)
    r.add_header("Authorization", "Bearer " + KEY)
    if body is not None:
        r.add_header("Content-Type", "application/json")
        r.add_header("Prefer", "return=representation")
        r.data = json.dumps(body).encode()
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


ok = True
results = []

def check(label, cond, detail=""):
    global ok
    if not cond:
        ok = False
    results.append((label, cond, detail))

# --- 007: columns ---
for col_q, name in [
    ("/rest/v1/lexa_posts?select=visibility&limit=1", "lexa_posts.visibility"),
    ("/rest/v1/lexa_tcourses?select=visibility,allow_preview&limit=1", "lexa_tcourses.visibility+allow_preview"),
]:
    st, body = req(col_q)
    check(name, st == 200, f"HTTP {st} {body[:120]}")

# --- 008: tables ---
TABLES = ["lexa_org_terms", "lexa_org_courses", "lexa_org_classes", "lexa_org_enrollments",
          "lexa_org_class_content", "lexa_org_exams", "lexa_org_exam_questions",
          "lexa_org_exam_attempts", "lexa_org_exam_answers", "lexa_org_grades", "lexa_org_prior_gpa"]
for t in TABLES:
    st, body = req(f"/rest/v1/{t}?select=*&limit=1")
    check(f"table {t}", st == 200, f"HTTP {st} {body[:100]}")

# --- RPC presence via OpenAPI root ---
st, spec = req("/rest/v1/")
paths = {}
if st == 200:
    try:
        paths = json.loads(spec).get("paths", {})
    except Exception:
        pass
check("OpenAPI root", st == 200 and bool(paths), f"HTTP {st}")

def rpc_present(fn):
    return f"/rpc/{fn}" in paths or f"/rpc/{fn}/" in paths

RPCS = {
    "007": ["lexa_can_see", "lexa_course_students", "lexa_org_active_member",
            "lexa_org_course_previews", "lexa_try_uuid", "lexa_visibility_guard"],
    "008": ["lexa_can_see_item", "lexa_class_content", "lexa_class_content_set",
            "lexa_class_exams", "lexa_class_learner", "lexa_class_require_staff",
            "lexa_class_students", "lexa_class_teacher", "lexa_exam_answer",
            "lexa_exam_delete", "lexa_exam_finalize_due", "lexa_exam_grade",
            "lexa_exam_release", "lexa_exam_report", "lexa_exam_result",
            "lexa_exam_results_open", "lexa_exam_save", "lexa_exam_start",
            "lexa_exam_submit", "lexa_grades_delete", "lexa_grades_upsert",
            "lexa_my_classes", "lexa_my_exams", "lexa_my_grades",
            "lexa_org_class_delete", "lexa_org_class_list", "lexa_org_class_save",
            "lexa_org_course_save", "lexa_org_enroll", "lexa_org_find_student",
            "lexa_org_term_save", "lexa_prior_gpa_upsert"],
}
for ver, fns in RPCS.items():
    for fn in fns:
        check(f"rpc[{ver}] {fn}", rpc_present(fn))

# --- 007: lexa-org-media bucket ---
st, body = req("/storage/v1/bucket/lexa-org-media")
try:
    b = json.loads(body)
    priv = b.get("public") is False
except Exception:
    priv = False
check("bucket lexa-org-media (private)", st == 200 and priv, f"HTTP {st} {body[:120]}")

# --- report ---
for label, cond, detail in results:
    print(("OK " if cond else "FAIL ") + label + ("" if cond else "  <- " + detail))
n_ok = sum(1 for _, c, _ in results if c)
print(f"\n{n_ok}/{len(results)} checks passed")
sys.exit(0 if ok else 1)
