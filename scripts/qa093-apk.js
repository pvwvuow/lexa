// ─── QA 0.9.3 — کتابخانهٔ عمومی در اکسپورت APK ────────────────────────────────
// ۱) داک «کتابخانه» → صفحهٔ کتابخانهٔ عمومی (نه قوانین/نه پیام در دسترس نیست)
// ۲) تب دوره‌های آماده: کارت‌های باندل + حذف/افزودن محلی
// ۳) تب‌های اساتید: پیام راهنمای مخصوص APK (بدون «در دسترس نیست» و بدون لود بی‌نهایت)
// ۴) نشان کتابخانهٔ قوانین در تب‌ها هست
import { chromium } from "playwright";
let pass = 0, fail = 0;
const ok = (n, c, e = "") => { if (c) { pass++; console.log("  ✓ " + n); } else { fail++; console.error("  ✗ " + n + " " + e); } };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
await page.goto("http://localhost:3001/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

// از داک به کتابخانه
await page.locator("nav[aria-label='ناوبری پایین'] button:has-text('کتابخانه')").click();
await page.waitForTimeout(1200);
const h1 = await page.locator("h1").filter({ hasText: "کتابخانهٔ عمومی" }).first().isVisible().catch(() => false);
ok("داک «کتابخانه» → کتابخانهٔ عمومی باز شد", h1);
const apkyUnavail = await page.locator("text=این بخش به سرور مرکزی Lexa وصل است").count();
ok("بدون پیام «در دسترس نیست» برای کتابخانه", apkyUnavail === 0);
const cards = await page.locator("text=دورهٔ آمادهٔ Lexa").count();
ok(`کارت‌های دوره‌های آماده (${cards})`, cards >= 3);
ok("میان‌بر کتابخانهٔ قوانین هست", (await page.locator("text=کتابخانهٔ قوانین ←").count()) === 1);

// توگل محلی: حذف و افزودن
await page.locator("button[aria-label^='حذف']").first().click();
await page.waitForTimeout(600);
ok("حذف محلی کار کرد («افزودن به عنوان کتاب»)", (await page.locator("button:has-text('افزودن به عنوان کتاب')").count()) > 0);

// تب اساتید در APK → پیام راهنما (بدون لودینگ بی‌نهایت)
await page.locator("button:has-text('همه')").first().click();
await page.waitForTimeout(1200);
const teacherNote = await page.locator("text=مطالب و دوره‌های اساتید").count();
const spinner = await page.locator(".animate-spin").count();
ok("پیام راهنمای بخش اساتید در APK", teacherNote >= 1);
ok("بدون لودینگ بی‌نهایت در تب اساتید", spinner === 0);

// سوایپ منو در اکسپورت APK هم
const swipe = async (x0, y0, x1, y1) => {
  await page.evaluate(([x0, y0, x1, y1]) => {
    const el = document.elementFromPoint(x0, y0) ?? document.body;
    const mk = (x, y) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y, radiusX: 2, radiusY: 2, rotationAngle: 0, force: 1 });
    el.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [mk(x0, y0)], targetTouches: [mk(x0, y0)], changedTouches: [mk(x0, y0)] }));
    el.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [mk(x1, y1)] }));
  }, [x0, y0, x1, y1]);
  await page.waitForTimeout(500);
};
await swipe(385, 420, 275, 420);
ok("سوایپ لبهٔ راست در APK منو را باز کرد", await page.locator("text=منوی Lexa").first().isVisible().catch(() => false));
await swipe(200, 420, 320, 420);
await page.waitForTimeout(300);
ok("سوایپ بستن در APK کار کرد", !(await page.locator("text=منوی Lexa").first().isVisible().catch(() => false)));

ok("صفر خطای صفحه", errors.length === 0, JSON.stringify(errors.slice(0, 2)));
await page.screenshot({ path: "qa/093-apk-library.png" });
await browser.close();
console.log(`\nنتیجه: ${pass} سبز / ${fail} سرخ`);
if (fail > 0) process.exit(1);
