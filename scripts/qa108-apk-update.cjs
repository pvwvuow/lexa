// ─── QA 0.10.8 — نوار به‌روزرسانی درون‌برنامه‌ای اندروید (روی اکسپورت واقعی APK) ──
// خوراک نسخه با مسیریاب شبکه ماک می‌شود (نسخهٔ 99.0.0 = تازه‌تر) → قرص باید بیاید.
// کلیک «دانلود و نصب» در مرورگر (بدون پل بومی) باید مسیر خطا/تلاش دوباره را برود.
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

  const results = [];
  const ok = (name, cond) => results.push(`${cond ? "✅" : "❌"} ${name}`);

  // ماک خوراک نسخه — قبل از هر شبکه‌ای
  const FEED = {
    schema: 1, version: "99.0.0", tag: "app-v99.0.0",
    generatedAt: new Date().toISOString(),
    notes: "تست به‌روزرسانی درون‌برنامه‌ای — QA",
    apk: { file: "lexa-latest.apk", sha256: "0".repeat(64), size: 6605817 },
  };
  await page.route("**/updates/app/manifest.json*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FEED) }));
  // دانلود APK را هم می‌گیریم (نباید بشود) — خطای تمیز برگردان
  await page.route("**/releases/download/**", (route) => route.abort("failed"));
  await page.route("**/updates/app/lexa-latest.apk*", (route) => route.abort("failed"));

  await page.goto("http://localhost:3001/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const banner = page.locator('[role="status"]').filter({ hasText: "نسخهٔ تازهٔ Lexa" });
  ok("قرص به‌روزرسانی برای نسخهٔ جدید ظاهر شد", (await banner.count()) === 1);
  ok("یادداشت انتشار در قرص هست", (await page.locator('[role="status"]').filter({ hasText: "QA" }).count()) === 1);
  ok("دکمهٔ «دانلود و نصب درون‌برنامه‌ای» هست", (await banner.locator("button:has-text('دانلود و نصب')").count()) === 1);
  ok("پیام «منبع رسمی» زیر دکمه هست", (await banner.locator("text=منبع رسمی").count()) === 1);

  // کلیک نصب — در مرورگر بدون پل بومی، باید خطای تمیز + تلاش دوباره بیاید (نه کرش)
  await banner.locator("button:has-text('دانلود و نصب')").first().click();
  await page.waitForTimeout(2500);
  const retry = page.locator('[role="status"]').filter({ hasText: "تلاش دوباره" });
  ok("بدون پل بومی → خطای تمیز با «تلاش دوباره» (بدون کرش)", (await retry.count()) === 1);
  ok("بدون خطای کرش کنسول در مسیر آپدیت", !errors.some((e) => e.includes("pageerror")), errors.slice(0, 1).join(" | "));

  // بستن قرص — نسخه در localStorage ثبت شود تا مزاحم نباشد
  await page.locator('[role="status"] button[aria-label="بستن"]').first().click();
  await page.waitForTimeout(400);
  ok("قرص با بستن جمع شد", (await page.locator('[role="status"]').filter({ hasText: "نسخهٔ تازهٔ Lexa" }).count()) === 0);
  const dismissed = await page.evaluate(() => localStorage.getItem("lexa-apk-update-dismissed-version"));
  ok("نسخهٔ ردشده در localStorage ثبت شد", dismissed === "99.0.0", `got=${dismissed}`);

  console.log(results.join("\n"));
  const bad = results.filter((r) => r.startsWith("❌")).length;
  console.log(`\n═══ نتیجه: ${results.length - bad} سبز / ${bad} سرخ ═══`);
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
