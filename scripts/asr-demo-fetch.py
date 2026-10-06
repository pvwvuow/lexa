#!/usr/bin/env python3
"""Fetch a real Persian spoken-Wikipedia audio sample from Wikimedia Commons."""
import json
import os
import sys
import urllib.request

OUT_DIR = "/home/z/my-project/asr-demo"
os.makedirs(OUT_DIR, exist_ok=True)

API = "https://commons.wikimedia.org/w/api.php"
HEADERS = {"User-Agent": "LexaAsrDemo/1.0 (testing; contact: local)"}
CANDIDATES = [
    "File:Fa-sediqeh-dowlatabadi-2025.oga",
    "File:Fa-ir-montazeri.opus",
]


def api_titles(titles):
    qs = urllib.parse.urlencode(
        {
            "action": "query",
            "titles": "|".join(titles),
            "prop": "imageinfo",
            "iiprop": "url|size|mime",
            "format": "json",
        }
    )
    req = urllib.request.Request(f"{API}?{qs}", headers=HEADERS)
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def main():
    data = api_titles(CANDIDATES)
    pages = data.get("query", {}).get("pages", {})
    chosen = None
    for pid, page in pages.items():
        ii = (page.get("imageinfo") or [{}])[0]
        title = page.get("title", "?")
        size = ii.get("size", 0)
        url = ii.get("url", "")
        mime = ii.get("mime", "?")
        print(f"- {title} | {mime} | {size/1e6:.1f} MB | {url[:90]}")
        if chosen is None and url and size > 800_000:
            chosen = (title, url, size)

    if chosen is None:
        print("NO-SUITABLE-SAMPLE")
        sys.exit(1)

    title, url, size = chosen
    ext = ".oga" if url.lower().endswith(".oga") else os.path.splitext(url)[1] or ".oga"
    dest = os.path.join(OUT_DIR, f"sample_orig{ext}")
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=120) as r, open(dest, "wb") as f:
        f.write(r.read())
    got = os.path.getsize(dest)
    print(f"CHOSEN: {title}")
    print(f"SAVED: {dest} ({got/1e6:.1f} MB, server said {size/1e6:.1f} MB)")


if __name__ == "__main__":
    import urllib.parse

    main()
