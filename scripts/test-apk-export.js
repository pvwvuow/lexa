/* اجرای export اندروید (out/) در Chromium و گرفتن خطاهای کنسول/صفحه */
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = process.argv[2] || "/home/z/my-project/out";
const PORT = 4173;

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".webmanifest": "application/manifest+json",
  ".txt": "text/plain", ".md": "text/markdown", ".mp3": "audio/mpeg", ".webp": "image/webp",
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  let fp = path.join(ROOT, p);
  if (fs.existsSync(fp) && fs.statSync(fp).isDirectory()) fp = path.join(fp, "index.html");
  if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
    // شبیه‌سازی اسپا/روتینگ اکسپورت
    const cand = p.replace(/\/$/, "") + ".html";
    if (fs.existsSync(path.join(ROOT, cand))) fp = path.join(ROOT, cand);
    else {
      res.writeHead(404); res.end("not found: " + p); return;
    }
  }
  const ext = path.extname(fp).toLowerCase();
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(fp).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text().slice(0, 500)); });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + String(e).slice(0, 800)));
  page.on("requestfailed", (r) => errors.push("REQFAIL: " + r.url().slice(-80) + " → " + (r.failure() || {}).errorText));
  page.on("response", (r) => { if (r.status() >= 400) errors.push("HTTP" + r.status() + ": " + r.url()); });

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle", timeout: 45000 }).catch((e) => errors.push("GOTO: " + e.message));
  await page.waitForTimeout(4000);

  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 400)).catch(() => "?");
  console.log("=== BODY ===");
  console.log(bodyText);
  console.log("=== ERRORS (" + errors.length + ") ===");
  errors.slice(0, 30).forEach((e) => console.log(e));
  await browser.close();
  server.close();
  process.exit(0);
})();
