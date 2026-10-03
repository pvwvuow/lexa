import { chromium } from "playwright";
import fs from "node:fs";
import { spawn } from "node:child_process";
const STAGE = "/tmp/qa-updates";
const PUB_UPD = "/home/z/my-project/.next/standalone/public/updates";
const STANDALONE = "/home/z/my-project/.next/standalone";
const stage = (v) => { fs.rmSync(PUB_UPD, { recursive: true, force: true }); fs.cpSync(`${STAGE}/${v}`, PUB_UPD, { recursive: true }); };
let server;
async function startServer(port) {
  server = spawn("node", ["server.js"], { cwd: STANDALONE, env: { ...process.env, NODE_ENV: "production", PORT: String(port), HOSTNAME: "127.0.0.1" }, stdio: "ignore" });
  for (let i = 0; i < 40; i++) { try { const r = await fetch(`http://127.0.0.1:${port}/`); if (r.ok || r.status === 307) return; } catch {} await new Promise((r) => setTimeout(r, 500)); }
}
stage("v110");
await startServer(3213);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.route(/jsdelivr|raw\.githubusercontent/, (r) => r.abort());
await ctx.addInitScript(() => { try { localStorage.setItem("lexa-auto-packs", "off"); } catch {} });
const page = await ctx.newPage();
await page.goto("http://127.0.0.1:3213/#/course/course-tadris-madani7-ghayebi", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
const seedRes = await page.evaluate(async () => {
  const meta = await (await fetch("/updates/manifest.json")).json();
  const gh = meta.packs.find((p) => p.id === "content-pack-tadris-madani7-ghayebi-01");
  const file = await (await fetch("/updates/" + gh.file)).json();
  const rec = { meta: gh, contentId: file.payload.id, payload: file.payload, installedAt: new Date().toISOString() };
  await new Promise((res, rej) => {
    const rq = indexedDB.open("lexa-content-db", 1);
    rq.onupgradeneeded = () => { if (!rq.result.objectStoreNames.contains("lexa-content-packs")) rq.result.createObjectStore("lexa-content-packs", { keyPath: "meta.id" }); };
    rq.onsuccess = () => { const db = rq.result; const tx = db.transaction("lexa-content-packs", "readwrite"); tx.objectStore("lexa-content-packs").put(rec); tx.oncomplete = () => { db.close(); res(); }; tx.onerror = () => rej(tx.error); };
    rq.onerror = () => rej(rq.error);
  });
  return { seeded: gh.version, manifestV: meta.version };
}).catch((e) => "ERR " + String(e).slice(0, 120));
console.log("seed:", JSON.stringify(seedRes));

// سوییچ + ری‌استارت سرور
stage("v111");
server.kill("SIGKILL");
await startServer(3213);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("h1:has-text('تدریس مدنی ۷')", { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(6000);
const state = await page.evaluate(async () => {
  const fresh = await (await fetch("/updates/manifest.json")).json();
  const cached = localStorage.getItem("lexa-updates-manifest");
  const cachedV = cached ? JSON.parse(cached).version : null;
  const inst = await new Promise((res) => {
    const rq = indexedDB.open("lexa-content-db", 1);
    rq.onsuccess = () => { const db = rq.result; const tx = db.transaction("lexa-content-packs", "readonly"); const g = tx.objectStore("lexa-content-packs").getAll(); g.onsuccess = () => { db.close(); res(g.result.map((r) => r.meta.id + "@" + r.meta.version)); }; };
  });
  const badge = !!document.body.innerText.includes("به‌روزرسانی جدید این کتاب آمده است");
  return { freshV: fresh.version, cachedV, installed: inst, badge };
}).catch((e) => "ERR " + String(e).slice(0, 160));
console.log("state:", JSON.stringify(state, null, 1));
const h1 = await page.locator("h1").first().textContent().catch(() => "");
console.log("h1:", h1);
await browser.close();
process.exit(0);
