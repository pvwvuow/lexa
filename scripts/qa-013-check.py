#!/usr/bin/env python3
"""qa-013-check.py — live probe: is phase A1 Supabase side (013_admin_console.sql) applied?

Same logic as qa-009-011-check.py: a missing table/RPC returns PostgREST PGRST205/PGRST202
("could not find"), an applied+RLS-locked table returns 200 [] and an applied+internally-guarded
RPC returns an app-level error (400/401 raised inside the function, NOT PGRST202).
Also probes the admin-users Edge Function: not deployed = 404 "not found".
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


# --- 013: platform console (A1) ---
check("table lexa_user_flags", *req("/rest/v1/lexa_user_flags?select=*&limit=1"))
check("rpc lexa_admin_home", *req("/rest/v1/rpc/lexa_admin_home", "POST", {}))
check("rpc lexa_admin_orgs_overview", *req("/rest/v1/rpc/lexa_admin_orgs_overview", "POST", {}))
check("rpc lexa_admin_org_lifecycle", *req("/rest/v1/rpc/lexa_admin_org_lifecycle", "POST",
                                           {"o": ZERO, "act": "activate"}))
check("rpc lexa_admin_org_update", *req("/rest/v1/rpc/lexa_admin_org_update", "POST", {"o": ZERO}))
check("rpc lexa_admin_org_purge", *req("/rest/v1/rpc/lexa_admin_org_purge", "POST",
                                       {"o": ZERO, "confirm_slug": "gate-probe"}))
check("rpc lexa_admin_users", *req("/rest/v1/rpc/lexa_admin_users", "POST", {}))
check("rpc lexa_admin_user_detail", *req("/rest/v1/rpc/lexa_admin_user_detail", "POST", {"uid": ZERO}))
check("rpc lexa_admin_change_role", *req("/rest/v1/rpc/lexa_admin_change_role", "POST",
                                         {"uid": ZERO, "new_role": "user"}))
check("rpc lexa_admin_audit", *req("/rest/v1/rpc/lexa_admin_audit", "POST", {}))
check("fn admin-users", *req("/functions/v1/admin-users", "POST", {}))
# regression: phases 4-7 (colleague SQL) still applied — real client RPC names
check("rpc lexa_my_study (009 regression)", *req("/rest/v1/rpc/lexa_my_study", "POST", {"days": 7}))
check("rpc lexa_compare_report (011 regression)", *req("/rest/v1/rpc/lexa_compare_report", "POST",
                                                       {"o": ZERO, "term": ZERO, "class_ids": None}))

for name, status, verdict, txt in results:
    print(f"[{verdict}] {name} -> {status} {txt}")
print(f"\n{sum(1 for r in results if r[2] == 'OK')}/{len(results)} OK")
sys.exit(0 if ok else 1)
