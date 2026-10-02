/* شبیه‌سازی زنده: کلاینت 0.6.0 با منطق جدید چندمنبعی — check() باید 0.7.0 را ببیند */
const { createRequire } = require("node:module");
const req_ = createRequire(__filename);
const { createUpdater } = req_("/home/z/my-project/electron/app-updater.js");

const TMP = "/tmp/lexa-live-check-" + Date.now();
require("node:fs").mkdirSync(TMP, { recursive: true });

const up = createUpdater({
  baseDir: TMP, // اسکن خالی — همه چیز «برای دانلود»
  userData: TMP,
  pkgVersion: "0.6.0",
  env: {}, // بدون فید آزمایشی — منابع واقعی
  log: (...a) => console.log("  [log]", ...a),
});

(async () => {
  const t0 = Date.now();
  const c = await up.check();
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`check took ${dt}s`);
  console.log("available:", c.available);
  console.log("currentVersion:", c.currentVersion, "→ remoteVersion:", c.remoteVersion);
  console.log("tag:", c.tag, "| filesChanged:", c.filesChanged, "| deletes:", c.deletes);
  console.log("bytesChanged:", (c.bytesChanged / 1e6).toFixed(1), "MB");
  if (c.remoteVersion === "0.8.0" && c.available) {
    console.log("VERDICT: ✓ کلاینت 0.6.0 نسخهٔ 0.8.0 را می‌بیند (چندمنبعی کار می‌کند)");
  } else {
    console.log("VERDICT: ✗ مشکل!");
    process.exit(1);
  }
})();
