#!/usr/bin/env python3
"""Deploy org-api + org-connector edge functions via Management API.
PAT in gitignored /home/z/my-project/.supabase-pat — never commit it."""
import json, os, urllib.request, urllib.error

REF = "tldjbpfcibangzmvzwfw"
PAT = os.environ.get("SUPABASE_PAT") or open("/home/z/my-project/.supabase-pat").read().strip()
API = f"https://api.supabase.com/v1/projects/{REF}/functions"


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


st, body = req("GET", API)
funcs = json.loads(body) if st == 200 else []
print(f"[list] HTTP {st} — existing: {[f.get('slug') for f in funcs]}")

for slug, verify in [("org-api", False), ("org-connector", True)]:
    code = open(f"/home/z/my-project/supabase/functions/{slug}/index.ts").read()
    exists = any(f.get("slug") == slug for f in funcs)
    if exists:
        st, body = req("PATCH", f"{API}/{slug}", {"verify_jwt": verify, "body": code, "name": slug})
        print(f"[patch {slug}] HTTP {st} — {body[:200]}")
    else:
        payload = {"slug": slug, "name": slug, "verify_jwt": verify, "body": code}
        st, body = req("POST", API, payload)
        print(f"[create {slug}] HTTP {st} — {body[:200]}")
    # verify active
    st2, b2 = req("GET", f"{API}/{slug}")
    if st2 == 200:
        d = json.loads(b2)
        print(f"[state {slug}] status={d.get('status')} verify_jwt={d.get('verify_jwt')}")
