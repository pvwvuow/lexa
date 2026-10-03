// پروب باگ «بیشتر» در پایان درس — بازتولید گزارس کاربر
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://127.0.0.1:3210";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text().slice(0, 200)); });

await page.goto(BASE + "/#/learn/m-l1-1", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector("article [data-sec-id]", { timeout: 30000 });
await page.waitForTimeout(2000);

// باز کردن همهٔ بخش‌ها با «ادامه بده»
for (let i = 0; i < 40; i++) {
  const btn = page.locator("button:has-text('ادامه بده')");
  if ((await btn.count()) === 0) break;
  await btn.first().click();
  await page.waitForTimeout(250);
}
// صبر برای توقف اسکرول نرم
let lastY = -1;
for (let i = 0; i < 30; i++) {
  const y = await page.evaluate(() => window.scrollY);
  if (y === lastY) break;
  lastY = y;
  await page.waitForTimeout(200);
}
const secs = await page.locator("article [data-sec-id]").count();
console.log("sections open:", secs);
await page.screenshot({ path: "qa/probe-more-1-end.png" });

// محل دکمهٔ بیشتر + کلیک
const more = page.locator("button[aria-label='کنش‌های بیشتر']");
console.log("more buttons:", await more.count());
const box = await more.first().boundingBox();
console.log("more box:", JSON.stringify(box));
console.log("viewport:", page.viewportSize());

await more.first().click();
await page.waitForTimeout(1200);

// بعد از کلیک: چه منویی باز شد؟ کجا هستیم؟
const state = await page.evaluate(() => {
  const menu = document.querySelector("[role='menu']");
  const mr = menu?.getBoundingClientRect();
  return {
    url: location.hash,
    menuOpen: !!menu,
    menuRect: mr ? { top: Math.round(mr.top), bottom: Math.round(mr.bottom), h: Math.round(mr.height), items: menu.querySelectorAll("[role='menuitem']").length } : null,
    scrollY: Math.round(window.scrollY),
    innerH: innerHeight,
  };
});
console.log("after click:", JSON.stringify(state));
await page.screenshot({ path: "qa/probe-more-2-open.png" });
console.log("errors:", errors.length ? errors.slice(0, 5) : "none");
await browser.close();
