// QA — login then verify cloud sync card
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 100)));
  await page.goto('http://localhost:3000/#/settings', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(1500);
  // open auth dialog
  const btn = page.locator('text=ورود / ثبت‌نام').first();
  if (await btn.count()) { await btn.click(); await page.waitForTimeout(1200); }
  // fill credentials (admin / lexa@1404)
  await page.locator('input[type="text"], input[type="username"], input:not([type="password"])').first().fill('admin').catch(()=>{});
  const pwInputs = page.locator('input[type="password"]');
  if (await pwInputs.count()) await pwInputs.first().fill('lexa@1404');
  await page.screenshot({ path: '/home/z/my-project/.zscreenshots/qa-login.png' });
  // submit
  const submit = page.locator('button:has-text("ورود")').last();
  if (await submit.count()) { await submit.click(); await page.waitForTimeout(2200); }
  await page.goto('http://localhost:3000/#/settings', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(2000);
  const body = await page.textContent('body');
  await page.screenshot({ path: '/home/z/my-project/.zscreenshots/qa-settings-loggedin.png' });
  console.log('has حساب ابری:', body.includes('حساب ابری'), '| has همگام‌سازی روی ابر:', body.includes('همگام‌سازی روی ابر'), '| errors:', errors.length);
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
