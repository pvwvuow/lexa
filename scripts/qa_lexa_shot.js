// Task 54 — QA screenshot for Lexa rebrand
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/home/z/my-project/.zscreenshots/lexa-rebrand-mob.png' });
  const body = await page.textContent('body');
  const hasLexa = (body.match(/Lexa/g) || []).length;
  const hasOld = body.includes('همیار');
  console.log('Lexa occurrences:', hasLexa, '| old brand present:', hasOld);
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
