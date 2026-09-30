const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER_ERROR:', error.message));

  console.log('Navigating to http://127.0.0.1:5173...');
  try {
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle2' });
  } catch (err) {
    console.error('Goto error:', err.message);
  }
  
  await browser.close();
})();
