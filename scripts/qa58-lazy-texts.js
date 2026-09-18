// Task 58 — QA لود تنبل متون: بدون دانلود اولیه، لود به‌محض باز کردن فصل/جلسه، کش IndexedDB
const { chromium } = require("playwright");

const BASE = "http://localhost:3000";
const results = [];
function ok(name, cond, extra = "") {
  results.push({ name, pass: !!cond, extra });
  console.log(`${cond ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
}

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();

  const textReqs = [];
  const allReqs = [];
  page.on("request", (r) => {
    const u = r.url();
    if (u.includes("/texts/")) textReqs.push(u.split("/texts/")[1]);
    allReqs.push(u);
  });
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  const failed500 = [];
  page.on("response", (r) => { if (r.status() >= 500) failed500.push(`${r.status()} ${r.url()}`); });

  // ۱) باز کردن خانه — هیچ متنی نباید دانلود شود
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  ok("بدون هیچ /texts/ هنگام استارتاپ", textReqs.length === 0, `requests=${textReqs.length}`);

  // ۲) صفحهٔ دورهٔ مدنی ۴
  await page.goto(BASE + "/#/course/madani-4", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const beforeChapter = textReqs.length;
  ok("باز کردن صفحهٔ دوره هم متنی نمی‌کشد", beforeChapter === 0, `requests=${beforeChapter}`);
  await page.screenshot({ path: "download/qa-lazy/qa58-course-page.png", fullPage: false });

  // ۳) باز کردن فصل ۳ — باید متن جلسات همان فصل پیش‌بارگیری شود
  const chapterBtn = page.locator("button[aria-expanded]").filter({ hasText: "ارکان سه‌گانهٔ مسؤولیت" });
  await chapterBtn.first().click();
  await page.waitForTimeout(3000);
  const chapterFetches = textReqs.slice(beforeChapter);
  ok("باز کردن فصل ← دانلود متن جلسات همان فصل", chapterFetches.length >= 5, `fetched=${chapterFetches.length}: ${chapterFetches.join(", ")}`);
  await page.screenshot({ path: "download/qa-lazy/qa58-chapter-opened.png", fullPage: false });

  // ۴) ورود به جلسهٔ اول فصل ۳ — متن باید رندر شود (از کش فصل، بدون درخواست تازه)
  const requestsBeforeLesson = textReqs.length;
  await page.locator("li button", { hasText: "ضرر چیست" }).first().click();
  await page.waitForTimeout(3500);
  const newFetches = textReqs.slice(requestsBeforeLesson);
  const bodyHasText = await page.locator("article section").count();
  ok("صفحهٔ جلسه: بخش اول رندر شد (نمایش تدریجی)", bodyHasText >= 1, `sections=${bodyHasText}`);
  ok("جلسه از پیش‌بارگیری فصل آمده (بدون درخواست تازه)", newFetches.length === 0, `new=${newFetches.length}`);
  await page.screenshot({ path: "download/qa-lazy/qa58-lesson-loaded.png", fullPage: true });

  // ۵) جلسه‌ای که پیش‌بارگیری نشده — باز کردن مستقیم با URL (فصل ۸ = md4-l6-1)
  const beforeDirect = textReqs.length;
  await page.goto(BASE + "/#/learn/md4-l6-1", { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
  const directFetches = textReqs.slice(beforeDirect);
  ok("ورود مستقیم به جلسه ← دانلود همان جلسه", directFetches.some((u) => u.startsWith("md4-l6-1")), `fetched=${directFetches.join(",") || "none"}`);
  const secs = await page.locator("article section").count();
  ok("جلسهٔ مستقیم هم رندر شد", secs >= 1, `sections=${secs}`);

  // ۶) رفرش کامل — کش IndexedDB: بدون درخواست شبکه همان جلسه رندر شود
  const beforeReload = textReqs.length;
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  const reloadFetches = textReqs.slice(beforeReload);
  const secs2 = await page.locator("article section").count();
  ok("پس از رفرش: کش IndexedDB، بدون درخواست", reloadFetches.length === 0, `network=${reloadFetches.length}`);
  ok("پس از رفرش: متن همچنان رندر است", secs2 >= 1, `sections=${secs2}`);
  await page.screenshot({ path: "download/qa-lazy/qa58-after-reload-cache.png", fullPage: true });

  // ۷) مرکز آزمون — شمارنده‌ها از متادیتا، بدون دانلود متن
  const beforeQuiz = textReqs.length;
  await page.goto(BASE + "/#/quiz", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const quizTab = page.locator("button", { hasText: "آزمون از کتابخانه" }).first();
  if (await quizTab.isVisible().catch(() => false)) {
    await quizTab.click();
    await page.waitForTimeout(1500);
  }
  const quizFetches = textReqs.slice(beforeQuiz);
  ok("مرکز آزمون: بدون دانلود متن (شمارنده از متادیتا)", quizFetches.length === 0, `fetched=${quizFetches.length}`);
  const hubSummary = await page.locator("text=/سؤال در دامنه/").first().isVisible().catch(() => false);
  ok("شمارندهٔ سؤال‌های دامنه از متادیتا نشان داده شد", hubSummary);
  await page.screenshot({ path: "download/qa-lazy/qa58-quiz-hub.png", fullPage: false });

  // ۸) خطاهای کنسول
  console.log("۵۰۰ها:", failed500.slice(0, 5).join(" | ") || "هیچ");
  const relevantErrors = consoleErrors.filter((e) => !failed500.some((f) => f.length > 0) && !e.includes("Failed to load resource"));
  ok("خطای کنسول مهم وجود ندارد", relevantErrors.length === 0, relevantErrors.slice(0, 3).join(" | "));
  ok("خطای ۵۰۰ سرور وجود ندارد", failed500.length === 0, failed500.slice(0, 3).join(" | "));

  const pass = results.filter((r) => r.pass).length;
  console.log(`\n═══ ${pass}/${results.length} چک سبز ═══`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => {
  console.error("QA CRASH:", e);
  process.exit(2);
});
