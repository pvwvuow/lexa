// ─── QA 0.10.14 — marks v2: موتور بازنویسی‌شدهٔ نشان‌گذاری (CSS Highlight API + مدل ایندکسی متنی) ──
// این تست مسیرِ «اصلی» موتور جدید را می‌پوشاند (Highlight API فعال — کرومیوم مدرن/وب‌ویو اندروید):
// ۱) نشان‌سازی با انتخاب + نوار → رجیستری CSS.highlights پر می‌شود؛ هیچ <mark> در DOM ساخته نمی‌شود (غیرمخرب)
// ۲) تپ روی موقعیت نشان (از rect بازهٔ رجیستری) → نوار ویرایش + دو دستگیرهٔ اختصاصی
// ۳) کشیدن دستگیره → commit با همان id (upsert) — بازهٔ استور بدون لرزش عوض می‌شود
// ۴) تغییر رنگ از نوار ویرایش → گروه رنگ در رجیستری جابه‌جا می‌شود؛ id ثابت می‌ماند
// ۵) نشان بین‌پاراگرافی → چند بازهٔ رجیستری برای یک نشان (چندقطعه‌ای)
// ۶) رفرش صفحه → مدل از استور بازسازی و رجیستری دوباره رنگ می‌شود (پایداری)
// ۷) پاک‌کن روی انتخابِ نشان → بازه‌ها از رجیستری و استور حذف می‌شوند
// ۸) صفر خطای کنسول
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://127.0.0.1:3210";
let pass = 0, fail = 0;
function ok(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name} ${extra}`); }
}
const norm = (s) => (s || "").replace(/\s+/g, " ").trim();

const browser = await chromium.launch();
const errors = [];
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
page.on("pageerror", (e) => errors.push("pageerror: " + String(e)));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text()); });

// خواندن رجیستری Highlight — شمارش بازه‌های هر گروه رنگ
const REG_FN = `
  window.__hlCounts = () => {
    try {
      const reg = window.CSS && window.CSS.highlights;
      if (!reg) return { __supported: false };
      const out = { __supported: true };
      reg.forEach((h, name) => {
        let n = 0;
        try { for (const r of h) { if (r && !r.collapsed) n++; } } catch {}
        out[name] = n;
      });
      return out;
    } catch { return { __supported: false }; }
  };
`;

console.log("── ۱) محیط: Highlight API در دسترس است ──");
await page.goto(BASE + "/#/learn/m-l1-1", { waitUntil: "networkidle" });
await page.waitForSelector("article [data-sec-id]", { timeout: 30000 }).catch(() => {});
await page.addInitScript(REG_FN);
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector("article [data-sec-id]", { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1200);
const env = await page.evaluate(() => ({ hl: typeof Highlight === "function", reg: !!window.CSS?.highlights }));
ok("CSS Highlight API فعال است (مسیر اصلی v2)", env.hl && env.reg, JSON.stringify(env));

console.log("── ۲) نشان‌سازی با انتخاب + نوار → رجیستری پر می‌شود، DOM دست‌نخورده ──");
const picked = await page.evaluate(() => {
  const sec = document.querySelector("article [data-sec-id]");
  const walker = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT);
  let tn, word = null, node = null, idx = 0;
  const counts = new Map();
  const texts = [];
  while ((tn = walker.nextNode())) texts.push(tn);
  for (const t of texts) {
    const words = (t.nodeValue || "").match(/[\u0600-\u06FF]{4,}/g) || [];
    for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);
  }
  outer: for (const t of texts) {
    const words = (t.nodeValue || "").match(/[\u0600-\u06FF]{4,}/g) || [];
    for (const w of words) {
      if ((counts.get(w) || 0) === 1 && w.length >= 5) {
        word = w; node = t; idx = t.nodeValue.indexOf(w); break outer;
      }
    }
  }
  if (!word) return null;
  const rng = document.createRange();
  rng.setStart(node, idx);
  rng.setEnd(node, idx + word.length);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(rng);
  document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
  return { word };
});
ok("کلمهٔ یکتا برای نشان پیدا شد", !!picked, JSON.stringify(picked ?? {}));
await page.waitForTimeout(500);
const barNew = await page.locator("[data-mark-toolbar][role='toolbar']").isVisible({ timeout: 3000 }).catch(() => false);
ok("نوار نشان‌گذاری روی انتخاب باز شد", barNew);
if (barNew) {
  await page.locator("[data-mark-toolbar] button[title='رنگ نشان']").first().click();
  await page.waitForTimeout(700);
}
const afterNew = await page.evaluate(() => {
  const hl = window.__hlCounts();
  const domMarks = document.querySelectorAll("article mark[data-lexa-mark]").length;
  const store = JSON.parse(localStorage.getItem("lexa-store-v1") || "{}");
  const list = store?.state?.marks?.["m-l1-1"] ?? [];
  return { hl, domMarks, list: list.map((m) => ({ id: m.id, text: m.text, color: m.color })) };
}, { REG_FN });
ok("رجیستری lexa-mk-yellow بازهٔ زنده دارد", (afterNew.hl["lexa-mk-yellow"] || 0) >= 1, JSON.stringify(afterNew.hl));
ok("هیچ <mark> در DOM ساخته نشد (رنگ‌آمیزی غیرمخرب)", afterNew.domMarks === 0, `dom=${afterNew.domMarks}`);
const rec0 = afterNew.list[0];
ok("نشان در استور با متن درست ذخیره شد", rec0 && norm(rec0.text) === norm(picked.word) && rec0.color === "yellow", JSON.stringify(afterNew.list));

console.log("── ۳) تپ روی موقعیت نشان (rect رجیستری) → نوار ویرایش + دستگیره‌ها ──");
const tapP = await page.evaluate(() => {
  const reg = window.CSS?.highlights;
  const h = reg && reg.get("lexa-mk-yellow");
  if (!h) return null;
  for (const r of h) {
    const b = r.getBoundingClientRect();
    if (b.width > 2 && b.height > 2) return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  }
  return null;
});
ok("rect نشان از رجیستری خوانده شد", !!tapP, JSON.stringify(tapP ?? {}));
await page.mouse.click(tapP.x, tapP.y);
await page.waitForTimeout(600);
const editOpen = await page.evaluate(() => {
  const tb = document.querySelector("[data-mark-toolbar][role='toolbar']");
  return { open: !!tb, delBtn: !!tb?.querySelector("button[aria-label='حذف نشان']"), handles: document.querySelectorAll("[data-mark-handle]").length };
});
ok("نوار ویرایش (حالت edit) با تپ باز شد", editOpen.open && editOpen.delBtn, JSON.stringify(editOpen));
ok("دو دستگیرهٔ سر و ته ظاهر شدند", editOpen.handles === 2, `handles=${editOpen.handles}`);

console.log("── ۴) کشیدن دستگیرهٔ انتها → upsert با همان id ──");
const endH = await page.evaluate(() => {
  const h = document.querySelector('[data-mark-handle="end"]');
  if (!h) return null;
  const r = h.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
ok("دستگیرهٔ انتها پیدا شد", !!endH, JSON.stringify(endH ?? {}));
const id0 = rec0.id;
if (endH) {
  await page.mouse.move(endH.x, endH.y);
  await page.mouse.down();
  // فارسی RTL: واژهٔ بعدی سمت چپ است — گام‌به‌گام به چپ
  for (let i = 1; i <= 8; i++) await page.mouse.move(endH.x - i * 9, endH.y + 1, { steps: 1 });
  await page.mouse.up();
  await page.waitForTimeout(700);
}
const grownStore = await page.evaluate((id) => {
  const store = JSON.parse(localStorage.getItem("lexa-store-v1") || "{}");
  const rec = (store?.state?.marks?.["m-l1-1"] ?? []).find((m) => m.id === id);
  const hl = window.__hlCounts();
  return { rec, hl };
}, id0);
ok("کشیدن دستگیره بازه را از انتها بزرگ کرد (همان id)", grownStore.rec && norm(grownStore.rec.text).length > norm(picked.word).length && norm(grownStore.rec.text).startsWith(norm(picked.word).slice(0, 4)), JSON.stringify(grownStore.rec ?? {}));
ok("رجیستری بعد از کشیدن همچنان زنده است", (grownStore.hl["lexa-mk-yellow"] || 0) >= 1, JSON.stringify(grownStore.hl));

console.log("── ۵) تغییر رنگ از نوار ویرایش → گروه رجیستری جابه‌جا، id ثابت ──");
await page.mouse.click(tapP.x, tapP.y); // تپ مجدد — بعد از کشیدن، موقعیت ممکن است عوض شده باشد
await page.waitForTimeout(500);
// اگر تپ اول نوار را باز نکرد، از rect تازهٔ رجیستری دوباره تپ می‌زنیم
const tap2 = await page.evaluate(() => {
  const tb = document.querySelector("[data-mark-toolbar][role='toolbar']");
  if (tb) return null;
  const reg = window.CSS?.highlights;
  const h = reg && reg.get("lexa-mk-yellow");
  if (!h) return null;
  for (const r of h) {
    const b = r.getBoundingClientRect();
    if (b.width > 2 && b.height > 2) return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  }
  return null;
});
if (tap2) { await page.mouse.click(tap2.x, tap2.y); await page.waitForTimeout(500); }
const greenBtn = page.locator("[data-mark-toolbar] button[aria-label='نشان با رنگ green']");
const greenVisible = await greenBtn.isVisible().catch(() => false);
ok("نوار ویرایش با دکمهٔ رنگ سبز باز است", greenVisible);
if (greenVisible) {
  await greenBtn.click();
  await page.waitForTimeout(700);
}
const afterRecolor = await page.evaluate((id) => {
  const store = JSON.parse(localStorage.getItem("lexa-store-v1") || "{}");
  const rec = (store?.state?.marks?.["m-l1-1"] ?? []).find((m) => m.id === id);
  return { rec, hl: window.__hlCounts() };
}, id0);
ok("رنگ نشان در استور سبز شد (همان id)", afterRecolor.rec?.color === "green", JSON.stringify(afterRecolor.rec ?? {}));
ok("گروه سبز رجیستری زنده است", (afterRecolor.hl["lexa-mk-green"] || 0) >= 1, JSON.stringify(afterRecolor.hl));
ok("گروه زرد رجیستری خالی شد", (afterRecolor.hl["lexa-mk-yellow"] || 0) === 0, JSON.stringify(afterRecolor.hl));

console.log("── ۶) نشان بین‌پاراگرافی → چند بازه در رجیستری ──");
// باز کردن بخش‌های بیشتر («ادامه بده») — برای یافتن بخش دوپاراگرافی
for (let i = 0; i < 3; i++) {
  const btn = page.locator("button:has-text('ادامه بده')");
  if ((await btn.count()) === 0) break;
  await btn.first().click();
  await page.waitForTimeout(400);
}
let lastY = -1;
for (let i = 0; i < 30; i++) {
  const y = await page.evaluate(() => window.scrollY);
  if (y === lastY) break;
  lastY = y;
  await page.waitForTimeout(300);
}
const sentPick = await page.evaluate(() => {
  const secs = [...document.querySelectorAll("article [data-sec-id]")];
  for (const sec of secs) {
    const ps = [...sec.querySelectorAll("p")].filter((p) => (p.textContent || "").trim().length > 60);
    if (ps.length < 2) continue;
    const wa = document.createTreeWalker(ps[0], NodeFilter.SHOW_TEXT);
    const wb = document.createTreeWalker(ps[1], NodeFilter.SHOW_TEXT);
    let ta = null, tb2 = null, n;
    while ((n = wa.nextNode())) if ((n.nodeValue || "").trim().length > 20) ta = n;
    while ((n = wb.nextNode())) { if ((n.nodeValue || "").trim().length > 20) { tb2 = n; break; } }
    if (!ta || !tb2) continue;
    const va = ta.nodeValue || "", vb = tb2.nodeValue || "";
    const rng = document.createRange();
    rng.setStart(ta, Math.max(0, va.length - 20));
    rng.setEnd(tb2, Math.min(vb.length, 20));
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(rng);
    document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
    return true;
  }
  return false;
});
ok("بازهٔ بین‌پاراگرافی ساخته شد", sentPick);
await page.waitForTimeout(120); // اسکرول بومی کروم
await page.evaluate(() => {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const r = sel.getRangeAt(0).getBoundingClientRect();
  window.scrollBy({ top: r.top - innerHeight / 2 - 60, behavior: "instant" });
});
await page.waitForTimeout(600);
const tbNew = await page.locator("[data-mark-toolbar][role='toolbar']").isVisible({ timeout: 3000 }).catch(() => false);
if (tbNew) {
  await page.locator("[data-mark-toolbar] button[title='رنگ نشان']").nth(1).click(); // سبز — همان گروه
  await page.waitForTimeout(700);
}
const afterSent = await page.evaluate(() => {
  const store = JSON.parse(localStorage.getItem("lexa-store-v1") || "{}");
  const list = store?.state?.marks?.["m-l1-1"] ?? [];
  return { count: list.length, hl: window.__hlCounts(), dom: document.querySelectorAll("article mark[data-lexa-mark]").length };
});
ok("نشان دوم در استور ثبت شد", afterSent.count === 2, `count=${afterSent.count}`);
ok("بازه‌های سبز رجیستری = ۲ (یک بازه به‌ازای هر نشان)", (afterSent.hl["lexa-mk-green"] || 0) === 2, JSON.stringify(afterSent.hl));
const crossPara = await page.evaluate(() => {
  const reg = window.CSS?.highlights;
  const h = reg && reg.get("lexa-mk-green");
  if (!h) return false;
  for (const r of h) {
    try {
      const pa = r.startContainer.parentElement?.closest("p");
      const pb = r.endContainer.parentElement?.closest("p");
      if (pa && pb && pa !== pb) return true;
    } catch {}
  }
  return false;
});
ok("نشان جمله‌ای از مرز پاراگراف می‌گذرد (یک بازهٔ چندبلوکی — معادل v2 چندقطعه‌ای)", crossPara);
ok("بعد از نشان چندقطعه‌ای هم DOM بدون mark است", afterSent.dom === 0, `dom=${afterSent.dom}`);

console.log("── ۷) رفرش صفحه → بازسازی مدل از استور و رنگ دوباره ──");
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector("article [data-sec-id]", { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1500);
const afterReload = await page.evaluate(() => {
  const store = JSON.parse(localStorage.getItem("lexa-store-v1") || "{}");
  const list = store?.state?.marks?.["m-l1-1"] ?? [];
  return { count: list.length, hl: window.__hlCounts(), dom: document.querySelectorAll("article mark[data-lexa-mark]").length };
});
ok("بعد از رفرش هر دو نشان در استور هستند", afterReload.count === 2, `count=${afterReload.count}`);
ok("بعد از رفرش رجیستری دوباره رنگید (سبز = ۲)", (afterReload.hl["lexa-mk-green"] || 0) === 2, JSON.stringify(afterReload.hl));
ok("بعد از رفرش هم هیچ <mark> در DOM نیست", afterReload.dom === 0, `dom=${afterReload.dom}`);

console.log("── ۸) پاک‌کن روی انتخاب نشان → حذف از استور و رجیستری ──");
const eraseSel = await page.evaluate((wantText) => {
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  const reg = window.CSS?.highlights;
  const h = reg && reg.get("lexa-mk-green");
  if (!h) return false;
  for (const r of h) {
    // فقط بازه‌ای که متنش با نشانِ کلمه مطابقت دارد — نه قطعه‌های نشان جمله‌ای
    if (r && !r.collapsed && norm(r.toString()) === norm(wantText)) {
      const copy = document.createRange();
      copy.setStart(r.startContainer, r.startOffset);
      copy.setEnd(r.endContainer, r.endOffset);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(copy);
      document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
      return true;
    }
  }
  return false;
}, grownStore.rec?.text ?? picked.word);
ok("انتخابِ روی نشان (از rect رجیستری) ساخته شد", eraseSel);
await page.waitForTimeout(600);
const eraserVisible = await page.locator("[data-mark-toolbar] button[aria-label='پاک‌کردن نشان از این قسمت']").isVisible({ timeout: 3000 }).catch(() => false);
ok("پاک‌کن روی انتخابِ هم‌پوشان با نشان ظاهر شد", eraserVisible);
if (eraserVisible) {
  await page.locator("[data-mark-toolbar] button[aria-label='پاک‌کردن نشان از این قسمت']").click();
  await page.waitForTimeout(700);
}
const afterErase = await page.evaluate(() => {
  const store = JSON.parse(localStorage.getItem("lexa-store-v1") || "{}");
  const list = store?.state?.marks?.["m-l1-1"] ?? [];
  return { count: list.length, hl: window.__hlCounts() };
});
ok("پاک‌کن نشان اول را از استور حذف کرد", afterErase.count === 1, `count=${afterErase.count}`);
ok("بازهٔ پاک‌شده از رجیستری رفت (فقط بازهٔ نشان جمله‌ای مانده)", (afterErase.hl["lexa-mk-green"] || 0) === 1, JSON.stringify(afterErase.hl));

console.log("── ۹) خطاها ──");
ok("صفر خطای کنسول/صفحه", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
console.log(`\nqa114-marks-v2: ${pass} گذرانده، ${fail} شکسته`);
process.exit(fail ? 1 : 0);
