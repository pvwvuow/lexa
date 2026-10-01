// Task 55 — QA screenshots for Vokalat exam section
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGE: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  // 1) Vokalat hub
  await page.goto('http://localhost:3000/#/quiz/vokalat', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(2800);
  await page.screenshot({ path: '/home/z/my-project/.zscreenshots/vokalat-hub.png' });
  const hubText = await page.textContent('body');
  console.log('hub: has title:', hubText.includes('آزمون وکالت'), '| packs 1388:', hubText.includes('۱۳۸۸'), '| 1399:', hubText.includes('۱۳۹۹'), '| sample:', hubText.includes('نمونهٔ تمرینی'));

  // 2) open first pack (1388 madani) setup screen
  await page.goto('http://localhost:3000/#/quiz/pack-vokalat-1388-madani', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: '/home/z/my-project/.zscreenshots/vokalat-pack-setup.png' });
  const setupText = await page.textContent('body');
  console.log('setup: 20 questions:', setupText.includes('۲۰') || setupText.includes('20'), '| timer:', setupText.includes('دقیقه'));

  // 3) run into questions: click start button if present
  const startBtn = await page.$('button:has-text("شروع")');
  if (startBtn) {
    await startBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: '/home/z/my-project/.zscreenshots/vokalat-pack-run.png' });
    const runText = await page.textContent('body');
    console.log('run: question rendered:', runText.includes('گزینه') || runText.includes('رهن') || runText.includes('عقد'));
  } else {
    console.log('start button not found');
  }

  console.log('errors:', errors.length ? errors.slice(0, 4) : 'none');
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
