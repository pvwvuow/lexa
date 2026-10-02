/* QA جستجوی سراسری در اکسپورت APK — بازتولید «جستجو هیچی نشون نمیده» */
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "out");
const PORT = 3111;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".txt": "text/plain", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon" };

function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split("?")[0]);
      let f = path.join(ROOT, p);
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        // assets استاتیک نکست و مسیرهای SPA → index.html یا 404
        if (fs.existsSync(path.join(ROOT, p, "index.html"))) f = path.join(ROOT, p, "index.html");
        else if (p.startsWith("/api/")) { res.writeHead(404, { "Content-Type": "application/json" }); res.end('{"error":"not-found"}'); return; }
        else f = path.join(ROOT, "index.html");
      }
      const ext = path.extname(f).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(PORT, () => res(srv));
  });
}

(async () => {
  const srv = await serve();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const body0 = await page.evaluate(() => document.body.innerText.slice(0, 200));
  console.log("PAGE:", body0.slice(0, 120).replace(/\n/g, " | "));

  // بازکردن جستجو از نوار هیرو (variant bar) یا آیکون — فقط دکمهٔ «نمایان»
  const allBtns = page.locator('button[aria-label*="جستجو"], button[title*="جستجو"]');
  const n = await allBtns.count();
  console.log("search buttons found:", n);
  let clicked = false;
  for (let i = 0; i < n; i++) {
    const b = allBtns.nth(i);
    if (await b.isVisible().catch(() => false)) {
      await b.click({ timeout: 4000 });
      clicked = true;
      console.log("clicked visible search button #" + i);
      break;
    }
  }
  if (!clicked) {
    console.log("no visible search button — pressing / key");
    await page.keyboard.press("/");
  }
  await page.waitForTimeout(1200);

  // دیالوگ جستجو باز شد؟
  const diag = await page.evaluate(() => ({
    inputs: [...document.querySelectorAll("input")].map((i) => ({ type: i.type, ph: i.placeholder, visible: i.offsetParent !== null })),
    dialogs: document.querySelectorAll('[role="dialog"], [data-state="open"]').length,
    cmdk: document.querySelectorAll("[cmdk-root]").length,
  }));
  console.log("DIAG:", JSON.stringify(diag, null, 1).slice(0, 800));
  await page.screenshot({ path: "qa/qa-search-afterclick.png" });
  const dialogVisible = diag.inputs.some((i) => i.visible && (i.ph || "").includes("جستجو")) || diag.cmdk > 0;
  console.log("search dialog visible:", dialogVisible);
  const input = page.locator('input[placeholder*="جلسه"], input[placeholder*="جستجو"]').first();
  console.log("input count:", await input.count());

  if (await input.count()) {
    await input.fill("مال");
    await page.waitForTimeout(1500);
    const state = await page.evaluate(() => {
      const t = document.body.innerText;
      const dlg = document.querySelector('[role="dialog"]');
      return {
        hasNoResult: /نتیجه‌ای|یافت نشد|پیدا نشد|شروع به تایپ/i.test(t),
        hasResults: !!document.querySelector('[role="option"], [cmdk-item], [role="dialog"] a'),
        optCount: document.querySelectorAll('[cmdk-item], [role="option"], [role="dialog"] a').length,
        snippet: (dlg ? dlg.innerText : t).slice(0, 700),
      };
    });
    console.log("after typing «مال» → options:", state.optCount, "| hasNoResult:", state.hasNoResult, "| hasResults:", state.hasResults);
    console.log("SNIPPET:", state.snippet.slice(0, 400).replace(/\n/g, " | "));
    await page.screenshot({ path: "qa/qa-search-apk.png" });
  }

  console.log("\nERRORS:", errors.length ? "" : "none");
  [...new Set(errors)].slice(0, 8).forEach((e) => console.log(" ⚠", e.slice(0, 200)));
  await browser.close();
  srv.close();
  process.exit(0);
})();
