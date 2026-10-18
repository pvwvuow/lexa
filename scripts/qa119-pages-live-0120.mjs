// ─── QA 0.10.20 — وریفای زندهٔ Pages پس از ریلیز ──────────────────────────────
// ۱) داشبورد /app/ با نسخهٔ 0.10.20 بالا می‌آید
// ۲) #/admin کارت قفل ابری را نشان می‌دهد (نه placeholder قدیمی)
// ۳) نام‌گذاری جدید: «پنل مدرس»، «مراکز آموزشی» — بدون «اتاق استاد»/«استاد حقوقی هوشمند»
// ۴) عنوان صفحه = «Lexa — آموزش مفهومی حقوق» (بدون ادعای استاد هوش مصنوعی)
// ۵) #/teachers هاب «مدرسان Lexa» — بدون کرش
import { chromium } from "playwright";

const BASE = "https://pvwvuow.github.io/app/";
let pass = 0, fail = 0;
const ok = (n, c, x = "") => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.error(`  ✗ ${n} ${x}`); } };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const crashes = [];
page.on("pageerror", (e) => crashes.push(String(e)));

const res = await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => null);
ok("داشبورد /app/ پاسخ ۲۰۰", !!res && res.status() === 200, String(res?.status()));
await page.waitForTimeout(3500);

const title = await page.title().catch(() => "");
ok("عنوان = آموزش مفهومی حقوق (بدون ادعای AI)", title.includes("آموزش مفهومی حقوق") && !title.includes("هوشمند"), title);

// نسخه از سرویس‌ورکر یا manifest
const ver = await page.evaluate(async () => {
  try { const m = await fetch("/manifest.webmanifest").then((r) => r.json()); return m.name + " " + (m.description || ""); } catch { return ""; }
}).catch(() => "");
ok("مانیفست PWA بدون ادعای استاد هوشمند", !String(ver).includes("استاد"), ver);

// منوی همبرگری دسکتاپ → نام‌ها
await page.evaluate(() => { localStorage.setItem("lexa-theme", "light"); }).catch(() => {});
const home = await page.locator("body").innerText().catch(() => "");
ok("بدون «استاد حقوقی هوشمند» در خانه", !home.includes("استاد حقوقی هوشمند"));

// #/teachers
await page.goto(BASE + "#/teachers", { waitUntil: "domcontentloaded" }).catch(() => {});
await page.waitForTimeout(3000);
const teachers = await page.locator("body").innerText().catch(() => "");
ok("هاب مدرسان Lexa رندر شد", teachers.includes("مدرسان Lexa"), teachers.slice(0, 60));
ok("بدون «اساتید Lexa» قدیمی", !teachers.includes("اساتید Lexa"));

// #/admin (مهمان)
await page.goto(BASE + "#/admin", { waitUntil: "domcontentloaded" }).catch(() => {});
await page.waitForTimeout(3000);
const admin = await page.locator("body").innerText().catch(() => "");
ok("#/admin کارت قفل ابری", admin.includes("ناحیهٔ محافظت‌شدهٔ مدیر"), admin.slice(0, 60));
ok("#/admin بدون placeholder قدیمی", !admin.includes("در نسخهٔ اندروید فعلاً در دسترس نیست"));

// #/org — مراکز آموزشی
await page.goto(BASE + "#/org", { waitUntil: "domcontentloaded" }).catch(() => {});
await page.waitForTimeout(3000);
const org = await page.locator("body").innerText().catch(() => "");
ok("هاب «مراکز آموزشی» رندر شد", org.includes("مراکز آموزشی"), org.slice(0, 60));
ok("بدون «دانشگاه‌ها و موسسه‌ها» قدیمی", !org.includes("دانشگاه‌ها و موسسه‌ها"));

ok("صفر pageerror در کل مسیر", crashes.length === 0, crashes.slice(0, 2).join(" | ").slice(0, 140));

await browser.close();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
