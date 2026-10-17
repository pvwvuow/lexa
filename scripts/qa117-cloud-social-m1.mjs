// ─── QA 0.10.17 — چک‌لیست cloud-social (PR #11) — بخش قابل‌اجرا قبل از اجرای 002 ──
// جداول Supabase (002) هنوز ساخته نشده‌اند → فلوهای ادمین/سازمان/مقاله E2E نمی‌شوند.
// این suite رفتارهای مستقل از 002 را می‌آزماید (قبل و بعد از اجرای 002 باید سبز بماند):
//   A) مهمان روی وب استندالون: اساتید/کتابخانهٔ عمومی/مقالات بدون کرش رندر شوند
//   B) چرخهٔ کامل حساب ابری: ثبت‌نام → توکن → ورود → خروج → مهمان
//   C) مهمان روی اکسپورت APK: همان صفحات بدون کرش
//   D) Pages زنده: لندینگ + داشبورد /app/ لود شوند
import { chromium } from "playwright";

const WEB = process.env.WEB_BASE || "http://127.0.0.1:3210";
const APK = process.env.APK_BASE || "http://127.0.0.1:3001";
let pass = 0, fail = 0;
function ok(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name} ${extra}`); }
}
const browser = await chromium.launch();

// ── A) مهمان روی وب استندالون ──
console.log("▌ A) مهمان — وب استندالون");
{
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const crashes = [];
  page.on("pageerror", (e) => crashes.push(String(e)));
  for (const [route, label] of [["#/teachers", "هاب اساتید"], ["#/library", "کتابخانهٔ عمومی"], ["#/articles", "مقالات"]]) {
    await page.goto(WEB + "/" + route, { waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForTimeout(2500);
    const body = await page.locator("body").innerText().catch(() => "");
    ok(`${label} بدون کرش رندر شد`, !body.includes("Application error") && body.length > 40, `len=${body.length}`);
  }
  ok("صفر pageerror مهمان", crashes.length === 0, crashes.slice(0, 2).join(" | ").slice(0, 160));
  await page.close();
}

// ── B) چرخهٔ حساب ابری ──
console.log("▌ B) حساب ابری: ثبت‌نام → خروج");
{
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  await page.goto(WEB + "/#/home", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const email = `q117-${Date.now()}@lexa-test.ir`;
  const pwd = "Q117!lexa-pass";
  // دکمهٔ اصلی هدر → پنجرهٔ حساب ابری (سلکتورهای qa116)
  await page.locator("button:has-text('ورود / ثبت‌نام')").first().click().catch(() => {});
  await page.waitForTimeout(900);
  ok("پنجرهٔ حساب ابری باز شد", (await page.locator("text=حساب ابری Lexa").count()) > 0);
  if ((await page.locator("text=حساب ابری Lexa").count()) > 0) {
    await page.getByRole("tab", { name: "ثبت‌نام" }).click().catch(() => {});
    await page.waitForTimeout(400);
    await page.locator("input[type=email]").fill(email);
    await page.locator("input[type=password]").first().fill(pwd);
    await page.locator("input[type=password]").nth(1).fill(pwd);
    await page.locator("button:has-text('ساخت حساب و انتقال پیشرفت من')").click();
    await page.waitForTimeout(3500);
    const tok = await page.evaluate(() => localStorage.getItem("lexa-sb-auth-v1"));
    ok("ثبت‌نام ابری → توکن نشست ذخیره شد", !!tok && tok.includes("access_token"), String(tok ?? "").slice(0, 40));
    // خروج ابری از منوی حساب
    await page.locator("button[aria-label^='حساب ابری']").first().click().catch(() => {});
    await page.waitForTimeout(700);
    await page.locator("[role='menuitem']:has-text('خروج')").first().click().catch(() => {});
    await page.waitForTimeout(1800);
    const tok2 = await page.evaluate(() => localStorage.getItem("lexa-sb-auth-v1"));
    ok("خروج ابری → توکن پاک شد", !tok2);
  }
  await page.close();
}

// ── C) مهمان روی اکسپورت APK ──
console.log("▌ C) مهمان — اکسپورت APK (3001)");
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const crashes = [];
  page.on("pageerror", (e) => crashes.push(String(e)));
  for (const route of ["#/teachers", "#/library", "#/articles"]) {
    await page.goto(APK + "/" + route, { waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForTimeout(2200);
    const body = await page.locator("body").innerText().catch(() => "");
    ok(`APK ${route} بدون کرش`, !body.includes("Application error") && body.length > 40, `len=${body.length}`);
  }
  ok("صفر pageerror مهمان APK", crashes.length === 0, crashes.slice(0, 2).join(" | ").slice(0, 160));
  await page.close();
}

// ── D) Pages زنده ──
console.log("▌ D) Pages زنده");
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const res = await page.goto("https://pvwvuow.github.io/app/", { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => null);
  ok("داشبورد /app/ روی Pages لود شد", !!res && res.status() === 200, String(res?.status()));
  await page.waitForTimeout(2500);
  const body = await page.locator("body").innerText().catch(() => "");
  ok("داشبورد بدون کرش رندر شد", !body.includes("Application error") && body.length > 40, `len=${body.length}`);
  await page.close();
}

await browser.close();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
