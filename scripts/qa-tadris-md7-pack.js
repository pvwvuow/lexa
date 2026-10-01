// QA — نصب بستهٔ «تدریس مدنی ۷ (استاد غایبی) جلسهٔ ۱» از تب به‌روزرسانی‌ها + رندر دوره و درس + کوئیز
// نکته: getByRole با نام accessible این دکمه‌ها کار نمی‌کند — از hasText استفاده می‌شود
const { chromium } = require("playwright");

const BASE = "http://localhost:3000";
const results = [];
function ok(name, cond, extra = "") {
  results.push({ name, pass: !!cond, extra });
  console.log(`${cond ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
}

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
  page.on("pageerror", (e) => { errors.push("PAGEERROR " + String(e).slice(0, 160)); console.log("PAGEERROR:", String(e).slice(0, 300), "\nSTACK:", (e.stack || "").split("\n").slice(0, 5).join("\n")); });

  try {
    // ۱) استارت اپ
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(6000); // اسپلش/هیدریشن dev

    // ۲) تنظیمات → تب به‌روزرسانی‌ها
    await page.click('[aria-label="تنظیمات و پروفایل"]', { timeout: 20000 });
    await page.waitForTimeout(2000);
    await page.locator("button", { hasText: "روزرسانی" }).first().click({ timeout: 20000 });
    await page.waitForTimeout(1200);

    // ۳) بررسی به‌روزرسانی (مانیفست تازه از CDN/محلی)
    await page.locator("button", { hasText: "بررسی به‌روزرسانی" }).first().click({ timeout: 15000 });
    await page.waitForTimeout(6000);

    // ۴) ردیف بستهٔ جدید (h3 عنوان → نزدیک‌ترین والد دارای دکمه)
    const h3 = page.locator("h3", { hasText: "تدریس مدنی ۷" }).first();
    await h3.waitFor({ state: "visible", timeout: 30000 });
    const row = h3.locator("xpath=ancestor::div[.//button][1]");
    const rowText = await row.innerText();
    ok("بستهٔ «تدریس مدنی ۷ (استاد غایبی): جلسهٔ ۱» در لیست ظاهر شد", /تدریس مدنی ۷/.test(rowText), rowText.slice(0, 70).replace(/\n/g, " "));
    ok("نوع بسته = دوره", /دوره/.test(rowText));

    // ۵) نصب
    await row.locator("button", { hasText: "نصب" }).first().click({ timeout: 10000 });
    await page.waitForTimeout(7000);
    const bodyAfter = await page.locator("body").innerText();
    ok("نصب موفق (چیپ نصب شده / پیام موفقیت)", /نصب شده/.test(bodyAfter) || /نصب شد/.test(bodyAfter));

    // ۶) بازگشت به خانه و باز کردن دوره
    await page.locator("button").filter({ hasText: /^خانه$/ }).first().click({ timeout: 15000 });
    await page.waitForTimeout(3000);
    const courseCard = page.locator("h3, h2, [class*='font-bold']", { hasText: "تدریس مدنی ۷ — استاد غایبی" }).first();
    await courseCard.waitFor({ state: "visible", timeout: 30000 });
    await courseCard.click({ timeout: 10000 });
    await page.waitForTimeout(4500);
    ok("صفحهٔ دوره باز شد", (await page.locator("body").innerText()).includes("جلسهٔ ۱"));

    // ۷) باز کردن آکاردئون فصل و سپس جلسهٔ ۱
    const chapter = page.locator("div, button", { hasText: /مدخل مدنی ۷/ }).last();
    await chapter.waitFor({ state: "visible", timeout: 30000 });
    await chapter.click({ timeout: 10000 });
    await page.waitForTimeout(2500);
    const lesson = page.locator("div, button, a", { hasText: /نقشهٔ مدنی ۷/ }).last();
    await lesson.waitFor({ state: "visible", timeout: 30000 });
    await lesson.click({ timeout: 10000 });
    await page.waitForTimeout(4500);

    // ۷‌ب) پیشروی تدریجی — باز کردن همهٔ بخش‌ها با «ادامه بده»
    for (let i = 0; i < 20; i++) {
      const more = page.locator("button", { hasText: "ادامه بده" });
      if (!(await more.count())) break;
      await more.first().click({ timeout: 8000 });
      await page.waitForTimeout(800);
    }
    const lessonBody = await page.locator("body").innerText();
    ok("متن درس رندر شد — هدف جلسه", lessonBody.includes("هدف جلسه"));
    ok("بخش مفهومی — عقد اذنی", lessonBody.includes("عقد اذنی چیست؟"));
    ok("بخش قانونی — مادهٔ ۹۵۴", lessonBody.includes("۹۵۴"));
    ok("جمع‌بندی رندر شد", lessonBody.includes("جمع‌بندی جلسهٔ ۱"));
    ok("مثال کلاس حاضر است (پارکینگ/ماشین)", lessonBody.includes("پارکینگ") || lessonBody.includes("ماشین"));
    ok("حاشیه‌های غیردرسی حذف شده‌اند", !lessonBody.includes("نماینده کلاس") && !lessonBody.includes("VoiceText"));
    ok("پنل مواد قانونی مرتبط رندر شد", lessonBody.includes("مواد قانونی مرتبط") && lessonBody.includes("وکالت عقدی است"));

    // ۸) رفتن به تست
    const quizBtn = page.locator("button", { hasText: "برو به تست" }).first();
    if (await quizBtn.count()) {
      await quizBtn.click({ timeout: 10000 });
      await page.waitForTimeout(3500);
      // صفحهٔ تنظیمات آزمون — شروع آزمون
      const startBtn = page.locator("button", { hasText: "شروع" }).first();
      if (await startBtn.count()) {
        await startBtn.click({ timeout: 10000 });
        await page.waitForTimeout(4000);
      }
      const quizBody = await page.locator("body").innerText();
      ok("کوئیز اجرا شد (شمارندهٔ سؤال)", /سؤال ۱ از/.test(quizBody));
      ok("سؤال و گزینه‌های الف/ب/ج/د رندر شدند", /الف/.test(quizBody) && /ب/.test(quizBody) && /ج/.test(quizBody) && /د/.test(quizBody) && /؟/.test(quizBody));
    } else {
      ok("دکمهٔ «برو به تست» پیدا شد", false, "درس تا انتها پیش نرفت یا دکمه نبود");
    }

    ok("صفر خطای کنسول", errors.length === 0, errors.slice(0, 3).join(" | "));
  } catch (e) {
    ok("جریان کامل بدون استثنا", false, String(e).slice(0, 220));
  }

  await browser.close();
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n═══ نتیجه: ${passed}/${results.length} سبز ═══`);
  process.exit(passed === results.length ? 0 : 1);
})();
