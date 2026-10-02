// پروب دیباگ: چرا بعد از fill("") + تایپ دوباره، نتیجه‌ها برنمی‌گردند؟
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (m) => console.log("[console]", m.type(), m.text().slice(0, 200)));
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));

await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.keyboard.press("/");
await page.waitForSelector('[role="dialog"]');

async function probe(tag) {
  const info = await page.evaluate(() => {
    const dlgs = [...document.querySelectorAll('[role="dialog"]')];
    const d = dlgs[dlgs.length - 1];
    const inp = d.querySelector("input");
    return {
      dialogs: dlgs.length,
      value: inp?.value,
      results: d.querySelectorAll('ul[aria-label="نتیجه‌ها"] button').length,
      skeleton: d.querySelectorAll(".animate-pulse").length,
      empty: d.body?.innerText?.includes("چیزی پیدا نشد") || d.innerText.includes("چیزی پیدا نشد"),
      guide: d.innerText.includes("همهٔ جزوات"),
    };
  });
  console.log(tag, JSON.stringify(info));
}

const inp = page.locator('[role="dialog"]').last().locator("input");
await inp.pressSequentially("ماده ۲۲۰", { delay: 40 });
await page.waitForTimeout(300);
await probe("after-220:");

await inp.fill("");
await page.waitForTimeout(150);
await probe("after-fill-empty:");

await inp.pressSequentially("مالیات", { delay: 40 });
await page.waitForTimeout(300);
await probe("after-retyping:");

// آیا fill بدون input event رخ داده؟ تایپ دستی با keyboard:
await inp.focus();
await page.keyboard.press("Control+a");
await page.keyboard.press("Backspace");
await page.waitForTimeout(100);
await page.keyboard.type("مال", { delay: 60 });
await page.waitForTimeout(300);
await probe("after-keyboard-type:");
await browser.close();
