#!/usr/bin/env bun
/* ─── Lexa — QA موتور دلتا-آپدیت (خارج از الکترون) ──────────────────────────
 *
 * سناریوها:
 *   ۱) ساخت اپ پایهٔ مصنوعی (v0.4.0) + «بیلد بعدی» (v0.5.1) با تغییر/افزودن/حذف
 *   ۲) سرور فید محلی (مانیفست + فایل‌های محو) به‌جای گیت‌هاب/jsDelivr
 *   ۳) check → assert تعداد/حجم فایل‌ها
 *   ۴) apply → assert محتوا، حذف، سیم‌لینک، مانیفست نصب، پاک‌سازی staging
 *   ۵) ازسرگیری: فایل استیج‌شدهٔ ناقص/کامل → بدون دانلود مجدد
 *   ۶) چک دوباره → به‌روز
 *   ۷) خرابی وصل وسط راه → apply دوباره جواب می‌دهد
 *   ۸) appdata عقب‌تر از باندل → نادیده گرفته می‌شود
 * ─────────────────────────────────────────────────────────────────────── */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const { createUpdater, scanDir, manifestFromScan, sha256File } = require_("../electron/app-updater.js");

const TMP = path.join("/tmp", `lexa-delta-qa-${Date.now()}`);
const BASE = path.join(TMP, "base");
const NEXT = path.join(TMP, "next");
const FEED = path.join(TMP, "updates", "app"); // آدرس URLها با ریشهٔ TMP سرو می‌شود
const UD = path.join(TMP, "userdata");

let passed = 0;
let failed = 0;
function assert(cond, label, extra = "") {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label} ${extra}`);
  }
}

/* ─── اپ مصنوعی ──────────────────────────────────────────────────────────── */

async function makeBase() {
  const w = async (rel, content) => {
    const p = path.join(BASE, rel);
    await fsp.mkdir(path.dirname(p), { recursive: true });
    await fsp.writeFile(p, content);
  };
  await w("package.json", JSON.stringify({ name: "lexa", version: "0.4.0" }));
  await w("electron/main.js", "// bootstrap v0.4.0\n");
  await w("electron/main-core.js", "// core v0.4.0 — " + "x".repeat(500) + "\n");
  await w("electron/preload.js", "// preload v0.4.0\n");
  await w("electron/app-updater.js", "// engine v0.4.0\n");
  await w(".next/standalone/server.js", "// server v0.4.0\n" + "s".repeat(2000));
  await w(".next/standalone/.next/server/chunk-1.js", "// chunk1 v0.4.0\n");
  await w(".next/standalone/.next/server/chunk-2.js", "// chunk2 v0.4.0\n");
  await w(".next/standalone/.next/static/css/app.css", "body{} v0.4.0\n");
  await w(".next/standalone/node_modules/next/dist/a.js", "// a v0.4.0\n" + "a".repeat(1500));
  await w(".next/standalone/node_modules/.prisma/client/engine.so.node", "BINARY".repeat(300));
  await w(".next/standalone/.next/cache/should-not-ship.txt", "CACHE — نباید در مانیفست باشد\n");
  await w("public/icons/icon-192.png", "ICON".repeat(50));
  await w("public/texts/lesson.json", "TEXT — نباید در مانیفست باشد\n");
  await fsp.mkdir(path.join(BASE, ".next/standalone/.next/node_modules/@prisma"), { recursive: true });
  await fsp.symlink("../../../node_modules/@prisma/client", path.join(BASE, ".next/standalone/.next/node_modules/@prisma/client-abc"));
}

async function makeNext() {
  // کپی پایه + تغییرات
  await fsp.cp(BASE, NEXT, { recursive: true, verbatimSymlinks: true });
  const w = async (rel, content) => {
    const p = path.join(NEXT, rel);
    await fsp.mkdir(path.dirname(p), { recursive: true });
    await fsp.writeFile(p, content);
  };
  await w("package.json", JSON.stringify({ name: "lexa", version: "0.5.1" }));
  await w("electron/main-core.js", "// core v0.5.1 — " + "x".repeat(500) + "\n"); // تغییر
  await w(".next/standalone/.next/server/chunk-2.js", "// chunk2 v0.5.1 patched\n"); // تغییر
  await w(".next/standalone/.next/static/js/new-chunk.js", "// NEW chunk v0.5.1\n" + "n".repeat(1200)); // جدید
  await w("public/manifest-new.txt", "brand new file v0.5.1\n"); // جدید
  await fsp.rm(path.join(NEXT, ".next/standalone/.next/server/chunk-1.js")); // حذف
  await w(".next/standalone/.next/cache/should-not-ship.txt", "CACHE تغییر — باز هم نباید دانلود شود\n");
  await w("public/texts/lesson.json", "TEXT تغییر — باز هم نباید دانلود شود\n");
}

/* ─── فید محلی ───────────────────────────────────────────────────────────── */

const fetchLog = [];
async function buildFeed() {
  const files = await scanDir(NEXT);
  const manifest = manifestFromScan(files, {
    version: "0.5.1",
    tag: "app-v0.5.1",
    notes: "نسخهٔ آزمایشی QA — رفع دو باگ و یک chunk جدید",
    generatedAt: new Date().toISOString(),
    history: [{ version: "0.4.0", date: new Date().toISOString(), notes: "نسخهٔ مرجع" }],
  });
  await fsp.mkdir(path.join(FEED, "f"), { recursive: true });
  for (const [p, e] of files) {
    if (String(e.h).startsWith("link:")) continue;
    const dest = path.join(FEED, "f", e.h.slice(0, 12) + ".bin");
    if (!fs.existsSync(dest)) await fsp.copyFile(path.join(NEXT, p), dest);
  }
  await fsp.writeFile(path.join(FEED, "manifest.json"), JSON.stringify(manifest));
  return manifest;
}

function serveFeed() {
  return new Promise((resolve) => {
    const srv = http.createServer(async (req, res) => {
      const rel = decodeURIComponent((req.url || "").split("?")[0]).replace(/^\/+/, "");
      fetchLog.push(rel);
      const p = path.join(TMP, rel); // /updates/app/manifest.json → TMP/updates/app/manifest.json
      try {
        const data = await fsp.readFile(p);
        res.writeHead(200, { "content-type": "application/octet-stream" });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end("not found");
      }
    });
    srv.listen(0, "127.0.0.1", () => resolve({ srv, port: srv.address().port }));
  });
}

/* ─── اجرا ───────────────────────────────────────────────────────────────── */

console.log("─".repeat(60));
await makeBase();
await makeNext();
const manifest = await buildFeed();
const { srv, port } = await serveFeed();
const FEED_URL = `http://127.0.0.1:${port}`;

const common = {
  baseDir: BASE,
  userData: UD,
  pkgVersion: "0.4.0",
  env: { LEXA_UPDATE_FEED: FEED_URL },
  log: () => {},
  onFetch: (u) => fetchLog.push("FETCH:" + u),
};

/* ۱) check */
console.log("\n[۱] check — نسخهٔ جدید باید پیدا شود");
const up1 = createUpdater(common);
const c1 = await up1.check();
assert(c1.available === true, "available = true");
assert(c1.currentVersion === "0.4.0" && c1.remoteVersion === "0.5.1", "0.4.0 → 0.5.1", JSON.stringify(c1));
// تغییر: main-core، chunk-2، package.json + جدید: new-chunk، manifest-new = ۵
assert(c1.filesChanged === 5, `filesChanged = 5 (واقعی: ${c1.filesChanged})`);
assert(c1.deletes === 1, `deletes = 1 (واقعی: ${c1.deletes})`);
assert(c1.bytesChanged > 0 && c1.bytesChanged < 64 * 1024, `bytesChanged منطقی = ${c1.bytesChanged}`);

/* ۲) apply کامل */
console.log("\n[۲] apply — دانلود و اعمال دلتا");
const events = [];
const r1 = await up1.apply((e) => events.push(e));
assert(r1.ok === true && r1.version === "0.5.1", "apply موفق به 0.5.1");
const ad = path.join(UD, "appdata");
assert((await fsp.readFile(path.join(ad, "electron/main-core.js"), "utf8")).includes("v0.5.1"), "main-core جدید اعمال شد");
assert((await fsp.readFile(path.join(ad, ".next/standalone/.next/server/chunk-2.js"), "utf8")).includes("v0.5.1"), "chunk-2 جدید اعمال شد");
assert((await fsp.readFile(path.join(ad, "electron/main.js"), "utf8")).includes("v0.4.0"), "main.js دست‌نخورده (unchanged دانلود نشد)");
assert(!(fs.existsSync(path.join(ad, ".next/standalone/.next/server/chunk-1.js"))), "chunk-1 حذف شد");
assert(fs.existsSync(path.join(ad, ".next/standalone/.next/static/js/new-chunk.js")), "فایل جدید ساخته شد");
assert((await fsp.readFile(path.join(ad, "package.json"), "utf8")).includes("0.5.1"), "package.json به‌روز شد");
const linkTarget = await fsp.readlink(path.join(ad, ".next/standalone/.next/node_modules/@prisma/client-abc")).catch(() => null);
assert(linkTarget === "../../../node_modules/@prisma/client", "سیم‌لینک بازسازی شد");
assert(!(fs.existsSync(path.join(ad, ".staging"))), "staging پاک شد");
assert(!(fs.existsSync(path.join(ad, ".commit-in-progress"))), "نشانگر commit پاک شد");
const inst = JSON.parse(await fsp.readFile(path.join(ad, ".lexa-install.json"), "utf8"));
assert(inst.version === "0.5.1" && inst.files["electron/main.js"], "مانیفست نصب ثبت شد");
const cached = JSON.parse(await fsp.readFile(path.join(UD, "bundled-manifest-0.4.0.json"), "utf8"));
assert(!cached.files[".next/standalone/.next/cache/should-not-ship.txt"], "cache/ در مانیفست نیست");
assert(!cached.files["public/texts/lesson.json"], "public/texts در مانیفست نیست");
// فازها به ترتیب
const phases = [...new Set(events.map((e) => e.phase))];
assert(phases[0] === "prepare" && phases.includes("base") && phases.includes("download") && phases[phases.length - 1] === "commit", `فازها: ${phases.join("→")}`);
// فقط فایل‌های واقعی (نه مانیفست)
const fileFetches = () => fetchLog.filter((u) => u.startsWith("FETCH:") && /\/f\/[a-f0-9]+\.bin$/.test(u)).length;
const fetched = fileFetches();
assert(fetched === 5, `دقیقاً ۵ فایل دانلود شد (واقعی: ${fetched})`);

/* ۳) check بعد از apply → به‌روز */
console.log("\n[۳] check پس از نصب — باید به‌روز باشد");
const up2 = createUpdater(common);
const c2 = await up2.check();
assert(c2.available === false, "available = false", JSON.stringify(c2));
assert(c2.currentVersion === "0.5.1", "currentVersion = 0.5.1");

/* ۴) ازسرگیری — staging آمادهٔ یکی از فایل‌ها */
console.log("\n[۴] resume — فایل استیج‌شدهٔ معتبر دوباره دانلود نمی‌شود");
// برگشت به حالت «نسخهٔ قدیمی نصب‌شده در appdata» — با مانیفست باندل 0.4.0
const bundled = JSON.parse(await fsp.readFile(path.join(UD, "bundled-manifest-0.4.0.json"), "utf8"));
await fsp.writeFile(path.join(ad, ".lexa-install.json"), JSON.stringify(bundled));
const st = path.join(ad, ".staging");
await fsp.mkdir(st, { recursive: true });
const newChunkHash = (await sha256File(path.join(NEXT, ".next/standalone/.next/static/js/new-chunk.js")));
await fsp.copyFile(path.join(NEXT, ".next/standalone/.next/static/js/new-chunk.js"), path.join(st, newChunkHash.slice(0, 12) + ".bin"));
fetchLog.length = 0;
const up3 = createUpdater(common);
await up3.apply(() => {});
const fetched2 = fileFetches();
assert(fetched2 === 4, `فقط ۴ فایل دانلود شد (staging استفاده شد) (واقعی: ${fetched2})`);

/* ۵) باندل جدیدتر از appdata → appdata نادیده گرفته می‌شود */
console.log("\n[۵] appdata عقب‌تر از باندل — نادیده گرفته می‌شود");
const up4 = createUpdater({ ...common, pkgVersion: "0.6.0" });
const c3 = await up4.check();
assert(c3.currentVersion === "0.6.0", "به‌جای appdata قدیمی، باندل ملاک است", JSON.stringify(c3));
assert(c3.available === true && c3.remoteVersion === "0.5.1" ? false : true, "منطق نسخه سالم"); // 0.6.0 > 0.5.1 → available=false
assert(c3.available === false, "available = false (باندل جدیدتر است)");

/* ۶) قطعی وسط دانلود → تلاش بعدی کامل می‌شود */
console.log("\n[۶] تلاش مجدد بعد از خطا — قابل ازسرگیری");
await fsp.writeFile(path.join(ad, ".lexa-install.json"), JSON.stringify(bundled));
const broken = createUpdater({
  ...common,
  env: { LEXA_UPDATE_FEED: FEED_URL + "-broken" }, // همه URLها می‌خورند
});
let threw = false;
try {
  await broken.apply(() => {});
} catch {
  threw = true;
}
assert(threw === true, "apply با فید خراب خطا می‌دهد");
const up5 = createUpdater(common); // فید سالم برگشت
const r2 = await up5.apply(() => {});
assert(r2.ok === true && r2.version === "0.5.1", "تلاش بعدی موفق (resume)");

srv.close();
console.log("\n" + "─".repeat(60));
console.log(`نتیجه: ${passed} ✓ / ${failed} ✗`);
if (failed > 0) process.exit(1);
console.log("همهٔ تست‌های موتور دلتا سبز شدند — " + TMP);
