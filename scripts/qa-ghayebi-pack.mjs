#!/usr/bin/env node
/* ─── QA بستهٔ غایبی v1.0.3 + نشانگر به‌روزرسانی سرتیتر ────────────────────────
 * نکتهٔ محیطی: سرور standalone فهرست فایل‌های public را در بوت اسنپ‌شات می‌کند؛
 * پس هر سناریو سرور خودش را با استیجِ همان نسخه بوت می‌کند (پورت مجزا).
 *   سناریو ۱ (نصب خودکار): مانیفست 1.1.1 از بوت → بسته ۱.۰.۳ بی‌صدا نصب →
 *          GoalSheet رندر + فیکس «راهن» + صفر خطا
 *   سناریو ۲ (نشانگر): نصب‌خودکار خاموش + بستهٔ ۱.۰.۲ کاشته‌شده + مانیفست 1.1.0 در بوت
 *          → سوییچ به 1.1.1 (ری‌استارت سرور با مسیرهای همسان — محتوای نو)
 *          → نشانگر روی سرتیتر → نصب فوری → پنل «تازه‌ها» → محتوا نو
 * ──────────────────────────────────────────────────────────────────────────── */
import { chromium } from "playwright";
import fs from "node:fs";
import { spawn } from "node:child_process";

const STAGE = "/tmp/qa-updates";
const PUB_UPD = "/home/z/my-project/.next/standalone/public/updates";
const STANDALONE = "/home/z/my-project/.next/standalone";

let pass = 0, fail = 0;
const netNoise = [];
function ok(cond, name, extra = "") {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { fail++; console.log("  ✗ " + name + (extra ? "  [" + extra.slice(0, 220) + "]" : "")); }
}
function wireErrors(page, errors) {
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + String(e).slice(0, 200)));
  page.on("console", (m) => {
    const t = m.text();
    if (m.type() !== "error") return;
    if (/ERR_FAILED|ERR_ABORTED|jsdelivr|raw\.githubusercontent/.test(t)) return; // مسدودسازی عمدی CDN
    if (/status of 404/.test(t)) { netNoise.push("console-404"); return; } // جداگانه با URL ثبت می‌شود
    errors.push(t.slice(0, 160));
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && !/jsdelivr|raw\.github/.test(r.url()) && !/\/api\/tcourses/.test(r.url()))
      netNoise.push(r.status() + " " + r.url().slice(0, 110));
  });
}
const stage = (v) => {
  fs.rmSync(PUB_UPD, { recursive: true, force: true });
  fs.cpSync(`${STAGE}/${v}`, PUB_UPD, { recursive: true });
};
let server = null;
async function startServer(port) {
  server = spawn("node", ["server.js"], {
    cwd: STANDALONE,
    env: { ...process.env, NODE_ENV: "production", PORT: String(port), HOSTNAME: "127.0.0.1" },
    stdio: "ignore",
  });
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/`);
      if (r.ok || r.status === 307) return;
    } catch { /* هنوز بالا نیامده */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("سرور بالا نیامد: " + port);
}
function stopServer() {
  if (server) { try { server.kill("SIGKILL"); } catch {} server = null; }
}

const browser = await chromium.launch();

/* ═══ سناریو ۱ — نصب خودکار بستهٔ ۱.۰.۳ + رندر GoalSheet ═══ */
console.log("── سناریو ۱: نصب خودکار + GoalSheet ──");
{
  stage("v111");
  await startServer(3211);
  const BASE = "http://127.0.0.1:3211";
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(/jsdelivr|raw\.githubusercontent/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  wireErrors(page, errors);
  await page.goto(BASE + "/#/course/course-tadris-madani7-ghayebi", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1:has-text('تدریس مدنی ۷')", { timeout: 30000 }).catch(() => {});
  const title = await page.locator("h1").first().textContent().catch(() => "");
  ok((title ?? "").includes("تدریس مدنی ۷"), "بسته به‌صورت خودکار نصب و دوره ساخته شد", String(title));

  await page.locator("button[aria-expanded]", { hasText: "جلسهٔ ۱" }).first().click().catch(() => {});
  await page.locator("button", { hasText: "نقشهٔ مدنی ۷" }).first().click().catch(() => {});
  await page.waitForSelector("article", { timeout: 15000 }).catch(() => {});

  const goalPanel = await page.locator("article p:has-text('در پایان این جلسه باید بتوانی')").count();
  ok(goalPanel >= 1, "سربرگ پنل اهداف رندر شد");
  const roundel = await page.locator("article ul li span:has-text('۱')").count();
  ok(roundel >= 1, "مدال شمارهٔ هدف (۱) رندر شد");
  const inlineOld = await page.getByText("بتوانی: (۱)").count();
  ok(inlineOld === 0, "چیدمان فشردهٔ قدیمی حذف شد");
  const tashdid = await page.getByText("عقد معیّن را از نامعیّن تشخیص دهی").count();
  ok(tashdid >= 1, "متن هدف با تشدید یکدست («معیّن/نامییّن»)");
  const rahn = await page.getByText("راهن").count();
  ok(rahn >= 1, "غلط «مرحن → راهن» فیکس شد", "تعداد: " + rahn);

  await page.screenshot({ path: "qa/ghayebi-goalsheet.png" });
  ok(errors.length === 0, "صفر خطای کنسول", errors.join(" | "));
  await ctx.close();
  stopServer();
}

/* ═══ سناریو ۲ — نشانگر به‌روزرسانی روی سرتیتر + نصب فوری ═══ */
console.log("── سناریو ۲: نشانگر به‌روزرسانی + نصب فوری ──");
{
  stage("v110");
  await startServer(3212);
  const BASE = "http://127.0.0.1:3212";
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(/jsdelivr|raw\.githubusercontent/, (r) => r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem("lexa-auto-packs", "off"); } catch {} });
  const page = await ctx.newPage();
  const errors = [];
  wireErrors(page, errors);

  // ۱) بار اول — کاشتن بستهٔ نصب‌شدهٔ ۱.۰.۲ در IndexedDB
  await page.goto(BASE + "/#/course/course-tadris-madani7-ghayebi", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.evaluate(async () => {
    const meta = await (await fetch("/updates/manifest.json")).json();
    const gh = meta.packs.find((p) => p.id === "content-pack-tadris-madani7-ghayebi-01");
    const file = await (await fetch("/updates/" + gh.file.replace(/^\/+/, ""))).json();
    const payload = file.payload;
    const rec = { meta: gh, contentId: payload.id, payload, installedAt: new Date().toISOString() };
    await new Promise((res, rej) => {
      const rq = indexedDB.open("lexa-content-db", 1);
      rq.onupgradeneeded = () => { if (!rq.result.objectStoreNames.contains("lexa-content-packs")) rq.result.createObjectStore("lexa-content-packs", { keyPath: "meta.id" }); };
      rq.onsuccess = () => {
        const db = rq.result;
        const tx = db.transaction("lexa-content-packs", "readwrite");
        tx.objectStore("lexa-content-packs").put(rec);
        tx.oncomplete = () => { db.close(); res(); };
        tx.onerror = () => rej(tx.error);
      };
      rq.onerror = () => rej(rq.error);
    });
  }).catch((e) => console.log("  (seed warn)", String(e).slice(0, 140)));

  // ۲) بار دوم — دورهٔ ۱.۰.۲ از IndexedDB
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1:has-text('تدریس مدنی ۷')", { timeout: 30000 }).catch(() => {});
  await page.locator("button[aria-expanded]", { hasText: "جلسهٔ ۱" }).first().click().catch(() => {});
  await page.locator("button", { hasText: "نقشهٔ مدنی ۷" }).first().click().catch(() => {});
  await page.waitForSelector("article", { timeout: 15000 }).catch(() => {});
  const oldInline = await page.getByText("بتوانی: (۱)").count();
  ok(oldInline >= 1, "نسخهٔ ۱.۰.۲ (چیدمان قدیمی) در حال نمایش است");
  const oldTypo = await page.getByText("مرحن").count();
  ok(oldTypo >= 1, "غلط «مرحن» در نسخهٔ ۱.۰.۲ موجود است");

  // ۳) سوییچ مانیفست به 1.1.1 — محتوای همان مسیرها (ری‌استارت سرور؛ صفحه و IndexedDB می‌مانند)
  stage("v111");
  stopServer();
  await startServer(3212);
  // خروج کامل از سند (ریست ماژول‌ها) + ورود دوباره مستقیم به صفحهٔ کتاب
  await page.goto("about:blank");
  await page.goto(BASE + "/#/course/course-tadris-madani7-ghayebi", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1:has-text('تدریس مدنی ۷')", { timeout: 30000 }).catch(() => {});
  const badge = page.getByText("به‌روزرسانی جدید این کتاب آمده است");
  await badge.first().waitFor({ timeout: 20000 }).catch(() => {});
  ok(await badge.count() >= 1, "نشانگر «به‌روزرسانی جدید» روی سرتیتر کتاب آمد");
  const ver = await page.getByText("نسخهٔ ۱.۰.۳").count();
  ok(ver >= 1, "شمارهٔ نسخهٔ جدید (۱.۰.۳) روی نشانگر");
  await page.screenshot({ path: "qa/ghayebi-update-badge.png" });

  // ۴) نصب فوری همان‌جا
  await page.getByRole("button", { name: "به‌روزرسانی کن" }).click().catch(() => {});
  const done = page.getByText("به‌روزرسانی نصب شد — تازه‌های این نسخه");
  await done.first().waitFor({ timeout: 20000 }).catch(() => {});
  ok(await done.count() >= 1, "پنل «تازه‌های این نسخه» پس از نصب آمد");
  ok((await badge.count()) === 0, "نشانگر پس از نصب حذف شد");
  await page.screenshot({ path: "qa/ghayebi-update-done.png" });

  // ۵) محتوای نو همان‌جا (بدون آپدیت اپ)
  await page.locator("button[aria-expanded]", { hasText: "جلسهٔ ۱" }).first().click().catch(() => {});
  await page.locator("button", { hasText: "نقشهٔ مدنی ۷" }).first().click().catch(() => {});
  await page.waitForSelector("article", { timeout: 15000 }).catch(() => {});
  const newInline = await page.getByText("بتوانی: (۱)").count();
  ok(newInline === 0, "چیدمان قدیمی بعد از به‌روزرسانی نیست");
  const rahn2 = await page.getByText("راهن").count();
  ok(rahn2 >= 1, "غلط «مرحن → راهن» در محتوای تازه فیکس شد");
  const goals2 = await page.locator("article p:has-text('در پایان این جلسه باید بتوانی')").count();
  ok(goals2 >= 1, "پنل اهداف در محتوای تازه رندر شد");
  ok(errors.length === 0, "صفر خطای کنسول", errors.join(" | "));
  await ctx.close();
  stopServer();
}

await browser.close();
console.log("──────────────────────────────────");
if (netNoise.length) console.log("نویز شبکه (۴xx):", [...new Set(netNoise)].slice(0, 6));
console.log(`نتیجه: ${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
