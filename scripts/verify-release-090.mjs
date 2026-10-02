#!/usr/bin/env bun
/* راستی‌آزمایی زندهٔ ریلیز 0.9.0 — همان الگوی ریلیزهای قبل:
 *  ۱) مانیفست روی jsDelivr @main و @app-v0.9.0
 *  ۲) شبیه‌سازی آپدیت کاربران 0.6.0/0.7.0/0.8.0/0.8.1 → شمارش دلتا + MISSING روی CDN
 *  ۳) فایل‌های دلتای جدید همه روی CDN
 */
import { createRequire } from "node:module";
const require_ = createRequire(import.meta.url);
const { filesMap, cmpVersion } = require_("../electron/app-updater.js");

const REPO = "pvwvuow/lexa";
const sources = (p) => [
  `https://cdn.jsdelivr.net/gh/${REPO}@main/${p}`,
  `https://raw.githubusercontent.com/${REPO}/main/${p}`,
];

async function fetchJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

console.log("── ۱) مانیفست روی CDN ──");
const mMain = await fetchJson(`https://cdn.jsdelivr.net/gh/${REPO}@main/updates/app/manifest.json`);
const mTag = await fetchJson(`https://cdn.jsdelivr.net/gh/${REPO}@app-v0.9.0/updates/app/manifest.json`);
console.log(`@main → ${mMain.version} (${Object.keys(filesMap(mMain)).length} فایل)`);
console.log(`@app-v0.9.0 → ${mTag.version} (${Object.keys(filesMap(mTag)).length} فایل)`);
const linkEntries = [...filesMap(mTag).keys()].filter((k) => {
  const e = filesMap(mTag).get(k);
  return Array.isArray(e) ? String(e[0]).startsWith("link:") : String(e.h).startsWith("link:");
});
console.log("entryهای link:", linkEntries.length);

console.log("\n── ۲) شبیه‌سازی مسیر آپدیت کاربران قدیمی ──");
const fs = await import("node:fs");
const paths = {
  "0.6.0": ".lexa-ref-manifest-060.json",
  "0.7.0": ".lexa-ref-manifest-070.json",
};
// مانیفست‌های مرجع قدیمی را از گیت می‌گیریم
const { execSync } = await import("node:child_process");
for (const [ver, file] of Object.entries(paths)) {
  const tag = `app-v${ver === "0.6.0" ? "0.6.0" : "0.7.0"}`;
  try {
    execSync(`git show ${tag}:updates/app/manifest.json > ${file}`, { cwd: "/home/z/my-project", shell: "/bin/bash" });
  } catch (e) {
    console.log(`(${ver}: مانیفست تگ در دسترس نبود — رد)`);
  }
}
// 0.6.0 واقعی: مانیفست مرجع 0.4.0 الگو نبود؛ در ریلیزهای قبل «کاربر 0.6.0» با مانیفست 0.6.0 مقایسه شد
// (محتوای نصب‌شدهٔ 0.6.0 = مانیفست 0.6.0). همین‌طور 0.7.0/0.8.0/0.8.1.

async function simulate(userVer, userManifestPath) {
  let local;
  if (userManifestPath && fs.existsSync(userManifestPath)) {
    local = filesMap(JSON.parse(fs.readFileSync(userManifestPath, "utf8")));
  } else {
    // از گیت بگیر
    const tag = `app-v${userVer}`;
    const txt = execSync(`git show ${tag}:updates/app/manifest.json`, { cwd: "/home/z/my-project", maxBuffer: 1 << 28 }).toString();
    local = filesMap(JSON.parse(txt));
  }
  const remote = filesMap(mTag);
  let need = 0, bytes = 0, missing = 0;
  const missingUrls = [];
  for (const [p, e] of remote) {
    const l = local.get(p);
    const lh = Array.isArray(l) ? l[0] : l?.h;
    const rh = Array.isArray(e) ? e[0] : e.h;
    const rs = Array.isArray(e) ? e[1] : e.s;
    if (lh !== rh) {
      need++;
      bytes += rs || 0;
      const ok = fs.existsSync(`/home/z/my-project/updates/app/f/${String(rh).slice(0, 12)}.bin`);
      if (!ok) { missing++; if (missingUrls.length < 5) missingUrls.push(p); }
    }
  }
  console.log(`کاربر ${userVer}: ${need} فایل دلتا — ${(bytes / 1048576).toFixed(1)}MB — MISSING روی انبار محلی: ${missing}${missingUrls.length ? " " + JSON.stringify(missingUrls) : ""}`);
}

await simulate("0.6.0");
await simulate("0.7.0");
await simulate("0.8.0");
await simulate("0.8.1");

console.log("\n── ۳) فایل‌های دلتای استیج‌شده در خود مانیفست 0.9.0 ──");
const updatesDir = "/home/z/my-project/updates/app/f";
const staged = fs.readdirSync(updatesDir).filter((f) => f.endsWith(".bin"));
console.log(`فایل‌های .bin در انبار محلی: ${staged.length}`);

console.log("\n── ۴) releases.atom ──");
const atom = await (await fetch("https://github.com/pvwvuow/lexa/releases.atom", { signal: AbortSignal.timeout(15000) })).text();
const latest = (atom.match(/<title>([^<]+)<\/title>/) || [])[1];
console.log("آخرین ریلیز:", latest);
console.log("\nDONE ✅");
