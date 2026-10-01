// ═══ تولید نسخهٔ «تنبل» محتوای دوره‌ها ═══════════════════════════════════════
// ورودی:  src/lib/law/courses/courses-full.ts  (درخت کامل با متن و سؤال)
// خروجی:
//   ۱) public/texts/<lessonId>.json        — محتوای هر جلسه { id, v, sections, quiz }
//   ۲) src/lib/law/courses/generated-meta.ts — همان درخت «بدون» محتوا + v و qCount
//   ۳) public/texts/manifest.json          — فهرست نسخه‌ها (برای QA و آینده)
// اجرا:  bun scripts/build-lesson-texts.mjs
// ═════════════════════════════════════════════════════════════════════════════
import { mkdirSync, rmSync, writeFileSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const TEXTS_DIR = join(ROOT, "public", "texts");
const META_FILE = join(ROOT, "src", "lib", "law", "courses", "generated-meta.ts");

// ۱) درخت کامل را از منبع واقعی بخوان
const { builtinCourses } = await import(join(ROOT, "src/lib/law/courses/courses-full.ts"));

/** هش djb2 — نسخهٔ پایدار محتوا برای کش نامعتبرشونده */
function hashV(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0");
}

mkdirSync(TEXTS_DIR, { recursive: true });

/** ۲) فایل محتوای هر جلسه */
const manifest = { generatedAt: new Date().toISOString(), lessons: {} };
let bytes = 0, lessonCount = 0;

function stripLesson(l) {
  const sections = l.sections ?? [];
  const quiz = l.quiz ?? [];
  const v = hashV(JSON.stringify(sections) + "\u0000" + JSON.stringify(quiz));

  // فایل محتوا — متن + سؤال
  const payload = { id: l.id, v, sections, quiz };
  const raw = JSON.stringify(payload);
  bytes += raw.length;
  writeFileSync(join(TEXTS_DIR, `${l.id}.json`), raw);

  manifest.lessons[l.id] = { v, b: raw.length, q: quiz.length };

  // متادیتای سبک برای باندل — بدون sections و quiz و sourceSlice
  const meta = { ...l, sections: [], quiz: [], v, qCount: quiz.length };
  delete meta.sourceSlice;
  return meta;
}

const tree = builtinCourses.map((c) => ({
  ...c,
  chapters: c.chapters.map((ch) => ({
    ...ch,
    quiz: [], // آزمون پایان فصل اگر بعداً اضافه شود هم سبک می‌ماند
    lessons: ch.lessons.map(stripLesson),
  })),
}));
lessonCount = Object.keys(manifest.lessons).length;

/** ۳) متادیتای سبک — مستقیم به‌صورت object literal معتبر TS */
const banner = `// ═══ فایل تولیدشدهٔ خودکار — دستی ویرایش نکنید ═══════════════════════════════
// منبع: courses-full.ts  |  تولید: scripts/build-lesson-texts.mjs
// این نسخهٔ «سبک» است: فقط متادیتا (${lessonCount} جلسه)؛ متن و سؤال در public/texts/<id>.json
// ───────────────────────────────────────────────────────────────────────────
import type { Course } from "../types";

export const TEXTS_REV = ${JSON.stringify(manifest.generatedAt)};

export const builtinCourses: Course[] = `;

writeFileSync(META_FILE, banner + JSON.stringify(tree) + ";\n");
writeFileSync(join(TEXTS_DIR, "manifest.json"), JSON.stringify(manifest));

/** ۴) پاک‌سازی فایل‌های یتیم از اجراهای قبل */
const valid = new Set([...Object.keys(manifest.lessons).map((id) => `${id}.json`), "manifest.json"]);
for (const f of readdirSync(TEXTS_DIR)) {
  if (!valid.has(f)) rmSync(join(TEXTS_DIR, f));
}

console.log(
  `✓ ${lessonCount} فایل محتوا (${(bytes / 1048576).toFixed(2)}MB) در public/texts/` +
  ` | متادیتای باندل: ${(statSync(META_FILE).size / 1024).toFixed(0)}KB`,
);
