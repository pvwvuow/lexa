// ─── QA 0.10.24 — سیم‌کشی فازهای ۴–۷ (زمان مطالعه، آمار من، API، مقایسه، کانکتور) ──
// ۱) باندل (وب + اکسپورت APK) شامل رشته‌های فازهای جدید و RPCهای تازه است
// ۲) #/mystats مهمان بدون کرش رندر می‌شود (پیام ورود)
// ۳) رگرسیون: #/org و #/classes سالم
// ۴) سرویس‌ورکر v66 و نسخهٔ 0.10.24
// ۵) صفر pageerror در کل مسیر
import { chromium } from "playwright";
import { readdirSync, readFileSync } from "node:fs";

const WEB = process.env.WEB_BASE || "http://127.0.0.1:3210";
let pass = 0, fail = 0;
const ok = (n, c, x = "") => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.error(`  ✗ ${n} ${x}`); } };

const NEEDLES = [
  "آمار من", "گزارش مقایسه", "کلیدهای API", "کانکتور", "داشبورد",
  "زمان مطالعه", "lexa_study_track", "lexa_my_study", "lexa_compare_report",
  "lexa_org_api_key_revoke", "org-api/manage", "lexa_org_integration_save", "org-connector",
  "این مقایسه همبستگی است",
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
for (const needle of ["آمار من", "گزارش مقایسه", "lexa_study_track", "org-connector"]) {
  ok(`APK: «${needle}» در باندل`, apkBundle.includes(needle));
}
ok("APK: نسخهٔ 0.10.24 در باندل", apkBundle.includes("0.10.24"));

// --- ۳) صفحات زندهٔ وب ---
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const crashes = [];
page.on("pageerror", (e) => crashes.push(String(e)));

const res = await page.goto(`${WEB}/#/mystats`, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => null);
ok("«آمار من» پاسخ ۲۰۰", !!res && res.status() === 200, String(res?.status()));
await page.waitForTimeout(3500);
const stats = await page.locator("body").innerText().catch(() => "");
ok("«آمار من» رندر شد (مهمان → پیام ورود)", stats.includes("آمار من") && (stats.includes("وارد") || stats.includes("ثبت")), stats.slice(0, 80));

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
ok("سرویس‌ورکر = lexa-pwa-v66 (0.10.24)", sw.includes("lexa-pwa-v66"), sw.slice(0, 40));

ok("صفر pageerror در کل مسیر", crashes.length === 0, crashes.slice(0, 2).join(" | ").slice(0, 140));

await browser.close();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
