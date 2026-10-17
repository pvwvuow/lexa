// ─── afterPack: کپی پیلود استاندالون به resources/app ────────────────────────
// electron-builder 26 در فایل‌کپی خودش پوشه‌های نقطه‌دار (.next) و node_modules
// را از extraResources حذف می‌کند؛ پس کپی نهایی را خودمان با fs.cpSync انجام
// می‌دهیم — کامل، با حفظ نقطه‌ها. منبع: .next/electron-stage (ساختهٔ
// scripts/stage-electron-app.sh — همان استثناهای امنیتی قبلی).
const fs = require("fs");
const path = require("path");

exports.default = async function afterPack(context) {
  const projectDir = path.resolve(__dirname, "..");
  const src = path.join(projectDir, ".next", "electron-stage");
  const dst = path.join(context.appOutDir, "resources", "app", ".next", "standalone");
  if (!fs.existsSync(path.join(src, "server.js"))) {
    throw new Error("electron-stage خالی است — اول scripts/stage-electron-app.sh را اجرا کن");
  }
  fs.rmSync(dst, { recursive: true, force: true });
  fs.cpSync(src, dst, { recursive: true, verbatimSymlinks: false });
  // درِ ساختاری — همان فهرست electron/main.js
  const crit = ["server.js", "package.json", ".next/BUILD_ID", ".next/static", "node_modules"];
  for (const rel of crit) {
    if (!fs.existsSync(path.join(dst, rel))) throw new Error(`afterPack: ${rel} در پیلود نیست`);
  }
  console.log(`  • afterPack: standalone payload → ${dst} (${(fs.statSync(dst).size / 1048576).toFixed(0)}MB+)`);
};
