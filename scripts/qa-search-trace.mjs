// ─── چه چیزی مقدار ورودی جستجو را پاک می‌کند؟ ────────────────────────────────
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3210";
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", String(e)));
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE-ERR:", m.text()); });

await page.goto(BASE, { waitUntil: "networkidle" });

await page.keyboard.press("/");
await page.waitForSelector('[role="dialog"][aria-label="جستجوی سراسری"]');
const dlg = page.locator('[role="dialog"][aria-label="جستجوی سراسری"]').last();
const input = dlg.locator("input");
await input.click();
await page.waitForTimeout(300);

// ناظر مقدار — هر تغییر value را با زمان ثبت کن
await page.evaluate(() => {
  const ds = document.querySelectorAll('[role="dialog"][aria-label="جستجوی سراسری"]');
  const input = ds[ds.length - 1].querySelector("input");
  window.__valLog = [];
  let last = input.value;
  const log = (who) => {
    if (input.value !== last) {
      window.__valLog.push({ t: Date.now(), who, from: last, to: input.value, composing: input.composing ?? null });
      last = input.value;
    }
  };
  // هر فریم چک کن
  const tick = () => { log("frame"); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  // پچ value setter برای ردیابی دقیق
  const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  Object.defineProperty(input, "value", {
    get() { return desc.get.call(input); },
    set(v) {
      window.__valLog.push({ t: Date.now(), who: "setter", from: desc.get.call(input), to: v, stack: new Error().stack?.split("\n").slice(1, 5).join(" | ") });
      desc.set.call(input, v);
    },
    configurable: true,
  });
});

await page.evaluate(() => {
  const ds = document.querySelectorAll('[role="dialog"][aria-label="جستجوی سراسری"]');
  const input = ds[ds.length - 1].querySelector("input");
  input.focus();
  const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  // چون value پچ شده، از desc بومی استفاده نمی‌کنیم — مستقیم مقدار بده
  let acc = "";
  for (const ch of ["م", "مد", "مدن", "مدنی"]) {
    acc = ch;
    input.value = acc; // از ستتر پچ‌شده می‌گذرد و ثبت می‌شود
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
});
await page.waitForTimeout(400);

const logs = await page.evaluate(() => {
  const ds = document.querySelectorAll('[role="dialog"][aria-label="جستجوی سراسری"]');
  const input = ds[ds.length - 1].querySelector("input");
  return { log: window.__valLog, final: input.value };
});
console.log("final value:", JSON.stringify(logs.final));
console.log("value changes:");
for (const l of logs.log) {
  console.log(`  [${l.who}] "${l.from}" → "${l.to}"${l.stack ? "\n      " + l.stack : ""}`);
}

await browser.close();
