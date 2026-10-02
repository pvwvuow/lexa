// ─── QA 0.9.3 — کتابخانهٔ عمومی + زوم متن دروس + سوایپ منوی کشویی ────────────
// ۱) #/library همه‌جا (وب) رندر می‌شود با تب دوره‌های آماده و کارت‌ها
// ۲) توگل «افزودن به عنوان کتاب» روی دورهٔ آماده → فهرست مطالعه بدون آن/با آن
// ۳) زوم درس: درصد، رشد واقعی متن، ماندگاری پس از رفرش، مرز منطقی (۹۰..۱۶۰)
// ۴) سوایپ از لبهٔ راست منو را باز می‌کند و سوایپ به راست می‌بندد (موبایل لمسی)
// ۵) صفر خطای کنسول
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3210";
let pass = 0, fail = 0;
function ok(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name} ${extra}`); }
}

const browser = await chromium.launch();
const errors = [];

/* ═══ دسکتاپ: کتابخانه + زوم ═══ */
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
page.on("pageerror", (e) => errors.push("pageerror: " + String(e)));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text()); });

await page.goto(BASE + "/#/library", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
ok("کتابخانهٔ عمومی رندر شد", await page.getByText("کتابخانهٔ عمومی").first().isVisible());
const builtinCards = await page.locator("text=دورهٔ آمادهٔ Lexa").count();
ok(`کارتهای دوره‌های آماده (${builtinCards})`, builtinCards > 0);
const lawChip = await page.locator("text=کتابخانهٔ قوانین ←").count();
ok("میان‌بر کتابخانهٔ قوانین در تب‌ها", lawChip === 1);

// توگل دورهٔ آماده به عنوان کتاب (مهمان — محلی): حالت پیش‌فرض «در کتابخانهٔ توست» است
// → با حذف (Trash) از کتابخانهٔ من خارج و در فهرست مطالعه ناپدید می‌شود؛ سپس برگشت
await page.goto(BASE + "/#/study", { waitUntil: "networkidle" });
await page.waitForTimeout(700);
const madaniVisible0 = await page.locator("text=حقوق مدنی ۱").first().isVisible().catch(() => false);
ok("«حقوق مدنی ۱» پیش از حذف در فهرست مطالعه هست", madaniVisible0);
await page.goto(BASE + "/#/library", { waitUntil: "networkidle" });
await page.waitForTimeout(700);
ok("کارت دورهٔ آماده «در کتابخانهٔ مطالعهٔ توست»", (await page.locator("button:has-text('در کتابخانهٔ مطالعهٔ توست')").count()) > 0);
await page.locator("button[aria-label^='حذف']").first().click();
await page.waitForTimeout(700);
ok("پس از حذف: «افزودن به عنوان کتاب»", (await page.locator("button:has-text('افزودن به عنوان کتاب')").count()) > 0);
const hidden = await page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem("lexa-store-v1") || "{}")?.state?.hiddenBuiltins ?? []; } catch { return []; }
});
ok("hiddenBuiltins در استور ثبت شد", Array.isArray(hidden) && hidden.length > 0, JSON.stringify(hidden));
await page.goto(BASE + "/#/study", { waitUntil: "networkidle" });
await page.waitForTimeout(700);
const madaniVisible1 = await page.locator("text=حقوق مدنی ۱").first().isVisible().catch(() => false);
ok("«حقوق مدنی ۱» پس از حذف از فهرست مطالعه رفت", !madaniVisible1);
// برگرداندن — وضعیت تمیز برای ادامهٔ تست
await page.goto(BASE + "/#/library", { waitUntil: "networkidle" });
await page.waitForTimeout(700);
await page.locator("button:has-text('افزودن به عنوان کتاب')").first().click();
await page.waitForTimeout(500);
await page.goto(BASE + "/#/study", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
ok("با افزودن دوباره به فهرست مطالعه برگشت", await page.locator("text=حقوق مدنی ۱").first().isVisible().catch(() => false));

// ── زوم درس
await page.goto(BASE + "/#/learn/m-l1-1", { waitUntil: "networkidle" });
await page.waitForSelector("article[data-sec-id], article [data-sec-id]", { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(2500); // متن تنبل + رندر بخش‌ها
const article = page.locator("article").first();
ok("مقالهٔ درس رندر شد", (await article.count()) === 1);
const zoomBar = page.locator("text=اندازهٔ متن").first();
ok("نوار زوم در هدر درس", await zoomBar.isVisible());

async function firstParaHeight() {
  return article.locator("p").first().evaluate((el) => el.getBoundingClientRect().height);
}
const h0 = await firstParaHeight();
const zoomLabel0 = await page.locator("span[dir='ltr']:near(:text('اندازهٔ متن'))").first().textContent().catch(() => "");
await page.locator("button[aria-label='بزرگ‌کردن اندازهٔ متن']").click();
await page.locator("button[aria-label='بزرگ‌کردن اندازهٔ متن']").click(); // ۱۰۰٪ → ۱۲۰٪
await page.waitForTimeout(400);
const h1 = await firstParaHeight();
ok(`متن واقعاً بزرگ شد (${h0.toFixed(0)}px → ${h1.toFixed(0)}px)`, h1 > h0 * 1.1, `ratio=${(h1 / h0).toFixed(2)}`);
const zoomLabel = await page.locator("span[dir='ltr']").filter({ hasText: /٪/ }).first().textContent().catch(() => "");
ok(`برچسب درصد = ${zoomLabel}`, !!zoomLabel && zoomLabel.includes("۱۲۰"), `label=${zoomLabel}`);
const savedZoom = await page.evaluate(() => localStorage.getItem("lexa-lesson-zoom"));
ok("زوم در localStorage ماندگار شد", savedZoom === "1.2", `saved=${savedZoom}`);

// ماندگاری پس از رفرش
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1800);
const zoomAfterReload = await page.evaluate(() => document.querySelector("article")?.style?.zoom || "");
ok("پس از رفرش zoom=1.2 اعمال است", zoomAfterReload === "1.2", `zoom=${zoomAfterReload}`);

// مرز منطقی: کلیک تا جایی که دکمه بگذارد → حداکثر ۱۶۰٪ و دکمه غیرفعال
const plusBtn = page.locator("button[aria-label='بزرگ‌کردن اندازهٔ متن']");
for (let i = 0; i < 6; i++) {
  if (!(await plusBtn.isEnabled().catch(() => false))) break;
  await plusBtn.click({ timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(120);
}
const maxed = await page.locator("span[dir='ltr']").filter({ hasText: /٪/ }).first().textContent().catch(() => "");
const plusDisabled = !(await plusBtn.isEnabled().catch(() => true));
ok(`سقف زوم ۱۶۰٪ (label=${maxed}, disabled=${plusDisabled})`, maxed?.includes("۱۶۰") && plusDisabled);
// کوچک‌تر تا کف ۹۰٪
const minusBtn = page.locator("button[aria-label='کوچک‌کردن اندازهٔ متن']");
for (let i = 0; i < 9; i++) {
  if (!(await minusBtn.isEnabled().catch(() => false))) break;
  await minusBtn.click({ timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(120);
}
const mined = await page.locator("span[dir='ltr']").filter({ hasText: /٪/ }).first().textContent().catch(() => "");
const minusDisabled = !(await minusBtn.isEnabled().catch(() => true));
ok(`کف زوم ۹۰٪ (label=${mined}, disabled=${minusDisabled})`, mined?.includes("۹۰") && minusDisabled);
// بازنشانی
await page.locator("button[aria-label='بازنشانی اندازهٔ متن']").click();
await page.waitForTimeout(200);
ok("بازنشانی به ۱۰۰٪", (await page.evaluate(() => localStorage.getItem("lexa-lesson-zoom"))) === "1");

/* ═══ موبایل لمسی: سوایپ منوی کشویی ═══ */
const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
mob.on("pageerror", (e) => errors.push("mob pageerror: " + String(e)));
mob.on("console", (m) => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text()); });
await mob.goto(BASE, { waitUntil: "networkidle" });
await mob.waitForTimeout(1200);

async function swipe(x0, y0, x1, y1) {
  await mob.evaluate(([x0, y0, x1, y1]) => {
    const el = document.elementFromPoint(x0, y0) ?? document.body;
    const mk = (x, y) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y, radiusX: 2, radiusY: 2, rotationAngle: 0, force: 1 });
    el.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [mk(x0, y0)], targetTouches: [mk(x0, y0)], changedTouches: [mk(x0, y0)] }));
    el.dispatchEvent(new TouchEvent("touchmove", { bubbles: true, cancelable: true, touches: [mk(x1, y1)], targetTouches: [mk(x1, y1)], changedTouches: [mk(x1, y1)] }));
    el.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [mk(x1, y1)] }));
  }, [x0, y0, x1, y1]);
  await mob.waitForTimeout(500);
}

const drawerOpen = () => mob.locator("text=منوی Lexa").first().isVisible().catch(() => false);

ok("شروع: منو بسته است", !(await drawerOpen()));
// باز کردن: از لبهٔ راست به چپ (۳۸۵ → ۲۸۵)
await swipe(385, 420, 285, 420);
ok("سوایپ راست→چپ از لبهٔ راست منو را باز کرد", await drawerOpen());
// بستن: از داخل منو به راست (۲۰۰ → ۳۲۰)
await swipe(200, 420, 320, 420);
ok("سوایپ چپ→راست منو را بست", !(await drawerOpen()));
// اسکرول عمودی نباید منو را باز کند (dx کوچک)
await swipe(385, 420, 380, 600);
await mob.waitForTimeout(300);
ok("کشیدن عمودی منو را باز نکرد", !(await drawerOpen()));
// دکمهٔ منو همچنان کار می‌کند
await mob.locator("nav[aria-label='ناوبری پایین'] button:has-text('منو')").click();
await mob.waitForTimeout(600);
ok("دکمهٔ منو در داک هم منو را باز می‌کند", await drawerOpen());
await swipe(200, 420, 320, 420);
await mob.waitForTimeout(300);
ok("سوایپ بستن دوباره کار کرد", !(await drawerOpen()));

// کتابخانه در موبایل وب هم هست
await mob.goto(BASE + "/#/library", { waitUntil: "networkidle" });
await mob.waitForTimeout(800);
ok("کتابخانهٔ عمومی در موبایل وب رندر شد", await mob.locator("h1").filter({ hasText: "کتابخانهٔ عمومی" }).first().isVisible().catch(() => false));

ok("صفر خطای کنسول/صفحه", errors.length === 0, JSON.stringify(errors.slice(0, 3)));

await browser.close();
console.log(`\nنتیجه: ${pass} سبز / ${fail} سرخ`);
if (fail > 0) process.exit(1);
