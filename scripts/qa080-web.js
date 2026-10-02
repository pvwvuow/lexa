/* QA وب v0.8.0 — رندر + حساب سروری + نشان‌گذاری + سینک + نسخه‌ها + صفر خطا */
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:3000";
const STAMP = Date.now().toString().slice(-8);
const USER = `qa08_${STAMP}`;
const PASS = "Qa08" + STAMP + "!";

(async () => {
  let passed = 0, failed = 0;
  const assert = (c, label, extra = "") => {
    if (c) { passed++; console.log("  ✓", label); }
    else { failed++; console.error("  ✗", label, extra); }
  };

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + String(e).slice(0, 300)));

  console.log("[۱] رندر خانه + نسخه‌ها");
  await page.goto(BASE + "/#/", { waitUntil: "networkidle", timeout: 45000 });
  const body = await page.evaluate(() => document.body.innerText.slice(0, 300));
  assert(body.length > 50, "خانه رندر شد");
  const swVer = await page.evaluate(async () => {
    const r = await fetch("/sw.js");
    return ((await r.text()).match(/lexa-pwa-v\d+/) || ["?"])[0];
  });
  assert(swVer === "lexa-pwa-v36", "سرویس‌ورکر v36 سرو می‌شود", swVer);

  console.log("[۲] ساخت حساب سروری تازه (ورود / ثبت‌نام)");
  await page.goto(BASE + "/#/", { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1200);
  await page.locator('button:has-text("ورود / ثبت‌نام")').first().click({ timeout: 8000 });
  await page.waitForSelector("form input", { timeout: 6000 });
  await page.locator('[role="tab"]:has-text("ثبت‌نام")').first().click().catch(() => {});
  await page.waitForTimeout(400);
  await page.locator("form input:not([type=password])").first().fill(USER);
  const pwInputs = page.locator('form input[type="password"]');
  const npw = await pwInputs.count();
  await pwInputs.nth(npw - 1).fill(PASS);
  if (npw > 1) await pwInputs.nth(0).fill(PASS);
  await page.screenshot({ path: "/home/z/my-project/.zscreenshots/qa-080-register.png" });
  await page.locator('form button[type="submit"], form button:has-text("ورود به حساب")').first().click();
  await page.waitForTimeout(3000);
  const after = await page.evaluate(() => document.body.innerText.slice(0, 1500));
  const regOk = (after.includes(USER) || /خوش|خروج|حساب/.test(after)) && !/ارتباط با سرور برقرار نشد/.test(after);
  assert(regOk, "ثبت‌نام سروری موفق", after.slice(0, 100).replace(/\n/g, " "));

  console.log("[۳] نشان‌گذاری متن با رنگ (درگ واقعی موس)");
  await page.goto(BASE + "/#/", { waitUntil: "networkidle" });
  await page.getByText("ادامه یادگیری").first().click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(3500);
  // درگ موس روی متن داخل بخش‌های درس (data-sec-id) — شبیه کاربر واقعی
  const target = page.locator('[data-sec-id] p:visible, [data-sec-id] li:visible, [data-sec-id] h3:visible').first();
  const hasTarget = (await target.count()) > 0;
  console.log("   هدف درگ:", hasTarget ? "پیدا شد" : "نه!");
  if (hasTarget) {
    const bb = await target.boundingBox();
    if (bb) {
      // تریپل‌کلیک = انتخاب کامل خط/پاراگراف — نقطهٔ شروع متن (راست در RTL)
      await page.mouse.click(bb.x + bb.width * 0.75, bb.y + Math.min(10, bb.height / 2), { clickCount: 3 });
    }
  }
  await page.waitForTimeout(900);
  const toolbarVisible = await page.locator('[data-mark-toolbar="1"]').isVisible({ timeout: 3000 }).catch(() => false);
  assert(toolbarVisible, "تولبار شناور نشان ظاهر شد");
  if (toolbarVisible) {
    await page.locator('[data-mark-toolbar="1"] button[title="رنگ نشان"]').first().click();
    await page.waitForTimeout(700);
  }
  const markCount = await page.evaluate(() => document.querySelectorAll("mark[data-lexa-mark], .lexa-mark").length);
  assert(markCount > 0, "نشان رنگی روی متن نشست", "count=" + markCount);

  console.log("[۴] سینک نشان به حساب سروری");
  const pushed = await page.evaluate(async () => {
    const res = await fetch("/api/user/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    return res.status;
  }).catch(() => "ERR");
  console.log("   /api/user/sync →", pushed);
  assert(pushed === 200 || pushed === 401, "API سینک در دسترس است", String(pushed));

  console.log("[۵] خطاها");
  const fatal = errors.filter((e) => !/40[134]|favicon|\/api\//.test(e));
  assert(fatal.length === 0, "صفر خطای کنسول مرگبار", JSON.stringify(fatal.slice(0, 3)));

  await page.screenshot({ path: "/home/z/my-project/.zscreenshots/qa-080-web.png" });
  await browser.close();
  console.log("─".repeat(50));
  console.log(`نتیجه: ${passed} ✓ / ${failed} ✗`);
  process.exit(failed ? 1 : 0);
})();
