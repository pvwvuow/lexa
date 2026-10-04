// ─── QA 0.10.8 — جستجوی قوانین مقاوم به IME اندروید + جستجوی «مدنی» ─────────
// باگ کاربر: تایپ «مدنی» در جستجوی برنامه → هیچ؛ پاک‌کردن حرف آخر → «مدن» → نتیجه.
// ریشه: ورودی‌های کنترل‌شدهٔ ری‌اکت در کتابخانهٔ قوانین (وب‌ویو اندروید حین
// composition با re-render می‌شکند). این QA تایپ IME-نما (ست‌کردن مقدار با
// ستّر بومی + رویداد input مثل خروجی واقعی کیبورد اندروید) را روی هر دو ورودی
// کتابخانهٔ قوانین شبیه‌سازی می‌کند و نتیجهٔ فیلتر را می‌سنجد؛
// همچنین جستجوی سراسری «مدنی» (دوره‌ها/قوانین/اساتید) را کنترل می‌کند.
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://127.0.0.1:3210";
let pass = 0, fail = 0;
function ok(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${extra}`); }
}

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text()); });

await page.goto(`${BASE}/#/law`, { waitUntil: "networkidle", timeout: 45000 });
await page.waitForTimeout(800);

/** تایپ IME-نما — مقدار با ستّر بومی می‌نشیند + رویداد input بومی (بدون compositionend) */
async function imeType(selector, text) {
  await page.evaluate(({ selector, text }) => {
    const input = document.querySelector(selector);
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, { selector, text });
}

console.log("── ۱) جستجوی فهرست قوانین — «مدنی» (همان کلمهٔ گزارش کاربر) ──");
const idxInput = 'input[aria-label="جستجو در متن قوانین"]';
ok("ورودی جستجوی فهرست قوانین هست", await page.locator(idxInput).count() === 1);
const cardsBefore = await page.locator("a, button").filter({ hasText: "قانون مدنی" }).count();
await imeType(idxInput, "مدنی");
await page.waitForTimeout(300);
const cardsAfter = await page.locator("button:has-text('قانون مدنی')").count();
ok(`تایپ «مدنی» با رویداد بومی → کارت «قانون مدنی» فیلتر شد (${cardsBefore}→${cardsAfter})`, cardsAfter >= 1, `after=${cardsAfter}`);
// حرف به حرف مثل کیبورد واقعی
await page.evaluate(() => {
  const input = document.querySelector('input[aria-label="جستجو در متن قوانین"]');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  let acc = "";
  for (const ch of ["م", "د", "ن", "ی"]) {
    acc += ch;
    setter.call(input, acc);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
});
await page.waitForTimeout(300);
const cardsTyped = await page.locator("button:has-text('قانون مدنی')").count();
ok("تایپ حرف‌به‌حرفِ «مدنی» هم نتیجه می‌دهد", cardsTyped >= 1, `count=${cardsTyped}`);

console.log("── ۲) ورودی جستجوی داخل متن‌خوان قانون ──");
// ورود به متن‌خوان قانون مدنی از کارت
await page.locator("button:has-text('قانون مدنی')").first().click();
await page.waitForTimeout(900);
const readerInput = 'input[aria-label="جستجو در این قانون"]';
ok("ورودی جستجوی متن‌خوان قانون هست", await page.locator(readerInput).count() === 1);
// کلمه‌ای که قطعاً در مواد قانون مدنی هست: «ضمان» — با ستّر بومی
await imeType(readerInput, "ضمان");
await page.waitForTimeout(400);
const articles = await page.locator("section article, li, div").filter({ hasText: /ماده\s*[۰-۹0-9]/ }).count();
ok("جستجوی «ضمان» در متن‌خوان → ماده‌ها فیلتر شدند", articles > 0, `matches=${articles}`);
// دکمهٔ پاک‌کردن (X) — مقدار کنترل‌نشده را هم خالی کند
const xBtn = page.locator("button[aria-label='پاک کردن']");
if (await xBtn.count() > 0) {
  await xBtn.first().click();
  await page.waitForTimeout(300);
  const cleared = await page.evaluate(() => (document.querySelector('input[aria-label="جستجو در این قانون"]') || {}).value === "");
  ok("دکمهٔ پاک‌کردن، ورودی کنترل‌نشده را خالی می‌کند", cleared);
}

console.log("── ۳) جستجوی سراسری «مدنی» — کنترل رگرسیون ──");
await page.locator("h1").first().click(); // از ورودی جستجو خارج شو — «/» در ورودی باز نمی‌کند
await page.evaluate(() => (document.activeElement || {})?.blur?.());
await page.waitForTimeout(200);
await page.keyboard.press("/");
await page.waitForSelector('[role="dialog"][aria-label="جستجوی سراسری"]');
const dlg = page.locator('[role="dialog"][aria-label="جستجوی سراسری"]').last();
await dlg.locator("input").click();
await dlg.locator("input").pressSequentially("مدنی", { delay: 40 });
await page.waitForTimeout(400);
const results = await dlg.locator('ul[aria-label="نتیجه‌ها"] button').count();
ok(`جستجوی سراسری «مدنی» → ${results} نتیجه (قانون/جلسه)`, results > 0, `n=${results}`);
await page.keyboard.press("Escape");

console.log("── ۴) صفر خطای کنسول ──");
ok("بدون خطای کنسول/صفحه", errors.length === 0, errors.slice(0, 2).join(" | "));

console.log(`\nنتیجه: ${pass} ✓ / ${fail} ✗`);
await browser.close();
process.exit(fail ? 1 : 0);
