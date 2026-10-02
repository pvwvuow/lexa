/* QA نشان‌گذاری متن — انتخاب، رنگ، ماندگاری، ویرایش/حذف */
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 850 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

  const results = [];
  const ok = (name, cond) => results.push(`${cond ? "✅" : "❌"} ${name}`);

  // ۱) ورود مستقیم به یک جلسهٔ داخلی
  await page.goto("http://localhost:3000/#/learn/cp-l11", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  // ۲) پیدا کردن یک پاراگراف متن درس
  const bodyP = page.locator("article .teach-body p").first();
  const pCount = await bodyP.count();
  ok("پاراگراف متن درس یافت شد", pCount > 0);
  const el = await bodyP.first().elementHandle();
  if (!el) throw new Error("no paragraph");
  const secHost = await page.evaluateHandle((n) => n.closest("[data-sec-id]"), el);

  // ۳) شبیه‌سازی انتخاب متن با Range API (مانند کشیدن ماوس)
  await page.evaluate((p) => {
    const node = p.childNodes.length ? p.childNodes[0] : p;
    const len = (node.textContent || "").length;
    const sel = window.getSelection();
    sel.removeAllRanges();
    const range = document.createRange();
    range.setStart(node, Math.min(4, len));
    range.setEnd(node, Math.min(40, len));
    sel.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  }, el);

  await page.waitForTimeout(700);
  const toolbarVisible = await page.locator('[data-mark-toolbar="1"]').count();
  ok("نوار ابزار نشان‌گذاری نمایان شد", toolbarVisible > 0);

  // ۴) کلیک روی رنگ زرد
  await page.locator('[data-mark-toolbar="1"] button').first().click();
  await page.waitForTimeout(600);
  const markCount = await page.locator("mark.lexa-mark").count();
  ok("نشان زرد روی متن اعمال شد", markCount > 0);
  const bg = markCount ? await page.locator("mark.lexa-mark").first().evaluate((m) => getComputedStyle(m).backgroundColor) : "";
  ok(`پس‌زمینهٔ نشان رنگی است (${bg})`, /rgba?\(/.test(bg) && !/0, 0, 0, 0/.test(bg));

  // ۵) ماندگاری پس از رفرش
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("article .teach-body p", { timeout: 30000 });
  await page.waitForTimeout(1200);
  const markAfterReload = await page.locator("mark.lexa-mark").count();
  ok("نشان پس از رفرش دوباره رندر شد", markAfterReload > 0);

  // ۶) استور محلی
  const storeHasMarks = await page.evaluate(() => {
    const raw = localStorage.getItem("lexa-store-v1");
    if (!raw) return false;
    const st = JSON.parse(raw);
    return st.state && typeof st.state.marks === "object" && Object.keys(st.state.marks).length > 0;
  });
  ok("استور persist شامل marks است", storeHasMarks);

  // ۷) کلیک روی نشان → نوار ویرایش با دکمهٔ حذف
  await page.locator("mark.lexa-mark").first().click();
  await page.waitForTimeout(500);
  const editToolbar = await page.locator('[data-mark-toolbar="1"]').count();
  ok("نوار ویرایش/حذف پس از کلیک روی نشان باز شد", editToolbar > 0);
  if (editToolbar) {
    // تغییر رنگ به آبی (دکمهٔ سوم)
    await page.locator('[data-mark-toolbar="1"] button').nth(2).click();
    await page.waitForTimeout(500);
    const blueBg = await page.locator("mark.lexa-mark").first().evaluate((m) => m.style.getPropertyValue("--mk-bg"));
    ok(`تغییر رنگ نشان به آبی (${blueBg})`, /96,\s*165,\s*250/.test(blueBg));

    // حذف
    await page.locator("mark.lexa-mark").first().click();
    await page.waitForTimeout(400);
    const btns = await page.locator('[data-mark-toolbar="1"] button').count();
    await page.locator('[data-mark-toolbar="1"] button').nth(btns - 1).click();
    await page.waitForTimeout(500);
    const afterDelete = await page.locator("mark.lexa-mark").count();
    ok("نشان حذف شد", afterDelete === 0);
  }

  // المان تازه بعد از رفرش
  const el2 = await page.locator("article .teach-body p").first().elementHandle();

  // ۸) دوباره یک نشان بساز برای تست سینک (بماند در استور)
  await page.evaluate((p) => {
    const node = p.childNodes.length ? p.childNodes[0] : p;
    const len = (node.textContent || "").length;
    const sel = window.getSelection();
    sel.removeAllRanges();
    const range = document.createRange();
    range.setStart(node, Math.min(4, len));
    range.setEnd(node, Math.min(60, len));
    sel.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  }, el2);
  await page.waitForTimeout(700);
  if (await page.locator('[data-mark-toolbar="1"]').count()) {
    await page.locator('[data-mark-toolbar="1"] button').first().click();
    await page.waitForTimeout(400);
  }

  await page.screenshot({ path: "qa/qa-marks-lesson.png" });

  console.log("\n═══ نتایج QA نشان‌گذاری ═══");
  results.forEach((r) => console.log(r));
  const fails = results.filter((r) => r.startsWith("❌")).length;
  console.log(`\n${results.length - fails}/${results.length} سبز`);
  if (errors.length) {
    console.log("\nخطاهای کنسول:");
    errors.slice(0, 5).forEach((e) => console.log(" ⚠", e));
  }
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
