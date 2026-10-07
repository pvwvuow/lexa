// ─── QA 0.10.11 — پرش به مادهٔ قانون + نوارِ چسبان تعقیب‌کنندهٔ نوار اصلی + ویرایش ایندکسی نشان ───
// ۱) هش مستقیم #/law/<id>/<no> → مادهٔ مقصد رندر، در دید، با حلقهٔ برجسته
// ۲) جستجوی سراسری → نتیجهٔ قانون → پرش به همان ماده
// ۳) در موبایل: نوار ابزار قانون با پنهان‌شدن نوار اصلی بالا می‌رود و با برگشت اسکرول سر جایش می‌نشیند
// ۴) ویرایش ایندکسی نشان: اسنپ به ابتدای واژه، عبور تمیز دستگیره از دیگری (تعویض نقش بدون خراب‌کردن بازه)
// ۵) اسکرول خودکار حین نزدیک‌شدن دستگیره به لبهٔ پایین
// ۶) صفر خطای کنسول
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

/* ══ بخش الف — موبایل: پرش به ماده + نوارِ تعقیب‌کننده ══ */
const mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
// marks v2: شبیه‌سازی وب‌ویو قدیمی — مسیر فال‌بک DOM (بدون Highlight API)
await mob.context().addInitScript(() => { try { Reflect.deleteProperty(window, "Highlight"); } catch {} });
mob.on("pageerror", (e) => errors.push("mob pageerror: " + String(e)));
mob.on("console", (m) => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push("mob: " + m.text()); });

console.log("── ۱) هش مستقیم #/law/asasi/۳ ──");
await mob.goto(BASE + "/#/law/asasi/۳", { waitUntil: "networkidle", timeout: 45000 });
await mob.waitForSelector("#law-art-asasi-3", { timeout: 15000 });
// حلقهٔ فلش تا ۲۶۰۰ms می‌ماند — زودتر بگیرش
let hasRing = false;
for (let i = 0; i < 12 && !hasRing; i++) {
  hasRing = await mob.evaluate(() => {
    const el = document.getElementById("law-art-asasi-3");
    return !!el && (el.className.includes("ring-2") || el.className.includes("ring-bronze"));
  });
  if (!hasRing) await mob.waitForTimeout(200);
}
await mob.waitForTimeout(2200); // اسکرولِ «تا رندر تلاش کن» + فونت
ok("مادهٔ مقصد (اصل ۳) رندر شد", (await mob.locator("#law-art-asasi-3").count()) === 1);
const inView = await mob.evaluate(() => {
  const el = document.getElementById("law-art-asasi-3");
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.top >= -40 && r.top < innerHeight * 0.85 && r.bottom > 60;
});
ok("مادهٔ مقصد پس از بازشدن صفحه در دید است (اسکرول خودکار)", inView);
ok("حلقهٔ برجسته‌سازی روی مادهٔ مقصد نشست", hasRing);

console.log("── ۲) جستجوی سراسری → پرش به همان ماده ──");
await mob.goto(BASE + "/#/", { waitUntil: "networkidle" });
await mob.waitForTimeout(1200);
await mob.keyboard.press("/");
await mob.waitForSelector('[role="dialog"] input', { timeout: 4000 }).catch(async () => {
  await mob.locator('button[title*="جستجو"]').first().click().catch(() => {});
  await mob.waitForSelector('[role="dialog"] input', { timeout: 6000 });
});
await mob.waitForTimeout(400);
const dlg = mob.locator('[role="dialog"]').last();
await dlg.locator("input").click();
await dlg.locator("input").pressSequentially("اهداف مذکور", { delay: 45 });
await mob.waitForTimeout(900);
const hitBtns = dlg.locator('ul[aria-label="نتیجه‌ها"] button');
const nHits = await hitBtns.count();
ok(`جستجوی «اهداف مذکور» نتیجه داد (${nHits} دکمه)`, nHits > 0);
let jumped = false;
if (nHits > 0) {
  // نتیجه‌ای که قطعهٔ متنِ اصل ۳ را دارد همان مادهٔ ۳ است
  const idx = await hitBtns.evaluateAll((btns) => {
    const i = btns.findIndex((b) => (b.textContent || "").includes("اهداف"));
    return i >= 0 ? i : 0;
  });
  await hitBtns.nth(idx).click();
  await mob.waitForTimeout(2200);
  const h = await mob.evaluate(() => decodeURIComponent(location.hash));
  jumped = /law\/asasi\/[۳3]/.test(h);
  ok(`کلیک نتیجهٔ قانون → هش ${h.trim().slice(0, 40)}… شامل مادهٔ ۳`, jumped, h);
  const back = await mob.evaluate(() => {
    const el = document.getElementById("law-art-asasi-3");
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.top >= -40 && r.top < innerHeight * 0.9;
  });
  ok("پس از پرش از جستجو هم مادهٔ ۳ در دید است", back);
}

console.log("── ۳) نوار ابزار قانون تعقیب‌کنندهٔ نوار اصلی (موبایل) ──");
await mob.goto(BASE + "/#/law/madani", { waitUntil: "networkidle" });
await mob.waitForSelector('input[aria-label="جستجو در این قانون"]', { timeout: 15000 });
await mob.waitForTimeout(1200);
// goto با هشِ تازه reload نمی‌کند — صفحه ممکن است در اسکرولِ قبلی بماند؛ اول برگرد بالای صفحه
await mob.evaluate(() => window.scrollTo(0, 0));
await mob.waitForTimeout(900);
const barTop = () => mob.evaluate(() => {
  const inp = document.querySelector('input[aria-label="جستجو در این قانون"]');
  const bar = inp && inp.closest(".sticky");
  return bar ? Math.round(bar.getBoundingClientRect().top) : -1;
});
const t0 = await barTop();
ok(`قبل از اسکرول: نوار ابزار زیر نوار اصلی است (top=${t0}px > 55)`, t0 > 55, `top=${t0}`);
await mob.evaluate(() => window.scrollTo(0, 900));
await mob.waitForTimeout(800);
const t1 = await barTop();
ok(`بعد از اسکرول پایین (نوار اصلی پنهان): نوار ابزار بالا رفت (top=${t1}px < 44)`, t1 >= 0 && t1 < 44, `top=${t1}`);
await mob.evaluate(() => window.scrollTo(0, 0));
await mob.waitForTimeout(800);
const t2 = await barTop();
ok(`با برگشت به بالای صفحه: نوار ابزار سر جایش برگشت (top=${t2}px > 55)`, t2 > 55, `top=${t2}`);
await mob.close();

/* ══ بخش ب — دسکتاپ: ویرایش ایندکسی نشان ══ */
console.log("── ۴) ویرایش ایندکسی نشان (اسنپ/عبور/اسکرول لبه) ──");
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
await page.context().addInitScript(() => { try { Reflect.deleteProperty(window, "Highlight"); } catch {} });
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

// پنج واژهٔ پیوستهٔ ≥۴ حرفی در یک نود متنی، با چهارتاییِ یکتا
const picked = await page.evaluate(() => {
  const secs = [...document.querySelectorAll("article [data-sec-id]")];
  for (const sec of secs) {
    const ps = [...sec.querySelectorAll("p")].filter((p) => (p.textContent || "").trim().length > 80);
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
      for (let k = 0; k + 4 < idxs.length; k++) {
        const ws = idxs.slice(k, k + 5);
        if (ws.some((x) => x.w.length < 4)) continue;
        const quad = ws.slice(0, 4).map((x) => x.w).join(" ");
        const quad2 = ws.slice(1, 5).map((x) => x.w).join(" ");
        if (secText.split(quad).length - 1 === 1 && secText.split(quad2).length - 1 === 1) {
          const tr = target.getBoundingClientRect();
          window.scrollBy({ top: tr.top - innerHeight / 2 + tr.height / 2, behavior: "instant" });
          const rng = document.createRange();
          rng.setStart(tn, ws[1].start);
          rng.setEnd(tn, ws[2].start + ws[2].len);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(rng);
          document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
          return { words: ws.map((x) => x.w), nodeText: tn.nodeValue, starts: ws.map((x) => x.start), lens: ws.map((x) => x.len) };
        }
      }
    }
  }
  return null;
});
ok(`پنج واژهٔ پیوستهٔ یکتا پیدا شد («${picked ? picked.words.join(" ") : ""}»)`, !!picked);
if (!picked) process.exit(1);
const [w0, w1, w2, w3, w4] = picked.words;

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
ok(`نشان میان‌واژه‌ها ساخته شد («${norm(marked?.text)}» === «${w1} ${w2}»)`, !!marked && norm(marked.text) === norm(`${w1} ${w2}`));
const recId = marked?.mid;

// لمس نشان → دستگیره‌ها
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
const knobs = await page.evaluate(() => ({
  start: !!document.querySelector('[aria-label="ابتدای نشان"]'),
  end: !!document.querySelector('[aria-label="انتهای نشان"]'),
}));
ok("دو دستگیره ظاهر شدند", knobs.start && knobs.end, JSON.stringify(knobs));

// کشیدن دستگیره — افقی در ارتفاعِ ثابتِ گرفتن (caret روی خط متن می‌پرد)
async function dragKnob(which, targetX, targetY) {
  const label = which === "start" ? "ابتدای نشان" : "انتهای نشان";
  const box = await page.locator(`[aria-label="${label}"]`).boundingBox();
  if (!box) throw new Error("دستگیره پیدا نشد: " + which);
  const gx = box.x + box.width / 2, gy = box.y + box.height / 2;
  await page.mouse.move(gx, gy);
  await page.mouse.down();
  await page.waitForTimeout(140);
  const steps = 14;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(gx + ((targetX - gx) * i) / steps, gy);
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
  await page.waitForTimeout(550);
}
// نقطهٔ هدف روی واژهٔ iاُم — سه حالت: لبهٔ راست (اولین نویسه در RTL)، لبهٔ چپ، میان
async function aimWord(which, mode) {
  // which=0 → واژهٔ پیش از نشان (w0)؛ which=3 → واژهٔ بعد از بازهٔ نشان (w3)
  // متنِ پاراگراف میزبان مرجع است — ساخت نشان نودهای متنی را می‌شکند، پس روی
  // متنِ کامل پاراگراف (textContent) جای واژه را می‌یابیم و به (نود، افست) نگاشت می‌کنیم.
  return page.evaluate(({ picked, which, mode }) => {
    const w0 = picked.words[0], w3 = picked.words[3];
    const segs = [...document.querySelectorAll("article mark[data-lexa-mark]")];
    if (!segs.length) return null;
    const host = segs[0].closest("p") || segs[0].parentNode;
    const markText = segs.map((s) => s.textContent).join("");
    const nodes = [];
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    let tn, acc = 0;
    while ((tn = walker.nextNode())) { nodes.push([tn, acc]); acc += tn.nodeValue.length; }
    const full = nodes.map(([n]) => n.nodeValue).join("");
    const idx = full.indexOf(markText);
    if (idx < 0) return null;
    let span = null;
    if (which === 0) {
      const before = full.slice(0, idx).replace(/\s+$/, "");
      if (before.length < w0.length) return null;
      span = [before.length - w0.length, before.length];
    } else {
      let s = idx + markText.length;
      while (s < full.length && /\s/.test(full[s])) s++;
      const m = full.slice(s).match(/^\S+/);
      if (!m) return null;
      span = [s, s + m[0].length];
    }
    const [gs, ge] = span;
    for (const [node, base] of nodes) {
      const len = node.nodeValue.length;
      if (gs >= base && gs < base + len) {
        const r = document.createRange();
        r.setStart(node, gs - base);
        r.setEnd(node, Math.min(ge - base, len));
        const rect = r.getBoundingClientRect();
        if (!rect.width) return null;
        const x = mode === 0 ? rect.right - 1 : mode === 1 ? rect.left + 1 : rect.left + rect.width / 2;
        return { x, y: rect.top + rect.height / 2 };
      }
    }
    return null;
  }, { picked, which, mode });
}
const stripPunct = (s) => s.replace(/^[،,؛;:.!?«»\s]+|[،,؛;:.!?«»\s]+$/g, "");
const recText = () => page.evaluate((id) => {
  const store = JSON.parse(localStorage.getItem("lexa-store-v1") || "{}");
  const list = store?.state?.marks?.["m-l1-1"] ?? [];
  const rec = list.find((m) => m.id === id);
  const mk = document.querySelector(`article mark[data-lexa-mark][data-mid='${id}']`);
  return rec ? { text: rec.text, dom: mk ? mk.textContent : null } : null;
}, recId);

// ── اسنپ: سرِ نشان به میانِ واژهٔ قبل (w0) → باید «ابتدای w0» اسنپ شود ──
let snapped = false, snapLog = [];
for (let mode = 0; mode < 3 && !snapped; mode++) {
  const pt = await aimWord(0, mode);
  if (!pt) { snapLog.push("pt=null"); continue; }
  await dragKnob("start", pt.x, pt.y);
  const cur = await recText();
  if (cur && norm(cur.text) === norm(`${w0} ${w1} ${w2}`)) snapped = true;
  else snapLog.push(norm(cur?.text));
}
ok(`اسنپِ سر به ابتدای واژهٔ پیشین («${w0} ${w1} ${w2}» — بدون نویسهٔ وسط واژه)`, snapped, snapLog.join(" | "));

// ── عبور: سر از روی ته رد شود (به داخل w3) → تعویض نقش تمیز: «w2 w3» ──
let crossed = false, crossLog = [];
for (let mode = 0; mode < 3 && !crossed; mode++) {
  const pt = await aimWord(3, mode);
  if (!pt) { crossLog.push("pt=null"); continue; }
  await dragKnob("start", pt.x, pt.y);
  const cur = await recText();
  if (cur && norm(cur.text) === norm(`${w2} ${stripPunct(w3)}`)) crossed = true;
  else crossLog.push(norm(cur?.text));
}
ok(`عبور تمیز سر از ته («${w2} ${stripPunct(w3)}» — بازه هرگز خالی/خراب نشد)`, crossed, crossLog.join(" | "));

// ── upsert: همان id؛ DOM === استور ──
const final = await recText();
ok("همان id حفظ شد و DOM === استور", !!final && norm(final.text) === norm(final.dom), JSON.stringify(final));

// ── اسکرول خودکار لبهٔ پایین ──
const beforeScroll = await page.evaluate(() => ({ y: window.scrollY, vh: innerHeight }));
const eb = await page.locator('[aria-label="انتهای نشان"]').boundingBox();
if (eb) {
  const hy = eb.y + eb.height / 2;
  await page.mouse.move(eb.x + eb.width / 2, hy);
  await page.mouse.down();
  await page.waitForTimeout(140);
  // وارد درگ شو (بیش از ناحیهٔ مرده) بعد به‌تدریج تا لبهٔ پایین ببر و نگه دار
  await page.mouse.move(eb.x + eb.width / 2 + 30, hy + 10, { steps: 3 });
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(eb.x + eb.width / 2 + 30, hy + ((beforeScroll.vh - 4 - hy) * i) / steps);
    await page.waitForTimeout(30);
  }
  await page.mouse.move(eb.x + eb.width / 2 + 30, beforeScroll.vh - 4, { steps: 3 });
  await page.waitForTimeout(1100); // tick اسکرول خودکار
  const maxY = await page.evaluate(() => window.scrollY);
  await page.mouse.up();
  await page.waitForTimeout(500);
  ok(`اسکرول خودکار لبهٔ پایین کار کرد (${beforeScroll.y} → ${maxY}px)`, maxY - beforeScroll.y >= 30, `dy=${maxY - beforeScroll.y}`);
} else {
  ok("اسکرول خودکار لبهٔ پایین", false, "دستگیره پیدا نشد");
}

ok("صفر خطای کنسول/صفحه (هر دو صفحه)", errors.length === 0, errors.slice(0, 2).join(" | "));

console.log(`\nqa110-law-nav-marks: ${pass} گذرانده، ${fail} شکسته`);
await browser.close();
process.exit(fail ? 1 : 0);
