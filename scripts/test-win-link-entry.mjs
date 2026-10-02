#!/usr/bin/env bun
/* ─── Lexa — QA باگ ویندوز: entry باگ‌دار symlink + resume کپی پایه ──────────
 *
 * سناریو ۱ — باگ ویندوز 0.6.0→0.7.0:
 *   روی ویندوز، symlink داخل زیپ به‌صورت «فایل واقعی» استخراج می‌شود (محتوا =
 *   مسیر هدف). مانیفست ریموت همان مسیر را link:… ثبت می‌کند → دیف قبلاً آن را
 *   برای دانلود می‌گذاشت (URL بی‌معنی link:..bin → 404 → شکست کل آپدیت).
 *   الان باید: نه دانلود شود، نه apply را بترکاند؛ آپدیت کامل شود.
 *
 * سناریو ۲ — resume کپی پایه:
 *   appdata با کپی پایهٔ سالم ولی بدون .lexa-install.json (تلاش قبلی حین دانلود
 *   شکسته) → دوباره کپی پایهٔ کامل نباید ساخته شود (بدون فاز base).
 * ─────────────────────────────────────────────────────────────────────── */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const { createUpdater, scanDir, manifestFromScan } = require_("../electron/app-updater.js");

const TMP = path.join("/tmp", `lexa-win-link-qa-${Date.now()}`);
const BASE = path.join(TMP, "base"); // شبیه ویندوز 0.6.0 نصب‌شده
const NEXT = path.join(TMP, "next"); // شبیه بیلد 0.8.0 لینوکسی
const FEED = path.join(TMP, "updates", "app");
const UD = path.join(TMP, "userdata");

let passed = 0, failed = 0;
function assert(cond, label, extra = "") {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.error(`  ✗ ${label} ${extra}`); }
}

const PRISMA_REL = ".next/standalone/.next/node_modules/@prisma/client-2c3a283f134fdcb6";
const LINK_TARGET = "../../../node_modules/@prisma/client";

async function makeBase() {
  const w = async (rel, content) => {
    const p = path.join(BASE, rel);
    await fsp.mkdir(path.dirname(p), { recursive: true });
    await fsp.writeFile(p, content);
  };
  await w("package.json", JSON.stringify({ name: "lexa", version: "0.6.0" }));
  await w("electron/main.js", "// bootstrap v0.6.0\n");
  await w(".next/standalone/server.js", "// server v0.6.0\n" + "s".repeat(500));
  await w(".next/standalone/.next/server/chunk.js", "// chunk v0.6.0\n");
  // ⚠️ ویندوز: symlink به‌صورت فایل واقعی (محتوا = مسیر هدف)
  await w(PRISMA_REL, LINK_TARGET);
}

async function makeNext() {
  await fsp.cp(BASE, NEXT, { recursive: true });
  const w = async (rel, content) => {
    const p = path.join(NEXT, rel);
    await fsp.mkdir(path.dirname(p), { recursive: true });
    await fsp.writeFile(p, content);
  };
  await w("package.json", JSON.stringify({ name: "lexa", version: "0.8.0" }));
  await w(".next/standalone/.next/server/chunk.js", "// chunk v0.8.0\n");
  // لینوکس: symlink واقعی (مثل بیلد لینوکسی)
  await fsp.rm(path.join(NEXT, PRISMA_REL));
  await fsp.mkdir(path.dirname(path.join(NEXT, PRISMA_REL)), { recursive: true });
  await fsp.symlink(LINK_TARGET, path.join(NEXT, PRISMA_REL));
}

async function buildFeed() {
  const files = await scanDir(NEXT);
  const manifest = manifestFromScan(files, { version: "0.8.0", tag: "app-v0.8.0", notes: "qa" });
  await fsp.mkdir(path.join(FEED, "f"), { recursive: true });
  for (const [p, e] of files) {
    if (String(e.h).startsWith("link:")) continue; // مثل استیجر واقعی: لینک محتوا ندارد
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
      try {
        const data = await fsp.readFile(path.join(TMP, rel));
        res.writeHead(200); res.end(data);
      } catch { res.writeHead(404); res.end("nf"); }
    });
    srv.listen(0, "127.0.0.1", () => resolve({ srv, port: srv.address().port }));
  });
}

const fetchLog = [];
console.log("─".repeat(60));
await makeBase();
await makeNext();
await buildFeed();
const { srv, port } = await serveFeed();

console.log("\n[۱] باگ ویندوز — link entry نباید دانلود شود و apply باید کامل شود");
const up = createUpdater({
  baseDir: BASE, userData: UD, pkgVersion: "0.6.0",
  env: { LEXA_UPDATE_FEED: `http://127.0.0.1:${port}` }, log: () => {},
  onFetch: (u) => fetchLog.push("FETCH:" + u),
});
const c = await up.check();
assert(c.available === true, "available = true");
assert(c.filesChanged === 2, `filesChanged = 2 (chunk + package.json) — link شمرده نشد (واقعی: ${c.filesChanged})`);
const badFetch = () => fetchLog.filter((u) => u.includes("link:")).length;
const r = await up.apply(() => {});
assert(r.ok === true && r.version === "0.8.0", "apply موفق به 0.8.0");
assert(badFetch() === 0, "هیچ URL بی‌معنی link: صدا نشد");
const ad = path.join(UD, "appdata");
const linkPath = path.join(ad, PRISMA_REL);
assert(fs.existsSync(linkPath) && !fs.isSymbolicLinkSync?.(linkPath), "فایل جایگزین ویندوزی دست‌نخورده ماند");
assert((await fsp.readFile(path.join(ad, ".next/standalone/.next/server/chunk.js"), "utf8")).includes("v0.8.0"), "chunk جدید اعمال شد");
const inst = JSON.parse(await fsp.readFile(path.join(ad, ".lexa-install.json"), "utf8"));
assert(inst.version === "0.8.0", "مانیفست نصب = 0.8.0");

console.log("\n[۲] resume — کپی پایهٔ سالم بدون نشان نصب دوباره کپی نمی‌شود");
// appdata را به «کپی پایهٔ سالم بدون نشان» برگردان: نصب را پاک کن ولی فایل‌ها بمانند
await fsp.rm(path.join(ad, ".lexa-install.json"));
await fsp.rm(path.join(ad, ".staging"), { recursive: true, force: true });
// محتوای appdata الان همان باندل قدیمی (0.6.0) است — مثل تلاش قبلی که در دانلود مرده
const up2 = createUpdater({
  baseDir: BASE, userData: UD, pkgVersion: "0.6.0",
  env: { LEXA_UPDATE_FEED: `http://127.0.0.1:${port}` }, log: () => {},
  onFetch: (u) => fetchLog.push("FETCH:" + u),
});
assert((await up2.hasUsableBase(ad)) === true, "hasUsableBase = true");
const events = [];
const r2 = await up2.apply((e) => events.push(e));
assert(r2.ok === true, "apply موفق (ادامهٔ دلتا)");
const phases = [...new Set(events.map((e) => e.phase))];
assert(!phases.includes("base"), `فاز base نبود — کپی پایه تکرار نشد (فازها: ${phases.join("→")})`);
assert((await fsp.readFile(path.join(ad, ".next/standalone/.next/server/chunk.js"), "utf8")).includes("v0.8.0"), "دوباره به 0.8.0 رسید");

console.log("\n[۳] appdata با commit نیمه‌کاره — usable نیست (ایمنی)");
await fsp.writeFile(path.join(ad, ".commit-in-progress"), "x");
assert((await up2.hasUsableBase(ad)) === false, "commit-in-progress → false");

srv.close();
console.log("─".repeat(60));
console.log(`نتیجه: ${passed} ✓ / ${failed} ✗`);
if (failed) process.exit(1);
console.log("همهٔ تست‌های باگ ویندوز سبز شدند");
