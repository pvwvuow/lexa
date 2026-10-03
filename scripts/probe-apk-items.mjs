// فشار دادن تک‌تک آیتم‌های منوی بیشتر روی باندل APK — یافتن مقصر «برگشت به صفحهٔ قبل + خالی»
import { chromium, devices } from "playwright";
const BASE = process.env.BASE || "http://127.0.0.1:3211";
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["Pixel 7"], locale: "fa-IR" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + String(e).slice(0, 400)));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push("console: " + m.text().slice(0, 250)); });

async function openLessonAndMenu() {
  await page.goto(BASE + "/#/learn/ls-md7g-01", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  for (let i = 0; i < 40; i++) {
    const btn = page.locator("button:has-text('ادامه بده')");
    if ((await btn.count()) === 0) break;
    await btn.first().tap();
    await page.waitForTimeout(180);
  }
  let lastY = -1;
  for (let i = 0; i < 25; i++) {
    const y = await page.evaluate(() => window.scrollY);
    if (y === lastY) break;
    lastY = y;
    await page.waitForTimeout(150);
  }
  const more = page.locator("button[aria-label='کنش‌های بیشتر']");
  await more.first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await more.first().tap();
  await page.waitForTimeout(700);
}

const items = ["متوجه نشدم", "مثال بیشتر بده", "نقد تدریس", "تمرین کیس واقعی", "بازگشت به فهرست درس"];
for (const label of items) {
  await openLessonAndMenu();
  const item = page.locator(`[role='menuitem']:has-text('${label}')`);
  if (!(await item.count())) { console.log(`[${label}] item not found`); continue; }
  await item.first().tap();
  await page.waitForTimeout(2200);
  const st = await page.evaluate(() => ({
    hash: location.hash,
    bodyLen: (document.body.innerText || "").length,
    text: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 180),
    scrollY: Math.round(window.scrollY),
  }));
  console.log(`[${label}] →`, JSON.stringify(st));
  await page.screenshot({ path: `qa/apk-item-${items.indexOf(label)}.png` });
}
console.log("errors:", errors.length ? errors.slice(0, 10) : "none");
await browser.close();
