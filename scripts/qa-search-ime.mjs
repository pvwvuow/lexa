// ─── بازتولید باگ جستجو — رویدادهای composition واقعی‌نما داخل صفحه ──────────
// کیبورد اندرویدی هنگام تایپ فارسی: compositionstart → چند input(isComposing)
// → compositionend. اگر رویداد آخر جا بیفتد، state یک حرف عقب می‌ماند.
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3210";
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(BASE, { waitUntil: "networkidle" });

async function openSearch() {
  await page.keyboard.press("/");
  await page.waitForSelector('[role="dialog"][aria-label="جستجوی سراسری"]');
  return page.locator('[role="dialog"][aria-label="جستجوی سراسری"]').last();
}
const dlg = await openSearch();
const input = dlg.locator("input");
await input.click();
await page.waitForTimeout(300);

async function report(label) {
  const val = await input.inputValue();
  const n = await dlg.locator('ul[aria-label="نتیجه‌ها"] button').count();
  console.log(`${label}: input="${val}" results=${n}`);
  return { val, n };
}

/** شبیه‌سازی IME داخل صفحه — با setter بومی که ردیاب React را دور می‌زند.
 *  مثل QAهای قبلی روی «آخرین دیالوگ» اسکوپ می‌کنیم (سه نمونه GlobalSearch باز می‌شوند). */
async function imeType(chars, { endEvent = true, wholeWordData = false } = {}) {
  await page.evaluate(({ chs, endEvent, wholeWordData }) => {
    const ds = document.querySelectorAll('[role="dialog"][aria-label="جستجوی سراسری"]');
    const input = ds[ds.length - 1].querySelector("input");
    input.focus();
    const proto = HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    input.dispatchEvent(new CompositionEvent("compositionstart", { data: "", bubbles: true }));
    let acc = "";
    for (const ch of chs) {
      acc += ch;
      const payload = wholeWordData ? acc : ch;
      setter.call(input, acc);
      input.dispatchEvent(new InputEvent("input", {
        data: payload, inputType: "insertCompositionText", isComposing: true, bubbles: true,
      }));
    }
    if (endEvent) input.dispatchEvent(new CompositionEvent("compositionend", { data: acc, bubbles: true }));
  }, { chs: chars, endEvent, wholeWordData });
}

console.log("── A) composition حرف‌به‌حرف + compositionend ──");
await input.fill("");
await imeType("مدنی");
await page.waitForTimeout(250);
await report("  مدنی (کامل)");

console.log("── B) همان سناریو اما compositionend نمی‌آید (کلمه زیرخط‌دار می‌ماند) ──");
await input.fill("");
await page.waitForTimeout(100);
await page.evaluate(() => {
  const input = document.querySelector('[role="dialog"][aria-label="جستجوی سراسری"] input');
  input.focus();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  input.dispatchEvent(new CompositionEvent("compositionstart", { data: "", bubbles: true }));
  let acc = "";
  for (const ch of ["م", "مد", "مدن", "مدنی"]) {
    acc = ch; // GBoard بعضی‌ها متن کل را در data می‌فرستد
    setter.call(input, ch.length === 1 ? acc : ch);
    input.dispatchEvent(new InputEvent("input", {
      data: ch, inputType: "insertCompositionText", isComposing: true, bubbles: true,
    }));
  }
  // بدون compositionend — مثل کیبوردی که کلمه را باز می‌گذارد
});
await page.waitForTimeout(250);
await report("  مدنی (بدون end)");

console.log("── C) فقط رویداد input بدون data/composition (مثل بعضی وب‌ویوها) ──");
await input.fill("");
await page.waitForTimeout(100);
await page.evaluate(() => {
  const input = document.querySelector('[role="dialog"][aria-label="جستجوی سراسری"] input');
  input.focus();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  let acc = "";
  for (const ch of ["م", "مد", "مدن", "مدنی"]) {
    acc = ch;
    setter.call(input, acc);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
});
await page.waitForTimeout(250);
await report("  مدنی (input ساده)");

console.log("── D) تایپ دسکتاپی واقعی برای کنترل ──");
await input.fill("");
await page.waitForTimeout(100);
await input.pressSequentially("مدنی", { delay: 40 });
await page.waitForTimeout(250);
await report("  pressSequentially مدنی");

console.log("pageerrors:", errors.length ? errors : "none");
await browser.close();
