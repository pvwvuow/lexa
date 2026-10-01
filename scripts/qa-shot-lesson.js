const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(6000);
  await page.click('[aria-label="تنظیمات و پروفایل"]', { timeout: 20000 });
  await page.waitForTimeout(2000);
  await page.locator("button", { hasText: "روزرسانی" }).first().click({ timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.locator("button", { hasText: "بررسی به‌روزرسانی" }).first().click({ timeout: 15000 });
  await page.waitForTimeout(6000);
  const h3 = page.locator("h3", { hasText: "تدریس مدنی ۷" }).first();
  await h3.waitFor({ state: "visible", timeout: 30000 });
  const row = h3.locator("xpath=ancestor::div[.//button][1]");
  const ib = row.locator("button", { hasText: "نصب" }).first();
  if (await ib.count()) await ib.click();
  await page.waitForTimeout(6000);
  await page.locator("button").filter({ hasText: /^خانه$/ }).first().click({ timeout: 15000 });
  await page.waitForTimeout(3000);
  await page.locator("h3, h2, [class*='font-bold']", { hasText: "تدریس مدنی ۷ — استاد غایبی" }).first().click({ timeout: 30000 });
  await page.waitForTimeout(4500);
  const chapter = page.locator("div, button", { hasText: /مدخل مدنی ۷/ }).last();
  await chapter.click({ timeout: 15000 });
  await page.waitForTimeout(2500);
  const lesson = page.locator("div, button, a", { hasText: /نقشهٔ مدنی ۷/ }).last();
  await lesson.click({ timeout: 15000 });
  await page.waitForTimeout(4500);
  for (let i = 0; i < 20; i++) {
    const more = page.locator("button", { hasText: "ادامه بده" });
    if (!(await more.count())) break;
    await more.first().click(); await page.waitForTimeout(700);
  }
  for (let i = 0; i < 20; i++) {
    const more = page.locator("button", { hasText: "ادامه بده" });
    if (!(await more.count())) break;
    await more.first().click(); await page.waitForTimeout(600);
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "/tmp/qa-lesson-final.png", fullPage: true });
  await page.waitForTimeout(4000);
  const body = await page.locator("body").innerText();
  console.log("URL:", page.url());
  console.log("BODY 500:", body.slice(0, 500).replace(/\n+/g, " | "));
  
  await browser.close();
})();
