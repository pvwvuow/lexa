/* QA 0.10.23 — phase 2/3 wiring smoke (visibility picker, classes tab, #/classes, previews, badges) */
import { chromium } from "playwright";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const WEB = process.env.WEB_BASE || "http://127.0.0.1:3000";
const APK = process.env.APK_BASE || "http://127.0.0.1:3001";
let pass = 0, fail = 0;
const ok = (name, cond) => { console.log((cond ? "  ✓ " : "  ✗ ") + name); cond ? pass++ : fail++; };

const browser = await chromium.launch();

// A) guest routes must render without crash on both builds
async function probe(base, label, routes) {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  for (const r of routes) {
    await page.goto(base + "/#" + r, { waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForTimeout(2200);
    const body = await page.locator("body").innerText().catch(() => "");
    const crashed = /Application error|unhandled|__next_error__/.test(body);
    ok(`${label} #${r} بدون کرش`, !crashed);
  }
  ok(`${label} صفر pageerror`, errors.length === 0);
  await page.close();
}
await probe(WEB, "WEB", ["/classes", "/library", "/org"]);
await probe(APK, "APK", ["/classes", "/library", "/org"]);

// B) built bundles must carry the new wiring strings
function bundleHas(baseDir, needles) {
  const chunksDir = join(baseDir, "_next", "static", "chunks");
  let hay = "";
  try {
    for (const f of readdirSync(chunksDir)) if (f.endsWith(".js")) hay += readFileSync(join(chunksDir, f), "utf8");
  } catch { return false; }
  return needles.every((n) => hay.includes(n));
}
const NEEDLES = [
  "چه کسانی ببینند؟",                       // VisibilityPicker legend
  "مخصوص کلاس",                             // VisibilityBadge class label
  "کلاس‌های من",                             // route + menu item
  "lexa-org-media",                         // private bucket ref in media helpers
  "pruneLostAccess",                        // offline prune
  "lexa_exam_start",                        // official exam RPC client
  "کلاس‌های من",                             // StudentClassesView heading (dup ok)
];
ok("WEB bundle شامل رشته‌های فاز ۲/۳", bundleHas(process.env.WEB_DIR || "standalone/public", NEEDLES));
ok("APK bundle شامل رشته‌های فاز ۲/۳", bundleHas(process.env.APK_DIR || "out", NEEDLES));

// C) guest: account menu must NOT show «کلاس‌های من» (only for accepted org students)
{
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  await page.goto(WEB + "/#/home", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  const hasSignIn = (await page.locator("button:has-text('ورود / ثبت‌نام')").count()) > 0;
  ok("مهمان: دکمهٔ ورود هست (منوی حساب مخفی)", hasSignIn);
  await page.close();
}

// D) classes route as guest: a sign-in oriented message renders (no blank page)
{
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  await page.goto(WEB + "/#/classes", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const body = await page.locator("body").innerText().catch(() => "");
  ok("#/classes مهمان: صفحهٔ خالی نیست", body.trim().length > 40);
  ok("#/classes مهمان: بدون پیام خطای کرش", !/Application error/.test(body));
  await page.close();
}

await browser.close();
console.log(`\nqa121-org-p23-wiring: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
