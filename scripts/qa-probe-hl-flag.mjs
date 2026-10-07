import { chromium } from "playwright";
const b = await chromium.launch();
const ctx = await b.newContext();
await ctx.addInitScript(() => { try { Reflect.deleteProperty(window, "Highlight"); } catch {} });
const p = await ctx.newPage();
await p.goto("about:blank");
const res = await p.evaluate(() => ({
  highlights: !!window.CSS?.highlights,
  highlightCtor: typeof Highlight === "function",
  typeofHL: typeof Highlight,
}));
console.log("deleted-Highlight:", JSON.stringify(res));
await b.close();
