// کدام URLها 404 می‌دهند؟ (تشخیص خطاهای کنسول qa-drawer)
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://127.0.0.1:3210";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
page.on("response", (r) => { if (r.status() === 404) console.log("404:", r.url().slice(0, 120)); });
page.on("console", (m) => { if (m.type() === "error") console.log("console-error:", m.text().slice(0, 120)); });
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(4000);
await browser.close();
process.exit(0);
