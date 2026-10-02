#!/usr/bin/env python3
"""اسکن چانک‌های export برای سینتکس/APIهای مدرن — تعیین حداقل نسخه WebView"""
import re, os, glob

out = "/home/z/my-project/out/_next/static/chunks"
files = glob.glob(out + "/*.js")
print("chunk files:", len(files))

syntax_patterns = {
    "optional-chaining ?.": re.compile(r"\?\.[\[\(a-zA-Z_0-9]"),
    "nullish ??": re.compile(r"\?\?(?!=)"),
    "class-private #f": re.compile(r"class[^\{]*\{\s*#[a-zA-Z]"),
    "static-class-block": re.compile(r"class[^\{]*\{\s*static\s*\{"),
    "top-level-await-ish": re.compile(r"\bawait\s+import\("),
}

api_patterns = {
    "randomUUID": r"\.randomUUID\b",
    "structuredClone": r"\bstructuredClone\b",
    "Object.hasOwn": r"\bObject\.hasOwn\b",
    "Array.prototype.at": r"\.at\(-?\d",
    "findLast": r"\.findLast\(",
    "replaceAll": r"\.replaceAll\(",
    "matchAll": r"\.matchAll\(",
    "globalThis": r"\bglobalThis\b",
    "Intl.supportedValuesOf": r"Intl\.supportedValuesOf",
    "ResizeObserver": r"\bResizeObserver\b",
    "visualViewport": r"\bvisualViewport\b",
    "requestIdleCallback": r"\brequestIdleCallback\b",
    "crypto.subtle": r"crypto\.subtle",
    "AbortSignal.timeout": r"AbortSignal\.timeout",
    "Array.flat": r"\.flat\(",
    "Promise.allSettled": r"\.allSettled\(",
    "navigator.storage": r"navigator\.storage",
}

hits = {k: set() for k in list(syntax_patterns) + list(api_patterns)}
for f in files:
    src = open(f, encoding="utf8", errors="ignore").read()
    for name, pat in syntax_patterns.items():
        if pat.search(src):
            hits[name].add(os.path.basename(f))
    for name, pat in api_patterns.items():
        if re.search(pat, src):
            hits[name].add(os.path.basename(f))

for name in list(syntax_patterns) + list(api_patterns):
    n = len(hits[name])
    if n:
        print(f"{'[SYNTAX]' if name in syntax_patterns else '[API]   '} {name}: {n} files, e.g. {sorted(hits[name])[:2]}")
    else:
        print(f"{'[SYNTAX]' if name in syntax_patterns else '[API]   '} {name}: —")
