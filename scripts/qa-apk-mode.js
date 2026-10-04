/* QA حالت APK — اکسپورت ایستا سرو‌شدهٔ لوکال */
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

  const results = [];
  const ok = (name, cond) => results.push(`${cond ? "✅" : "❌"} ${name}`);

  await page.goto("http://localhost:3001/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  // ۱) خانه لود شد
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 400));
  ok("صفحهٔ خانه رندر شد", bodyText.length > 50);
  ok("بدون خطای crash اولیه", !bodyText.includes("Application error"));

  // ۲) در APK نباید کتابخانهٔ عمومی/اساتید در منو باشد (سایدبار مخفی در موبایل — منوی کشویی را باز کن)
  await page.evaluate(() => { try { window.location.hash = "#/settings"; } catch {} });
  await page.waitForTimeout(1500);
  const settingsText = await page.evaluate(() => document.body.innerText);
  ok("صفحهٔ تنظیمات باز شد", settingsText.includes("تنظیمات") || settingsText.includes("حساب"));

  // ۳) کارت حساب ابری — ساده و خودکار: بدون دکمهٔ دستی همگام‌سازی/بازیابی
  ok("کارت «حساب ابری» در تنظیمات هست", settingsText.includes("حساب ابری"));
  ok("کارت حساب ابری: «خودکار» تضمین شده", settingsText.includes("خودکار"));
  ok("دکمهٔ دستی «همگام‌سازی روی ابر» حذف شد (سینک خودکار است)", !settingsText.includes("همگام‌سازی روی ابر"));
  ok("دکمهٔ دستی «بازیابی از ابر» حذف شد", !settingsText.includes("بازیابی از ابر"));

  // ۴) استاد داخلی در تنظیمات AI نباید باشد
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button, [role=tab]")];
    const aiTab = btns.find((b) => /هوش مصنوعی|استاد/.test(b.innerText));
    aiTab?.click();
  });
  await page.waitForTimeout(900);
  const aiText = await page.evaluate(() => document.body.innerText);
  ok("پروایدر «استاد داخلی» در APK حذف شده", !aiText.includes("استاد داخلی"));
  ok("پروایدر Gemini موجود است", aiText.includes("Gemini"));
  ok("در APK تنظیمات پیشرفته خودبه‌خود باز است (کلید شخصی لازم است)", aiText.includes("کلید شخصی"));
  ok("کارت سادهٔ «استاد هوشمند» هست", aiText.includes("استاد هوشمند"));
  ok("پیام قدیمی «پروایدر» در خطاها حذف شد", !aiText.includes("پروایدر"));

  // ۵) درس داخلی از متون باندل‌شده
  await page.evaluate(() => { window.location.hash = "#/learn/cp-l11"; });
  await page.waitForTimeout(3000);
  const lessonText = await page.evaluate(() => document.body.innerText.slice(0, 800));
  ok("جلسه از متون باندل‌شده رندر شد", lessonText.includes("تصنیف جرم") || lessonText.includes("منابع حقوق جزا"));

  // ۶) مارک‌گذاری در APK هم کار کند
  const el = await page.locator("article .teach-body p").first().elementHandle().catch(() => null);
  if (el) {
    await page.evaluate((e) => {
      const n = e.childNodes[0];
      const s = window.getSelection(); s.removeAllRanges();
      const r = document.createRange(); r.setStart(n, 4); r.setEnd(n, 40);
      s.addRange(r); document.dispatchEvent(new Event("selectionchange"));
    }, el);
    await page.waitForTimeout(700);
    const tb = await page.locator('[data-mark-toolbar="1"]').count();
    ok("نوار نشان‌گذاری در APK کار می‌کند", tb > 0);
    if (tb) {
      await page.locator('[data-mark-toolbar="1"] button').first().click();
      await page.waitForTimeout(500);
      ok("نشان اعمال شد در APK", (await page.locator("mark.lexa-mark").count()) > 0);
    }
  } else {
    ok("پاراگراف درس یافت شد", false);
  }

  // ۷) ناوبری به مسیر سرورمحور → پیام مخصوص APK
  await page.evaluate(() => { window.location.hash = "#/teachers"; });
  await page.waitForTimeout(1000);
  const t = await page.evaluate(() => document.body.innerText);
  ok("پیام «در دسترس نیست» برای بخش سرورمحور", t.includes("در دسترس نیست") || t.includes("نسخهٔ اندروید"));

  await page.screenshot({ path: "qa/qa-apk-home.png", fullPage: false });

  console.log("\n═══ نتایج QA حالت APK ═══");
  results.forEach((r) => console.log(r));
  const fails = results.filter((r) => r.startsWith("❌")).length;
  console.log(`\n${results.length - fails}/${results.length} سبز`);
  if (errors.length) {
    console.log("\nخطاها:");
    [...new Set(errors)].slice(0, 6).forEach((e) => console.log(" ⚠", e.slice(0, 160)));
  }
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
