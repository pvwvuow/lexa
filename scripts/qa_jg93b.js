const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  // go to courses section
  await page.goto('http://localhost:3000/#/courses', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const listText = await page.evaluate(() => document.body.innerText);
  console.log('courses page has jaza:', listText.includes('تدریس جزا'));
  await page.screenshot({ path: '.zscreenshots/jg93-courses-list.png' });

  // open tadris-jaza-1
  await page.goto('http://localhost:3000/#/course/tadris-jaza-1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  const t = await page.evaluate(() => document.body.innerText);
  console.log('400 label:', t.includes('۱–۴۰۰') || t.includes('تا ۴۰۰') || t.includes('400'));
  console.log('ch26 تکرار جرم:', t.includes('تکرار جرم'));
  console.log('ch27 جنون:', t.includes('شرایط مسئولیت و جنون'));
  console.log('ch33 ادلهٔ اثبات (۲):', t.includes('سوگند و علم قاضی'));
  console.log('ch35 حدود:', t.includes('لواط، تفخیذ، مساحقه، قوادی، شرب و محاربه'));
  console.log('ch38 خطای محض:', t.includes('خطای محض و راهکار تشخیص'));
  await page.screenshot({ path: '.zscreenshots/jg93-course-301-400.png' });

  console.log('console errors:', errors.length ? errors.slice(0, 5) : 'ZERO');
  await browser.close();
})();
