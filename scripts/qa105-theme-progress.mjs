// ─── QA تسک ۲۵ — v0.10.5 ────────────────────────────────────────────────────
// ۱) دکمهٔ تم نوار بالا و دکمهٔ تم منوی کشویی همیشه هماهنگ‌اند (استور مشترک)
// ۲) تعویض تم ضدلگ: کلاس theme-switching در لحظهٔ سوییچ هست و دو فریم بعد برداشته می‌شود
// ۳) چرخهٔ سه‌حالته روز → شب → شیشه‌ای → روز با کلاس‌های درست html + localStorage
// ۴) بخش «پیشرفت» کلاً حذف شده: نه در سایدبار، نه در منوی کشویی، و #/progress به خانه برمی‌گردد
// ۵) صفر خطای کنسول
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://127.0.0.1:3210";
let pass = 0, fail = 0;
function ok(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name} ${extra}`); }
}

const browser = await chromium.launch();
const errors = [];

const HEAD_BTN = 'header.sticky.top-0 button[aria-label^="تغییر تم"]';
const DRAWER_BTN = '[role="dialog"][aria-label="منو"] button[aria-label^="تغییر تم"]';

const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
page.on("pageerror", (e) => errors.push("pageerror: " + String(e)));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text()); });

await page.goto(BASE + "/#/home", { waitUntil: "networkidle" });
await page.waitForTimeout(1800);
ok("خانه رندر شد", (await page.locator("text=Lexa").first().isVisible()) || (await page.locator("header.sticky.top-0").count()) > 0);

// تم اولیه را روشن می‌کنیم تا چرخه از نقطهٔ معلوم شروع شود
await page.evaluate(() => { localStorage.setItem("lexa-theme", "light"); localStorage.setItem("theme", "light"); });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// ── باز کردن منوی کشویی برای دسترسی به دکمهٔ تم دوم ──
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('nav[aria-label="ناوبری پایین"] button')].find((b) => (b.textContent || "").includes("منو"));
  btn?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
});
await page.waitForTimeout(250);
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('nav[aria-label="ناوبری پایین"] button')].find((b) => (b.textContent || "").includes("منو"));
  btn?.click();
});
await page.waitForSelector('[role="dialog"][aria-label="منو"]', { timeout: 4000 });
await page.waitForTimeout(350);

const titleOf = (sel) => page.getAttribute(sel, "title");
const t0h = await titleOf(HEAD_BTN);
const t0d = await titleOf(DRAWER_BTN);
ok(`هر دو دکمهٔ تم رندر شدند (نوار بالا: «${t0h}» / منو: «${t0d}»)`, !!t0h && !!t0d);

// ── کلیک دکمهٔ نوار بالا → هر دو هماهنگ + ضدلگ (کلیک درون‌صفحه — اورلی منو سد مسیر نیست) ──
await page.evaluate(() => document.querySelector('header.sticky.top-0 button[aria-label^="تغییر تم"]').click());
const switching = await page.evaluate(() => document.documentElement.classList.contains("theme-switching"));
ok("در لحظهٔ سوییچ، گذارها خاموش شدند (theme-switching)", switching);
await page.waitForTimeout(160);
const switchingGone = await page.evaluate(() => !document.documentElement.classList.contains("theme-switching"));
ok("دو فریم بعد کلید ضدلگ برداشته شد", switchingGone);
const t1 = await page.evaluate(() => ({
  dark: document.documentElement.classList.contains("dark"),
  stored: localStorage.getItem("lexa-theme"),
}));
ok("سوییچ اول → حالت شب (کلاس dark + ذخیره)", t1.dark === true && t1.stored === "dark", JSON.stringify(t1));
const t1h = await titleOf(HEAD_BTN);
const t1d = await titleOf(DRAWER_BTN);
ok(`دکمه‌ها هماهنگ ماندند («${t1h}» === «${t1d}»)`, t1h === t1d);

// ── کلیک دکمهٔ منو → شب → شیشه‌ای؛ باز هم هماهنگ ──
await page.evaluate(() => document.querySelector('[role="dialog"][aria-label="منو"] button[aria-label^="تغییر تم"]').click());
await page.waitForTimeout(160);
const t2 = await page.evaluate(() => ({
  glass: document.documentElement.classList.contains("theme-glass"),
  dark: document.documentElement.classList.contains("dark"),
  stored: localStorage.getItem("lexa-theme"),
}));
ok("سوییچ دوم → حالت شیشه‌ای (theme-glass، بدون dark)", t2.glass === true && t2.dark === false && t2.stored === "glass", JSON.stringify(t2));
const t2h = await titleOf(HEAD_BTN);
const t2d = await titleOf(DRAWER_BTN);
ok(`دکمه‌ها پس از سوییچ از منو هماهنگ‌اند («${t2h}» === «${t2d}»)`, t2h === t2d);

// ── برگشت به روز ──
await page.evaluate(() => document.querySelector('header.sticky.top-0 button[aria-label^="تغییر تم"]').click());
await page.waitForTimeout(160);
const t3 = await page.evaluate(() => ({
  glass: document.documentElement.classList.contains("theme-glass"),
  stored: localStorage.getItem("lexa-theme"),
}));
ok("سوییچ سوم → بازگشت به روز", t3.glass === false && t3.stored === "light", JSON.stringify(t3));
const t3h = await titleOf(HEAD_BTN);
const t3d = await titleOf(DRAWER_BTN);
ok(`هماهنگی نهایی («${t3h}» === «${t3d}»)`, t3h === t3d);

// ── منوی کشویی بدون آیتم «پیشرفت» ──
const drawerProgress = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"][aria-label="منو"]');
  if (!dlg) return -1;
  return [...dlg.querySelectorAll("button")].filter((b) => (b.textContent || "").trim() === "پیشرفت").length;
});
ok("منوی کشویی بدون آیتم «پیشرفت»", drawerProgress === 0, `count=${drawerProgress}`);

/* ═══ دسکتاپ: سایدبار بدون پیشرفت + مسیر #/progress به خانه برمی‌گردد ═══ */
const desk = await browser.newPage({ viewport: { width: 1360, height: 900 } });
desk.on("pageerror", (e) => errors.push("desk pageerror: " + String(e)));
desk.on("console", (m) => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text()); });
await desk.goto(BASE + "/#/home", { waitUntil: "networkidle" });
await desk.waitForTimeout(1500);
const sideProgress = await desk.evaluate(() => {
  const aside = document.querySelector("aside");
  if (!aside) return -1;
  return [...aside.querySelectorAll("button")].filter((b) => (b.textContent || "").trim() === "پیشرفت").length;
});
ok("سایدبار دسکتاپ بدون آیتم «پیشرفت»", sideProgress === 0, `count=${sideProgress}`);
await desk.goto(BASE + "/#/progress", { waitUntil: "networkidle" });
await desk.waitForTimeout(1200);
const progView = await desk.evaluate(() => ({
  hasOldHeading: [...document.querySelectorAll("h1")].some((h) => (h.textContent || "").includes("پیشرفت من")),
  homeShown: !!document.querySelector("header.sticky.top-0") && [...document.querySelectorAll("h1,h2")].some((h) => (h.textContent || "").length > 0),
}));
ok("مسیر #/progress دیگر ویوی پیشرفت را باز نمی‌کند", progView.hasOldHeading === false, JSON.stringify(progView));

ok("صفر خطای کنسول/صفحه", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
console.log(`\n═══ نتیجه: ${pass} سبز / ${fail} سرخ ═══`);
process.exit(fail ? 1 : 0);
