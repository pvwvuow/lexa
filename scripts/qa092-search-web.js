// ─── QA 0.9.2 — جستجوی سراسری روی پرود ──────────────────────────────────────
// ۱) بدون اسکلتون بین‌حرفی (پایان دیبانس)  ۲) آب‌رسانی متن‌ها → جستجوی بدنهٔ درس‌ها
// ۳) بدون desync بعد از بازنشانی ورودی (باگ «پاک‌کردن یک حرف» اندروید)
// ۴) کش شاخص: بازگشایی فوری  ۵) قانون/ناوبری/حالت خالی  ۶) صفر خطای کنسول
// نکته: سه نمونهٔ GlobalSearch با «/» باز می‌شوند — روی آخرین دیالوگ اسکوپ می‌کنیم.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
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

await page.goto(BASE, { waitUntil: "networkidle" });

async function openSearch() {
  await page.keyboard.press("/");
  await page.waitForSelector('[role="dialog"][aria-label="جستجوی سراسری"]');
  return page.locator('[role="dialog"][aria-label="جستجوی سراسری"]').last();
}

const dlg = await openSearch();
ok("دیالوگ جستجو باز شد", true);
const input = dlg.locator("input");

// ── تایپ حرف‌به‌حرف — هیچ اسکلتونی بین حروف مجاز نیست (دیلانس حذف شده)
const results = dlg.locator('ul[aria-label="نتیجه‌ها"] button');
let laggy = 0;
for (const ch of ["م", "ا", "ل", "ی", "ا", "ت"]) {
  await input.pressSequentially(ch, { delay: 50 });
  await page.waitForTimeout(35); // کمتر از دیبانسِ قدیمی (۱۱۰ms)
  if (await dlg.locator(".animate-pulse").count() > 0) laggy++;
}
ok("بدون اسکلتون بین‌حرفی (بدون دیبانس)", laggy === 0, `laggy=${laggy}`);
const val = await input.inputValue();
ok("ورودی مقدار کامل را نگه داشت", val === "مالیات", `val=${val}`);

// ── آب‌رسانی متن‌ها → جستجوی «بدنهٔ درس» باید نتیجه بدهد (کلمهٔ فقط-بدنه‌ای)
await page.waitForFunction(() => {
  const ds = document.querySelectorAll('[role="dialog"]');
  const d = ds[ds.length - 1];
  return d.querySelectorAll('ul[aria-label="نتیجه‌ها"] button').length > 0;
}, undefined, { timeout: 30000 });
ok("آب‌رسانی متن‌ها: جستجوی بدنهٔ درس نتیجه داد", true);

const barCls = await dlg.locator(".search-count-bar").count();
ok("نوار شمارندهٔ نتیجه (search-count-bar)", barCls === 1);

// ── بازنشانی ورودی + تایپ دوباره — سناریوی باگ اندروید (بدون desync)
await input.fill("");
await input.pressSequentially("مالیات", { delay: 30 });
await page.waitForTimeout(150);
const n2 = await results.count();
ok("بعد از بازنشانی+تایپ: نتیجه هست (بدون باگ «پاک‌کردن حرف»)", n2 > 0, `n=${n2}`);

// ── بستن و باز کردن: کش شاخص → فوری
await dlg.locator('button[aria-label="بستن"]').first().click();
await page.waitForTimeout(150);
const dlg2 = await openSearch();
const input2 = dlg2.locator("input");
const t0 = Date.now();
await input2.pressSequentially("عاریه", { delay: 25 });
await dlg2.waitForFunction(() => {
  const ds = document.querySelectorAll('[role="dialog"]');
  const d = ds[ds.length - 1];
  return d.querySelectorAll('ul[aria-label="نتیجه‌ها"] button').length > 0;
}, undefined, { timeout: 5000 });
ok(`بازگشایی: نتیجهٔ فوری از کش (${Date.now() - t0}ms)`, Date.now() - t0 < 2000);

// ── جستجوی مادهٔ قانونی
await input2.fill("");
await input2.pressSequentially("ماده ۲۲۰");
await page.waitForTimeout(300);
const lawHit = await dlg2.locator('span:text-is("قانون")').count();
ok("جستجوی مادهٔ قانونی کار می‌کند", lawHit > 0, `lawHit=${lawHit}`);

// ── ناوبری کیبورد
await input2.fill("");
await input2.pressSequentially("عاریه");
await dlg2.locator('ul[aria-label="نتیجه‌ها"] button').first().waitFor({ timeout: 5000 });
await input2.press("ArrowDown");
await input2.press("Enter");
await page.waitForTimeout(500);
const dc = await page.locator('[role="dialog"]').count();
ok(`Enter به نتیجه می‌رود و دیالوگ صاحب بسته می‌شود (باقی: ${dc})`, dc < 3);

// ── حالت خالی
const dlg3 = await openSearch();
const input3 = dlg3.locator("input");
await input3.pressSequentially("zzzzxx");
await page.waitForTimeout(250);
ok("حالت خالی با راهنما", (await dlg3.locator("text=چیزی پیدا نشد").count()) >= 1);
await page.keyboard.press("Escape");

ok("صفر خطای کنسول", errors.length === 0, errors.slice(0, 3).join(" | "));

console.log(`\nنتیجه: ${pass} سبز / ${fail} قرمز`);
await browser.close();
process.exit(fail ? 1 : 0);
