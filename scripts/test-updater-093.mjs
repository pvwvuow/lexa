#!/usr/bin/env bun
/* ─── QA 0.9.3 — سختی‌افزایی موتور دلتا (درِ خرابیِ کامیت) ────────────────────
 * سناریوها:
 *   ۱) apply سالم 0.4.0→0.5.1 + verifyLocal سبز (راستی‌آزمایی پس از کامیت)
 *   ۲) خراب‌کردن یک فایلِ نصب‌شده → verifyLocal نه؛ apply دوباره (بدون تغییر نسخه) ترمیمش می‌کند
 *   ۳) انسداد کامیت (پوشهٔ سرور به فایل تبدیل می‌شود) → خطا + نشانگر نیمه‌کاره می‌ماند
 *      + install.json ارتقا نمی‌یابد (بوت‌استرپ باندل را ترجیح می‌دهد)
 *   ۴) رفع انسداد → apply دوباره موفق + نشانگر پاک
 *   ۵) rebuildBase: فایلِ خرابِ مشترک بین باندل/ریموت فقط با ترمیم کامل بازمی‌گردد
 * ─────────────────────────────────────────────────────────────────────────── */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const { createUpdater, scanDir, manifestFromScan } = require_("../electron/app-updater.js");

const TMP = path.join("/tmp", `lexa-upd-093-${Date.now()}`);
const BASE = path.join(TMP, "base");
const NEXT = path.join(TMP, "next");
const FEED = path.join(TMP, "updates", "app");
const UD = path.join(TMP, "userdata");

let passed = 0, failed = 0;
function assert(cond, label, extra = "") {
  if (cond) { passed += 1; console.log(`  ✓ ${label}`); }
  else { failed += 1; console.error(`  ✗ ${label} ${extra}`); }
}

async function sha(p) {
  const { sha256File } = require_("../electron/app-updater.js");
  return sha256File(p);
}

/* ─── اپ مصنوعی (همان الگوی test-delta-apply) ────────────────────────────── */
async function makeBase() {
  const w = async (rel, content) => {
    const p = path.join(BASE, rel);
    await fsp.mkdir(path.dirname(p), { recursive: true });
    await fsp.writeFile(p, content);
  };
  await w("package.json", JSON.stringify({ name: "lexa", version: "0.4.0" }));
  await w("electron/main.js", "// bootstrap v0.4.0\n");
  await w("electron/main-core.js", "// core v0.4.0 — " + "x".repeat(300) + "\n");
  await w("electron/preload.js", "// preload v0.4.0\n");
  await w("electron/app-updater.js", "// engine v0.4.0\n");
  await w(".next/standalone/server.js", "// server v0.4.0\n" + "s".repeat(1500));
  await w(".next/standalone/.next/BUILD_ID", "buildid-040\n");
  await w(".next/standalone/.next/server/chunk-1.js", "// chunk1 v0.4.0\n");
  await w(".next/standalone/.next/server/chunk-2.js", "// chunk2 v0.4.0\n");
  await w(".next/standalone/.next/static/css/app.css", "body{} v0.4.0\n");
  await w("public/icons/icon-192.png", "ICON".repeat(40));
}

async function makeNext() {
  await fsp.cp(BASE, NEXT, { recursive: true });
  const w = async (rel, content) => {
    const p = path.join(NEXT, rel);
    await fsp.mkdir(path.dirname(p), { recursive: true });
    await fsp.writeFile(p, content);
  };
  await w("package.json", JSON.stringify({ name: "lexa", version: "0.5.1" }));
  await w("electron/main-core.js", "// core v0.5.1 — " + "x".repeat(300) + "\n"); // تغییر
  await w(".next/standalone/.next/server/chunk-2.js", "// chunk2 v0.5.1\n");      // تغییر
  await w(".next/standalone/.next/BUILD_ID", "buildid-051\n");                     // تغییر
  await w(".next/standalone/.next/static/js/new-chunk.js", "// NEW v0.5.1\n");     // جدید
  // chunk-1 و app.css و server.js عمداً بدون تغییر — برای سناریوی rebuildBase
}

/* ─── فید محلی ────────────────────────────────────────────────────────────── */
async function publishFeed(dir, version, tag) {
  const files = await scanDir(dir);
  const m = manifestFromScan(files, { version, tag, generatedAt: new Date().toISOString() });
  await fsp.mkdir(path.join(FEED, "f"), { recursive: true });
  for (const [p, e] of Object.entries(m.files)) {
    if (String(e[0]).startsWith("link:")) continue;
    const bin = path.join(FEED, "f", e[0].slice(0, 12) + ".bin");
    if (!fs.existsSync(bin)) await fsp.copyFile(path.join(dir, p), bin);
  }
  await fsp.writeFile(path.join(FEED, "manifest.json"), JSON.stringify(m));
  return m;
}

let server;
function startFeedServer() {
  return new Promise((resolve) => {
    server = http.createServer(async (req, res) => {
      const rel = decodeURIComponent((req.url || "").split("?")[0]).replace(/^\/+/, "");
      const p = path.join(TMP, rel);
      try {
        const buf = await fsp.readFile(p);
        res.writeHead(200, { "content-type": "application/octet-stream" });
        res.end(buf);
      } catch {
        res.writeHead(404);
        res.end("nope");
      }
    });
    server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${server.address().port}`));
  });
}

/* ─── اجرا ───────────────────────────────────────────────────────────────── */
console.log("▌ ساخت اپ مصنوعی و فید…");
await makeBase();
await makeNext();
const feedRoot = await startFeedServer();
process.env.LEXA_UPDATE_FEED = feedRoot;

const pkg = JSON.parse(await fsp.readFile("package.json", "utf8"));
const up = createUpdater({
  baseDir: BASE,
  userData: UD,
  pkgVersion: pkg.version === "0.9.3" ? "0.9.3" : "0.4.0", // باندل عقب‌تر از ریموت
  env: process.env,
  log: () => {},
});
// نسخهٔ باندل باید از ریموت عقب باشد: pkgVersion واقعی 0.9.3 است؛ این‌جا 0.4.0 جعل می‌کنیم
const up2 = createUpdater({
  baseDir: BASE,
  userData: UD,
  pkgVersion: "0.4.0",
  env: process.env,
  log: () => {},
});

await publishFeed(BASE, "0.4.0", "app-v0.4.0");
await publishFeed(NEXT, "0.5.1", "app-v0.5.1");

const ad = path.join(UD, "appdata");

console.log("▌ ۱) apply سالم 0.4.0 → 0.5.1");
const r1 = await up2.apply(() => {});
assert(r1.ok && r1.version === "0.5.1", "apply موفق", JSON.stringify(r1));
assert((await fsp.readFile(path.join(ad, ".next/standalone/.next/server/chunk-2.js"), "utf8")).includes("v0.5.1"), "chunk-2 جدید اعمال شد");
const v1 = await up2.verifyLocal();
assert(v1.ok === true && v1.checked > 0, `verifyLocal سبز (checked=${v1.checked})`, JSON.stringify(v1));
assert(!fs.existsSync(path.join(ad, ".commit-in-progress")), "نشانگر commit پاک شد");

console.log("▌ ۲) خراب‌کردن فایل نصب‌شده → verifyLocal قرمز → ترمیم کامل زنده‌اش می‌کند");
const cssPath = path.join(ad, ".next/standalone/.next/static/css/app.css");
await fsp.writeFile(cssPath, "CORRUPTED by disk-gremlin\n");
const v2 = await up2.verifyLocal();
assert(v2.ok === false && v2.broken.some((b) => b.includes("app.css")), "verifyLocal خرابی را می‌بیند", JSON.stringify(v2));
const r2 = await up2.apply(() => {}, { rebuildBase: true });
assert(r2.ok === true, "ترمیم (rebuildBase) موفق");
assert(!(await fsp.readFile(cssPath, "utf8")).includes("CORRUPTED"), "فایل خراب با محتوای درست بازنویسی شد");
const v3 = await up2.verifyLocal();
assert(v3.ok === true, "verifyLocal پس از ترمیم سبز");

console.log("▌ ۳) انسداد کامیت → خطا + نشانگر می‌ماند + install.json ارتقا نمی‌یابد");
// فید بعدی: 0.6.0 با تغییر chunk-2 (نسخهٔ جدید برای کامیتِ شکست‌خورده)
const NEXT2 = path.join(TMP, "next2");
await fsp.cp(NEXT, NEXT2, { recursive: true });
await fsp.writeFile(path.join(NEXT2, "package.json"), JSON.stringify({ name: "lexa", version: "0.6.0" }));
await fsp.writeFile(path.join(NEXT2, ".next/standalone/.next/server/chunk-2.js"), "// chunk2 v0.6.0\n");
await publishFeed(NEXT2, "0.6.0", "app-v0.6.0");
// انسداد: پوشهٔ server را با فایل هم‌نام جایگزین می‌کنیم → هر نوشتنی زیر آن ENOTDIR
const serverDir = path.join(ad, ".next/standalone/.next/server");
await fsp.rm(serverDir, { recursive: true });
await fsp.writeFile(serverDir, "I am a file, not a directory\n");
let threw3 = false;
try { await up2.apply(() => {}); } catch { threw3 = true; }
assert(threw3, "apply با انسداد خطا داد");
assert(fs.existsSync(path.join(ad, ".commit-in-progress")), "نشانگر .commit-in-progress ماند (بوت‌استرپ باندل را بوت می‌کند)");
const inst3 = JSON.parse(await fsp.readFile(path.join(ad, ".lexa-install.json"), "utf8"));
assert(inst3.version === "0.5.1", "install.json همان 0.5.1 ماند (ارتقا نیمه‌کاره ثبت نشد)");

console.log("▌ ۴) رفع انسداد → apply دوباره موفق");
await fsp.rm(serverDir);
await fsp.mkdir(serverDir, { recursive: true });
const r4 = await up2.apply(() => {});
assert(r4.ok && r4.version === "0.6.0", "apply پس از رفع انسداد موفق", JSON.stringify(r4));
assert(!fs.existsSync(path.join(ad, ".commit-in-progress")), "نشانگر پاک شد");
assert((await fsp.readFile(path.join(ad, ".next/standalone/.next/server/chunk-2.js"), "utf8")).includes("v0.6.0"), "chunk-2 به 0.6.0 رسید");
const v4 = await up2.verifyLocal();
assert(v4.ok === true, "verifyLocal سبز (0.6.0)");

console.log("▌ ۵) rebuildBase: فایل خرابِ مشترک باندل/ریموت فقط با ترمیم کامل بازمی‌گردد");
// app.css در 0.6.0 هم همان 0.4.0 است (در دلتا نیست) — خرابش می‌کنیم؛
// apply معمولی دلتای خالی می‌بیند و «موفق» برمی‌گردد بدون ترمیم؛
// apply با rebuildBase=true کپی پایهٔ از نو می‌سازد و فایل را زنده می‌کند.
await fsp.writeFile(path.join(ad, ".next/standalone/.next/static/css/app.css"), "CORRUPTED-AGAIN\n");
const r5plain = await up2.apply(() => {});
assert(r5plain.ok === true, "apply معمولی (بدون دلتا) موفق ولی بی‌اثر");
assert((await fsp.readFile(path.join(ad, ".next/standalone/.next/static/css/app.css"), "utf8")).includes("CORRUPTED-AGAIN"), "apply معمولی فایل مشترکِ خراب را ترمیم نکرد (انتظار رفته)");
const v5 = await up2.verifyLocal();
assert(v5.ok === false, "verifyLocal خرابی را نشان می‌دهد");
const r5 = await up2.apply(() => {}, { rebuildBase: true });
assert(r5.ok === true, "apply با rebuildBase موفق");
assert(!(await fsp.readFile(path.join(ad, ".next/standalone/.next/static/css/app.css"), "utf8")).includes("CORRUPTED-AGAIN"), "فایل مشترکِ خراب با ترمیم کامل زنده شد");
const v6 = await up2.verifyLocal();
assert(v6.ok === true, "verifyLocal پس از rebuildBase سبز");

server.close();
await fsp.rm(TMP, { recursive: true, force: true });
console.log(`\nنتیجه: ${passed} سبز / ${failed} سرخ`);
if (failed > 0) process.exit(1);
