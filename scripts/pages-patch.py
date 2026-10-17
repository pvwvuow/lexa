#!/usr/bin/env python3
"""Adjust the exported app for the GitHub Pages layout (app shell at /app/).

The service worker caches "/" as the app shell. On Pages "/" is the landing page,
so the shell entries move to "/app/", and only /app/ navigations refresh the shell.
The PWA manifest starts at /app/. Every replacement must match exactly once, so a
changed sw.js fails the build loudly instead of shipping a broken offline cache.
"""
import json
import pathlib
import sys

site = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")

sw = site / "sw.js"
s = sw.read_text(encoding="utf-8")
edits = [
    ('const CORE_URLS = [\n  "/",\n', 'const CORE_URLS = [\n  "/app/",\n'),
    ('const res = await fetch("/", { cache: "no-cache" });', 'const res = await fetch("/app/", { cache: "no-cache" });'),
    ('await cache.put("/", res.clone());', 'await cache.put("/app/", res.clone());'),
    (
        'caches.open(SHELL_CACHE).then((c) => c.put("/", res.clone())).catch(() => {});',
        'if (new URL(req.url).pathname.startsWith("/app")) caches.open(SHELL_CACHE).then((c) => c.put("/app/", res.clone())).catch(() => {});',
    ),
    ('(await shell.match("/")) ||', '(await shell.match("/app/")) ||'),
]
for old, new in edits:
    n = s.count(old)
    if n != 1:
        sys.exit(f"sw.js: expected 1 match, found {n}: {old[:60]}")
    s = s.replace(old, new)
sw.write_text(s, encoding="utf-8")
print("sw.js patched for /app/")

man = site / "manifest.webmanifest"
if man.exists():
    m = json.loads(man.read_text(encoding="utf-8"))
    m["start_url"] = "/app/"
    m["scope"] = "/"
    man.write_text(json.dumps(m, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("manifest start_url -> /app/")
