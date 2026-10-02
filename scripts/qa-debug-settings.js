// دیباگ — صفحهٔ تنظیمات: فهرست دکمه‌ها و متن‌های تب
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(6000);
  await page.click('[aria-label="تنظیمات و پروفایل"]', { timeout: 20000 });
  await page.waitForTimeout(2000);
  const btns = await page.locator("button").allInnerTexts();
  console.log("BUTTONS:", JSON.stringify(btns.slice(0, 40), null, 0));
  const tabs = await page.locator('[role="tab"], nav button, .flex button').allInnerTexts();
  console.log("TABS-ish:", JSON.stringify(tabs.slice(0, 30)));
  await page.screenshot({ path: "/tmp/qa-debug-settings.png", fullPage: false });
  await browser.close();
})();
