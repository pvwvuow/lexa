// پروب ۲: آیا بعد از fill("")، تایپ اصلاً رویداد input تولید می‌کند؟
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.keyboard.press("/");
await page.waitForSelector('[role="dialog"]');

// شمارندهٔ بومی رویدادهای input روی همهٔ اینپوت‌های دیالوگ‌ها
await page.evaluate(() => {
  window.__inp = [];
  const rec = (e) => {
    const d = e.target.closest('[role="dialog"]');
    window.__inp.push({ v: e.target.value, it: e.inputType || "-", data: e.data || "-" });
  };
  document.querySelectorAll('[role="dialog"] input').forEach((el) => {
    el.addEventListener("input", rec);
    el.addEventListener("beforeinput", rec);
  });
});

const inp = page.locator('[role="dialog"]').last().locator("input");

await inp.pressSequentially("ماده", { delay: 50 });
await page.waitForTimeout(200);
console.log("A بعد از pressSequentially مستقیم:", JSON.stringify(await page.evaluate(() => window.__inp)));
await page.evaluate(() => { window.__inp = []; });

await inp.fill("");
await page.waitForTimeout(150);
console.log("B بعد از fill(empty):", JSON.stringify(await page.evaluate(() => window.__inp)));
await page.evaluate(() => { window.__inp = []; });

await inp.pressSequentially("مالیات", { delay: 50 });
await page.waitForTimeout(200);
console.log("C بعد از pressSequentially پس از fill:", JSON.stringify(await page.evaluate(() => window.__inp)));
await page.evaluate(() => { window.__inp = []; });

await inp.focus();
await page.keyboard.type("تست", { delay: 50 });
await page.waitForTimeout(200);
console.log("D بعد از keyboard.type پس از همان حال:", JSON.stringify(await page.evaluate(() => window.__inp)));
await page.evaluate(() => { window.__inp = []; });

await inp.fill("مریم");
await page.waitForTimeout(150);
console.log("E بعد از fill(متن):", JSON.stringify(await page.evaluate(() => window.__inp)));

await browser.close();
