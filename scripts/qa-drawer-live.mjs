// QA منوی کشویی موبایل — باز شدن فوری + درگ زندهٔ ۱:۱ (CDP touch)
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const PANEL = '[role="dialog"][aria-label="منو"]';
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
}

async function panelState(page) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const ov = el.previousElementSibling;
    return {
      transform: el.style.transform,
      transition: el.style.transition,
      overlayTransition: ov ? ov.style.transition : null,
      visibility: getComputedStyle(el).visibility,
      overlayOpacity: ov ? ov.style.opacity : null,
    };
  }, PANEL);
}
function txPct(t) {
  const m = /translateX\(([-0-9.]+)%\)/.exec(t || "");
  return m ? parseFloat(m[1]) : null;
}
const cdpTouch = {
  async start(c, x, y) { await c.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] }); },
  async move(c, x, y) { await c.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] }); },
  async end(c) { await c.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); },
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto(BASE + "/#/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const cdp = await ctx.newCDPSession(page);

// ─── ۱) پنل همیشه نصب است (بدون مونت لحظهٔ کلیک) ───
const before = await panelState(page);
check("پنل از قبل در DOM نصب است", !!before && before.transform.includes("100%"), `transform=${before?.transform}`);
check("پنل پیش از باز شدن نامرئی است", before?.visibility === "hidden");

// ─── ۲) کلیک دکمهٔ منو → باز شدن فوری (زمان‌سنجی دقیق: کلیک درون‌صفحه + computed transform) ───
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('nav[aria-label="ناوبری پایین"] button')].find((b) => (b.textContent || "").includes("منو"));
  const el = document.querySelector('[role="dialog"][aria-label="منو"]');
  window.__t = { t0: performance.now(), samples: [] };
  const tick = () => {
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform === "none" ? "" : getComputedStyle(el).transform);
    window.__t.samples.push([performance.now() - window.__t.t0, m.m41]);
    if (performance.now() - window.__t.t0 < 900) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  btn.click(); // همان فریمِ t0 — بدون سربار Playwright
});
await page.waitForTimeout(1000);
const timing = await page.evaluate(() => {
  const s = window.__t.samples; // [ms, txPx] — عرض پنل ۲۹۰px؛ بسته=۲۹۰، باز=۰
  const started = s.find(([, x]) => x < 261)?.[0] ?? 9999;
  const opened = s.find(([, x]) => x < 2)?.[0] ?? 9999;
  return { started, opened, first: s[0]?.[0] ?? -1, n: s.length };
});
check("شروع حرکت پنل بلافاصله پس از کلیک (<120ms)", timing.started < 120, `started=${timing.started.toFixed(0)}ms`);
check("باز شدن کامل زیر 420ms", timing.opened < 420, `opened=${timing.opened.toFixed(0)}ms`);

// ─── ۳) درگ زندهٔ ۱:۱ روی خود پنل → بستن ───
let st = await panelState(page);
check("منو پس از کلیک باز است", Math.abs(txPct(st.transform)) < 1, `tx=${st.transform}`);
await cdpTouch.start(cdp, 60, 400);
await sleep(25);
await cdpTouch.move(cdp, 85, 400); await sleep(40); // dx=+25 → p≈0.914 → tx≈8.6%
st = await panelState(page);
const p1 = txPct(st.transform);
check("پنل زیر انگشت حرکت کرد (۱:۱)", p1 !== null && p1 > 3 && p1 < 16, `tx=${p1}%`);
check("حین درگ بدون ترنزیشن (لایو)", st.transition === "none", `transition=${st.transition}`);
await cdpTouch.move(cdp, 145, 400); await sleep(40); // dx=+85 → tx≈29%
st = await panelState(page);
const p2 = txPct(st.transform);
check("ادامهٔ درگ باز هم ۱:۱", p2 !== null && p2 > 22 && p2 < 36, `tx=${p2}%`);
await cdpTouch.move(cdp, 215, 400); await sleep(40); // dx=+155 → p≈0.466 → tx≈53%
await cdpTouch.end(cdp);
await sleep(450);
st = await panelState(page);
check("رها کردن در کمتر از نیمی از راه → بسته شد", Math.abs(txPct(st.transform) - 100) < 1, `tx=${st.transform}`);

// ─── ۴) لبهٔ راست، درگِ کندِ نیمه → برمی‌گردد (بسته می‌ماند) ───
await cdpTouch.start(cdp, 385, 400);
await sleep(25);
for (const x of [381, 377, 373, 369, 365, 361, 357, 353, 349, 345, 341, 337, 333, 329, 325, 321, 317, 313, 309, 305]) {
  await cdpTouch.move(cdp, x, 400); await sleep(28); // ~۴px در ۲۸ms → سرعت کم، بدون فلیک
}
st = await panelState(page);
const e1 = txPct(st.transform);
check("کشیدن کند از لبهٔ راست پنل را ۱:۱ باز می‌کند", e1 !== null && e1 > 66 && e1 < 79, `tx=${e1}% (dx=-80 از 290px → p≈0.276 → tx≈72.4%)`);
await cdpTouch.end(cdp);
await sleep(450);
st = await panelState(page);
check("نیمه‌بازِ لبه → رها کردن، بسته شد", Math.abs(txPct(st.transform) - 100) < 1, `tx=${st.transform} (p<0.5)`);

// ─── ۵) لبهٔ راست، درگ کامل → باز می‌شود ───
await cdpTouch.start(cdp, 385, 400);
await sleep(25);
for (const x of [345, 305, 265, 225, 185, 145, 105, 65]) { await cdpTouch.move(cdp, x, 400); await sleep(18); }
await cdpTouch.end(cdp);
await sleep(450);
st = await panelState(page);
check("درگ کامل از لبه → منو باز شد", Math.abs(txPct(st.transform)) < 1, `tx=${st.transform}`);

// ─── ۶) فلیک سریع به راست روی پنلِ باز → بسته می‌شود (سرعت) ───
await cdpTouch.start(cdp, 60, 400);
await sleep(15);
await cdpTouch.move(cdp, 90, 400); await sleep(12);
await cdpTouch.move(cdp, 130, 400); await sleep(12);
await cdpTouch.end(cdp); // فلیک +70px در ~30ms → سرعت بالا
await sleep(450);
st = await panelState(page);
check("فلیک سریع → منو بسته شد (منطق سرعت)", Math.abs(txPct(st.transform) - 100) < 1, `tx=${st.transform}`);

// ─── ۷) تپ روی پرده → بسته می‌ماند / باز با کلیک باز هم کار می‌کند ───
await page.click('nav[aria-label="ناوبری پایین"] button:has-text("منو")');
await sleep(400);
st = await panelState(page);
check("کلیک مجدد دکمه → باز شدن دوباره فوری", Math.abs(txPct(st.transform)) < 1, `tx=${st.transform}`);
await page.touchscreen.tap(30, 400);
await sleep(450);
st = await panelState(page);
check("تپ روی پرده → بسته شد", Math.abs(txPct(st.transform) - 100) < 1, `tx=${st.transform}`);

// ─── ۸) اسکرول عمودی داخل منو مختل نشده باشد ───
await page.click('nav[aria-label="ناوبری پایین"] button:has-text("منو")');
await sleep(400);
const scrollable = await page.evaluate((sel) => {
  const el = document.querySelector(sel);
  return el && el.scrollHeight > el.clientHeight;
}, PANEL);
await cdpTouch.start(cdp, 145, 700);
await sleep(20);
for (const y of [680, 650, 620, 590]) { await cdpTouch.move(cdp, 145, y); await sleep(16); }
await cdpTouch.end(cdp);
await sleep(300);
st = await panelState(page);
check("کشیدن عمودی داخل منو → منو جابه‌جا نشد (اسکرول)", Math.abs(txPct(st.transform)) < 1, `tx=${st.transform} scrollable=${scrollable}`);

await page.screenshot({ path: "download/qa-drawer-open.png" });

const realErrors = errors.filter((e) => !/favicon|Manifest|sw\.js|updates/.test(e));
check("بدون خطای کنسول/صفحه", realErrors.length === 0, realErrors.slice(0, 2).join(" | "));

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} تست مرد` : "\nهمهٔ تست‌ها سبز");
process.exit(failed ? 1 : 0);
