// QA فیکس‌های این مرحله: شیت «بیشتر» + مهلت «جلسه پیدا نشد» + دوره‌های اساتید در کتابخانه
import { chromium, devices } from "playwright";
const BASE = process.env.BASE || "http://127.0.0.1:3210";
let pass = 0, fail = 0;
function ok(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name} ${extra}`); }
}
const browser = await chromium.launch();
const errors = [];

/* ═══ موبایل — شیت بیشتر در پایان درس ═══ */
{
  const ctx = await browser.newContext({ ...devices["Pixel 7"], locale: "fa-IR" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text().slice(0, 200)); });

  await page.goto(BASE + "/#/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(9000); // صبر نصب خودکار بستهٔ غایبی

  // درس غایبی با لینک درست
  await page.evaluate(() => { location.hash = "#/learn/ls-md7g-01"; });
  await page.waitForTimeout(2500);
  ok("درس غایبی رندر شد", (await page.locator("article [data-sec-id]").count()) > 0);

  // باز کردن همهٔ بخش‌ها تا پایان
  for (let i = 0; i < 40; i++) {
    const btn = page.locator("button:has-text('ادامه بده')");
    if ((await btn.count()) === 0) break;
    await btn.first().tap();
    await page.waitForTimeout(180);
  }
  let lastY = -1;
  for (let i = 0; i < 25; i++) {
    const y = await page.evaluate(() => window.scrollY);
    if (y === lastY) break;
    lastY = y;
    await page.waitForTimeout(150);
  }
  ok("همهٔ بخش‌ها باز شد (پایان مبحث)", (await page.locator("article [data-sec-id]").count()) >= 2);

  // تپ روی بیشتر → شیت باز شود، بدون تغییر hash
  const hashBefore = await page.evaluate(() => location.hash);
  await page.locator("button[aria-label='کنش‌های بیشتر']").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.locator("button[aria-label='کنش‌های بیشتر']").first().tap();
  await page.waitForTimeout(700);
  const sheet1 = await page.evaluate(() => {
    const menu = document.querySelector("[role='menu'][aria-label='کنش‌های بیشتر جلسه']");
    const r = menu?.getBoundingClientRect();
    return { open: !!menu, bottom: r ? Math.round(r.bottom) : null, innerH: innerHeight, hash: location.hash, items: menu ? menu.querySelectorAll("[role='menuitem']").length : 0 };
  });
  ok("شیت بیشتر باز شد", sheet1.open);
  ok("باز شدن شیت ناوبری نکرد (hash ثابت)", sheet1.hash === hashBefore, sheet1.hash);
  ok("شیت بالای داک موبایل است", sheet1.bottom !== null && sheet1.bottom <= sheet1.innerH, JSON.stringify(sheet1));
  ok("همهٔ آیتم‌ها هست (۵ آیتم)", sheet1.items === 5, String(sheet1.items));
  await page.screenshot({ path: "qa/fix-more-sheet.png" });

  // بستن با لمس بیرون
  await page.touchscreen.tap(30, 120);
  await page.waitForTimeout(400);
  ok("لمس بیرون شیت را بست", !(await page.evaluate(() => !!document.querySelector("[role='menu'][aria-label='کنش‌های بیشتر جلسه']"))));

  // دوباره باز + Escape
  await page.locator("button[aria-label='کنش‌های بیشتر']").first().tap();
  await page.waitForTimeout(400);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  ok("Escape شیت را بست", !(await page.evaluate(() => !!document.querySelector("[role='menu'][aria-label='کنش‌های بیشتر جلسه']"))));

  // دوباره باز → «بازگشت به فهرست درس» → نمای دورهٔ غایبی با محتوا
  await page.locator("button[aria-label='کنش‌های بیشتر']").first().tap();
  await page.waitForTimeout(400);
  await page.locator("[role='menuitem']:has-text('بازگشت به فهرست درس')").first().tap();
  await page.waitForTimeout(1200);
  const courseSt = await page.evaluate(() => ({ hash: location.hash, has: (document.body.innerText || "").includes("تدریس مدنی ۷ — استاد غایبی") }));
  ok("آیتم بازگشت → نمای دورهٔ غایبی با محتوا", courseSt.hash === "#/course/course-tadris-madani7-ghayebi" && courseSt.has, JSON.stringify(courseSt));

  // دوباره درس → شیت → «تمرین کیس واقعی»
  await page.evaluate(() => { location.hash = "#/learn/ls-md7g-01"; });
  await page.waitForTimeout(2000);
  await page.locator("button[aria-label='کنش‌های بیشتر']").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.locator("button[aria-label='کنش‌های بیشتر']").first().tap();
  await page.waitForTimeout(400);
  const caseItem = page.locator("[role='menuitem']:has-text('تمرین کیس واقعی')");
  if (await caseItem.count()) {
    await caseItem.first().tap();
    await page.waitForTimeout(1400);
    const cs = await page.evaluate(() => ({ hash: location.hash, has: (document.body.innerText || "").includes("پرونده") }));
    ok("آیتم تمرین کیس → نمای کیس", cs.hash.startsWith("#/case/") && cs.has, JSON.stringify(cs));
  } else {
    ok("آیتم تمرین کیس در شیت", false, "پیدا نشد");
  }
  // صفر خطا در این کانتکست جمع می‌شود
  await ctx.close();
}

/* ═══ مهلت «جلسه پیدا نشد» — لینک مستقیم قبل از ادغام بسته‌ها ═══ */
{
  const ctx = await browser.newContext({ ...devices["Pixel 7"], locale: "fa-IR" });
  const page = await ctx.newPage();
  await page.goto(BASE + "/#/learn/ls-md7g-01", { waitUntil: "commit", timeout: 60000 });
  await page.waitForTimeout(1200);
  const early = await page.evaluate(() => ({
    loading: (document.body.innerText || "").includes("در حال آماده‌سازی درس"),
    notFoundYet: (document.body.innerText || "").includes("جلسه پیدا نشد"),
    rendered: document.querySelectorAll("article [data-sec-id]").length > 0,
  }));
  ok("مهلت آماده‌سازی به‌جای پیام فوری", early.loading || early.rendered, JSON.stringify(early));
  await page.waitForTimeout(6000);
  const late = await page.evaluate(() => ({
    rendered: document.querySelectorAll("article [data-sec-id]").length > 0,
    notFound: (document.body.innerText || "").includes("جلسه پیدا نشد"),
  }));
  ok("درس غایبی پس از ادغام بسته رندر شد", late.rendered && !late.notFound, JSON.stringify(late));
  await ctx.close();
}

/* ═══ کتابخانهٔ عمومی — بخش دوره‌های اساتید نصب‌شده ═══ */
{
  const ctx = await browser.newContext({ ...devices["Pixel 7"], locale: "fa-IR" });
  const page = await ctx.newPage();
  await page.goto(BASE + "/#/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(9000);
  await page.evaluate(() => { location.hash = "#/library"; });
  await page.waitForTimeout(1500);
  await page.locator("button:has-text('همه')").first().tap();
  await page.waitForTimeout(2500);
  const lib = await page.evaluate(() => {
    const txt = document.body.innerText || "";
    return { section: txt.includes("دوره‌های اساتید روی این دستگاه"), ghayebi: txt.includes("تدریس مدنی ۷ — استاد غایبی"), apkBox: txt.includes("در دسترس نیست") };
  });
  ok("بخش «دوره‌های اساتید روی این دستگاه» در کتابخانه", lib.section, JSON.stringify(lib));
  ok("کارت درس غایبی در کتابخانه دیده می‌شود", lib.ghayebi);
  // باز کردن درس از خود کارت غایبی (کارت شامل عنوان)
  const ghCard = page.locator("div.rounded-2xl", { hasText: "تدریس مدنی ۷ — استاد غایبی" }).filter({ has: page.locator("button:text-is('مطالعه')") }).first();
  await ghCard.locator("button:text-is('مطالعه')").tap();
  await page.waitForTimeout(1500);
  const nav = await page.evaluate(() => location.hash);
  ok("کارت کتابخانه به نمای دوره می‌رود", nav === "#/course/course-tadris-madani7-ghayebi", nav);
  await ctx.close();
}

ok("صفر خطای کنسول/صفحه", errors.length === 0, errors.slice(0, 4).join(" | "));
console.log(`\nنتیجه: ${pass} ✓ / ${fail} ✗`);
await browser.close();
process.exit(fail ? 1 : 0);
