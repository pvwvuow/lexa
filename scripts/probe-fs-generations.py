#!/usr/bin/env python3
# پروب نوسان دو نسل محتوا — هر لایه را ۵ بار می‌خواند و شمارش الگوی خراب/سالم را گزارش می‌کند
import subprocess

FILES = ["src/components/app/LearnView.tsx", "src/components/app/MarkHandles.tsx"]
BAD = ["const arkBar,", "const arkDragging,", "}, arkBar]);", "}, easure]);", "}, ideMarks]);"]
GOOD = ["const [markBar, setMarkBar]", "const [markDragging, setMarkDragging]", "}, [markBar]);", "}, [measure]);", "}, [hideMarks]);"]

def probe():
    for rel in FILES:
        rows = []
        for i in range(5):
            # python layer
            with open(f"/home/z/my-project/{rel}", encoding="utf-8") as f:
                t = f.read()
            py_bad = sum(t.count(b) for b in BAD)
            py_good = sum(t.count(g) for g in GOOD)
            # node layer
            out = subprocess.run(["node", "-e", f"process.stdout.write(require('fs').readFileSync('/home/z/my-project/{rel}','utf8'))"],
                                 capture_output=True, text=True, check=True).stdout
            nd_bad = sum(out.count(b) for b in BAD)
            nd_good = sum(out.count(g) for g in GOOD)
            rows.append((i, f"py(bad={py_bad},good={py_good})", f"node(bad={nd_bad},good={nd_good})"))
        # git blob layer
        gb = subprocess.run(["git", "show", f"HEAD:{rel}"], capture_output=True, text=True, cwd="/home/z/my-project", check=True).stdout
        g_bad = sum(gb.count(b) for b in BAD)
        g_good = sum(gb.count(g) for g in GOOD)
        print(f"── {rel}")
        for r in rows:
            print("   ", r)
        print(f"    git-blob HEAD: bad={g_bad} good={g_good}")

probe()
