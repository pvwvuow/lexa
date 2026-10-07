// ─── QA 0.10.13 — مقاوم‌سازی کشیدن دستگیرهٔ نشان در وب‌ویو اندروید ────────────
// گزارش کاربر: «پیکان را که hold می‌کنم هیچ تأثیری ندارد، نه عقب می‌رود نه جلو — گیر کرده»
// ریشه: کشیدن فقط به رویدادهای pointer خودِ دستگیره (کپچر + onPointerMove) تکیه داشت؛
// در وب‌ویو واقعی، hold روی متن/انتخاب بومی یا افتادن کپچر جریان pointer را از
// دستگیره قطع می‌کند و کشیدن همان اول می‌میرد.
// فیکس: شنونده‌های window-level + فال‌بک لمس خالص + خنثی‌سازی contextmenu/selectstart.
// آزمون‌ها:
//  A) کشیدن لمسی واقعی (CDP) — دستگیره در «هر» گام زیر انگشت + ذخیره پس از رها کردن
//  B) جریان retarget‌شده: pointermove با هدفِ غیرِ دستگیره (شبیه‌سازی افتادن کپچر) —
//     کد قدیمی می‌میرد، کد جدید با شنوندهٔ window همچنان می‌راند
//  C) فال‌بک لمس خالص: بدون هیچ pointermove، فقط touchmove/touchend — کشیدن کامل و ذخیره
//  D) pointercancel وسط کشیدن — اگر جابه‌جایی بود ذخیره می‌شود و دستگیره‌ها نمیمیرند
//  E) hold ساکن طولانی + بعدش کشیدن — contextmenu نباید چیزی را ببندد
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://127.0.0.1:3210";
let pass = 0, fail = 0;
function ok(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name} ${extra}`); }
}

const browser = await chromium.launch();
const errors = [];
const page = await browser.newPage({
  viewport: { width: 412, height: 915 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});
// marks v2: شبیه‌سازی وب‌ویو قدیمی — مسیر فال‌بک DOM (بدون Highlight API)
await page.context().addInitScript(() => { try { Reflect.deleteProperty(window, "Highlight"); } catch {} });
page.on("pageerror", (e) => errors.push("pageerror: " + String(e)));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text()); });

await page.goto(BASE + "/#/learn/m-l1-1", { waitUntil: "networkidle" });
await page.waitForSelector("article [data-sec-id]", { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(2000);

for (let i = 0; i < 3; i++) {
  const btn = page.locator("button:has-text('ادامه بده')");
  if ((await btn.count()) === 0) break;
  await btn.first().click();
  await page.waitForTimeout(300);
}

// ── ساخت نشان دوواژه‌ای یکتا در پاراگرافی که به مرکز صفحه می‌آید ──
const picked = await page.evaluate(() => {
  const secs = [...document.querySelectorAll("article [data-sec-id]")];
  for (const sec of secs) {
    const ps = [...sec.querySelectorAll("p")].filter((p) => (p.textContent || "").trim().length > 60);
    for (const target of ps.slice(1)) {
      const secText = (sec.textContent || "").replace(/\s+/g, " ");
      const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
      let tn;
      while ((tn = walker.nextNode())) {
        const words = (tn.nodeValue || "").split(/(\s+)/);
        const idxs = [];
        let pos = 0;
        for (const w of words) { if (w.trim()) idxs.push({ w, start: pos, len: w.length }); pos += w.length; }
        for (let k = 0; k + 1 < idxs.length; k++) {
          const a = idxs[k], b = idxs[k + 1];
          if (a.w.length >= 4 && b.w.length >= 4) {
            const phrase = a.w + " " + b.w;
            if (secText.split(phrase).length - 1 === 1) {
              const tr = target.getBoundingClientRect();
              window.scrollTo({ top: Math.max(0, window.scrollY + tr.top - innerHeight / 2 + tr.height / 2), behavior: "instant" });
              const rr = target.getBoundingClientRect();
              if (rr.top < 100 || rr.bottom > innerHeight - 100) break;
              const rng = document.createRange();
              rng.setStart(tn, a.start);
              rng.setEnd(tn, b.start + b.len);
              const sel = window.getSelection();
              sel.removeAllRanges();
              sel.addRange(rng);
              document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
              return { phrase };
            }
          }
        }
      }
    }
  }
  return null;
});
ok(`عبارت آزمون پیدا شد («${picked?.phrase}»)`, !!picked);
if (!picked) process.exit(1);

await page.waitForSelector("[data-mark-toolbar]", { timeout: 6000 });
await page.evaluate(() => {
  document.querySelector("[data-mark-toolbar] button[title='رنگ نشان']")?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
});
await page.waitForTimeout(700);
const recId = await page.evaluate(() => document.querySelector("article mark[data-lexa-mark]")?.dataset?.mid ?? null);
ok("نشان ساخته شد", !!recId);
if (!recId) process.exit(1);

const storeRec = () => page.evaluate((id) => {
  const store = JSON.parse(localStorage.getItem("lexa-store-v1") || "{}");
  const rec = (store?.state?.marks?.["m-l1-1"] ?? []).find((m) => m.id === id);
  const mk = document.querySelector(`article mark[data-lexa-mark][data-mid='${id}']`);
  return rec ? { text: rec.text, dom: mk ? mk.textContent : null, color: rec.color } : null;
}, recId);
const norm = (s) => (s || "").replace(/\s+/g, " ").trim();

// ── بازکردن نوار ویرایش با تپ واقعی روی نشان + اسکرول به مرکز ──
async function openEditByTap() {
  const pt = await page.evaluate((mid) => {
    const mk = document.querySelector(`article mark[data-lexa-mark][data-mid='${mid}']`);
    const r = mk.getBoundingClientRect();
    window.scrollTo({ top: Math.max(0, window.scrollY + r.top - innerHeight / 2 + r.height / 2), behavior: "instant" });
    const rects = [...mk.getClientRects()].filter((q) => q.width > 2 && q.height > 2);
    const centers = rects.map((q) => ({ x: q.left + q.width / 2, y: q.top + q.height / 2 }));
    return { centers: [centers[0], centers[centers.length - 1]] }; // اولین و آخرین قطعهٔ خطی
  }, recId);
  for (const c of pt.centers) {
    if (!c) continue;
    await page.waitForTimeout(200);
    await page.touchscreen.tap(c.x, c.y);
    await page.waitForTimeout(500);
    if ((await page.locator('[data-mark-handle="start"]').count()) === 1) return 1;
  }
  return (await page.locator('[data-mark-handle="start"]').count()) === 1 ? 1 : 0;
}
const n0 = await openEditByTap();
ok("نوار ویرایش + دو دستگیره با تپ لمسی باز شد", n0 === 1);
if (n0 !== 1) process.exit(1);

// ═══ آزمون A — کشیدن لمسی واقعی CDP: دستگیره در هر گام زیر انگشت ═══
const cdp = await page.context().newCDPSession(page);
{
  const box = await page.locator('[data-mark-handle="start"]').boundingBox();
  const gx = box.x + box.width / 2, gy = box.y + box.height / 2;
  const DX = -70, steps = 8;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: gx, y: gy }] });
  await page.waitForTimeout(180);
  let maxDelta = 0;
  for (let i = 1; i <= steps; i++) {
    const x = gx + (DX * i) / steps;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: gy }] });
    await page.waitForTimeout(40);
    const b = await page.locator('[data-mark-handle="start"]').boundingBox().catch(() => null);
    // پس از عبور از سرِ دیگر، نقش‌ها جابه‌جا می‌شود — فقط تا پیش از عبور سنجیده می‌شود
    const cur = await page.evaluate(() => document.querySelector('[data-mark-handle="start"]')?.getAttribute("data-mark-handle"));
    if (cur === "start" && b) maxDelta = Math.max(maxDelta, Math.abs(b.x + b.width / 2 - x));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(650);
  ok("A: دستگیره تا عبور، دقیقاً زیر انگشت ماند", maxDelta < 26, `maxDelta=${maxDelta.toFixed(1)}`);
  const rec = await storeRec();
  ok("A: رها کردن → بازهٔ تازه ذخیره شد", !!rec && norm(rec.text) !== norm(picked.phrase), JSON.stringify(rec));
  ok("A: متن DOM نشان === استور", !!rec && norm(rec.dom) === norm(rec.text));
}

// ═══ آزمون B — retarget: رویدادهای move با هدف غیرِ دستگیره ═══
// شبیه‌سازی وب‌ویو: کپچر می‌افتد و moveها به عنصر دیگری می‌روند — فقط شنوندهٔ window نجات می‌دهد
{
  const box = await page.locator('[data-mark-handle="start"]').boundingBox();
  const gx = box.x + box.width / 2, gy = box.y + box.height / 2;
  const before = await storeRec();
  // به چپ (داخل صفحه) — ممکن است از لبهٔ دیگر عبور کند: نقش دستگیرهٔ زیر انگشت عوض می‌شود
  await page.evaluate(({ gx, gy }) => {
    window.__winMoves = [];
    window.addEventListener("pointermove", (e) => window.__winMoves.push(e.pointerId), true);
    const knob = document.querySelector('[data-mark-handle="start"]');
    const at = (x) => ({ bubbles: true, cancelable: true, pointerId: 42, pointerType: "touch", clientX: x, clientY: gy, isPrimary: true });
    knob.dispatchEvent(new PointerEvent("pointerdown", at(gx)));
    for (const dx of [15, 30, 45]) {
      document.body.dispatchEvent(new PointerEvent("pointermove", at(gx - dx)));
    }
  }, { gx, gy });
  await page.waitForTimeout(300);
  const diag = await page.evaluate(() => ({
    winMoves: window.__winMoves,
    knobs: ["ابتدای نشان", "انتهای نشان"].map((lbl) => {
      const el = document.querySelector(`[aria-label="${lbl}"]`);
      const b = el?.getBoundingClientRect();
      return { role: el?.getAttribute("data-mark-handle"), cx: b ? Math.round(b.x + b.width / 2) : null };
    }),
  }));
  // دستگیرهٔ در حال کشیدن (هر نقشی که شده — عبور نقش را عوض می‌کند) باید زیر انگشت باشد
  const knobsBoxes = await page.evaluate(() =>
    ["start", "end"].map((r) => {
      const b = document.querySelector(`[data-mark-handle="${r}"]`)?.getBoundingClientRect();
      return b ? Math.round(b.x + b.width / 2) : null;
    }));
  const movedUnderFinger = knobsBoxes.some((cx) => cx !== null && Math.abs(cx - (gx - 45)) < 26);
  await page.evaluate(({ ex, gy }) => {
    document.body.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true, cancelable: true, pointerId: 42, pointerType: "touch", isPrimary: true, clientX: ex, clientY: gy,
    }));
  }, { ex: gx - 45, gy });
  await page.waitForTimeout(650);
  ok("B: کشیدن با هدفِ retarget‌شده زنده ماند (شنوندهٔ window)", movedUnderFinger, JSON.stringify({ gx, knobsBoxes, diag }));
  const after = await storeRec();
  ok("B: رها کردن روی window → ذخیرهٔ بازهٔ تازه", !!after && norm(after.text) !== norm(before.text), JSON.stringify({ before, after }));
}

// ═══ آزمون C — فال‌بک لمس خالص: بدون هیچ pointermove (استریم pointer مُرد) ═══
{
  const box = await page.locator('[data-mark-handle="end"]').boundingBox();
  const gx = box.x + box.width / 2, gy = box.y + box.height / 2;
  const before = await storeRec();
  await page.evaluate(({ gx, gy }) => {
    window.__touch = (type, x, y) => {
      const t = new Touch({ identifier: 7, target: document.body, clientX: x, clientY: y });
      document.body.dispatchEvent(new TouchEvent(type, {
        bubbles: true, cancelable: true, touches: type === "touchend" ? [] : [t],
        targetTouches: [], changedTouches: [t],
      }));
    };
    const knob = document.querySelector('[data-mark-handle="end"]');
    knob.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true, cancelable: true, pointerId: 43, pointerType: "touch",
      clientX: gx, clientY: gy, isPrimary: true,
    }));
  }, { gx, gy });
  await page.waitForTimeout(160); // باید > ۱۲۰ms تا فال‌بک فعال شود
  // فقط touchmove — هیچ pointermove ای وجود ندارد
  for (let i = 1; i <= 5; i++) {
    await page.evaluate(({ gx, dx, gy }) => window.__touch("touchmove", gx + dx, gy), { gx, dx: -14 * i, gy });
    await page.waitForTimeout(50);
  }
  const midBox = await page.locator('[data-mark-handle="end"]').boundingBox().catch(() => null);
  const follows = !!midBox && Math.abs((midBox.x + midBox.width / 2) - (gx - 70)) < 28;
  await page.evaluate(({ ex, gy }) => window.__touch("touchend", ex, gy), { ex: gx - 70, gy });
  await page.waitForTimeout(650);
  ok("C: فال‌بک touchmove کشیدن را راند (بدون pointermove)", follows, JSON.stringify({ gx, knob: midBox }));
  const after = await storeRec();
  ok("C: touchend → ذخیرهٔ بازهٔ تازه", !!after && norm(after.text) !== norm(before.text), JSON.stringify({ before, after }));
  ok("C: همان id و رنگ حفظ شد", !!after && after.color === before.color, JSON.stringify({ c0: before.color, c1: after.color }));
}

// ═══ آزمون D — pointercancel وسط کشیدن: اگر جابه‌جایی بود، ذخیره می‌شود ═══
{
  const box = await page.locator('[data-mark-handle="start"]').boundingBox();
  const gx = box.x + box.width / 2, gy = box.y + box.height / 2;
  const before = await storeRec();
  await page.evaluate(({ gx, gy }) => {
    const knob = document.querySelector('[data-mark-handle="start"]');
    const at = (x) => ({ bubbles: true, cancelable: true, pointerId: 44, pointerType: "touch", clientX: x, clientY: gy, isPrimary: true });
    knob.dispatchEvent(new PointerEvent("pointerdown", at(gx)));
    document.body.dispatchEvent(new PointerEvent("pointermove", at(gx - 30)));
  }, { gx, gy });
  await page.waitForTimeout(250);
  await page.evaluate(({ gy }) => {
    document.body.dispatchEvent(new PointerEvent("pointercancel", {
      bubbles: true, cancelable: true, pointerId: 44, pointerType: "touch", isPrimary: true, clientX: 0, clientY: gy,
    }));
  }, { gy });
  await page.waitForTimeout(650);
  const after = await storeRec();
  ok("D: pointercancel پس از جابه‌جایی → ذخیرهٔ بازهٔ تازه", !!after && norm(after.text) !== norm(before.text), JSON.stringify({ before, after }));
  ok("D: دستگیره‌ها همچنان زنده‌اند", (await page.locator('[data-mark-handle="start"]').count()) === 1);
}

// ═══ آزمون E — hold ساکن طولانی (۷۰۰ms) سپس کشیدن واقعی ═══
{
  const box = await page.locator('[data-mark-handle="start"]').boundingBox();
  const gx = box.x + box.width / 2, gy = box.y + box.height / 2;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: gx, y: gy }] });
  await page.waitForTimeout(700); // hold ساکن — بیشتر از آستانهٔ long-press اندروید
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: gx - 10, y: gy }] });
  await page.waitForTimeout(45);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: gx - 22, y: gy }] });
  await page.waitForTimeout(45);
  const b = await page.locator('[data-mark-handle="start"]').boundingBox().catch(() => null);
  const follows = !!b && Math.abs((b.x + b.width / 2) - (gx - 22)) < 26 || !!b && Math.abs((b.x + b.width / 2) - (gx + 22)) < 26;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(650);
  ok("E: hold ساکن طولانی، کشیدن بعدی را نمی‌کُشد", follows, JSON.stringify({ gx, knob: b }));
  ok("E: نوار/دستگیره‌ها پس از hold بلند هنوز بازند", (await page.evaluate(() => !!document.querySelector('[data-mark-toolbar][role="toolbar"]'))));
}

ok("صفر خطای کنسول", errors.length === 0, JSON.stringify(errors.slice(0, 3)));
await browser.close();
console.log(`\nqa113-mark-handle-window: ${pass} گذرانده، ${fail} شکسته`);
process.exit(fail ? 1 : 0);
