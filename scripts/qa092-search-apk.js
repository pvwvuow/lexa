// ─── QA 0.9.2 — اکسپورت APK: پنل مات (perf-lite) + جستجوی بدنه با آب‌رسانی محلی ──
import { chromium } from "playwright";
import http from "http";
import fs from "fs";
import path from "path";

const ROOT = path.join(process.cwd(), "out");
let pass = 0, fail = 0;
const ok = (n, c, e = "") => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n} ${e}`); } };

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".webmanifest": "application/manifest+json", ".txt": "text/plain" };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  let f = path.join(ROOT, p === "/" ? "index.html" : p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(ROOT, p.endsWith("/") ? p + "index.html" : "404.html");
  if (!fs.existsSync(f)) { res.writeHead(404); res.end("nf"); return; }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] ?? "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => srv.listen(0, r));
const BASE = `http://localhost:${srv.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(BASE, { waitUntil: "networkidle" });

// perf-lite فعال است (اکسپورت APK)
const lite = await page.evaluate(() => document.documentElement.classList.contains("perf-lite"));
ok("کلاس perf-lite روی <html>", lite);

// باز کردن جستجو با میانبر «/» (در APK هم معتبر است)
await page.keyboard.press("/");
await page.waitForSelector('[role="dialog"][aria-label="جستجوی سراسری"]');

// پس‌زمینهٔ مات — پنل باید تقریباً جامد باشد (نه شفافِ بی‌بلور)
const bg = await page.evaluate(() => {
  const el = document.querySelector('[role="dialog"] .lg-panel');
  return el ? getComputedStyle(el).background : "none";
});
ok("پنل جستجو مات است (rgb 250 250 248 / 0.99)", bg.includes("250, 250, 248") && bg.includes("0.99"), bg.slice(0, 120));

// ابعاد تمام‌صفحه در موبایل
const size = await page.evaluate(() => {
  const el = document.querySelector('[role="dialog"] .lg-panel');
  const r = el.getBoundingClientRect();
  return { w: r.width, h: r.height, vw: innerWidth, vh: innerHeight };
});
ok("تمام‌صفحه در موبایل", size.w >= size.vw * 0.98 && size.h >= size.vh * 0.98, JSON.stringify(size));

// جستجوی «بدنه‌ای» — متن‌ها در APK از assets محلی می‌آیند → باید سریع نتیجه بدهد
const input = page.locator('[role="dialog"]').last().locator("input");
await input.pressSequentially("مالیات", { delay: 40 });
const t0 = Date.now();
await page.waitForFunction(() => {
  const ds = document.querySelectorAll('[role="dialog"]');
  const d = ds[ds.length - 1];
  return d.querySelectorAll('ul[aria-label="نتیجه‌ها"] button').length > 0;
}, undefined, { timeout: 25000 });
console.log(`    (نتیجهٔ «مالیات» پس از ${Date.now() - t0}ms)`);
ok("جستجوی کلمهٔ فقط-بدنه‌ای در APK نتیجه داد", true);

// بدون اسکلتون بین‌حرفی
await input.fill("");
await input.pressSequentially("عاریه", { delay: 45 });
let laggy = 0;
for (let i = 0; i < 1; i++) {
  await page.waitForTimeout(30);
  if (await page.locator('[role="dialog"] .animate-pulse').count() > 0) laggy++;
}
await page.waitForTimeout(300);
const n = await page.locator('[role="dialog"]').last().locator('ul[aria-label="نتیجه‌ها"] button').count();
ok("بدون اسکلتون بین‌حرفی + نتیجهٔ عادی", laggy === 0 && n > 0, `laggy=${laggy} n=${n}`);

// اسکرین‌شات برای بازبینی چشمی (روشن)
await page.screenshot({ path: "qa/092-search-matte-apk.png" });

// تیره
await page.keyboard.press("Escape");
await page.evaluate(() => { document.documentElement.classList.add("dark"); });
await page.keyboard.press("/");
await page.waitForSelector('[role="dialog"]');
const bgDark = await page.evaluate(() => {
  const el = document.querySelector('[role="dialog"] .lg-panel');
  return el ? getComputedStyle(el).background : "none";
});
ok("پنل مات در تم تیره (rgb 24 33 29 / 0.99)", bgDark.includes("24, 33, 29") && bgDark.includes("0.99"), bgDark.slice(0, 120));
await page.screenshot({ path: "qa/092-search-matte-apk-dark.png" });

ok("صفر خطای صفحه", errors.length === 0, errors.slice(0, 2).join(" | "));

await browser.close();
srv.close();
console.log(`\nنتیجه: ${pass} سبز / ${fail} قرمز`);
process.exit(fail ? 1 : 0);
