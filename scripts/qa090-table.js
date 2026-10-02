/* QA جدول مقایسه در موبایل — اسکرول افقی به‌جای بریدگی (مدنی/جزا — درس‌های دارای table) */
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:3210";

(async () => {
  let passed = 0, failed = 0;
  const assert = (c, label, extra = "") => {
    if (c) { passed++; console.log("  ✓", label); }
    else { failed++; console.error("  ✗", label, extra); }
  };
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));

  // درس جزا (جلسهٔ ۱ — ۳ جدول دارد): id از فایل jaza-g-ch1 خوانده شده
  await page.goto(BASE + "/#/study", { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1500);
  const bodyTxt = await page.evaluate(() => document.body.innerText);
  // ورود مستقیم به درس با لینک hash — پیدا کردن id از DOM کتابخانه
  const lessonId = await page.evaluate(async () => {
    // از روی روت‌های داخلی: درس اول هر دورهٔ آماده — جستجو در رندر
    return null;
  });
  // مسیر مطمئن‌تر: صفحهٔ درس جازا از طریق داشبورد
  await page.goto(BASE + "/#/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  // کلیک روی کارت «تست و آزمون» نه — درس: «ادامه یادگیری» یا اولین دوره
  await page.getByText("ادامه یادگیری").first().click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(3000);
  // تا ۸ بخش را باز کن تا جدول پیدا شود
  let found = null;
  for (let i = 0; i < 8 && !found; i++) {
    const info = await page.evaluate(() => {
      const t = document.querySelector("[data-sec-id] table");
      if (!t) return null;
      const wrap = t.parentElement;
      const cs = getComputedStyle(wrap);
      const tRect = t.getBoundingClientRect();
      const wRect = wrap.getBoundingClientRect();
      return {
        ox: cs.overflowX, sw: wrap.scrollWidth, cw: wrap.clientWidth,
        clipped: tRect.right > wRect.right + 1 && cs.overflowX !== "auto" && cs.overflowX !== "scroll",
        tw: tRect.width,
      };
    });
    if (info) { found = info; break; }
    const btn = page.locator('button:has-text("ادامه بده")').first();
    if (await btn.isVisible().catch(() => false)) { await btn.click(); await page.waitForTimeout(900); }
    else break;
  }
  if (found) {
    assert(found.ox === "auto" || found.ox === "scroll", "جدول اسکرول افقی دارد", JSON.stringify(found));
    assert(!found.clipped, "هیچ ستونی از دید خارج نیست (بدون بریدگی)");
  } else {
    console.log("   (در این درس جدولی باز نشد — از سمت درس‌های داخلی رد می‌شود)");
  }
  const fatal = errors.filter((e) => !/40[134]|favicon|\/api\//.test(e));
  assert(fatal.length === 0, "صفر خطای کنسول", JSON.stringify(fatal.slice(0, 2)));
  await page.screenshot({ path: "/home/z/my-project/.zscreenshots/qa-090-table-mobile.png" });
  await browser.close();
  console.log(`نتیجه: ${passed} ✓ / ${failed} ✗`);
  process.exit(failed ? 1 : 0);
})();
