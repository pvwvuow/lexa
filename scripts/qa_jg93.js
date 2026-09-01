const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  // 1) home
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '.zscreenshots/jg93-home-301-400.png' });

  // 2) course page — find tadris-jaza-1 link
  const courseHref = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    const el = links.find((a) => (a.getAttribute('href') || '').includes('tadris-jaza'));
    return el ? el.getAttribute('href') : null;
  });
  console.log('course href:', courseHref);
  await page.goto('http://localhost:3000' + (courseHref || '/#courses/tadris-jaza-1'), { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('has 400 label:', bodyText.includes('۱–۴۰۰') || bodyText.includes('تا ۴۰۰'));
  console.log('has ch26:', bodyText.includes('تکرار جرم'));
  console.log('has ch38:', bodyText.includes('خطای محض'));
  await page.screenshot({ path: '.zscreenshots/jg93-course-301-400.png' });

  // 3) lesson jg-93 direct
  await page.goto('http://localhost:3000/#/learn/jg-93', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const t1 = await page.evaluate(() => document.body.innerText);
  console.log('jg-93 loaded:', t1.includes('تکرار جرم در جرایم حدی') || t1.includes('مادهٔ ۱۳۶'));
  await page.screenshot({ path: '.zscreenshots/jg93-lesson-takrar.png' });

  // 4) lesson jg-121 (final)
  await page.goto('http://localhost:3000/#/learn/jg-121', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const t2 = await page.evaluate(() => document.body.innerText);
  console.log('jg-121 loaded:', t2.includes('راهکار تشخیص') || t2.includes('خطای محض'));
  await page.screenshot({ path: '.zscreenshots/jg121-lesson-rahyar.png' });

  console.log('console errors:', errors.length ? errors.slice(0, 5) : 'ZERO');
  await browser.close();
})();
