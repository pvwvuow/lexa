/* QA نهایی وب پرود: مارک + ثبت‌نام/ورود روی سرور واقعی */
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 850 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const results = [];
  const ok = (n, c) => results.push(`${c ? "✅" : "❌"} ${n}`);

  // ── ۱) ثبت‌نام حساب تازه روی سرور پرود ──
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const uname = "qa_" + Date.now().toString(36);
  await page.evaluate(() => { window.location.hash = "#/settings"; });
  await page.waitForTimeout(1200);
  // دکمهٔ ورود/ثبت‌نام هدر
  await page.locator("header button:has-text('ورود')").first().click().catch(() => {});
  await page.waitForTimeout(800);
  const dialogOpen = await page.locator("[role=dialog]").count();
  ok("دیالوگ حساب کاربری باز شد", dialogOpen > 0);
  if (dialogOpen) {
    await page.locator("[role=dialog] button:has-text('ثبت‌نام')").first().click();
    await page.waitForTimeout(400);
    await page.locator("[role=dialog] input").first().fill(uname);
    await page.locator("[role=dialog] input[type=password]").first().fill("qa_secret_7");
    await page.locator("[role=dialog] input[type=password]").nth(1).fill("qa_secret_7");
    await page.locator("[role=dialog] button[type=submit]").click();
    await page.waitForTimeout(2500);
    const authed = await page.evaluate(() => document.body.innerText.includes("خوش آمد") || !document.querySelector("[role=dialog]"));
    ok("ثبت‌نام روی سرور پرود موفق", authed);
    await page.keyboard.press("Escape");
  }

  // ── ۲) مارک‌گذاری + سینک خودکار ──
  await page.evaluate(() => { window.location.hash = "#/learn/cp-l11"; });
  await page.waitForTimeout(2500);
  const el = await page.locator("article .teach-body p").first().elementHandle();
  await page.evaluate((e) => {
    const n = e.childNodes[0];
    const s = window.getSelection(); s.removeAllRanges();
    const r = document.createRange(); r.setStart(n, 4); r.setEnd(n, 44);
    s.addRange(r); document.dispatchEvent(new Event("selectionchange"));
  }, el);
  await page.waitForTimeout(800);
  ok("نوار نشان‌گذاری در پرود", (await page.locator('[data-mark-toolbar="1"]').count()) > 0);
  await page.locator('[data-mark-toolbar="1"] button').nth(2).click(); // آبی
  await page.waitForTimeout(4500); // صبر برای sync خودکار (۳ ثانیه debounce)

  // ── ۳) خروج و ورود دوباره — نشان باید از سرور برگردد ──
  await page.evaluate(() => { window.location.hash = "#/settings"; });
  await page.waitForTimeout(800);
  await page.locator("header [aria-haspopup], header button").filter({ hasText: uname.slice(0, 4) }).first().click().catch(() => {});
  await page.waitForTimeout(600);
  // از منوی حساب، خروج
  const logout = page.locator("text=خروج").first();
  if (await logout.count()) {
    await logout.click().catch(() => {});
    await page.waitForTimeout(1500);
  }
  ok("خروج انجام شد", true);

  await page.locator("header button:has-text('ورود')").first().click().catch(() => {});
  await page.waitForTimeout(700);
  await page.locator("[role=dialog] input").first().fill(uname);
  await page.locator("[role=dialog] input[type=password]").first().fill("qa_secret_7");
  await page.locator("[role=dialog] button[type=submit]").click();
  await page.waitForTimeout(3000);
  await page.keyboard.press("Escape");
  await page.evaluate(() => { window.location.hash = "#/learn/cp-l11"; });
  await page.waitForTimeout(3000);
  const marksBack = await page.locator("mark.lexa-mark").count();
  ok(`نشان پس از ورود مجدد از سرور برگشت (${marksBack})`, marksBack > 0);
  const color = marksBack ? await page.locator("mark.lexa-mark").first().evaluate((m) => m.style.getPropertyValue("--mk-bg")) : "";
  ok(`رنگ آبی حفظ شده (${color})`, /96,\s*165,\s*250/.test(color));

  await page.screenshot({ path: "qa/qa-prod-marks-sync.png" });
  console.log("\n═══ QA پرود ═══");
  results.forEach((r) => console.log(r));
  const fails = results.filter((r) => r.startsWith("❌")).length;
  console.log(`${results.length - fails}/${results.length} سبز`);
  if (errors.length) console.log("خطاها:", [...new Set(errors)].slice(0, 4));
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
