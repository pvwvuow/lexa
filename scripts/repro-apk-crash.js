/* بازتولید کرش APK: سروری که مثل کاپاسیتور برای /api/* صفحهٔ 404.html را با status 200 می‌دهد */
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = process.argv[2] || "/home/z/my-project/out";
const PORT = 4174;
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".woff2": "font/woff2", ".txt": "text/plain", ".webmanifest": "application/manifest+json",
};

const notFoundHtml = fs.readFileSync(path.join(ROOT, "404.html"));

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  // ⚠️ شبیه‌سازی رفتار WebViewLocalServer کاپاسیتور: 200 + 404.html
  if (p.startsWith("/api/")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(notFoundHtml);
    return;
  }
  let fp = path.join(ROOT, p);
  if (fs.existsSync(fp) && fs.statSync(fp).isDirectory()) fp = path.join(fp, "index.html");
  if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(notFoundHtml); // کاپاسیتور همین‌طور می‌کند
    return;
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
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(5000);
  const body = await page.evaluate(() => document.body.innerText.slice(0, 120));
  const appErr = body.includes("Application error");
  console.log("errors:", errors.length);
  errors.slice(0, 4).forEach((e) => console.log("  ", e));
  console.log("Application error page:", appErr);
  console.log("VERDICT:", appErr || errors.length ? "💥 CRASH بازتولید شد" : "✓ سالم");
  await browser.close();
  server.close();
  process.exit(0);
})();
