// دیباگ ۵ — دامپ payload نصب‌شده از IndexedDB در همان کانتکست QA
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(6000);
  await page.click('[aria-label="تنظیمات و پروفایل"]', { timeout: 20000 });
  await page.waitForTimeout(2000);
  await page.locator("button", { hasText: "روزرسانی" }).first().click({ timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.locator("button", { hasText: "بررسی به‌روزرسانی" }).first().click({ timeout: 15000 });
  await page.waitForTimeout(6000);
  const h3 = page.locator("h3", { hasText: "تدریس مدنی ۷" }).first();
  await h3.waitFor({ state: "visible", timeout: 30000 });
  const row = h3.locator("xpath=ancestor::div[.//button][1]");
  const ib = row.locator("button", { hasText: "نصب" }).first();
  await ib.click({ timeout: 10000 });
  await page.waitForTimeout(7000);

  const dump = await page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    const out = { dbs: dbs.map((d) => d.name) };
    for (const { name } of dbs) {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open(name);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const stores = [...db.objectStoreNames];
      for (const st of stores) {
        if (!/pack/i.test(st)) continue;
        const rows = await new Promise((res) => {
          const tx = db.transaction(st, "readonly");
          const rq = tx.objectStore(st).getAll();
          rq.onsuccess = () => res(rq.result);
          rq.onerror = () => res([]);
        });
        out[st] = rows.map((r) => {
          const payload = r.payload ?? r;
          const chapters = payload?.chapters;
          const lesson = chapters?.[0]?.lessons?.[0];
          const laws = lesson ? lesson.sections.flatMap((s) => s.law ?? []) : [];
          return {
            id: r.meta?.id ?? r.id ?? "?",
            version: r.meta?.version ?? "?",
            lessonId: lesson?.id,
            sections: lesson?.sections?.length,
            laws: laws.map((l) => ({ no: l.no, hasText: !!l.text, textLen: (l.text || "").length })),
          };
        });
      }
    }
    return out;
  });
  console.log(JSON.stringify(dump, null, 1).slice(0, 2200));
  await browser.close();
})();
