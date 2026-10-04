// ─── QA تسک ۲۶ — v0.10.6 «همه‌چیز خودکار و ساده» ─────────────────────────────
// ۱) زبانهٔ هوش مصنوعی: حالت سادهٔ پیش‌فرض («نیازی به هیچ تنظیمی نیست») + تنظیمات
//    پیشرفته پشت بازکننده — بدون «دمای مدل» و اصطلاح فنی در نمای اولیه
// ۲) زبانهٔ به‌روزرسانی‌ها: بدون jsDelivr/گیت‌هاب/کاتالوگ/مانیفست — نصب خودکار سر جایش
// ۳) زبانهٔ آفلاین: بدون «Service Worker» و نمایش نسخه‌های فنی
// ۴) نوار به‌روزرسانی خودکار دسکتاپ: کشف نسخه → دانلود خودکار بدون کلیک → «نصب شد»
//    → راه‌اندازی مجدد اختیاری (با ماک window.lexaDesktop)
// ۵) صفر خطای کنسول
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://127.0.0.1:3210";
let pass = 0, fail = 0;
function ok(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name} ${extra}`); }
}

const browser = await chromium.launch();

/* ═══ بخش ۱ — زبانه‌های تنظیمات روی وب ═══ */

const errors = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (e) => errors.push("pageerror: " + String(e)));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text()); });

await page.goto(BASE + "/#/home", { waitUntil: "networkidle" });
await page.waitForTimeout(1800);
ok("خانه رندر شد", (await page.locator("header.sticky.top-0").count()) > 0);

await page.goto(BASE + "/#/settings", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
ok("تنظیمات باز شد", (await page.locator("text=تنظیمات").first().isVisible()));

// ── زبانهٔ هوش مصنوعی ──
await page.locator("[role='tab']:has-text('هوش مصنوعی')").click();
await page.waitForTimeout(700);
const aiText = await page.evaluate(() => document.body.innerText);
ok("کارت سادهٔ «استاد هوشمند» هست", aiText.includes("استاد هوشمند"));
ok("حالت پیش‌فرض: «نیازی به هیچ تنظیمی نیست»", aiText.includes("نیازی به هیچ تنظیمی نیست"));
ok("پیش از باز کردن، کارت‌های پروایدر پنهان‌اند", !aiText.includes("استاد داخلی (پیشفرض)"));
ok("«دمای مدل» کلاً حذف شد", !aiText.includes("دمای مدل"));
ok("«تست اتصال» به «آزمودن استاد» تبدیل شد (در نمای بسته هم نیست)", !aiText.includes("تست اتصال"));
await page.locator("button:has-text('تنظیمات پیشرفته')").click();
await page.waitForTimeout(600);
const aiText2 = await page.evaluate(() => document.body.innerText);
ok("پس از باز کردن، پروایدرها دیده می‌شوند", aiText2.includes("استاد داخلی (پیشفرض)") && aiText2.includes("Google Gemini"));
// با پروایدر پیش‌فرض (داخلی) فیلد کلید نیست — سوییچ به گمینی برای دیدن فیلد «کلید شخصی»
await page.locator("button:has-text('Google Gemini')").click();
await page.waitForTimeout(500);
const aiText3 = await page.evaluate(() => document.body.innerText);
ok("«کلید API» به «کلید شخصی» ساده شد", !aiText3.includes("کلید API *") && aiText3.includes("کلید شخصی"));
ok("«آدرس پایه (Base URL)» به «آدرس سرویس» ساده شد", !aiText3.includes("Base URL"));

// ── زبانهٔ به‌روزرسانی‌ها ──
await page.locator("[role='tab']:has-text('به‌روزرسانی‌ها')").click();
await page.waitForTimeout(900);
const cuText = await page.evaluate(() => document.body.innerText);
ok("کلید «نصب خودکار بسته‌ها» سر جایش است", cuText.includes("نصب خودکار بسته‌ها"));
ok("بدون jsDelivr", !cuText.includes("jsDelivr"));
ok("بدون گیت‌هاب", !cuText.includes("گیت‌هاب"));
ok("بدون «کاتالوگ»", !cuText.includes("کاتالوگ"));
ok("بدون «مانیفست»", !cuText.includes("مانیفست"));
ok("بدون «نسخهٔ کاتالوگ برخط»", !cuText.includes("نسخهٔ کاتالوگ برخط"));
ok("پانوشت رسمی ساده شده", cuText.includes("بسته‌ها فقط از منبع رسمی Lexa دریافت می‌شوند"));

// ── زبانهٔ آفلاین و نصب ──
await page.locator("[role='tab']:has-text('آفلاین و نصب')").click();
await page.waitForTimeout(900);
const offText = await page.evaluate(() => document.body.innerText);
ok("کارت نصب برنامه هست", offText.includes("نصب برنامه روی گوشی یا رایانه"));
ok("فهرست مطالب آفلاین هست", offText.includes("مطالب ذخیره‌شده برای مطالعهٔ آفلاین"));
ok("بدون «Service Worker»", !offText.includes("Service Worker"));
ok("بدون نمایش نسخهٔ بستهٔ طراحی", !offText.includes("نسخهٔ ذخیره‌شده روی دستگاه"));
ok("بدون «کش‌شده»", !offText.includes("کش‌شده"));

ok("بخش ۱ — صفر خطای کنسول", errors.length === 0, JSON.stringify(errors.slice(0, 3)));

/* ═══ بخش ۲ — نوار به‌روزرسانی خودکار دسکتاپ (ماک lexaDesktop) ═══ */

const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const errors2 = [];
ctx2.addInitScript(() => {
  const listeners = new Set();
  const state = { applyCalled: 0, restartCalled: 0 };
  Object.defineProperty(window, "__lexaUpdateMock", { get: () => state });
  const CHECK = {
    available: true, currentVersion: "0.10.5", remoteVersion: "0.10.6",
    notes: "", generatedAt: "", filesChanged: 3, bytesChanged: 1024, deletes: 0, tag: "",
  };
  window.lexaDesktop = {
    status: async () => ({ desktop: true, platform: "linux", version: "0.10.5", fromAppdata: false, feedOverride: false }),
    check: async () => CHECK,
    apply: async () => {
      state.applyCalled++;
      listeners.forEach((cb) => cb({ type: "apply:progress", phase: "download", filesDone: 1, filesTotal: 3, bytesDone: 300, bytesTotal: 1024 }));
      setTimeout(() => listeners.forEach((cb) => cb({ type: "apply:done", version: "0.10.6" })), 2200);
      return { ok: true, version: "0.10.6", changed: 3 };
    },
    restart: async () => { state.restartCalled++; },
    onEvent: (cb) => {
      listeners.add(cb);
      setTimeout(() => cb({ type: "check", check: CHECK }), 900);
      return () => listeners.delete(cb);
    },
  };
});
const page2 = await ctx2.newPage();
page2.on("pageerror", (e) => errors2.push("pageerror: " + String(e)));
page2.on("console", (m) => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors2.push(m.text()); });

await page2.goto(BASE + "/#/home", { waitUntil: "domcontentloaded" });
await page2.waitForTimeout(1600);

// کشف نسخه (رویداد check در ۰.۹ ثانیه) → قرص «آماده است»
const seenAvailable = await page2.locator("[role='status']:has-text('نسخهٔ تازهٔ Lexa آماده است')").waitFor({ timeout: 6000 }).then(() => true).catch(() => false);
ok("قرص «نسخهٔ تازه آماده است» بدون هیچ کلیکی ظاهر شد", seenAvailable);

// دانلود خودکار پس از مهلت ۴ ثانیه — بدون هیچ کلیکی
await page2.waitForTimeout(4500);
const mockState1 = await page2.evaluate(() => window.__lexaUpdateMock.applyCalled);
ok("دانلود/نصب خودکار شروع شد (بدون هیچ کلیکی از کاربر)", mockState1 === 1, "applyCalled=" + mockState1);
const seenDownloading = await page2.locator("[role='status']:has-text('در حال دریافت نسخهٔ تازه')").count();
ok("قرص پیشرفت دانلود دیده می‌شود", seenDownloading >= 1);

// پایان نصب → پیام «نصب شد» + دکمهٔ اختیاری راه‌اندازی مجدد
const seenDone = await page2.locator("[role='status']:has-text('به‌روزرسانی نصب شد')").waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
ok("پیام «به‌روزرسانی نصب شد» آمد", seenDone);
if (seenDone) {
  await page2.locator("button:has-text('راه‌اندازی مجدد الان')").click();
  await page2.waitForTimeout(500);
  const rs = await page2.evaluate(() => window.__lexaUpdateMock.restartCalled);
  ok("راه‌اندازی مجدد فقط با کلیک اختیاری کاربر", rs === 1, "restartCalled=" + rs);
}
ok("بخش ۲ — صفر خطای کنسول", errors2.length === 0, JSON.stringify(errors2.slice(0, 3)));

await browser.close();
console.log(`\nنتیجه: ${pass} پاس / ${fail} خطا`);
process.exit(fail ? 1 : 0);
