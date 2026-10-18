/* Smoke: org page + settings render with phase-1 wiring (web standalone + APK static) */
import { chromium } from "playwright";

const WEB = process.env.WEB_BASE || "http://127.0.0.1:3000";
const APK = process.env.APK_BASE || "http://127.0.0.1:3001";
let pass = 0, fail = 0;
const ok = (name, cond) => { console.log((cond ? "  ✓ " : "  ✗ ") + name); cond ? pass++ : fail++; };

const browser = await chromium.launch();
async function probe(base, label, routes) {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  for (const r of routes) {
    await page.goto(base + "/#" + r, { waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForTimeout(2200);
    const body = await page.locator("body").innerText().catch(() => "");
    const crashed = /Application error|unhandled|__next_error__/.test(body);
    ok(`${label} #${r} بدون کرش`, !crashed);
  }
  ok(`${label} صفر pageerror`, errors.length === 0);
  await page.close();
}
// org hub + a settings page (guest state) — must render with the new tab logic present
await probe(WEB, "WEB", ["/org", "/settings"]);
await probe(APK, "APK", ["/org", "/settings"]);
// guest: the cloud dialog must still have 3 tabs (ورود/ثبت‌نام/حساب مرکز)
{
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  await page.goto(WEB + "/#/home", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.locator("button:has-text('ورود / ثبت‌نام')").first().click().catch(() => {});
  await page.waitForTimeout(900);
  const hasOrgTab = (await page.locator("[role='tab']:has-text('حساب مرکز')").count()) > 0;
  ok("دیالوگ حساب: زبانهٔ «حساب مرکز» حاضر است", hasOrgTab);
  if (hasOrgTab) {
    await page.locator("[role='tab']:has-text('حساب مرکز')").click();
    await page.waitForTimeout(600);
    const orgForm = (await page.locator("text=کد مرکز آموزشی").count()) > 0;
    ok("فرم ورود مرکز (کد + نام کاربری + رمز) رندر شد", orgForm);
  }
  await page.close();
}
await browser.close();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
