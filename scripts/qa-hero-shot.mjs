// اسکرین‌شات قبل/بعد از ریکار هیروی خانه — موبایل و دسکتاپ
import { chromium, devices } from "playwright";
const BASE = process.env.BASE || "http://127.0.0.1:3210";
const TAG = process.env.TAG || "before";
const outDir = "/home/z/my-project/shots";

const browser = await chromium.launch();

// موبایل — Pixel 7
{
  const ctx = await browser.newContext({ ...devices["Pixel 7"], locale: "fa-IR" });
  const page = await ctx.newPage();
  await page.goto(BASE + "/#/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(6000); // نصب خودکار بسته + نشست فونت‌ها + لود فید
  await page.screenshot({ path: `${outDir}/hero-${TAG}-mob.png`, fullPage: true });
  // نمای قابل‌مشاهدهٔ اول (بالای صفحه)
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/hero-${TAG}-mob-top.png` });
  await ctx.close();
}

// دسکتاپ
{
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "fa-IR" });
  const page = await ctx.newPage();
  await page.goto(BASE + "/#/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${outDir}/hero-${TAG}-desk.png` });
  await ctx.close();
}

await browser.close();
console.log(`shots saved: hero-${TAG}-{mob,mob-top,desk}.png`);
