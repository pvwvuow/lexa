// پروب APK-استاتیک: درس غایبی + بیشتر + مقصدهای منو (بازگشت به فهرست / تمرین کیس)
import { chromium, devices } from "playwright";
const BASE = process.env.BASE || "http://127.0.0.1:3211";
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["Pixel 7"], locale: "fa-IR" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 300)));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push("console: " + m.text().slice(0, 300)); });

// صبر برای نصب خودکار پکیج: اول خانه
await page.goto(BASE + "/#/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(9000);
console.log("home has غایبی:", await page.evaluate(() => (document.body.innerText || "").includes("غایبی")));

// درس غایبی با لینک درست (تک‌تکه‌ای)
await page.evaluate(() => { location.hash = "#/learn/ls-md7g-01"; });
await page.waitForTimeout(3000);
const l1 = await page.evaluate(() => ({ secs: document.querySelectorAll("article [data-sec-id]").length, notfound: (document.body.innerText || "").includes("جلسه پیدا نشد"), hash: location.hash }));
console.log("ghayebi lesson:", JSON.stringify(l1));

// باز کردن همهٔ بخش‌ها
for (let i = 0; i < 40; i++) {
  const btn = page.locator("button:has-text('ادامه بده')");
  if ((await btn.count()) === 0) break;
  await btn.first().tap();
  await page.waitForTimeout(200);
}
let lastY = -1;
for (let i = 0; i < 30; i++) {
  const y = await page.evaluate(() => window.scrollY);
  if (y === lastY) break;
  lastY = y;
  await page.waitForTimeout(160);
}
const more = page.locator("button[aria-label='کنش‌های بیشتر']");
console.log("more count:", await more.count());
if (await more.count()) {
  await more.first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await more.first().tap();
  await page.waitForTimeout(800);
  const menuState = await page.evaluate(() => {
    const menu = document.querySelector("[role='menu']");
    return { menuOpen: !!menu, items: menu ? [...menu.querySelectorAll("[role='menuitem']")].map((i) => i.textContent?.trim().slice(0, 28)) : [], hash: location.hash };
  });
  console.log("menu:", JSON.stringify(menuState));
  await page.screenshot({ path: "qa/apk-more-1-open.png" });

  // ۱) مقصد «بازگشت به فهرست درس» — نمای دورهٔ پکیجی
  const backItem = page.locator("[role='menuitem']:has-text('بازگشت به فهرست درس')");
  if (await backItem.count()) {
    await backItem.first().tap();
    await page.waitForTimeout(1200);
    const cv = await page.evaluate(() => ({ hash: location.hash, bodyLen: (document.body.innerText || "").length, text: (document.body.innerText || "").slice(0, 250) }));
    console.log("course view:", JSON.stringify(cv));
    await page.screenshot({ path: "qa/apk-more-2-course.png" });
  }
  // ۲) مقصد «تمرین کیس» — نمای کیس برای درس پکیجی
  await page.evaluate(() => { location.hash = "#/learn/ls-md7g-01"; });
  await page.waitForTimeout(2500);
  const more2 = page.locator("button[aria-label='کنش‌های بیشتر']");
  if (await more2.count()) {
    await more2.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await more2.first().tap();
    await page.waitForTimeout(600);
    const caseItem = page.locator("[role='menuitem']:has-text('تمرین کیس')");
    if (await caseItem.count()) {
      await caseItem.first().tap();
      await page.waitForTimeout(1500);
      const cs = await page.evaluate(() => ({ hash: location.hash, bodyLen: (document.body.innerText || "").length, text: (document.body.innerText || "").slice(0, 200) }));
      console.log("case view:", JSON.stringify(cs));
      await page.screenshot({ path: "qa/apk-more-3-case.png" });
    } else { console.log("case item NOT in menu (atEnd false?)"); }
  }
}
console.log("errors:", errors.length ? errors.slice(0, 8) : "none");
await browser.close();
