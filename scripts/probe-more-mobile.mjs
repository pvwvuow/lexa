// پروب موبایل/لمسی باگ «بیشتر» — Android WebView emulation
import { chromium, devices } from "playwright";
const BASE = process.env.BASE || "http://127.0.0.1:3210";
const browser = await chromium.launch();

const ctx = await browser.newContext({
  ...devices["Pixel 7"],
  locale: "fa-IR",
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 300)));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push("console: " + m.text().slice(0, 300)); });

await page.goto(BASE + "/#/learn/m-l1-1", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector("article [data-sec-id]", { timeout: 30000 });
await page.waitForTimeout(2000);

for (let i = 0; i < 40; i++) {
  const btn = page.locator("button:has-text('ادامه بده')");
  if ((await btn.count()) === 0) break;
  await btn.first().tap();
  await page.waitForTimeout(250);
}
let lastY = -1;
for (let i = 0; i < 30; i++) {
  const y = await page.evaluate(() => window.scrollY);
  if (y === lastY) break;
  lastY = y;
  await page.waitForTimeout(200);
}
console.log("sections:", await page.locator("article [data-sec-id]").count());
const more = page.locator("button[aria-label='کنش‌های بیشتر']");
console.log("more count:", await more.count());
const box = await more.first().boundingBox();
console.log("more box:", JSON.stringify(box));
console.log("viewport:", JSON.stringify(page.viewportSize()));

// اسکرول تا دکمه دیده شود (مثل کاربر واقعی)
await more.first().scrollIntoViewIfNeeded();
await page.waitForTimeout(600);
await page.screenshot({ path: "qa/probe-more-m-1.png" });

// تپ واقعی لمسی
await more.first().tap();
await page.waitForTimeout(1000);

const state = await page.evaluate(() => {
  const menu = document.querySelector("[role='menu']");
  const mr = menu?.getBoundingClientRect();
  return {
    hash: location.hash,
    menuOpen: !!menu,
    menuRect: mr ? { top: Math.round(mr.top), left: Math.round(mr.left), bottom: Math.round(mr.bottom), h: Math.round(mr.height), w: Math.round(mr.width) } : null,
    menuItems: menu ? menu.querySelectorAll("[role='menuitem']").length : 0,
    scrollY: Math.round(window.scrollY),
    innerW: innerWidth,
    innerH: innerHeight,
  };
});
console.log("after tap:", JSON.stringify(state));
await page.screenshot({ path: "qa/probe-more-m-2.png" });

// تپ دوم — بستن/واکنش
await more.first().tap().catch(() => {});
await page.waitForTimeout(600);
const state2 = await page.evaluate(() => ({ hash: location.hash, menuOpen: !!document.querySelector("[role='menu']"), scrollY: Math.round(window.scrollY) }));
console.log("after 2nd tap:", JSON.stringify(state2));
console.log("errors:", errors.length ? errors.slice(0, 6) : "none");
await browser.close();
