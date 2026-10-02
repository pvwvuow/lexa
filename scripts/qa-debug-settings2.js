// دیباگ ۲ — آیا getByRole با نیم‌فاصله مشکل دارد؟
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(6000);
  await page.click('[aria-label="تنظیمات و پروفایل"]', { timeout: 20000 });
  await page.waitForTimeout(2000);

  const a = await page.getByRole("button", { name: "به‌روزرسانی‌ها" }).count();
  console.log("getByRole exact-name count:", a);
  const b = await page.getByRole("button", { name: /روزرسانی/ }).count();
  console.log("getByRole regex /روزرسانی/ count:", b);
  const c = await page.locator("button", { hasText: "روزرسانی" }).count();
  console.log("locator hasText count:", c);
  // نمای واقعی نام accessible
  const names = await page.locator("button").evaluateAll((els) =>
    els.map((e) => e.getAttribute("aria-label") || e.textContent?.trim()).filter((t) => t && t.includes("روز"))
  );
  console.log("raw names containing روز:", JSON.stringify(names));
  await browser.close();
})();
