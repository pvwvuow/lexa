// ─── QA 0.10.25 — فاز A1 کنسول پلتفرم (docs/ADMIN_PLATFORM.md) ──
// ۱) باندل (وب + اکسپورت APK) شامل رشته‌های کنسول، RPCهای 013 و کلاینت admin-users است
// ۲) #/ مهمان: خانهٔ وابسته به نقش → برای مهمان همان داشبورد یادگیری (بدون نوار محیط کار)
// ۳) #/admin و #/admin/users مهمان بدون کرش (کنسول فقط برای ادمین ابری باز می‌شود)
// ۴) رگرسیون: #/org و #/classes سالم
// ۵) سرویس‌ورکر v67 و نسخهٔ 0.10.25
// ۶) صفر pageerror در کل مسیر
import { chromium } from "playwright";
import { readdirSync, readFileSync } from "node:fs";

const WEB = process.env.WEB_BASE || "http://127.0.0.1:3210";
let pass = 0, fail = 0;
const ok = (n, c, x = "") => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.error(`  ✗ ${n} ${x}`); } };

const NEEDLES = [
  "کنسول مدیریت پلتفرم", "نمای کلی", "درخواست‌ها", "مراکز آموزشی", "کاربران و نقش‌ها",
  "گزارش ممیزی", "محیط یادگیری", "صف کارها", "هشدارها", "در صف حذف", "حذف دائمی",
  "lexa_admin_home", "lexa_admin_orgs_overview", "lexa_admin_org_lifecycle",
  "lexa_admin_users", "lexa_admin_user_detail", "lexa_admin_change_role", "lexa_admin_audit",
  "admin-users", "lexa-workspace", "این کار به ورود دومرحله‌ای نیاز دارد",
];

// --- ۱) باندل وب (standalone) ---
const chunksDir = ".next/standalone/.next/static/chunks";
let webBundle = "";
try {
  for (const f of readdirSync(chunksDir)) {
    if (f.endsWith(".js")) webBundle += readFileSync(`${chunksDir}/${f}`, "utf8");
  }
} catch (e) {
  console.error("chunks dir error", e.message);
}
for (const needle of NEEDLES) ok(`وب: «${needle}» در باندل`, webBundle.includes(needle));

// --- ۲) باندل اکسپورت APK ---
let apkBundle = "";
try {
  for (const f of readdirSync("out/_next/static/chunks")) {
    if (f.endsWith(".js")) apkBundle += readFileSync(`out/_next/static/chunks/${f}`, "utf8");
  }
} catch (e) {
  console.error("out chunks error", e.message);
}
ok("APK: باندل اکسپورت خوانده شد", apkBundle.length > 100000);
for (const needle of ["کنسول مدیریت پلتفرم", "کاربران و نقش‌ها", "lexa_admin_users", "admin-users"]) {
  ok(`APK: «${needle}» در باندل`, apkBundle.includes(needle));
}
ok("APK: نسخهٔ 0.10.25 در باندل", apkBundle.includes("0.10.25"));

// --- ۳) صفحات زندهٔ وب ---
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const crashes = [];
page.on("pageerror", (e) => crashes.push(String(e)));

const res = await page.goto(`${WEB}/#/`, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => null);
ok("خانه پاسخ ۲۰۰", !!res && res.status() === 200, String(res?.status()));
await page.waitForTimeout(3500);
const home = await page.locator("body").innerText().catch(() => "");
ok("خانهٔ مهمان = داشبورد یادگیری (بدون نوار محیط کار)", home.includes("آموزش مفهومی حقوق") && !home.includes("محیط کار:"), home.slice(0, 60));

await page.goto(`${WEB}/#/admin`, { waitUntil: "domcontentloaded" }).catch(() => {});
await page.waitForTimeout(2500);
const admin = await page.locator("body").innerText().catch(() => "");
ok("#/admin مهمان بدون کرش رندر شد", admin.length > 100, admin.slice(0, 60));

await page.goto(`${WEB}/#/admin/users`, { waitUntil: "domcontentloaded" }).catch(() => {});
await page.waitForTimeout(2000);
const adminUsers = await page.locator("body").innerText().catch(() => "");
ok("#/admin/users مهمان (روتر <section> → نمای admin)", adminUsers.length > 100);

await page.goto(`${WEB}/#/org`, { waitUntil: "domcontentloaded" }).catch(() => {});
await page.waitForTimeout(2500);
const org = await page.locator("body").innerText().catch(() => "");
ok("رگرسیون: هاب مراکز آموزشی", org.includes("مراکز آموزشی"));

await page.goto(`${WEB}/#/classes`, { waitUntil: "domcontentloaded" }).catch(() => {});
await page.waitForTimeout(2500);
const classes = await page.locator("body").innerText().catch(() => "");
ok("رگرسیون: «کلاس‌های من»", classes.includes("کلاس‌های من"));

const sw = await page.evaluate(async () => {
  try { return await fetch("/sw.js?qa").then((r) => r.text()); } catch { return ""; }
}).catch(() => "");
ok("سرویس‌ورکر = lexa-pwa-v67 (0.10.25)", sw.includes("lexa-pwa-v67"), sw.slice(0, 40));

ok("صفر pageerror در کل مسیر", crashes.length === 0, crashes.slice(0, 2).join(" | ").slice(0, 140));

await browser.close();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
