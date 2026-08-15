const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  const apiResponses = [];
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('check-word') || url.includes('word-xhs')) {
      try {
        const ct = response.headers()['content-type'] || '';
        if (ct.includes('application/json')) {
          const json = await response.json();
          apiResponses.push({ url, data: json });
        }
      } catch {}
    }
  });

  await page.goto('https://uutool.cn/word-xhs/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Submit the form
  await page.fill('#searchInput', '测试最好的第一全国全网免费');
  await page.click('#searchForm button[type="submit"]');
  await page.waitForTimeout(5000);

  console.log('API Responses found:', apiResponses.length);
  for (const r of apiResponses) {
    console.log('\nURL:', r.url);
    console.log('Data:', JSON.stringify(r.data, null, 2).slice(0, 2000));
  }

  // Also check page content for detected words
  const pageContent = await page.evaluate(() => document.body.innerText);
  console.log('\n--- PAGE CONTENT ---');
  console.log(pageContent.slice(0, 3000));

  await browser.close();
})();
