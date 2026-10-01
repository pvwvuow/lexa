// دیباگ ۶ — هر سه منبع دانلود بسته، داخل مرورگر (همان شرایط اپ)
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(4000);
  const res = await page.evaluate(async () => {
    const urls = [
      "https://cdn.jsdelivr.net/gh/pvwvuow/lexa@main/updates/packs/course-tadris-madani7-ghayebi-02.json",
      "https://raw.githubusercontent.com/pvwvuow/lexa/main/updates/packs/course-tadris-madani7-ghayebi-02.json",
      "/updates/packs/course-tadris-madani7-ghayebi-02.json",
    ];
    const out = [];
    for (const u of urls) {
      try {
        const r = await fetch(u, { cache: "no-store" });
        const j = await r.json();
        const lesson = j.payload.chapters[0].lessons[0];
        const laws = lesson.sections.flatMap((s) => s.law ?? []);
        out.push({ u: u.slice(0, 60), status: r.status, laws: laws.length, withText: laws.filter((l) => l.text).length });
      } catch (e) {
        out.push({ u: u.slice(0, 60), err: String(e).slice(0, 80) });
      }
    }
    return out;
  });
  console.log(JSON.stringify(res, null, 1));
  await browser.close();
})();
