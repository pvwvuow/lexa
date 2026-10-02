// پروب ۳: آیا گرهٔ input بعد از fill عوض می‌شود؟
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.keyboard.press("/");
await page.waitForSelector('[role="dialog"]');

const mark = () => page.evaluate(() => {
  const ds = [...document.querySelectorAll('[role="dialog"]')];
  const inp = ds[ds.length - 1].querySelector("input");
  inp.dataset.probe = "A";
  return ds.length;
});
const check = (tag) => page.evaluate((t) => {
  const ds = [...document.querySelectorAll('[role="dialog"]')];
  const inp = ds[ds.length - 1].querySelector("input");
  return { tag: t, dialogs: ds.length, marked: inp?.dataset.probe === "A", v: inp?.value };
}, tag);

console.log("initial:", JSON.stringify(await mark()));
const inp = page.locator('[role="dialog"]').last().locator("input");

await inp.fill("");
console.log("after-fill:", JSON.stringify(await check("fill")));
await inp.pressSequentially("مالیات", { delay: 50 });
console.log("after-type:", JSON.stringify(await check("type")));
console.log("all-dialogs-probes:", JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('[role="dialog"] input')].map((el) => el.dataset.probe || "-"))));
await browser.close();
