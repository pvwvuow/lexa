// ─── QA 0.10.18 — مسیر #/admin روی اکسپورت APK/Pages باید کنسول ابری را باز کند ──
// رگرسیون فیکس AppShell: قبلاً گیت IS_APK کل مسیر admin را با «ApkUnavailable» می‌بست و
// کنسول ابری PR #12 (CloudAdminView) روی APK/Pages هرگز رندر نمی‌شد.
// انتظار مهمان:
//   APK export (#/admin)  → کارت قفل «ناحیهٔ محافظت‌شدهٔ مدیر» + دکمهٔ ورود، بدون متن «در دسترس نیست»
//   وب سروری (#/admin)    → همان کارت قفل نسخهٔ سروری (بدون کرش) — رفتار قدیمی دست‌نخورده
import { chromium } from "playwright";

const APK = process.env.APK_BASE || "http://127.0.0.1:3001";
const WEB = process.env.WEB_BASE || "http://127.0.0.1:3000";
let pass = 0, fail = 0;
const ok = (n, c, x = "") => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.error(`  ✗ ${n} ${x}`); } };

const browser = await chromium.launch();

// A) اکسپورت APK — مسیر admin باید به CloudAdminView برسد
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const crashes = [];
  page.on("pageerror", (e) => crashes.push(String(e)));
  await page.goto(APK + "/#/admin", { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(2500);
  const body = await page.locator("body").innerText().catch(() => "");
  ok("APK #/admin کارت قفل ابری را نشان می‌دهد", body.includes("ناحیهٔ محافظت‌شدهٔ مدیر"), body.slice(0, 80));
  ok("APK #/admin دیگر placeholder «در دسترس نیست» نیست", !body.includes("در نسخهٔ اندروید فعلاً در دسترس نیست"));
  ok("APK #/admin دکمهٔ ورود دارد", (await page.locator("button:has-text('ورود')").count()) > 0);
  ok("APK #/admin صفر pageerror", crashes.length === 0, crashes.slice(0, 2).join(" | ").slice(0, 140));
  await page.close();
}

// B) وب سروری — ServerAdminView همان گارد قدیمی (رگرسیون منفی)
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const crashes = [];
  page.on("pageerror", (e) => crashes.push(String(e)));
  await page.goto(WEB + "/#/admin", { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(2200);
  const body = await page.locator("body").innerText().catch(() => "");
  ok("وب #/admin گارد سروری = کارت قفل", body.includes("ناحیهٔ محافظت‌شدهٔ مدیر"), body.slice(0, 80));
  ok("وب #/admin صفر pageerror", crashes.length === 0, crashes.slice(0, 2).join(" | ").slice(0, 140));
  await page.close();
}

await browser.close();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
