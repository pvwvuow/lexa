// ─── QA 0.10.25 — وریفای زندهٔ Pages پس از ریلیز (فاز A1 کنسول + رگرسیون ۴–۷) ─────────────────
// ۱) داشبورد /app/ با نسخهٔ 0.10.25 (SW v67) بالا می‌آید
// ۲) #/mystats «آمار من» فاز ۴ رندر می‌شود (مهمان → پیام ورود، بدون کرش)
// ۳) باندل لایو شامل RPCهای فاز ۴ (lexa_study_track / lexa_my_study)، فاز ۵/۶
//    (lexa_compare_report) و UI مقایسه/کانکتور است
// ۴) رگرسیون: فاز ۲/۳ (پیش‌نمایش، کلاس‌های من)، #/org، صفر pageerror
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

// نسخهٔ SW لایو = v67 (0.10.25) — sw.js در ریشهٔ سایت (نه /app/)
const sw = await page.evaluate(async () => {
  try { return await fetch("/sw.js?live-probe").then((r) => r.text()); } catch { return ""; }
}).catch(() => "");
ok("سرویس‌ورکر لایو = lexa-pwa-v67 (0.10.25)", sw.includes("lexa-pwa-v67"), sw.slice(0, 60));

// فازهای ۲–۷: chunkهای لایو (/_next در ریشهٔ سایت)
const chunkProbe = await page.evaluate(async () => {
  try {
    const idx = await fetch("/app/").then((r) => r.text());
    const ids = [...idx.matchAll(/(?:\/_next|_next)\/static\/chunks\/([0-9a-f]+)\.js/g)].map((m) => m[1]);
    let exams = false, study = false, mystats = false, compare = false, connector = false, a1 = false, a1rpc = false;
    for (const id of ids) {
      const t = await fetch(`/_next/static/chunks/${id}.js`).then((r) => (r.ok ? r.text() : "")).catch(() => "");
      if (t.includes("lexa_exam_start") || t.includes("lexa-my-exams")) exams = true;
      if (t.includes("lexa_study_track") || t.includes("lexa_my_study")) study = true;
      if (t.includes("آمار من") && t.includes("lexa_study_forget")) mystats = true;
      if (t.includes("lexa_compare_report")) compare = true;
      if (t.includes("org-connector") || t.includes("lexa_org_integration_save")) connector = true;
      if (t.includes("کنسول مدیریت پلتفرم") && t.includes("گزارش ممیزی")) a1 = true;
      if (t.includes("lexa_admin_home") && t.includes("lexa_admin_users") && t.includes("admin-users")) a1rpc = true;
    }
    return { exams, study, mystats, compare, connector, a1, a1rpc };
  } catch { return { exams: false, study: false, mystats: false, compare: false, connector: false, a1: false, a1rpc: false }; }
}).catch(() => ({ exams: false, study: false, mystats: false, compare: false, connector: false, a1: false, a1rpc: false }));
ok("باندل لایو: RPCهای آزمون رسمی (فاز ۳ — رگرسیون)", chunkProbe.exams);
ok("باندل لایو: RPCهای زمان مطالعه (فاز ۴)", chunkProbe.study);
ok("باندل لایو: «آمار من» + lexa_study_forget (فاز ۴)", chunkProbe.mystats);
ok("باندل لایو: گزارش مقایسه (فاز ۶)", chunkProbe.compare);
ok("باندل لایو: کانکتور (فاز ۷)", chunkProbe.connector);
ok("باندل لایو: کنسول پلتفرم A1 (UI)", chunkProbe.a1);
ok("باندل لایو: RPCهای 013 + تابع admin-users (A1)", chunkProbe.a1rpc);

// فاز ۴: #/mystats مهمان — پیام ورود، بدون کرش
await page.goto(BASE + "#/mystats", { waitUntil: "domcontentloaded" }).catch(() => {});
await page.waitForTimeout(4000);
const stats = await page.locator("body").innerText().catch(() => "");
ok("فاز ۴: «آمار من» رندر شد (مهمان → پیام ورود)", stats.includes("آمار من") && (stats.includes("وارد") || stats.includes("خطا") || stats.includes("نشد")), stats.slice(0, 80));

// رگرسیون فاز ۲: کتابخانهٔ عمومی
await page.goto(BASE + "#/library", { waitUntil: "domcontentloaded" }).catch(() => {});
await page.waitForTimeout(4000);
const library = await page.locator("body").innerText().catch(() => "");
ok("کتابخانهٔ عمومی رندر شد (رگرسیون فاز ۲)", library.includes("کتابخانه"), library.slice(0, 60));

// رگرسیون فاز ۳: #/classes مهمان — بدون کرش
await page.goto(BASE + "#/classes", { waitUntil: "domcontentloaded" }).catch(() => {});
await page.waitForTimeout(3000);
const classes = await page.locator("body").innerText().catch(() => "");
ok("فاز ۳: «کلاس‌های من» رندر شد (مهمان — رگرسیون)", classes.includes("کلاس‌های من") || classes.includes("وارد"), classes.slice(0, 60));

// #/org — رگرسیون فازهای قبلی
await page.goto(BASE + "#/org", { waitUntil: "domcontentloaded" }).catch(() => {});
await page.waitForTimeout(3000);
const org = await page.locator("body").innerText().catch(() => "");
ok("هاب «مراکز آموزشی» رندر شد (رگرسیون)", org.includes("مراکز آموزشی"), org.slice(0, 60));

ok("صفر pageerror در کل مسیر", crashes.length === 0, crashes.slice(0, 2).join(" | ").slice(0, 140));

await browser.close();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
