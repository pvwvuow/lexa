import { chromium } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.route(/jsdelivr|raw\.githubusercontent/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + String(e).slice(0, 150)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 120)); });
page.on("requestfailed", (r) => { if (!/jsdelivr|raw\.github/.test(r.url())) errors.push("REQFAIL: " + r.url().slice(0, 100)); });

await page.goto("http://127.0.0.1:3210/#/course/course-tadris-madani7-ghayebi", { waitUntil: "domcontentloaded", timeout: 30000 });
console.log("goto ok");
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(2000);
  const h1 = await page.locator("h1").allTextContents().catch(() => []);
  const bodyLen = (await page.content().catch(() => "")).length;
  console.log(`t+${(i + 1) * 2}s h1=`, JSON.stringify(h1).slice(0, 140), "| len:", bodyLen);
  if (h1.some((t) => t.includes("تدریس مدنی ۷"))) { console.log("COURSE RENDERED"); break; }
}
console.log("errors:", errors.slice(0, 6));
await browser.close();
