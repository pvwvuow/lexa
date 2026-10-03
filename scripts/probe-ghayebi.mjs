// پروب درس غایبی (دورهٔ پکیجی) — پایان درس + دکمهٔ بیشتر + بازگشت به فهرست
import { chromium, devices } from "playwright";
const BASE = process.env.BASE || "http://127.0.0.1:3210";
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["Pixel 7"], locale: "fa-IR" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 400)));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push("console: " + m.text().slice(0, 400)); });

await page.goto(BASE + "/#/learn/course-tadris-madani7-ghayebi/ls-md7g-01", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(3000);
await page.waitForSelector("article [data-sec-id]", { timeout: 30000 }).catch(() => {});
console.log("ghayebi lesson rendered:", await page.locator("article [data-sec-id]").count(), "| hash:", await page.evaluate(() => location.hash));

for (let i = 0; i < 40; i++) {
  const btn = page.locator("button:has-text('ادامه بده')");
  if ((await btn.count()) === 0) break;
  await btn.first().tap();
  await page.waitForTimeout(220);
}
let lastY = -1;
for (let i = 0; i < 30; i++) {
  const y = await page.evaluate(() => window.scrollY);
  if (y === lastY) break;
  lastY = y;
  await page.waitForTimeout(180);
}
const more = page.locator("button[aria-label='کنش‌های بیشتر']");
console.log("more count:", await more.count());
if (await more.count()) {
  await more.first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await more.first().tap();
  await page.waitForTimeout(900);
  const st = await page.evaluate(() => {
    const menu = document.querySelector("[role='menu']");
    return { hash: location.hash, menuOpen: !!menu, items: menu ? [...menu.querySelectorAll("[role='menuitem']")].map((i) => i.textContent?.trim().slice(0, 30)) : [] };
  });
  console.log("after tap:", JSON.stringify(st));
  await page.screenshot({ path: "qa/probe-ghayebi-more.png" });
  // تمرین کیس (آیتم atEnd) — مسیر مشکوک «صفحهٔ قبل/خالی»
  const caseItem = page.locator("[role='menuitem']:has-text('تمرین کیس')");
  if (await caseItem.count()) {
    await caseItem.first().tap();
    await page.waitForTimeout(1200);
    const st2 = await page.evaluate(() => ({ hash: location.hash, bodyLen: (document.body.innerText || "").length, h1: document.querySelector("h1,h2")?.textContent?.slice(0, 60) || "" }));
    console.log("after case item:", JSON.stringify(st2));
    await page.screenshot({ path: "qa/probe-ghayebi-case.png" });
    // بازگشت به عقب (مثل کاربر)
    await page.goBack();
    await page.waitForTimeout(1000);
    const st3 = await page.evaluate(() => ({ hash: location.hash, bodyLen: (document.body.innerText || "").length, secs: document.querySelectorAll("article [data-sec-id]").length }));
    console.log("after goBack:", JSON.stringify(st3));
    await page.screenshot({ path: "qa/probe-ghayebi-back.png" });
  }
}
console.log("errors:", errors.length ? errors.slice(0, 6) : "none");
await browser.close();
