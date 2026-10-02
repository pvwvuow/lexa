/* ─── Lexa — بوت‌استرپ الکترون ──────────────────────────────────────────────
 *
 * این فایل عمداً کوچک و پایدار نگه داشته می‌شود: در AppImage، همین فایل از
 * داخل ایمیج فقط-خواندنی اجرا می‌شود؛ اگر آپدیت درون‌برنامه‌ای نسخهٔ جدیدِ
 * منطق اصلی را در «لایهٔ appdata» نصب کرده باشد، از همان‌جا بار می‌شود.
 * در غیر این صورت منطق باندل (main-core.js) اجرا می‌شود.
 *
 *  • appdata معتبر = .lexa-install.json موجود + بدون نشانگرهای ناقص
 *  • اگر نسخهٔ appdata از باندل عقب‌تر باشد (مثلاً کاربر zip جدید نصب کرده)،
 *    باندل ترجیح گرفته می‌شود و appdata در اولین آپدیت بعدی بازسازی می‌شود.
 * ─────────────────────────────────────────────────────────────────────── */

"use strict";

const { app } = require("electron");
const fs = require("fs");
const path = require("path");

app.setName("Lexa");

function cmpVersion(a, b) {
  const pa = String(a || "0").split("-")[0].split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b || "0").split("-")[0].split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0) ? 1 : -1;
  }
  return 0;
}

let overlayCore = null;
try {
  if (app.isPackaged) {
    const ad = path.join(app.getPath("userData"), "appdata");
    const core = path.join(ad, "electron", "main-core.js");
    const inst = path.join(ad, ".lexa-install.json");
    if (fs.existsSync(core) && fs.existsSync(inst)) {
      const clean =
        !fs.existsSync(path.join(ad, ".base-incomplete")) &&
        !fs.existsSync(path.join(ad, ".commit-in-progress"));
      if (clean) {
        let adVersion = "0";
        try {
          adVersion = String(JSON.parse(fs.readFileSync(inst, "utf8")).version || "0");
        } catch {
          /* نصب ناقص — باندل */
        }
        let bundledVersion = "0";
        try {
          bundledVersion = String(
            JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")).version || "0",
          );
        } catch {
          /* باندل بدون package.json — بعید */
        }
        // درِ ساختاری: فایل‌های حیاتی نصب باید واقعاً باشند — اگر یکی غایب است
        // (نصب نیمه‌کاره/خراب‌شده) لایهٔ appdata هرگز بوت نمی‌شود؛ باندل سالم جای آن.
        // (ریشهٔ «Application error: a client-side exception» بعد از آپدیت درون‌برنامه‌ای.)
        const critOk = [
          "package.json",
          "electron/app-updater.js",
          "electron/preload.js",
          ".next/standalone/server.js",
          ".next/standalone/package.json",
          ".next/standalone/.next/BUILD_ID",
        ].every((rel) => fs.existsSync(path.join(ad, rel)));
        if (critOk && cmpVersion(adVersion, bundledVersion) >= 0) overlayCore = core;
      }
    }
  }
} catch {
  /* هر خطایی — منطق باندل */
}

if (overlayCore) {
  console.log("[lexa-boot] overlay main-core:", overlayCore);
  require(overlayCore);
} else {
  console.log("[lexa-boot] bundled main-core, isPackaged:", app.isPackaged, "userData:", (() => { try { return app.getPath("userData"); } catch { return "?"; } })());
  require("./main-core.js");
}
