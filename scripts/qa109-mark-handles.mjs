// ─── QA 0.10.9 — دستگیره‌های اختصاصی تنظیم بازهٔ نشان ────────────────────────
// ۱) لمس نشان → نوار ویرایش + دو دستگیرهٔ اختصاصی سر و ته (بدون هیچ انتخاب برنامه‌ای)
// ۲) جمع‌شدن انتخاب بومی، نوارِ بازشده با لمس را نمی‌بندد (via:"tap" — ریشهٔ «درجا غیب میشه»)
// ۳) حین کشیدن دستگیره، نوار رنگ‌ها پنهان می‌شود و بعد از رها کردن برمی‌گردد
// ۴) کوچک‌سازی از سرِ نشان: شروع «دقیقاً» روی واژهٔ دوم می‌نشیند (فیکس so-1 — یک نویسهٔ اضافه ممنوع)
// ۵) گسترش از تهِ نشان: واژهٔ بعدی اضافه می‌شود
// ۶) ذخیره با همان id و همان رنگ (upsert) — متن DOM === متن استور
// ۷) لمس بیرون → نوار و دستگیره‌ها بسته می‌شوند
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

await page.goto(BASE + "/#/learn/m-l1-1", { waitUntil: "networkidle" });
await page.waitForSelector("article [data-sec-id]", { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(2500);

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

// ── انتخاب یک «عبارت دوواژه‌ای» یکتا (برای آزمون کوچک‌سازی و گسترش) ──
const picked = await page.evaluate(() => {
  const secs = [...document.querySelectorAll("article [data-sec-id]")];
  for (const sec of secs) {
    const ps = [...sec.querySelectorAll("p")].filter((p) => (p.textContent || "").trim().length > 60);
    if (ps.length < 2) continue;
    const target = ps[1];
    const secText = (sec.textContent || "").replace(/\s+/g, " ");
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
    let tn;
    while ((tn = walker.nextNode())) {
      const words = (tn.nodeValue || "").split(/(\s+)/);
      const idxs = [];
      let pos = 0;
      for (const w of words) {
        if (w.trim()) idxs.push({ w, start: pos, len: w.length });
        pos += w.length;
      }
      for (let k = 0; k + 1 < idxs.length; k++) {
        const a = idxs[k], b = idxs[k + 1];
        if (a.w.length >= 4 && b.w.length >= 4) {
          const phrase = a.w + " " + b.w;
          if (secText.split(phrase).length - 1 === 1) {
            const tr = target.getBoundingClientRect();
            window.scrollBy({ top: tr.top - innerHeight / 2 + tr.height / 2, behavior: "instant" });
            const rng = document.createRange();
            rng.setStart(tn, a.start);
            rng.setEnd(tn, b.start + b.len);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(rng);
            document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
            return { phrase, word1: a.w, word2: b.w, nodeText: tn.nodeValue, w2Start: b.start };
          }
        }
      }
    }
  }
  return null;
});
ok(`عبارت دوواژه‌ای یکتا پیدا شد («${picked?.phrase}»)`, !!picked);
if (!picked) process.exit(1);

await page.waitForSelector("[data-mark-toolbar]", { timeout: 6000 });
await page.waitForTimeout(300);
await page.locator("[data-mark-toolbar] button[title='رنگ نشان']").first().click();
await page.waitForTimeout(600);
const marked = await page.evaluate(() => {
  const mk = document.querySelector("article mark[data-lexa-mark]");
  if (!mk) return null;
  const store = JSON.parse(localStorage.getItem("lexa-store-v1") || "{}");
  const list = store?.state?.marks?.["m-l1-1"] ?? [];
  return { mid: mk.dataset.mid, text: mk.textContent, rec: list.find((m) => m.id === mk.dataset.mid) };
});
ok("نشان از عبارت ساخته شد", !!marked && norm(marked.text) === norm(picked.phrase), JSON.stringify(marked?.rec ?? {}));
const recId = marked?.mid;

// ── لمس نشان → نوار + دو دستگیره؛ بدون انتخاب برنامه‌ای ──
await page.evaluate((mid) => {
  const mk = document.querySelector(`article mark[data-lexa-mark][data-mid='${mid}']`);
  const r = mk.getBoundingClientRect();
  window.scrollBy({ top: r.top - innerHeight / 2, behavior: "instant" });
}, recId);
await page.waitForTimeout(350);
await page.evaluate(() => document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
await page.waitForTimeout(150);
await page.locator(`article mark[data-lexa-mark][data-mid='${recId}']`).first().click();
await page.waitForTimeout(450);
ok("نوار ویرایش با لمس نشان باز شد", await page.locator('[data-mark-toolbar][role="toolbar"]').isVisible());
const noSelAfterTap = await page.evaluate(() => {
  const sel = window.getSelection();
  return !sel || sel.rangeCount === 0 || sel.isCollapsed;
});
ok("لمس نشان هیچ انتخاب برنامه‌ای نمی‌سازد", noSelAfterTap);
const knobs = await page.evaluate(() => ({
  start: !!document.querySelector('[aria-label="ابتدای نشان"]'),
  end: !!document.querySelector('[aria-label="انتهای نشان"]'),
}));
ok("دو دستگیرهٔ اختصاصی سر و ته نشان ظاهر شدند", knobs.start && knobs.end, JSON.stringify(knobs));

// ── جمع‌شدن انتخاب، نوار لمسی را نمی‌بندد (via:"tap") ──
await page.evaluate(() => {
  const sel = window.getSelection();
  if (sel) sel.removeAllRanges();
  document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
});
await page.waitForTimeout(500);
ok("جمع‌شدن انتخاب، نوارِ بازشده با لمس را نمی‌بندد", await page.locator('[data-mark-toolbar][role="toolbar"]').isVisible());
ok("دستگیره‌ها بعد از جمع‌شدن انتخاب هم هستند", (await page.evaluate(() => !!document.querySelector('[aria-label="انتهای نشان"]'))));

// ── کمکی کشیدن دستگیره — بازگشت: نوار حین کشیدن پنهان بود؟ ──
async function dragKnob(which, targetX, targetY) {
  const label = which === "start" ? "ابتدای نشان" : "انتهای نشان";
  const box = await page.locator(`[aria-label="${label}"]`).boundingBox();
  if (!box) throw new Error("دستگیره پیدا نشد: " + which);
  const gx = box.x + box.width / 2, gy = box.y + box.height / 2;
  await page.mouse.move(gx, gy);
  await page.mouse.down();
  await page.waitForTimeout(140);
  // 0.10.10: نوار رنگ‌ها فقط پس از عبور از ناحیهٔ مردهٔ ۴px پنهان می‌شود (تپِ بی‌حرکت نباید نوار را فلش کند) —
  // نمونه‌گیری بعد از گام دومِ درگ یعنی در حالت «در حال کشیدن» واقعی.
  const steps = 14;
  let toolbarDuringDrag = false;
  for (let i = 1; i <= steps; i++) {
    // درگ افقی در ارتفاعِ ثابتِ گرفتن — مثل انگشت واقعی روی دستگیره (زیر خط متن).
    // آفستِ گرفتن، caret را روی خط متن پروجکت می‌کند: caret.y = gy - offY ≈ targetY
    await page.mouse.move(gx + ((targetX - gx) * i) / steps, gy);
    await page.waitForTimeout(30);
    if (i === 2) toolbarDuringDrag = await page.evaluate(() => !!document.querySelector('[data-mark-toolbar][role="toolbar"]'));
  }
  await page.mouse.up();
  await page.waitForTimeout(550);
  return toolbarDuringDrag;
}
const recText = () => page.evaluate((id) => {
  const store = JSON.parse(localStorage.getItem("lexa-store-v1") || "{}");
  const list = store?.state?.marks?.["m-l1-1"] ?? [];
  const rec = list.find((m) => m.id === id);
  const mk = document.querySelector(`article mark[data-lexa-mark][data-mid='${id}']`);
  return rec ? { text: rec.text, color: rec.color, dom: mk ? mk.textContent : null } : null;
}, recId);

// ── کوچک‌سازی از سر — شروع دقیقاً روی واژهٔ دوم (فیکس so-1) ──
// هدف: نقطهٔ متنی ابتدای واژهٔ دوم (میانِ نود متنی — so>0). در RTL نیمهٔ راستِ نویسهٔ نخستِ واژهٔ دوم → افست همان واژه.
async function aimSecondWordStart(mode) {
  return page.evaluate(({ mid, word1, mode }) => {
    const segs = [...document.querySelectorAll(`article mark[data-lexa-mark][data-mid='${mid}']`)];
    const walker = document.createTreeWalker(segs[0], NodeFilter.SHOW_TEXT);
    let tn = walker.nextNode();
    const text = tn.nodeValue;
    const after1 = text.indexOf(word1) + word1.length;
    const m = text.slice(after1).match(/(\s+)(\S)/);
    if (!m) return null;
    const start = after1 + m[1].length; // ابتدای واژهٔ دوم در همان نود
    const r = document.createRange();
    r.setStart(tn, start);
    r.setEnd(tn, start + 1);
    const rect = r.getBoundingClientRect();
    const x = mode === 0 ? rect.right - 1 : mode === 1 ? rect.left + 1 : rect.left + rect.width / 2;
    return { x, y: rect.top + rect.height / 2 };
  }, { mid: recId, word1: picked.word1, mode });
}
const expectedShrunk = picked.word2;
let shrunkText = null, toolbarHiddenDuringDrag = false;
for (let mode = 0; mode < 3; mode++) {
  const pt = await aimSecondWordStart(mode);
  if (!pt) break;
  toolbarHiddenDuringDrag = !(await dragKnob("start", pt.x, pt.y));
  const cur = await recText();
  if (cur && norm(cur.text) === norm(expectedShrunk)) { shrunkText = cur.text; break; }
  console.log(`    [shrink attempt ${mode}] got «${norm(cur?.text)}»`);
}
ok("حین کشیدن دستگیره، نوار رنگ‌ها پنهان شد", toolbarHiddenDuringDrag);
ok(`کوچک‌سازی از سرِ نشان دقیق بود («${norm(shrunkText)}» === «${expectedShrunk}») — بدون نویسهٔ اضافه (فیکس so-1)`, !!shrunkText && norm(shrunkText) === norm(expectedShrunk));

// ── گسترش از ته — واژهٔ بعدی بعد از نشان اضافه می‌شود ──
const nextInfo = await page.evaluate((mid) => {
  const mk = document.querySelector(`article mark[data-lexa-mark][data-mid='${mid}']`);
  const walker = document.createTreeWalker(mk.parentNode, NodeFilter.SHOW_TEXT);
  let tn, sawMark = false;
  while ((tn = walker.nextNode())) {
    if ((tn.parentElement || {}).closest?.("mark[data-lexa-mark]")) { sawMark = true; continue; }
    if (sawMark) {
      const m2 = (tn.nodeValue || "").match(/\S+/);
      if (m2) {
        const idx = tn.nodeValue.indexOf(m2[0]);
        const r = document.createRange();
        r.setStart(tn, idx + m2[0].length - 1);
        r.setEnd(tn, idx + m2[0].length);
        const rect = r.getBoundingClientRect();
        return { word: m2[0], x: rect.left + 1, y: rect.top + rect.height / 2 };
      }
    }
  }
  return null;
}, recId);
ok(`واژهٔ بعدی برای گسترش پیدا شد («${nextInfo?.word}»)`, !!nextInfo);
let extended = null;
for (let att = 0; att < 4 && nextInfo; att++) {
  const tx = nextInfo.x - att * 4;
  await dragKnob("end", tx, nextInfo.y);
  const cur = await recText();
  if (cur && norm(cur.text).endsWith(" " + nextInfo.word)) { extended = cur; break; }
  console.log(`    [extend attempt ${att}] got «${norm(cur?.text)}»`);
}
ok(`گسترش از تهِ نشان کار کرد (+ «${nextInfo?.word}»)`, !!extended);
ok("همان id و همان رنگ حفظ شد (upsert)", extended?.color === "yellow", JSON.stringify({ color: extended?.color }));
ok("متن DOM نشان === متن استور", !!extended && norm(extended.dom) === norm(extended.text));

// ── لمس بیرون → نوار و دستگیره‌ها بسته می‌شوند ──
await page.mouse.click(40, 500);
await page.waitForTimeout(500);
const closed = await page.evaluate(() => ({
  tb: !!document.querySelector('[data-mark-toolbar][role="toolbar"]'),
  knobs: !!document.querySelector('[aria-label="انتهای نشان"]'),
}));
ok("لمس بیرون، نوار و دستگیره‌ها را بست", !closed.tb && !closed.knobs, JSON.stringify(closed));

ok("صفر خطای کنسول", errors.length === 0, JSON.stringify(errors.slice(0, 3)));
await browser.close();
console.log(`\nqa109-mark-handles: ${pass} گذرانده، ${fail} شکسته`);
process.exit(fail ? 1 : 0);
