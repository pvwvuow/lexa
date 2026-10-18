#!/usr/bin/env python3
"""qa-colleague-p4-p7.py — probe the live DB with the COLLEAGUE's object names (PR 25)
to determine which of their SQL files (009/010/011/012) the user has applied."""
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
    results.append((name, status, "OK" if good else "MISSING", txt[:110].replace("\n", " ")))
    if not good:
        ok = False


# 009 study
check("table lexa_study_beats", *req("/rest/v1/lexa_study_beats?select=*&limit=1"))
check("rpc lexa_study_track", *req("/rest/v1/rpc/lexa_study_track", "POST", {"beats": []}))
check("rpc lexa_my_study", *req("/rest/v1/rpc/lexa_my_study", "POST", {}))
check("rpc lexa_my_learning", *req("/rest/v1/rpc/lexa_my_learning", "POST", {}))
check("rpc lexa_org_dashboard", *req("/rest/v1/rpc/lexa_org_dashboard", "POST", {"o": ZERO}))
check("rpc lexa_org_study_report", *req("/rest/v1/rpc/lexa_org_study_report", "POST",
                                        {"o": ZERO, "d_from": "2026-01-01", "d_to": "2026-01-02"}))
check("rpc lexa_class_study_report", *req("/rest/v1/rpc/lexa_class_study_report", "POST",
                                          {"k": ZERO, "d_from": "2026-01-01", "d_to": "2026-01-02"}))
check("rpc lexa_teacher_overview", *req("/rest/v1/rpc/lexa_teacher_overview", "POST", {"o": ZERO}))
check("rpc lexa_admin_study_overview", *req("/rest/v1/rpc/lexa_admin_study_overview", "POST",
                                            {"d_from": "2026-01-01", "d_to": "2026-01-02"}))

# 010 org api
for t in ("lexa_org_api_keys", "lexa_org_api_idem", "lexa_org_api_usage", "lexa_org_api_log"):
    check("table " + t, *req(f"/rest/v1/{t}?select=*&limit=1"))
check("rpc lexa_org_api_keys", *req("/rest/v1/rpc/lexa_org_api_keys", "POST", {"o": ZERO}))
check("rpc lexa_org_api_key_new", *req("/rest/v1/rpc/lexa_org_api_key_new", "POST",
                                       {"o": ZERO, "k_name": "probe", "k_scopes": ["read"],
                                        "k_ips": None}))
check("rpc lexa_api_scopes", *req("/rest/v1/rpc/lexa_api_scopes", "POST", {}))

# 011 compare
check("rpc lexa_compare_report", *req("/rest/v1/rpc/lexa_compare_report", "POST",
                                      {"o": ZERO, "term": ZERO}))
check("rpc lexa_compare_terms", *req("/rest/v1/rpc/lexa_compare_terms", "POST", {"o": ZERO}))
check("rpc lexa_admin_compare_report", *req("/rest/v1/rpc/lexa_admin_compare_report", "POST",
                                            {"d_from": "2026-01-01", "d_to": "2026-01-02"}))

# 012 connector
for t in ("lexa_org_integrations", "lexa_org_integration_runs"):
    check("table " + t, *req(f"/rest/v1/{t}?select=*&limit=1"))
check("rpc lexa_org_integrations", *req("/rest/v1/rpc/lexa_org_integrations", "POST", {"o": ZERO}))
check("rpc lexa_org_integration_save", *req("/rest/v1/rpc/lexa_org_integration_save", "POST",
                                            {"o": ZERO, "i": ZERO, "cfg": {}}))

for name, status, verdict, txt in results:
    print(f"[{verdict}] {name} -> {status} {txt}")
print(f"\n{sum(1 for r in results if r[2] == 'OK')}/{len(results)} OK")
sys.exit(0 if ok else 1)
