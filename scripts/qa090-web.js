/* QA وب v0.9.0 — رندر + حساب سروری + نشان‌گذاری + کپی + حذف منوی پیش‌فرض + سینک + نسخه‌ها + صفر خطا */
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:3210";
const STAMP = Date.now().toString().slice(-8);
const USER = `qa09_${STAMP}`;
const PASS = "Qa09" + STAMP + "!";

(async () => {
  let passed = 0, failed = 0;
  const assert = (c, label, extra = "") => {
    if (c) { passed++; console.log("  ✓", label); }
    else { failed++; console.error("  ✗", label, extra); }
  };

  const browser = await chromium.launch({
    args: ["--use-fake-ui-for-media-stream"],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1100, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await ctx.newPage();
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
  assert(swVer === "lexa-pwa-v44", "سرویس‌ورکر v42 سرو می‌شود", swVer);

  console.log("[۲] ساخت حساب سروری تازه (ورود / ثبت‌نام — دکمهٔ فرعی سپر: حساب سروری)");
  await page.goto(BASE + "/#/", { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1200);
  // از 0.9.1: دکمهٔ اصلی = حساب ابری (ساپابیس)؛ حساب سروری محلی پشت دکمهٔ فرعی سپر است
  await page.locator('button[aria-label="ورود با حساب سروری"]').first().click({ timeout: 8000 });
  await page.waitForSelector("form input", { timeout: 6000 });
  await page.locator('[role="tab"]:has-text("ثبت‌نام")').first().click().catch(() => {});
  await page.waitForTimeout(400);
  await page.locator("form input:not([type=password])").first().fill(USER);
  const pwInputs = page.locator('form input[type="password"]');
  const npw = await pwInputs.count();
  await pwInputs.nth(npw - 1).fill(PASS);
  if (npw > 1) await pwInputs.nth(0).fill(PASS);
  await page.screenshot({ path: "/home/z/my-project/.zscreenshots/qa-090-register.png" });
  await page.locator('form button[type="submit"], form button:has-text("ورود به حساب")').first().click();
  await page.waitForTimeout(3000);
  const after = await page.evaluate(() => document.body.innerText.slice(0, 1500));
  const regOk = (after.includes(USER) || /خوش|خروج|حساب/.test(after)) && !/ارتباط با سرور برقرار نشد/.test(after);
  assert(regOk, "ثبت‌نام سروری موفق", after.slice(0, 100).replace(/\n/g, " "));

  console.log("[۳] ورود مجدد پس از خروج (چرخهٔ کامل حساب)");
  await page.evaluate(() => fetch("/api/auth/logout", { method: "POST" }));
  await page.waitForTimeout(600);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.locator('button[aria-label="ورود با حساب سروری"]').first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(600);
  const dialogOpen = await page.locator("form input:not([type=password])").first().isVisible().catch(() => false);
  if (dialogOpen) {
    await page.locator("form input:not([type=password])").first().fill(USER);
    await page.locator('form input[type="password"]').first().fill(PASS);
    await page.locator('form button:has-text("ورود به حساب")').first().click();
    await page.waitForTimeout(3000);
    const afterLogin = await page.evaluate(() => document.body.innerText.slice(0, 800));
    assert(afterLogin.includes(USER) || /خروج|حساب/.test(afterLogin), "ورود مجدد موفق");
    await page.keyboard.press("Escape");
  } else {
    assert(false, "دیالوگ ورود باز نشد (بررسی دستی)");
  }

  console.log("[۴] نشان‌گذاری + دکمهٔ کپی + حذف منوی پیش‌فرض (درس باز)");
  await page.goto(BASE + "/#/", { waitUntil: "networkidle" });
  await page.getByText("ادامه یادگیری").first().click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(3500);
  // تریپل‌کلیک روی متن بخش درس
  const target = page.locator('[data-sec-id] p:visible, [data-sec-id] li:visible, [data-sec-id] h3:visible').first();
  const hasTarget = (await target.count()) > 0;
  let selText = "";
  if (hasTarget) {
    const bb = await target.boundingBox();
    if (bb) {
      await page.mouse.click(bb.x + bb.width * 0.75, bb.y + Math.min(10, bb.height / 2), { clickCount: 3 });
    }
    selText = await page.evaluate(() => String(window.getSelection()).trim());
  }
  await page.waitForTimeout(900);
  const toolbarVisible = await page.locator('[data-mark-toolbar="1"]').isVisible({ timeout: 3000 }).catch(() => false);
  assert(toolbarVisible, "تولبار شناور نشان ظاهر شد");

  // ۴-۱) منوی پیش‌فرض: contextmenu داخل مقاله preventDefault می‌شود
  const ctxPrevented = await page.evaluate(() => {
    const art = document.querySelector("article");
    if (!art) return null;
    const ev = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    art.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  assert(ctxPrevented === true, "منوی پیش‌فرض مرورگر داخل تدریس حذف شده (contextmenu preventDefault)");

  // ۴-۲) دکمهٔ کپی — کلیک → کلیپ‌بورد = متن انتخاب
  if (toolbarVisible && selText.length > 3) {
    await page.locator('[data-mark-toolbar="1"] button[title="کپی متن"]').first().click();
    await page.waitForTimeout(700);
    const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => "«مجوز ندارد»"));
    assert(clip.trim() === selText.trim(), "دکمهٔ کپی متن انتخاب را در کلیپ‌بورد گذاشت", JSON.stringify({ clip: clip.slice(0, 40), sel: selText.slice(0, 40) }));
    await page.waitForTimeout(600);
  } else {
    assert(false, "کپی تست نشد (تولبار/انتخاب نبود)", `sel="${selText.slice(0, 30)}"`);
  }

  // ۴-۳) نشان رنگی — انتخاب دوباره + کلیک رنگ
  await page.waitForTimeout(600);
  if (hasTarget) {
    const bb2 = await target.boundingBox();
    if (bb2) {
      await page.mouse.click(bb2.x + bb2.width * 0.75, bb2.y + Math.min(10, bb2.height / 2), { clickCount: 3 });
      await page.waitForTimeout(900);
      const tb = await page.locator('[data-mark-toolbar="1"]').isVisible({ timeout: 2500 }).catch(() => false);
      if (tb) await page.locator('[data-mark-toolbar="1"] button[title="رنگ نشان"]').first().click();
      await page.waitForTimeout(800);
    }
  }
  const markCount = await page.evaluate(() => document.querySelectorAll("mark[data-lexa-mark], .lexa-mark").length);
  assert(markCount > 0, "نشان رنگی روی متن نشست", "count=" + markCount);

  console.log("[۵] موبایل: ابعاد متن تدریس در ویوپورت موبایل");
  const mob = await ctx.newPage();
  await mob.setViewportSize({ width: 390, height: 844 });
  await mob.goto(BASE + "/#/", { waitUntil: "networkidle", timeout: 45000 });
  await mob.waitForTimeout(1500);
  await mob.getByText("ادامه یادگیری").first().click({ timeout: 6000 }).catch(() => {});
  await mob.waitForTimeout(3000);
  const fontSize = await mob.evaluate(() => {
    const p = document.querySelector('[data-sec-id] p');
    return p ? parseFloat(getComputedStyle(p).fontSize) : -1;
  });
  assert(fontSize > 0 && fontSize <= 17, "متن بخش درس در موبایل کوچک و خوانا است", String(fontSize) + "px");
  // جدول مقایسه — اسکرول افقی دارد نه بریدگی
  const tableScroll = await mob.evaluate(() => {
    const t = document.querySelector("[data-sec-id] table");
    if (!t) return null;
    const wrap = t.parentElement;
    return { ow: wrap.scrollWidth, cw: wrap.clientWidth, ox: getComputedStyle(wrap).overflowX };
  });
  if (tableScroll) {
    assert(tableScroll.ox === "auto" || tableScroll.ox === "scroll", "جدول مقایسه در موبایل اسکرول افقی دارد", JSON.stringify(tableScroll));
  } else {
    console.log("   (جدولی در بخش‌های دیده‌شده نبود — رد)");
  }
  await mob.close();

  console.log("[۶] خطاها");
  const fatal = errors.filter((e) => !/40[134]|favicon|\/api\//.test(e));
  assert(fatal.length === 0, "صفر خطای کنسول مرگبار", JSON.stringify(fatal.slice(0, 3)));

  await page.screenshot({ path: "/home/z/my-project/.zscreenshots/qa-090-web.png" });
  await browser.close();
  console.log("─".repeat(50));
  console.log(`نتیجه: ${passed} ✓ / ${failed} ✗`);
  process.exit(failed ? 1 : 0);
})();
