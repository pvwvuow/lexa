// ─── QA رفع باگ‌های گزارشی کاربر (پس از 0.10.0) ─────────────────────────────
// ۱) پاپ‌آپ نشان‌گذاری همیشه بالای جملهٔ انتخاب‌شده (گپ امن اندروید)
// ۲) نشان جدید لنگر متنی (pfx/sfx) ذخیره می‌کند
// ۳) با آپدیت محتوا: تغییر بی‌ربطِ قبل از جمله → نشان نمی‌پرد (لنگر)؛
//    حذف/تغییر خود جمله → نشان رها می‌شود
// ۴) ویرایش بازهٔ نشان: لمس نشان → انتخاب بومی + دستگیره‌ها؛ بدون دکمهٔ ابتدا/انتها
// ۵) آیکون ابر کنار اواتار حذف شد + منوی حساب ابری با لمس باز می‌شود (پورتال)
// ۶) دکمهٔ معلق «از استاد بپرس» در موبایل حذف شد (کارت سایدبار دسکتاپ سر جایش)
// ۷) کارت «دفترچه‌های آمادهٔ آزمون / از کتابخانهٔ خودم آزمون بسازم» حذف شد
// ۸) صفر خطای کنسول
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://127.0.0.1:3210";
let pass = 0, fail = 0;
function ok(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name} ${extra}`); }
}

const browser = await chromium.launch();
const errors = [];

/* ═══ دسکتاپ — درس، مارک، پاپ‌آپ، لنگر، بازه ═══ */
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
page.on("pageerror", (e) => errors.push("pageerror: " + String(e)));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text()); });

await page.goto(BASE + "/#/learn/m-l1-1", { waitUntil: "networkidle" });
await page.waitForSelector("article [data-sec-id]", { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(2500);

ok("درس رندر شد", (await page.locator("article [data-sec-id]").count()) > 0);

// باز کردن چند بخش با «ادامه بده» — پاراگراف دوم یک بخش لازم است
for (let i = 0; i < 3; i++) {
  const btn = page.locator("button:has-text('ادامه بده')");
  if ((await btn.count()) === 0) break;
  await btn.first().click();
  await page.waitForTimeout(400);
}
// انتظار برای پایدار شدن اسکرول نرمِ «ادامه بده» — رِیس با انتخاب ممنوع
let lastY = -1;
for (let i = 0; i < 30; i++) {
  const y = await page.evaluate(() => window.scrollY);
  if (y === lastY) break;
  lastY = y;
  await page.waitForTimeout(300);
}
ok("چند بخش از درس باز شد", (await page.locator("article [data-sec-id]").count()) >= 3);

// ── انتخاب یک کلمهٔ یکتا از پاراگراف دومِ یک بخش + باز کردن نوار نشان ──
const picked = await page.evaluate(() => {
  const secs = [...document.querySelectorAll("article [data-sec-id]")];
  for (const sec of secs) {
    const ps = [...sec.querySelectorAll("p")].filter((p) => (p.textContent || "").trim().length > 60);
    if (ps.length < 2) continue;
    const target = ps[1]; // پاراگراف دوم — باید غیر از پاراگراف اول باشد
    const secText = (sec.textContent || "").replace(/\s+/g, " ");
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
    let tn;
    while ((tn = walker.nextNode())) {
      const words = (tn.nodeValue || "").split(/(\s+)/).filter((w) => w.trim().length >= 5);
      for (const w of words) {
        const clean = w.trim();
        const cnt = secText.split(clean).length - 1;
        if (cnt === 1) {
          // مرکز‌کردن اولیه — کروم بعد از addRange خودش اسکرول بومی می‌کند و برمی‌گردد بالا
          const tr = target.getBoundingClientRect();
          window.scrollBy({ top: tr.top - innerHeight / 2 + tr.height / 2, behavior: "instant" });
          const idx = tn.nodeValue.indexOf(w);
          const rng = document.createRange();
          rng.setStart(tn, idx);
          rng.setEnd(tn, idx + w.length);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(rng);
          document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
          const r = rng.getBoundingClientRect();
          return { word: clean, secId: sec.getAttribute("data-sec-id"), pTag: target };
        }
      }
    }
  }
  return null;
});
ok(`کلمهٔ یکتا برای مارک پیدا شد («${picked?.word}»)`, !!picked);
if (!picked) process.exit(1);
await page.evaluate((el) => { el.__qaMarkP = true; }, picked.pTag); // نشان روی خودِ المان
// کروم با انتخاب، اسکرول بومیِ «آوردن انتخاب به دید» می‌کند — بعدش ما مرکز می‌کنیم،
// پیش از آنکه دیبانس ۲۶۰ms اپ موقعیت نوار را بلند کند
await page.waitForTimeout(120);
await page.evaluate(() => {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const r = sel.getRangeAt(0).getBoundingClientRect();
  window.scrollBy({ top: r.top - innerHeight / 2 - 60, behavior: "instant" });
});
await page.waitForSelector("[data-mark-toolbar]", { timeout: 6000 });
await page.waitForTimeout(400);
ok("نوار نشان‌گذاری با انتخاب متن باز شد", await page.locator("[data-mark-toolbar]").isVisible());

// ── نوار باید کاملاً بالای جملهٔ انتخاب‌شده باشد (سنجش هم‌زمان — بی‌ریس) ──
const posChk = await page.evaluate(() => {
  const sel = window.getSelection();
  const r = sel && sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null;
  const tb = document.querySelector("[data-mark-toolbar]")?.getBoundingClientRect() ?? null;
  return { selTop: r?.top ?? -9999, selBottom: r?.bottom ?? -9999, tbTop: tb?.top ?? -9999, tbBottom: tb?.bottom ?? -9999 };
});
ok(`نوار بالای جمله است (نوار.bottom=${posChk.tbBottom.toFixed(0)} ≤ جمله.top=${posChk.selTop.toFixed(0)})`, posChk.tbBottom <= posChk.selTop + 2);

// ── نشان‌گذاری زرد + لنگر متنی در استور ──
await page.locator("[data-mark-toolbar] button[title='رنگ نشان']").first().click();
await page.waitForTimeout(600);
const marked = await page.evaluate(() => {
  const mk = document.querySelector("article mark[data-lexa-mark]");
  if (!mk) return null;
  const store = JSON.parse(localStorage.getItem("lexa-store-v1") || "{}");
  const list = store?.state?.marks?.["m-l1-1"] ?? [];
  return { mid: mk.dataset.mid, text: mk.textContent, inP: !!mk.closest("p")?.__qaMarkP, rec: list.find((m) => m.id === mk.dataset.mid) };
});
ok("نشان در DOM رندر شد", !!marked);
ok(`متن نشان = کلمهٔ انتخابی («${marked?.text?.trim()}» === «${picked.word}»)`, marked?.text?.trim() === picked.word);
ok("لنگر متنی ذخیره شد (pfx/sfx)", !!marked?.rec?.pfx || !!marked?.rec?.sfx, JSON.stringify(marked?.rec ?? {}));
ok("occ نشان = ۰ (اولین وقوع)", marked?.rec?.occ === 0 || marked?.rec?.occ === undefined);
const recId = marked?.mid;

// کلیک استاندارد روی نشان — با اسکرول فوری به مرکز و retry
async function clickMark(id) {
  for (let att = 0; att < 3; att++) {
    await page.evaluate((mid) => {
      const mk = document.querySelector(`article mark[data-lexa-mark][data-mid='${mid}']`);
      if (!mk) return;
      const r = mk.getBoundingClientRect();
      window.scrollBy({ top: r.top - innerHeight / 2, behavior: "instant" });
    }, id);
    await page.waitForTimeout(350);
    // ریست احتمالی نوار باز — تا کلیک بعدی تمیز باشد
    await page.evaluate(() => document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
    await page.waitForTimeout(120);
    const clickInfo = await page.locator(`article mark[data-lexa-mark][data-mid='${id}']`).first().click({ timeout: 4000 }).then(() => "clicked").catch((e) => "clickErr: " + String(e).split("\n")[0]);
    if (clickInfo !== "clicked") console.log(`    [attempt ${att + 1}] ${clickInfo}`);
    try {
      await page.waitForSelector("[data-mark-toolbar]", { timeout: 2500 });
      await page.waitForTimeout(250);
      return;
    } catch {
      // عیب‌یابی — چه چیزی روی نقطهٔ کلیک است؟
      const dbg = await page.evaluate((mid) => {
        const mk = document.querySelector(`article mark[data-lexa-mark][data-mid='${mid}']`);
        if (!mk) return { mk: null };
        const r = mk.getBoundingClientRect();
        const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { mk: mk.textContent.slice(0, 30), rect: { t: Math.round(r.top), h: Math.round(r.height) }, atPoint: el ? el.tagName + "." + (el.className || "").toString().slice(0, 40) : null, tbOpen: !!document.querySelector("[data-mark-toolbar]") };
      }, id);
      console.log(`    [attempt ${att + 1}] dbg: ${JSON.stringify(dbg)}`);
    }
  }
  throw new Error("نوار ویرایش روی نشان باز نشد");
}

// ── کلیک روی نشان → نوار ویرایش بدون دکمه‌های ابتدا/انتها + انتخاب بومی ──
const t0 = marked.text.trim();
await clickMark(recId);
ok("نوار ویرایش باز شد", await page.locator("[data-mark-toolbar]").isVisible());
const fourGone = await page.evaluate(() => {
  const btns = [...document.querySelectorAll("[data-mark-toolbar] button")];
  return btns.filter((b) => /ابتدا|انتها/.test(b.textContent || "") || /ابتدا|انتها/.test(b.getAttribute("aria-label") || "")).length;
});
ok("دکمه‌های ابتدا/انتها حذف شدند", fourGone === 0, `count=${fourGone}`);
const nativeSel = await page.evaluate(() => {
  const sel = window.getSelection();
  return { active: !!sel && sel.rangeCount > 0 && !sel.isCollapsed, text: (sel?.toString() || "").replace(/\s+/g, " ").trim() };
});
ok(`لمس نشان، متنش را بومی انتخاب کرد («${nativeSel.text}»)`, nativeSel.active && nativeSel.text === t0);

// ── گسترش با «دستگیره» — کشیدن انتهای انتخاب تا کلمهٔ بعد (شبیه‌سازی درگ دستگیره) ──
const growInfo = await page.evaluate((id) => {
  const mk = document.querySelector(`article mark[data-lexa-mark][data-mid='${id}']`);
  if (!mk) return null;
  const walker = document.createTreeWalker(mk.parentNode, NodeFilter.SHOW_TEXT);
  let tn;
  let sawMark = false;
  let nextWord = null;
  while ((tn = walker.nextNode())) {
    if ((tn.parentElement || {}).closest?.("mark[data-lexa-mark]")) { sawMark = true; continue; }
    if (sawMark) {
      const m2 = (tn.nodeValue || "").match(/\S+/);
      if (m2) { nextWord = { node: tn, idx: tn.nodeValue.indexOf(m2[0]), word: m2[0] }; break; }
    }
  }
  if (!nextWord) return null;
  const sel = window.getSelection();
  const rng = sel.getRangeAt(0);
  rng.setEnd(nextWord.node, nextWord.idx + nextWord.word.length);
  document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
  return { word: nextWord.word };
}, recId);
ok(`انتخاب با «دستگیره» تا کلمهٔ بعد گسترش یافت (+ «${growInfo?.word}»)`, !!growInfo);
await page.waitForTimeout(500); // دیبانس selectionchange
ok("نوار ویرایش پس از گسترش هنوز باز است", await page.locator("[data-mark-toolbar]").isVisible());
await page.locator("[data-mark-toolbar] button[title='رنگ نشان']").first().click();
await page.waitForTimeout(600);
const grown = await page.evaluate((id) => {
  const mk = document.querySelector(`article mark[data-lexa-mark][data-mid='${id}']`);
  const store = JSON.parse(localStorage.getItem("lexa-store-v1") || "{}");
  const list = store?.state?.marks?.["m-l1-1"] ?? [];
  return { dom: mk ? mk.textContent.trim() : null, rec: (list.find((m) => m.id === id) ?? {}).text };
}, recId);
const grewEnd = grown.rec && grown.rec.startsWith(t0) && grown.rec.length > t0.length;
ok(`کشیدن دستگیره + رنگ، مارک را از انتها بزرگ کرد («${t0}» → «${grown.rec}»)`, !!grewEnd);
ok("DOM نشان هم متن بزرگ‌شده را دارد", grown.dom === grown.rec);

// ── کوچک‌سازی با دستگیره — کشیدن انتهای انتخاب به عقب (فقط کلمهٔ اصلی) ──
await clickMark(recId);
await page.evaluate(({ id, word }) => {
  const mk = document.querySelector(`article mark[data-lexa-mark][data-mid='${id}']`);
  if (!mk) return;
  const tn = mk.firstChild;
  const idx = ((tn?.nodeValue) || "").indexOf(word);
  const sel = window.getSelection();
  const rng = sel.getRangeAt(0);
  rng.setEnd(tn, idx + word.length);
  document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
}, { id: recId, word: t0 });
await page.waitForTimeout(500);
await page.locator("[data-mark-toolbar] button[title='رنگ نشان']").first().click();
await page.waitForTimeout(600);
const shrunk = await page.evaluate((id) => {
  const store = JSON.parse(localStorage.getItem("lexa-store-v1") || "{}");
  return (store?.state?.marks?.["m-l1-1"] ?? []).find((m) => m.id === id)?.text ?? "";
}, recId);
ok(`کشیدن دستگیره به عقب، بازه را کوچک کرد («${shrunk}»)`, shrunk === t0, `rec=${shrunk}`);

// ── حذف نشان از نوار ویرایش ──
await clickMark(recId);
await page.locator("[data-mark-toolbar] button[aria-label='حذف نشان']").click();
await page.waitForTimeout(500);
const afterDel = await page.evaluate((id) => (JSON.parse(localStorage.getItem("lexa-store-v1") || "{}")?.state?.marks?.["m-l1-1"] ?? []).length);
ok("حذف نشان از نوار ویرایش کار می‌کند", afterDel === 0, `marks=${afterDel}`);

// ── ساخت دوبارهٔ نشان روی کلمهٔ اصلی — برای تست لنگر متنی ──
async function selectWord(word) {
  await page.evaluate((w) => {
    const secs = [...document.querySelectorAll("article [data-sec-id]")];
    for (const sec of secs) {
      if (sec.getAttribute("data-sec-id") !== "s2") continue;
      const walker = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT);
      let tn;
      while ((tn = walker.nextNode())) {
        const idx = (tn.nodeValue || "").indexOf(w);
        if (idx >= 0) {
          const rng = document.createRange();
          rng.setStart(tn, idx);
          rng.setEnd(tn, idx + w.length);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(rng);
          document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
          return;
        }
      }
    }
  }, word);
  await page.waitForTimeout(120); // اسکرول بومی کروم
  await page.evaluate(() => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const r = sel.getRangeAt(0).getBoundingClientRect();
    window.scrollBy({ top: r.top - innerHeight / 2 - 60, behavior: "instant" });
  });
  await page.waitForSelector("[data-mark-toolbar]", { timeout: 6000 });
  await page.waitForTimeout(300);
}
await selectWord(picked.word);
await page.locator("[data-mark-toolbar] button[title='رنگ نشان']").first().click();
await page.waitForTimeout(600);
const remark = await page.evaluate((w) => {
  const store = JSON.parse(localStorage.getItem("lexa-store-v1") || "{}");
  const list = store?.state?.marks?.["m-l1-1"] ?? [];
  const mk = document.querySelector("article mark[data-lexa-mark]");
  return { count: list.length, rec: list[0], mid: mk?.dataset?.mid };
}, picked.word);
ok("نشان دوباره روی کلمه ساخته شد", remark.count === 1 && remark.rec?.text === picked.word, JSON.stringify(remark.rec ?? {}));
ok("لنگر نشان دوباره‌ساخته‌شده هست", !!remark.rec?.pfx || !!remark.rec?.sfx);
const recId2 = remark.mid;

/* ═══ لنگر متنی — تغییر بی‌ربطِ قبل از جمله نشان را جابه‌جا نمی‌کند ═══ */
// کلمه را در پاراگراف اولِ همان بخش تزریق می‌کنیم (شبیه‌سازی آپدیت محتوا قبل از مارک)
const injected = await page.evaluate(({ word }) => {
  const sec = document.querySelector(`article [data-sec-id='s2']`);
  const firstP = sec?.querySelector("p");
  if (!firstP) return false;
  const walker = document.createTreeWalker(firstP, NodeFilter.SHOW_TEXT);
  const tn = walker.nextNode();
  if (!tn) return false;
  tn.nodeValue = word + " " + (tn.nodeValue || "");
  return true;
}, { word: picked.word });
ok("تزریق کلمهٔ یکتا در پاراگراف اول (شبیه‌سازی آپدیت)", injected);

// رندر مجدد با زوم — applyMarks دوباره اجرا می‌شود
await page.locator("button[aria-label='بزرگ‌کردن اندازهٔ متن']").click();
await page.waitForTimeout(400);
await page.locator("button[aria-label='بازنشانی اندازهٔ متن']").click();
await page.waitForTimeout(600);
const stillChk = await page.evaluate(() => {
  const mk = document.querySelector("article mark[data-lexa-mark]");
  const p = mk?.closest("p") ?? null;
  const rec = (JSON.parse(localStorage.getItem("lexa-store-v1") || "{}")?.state?.marks?.["m-l1-1"] ?? [])[0] ?? null;
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  // اثر انگشت پاراگراف اصلی: با «متن نشان + sfx ذخیره‌شده» آغاز می‌شود
  const sig = norm(rec ? rec.text + " " + (rec.sfx || "") : "");
  const parentStart = norm(p?.textContent).slice(0, sig.length);
  return {
    hasMark: !!mk,
    isOriginalP: !!p && sig.length > 10 && parentStart === sig,
    parentStart: parentStart.slice(0, 45),
    recText: rec?.text ?? null,
  };
});
console.log("    [anchor-dbg]", JSON.stringify(stillChk));
ok("پس از آپدیتِ بی‌ربط، نشان روی همان جملهٔ اصلی ماند (نپرید)", stillChk.isOriginalP);

/* ═══ خود جملهٔ نشان‌شده حذف شود → نشان رها می‌شود ═══ */
await page.evaluate(({ word }) => {
  const sec = document.querySelector(`article [data-sec-id='s2']`);
  const walker = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT);
  let tn;
  while ((tn = walker.nextNode())) {
    if ((tn.nodeValue || "").includes(word)) { tn.nodeValue = tn.nodeValue.replaceAll(word, "\u200C"); }
  }
}, { word: picked.word });
await page.locator("button[aria-label='بزرگ‌کردن اندازهٔ متن']").click();
await page.waitForTimeout(400);
await page.locator("button[aria-label='بازنشانی اندازهٔ متن']").click();
await page.waitForTimeout(600);
const dropped = await page.evaluate(() => document.querySelectorAll("article mark[data-lexa-mark]").length);
ok("با حذف خودِ جمله، نشان بدون خطا رها شد", dropped === 0, `marks=${dropped}`);

/* ═══ نوار بالا: بدون آیکون ابر + منوی اواتار با لمس باز می‌شود ═══ */
const cloudInHeader = await page.evaluate(() => {
  const header = document.querySelector("header.sticky.top-0");
  return header ? header.querySelectorAll(".lucide-cloud-check").length : -1;
});
ok("هدر بالایی بدون آیکون ابر کنار اواتار", cloudInHeader === 0, `count=${cloudInHeader}`);

// شبیه‌سازی حساب ابری — مسیر CloudAccountArea (همان مسیر APK)
await page.route("**/auth/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ access_token: "qa", refresh_token: "qa", user: { id: "qa-uid", email: "qa@lexa.app" } }) }));
await page.route("**/rest/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
await page.evaluate(() => {
  localStorage.setItem("lexa-sb-auth-v1", JSON.stringify({ access_token: "qa", refresh_token: "qa", user: { id: "qa-uid", email: "qa@lexa.app" } }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const avatarBtn = page.locator("button[aria-label^='حساب ابری']");
// سینک ابری خودکار با سشن ماک ممکن است وسط کار reload کند — تا پایدار شدن صبر می‌کنیم
let avCount = 0;
const tAv = Date.now();
for (let i = 0; i < 45; i++) {
  avCount = await avatarBtn.count();
  if (avCount >= 1) {
    await page.waitForTimeout(900);
    avCount = await avatarBtn.count();
    if (avCount >= 1) break;
  }
  await page.waitForTimeout(500);
}
console.log(`    [avatar-dbg] ظهور پس از ${((Date.now() - tAv) / 1000).toFixed(1)}s — count=${avCount}`);
ok("دکمهٔ اواتار حساب ابری رندر شد", avCount >= 1);
await avatarBtn.first().click();
await page.waitForTimeout(600);
const menuState = await page.evaluate(() => {
  const menu = document.querySelector("[role='menu']");
  if (!menu) return { open: false };
  const headerBar = document.querySelector("header.sticky.top-0 > div > div");
  const r = menu.getBoundingClientRect();
  const items = [...menu.querySelectorAll("[role='menuitem']")].map((b) => b.textContent?.trim());
  return {
    open: true,
    outsideHeader: headerBar ? !headerBar.contains(menu) : true,
    visibleHeight: r.height > 100,
    items,
  };
});
ok("با لمس اواتار، منوی حساب باز شد", menuState.open);
ok("منو بیرون از هدر رندر می‌شود (پورتال — دیگر کلیپ نمی‌شود)", menuState.outsideHeader === true);
ok("منو با محتوای کامل و قابل‌دیدن است", menuState.visibleHeight === true, JSON.stringify(menuState.items?.length));
ok("منوی حساب ابری ساده شد: خروج + تنظیمات، بدون دکمهٔ دستی همگام‌سازی (سینک خودکار است)", JSON.stringify(menuState.items || []).includes("خروج") && JSON.stringify(menuState.items || []).includes("تنظیمات و پروفایل") && !JSON.stringify(menuState.items || []).includes("همگام‌سازی روی ابر") && !JSON.stringify(menuState.items || []).includes("بازیابی از ابر"));
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
ok("بستن منو با Escape", (await page.evaluate(() => !!document.querySelector("[role='menu']"))) === false);

/* ═══ آزمون: کارت اضافی «از کتابخانهٔ خودم آزمون بسازم» حذف شد ═══ */
await page.goto(BASE + "/#/quiz", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
ok("تب «بسته‌های آزمون» هست", await page.locator("text=بسته‌های آزمون").first().isVisible());
ok("تب «آزمون از کتابخانه» هست", await page.locator("text=آزمون از کتابخانه").first().isVisible());
ok("کارت تکراری «از کتابخانهٔ خودم آزمون بسازم» حذف شد", (await page.locator("text=از کتابخانهٔ خودم آزمون بسازم").count()) === 0);
ok("کارت تکراری «دفترچه‌های آمادهٔ آزمون» حذف شد", (await page.locator("text=دفترچه‌های آمادهٔ آزمون").count()) === 0);
ok("بنر اختصاصی آزمون وکالت سر جایش است", (await page.locator("text=آزمون وکالت — سؤال‌به‌سؤال با کلید رسمی").count()) === 1);
const packCards = await page.locator("button:has-text('شروع آزمون')").count();
ok(`دفترچه‌ها هنوز فهرست می‌شوند (${packCards} کارت)`, packCards > 0);
// تب کتابخانه هم سالم
await page.locator("button:has-text('آزمون از کتابخانه')").click();
await page.waitForTimeout(500);
ok("تب «آزمون از کتابخانه» باز می‌شود", await page.locator("text=از کجا سؤال بدهم؟").isVisible().catch(() => false));

/* ═══ موبایل — دکمهٔ معلق «از استاد بپرس» حذف شده ═══ */
const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
mob.on("pageerror", (e) => errors.push("mob pageerror: " + String(e)));
mob.on("console", (m) => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text()); });
await mob.goto(BASE + "/#/learn/m-l1-1", { waitUntil: "networkidle" });
await mob.waitForTimeout(2500);
ok("موبایل: دکمهٔ معلق «از استاد بپرس» حذف شد", (await mob.locator("button[aria-label='از استاد بپرس']").count()) === 0);
ok("موبایل: فرم شناور پرسش نمایش داده نمی‌شود (فقط کارت سایدبار دسکتاپ)", !(await mob.locator("input[aria-label='سؤال آزاد از استاد']").first().isVisible()));
ok("موبایل: هدر بدون آیکون ابر", (await mob.evaluate(() => document.querySelectorAll("header.sticky.top-0 .lucide-cloud-check").length)) === 0);
// منوی اواتار در موبایل (مسیر APK واقعی همین است)
await mob.evaluate(() => {
  localStorage.setItem("lexa-sb-auth-v1", JSON.stringify({ access_token: "qa", refresh_token: "qa", user: { id: "qa-uid", email: "qa@lexa.app" } }));
});
await mob.route("**/auth/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ access_token: "qa", refresh_token: "qa", user: { id: "qa-uid", email: "qa@lexa.app" } }) }));
await mob.route("**/rest/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
await mob.reload({ waitUntil: "networkidle" });
await mob.waitForTimeout(1500);
await mob.locator("button[aria-label^='حساب ابری']").click();
await mob.waitForTimeout(600);
ok("موبایل: لمس اواتار منو را باز کرد", (await mob.locator("[role='menu']").count()) === 1);
await mob.screenshot({ path: "qa/103-mob-avatar-menu.png" });

/* ═══ دسکتاپ: کارت سایدبار «از استاد بپرس» سر جایش است ═══ */
await page.goto(BASE + "/#/learn/m-l1-1", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
ok("دسکتاپ: کارت «از استاد بپرس» در سایدبار سر جایش است", (await page.locator("text=از استاد بپرس").count()) === 1);

/* ═══ اسکرین‌شات‌های ثبت ═══ */
await page.screenshot({ path: "qa/103-desktop-lesson.png" });

ok("صفر خطای کنسول/صفحه در هر دو نما", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
console.log(`\n═══ نتیجه: ${pass} سبز / ${fail} سرخ ═══`);
process.exit(fail ? 1 : 0);
