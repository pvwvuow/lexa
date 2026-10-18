#!/usr/bin/env python3
"""qa-009-011-check.py — live probe: is phases 4-7 Supabase side (009+010+011) applied?

Uses the PUBLISHABLE key (the service key file was lost in the env rebuild).
Logic: a missing table/RPC returns PostgREST PGRST205/PGRST202 ("could not find"),
an applied+RLS-locked table returns 200 [] and an applied+internally-guarded RPC
returns an app-level error (400 raised inside the function, NOT PGRST202).
Exit 0 = all green, 1 = missing items.
"""
import json
import sys
import urllib.request

BASE = "https://tldjbpfcibangzmvzwfw.supabase.co"
KEY = "sb_publishable_IaPGLBkmRkcsGlVE865PZw_krAWWmsz"
ZERO = "00000000-0000-0000-0000-000000000000"


def req(path, method="GET", body=None):
    r = urllib.request.Request(BASE + path, method=method)
    r.add_header("apikey", KEY)
    r.add_header("Authorization", "Bearer " + KEY)
    if body is not None:
        r.add_header("Content-Type", "application/json")
        r.data = json.dumps(body).encode()
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def missing(txt):
    t = txt.lower()
    return ("pgrst202" in t or "pgrst205" in t or "42p01" in t
            or "could not find" in t or "does not exist" in t)


ok = True
results = []


def check(name, status, txt):
    global ok
    good = (status == 200) or (status in (400, 401, 403) and not missing(txt))
    results.append((name, status, "OK" if good else "FAIL", txt[:130].replace("\n", " ")))
    if not good:
        ok = False


# --- 009: study time ---
check("table lexa_study_sessions", *req("/rest/v1/lexa_study_sessions?select=*&limit=1"))
check("rpc lexa_study_beat", *req("/rest/v1/rpc/lexa_study_beat", "POST",
                                  {"p_session": "gate-probe-0001", "p_seconds": 1}))
check("rpc lexa_study_my", *req("/rest/v1/rpc/lexa_study_my", "POST", {}))
check("rpc lexa_study_org", *req("/rest/v1/rpc/lexa_study_org", "POST", {"o": ZERO}))
check("rpc lexa_study_class", *req("/rest/v1/rpc/lexa_study_class", "POST", {"k": ZERO}))
check("rpc lexa_study_admin_stats", *req("/rest/v1/rpc/lexa_study_admin_stats", "POST", {}))

# --- 010: centre API ---
for t in ("lexa_org_api_keys", "lexa_api_idempotency", "lexa_org_integrations",
          "lexa_integration_runs"):
    check("table " + t, *req(f"/rest/v1/{t}?select=*&limit=1"))
check("rpc lexa_api_key_list", *req("/rest/v1/rpc/lexa_api_key_list", "POST", {"o": ZERO}))
check("rpc lexa_api_key_create", *req("/rest/v1/rpc/lexa_api_key_create", "POST",
                                      {"o": ZERO, "p_name": "gate", "p_scopes": ["read"]}))
check("rpc lexa_integration_get", *req("/rest/v1/rpc/lexa_integration_get", "POST", {"o": ZERO}))
check("rpc lexa_api_verify", *req("/rest/v1/rpc/lexa_api_verify", "POST",
                                  {"p_prefix": "lexa", "p_ts": "2026-01-01T00:00:00Z",
                                   "p_sig": "x", "p_body_hash": "x"}))

# --- 011: comparison report ---
check("rpc lexa_compare_report", *req("/rest/v1/rpc/lexa_compare_report", "POST",
                                      {"o": ZERO, "p_class": ZERO, "p_term": ZERO}))

# --- edge functions (phases 5+7) ---
check("fn org-api", *req("/functions/v1/org-api", "POST", {}))
check("fn org-connector", *req("/functions/v1/org-connector", "POST", {}))
check("fn org-auth (regression)", *req("/functions/v1/org-auth", "POST", {}))

for name, status, verdict, txt in results:
    print(f"[{verdict}] {name} -> {status} {txt}")
print(f"\n{sum(1 for r in results if r[2] == 'OK')}/{len(results)} OK")
sys.exit(0 if ok else 1)
