// دیباگ ۳ — جریان کامل: نصب → دوره → دامپ صفحهٔ دوره (آکاردئون فصل و ردیف درس)
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
  console.log("URL:", page.url());
  const body = await page.locator("body").innerText();
  console.log("has chapter title (مدخل مدنی ۷):", body.includes("مدخل مدنی ۷"));
  console.log("has lesson title (نقشهٔ مدنی ۷):", body.includes("نقشهٔ مدنی ۷"));
  console.log("has minutos (۴۰ دقیقه):", /۴۰|دقیقه/.test(body));
  console.log("--- first 900 chars ---");
  console.log(body.slice(0, 900));
  await page.screenshot({ path: "/tmp/qa-debug-course.png", fullPage: true });
  await browser.close();
})();
