// پروب سریع: چرا صفحهٔ درس رندر نمی‌شود؟
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://127.0.0.1:3210";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 300)));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text().slice(0, 300)); });
await page.goto(BASE + "/#/learn/m-l1-1", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(4000);
const counts = await page.evaluate(() => ({
  article: document.querySelectorAll("article").length,
  secIds: document.querySelectorAll("article [data-sec-id]").length,
  bodyLen: (document.body.innerText || "").length,
  title: document.title,
  headText: (document.querySelector("h1,h2")?.textContent || "").slice(0, 80),
  anyButtons: document.querySelectorAll("button").length,
}));
console.log("COUNTS:", JSON.stringify(counts));
console.log("ERRORS:", errors.length ? errors.slice(0, 5) : "none");
await page.screenshot({ path: "qa/probe-lesson.png" });
await browser.close();
