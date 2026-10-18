#!/usr/bin/env python3
"""Deploy the org-auth edge function to Supabase via Management API (equivalent of
   `supabase functions deploy org-auth --no-verify-jwt`).
   PAT lives in gitignored /home/z/my-project/.supabase-pat — never commit it."""
import json, os, sys, urllib.request, urllib.error

REF = "tldjbpfcibangzmvzwfw"
PAT = os.environ.get("SUPABASE_PAT") or open("/home/z/my-project/.supabase-pat").read().strip()
CODE_PATH = "/home/z/my-project/lexa-pr19/supabase/functions/org-auth/index.ts"
API = f"https://api.supabase.com/v1/projects/{REF}/functions"

code = open(CODE_PATH).read()

def req(method, url, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    r = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": "Bearer " + PAT,
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

# 1. list current functions
st, body = req("GET", API)
funcs = json.loads(body) if st == 200 else []
exists = any(f.get("slug") == "org-auth" for f in funcs)
print(f"[list] HTTP {st} — existing: {[f.get('slug') for f in funcs]}")

payload = {
    "slug": "org-auth",
    "name": "org-auth",
    "verify_jwt": False,
    "body": code,
}
if exists:
    st, body = req("PATCH", f"{API}/org-auth", {"verify_jwt": False, "body": code, "name": "org-auth"})
    print(f"[patch] HTTP {st} — {body[:300]}")
else:
    st, body = req("POST", API, payload)
    print(f"[create] HTTP {st} — {body[:300]}")

# 2. confirm
st, body = req("GET", API)
funcs = json.loads(body) if st == 200 else []
for f in funcs:
    print(f"[verify] slug={f.get('slug')} verify_jwt={f.get('verify_jwt')} status={f.get('status')}")

sys.exit(0 if st == 200 else 1)
