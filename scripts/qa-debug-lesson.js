// دیباگ ۴ — stack کامل خطای باز شدن درس
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
  page.on("console", (m) => {
    if (m.type() === "error") console.log("CONSOLE-ERR:", m.text().slice(0, 400), "| loc:", JSON.stringify(m.location()));
  });
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 600), "\nSTACK:", (e.stack || "").slice(0, 800)));
  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(6000);
  await page.locator("h3, h2, [class*='font-bold']", { hasText: "تدریس مدنی ۷ — استاد غایبی" }).first().click({ timeout: 30000 });
  await page.waitForTimeout(4500);
  const chapter = page.locator("div, button", { hasText: /مدخل مدنی ۷/ }).last();
  await chapter.click({ timeout: 15000 });
  await page.waitForTimeout(2500);
  const lesson = page.locator("div, button, a", { hasText: /نقشهٔ مدنی ۷/ }).last();
  console.log("lesson matches:", await lesson.count());
  await lesson.click({ timeout: 15000 });
  await page.waitForTimeout(5000);
  console.log("URL after lesson click:", page.url());
  const body = await page.locator("body").innerText();
  console.log("body has هدف جلسه:", body.includes("هدف جلسه"));
  console.log("body head 300:", body.slice(0, 300).replace(/\n/g, " | "));
  await page.screenshot({ path: "/tmp/qa-debug-lesson.png", fullPage: false });
  await browser.close();
})();
