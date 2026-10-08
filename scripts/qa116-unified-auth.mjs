// ─── QA 0.10.16 — «اکانت دارم ولی برای افزودن/فالو می‌گوید وارد شو» ──────────
// ریشه: دو سیستم حساب موازی — حساب ابری (دکمهٔ اصلی هدر) و حساب سروری؛
// قابلیت‌های اجتماعی فقط نشست سروری را می‌شناختند.
// فیکس: ① /api/auth/cloud-bridge (پل توکن ساپابیس → نشست سروری)
//       ② پل خودکار هنگام بارگذاری + بعد از ورود ابری
//       ③ دکمه‌های مرده مهمان (فالو×۳، امتیاز×۲، کامنت) → باز کردن پنجرهٔ ورود
//       ④ نوشتهٔ گمراه‌کنندهٔ «برای افزودن وارد شو» در کتابخانهٔ عمومی اصلاح شد
//       ⑤ خروج ابری = خروج کامل (نشست سروری هم تمام می‌شود)
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const SB = "https://tldjbpfcibangzmvzwfw.supabase.co";
const KEY = "sb_publishable_IaPGLBkmRkcsGlVE865PZw_krAWWmsz";
let pass = 0, fail = 0;
function ok(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name} ${extra}`); }
}
const stamp = Date.now();
const EMAIL = `qabridge${stamp}@test.lexa.app`; // سناریوی A — API مستقیم
const EMAIL_B = `qauibr${stamp}@test.lexa.app`; // سناریوی B — ثبت‌نام از UI (باید متفاوت باشد)
const PASS = "QaBridge!12345";

const browser = await chromium.launch();

/* ── A) API پل — مستقیم ── */
console.log("A) API پل حساب ابری");
{
  const bad = await fetch(BASE + "/api/auth/cloud-bridge", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken: "invalid-token-xyz" }),
  });
  ok("A1: توکن نامعتبر → 401", bad.status === 401, `status=${bad.status}`);

  const su = await fetch(SB + "/auth/v1/signup", {
    method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const suj = await su.json();
  const token = suj.access_token;
  ok("A2: ثبت‌نام ابری نشست فوری داد", !!token, JSON.stringify(suj).slice(0, 120));

  const br = await fetch(BASE + "/api/auth/cloud-bridge", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken: token }),
  });
  const brj = await br.json();
  ok("A3: پل با توکن واقعی → 200 + کاربر sb_*", br.ok && !!brj.user && String(brj.user.username).startsWith("sb_"), JSON.stringify(brj).slice(0, 160));
  const setCookie = br.headers.get("set-cookie") || "";
  ok("A4: کوکی نشست سروری نشسته شد", setCookie.includes("lexa_session="), setCookie.slice(0, 80));

  const br2 = await fetch(BASE + "/api/auth/cloud-bridge", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken: token }),
  });
  const br2j = await br2.json();
  ok("A5: پل دوباره = همان حساب (deterministic)", br2.ok && br2j.user?.id === brj.user?.id, `${brj.user?.id} vs ${br2j.user?.id}`);

  // فالو با کوکی پل — اثبات اینکه حساب سروریِ حاصل همه‌چیز را روشن می‌کند
  const sugg = await fetch(BASE + "/api/social/suggestions", { headers: { cookie: br.headers.get("set-cookie").split(";")[0] } });
  const sg = await sugg.json();
  const tid = sg.teachers?.[0]?.id;
  if (tid) {
    const fl = await fetch(BASE + "/api/social/follow", {
      method: "POST", headers: { "Content-Type": "application/json", cookie: br.headers.get("set-cookie").split(";")[0] },
      body: JSON.stringify({ teacherId: tid }),
    });
    ok("A6: فالو با نشستِ حاصل از پل کار می‌کند", fl.ok, `status=${fl.status}`);
  } else {
    ok("A6: فالو با نشستِ حاصل از پل کار می‌کند", false, "هیچ استادی در پیشنهادها نیست");
  }
}

/* ── B) مرورگر: ثبت‌نام ابری از UI → پل خودکار → همه‌چیز روشن ── */
console.log("B) E2E: ورود ابری از UI → پل خودکار");
const errors = [];
{
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push("B pageerror: " + String(e)));
  p.on("console", (m) => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text()); });

  await p.goto(BASE + "/#/home", { waitUntil: "networkidle" });
  await p.waitForTimeout(1800);
  // دکمهٔ اصلی هدر → پنجرهٔ حساب ابری
  await p.locator("button:has-text('ورود / ثبت‌نام')").first().click();
  await p.waitForTimeout(700);
  ok("B1: پنجرهٔ حساب ابری باز شد", await p.locator("text=حساب ابری Lexa").count() > 0);
  // زبانهٔ ثبت‌نام
  await p.getByRole("tab", { name: "ثبت‌نام" }).click();
  await p.waitForTimeout(400);
  await p.locator("input[type=email]").fill(EMAIL_B);
  await p.locator("input[type=password]").first().fill(PASS);
  await p.locator("input[type=password]").nth(1).fill(PASS);
  await p.locator("button:has-text('ساخت حساب و انتقال پیشرفت من')").click();
  await p.waitForTimeout(3500);
  ok("B2: پنجره بسته شد (ثبت‌نام موفق)", !(await p.locator("text=حساب ابری Lexa").count()));

  const me1 = await p.evaluate(async () => (await (await fetch("/api/auth/me")).json()));
  ok("B3: پل خودکار پس از ثبت‌نام — نشست سروری فعال", !!me1?.user && String(me1.user.username).startsWith("sb_"), JSON.stringify(me1).slice(0, 140));

  // صفحهٔ اساتید: فالو بدون رفرش کار می‌کند
  await p.goto(BASE + "/#/teachers", { waitUntil: "networkidle" });
  await p.waitForTimeout(2200);
  const followBtn = p.locator("button:has-text('دنبال کردن')").first();
  ok("B4: دکمهٔ فالو برای کاربر پل‌شده فعال است", (await followBtn.count()) > 0 && !(await followBtn.isDisabled()));
  if ((await followBtn.count()) > 0) {
    await followBtn.click();
    await p.waitForTimeout(1600);
    ok("B5: فالو شد (دنبال می‌کنی)", await p.locator("button:has-text('دنبال می‌کنی')").count() > 0);
  }
  await p.screenshot({ path: "/home/z/my-project/shots/qa116-B-bridged-follow.png" });

  // رفرش سخت — نشست می‌ماند
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(2000);
  const me2 = await p.evaluate(async () => (await (await fetch("/api/auth/me")).json()));
  ok("B6: پس از رفرش هم وارد است", !!me2?.user && me2.user.username === me1.user.username, JSON.stringify(me2).slice(0, 120));

  // کتابخانهٔ عمومی: نوشتهٔ گمراه‌کننده رفته؛ افزودن کار می‌کند
  await p.goto(BASE + "/#/library", { waitUntil: "networkidle" });
  await p.waitForTimeout(2400);
  await p.locator("button:has-text('همه')").first().click();
  await p.waitForTimeout(1800);
  const body = await p.locator("body").innerText();
  ok("B7: نوشتهٔ «برای افزودن وارد شو» حذف شد", !body.includes("برای افزودن وارد شو"), "");

  // خروج ابری = خروج کامل
  await p.locator("button[aria-label^='حساب ابری']").first().click();
  await p.waitForTimeout(700);
  await p.locator("[role='menuitem']:has-text('خروج')").first().click();
  await p.waitForTimeout(1800);
  const me3 = await p.evaluate(async () => (await (await fetch("/api/auth/me")).json()));
  ok("B8: خروج ابری → نشست سروری هم تمام شد", !me3?.user, JSON.stringify(me3).slice(0, 120));
  await ctx.close();
}

/* ── C) مهمان: دکمه‌های مرده حالا پنجرهٔ ورود باز می‌کنند ── */
console.log("C) مهمان: UX دکمه‌ها");
{
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push("C pageerror: " + String(e)));

  await p.goto(BASE + "/#/teachers", { waitUntil: "networkidle" });
  await p.waitForTimeout(2200);
  const fb = p.locator("button:has-text('دنبال کردن')").first();
  ok("C1: فالو برای مهمان غیرِمسدود است (کلیک‌پذیر)", (await fb.count()) > 0 && !(await fb.isDisabled()));
  await fb.click();
  await p.waitForTimeout(800);
  ok("C2: تپ فالو مهمان → پنجرهٔ ورود باز شد", await p.locator("text=حساب ابری Lexa").count() > 0);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(500);

  // پروفایل استاد → دکمهٔ فالو
  await p.locator("button:has-text('استاد حسن‌زاده')").first().click();
  await p.waitForTimeout(2000);
  const pfb = p.locator("button:has-text('دنبال کردن')").first();
  ok("C3: فالو پروفایل استاد برای مهمان کلیک‌پذیر است", (await pfb.count()) > 0 && !(await pfb.isDisabled()));
  await pfb.click();
  await p.waitForTimeout(800);
  ok("C4: تپ فالو پروفایل → پنجرهٔ ورود", await p.locator("text=حساب ابری Lexa").count() > 0);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(500);

  // کتابخانهٔ عمومی — نوشتهٔ درست + افزودن مهمان هنوز کار می‌کند
  await p.goto(BASE + "/#/library", { waitUntil: "networkidle" });
  await p.waitForTimeout(2400);
  // کارت‌های دورهٔ استاد زیر تب «همه» هستند (تب پیش‌فرض = دوره‌های آماده)
  await p.locator("button:has-text('همه')").first().click();
  await p.waitForTimeout(1800);
  const body = await p.locator("body").innerText();
  ok("C5: نوشتهٔ جدید «بدون حساب هم اضافه می‌شود»", body.includes("بدون حساب هم اضافه می‌شود"), "");
  ok("C6: نوشتهٔ قدیمی گمراه‌کننده نیست", !body.includes("برای افزودن وارد شو یا حساب بساز"), "");
  const addG = p.locator("button:has-text('افزودن به عنوان کتاب')").first();
  ok("C7: دکمهٔ افزودن مهمان فعال است", (await addG.count()) > 0 && !(await addG.isDisabled()));
  await ctx.close();
}

/* ── D) رگرسیون: حساب سروری خالص (tfixqa) ── */
console.log("D) رگرسیون حساب سروری");
{
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push("D pageerror: " + String(e)));
  let r = await p.request.post(BASE + "/api/auth/login", { data: { username: "tfixqa", password: "Tfix!23456789" } });
  ok("D1: ورود سروری tfixqa", r.ok(), `status=${r.status()}`);
  await p.goto(BASE + "/#/teachers", { waitUntil: "networkidle" });
  await p.waitForTimeout(2200);
  // idempotent: اگر از اجرای قبلی دنبال می‌کند، همان هم قبول است؛ وگرنه تپ → دنبال می‌کنی
  const anyFollow = p.locator("button:has-text('دنبال کردن'), button:has-text('دنبال می‌کنی')").first();
  ok("D2: دکمهٔ فالو حاضر و فعال است", (await anyFollow.count()) > 0 && !(await anyFollow.isDisabled()));
  if ((await p.locator("button:has-text('دنبال کردن')").count()) > 0) {
    await p.locator("button:has-text('دنبال کردن')").first().click();
    await p.waitForTimeout(1400);
    ok("D3: فالو سروری کار می‌کند", await p.locator("button:has-text('دنبال می‌کنی')").count() > 0);
  } else {
    ok("D3: فالو سروری کار می‌کند (از قبل دنبال می‌کند — idempotent)", true);
  }
  await ctx.close();
}

console.log("---- console errors ----");
for (const e of errors.slice(0, 8)) console.log("  ", e.slice(0, 200));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
