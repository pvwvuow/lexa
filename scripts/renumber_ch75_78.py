#!/usr/bin/env python3
"""Renumber lessons in ch75-ch78 by +1 (266-281 -> 267-282) to fix collision with ch74's JG266."""
import re

BASE = "/home/z/my-project/src/lib/law/courses/"
files = ["jaza-g-ch75.ts", "jaza-g-ch76.ts", "jaza-g-ch77.ts", "jaza-g-ch78.ts"]

for fname in files:
    path = BASE + fname
    with open(path, encoding="utf-8") as f:
        text = f.read()
    # Descending order to avoid cascade
    for n in range(281, 265, -1):
        text = text.replace(f"lessonJG{n}", f"lessonJG{n+1}")
        text = text.replace(f"'jg-{n}'", f"'jg-{n+1}'")
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    exports = re.findall(r"export const lessonJG(\d+)", text)
    ids = re.findall(r"'jg-(\d+)'", text)
    print(fname, "exports:", exports, "ids:", sorted(set(ids), key=int))
print("done")
