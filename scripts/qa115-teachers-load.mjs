// ─── QA 0.10.15 — «درس‌های پروفایل اساتید درست لود نمی‌شن؛ نمی‌شه راحت به کتابخانه اضافه کرد» ───
// فیکس‌ها:
//  ۱) LearnView: فال‌بک سروری/آفلاین برای جلسات «tc-*» که دوره‌شان در کتابخانه نیست (مهمان/پیش‌نمایش)
//  ۲) مهمان می‌تواند با یک تپ دوره را محلی به کتابخانه اضافه کند (بدون حساب) — همهٔ کارت‌ها
//  ۳) دکمهٔ صاحب دوره در صفحهٔ دوره (_teacherId از سرور)
//  ۴) GET /api/library برای مهمان ۴۰۱ — کتابخانهٔ محلی مهمان پاک نمی‌شود
// سناریوها:
//  A) مهمان: دکمهٔ افزودن فعال است → تپ → پرش به دوره → «در کتابخانه»
//  B) مهمان: از صفحهٔ دورهٔ پیش‌نمایش، جلسه مستقیم باز می‌شود (فال‌بک LearnView) — بدون افزودن
//  C) مهمان: پس از رفرش کامل مرورگر، دوره در فهرست مطالعه می‌ماند + جلسه دوباره باز می‌شود
//  D) کاربر سروری: افزودن → کتابخانهٔ همگام → جلسه → محتوا + کوئیز
//  E) رگرسیون: درس داخلی اپ (m-l1-1) سالم؛ دکمهٔ صاحب دوره به پروفایل می‌رود
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
let pass = 0, fail = 0;
function ok(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name} ${extra}`); }
}

const browser = await chromium.launch();
const errors = [];
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
page.on("pageerror", (e) => errors.push("pageerror: " + String(e)));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text()); });

const COURSE = "تجارت ۲ — استاد حسن‌زاده";
const LESSON = "جلسهٔ ۲ — دو حق شریک";

// ── A) مهمان: افزودن با یک تپ ──
await page.goto(BASE + "/#/teachers", { waitUntil: "networkidle" });
await page.waitForTimeout(2200);
const addBtn = page.locator(`li:has-text('${COURSE}') button:has-text('افزودن')`).first();
ok("A0: دکمهٔ افزودن برای مهمان فعال است", (await addBtn.count()) > 0 && !(await addBtn.isDisabled()));
await addBtn.click();
await page.waitForTimeout(2200);
ok("A1: پرش به صفحهٔ دوره", /#\/course\//.test(page.url()), page.url());
const bodyA = await page.locator("body").innerText();
ok("A2: دوره در «کتابخانه» است (کارت محلی)", !bodyA.includes("به کتابخانهٔ خود اضافه نکرده‌ای"), "");
await page.screenshot({ path: "/home/z/my-project/shots/qa115-A-guest-added.png" });

// ── B) مهمان: باز کردن جلسه از پیش‌نمایش (بدون افزودن، مسیر فال‌بک LearnView) ──
// یک مرورگر تازه = بدون کتابخانهٔ محلی
const ctxB = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
const pB = await ctxB.newPage();
pB.on("pageerror", (e) => errors.push("B pageerror: " + String(e)));
await pB.goto(BASE + "/#/teachers", { waitUntil: "networkidle" });
await pB.waitForTimeout(2000);
// از پروفایل استاد → کارت دوره → پیش‌نمایش
await pB.locator("button:has-text('استاد حسن‌زاده')").first().click();
await pB.waitForTimeout(2000);
await pB.locator(`text=${COURSE}`).first().click();
await pB.waitForTimeout(2200);
ok("B0: صفحهٔ دوره از پروفایل باز شد", /#\/course\//.test(pB.url()), pB.url());
// دکمهٔ صاحب دوره باید فعال باشد (فیکس _teacherId)
const ownerBtn = pB.locator("header button:has-text('hassanzadeh')").first();
ok("B1: دکمهٔ صاحب دوره فعال است (فیکس _teacherId)", (await ownerBtn.count()) > 0 && !(await ownerBtn.isDisabled()), "");
// باز کردن فصل و کلیک جلسه — مهمان و بدون افزودن
await pB.locator("text=جلسهٔ ۲ — کلیات شرکت‌های تجاری").first().click();
await pB.waitForTimeout(700);
await pB.locator(`text=${LESSON}`).first().click();
await pB.waitForTimeout(4500);
const bodyB = await pB.locator("body").innerText();
ok("B2: مهمان/پیش‌نمایش — جلسه لود شد (فال‌بک LearnView)", !bodyB.includes("جلسه پیدا نشد") && !bodyB.includes("در حال آماده‌سازی درس"), "");
ok("B3: محتوای درس رندر شد (مادهٔ ۷۷۴)", bodyB.includes("۷۷۴") || bodyB.includes("774"), "");
await pB.screenshot({ path: "/home/z/my-project/shots/qa115-B-guest-preview-lesson.png" });

// ── C) مهمان: رفرش کامل — ماندگاری کتابخانهٔ محلی + باز شدن دوبارهٔ جلسه ──
const ctxC = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
const pC = await ctxC.newPage();
pC.on("pageerror", (e) => errors.push("C pageerror: " + String(e)));
// همان دستگاه A نیست؛ اینجا مستقیم: افزودن → رفرش سخت → فهرست مطالعه
await pC.goto(BASE + "/#/teachers", { waitUntil: "networkidle" });
await pC.waitForTimeout(2000);
await pC.locator(`li:has-text('${COURSE}') button:has-text('افزودن')`).first().click();
await pC.waitForTimeout(2000);
await pC.reload({ waitUntil: "networkidle" });
await pC.waitForTimeout(2000);
await pC.goto(BASE + "/#/study", { waitUntil: "domcontentloaded" });
await pC.waitForTimeout(2000);
const bodyC1 = await pC.locator("body").innerText();
ok("C1: پس از رفرش، دوره در فهرست مطالعهٔ مهمان ماند", bodyC1.includes("تجارت ۲"), "");
// از فهرست مطالعه → دوره → جلسه
await pC.locator(`text=${COURSE}`).first().click();
await pC.waitForTimeout(2000);
await pC.locator("text=جلسهٔ ۲ — کلیات شرکت‌های تجاری").first().click();
await pC.waitForTimeout(700);
await pC.locator(`text=${LESSON}`).first().click();
await pC.waitForTimeout(4000);
const bodyC2 = await pC.locator("body").innerText();
ok("C2: جلسه پس از رفرش هم لود شد", !bodyC2.includes("جلسه پیدا نشد"), "");

// ── D) کاربر سروری: افزودن همگام + محتوا + کوئیز ──
const ctxD = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
const pD = await ctxD.newPage();
pD.on("pageerror", (e) => errors.push("D pageerror: " + String(e)));
await pD.goto(BASE + "/#/home", { waitUntil: "networkidle" });
let login = await pD.request.post(BASE + "/api/auth/register", { data: { username: "tfixqa", password: "Tfix!23456789" } });
if (!login.ok()) login = await pD.request.post(BASE + "/api/auth/login", { data: { username: "tfixqa", password: "Tfix!23456789" } });
ok("D0: ورود سروری tfixqa", login.ok(), `status=${login.status()}`);
await pD.goto(BASE + "/#/teachers", { waitUntil: "networkidle" });
await pD.reload({ waitUntil: "networkidle" });
await pD.waitForTimeout(2200);
// اگر از اجرای قبلی در کتابخانه است، اول حذف کن (همچنین مسیر توگلِ حذف را می‌آزماید) و دوباره اضافه کن
const inLibBtn = pD.locator(`li:has-text('${COURSE}') button:has-text('در کتابخانه')`).first();
if ((await inLibBtn.count()) > 0) {
  await inLibBtn.click();
  await pD.waitForTimeout(1200);
  // حذف سروری → می‌مانیم در هاب؛ دکمه دوباره «افزودن» می‌شود
}
const addD = pD.locator(`li:has-text('${COURSE}') button:has-text('افزودن')`).first();
ok("D-pre: دکمهٔ افزودن برای کاربر واردشده فعال است", (await addD.count()) > 0 && !(await addD.isDisabled()));
await addD.click();
await pD.waitForTimeout(2400);
ok("D1: پرش به دوره", /#\/course\//.test(pD.url()), pD.url());
const bodyD = await pD.locator("body").innerText();
ok("D2: بنر پیش‌نمایش حذف شد (کتابخانهٔ همگام)", !bodyD.includes("به کتابخانهٔ خود اضافه نکرده‌ای"), "");
// جلسه → باز شدن
await pD.locator("text=جلسهٔ ۲ — کلیات شرکت‌های تجاری").first().click();
await pD.waitForTimeout(700);
await pD.locator(`text=${LESSON}`).first().click();
await pD.waitForTimeout(4000);
const bodyD2 = await pD.locator("body").innerText();
ok("D3: جلسه برای کاربر سروری لود شد", !bodyD2.includes("جلسه پیدا نشد") && (bodyD2.includes("۷۷۴") || bodyD2.includes("774")), "");
await pD.screenshot({ path: "/home/z/my-project/shots/qa115-D-server-user-lesson.png" });

// ── E) رگرسیون: درس داخلی اپ ──
const ctxE = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
const pE = await ctxE.newPage();
pE.on("pageerror", (e) => errors.push("E pageerror: " + String(e)));
await pE.goto(BASE + "/#/learn/m-l1-1", { waitUntil: "networkidle" });
await pE.waitForTimeout(3500);
const bodyE = await pE.locator("body").innerText();
ok("E1: درس داخلی اپ سالم است", !bodyE.includes("جلسه پیدا نشد") && bodyE.length > 200, "");
// دکمهٔ صاحب دوره → پروفایل استاد (از همان صفحهٔ D)
const pD2 = pD;
await pD2.goto(BASE + `/#/course/cmuz0w0ui0005pko9t47vpoow`, { waitUntil: "domcontentloaded" });
await pD2.waitForTimeout(2500);
const owner2 = pD2.locator("header button:has-text('hassanzadeh')").first();
if ((await owner2.count()) > 0) {
  await owner2.click();
  await pD2.waitForTimeout(2200);
  ok("E2: کلیک روی صاحب دوره → پروفایل استاد", /#\/teacher\//.test(pD2.url()), pD2.url());
  const bodyT = await pD2.locator("body").innerText();
  ok("E3: پروفایل استاد رندر شد", bodyT.includes("دوره‌های استاد"), "");
} else {
  ok("E2: دکمهٔ صاحب دوره پیدا نشد", false, "");
}

console.log("---- console errors ----");
for (const e of errors.slice(0, 10)) console.log("  ", e.slice(0, 220));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
