"""Repair the `[h`-deletion corruption in QuizView.tsx (and sweep all src files)."""
import pathlib, re, sys

root = pathlib.Path("/home/z/my-project/src")
fixes = [
    ("const ubActive, setHubActive]", "const [hubActive, setHubActive]"),
    ("const ubTab, setHubTab]", "const [hubTab, setHubTab]"),
    ("}, ubActive, readyFlat,", "}, [hubActive, readyFlat,"),
]
changed = []
for f in root.rglob("*.tsx"):
    t = f.read_text(encoding="utf-8")
    orig = t
    for old, new in fixes:
        t = t.replace(old, new)
    if t != orig:
        f.write_text(t, encoding="utf-8")
        changed.append(str(f))
print("fixed files:", changed)
# verify no remaining suspicious patterns
bad = []
for f in root.rglob("*.tsx"):
    for i, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
        if re.search(r"const ubActive|const ubTab|\}, ubActive,", line):
            bad.append(f"{f}:{i}: {line.strip()}")
print("remaining broken:", bad or "none")
