/* دیباگ بازرندر نشان پس از رفرش */
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 850 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
  page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE:", m.text().slice(0, 200)); });

  await page.goto("http://localhost:3000/#/learn/cp-l11", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // ساخت یک نشان
  const el = await page.locator("article .teach-body p").first().elementHandle();
  await page.evaluate((p) => {
    const node = p.childNodes.length ? p.childNodes[0] : p;
    const sel = window.getSelection();
    sel.removeAllRanges();
    const range = document.createRange();
    range.setStart(node, 4);
    range.setEnd(node, 40);
    sel.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  }, el);
  await page.waitForTimeout(700);
  await page.locator('[data-mark-toolbar="1"] button').first().click();
  await page.waitForTimeout(600);
  console.log("marks in DOM قبل از رفرش:", await page.locator("mark.lexa-mark").count());
  console.log("store:", await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem("lexa-store-v1") || "{}");
    const m = st.state?.marks ?? {};
    return JSON.stringify(Object.keys(m).map((k) => ({ lesson: k, count: m[k].length, sample: m[k][0]?.text?.slice(0, 30) })));
  }));

  await page.reload({ waitUntil: "domcontentloaded" });
  // انتظار تا پاراگراف بیاید + چند ثانیه اضافه
  await page.waitForSelector("article .teach-body p", { timeout: 30000 });
  for (const wait of [500, 2000, 4000]) {
    await page.waitForTimeout(wait);
    const cnt = await page.locator("mark.lexa-mark").count();
    const secs = await page.evaluate(() => document.querySelectorAll("[data-sec-id]").length);
    console.log(`بعد از +${wait}ms → mark: ${cnt}, sections: ${secs}`);
  }

  await browser.close();
})();
