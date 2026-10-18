#!/usr/bin/env python3
"""Compare live Supabase schema (via OpenAPI with service key) against 006_org_accounts.sql from PR #19."""
import json, re, os, urllib.request

REF = "tldjbpfcibangzmvzwfw"
# secret key lives in gitignored .supabase-secret (never commit it)
SEC = os.environ.get("SUPABASE_SECRET_KEY") or open("/home/z/my-project/.supabase-secret").read().strip()
SQL_PATH = "/home/z/my-project/lexa-pr19/006_org_accounts.sql"

def http_json(url, key):
    req = urllib.request.Request(url, headers={"apikey": key, "Authorization": "Bearer " + key})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())

# 1. parse SQL: table -> set(columns)  (strip constraints starting with known keywords)
sql = open(SQL_PATH).read()
blocks = re.findall(r"create table if not exists public\.(\w+)\s*\((.*?)\n\);", sql, re.S)
sql_cols = {}
for tname, body in blocks:
    cols = set()
    for line in body.splitlines():
        line = line.strip().rstrip(",")
        if not line: continue
        first = line.split()[0] if line.split() else ""
        if first.startswith(("primary", "unique", "foreign", "check", "constraint", "exclude")):
            continue
        cols.add(first)
    sql_cols[tname] = cols

# 2. live schema
defs = http_json(f"https://{REF}.supabase.co/rest/v1/", SEC)["definitions"]

print(f"{'table':32} {'in SQL':7} {'in DB':7} {'col match'}")
all_ok = True
for tname, want in sorted(sql_cols.items()):
    live = set(defs.get(tname, {}).get("properties", {}).keys())
    ok = want == live
    all_ok &= ok
    diff = ""
    if not ok:
        diff = f"  missing={sorted(want-live)} extra={sorted(live-want)}"
    print(f"{tname:32} {len(want):>7} {len(live):>7} {'OK' if ok else 'MISMATCH'}{diff}")

# tables in 006 but expected via 'in DB' — also confirm no 006 table absent from DB
missing_tables = [t for t in sql_cols if t not in defs]
print("\n006 tables absent from DB:", missing_tables or "none")

# 3. RLS spot-check: publishable (anon-level) must NOT read org tables
PUB = "sb_publishable_IaPGLBkmRkcsGlVE865PZw_krAWWmsz"
for t in ("lexa_org_students", "lexa_org_logins", "lexa_org_activation_codes", "lexa_audit_log"):
    try:
        req = urllib.request.Request(f"https://{REF}.supabase.co/rest/v1/{t}?select=*", headers={"apikey": PUB})
        with urllib.request.urlopen(req, timeout=15) as r:
            rows = json.loads(r.read())
        print(f"RLS {t}: anon read -> HTTP 200, rows={len(rows)}", "OK(empty)" if not rows else "!! DATA LEAK")
    except urllib.error.HTTPError as e:
        print(f"RLS {t}: anon read -> HTTP {e.code}", "OK(blocked)" if e.code in (401,403,404) else "!!")

print("\nRESULT:", "ALL COLUMN CHECKS PASS" if all_ok and not missing_tables else "REVIEW NEEDED")
