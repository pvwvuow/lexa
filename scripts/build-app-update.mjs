#!/usr/bin/env bun
/* ─── Lexa — ساخت مانیفست به‌روزرسانی دلتا + آماده‌سازی فایل‌های تغییریافته ──
 *
 * هر ریلیز، بعد از بیلد (bun run electron:build) این اسکریپت اجرا می‌شود:
 *
 *   bun scripts/build-app-update.mjs \
 *     --dir download/electron/win-unpacked/resources/app \
 *     --version 0.5.1 --tag app-v0.5.1 \
 *     --notes "یادداشت انتشار..." \
 *     --prev updates/app/manifest.json --stage
 *
 * کارها:
 *   ۱) اسکن + هش sha256 کل اپ (بدون cache/متون برخط)
 *   ۲) نوشتن updates/app/manifest.json (نسخهٔ جدید + تاریخچهٔ انتشارها)
 *   ۳) با --prev: فایل‌های تغییریافته/جدید به‌صورت محو content-addressed در
 *      updates/app/f/<sha12>.bin کپی می‌شوند (دلتایی که کاربر دانلود می‌کند)
 *
 * خروجی‌ها با git push به مخزن می‌روند؛ کاربران از طریق jsDelivr می‌گیرند.
 * ─────────────────────────────────────────────────────────────────────── */

import { createRequire } from "node:module";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const require_ = createRequire(import.meta.url);
const { scanDir, manifestFromScan, filesMap, cmpVersion } = require_("../electron/app-updater.js");

/* ─── آرگومان‌ها ──────────────────────────────────────────────────────────── */

function arg(name, def = undefined) {
  const i = process.argv.indexOf("--" + name);
  if (i === -1) return def;
  return process.argv[i + 1] ?? "";
}
const has = (name) => process.argv.includes("--" + name);

const dir = arg("dir", "download/electron/win-unpacked/resources/app");
const version = arg("version", "");
const tag = arg("tag", version ? `app-v${version}` : "");
const notes = arg("notes", "");
const prevPath = arg("prev", "");
const outDir = arg("out", "updates/app");
const stage = has("stage");

if (!version) {
  console.error("خطا: --version الزامی است");
  process.exit(1);
}
if (!fs.existsSync(path.join(dir, "package.json")) || !fs.existsSync(path.join(dir, ".next", "standalone"))) {
  console.error(`خطا: «${dir}» یک اپ بیلدشده نیست (package.json یا .next/standalone ندارد)`);
  process.exit(1);
}

/* ─── اسکن ───────────────────────────────────────────────────────────────── */

console.log(`اسکن «${dir}» …`);
const t0 = Date.now();
const files = await scanDir(dir);
let totalBytes = 0;
for (const e of files.values()) totalBytes += e.s;
console.log(
  `${files.size} فایل، ${(totalBytes / 1048576).toFixed(1)} مگابایت — در ${((Date.now() - t0) / 1000).toFixed(1)}s`,
);

/* ─── نسخهٔ قبلی + تاریخچه ───────────────────────────────────────────────── */

let prev = null;
if (prevPath && fs.existsSync(prevPath)) {
  prev = JSON.parse(fs.readFileSync(prevPath, "utf8"));
  if (cmpVersion(version, prev.version) <= 0) {
    console.error(`خطا: نسخهٔ جدید (${version}) باید از قبلی (${prev.version}) بزرگ‌تر باشد`);
    process.exit(1);
  }
}

const history = prev
  ? [{ version: prev.version, date: prev.generatedAt, notes: prev.notes || "" }, ...(prev.history || [])].slice(0, 6)
  : [];

const manifest = manifestFromScan(files, { version, tag, notes, generatedAt: new Date().toISOString(), history });

/* ─── دلتا: فایل‌های تغییریافته ──────────────────────────────────────────── */

let changed = [];
if (prev) {
  const prevFiles = filesMap(prev);
  for (const [p, e] of files) {
    const old = prevFiles.get(p);
    if (!old || old.h !== e.h) changed.push({ p, h: e.h, s: e.s });
  }
  const removed = [...prevFiles.keys()].filter((p) => !files.has(p));
  console.log(`\nدلتا نسبت به ${prev.version}:`);
  console.log(`  • تغییرکرده/جدید: ${changed.length} فایل — ${(changed.reduce((a, e) => a + e.s, 0) / 1048576).toFixed(2)} MB`);
  console.log(`  • حذف‌شده: ${removed.length} فایل`);
  if (removed.length) console.log("    " + removed.slice(0, 10).join("\n    ") + (removed.length > 10 ? "\n    …" : ""));
} else {
  console.log("\n(بدون --prev — مانیفست مرجع بدون دلتا)");
}

/* ─── نوشتن خروجی‌ها ─────────────────────────────────────────────────────── */

await fsp.mkdir(path.join(outDir, "f"), { recursive: true });
await fsp.writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest));
console.log(`\n✓ ${outDir}/manifest.json نوشته شد (${(JSON.stringify(manifest).length / 1024).toFixed(0)} KB)`);

if (stage && prev) {
  const fDir = path.join(outDir, "f");
  let staged = 0;
  let stagedBytes = 0;
  let skipped = 0;
  const big = [];
  for (const e of changed) {
    if (String(e.h).startsWith("link:")) continue;
    const h12 = String(e.h).slice(0, 12);
    const dest = path.join(fDir, h12 + ".bin");
    if (!fs.existsSync(dest)) {
      await fsp.copyFile(path.join(dir, e.p), dest);
      staged += 1;
      stagedBytes += e.s;
    } else {
      skipped += 1;
    }
    if (e.s > 19 * 1024 * 1024) big.push(e.p);
  }
  console.log(
    `✓ فایل‌های دلتا: ${staged} جدید در updates/app/f/ (${(stagedBytes / 1048576).toFixed(2)} MB) — ${skipped} تکراری رد شد`,
  );
  if (big.length) {
    console.warn("\n⚠ این فایل‌ها از ۱۹MB بزرگ‌ترند (سقف jsDelivr) — برایشان جای انتشار دیگری لازم است:");
    for (const b of big) console.warn("   " + b);
  }
}

/* ─── گام‌های بعدی ───────────────────────────────────────────────────────── */

console.log(`
گام‌های انتشار:
  ۱) version package.json باید دقیقاً «${version}» باشد (bun run electron:build قبل از این اسکریپت)
  ۲) git add ${outDir} && git commit -m "app update ${version}" && git push origin main
  ۳) git tag ${tag} && git push origin ${tag}      ← فایل‌های دلتا از این تگ سرو می‌شوند
  ۴) ریلیز گیت‌هاب v${version} با آپلود AppImage/zip کامل (برای نصب‌های جدید)
`);
