#!/usr/bin/env bun
/* ─── Lexa — QA انتها-به-انتهای آپدیت درون‌برنامه‌ای با الکترون واقعی ────────
 *
 *  ۱) ساخت یک «اپ پکیج‌شده» آزمایشی: باینری الکترون + resources/app واقعی
 *     (از linux-unpacked) با کدهای جدید electron/*.js
 *  ۲) فید محلی v0.9.1 با ۲ فایل تغییریافته (main-core.js + package.json)
 *  ۳) اجرا با xvfb + LEXA_UPDATE_QA=1 → چک/اعمال خودکار → ری‌استارت
 *  ۴) نمونهٔ دوم باید از لایهٔ appdata (نسخهٔ جدید) بالا بیاید
 *
 * خروجی موفق: qa-update-result.json با phase=relaunched-from-appdata
 * ─────────────────────────────────────────────────────────────────────── */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const { scanDir, manifestFromScan, sha256File } = require_("../electron/app-updater.js");

const ROOT = "/home/z/my-project";
const TMP = "/tmp/lexa-e2e";
const DIST = path.join(TMP, "dist");
const APPDIR = path.join(DIST, "resources", "app");
const PROFILE = path.join(TMP, "profile");
const FEEDROOT = path.join(TMP, "updates"); // سرو از ریشهٔ TMP مثل URLهای واقعی

const SOURCE_APP = path.join(ROOT, "download/electron/linux-unpacked/resources/app");

async function sh(cmd, opts = {}) {
  const { execSync } = await import("node:child_process");
  execSync(cmd, { stdio: "inherit", cwd: ROOT, ...opts });
}

console.log("── ۱) ساخت اپ پکیج‌شدهٔ آزمایشی ──");
await fsp.rm(TMP, { recursive: true, force: true });
await fsp.mkdir(path.dirname(APPDIR), { recursive: true });
await sh(`mkdir -p "${TMP}" && cp -a "${path.join(ROOT, "node_modules/electron/dist")}/." "${DIST}/"`);
// الکترون اگر باینری «electron» باشد خودش را dev می‌داند (isPackaged=false) — مثل بیلد واقعی به lexa تغییرنام می‌دهیم
await fsp.rename(path.join(DIST, "electron"), path.join(DIST, "lexa"));
console.log("کپی resources/app واقعی (~۱۷۰MB)…");
await sh(`cp -a "${SOURCE_APP}" "${APPDIR}"`);
// کدهای جدید الکترون (نسخهٔ دارای آپدیت‌ر) جایگزین نسخهٔ قدیمی باندل
for (const f of ["main.js", "main-core.js", "preload.js", "app-updater.js"]) {
  await fsp.copyFile(path.join(ROOT, "electron", f), path.join(APPDIR, "electron", f));
}
// شبیه‌سازی «نصب فعلی 0.9.0 روی دستگاه کاربر» — پایه یک نسخه عقب نگه داشته می‌شود
{
  const p = path.join(APPDIR, "package.json");
  const raw = await fsp.readFile(p, "utf8");
  await fsp.writeFile(p, raw.replace(/"version":\s*"[^"]+"/, '"version": "0.9.0"'), "utf8");
}
console.log("✓ آماده");

console.log("\n── ۲) فید محلی v0.9.1 ──");
console.log("اسکن اپ (۲۳۰۰+ فایل)…");
const files = await scanDir(APPDIR);
console.log(`${files.size} فایل`);
const pkgRaw = await fsp.readFile(path.join(APPDIR, "package.json"), "utf8");
const coreRaw = await fsp.readFile(path.join(APPDIR, "electron/main-core.js"), "utf8");

// محتوای «نسخهٔ جدید» دو فایل
const newPkg = pkgRaw.replace(/"version":\s*"[^"]+"/, '"version": "0.9.1"');
if (newPkg === pkgRaw) throw new Error("version در package.json پیدا نشد");
const newCore = coreRaw + "\n// QA-MARKER-0.9.1 — این نسخه از لایهٔ آپدیت اجرا شده است\n";

const mut = [
  { p: "package.json", content: newPkg },
  { p: "electron/main-core.js", content: newCore },
];

const manifest = manifestFromScan(files, {
  version: "0.9.0",
  generatedAt: new Date().toISOString(),
});
const sha256Buf = (b) => createHash("sha256").update(b).digest("hex");

// جایگزینی ورودی دو فایل در مانیفست با هش محتوای جدید
for (const m of mut) {
  const h = sha256Buf(Buffer.from(m.content, "utf8"));
  manifest.files[m.p] = [h, Buffer.byteLength(m.content)];
}
manifest.version = "0.9.1";
manifest.notes = "QA v0.9.1 — دو فایل تغییرکرده";
manifest.tag = "app-v0.9.1";

await fsp.mkdir(path.join(FEEDROOT, "updates/app/f"), { recursive: true });
for (const m of mut) {
  const h = manifest.files[m.p][0];
  await fsp.writeFile(path.join(FEEDROOT, "updates/app/f", h.slice(0, 12) + ".bin"), m.content, "utf8");
}
await fsp.writeFile(path.join(FEEDROOT, "updates/app/manifest.json"), JSON.stringify(manifest));
console.log("✓ فید با ۲ فایل دلتا آماده شد");

// سرور فید
const srv = http.createServer(async (req, res) => {
  const rel = decodeURIComponent((req.url || "").split("?")[0]).replace(/^\/+/, "");
  try {
    const data = await fsp.readFile(path.join(FEEDROOT, rel));
    res.writeHead(200);
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const port = srv.address().port;
console.log(`✓ فید روی 127.0.0.1:${port}`);

console.log("\n── ۳) اجرای الکترون (نمونهٔ اول: چک + اعمال + ری‌استارت) ──");
const resultFile = path.join(PROFILE, "Lexa", "qa-update-result.json");
const env = {
  ...process.env,
  XDG_CONFIG_HOME: PROFILE,
  LEXA_UPDATE_FEED: `http://127.0.0.1:${port}`,
  LEXA_UPDATE_QA: "1",
  LEXA_NO_AUTOCHECK: "1",
  ELECTRON_ENABLE_LOGGING: "1",
};
const child = spawn("sh", ["-c", `mkdir -p /tmp/.X11-unix 2>/dev/null; Xvfb :77 -screen 0 1280x820x24 & sleep 1.5; DISPLAY=:77 "${path.join(DIST, "lexa")}"`], { env, stdio: ["ignore", "pipe", "pipe"] });
let out = "";
child.stdout.on("data", (d) => {
  out += d.toString();
  process.stdout.write(d);
});
child.stderr.on("data", (d) => process.stderr.write(d));

let seenApplied = null;
let finalState = null;
const t0 = Date.now();
while (Date.now() - t0 < 240_000) {
  if (fs.existsSync(resultFile)) {
    try {
      const st = JSON.parse(await fsp.readFile(resultFile, "utf8"));
      if (st.phase === "applied" && !seenApplied) {
        seenApplied = st;
        console.log("\n>>> مرحلهٔ ۱ تأیید شد: آپدیت اعمال شد — منتظر ری‌استارت…");
      }
      if (st.phase === "relaunched-from-appdata") {
        finalState = st;
        break;
      }
      if (st.phase === "error" || st.phase === "check-not-available") {
        finalState = st;
        break;
      }
    } catch { /* نیمه‌نوشته */ }
  }
  await new Promise((r) => setTimeout(r, 700));
}
try {
  child.kill("SIGKILL");
} catch { /* بی‌اثر */ }
srv.close();

let ok = true;
const assert = (cond, label, extra = "") => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${label}${cond ? "" : " " + extra}`);
  if (!cond) ok = false;
};

console.log("\n── ۴) assertions ──");
assert(!!seenApplied, "نمونهٔ اول: آپدیت به 0.9.1 اعمال شد", JSON.stringify(seenApplied));
assert(!!finalState && finalState.phase === "relaunched-from-appdata", "نمونهٔ دوم از لایهٔ appdata بالا آمد", JSON.stringify(finalState));
assert(
  !!finalState && finalState.version === "0.9.1" && String(finalState.appRoot || "").includes("/appdata"),
  "APP_ROOT نمونهٔ دوم = appdata با نسخهٔ 0.9.1",
);
const inst = JSON.parse(await fsp.readFile(path.join(PROFILE, "Lexa/appdata/.lexa-install.json"), "utf8"));
assert(inst.version === "0.9.1", "مانیفست نصب = 0.9.1");
const coreAfter = await fsp.readFile(path.join(PROFILE, "Lexa/appdata/electron/main-core.js"), "utf8");
assert(coreAfter.includes("QA-MARKER-0.9.1"), "main-core داخل appdata نسخهٔ جدید است");
const pkgAfter = JSON.parse(await fsp.readFile(path.join(PROFILE, "Lexa/appdata/package.json"), "utf8"));
assert(pkgAfter.version === "0.9.1", "package.json داخل appdata = 0.9.1");
assert(fs.existsSync(path.join(PROFILE, "Lexa/appdata/.next/standalone/server.js")), "سرور استاندالون داخل appdata کپی شده");

console.log(ok ? "\n🎉 E2E کامل سبز — آپدیت درون‌برنامه‌ای سر-to-سر کار می‌کند" : "\n✗ E2E ناموفق");
console.log(out.includes("[qa]") ? "" : "(لاگ qa در خروجی نبود — بررسی کن)");
process.exit(ok ? 0 : 1);
