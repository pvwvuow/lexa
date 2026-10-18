#!/usr/bin/env python3
"""Execute a SQL file on the Supabase project via Management API (equivalent to SQL Editor).
Usage: python3 scripts/run-sql-file.py <path-to-sql> [--check-only]
PAT is read from gitignored .supabase-pat
"""
import json, sys, os, urllib.request, urllib.error

REF = "tldjbpfcibangzmvzwfw"
PAT = open("/home/z/my-project/.supabase-pat").read().strip()

def mgmt(method: str, path: str, body: dict | None = None):
    url = f"https://api.supabase.com/v1/projects/{REF}/{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {PAT}",
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw.strip() else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw

def run_sql(sql: str):
    return mgmt("POST", "database/query", {"query": sql})

def main():
    path = sys.argv[1]
    check_only = "--check-only" in sys.argv
    sql = open(path).read()
    print(f"SQL file: {path} ({len(sql)} bytes, {sql.count(chr(10))+1} lines)")
    if check_only:
        print("(check-only: not executing)")
        return 0
    status, resp = run_sql(sql)
    print(f"HTTP {status}")
    if status == 200:
        rows = resp if isinstance(resp, list) else []
        print(f"OK — {len(rows)} result rows")
        for r in rows[:10]:
            print("  ", json.dumps(r, ensure_ascii=False)[:200])
        return 0
    print("ERROR:", json.dumps(resp, ensure_ascii=False)[:3000] if not isinstance(resp, str) else resp[:3000])
    return 1

if __name__ == "__main__":
    sys.exit(main())
