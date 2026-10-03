import { chromium } from "playwright";
import fs from "node:fs";
const PUB_UPD = "/home/z/my-project/.next/standalone/public/updates";
const STAGE = "/tmp/qa-updates";
fs.rmSync(PUB_UPD, { recursive: true, force: true });
fs.cpSync(`${STAGE}/v110`, PUB_UPD, { recursive: true });
console.log("staged:", fs.readdirSync(PUB_UPD), fs.readdirSync(PUB_UPD + "/packs"));

const browser = await chromium.launch();
const ctx = await browser.newContext();
await ctx.route(/jsdelivr|raw\.githubusercontent/, (r) => r.abort());
await ctx.addInitScript(() => { try { localStorage.setItem("lexa-auto-packs", "off"); } catch {} });
const page = await ctx.newPage();
await page.goto("http://127.0.0.1:3210/#/", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(1500);
const probe = await page.evaluate(async () => {
  const out = {};
  const r1 = await fetch("/updates/manifest.json");
  out.mStatus = r1.status;
  out.mHead = (await r1.text()).slice(0, 60);
  const r2 = await fetch("/updates/packs/course-tadris-madani7-ghayebi-02.json");
  out.pStatus = r2.status;
  out.pHead = (await r2.text()).slice(0, 60);
  return out;
}).catch((e) => "EVAL_ERR: " + String(e).slice(0, 150));
console.log(JSON.stringify(probe, null, 1));
await browser.close();
