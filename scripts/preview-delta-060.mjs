#!/usr/bin/env bun
/* پیش‌نمایش فقط-خواندنی دلتای 0.6.0 نسبت به مانیفست مرجع — بدون نوشتن هیچ فایلی */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require_ = createRequire(import.meta.url);
const { scanDir, filesMap } = require_("../electron/app-updater.js");

const dir = "download/electron/win-unpacked/resources/app";
const prev = JSON.parse(fs.readFileSync("updates/app/manifest.json", "utf8"));
console.log("prev manifest:", prev.version, `(${Object.keys(prev.files).length} فایل)`);

const files = await scanDir(dir);
const prevFiles = filesMap(prev);
let changed = [], added = [], same = 0, bytes = 0;
for (const [p, e] of files) {
  const old = prevFiles.get(p);
  if (!old) added.push(e);
  else if (old.h !== e.h) changed.push(e);
  else same++;
  if (!old || old.h !== e.h) { bytes += e.s; }
}
const removed = [...prevFiles.keys()].filter((p) => !files.has(p));
const mb = (n) => (n / 1048576).toFixed(2) + " MB";
console.log(`تغییرکرده: ${changed.length} (${mb(changed.reduce((a, e) => a + e.s, 0))})`);
console.log(`جدید: ${added.length} (${mb(added.reduce((a, e) => a + e.s, 0))})`);
console.log(`حذف‌شده: ${removed.length}`);
console.log(`بدون تغییر: ${same}`);
console.log(`جمع دلتا برای دانلود: ${changed.length + added.length} فایل — ${mb(bytes)}`);
const big = [...changed, ...added].filter((e) => e.s > 19 * 1024 * 1024);
if (big.length) { console.log("⚠ فایل‌های >۱۹MB:"); for (const b of big) console.log("  ", b.p, mb(b.s)); }
const top = [...changed, ...added].sort((a, b) => b.s - a.s).slice(0, 12);
console.log("بزرگ‌ترین‌ها:"); for (const t of top) console.log("  ", mb(t.s), t.p);
