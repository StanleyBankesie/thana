import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('pageerror', err => {
    console.error('PAGE ERROR:', err.toString());
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('CONSOLE ERROR:', msg.text());
    }
  });

  console.log('Navigating to http://localhost:5174/transport/income ...');
  // Wait until network is somewhat idle
  await page.goto('http://localhost:5174/transport/income', { waitUntil: 'networkidle2' }).catch(e => console.error(e));
  
  // Wait a little extra in case React renders throw asynchronously
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
  console.log('Done testing.');
})();
