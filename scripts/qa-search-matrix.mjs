// ─── ماتریس بازتولید: fill × composition × رویداد ساده + ردیابی remount ──────
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3210";
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", String(e)));

await page.goto(BASE, { waitUntil: "networkidle" });
await page.keyboard.press("/");
await page.waitForSelector('[role="dialog"][aria-label="جستجوی سراسری"]');
const dlg = page.locator('[role="dialog"][aria-label="جستجوی سراسری"]').last();
const input = dlg.locator("input");
await input.click();
await page.waitForTimeout(300);

// نشان‌گذاری المان + ردیاب value
await page.evaluate(() => {
  const ds = document.querySelectorAll('[role="dialog"][aria-label="جستجوی سراسری"]');
  const input = ds[ds.length - 1].querySelector("input");
  input.__id = Math.random().toString(36).slice(2);
  window.__inputId = input.__id;
});

async function state(label) {
  const s = await page.evaluate(() => {
    const ds = document.querySelectorAll('[role="dialog"][aria-label="جستجوی سراسری"]');
    const input = ds[ds.length - 1].querySelector("input");
    return { v: input.value, same: input.__id === window.__inputId };
  });
  const n = await dlg.locator('ul[aria-label="نتیجه‌ها"] button').count();
  console.log(`${label}: value="${s.v}" sameElement=${s.same} results=${n}`);
}

/** تایپ داخل صفحه */
async function typeInPage({ fill = false, composition = true, endEvent = true } = {}) {
  if (fill) { await input.fill(""); await page.waitForTimeout(120); }
  await page.evaluate(({ composition, endEvent }) => {
    const ds = document.querySelectorAll('[role="dialog"][aria-label="جستجوی سراسری"]');
    const input = ds[ds.length - 1].querySelector("input");
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    if (composition) input.dispatchEvent(new CompositionEvent("compositionstart", { data: "", bubbles: true }));
    let acc = "";
    for (const ch of ["م", "د", "ن", "ی"]) {
      acc += ch;
      setter.call(input, acc);
      if (composition) {
        input.dispatchEvent(new InputEvent("input", { data: ch, inputType: "insertCompositionText", isComposing: true, bubbles: true }));
      } else {
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
    if (composition && endEvent) input.dispatchEvent(new CompositionEvent("compositionend", { data: acc, bubbles: true }));
  }, { composition, endEvent });
  await page.waitForTimeout(300);
  await state("");
}

console.log("── ۱) fill + composition با end ──");
await typeInPage({ fill: true, composition: true, endEvent: true });
console.log("── ۲) fill + composition بدون end ──");
await typeInPage({ fill: true, composition: true, endEvent: false });
console.log("── ۳) fill + رویداد ساده (بدون composition) ──");
await typeInPage({ fill: true, composition: false });
console.log("── ۴) بدون fill + رویداد ساده ──");
await typeInPage({ fill: false, composition: false });
console.log("── ۵) بدون fill + composition بدون end ──");
await typeInPage({ fill: false, composition: true, endEvent: false });

await browser.close();
