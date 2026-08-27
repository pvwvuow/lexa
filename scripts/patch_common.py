# -*- coding: utf-8 -*-
"""Patch common.tsx: bigger lesson fonts, robust parser (no dropped lead-in lines,
nested dash support), overlap-free StepList rail, larger diamond badge. Idempotent."""
import io

P = "/home/z/my-project/src/components/app/common.tsx"
src = io.open(P, encoding="utf-8").read()
orig = src

def replace_between(s, start_marker, end_marker, new_text):
    i = s.find(start_marker)
    assert i != -1, f"start not found: {start_marker[:50]!r}"
    j = s.find(end_marker, i + len(start_marker))
    assert j != -1, f"end not found: {end_marker[:50]!r}"
    return s[:i] + new_text + s[j:]

NEW_HEAD = 'type SubItem = { term?: string; text: string };\ntype TermItem = { term?: string; text: string; subs?: SubItem[] };\ntype BodyBlock =\n  | { kind: "p"; text: string }\n  | { kind: "terms"; items: TermItem[] }\n  | { kind: "steps"; items: string[] };\n\nconst DASH_RE = /^[-\u2013\u2022*]\\s+/;\nconst NUM_RE = /^[0-9\u06F0-\u06F9]{1,2}\\s*[-\u2013..))]\\s*/;\n\ntype RunKind = "p" | "dash" | "num";\n\n/** parseTermLine */\nfunction parseTermLine(line: string): TermItem {\n  const raw = line.replace(/^[-\u2013\u2022*]\\s+/, "").trim();\n  const m = raw.match(/^(\u00ab?[^\u00ab\u00bb:\uff1a]{2,44}\u00bb?)\\s*[:\uff1a]\\s+(.+)$/);\n  if (m) return { term: m[1].replace(/^\u00ab/, "").replace(/\u00bb$/, ""), text: m[2].trim() };\n  return { text: raw };\n}\n\n/** parseBody \u2014 segment-based, keeps every lead-in line, supports nested dashes */\nexport function parseBody(body: string): BodyBlock[] {\n  const blocks: BodyBlock[] = [];\n  let paraBuf: string[] = [];\n  const flushPara = () => {\n    if (paraBuf.length) {\n      blocks.push({ kind: "p", text: paraBuf.join("\\n") });\n      paraBuf = [];\n    }\n  };\n\n  for (const chunk of body.split(/\\n{2,}/)) {\n    const rawLines = chunk.split("\\n").filter((l) => l.trim());\n    if (!rawLines.length) continue;\n\n    // group consecutive same-kind lines\n    const runs: { kind: RunKind; lines: string[] }[] = [];\n    for (const raw of rawLines) {\n      const t = raw.trim();\n      const kind: RunKind = DASH_RE.test(t) ? "dash" : NUM_RE.test(t) ? "num" : "p";\n      const lastRun = runs[runs.length - 1];\n      if (kind === "p") {\n        if (!lastRun || lastRun.kind !== "p") runs.push({ kind: "p", lines: [raw] });\n        else lastRun.lines.push(raw);\n      } else if (lastRun && lastRun.kind === kind) lastRun.lines.push(raw);\n      else runs.push({ kind, lines: [raw] });\n    }\n\n    for (const run of runs) {\n      if (run.kind === "p") {\n        paraBuf.push(run.lines.map((l) => l.trim()).join("\\n"));\n        continue;\n      }\n      flushPara();\n      if (run.kind === "num") {\n        blocks.push({ kind: "steps", items: run.lines.map((l) => l.replace(NUM_RE, "").trim()) });\n      } else {\n        const items: TermItem[] = [];\n        for (const raw of run.lines) {\n          const indented = /^[ \\t]/.test(raw);\n          const parsed = parseTermLine(raw.trim());\n          if (indented && items.length) {\n            const parent = items[items.length - 1];\n            (parent.subs ??= []).push({ term: parsed.term, text: parsed.text });\n          } else items.push(parsed);\n        }\n        blocks.push({ kind: "terms", items });\n      }\n    }\n  }\n  flushPara();\n  return blocks;\n}'

NEW_TERMCARD_DOC = '/** TermCard \u2014 qab-e do-khat, lozi badge, talayi title */'
NEW_TERMCARD = NEW_TERMCARD_DOC + '''
export function TermCard({ item, index }: { item: TermItem; index?: number }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-bronze/30 bg-accent/40 p-4 transition-colors duration-200 hover:border-bronze/55 sm:p-5">
      <span aria-hidden className="pointer-events-none absolute inset-1.5 rounded-lg border border-bronze/15" />
      <BookOpen aria-hidden className="pointer-events-none absolute -bottom-4 -start-4 h-16 w-16 rotate-12 text-bronze/[0.07]" />
      <div className="relative z-10">
        <div className="mb-2.5 flex items-center gap-3">
          {index !== undefined && (
            <span aria-hidden className="grid h-7 w-7 shrink-0 rotate-45 place-items-center rounded-[9px] border border-bronze/40 bg-card shadow-card">
              <span className="-rotate-45 text-[11.5px] font-bold leading-none text-bronze">{fa(index)}</span>
            </span>
          )}
          <h4 className="min-w-0 break-words font-display text-[17px] font-bold text-bronze">{item.term}</h4>
        </div>
        <div aria-hidden className="ornament-rule mb-3 opacity-80" />
        <p className="font-body text-[18px] leading-[2] text-foreground/95">{item.text}</p>
        {item.subs && item.subs.length > 0 && (
          <ul className="mt-3 space-y-2.5 border-t border-dashed border-bronze/25 pt-3">
            {item.subs.map((sub, k) => (
              <li key={k} className="flex gap-2.5">
                <span aria-hidden className="mt-[13px] h-1.5 w-1.5 shrink-0 rotate-45 rounded-[1.5px] bg-bronze/70" />
                <span className="font-body min-w-0 flex-1 text-[17px] leading-[1.95] text-foreground/90">
                  {sub.term && <strong className="font-display text-[15.5px] text-primary">{sub.term}: </strong>}
                  {sub.text}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

'''

NEW_STEPLIST = '/** StepList \u2014 continuous dashed rail behind opaque medals */\nexport function StepList({ items }: { items: string[] }) {\n  return (\n    <ol className="relative space-y-3">\n      {items.length > 1 && (\n        <span aria-hidden className="pointer-events-none absolute bottom-[18px] start-[17px] top-[18px] w-px border-s border-dashed border-bronze/40" />\n      )}\n      {items.map((t, i) => {\n        const parsed = parseTermLine(t);\n        return (\n          <li key={i} className="relative flex gap-3">\n            <span className="relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-bronze/45 bg-card text-[13.5px] font-bold text-bronze shadow-card">\n              {fa(i + 1)}\n            </span>\n            <span className="font-body min-w-0 flex-1 rounded-xl border border-border bg-muted/45 px-4 py-3 text-[18px] leading-[1.95] transition-colors duration-150 hover:bg-accent/50">\n              {parsed.term ? (\n                <>\n                  <strong className="font-display text-[16px] text-primary">{parsed.term}: </strong>\n                  {parsed.text}\n                </>\n              ) : t}\n            </span>\n          </li>\n        );\n      })}\n    </ol>\n  );\n}\n\n'

NEW_BULLET = '''/** BulletRich — auto term-grid / steps / plain list */
export function BulletRich({ items }: { items: string[] }) {
  const parsed = items.map(parseTermLine);
  const termCount = parsed.filter((x) => x.term || x.subs).length;
  const numCount = items.filter((x) => NUM_RE.test(x.trim())).length;
  if (termCount >= Math.ceil(parsed.length / 2)) {
    return (
      <div className="grid items-start gap-3 md:grid-cols-2">
        {parsed.map((x, j) => (
          <TermCard key={j} item={x} index={x.term || x.subs ? j + 1 : undefined} />
        ))}
      </div>
    );
  }
  if (numCount >= Math.ceil(items.length / 2)) {
    return <StepList items={items.map((x) => x.replace(NUM_RE, "").trim())} />;
  }
  return <PlainList items={items} />;
}
'''

# ── 1) engine head (types + parseBody) ──
if "type SubItem" not in src:
    src = replace_between(src, "type TermItem = { term?: string; text: string };",
                          "  return blocks;\n}", NEW_HEAD + "\n")

# ── 2) TermCard ──
i = src.find("export function TermCard")
assert i != -1
j = src.find("export function StepList", i)
assert j != -1
src = src[:i] + NEW_TERMCARD + src[j:]

# restore proper Persian doc above TermCard (keep it pretty)
src = src.replace(NEW_TERMCARD_DOC,
                  "/** کارت اصطلاح‌نامه — قاب دوخط، نشان لوزی، عنوان طلایی و واترمارک کتاب */")

# ── 3) StepList ──
i = src.find("export function StepList")
assert i != -1
# include its old doc comment directly above
doc_i = src.rfind("/**", 0, i)
line_start = src.rfind("\n", 0, doc_i) + 1 if doc_i != -1 else i
src = src[:line_start] + NEW_STEPLIST + src[i:]
# remove potential leftover old body between NEW_STEPLIST and next block marker
k1 = src.find("function PlainList")
assert k1 != -1
seg = src[line_start:k1]
# keep only our StepList then PlainList comment/doc remains in seg? ensure no stray code:
import re
m = re.search(r"\n(/\*\*|\nfunction)", seg[len(NEW_STEPLIST):])
if m is None and seg.count("export function StepList") == 1 and seg.count("return;") == 0:
    # find where old StepList ended originally: seg should be exactly NEW_STEPLIST + trailing spaces
    extra = seg[len(NEW_STEPLIST):]
    if extra.strip():
        raise SystemExit(f"Unexpected residue before PlainList: {extra[:200]!r}")

# ── 4) PlainList li sizes ──
old_plain = '<li key={j} className="flex gap-2.5 rounded-xl border-e-2 border-transparent px-3 py-1.5 text-[16px] leading-[1.9] transition-colors hover:border-bronze/50 hover:bg-muted/40">'
new_plain = '<li key={j} className="flex gap-2.5 rounded-xl border-e-2 border-transparent px-3 py-2 text-[18px] leading-[1.95] transition-colors hover:border-bronze/50 hover:bg-muted/40">'
assert old_plain in src, "plainlist li"
src = src.replace(old_plain, new_plain)
old_dot = 'className="mt-[13px] h-2 w-2 shrink-0 rotate-45 rounded-[2px] bg-bronze/80"'
new_dot = 'className="mt-[15px] h-2 w-2 shrink-0 rotate-45 rounded-[2px] bg-bronze/80"'
assert old_dot in src, "plain dot"
src = src.replace(old_dot, new_dot)

# ── 5) grids md + items-start ──
old_grid = '<div key={i} className="grid gap-3 sm:grid-cols-2">'
assert old_grid in src
src = src.replace(old_grid, '<div key={i} className="grid items-start gap-3 md:grid-cols-2">')

# ── 6) paragraph size ──
old_p = 'whitespace-pre-line text-[18px] leading-[2.1] text-foreground/95'
assert old_p in src
src = src.replace(old_p, 'whitespace-pre-line text-[20px] leading-[2.15] text-foreground/95')

# ── 7) law quote size ──
old_law = 'text-[17px] leading-[2.1] text-foreground/90'
assert old_law in src
src = src.replace(old_law, 'text-[19px] leading-[2.1] text-foreground/90')

# ── 8) BulletRich → replace from its export to end of file ──
i = src.find("export function BulletRich")
assert i != -1
src = src[:i] + NEW_BULLET

io.open(P, "w", encoding="utf-8").write(src)
print("common.tsx patched OK, delta:", len(src) - len(orig), "chars")
