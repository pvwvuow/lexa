// QA — cloud sync card + splash without scales
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 100)));
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/home/z/my-project/.zscreenshots/qa-home-sync.png' });
  await page.goto('http://localhost:3000/#/settings', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(2200);
  const body = await page.textContent('body');
  await page.screenshot({ path: '/home/z/my-project/.zscreenshots/qa-settings-sync.png' });
  console.log('has حساب ابری:', body.includes('حساب ابری'), '| has ثبت‌نام:', body.includes('ثبت‌نام'), '| errors:', errors.length);
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
