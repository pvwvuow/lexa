#!/usr/bin/env python3
# ─── فیکس جستجوی اندروید 0.9.2 — GlobalSearch.tsx ──────────────────────────
# ۱) ورودی کنترل‌نشده (بدون value از استیت) → پایان تضاد با IME/متن‌ساز اندروید
# ۲) حذف دیبانس ۱۱۰ms → نتیجه در همان ضربهٔ کلید
# ۳) شاخص کش‌شده + ساخت تکه‌تکهٔ غیرمسدودکننده → پایان اتکا به requestIdleCallback
import io, sys

P = "/home/z/my-project/src/components/app/GlobalSearch.tsx"
src = io.open(P, encoding="utf-8").read()
lines = src.split("\n")

def find(pred, start=0):
    for i in range(start, len(lines)):
        if pred(lines[i]):
            return i
    raise SystemExit(f"ANCHOR NOT FOUND: step from line {start}")

def find_exact(s, start=0):
    return find(lambda l: l.strip() == s, start)

# ── مختصات همهٔ لنگرها روی فایل اصلی ──────────────────────────────────────────
i_build = find(lambda l: l.startswith("function buildIndex(courses: Course[]) {"))
i_build_start = i_build - 1  # کامنت بالای تابع
assert lines[i_build_start].lstrip().startswith("/**"), lines[i_build_start]
i_build_end = find_exact("}", i_build)
assert i_build_end - i_build_start < 30

i_gs = find(lambda l: l.startswith("export function GlobalSearch("))

i_rawq = find(lambda l: "const [rawQ, setRawQ] = React.useState" in l)
i_rawq_end = find(lambda l: l.strip() == "}, [rawQ]);", i_rawq)

i_idx = find(lambda l: "const [index, setIndex] = React.useState<ReturnType<typeof buildIndex>" in l)
i_law = find(lambda l: "const [lawIndex, setLawIndex] = React.useState<ReturnType<typeof buildLawIndex>" in l)

i_eff = find(lambda l: 'setRawQ("");' in l) - 3
assert "React.useEffect(() => {" in lines[i_eff + 1] and "if (!open) return;" in lines[i_eff + 2]
i_eff_end = find_exact("}, [open]);", i_eff)

i_tver = find(lambda l: l.strip() == "const textsVer = useTextsVersion();", i_eff_end)
i_tver_end = find_exact("}, [textsVer]);", i_tver)

i_busy = find(lambda l: "const busy = (!indexReady || rawQ !== q) && true;" in l)
i_hq = find(lambda l: "const hasQuery = rawQ.trim().length > 0;" in l)

i_val = find(lambda l: "value={rawQ}" in l)
assert "onChange={(e) => { setRawQ(e.target.value); setCursor(0); }}" in lines[i_val + 1]

i_bar = find(lambda l: "rounded-xl bg-white/55 px-3" in l)

# ── اعمال از پایین به بالا تا شماره‌خط‌ها معتبر بمانند ────────────────────────

# R7 — کلاس نوار شمارندهٔ نتیجه
lines[i_bar] = lines[i_bar].replace('className="sticky', 'className="search-count-bar sticky', 1)

# R6 — ورودی کنترل‌نشده + سخت‌سازی IME
lines[i_val:i_val + 2] = [
    '                defaultValue=""',
    '                onChange={(e) => { setQ(e.currentTarget.value); setCursor(0); }}',
    '                enterKeyHint="search"',
    '                autoComplete="off"',
    '                autoCorrect="off"',
    '                autoCapitalize="off"',
    '                spellCheck={false}',
]

# R5 — busy/hasQuery بدون دیبانس
lines[i_hq] = "  const hasQuery = q.trim().length > 0;"
lines[i_busy] = "  const busy = !indexReady;"

# R4b — افکت متن‌های تنبل: بازسازی بی‌صدای شاخص (بدون تعریف دوبارهٔ textsVer)
lines[i_tver:i_tver_end + 1] = [
    "  // با آب‌رسانی محتوای تازه (لود تنبل) شاخص بی‌صدا بازسازی می‌شود — تا وقتی جست‌وجو باز است",
    "  React.useEffect(() => {",
    "    if (!open) return;",
    "    buildLessonIndexChunked(courses, textsVer, (items) => {",
    "      setIndex(items);",
    "      setIndexReady(true);",
    "    });",
    "  }, [textsVer]);",
]

# R4 — افکت باز شدن: کش یا ساخت تکه‌تکه + حذف requestIdleCallback
lines[i_eff:i_eff_end + 1] = [
    "  // آماده‌سازی شاخص هنگام باز شدن — از کش اگر تازه باشد؛ وگرنه ساخت تکه‌تکهٔ",
    "  // غیرمسدودکننده (اسکلتون تا پایان ساخت). باز و بسته کردن‌های بعدی فوری است.",
    "  React.useEffect(() => {",
    "    if (!open) return;",
    "    setQ(\"\");",
    "    setCursor(0);",
    "    setTimeout(() => inputRef.current?.focus(), 40);",
    "",
    "    const cached = getLessonCache(courses, textsVerRef.current);",
    "    if (cached) {",
    "      setIndex(cached);",
    "      setIndexReady(true);",
    "    } else {",
    "      setIndexReady(false);",
    "      buildLessonIndexChunked(courses, textsVerRef.current, (items) => {",
    "        setIndex(items);",
    "        setIndexReady(true);",
    "      });",
    "    }",
    "",
    "    setLawIndex(getLawItems());",
    "    // متن کامل قوانین برسد، شاخص قانونی غنی‌تر می‌شود",
    "    fetchFullLaws().then((d) => {",
    "      if (d && Object.keys(d).length) setLawIndex(getLawItems(d));",
    "    });",
    "    setTeachersLoading(true);",
    "    fetch(\"/api/social/suggestions\")",
    "      .then((r) => (r.ok ? r.json() : null))",
    "      .then((d: { teachers?: typeof teachers } | null) => {",
    "        if (d?.teachers) setTeachers(d.teachers);",
    "      })",
    "      .catch(() => {})",
    "      .finally(() => setTeachersLoading(false));",
    "  }, [open]);",
]

# R3 — تایپ استیت‌ها از ReturnType + textsVer و رفرش آن (یک‌بار، بالای همهٔ افکت‌ها)
lines[i_law] = "  const [lawIndex, setLawIndex] = React.useState<LawIndexItem[] | null>(null);"
lines[i_law + 1:i_law + 1] = [
    "  const textsVer = useTextsVersion();",
    "  const textsVerRef = React.useRef(textsVer);",
    "  textsVerRef.current = textsVer;",
]
lines[i_idx] = "  const [index, setIndex] = React.useState<IndexItem[] | null>(null);"

# R2 — حذف rawQ و دیبانس
lines[i_rawq:i_rawq_end + 1] = [
    "  // q مستقیم از ورودی کنترل‌نشده می‌آید — بدون debounce. روی اندروید با IME/متن‌ساز",
    "  // تضاد ندارد و نتیجه‌ها در همان ضربهٔ کلید به‌روز می‌شوند.",
    "  const [q, setQ] = React.useState(\"\");",
    "  const [cursor, setCursor] = React.useState(0);",
    "  const [indexReady, setIndexReady] = React.useState(false);",
    "  const [teachersLoading, setTeachersLoading] = React.useState(false);",
    "  const inputRef = React.useRef<HTMLInputElement>(null);",
    "  const listRef = React.useRef<HTMLDivElement>(null);",
]

# R8 — کش تک‌نسخه‌ای شاخص قوانین (پایه یک‌بار، ارتقای کامل فقط یک‌بار)
lines[i_gs:i_gs] = [
    "/* شاخص قوانین — یک‌بار ساخته می‌شود؛ با رسیدن متن کامل، فقط یک‌بار غنی‌تر می‌شود */",
    "let LAW_ITEMS: LawIndexItem[] | null = null;",
    "let LAW_FULL_REF: unknown = null;",
    "function getLawItems(full?: Record<string, { books?: LawBook[] }> | null): LawIndexItem[] {",
    "  const ref = full && Object.keys(full).length ? full : null;",
    "  if (ref && LAW_FULL_REF !== ref) {",
    "    LAW_FULL_REF = ref;",
    "    LAW_ITEMS = buildLawIndex(ref);",
    "  } else if (!LAW_ITEMS) {",
    "    LAW_ITEMS = buildLawIndex(null);",
    "    LAW_FULL_REF = null;",
    "  }",
    "  return LAW_ITEMS;",
    "}",
    "",
]

# R1 — بازسازی بلوک buildIndex: تکه‌سازی + کش جلسه‌ها
lines[i_build_start:i_build_end + 1] = [
    "/** آیتم شاخص جلسه‌ها */",
    "interface IndexItem { c: Course; ch: string; l: { id: string; title: string }; flatIdx: number; total: number; hay: string; plain: string }",
    "function flattenCourseInto(c: Course, items: IndexItem[]) {",
    "  const flats = flatLessons(c);",
    "  const total = flats.length;",
    "  flats.forEach(({ lesson, chapter }, i) => {",
    "    let plain = `${lesson.title} ${chapter.title} ${c.title}`;",
    "    for (const s of lesson.sections) {",
    "      if (s.title) plain += ` ${s.title}`;",
    "      if (s.body) plain += ` ${s.body}`;",
    "      if (s.bullets) plain += ` ${s.bullets.join(\" \")}`;",
    "      if (s.law) for (const w of s.law) plain += ` ماده ${w.no} ${w.text}`;",
    "      if (s.table) for (const r of s.table.rows) plain += ` ${r.join(\" \")}`;",
    "      if (s.questionText) plain += ` ${s.questionText}`;",
    "    }",
    "    for (const q of lesson.quiz.slice(0, 3)) plain += ` ${q.q}`;",
    "    plain = plain.replace(/\\s+/g, \" \");",
    "    items.push({ c, ch: chapter.title, l: { id: lesson.id, title: lesson.title }, flatIdx: i, total, hay: norm(plain), plain });",
    "  });",
    "}",
    "",
    "/* ─── کش شاخص جلسه‌ها — بین باز و بسته‌شدن‌ها می‌ماند تا جستجو همیشه فوری باشد ──",
    "   کلید کش = هویت آرایهٔ دوره‌ها + نسخهٔ متن‌های تنبل. ساخت تکه‌تکه و غیرمسدودکننده",
    "   است تا روی گوشی‌های کند صفحه هنگ نکند و تا پایان ساخت، اسکلتون دیده شود. */",
    "let LESSON_CACHE: { src: Course[]; ver: number; items: IndexItem[] } | null = null;",
    "let LESSON_BUILD_TOKEN = 0;",
    "function getLessonCache(courses: Course[], ver: number): IndexItem[] | null {",
    "  return LESSON_CACHE && LESSON_CACHE.src === courses && LESSON_CACHE.ver === ver ? LESSON_CACHE.items : null;",
    "}",
    "function buildLessonIndexChunked(courses: Course[], ver: number, onDone: (items: IndexItem[]) => void) {",
    "  const token = ++LESSON_BUILD_TOKEN;",
    "  LESSON_CACHE = null;",
    "  const finish = (items: IndexItem[]) => {",
    "    LESSON_CACHE = { src: courses, ver, items };",
    "    onDone(items);",
    "  };",
    "  if (courses.length === 0) { finish([]); return; }",
    "  const items: IndexItem[] = [];",
    "  let i = 0;",
    "  const step = () => {",
    "    if (token !== LESSON_BUILD_TOKEN) return; // ساخت تازه‌تری شروع شده",
    "    const end = Math.min(i + 20, courses.length);",
    "    for (; i < end; i++) flattenCourseInto(courses[i], items);",
    "    if (i < courses.length) { setTimeout(step, 0); return; }",
    "    finish(items);",
    "  };",
    "  setTimeout(step, 0);",
    "}",
]

io.open(P, "w", encoding="utf-8").write("\n".join(lines))
print("OK — GlobalSearch.tsx rewritten:", len(lines), "lines")
