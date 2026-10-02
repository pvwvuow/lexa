// پروب ۴: وضعیت تک‌تک سه دیالوگ بعد از تایپ
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.keyboard.press("/");
await page.waitForSelector('[role="dialog"]');

const snap = (tag) => page.evaluate((t) => {
  return [...document.querySelectorAll('[role="dialog"]')].map((d, i) => ({
    i, v: d.querySelector("input")?.value,
    results: d.querySelectorAll('ul[aria-label="نتیجه‌ها"] button').length,
    skeleton: d.querySelectorAll(".animate-pulse").length,
    empty: d.innerText.includes("چیزی پیدا نشد"),
    guide: d.innerText.includes("همهٔ جزوات"),
    hasIndexFooter: d.innerText.includes("ایندکس شده"),
    footer: d.innerText.match(/کلاً (\S+) جلسه/)?.[1] ?? "-",
  })).concat([{ tag: t }]);
}, tag);

const inp = page.locator('[role="dialog"]').last().locator("input");
await inp.pressSequentially("مالیات", { delay: 50 });
await page.waitForTimeout(300);
console.log(JSON.stringify(await snap("typed-into-LAST"), null, 1));
await browser.close();
