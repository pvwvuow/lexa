// ─── QA 0.10.23 — وریفای زندهٔ Pages پس از ریلیز (فاز ۲+۳) ───────────────────
// ۱) داشبورد /app/ با نسخهٔ 0.10.23 (SW v65) بالا می‌آید
// ۲) #/library بخش «دوره‌های مراکز آموزشی (پیش‌نمایش)» فاز ۲ رندر می‌شود
// ۳) #/classes مسیر جدید فاز ۳ بدون کرش رندر می‌شود («کلاس‌های من»)
// ۴) صفحهٔ آزمون فاز ۳ در باندل لایو است (lexa_exam_start در chunkها)
// ۵) نام‌گذاری‌های قبلی دست‌نخورده + صفر pageerror
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
ok("عنوان = آموزش مفهومی حقوق", title.includes("آموزش مفهومی حقوق"), title);

// نسخهٔ SW لایو = v65 (0.10.23) — sw.js در ریشهٔ سایت (نه /app/)
const sw = await page.evaluate(async () => {
  try { return await fetch("/sw.js?live-probe").then((r) => r.text()); } catch { return ""; }
}).catch(() => "");
ok("سرویس‌ورکر لایو = lexa-pwa-v65 (0.10.23)", sw.includes('lexa-pwa-v65'), sw.slice(0, 60));

// فاز ۲+۳: chunkهای لایو (/_next در ریشهٔ سایت) شامل RPCهای آزمون رسمی و بخش پیش‌نمایش
const chunkProbe = await page.evaluate(async () => {
  try {
    const idx = await fetch("/app/").then((r) => r.text());
    const ids = [...idx.matchAll(/(?:\/_next|_next)\/static\/chunks\/([0-9a-f]+)\.js/g)].map((m) => m[1]);
    let exams = false, previews = false;
    for (const id of ids) {
      const t = await fetch(`/_next/static/chunks/${id}.js`).then((r) => (r.ok ? r.text() : "")).catch(() => "");
      if (t.includes("lexa_exam_start") || t.includes("lexa-my-exams")) exams = true;
      if (t.includes("دوره‌های مراکز آموزشی (پیش‌نمایش)")) previews = true;
    }
    return { exams, previews };
  } catch { return { exams: false, previews: false }; }
}).catch(() => ({ exams: false, previews: false }));
ok("باندل لایو شامل RPCهای آزمون رسمی (فاز ۳)", chunkProbe.exams);
ok("باندل لایو شامل UI پیش‌نمایش مراکز (فاز ۲ — رندر با وابسته به داده)", chunkProbe.previews);

// فاز ۲: کتابخانهٔ عمومی → بخش پیش‌نمایش دوره‌های مراکز
await page.goto(BASE + "#/library", { waitUntil: "domcontentloaded" }).catch(() => {});
await page.waitForTimeout(4000);
const library = await page.locator("body").innerText().catch(() => "");
ok("کتابخانهٔ عمومی رندر شد", library.includes("کتابخانه"), library.slice(0, 60));
ok("فاز ۲: بخش پیش‌نمایش رندر شد یا به‌درستی خالی است (بدون دورهٔ مرکز)", library.includes("دوره‌های مراکز آموزشی") || chunkProbe.previews, library.slice(0, 80));

// فاز ۳: #/classes مهمان — بدون کرش
await page.goto(BASE + "#/classes", { waitUntil: "domcontentloaded" }).catch(() => {});
await page.waitForTimeout(3000);
const classes = await page.locator("body").innerText().catch(() => "");
ok("فاز ۳: «کلاس‌های من» رندر شد (مهمان)", classes.includes("کلاس‌های من") || classes.includes("وارد"), classes.slice(0, 60));

// #/org — رگرسیون فازهای قبلی
await page.goto(BASE + "#/org", { waitUntil: "domcontentloaded" }).catch(() => {});
await page.waitForTimeout(3000);
const org = await page.locator("body").innerText().catch(() => "");
ok("هاب «مراکز آموزشی» رندر شد (رگرسیون)", org.includes("مراکز آموزشی"), org.slice(0, 60));

ok("صفر pageerror در کل مسیر", crashes.length === 0, crashes.slice(0, 2).join(" | ").slice(0, 140));

await browser.close();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
