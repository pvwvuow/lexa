// Task 58b — QA شروع آزمون از جلسهٔ تنبل: استخر سؤال هنگام start بارگیری می‌شود
const { chromium } = require("playwright");
const BASE = "http://localhost:3000";

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
  const textReqs = [];
  page.on("request", (r) => { if (r.url().includes("/texts/")) textReqs.push(r.url().split("/texts/")[1]); });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  // مسیر مستقیم: آزمونِ یک جلسهٔ داخلی — هنوز محتوایی لود نیست
  await page.goto(BASE + "/#/quiz/md4-l1-1", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const setupHeader = await page.locator("text=/سؤال در دامنه/").first().isVisible().catch(() => false);
  console.log(setupHeader ? "✅ صفحهٔ تنظیمات آزمون با شمارندهٔ متادیتا" : "❌ تنظیمات آزمون نیامد");

  const beforeStart = textReqs.length;
  const startBtn = page.locator("button", { hasText: "شروع آزمون" }).first();
  await startBtn.click();
  await page.waitForTimeout(4000);
  const fetched = textReqs.slice(beforeStart);
  console.log(fetched.some((u) => u.startsWith("md4-l1-1")) ? "✅ استارت آزمون ← دریافت سؤال‌های همان جلسه" : `❌ دریافتی: ${fetched.join(",") || "none"}`);

  const qVisible = await page.locator("text=/پاسخ خود را انتخاب کن|گزینه|ماده/").first().isVisible().catch(() => false);
  const anyOptionBtn = await page.locator("button:has-text('مادهٔ'), button:has-text('قانون'), .flip-inner, text=/سؤال/").first().isVisible().catch(() => false);
  console.log(qVisible || anyOptionBtn ? "✅ سؤال آزمون رندر شد" : "❌ سؤال رندر نشد");
  await page.screenshot({ path: "download/qa-lazy/qa58-quiz-running.png", fullPage: false });

  console.log(errors.length ? `❌ pageerror: ${errors[0]}` : "✅ بدون خطای جاوااسکریپت");
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error("CRASH", e); process.exit(2); });
