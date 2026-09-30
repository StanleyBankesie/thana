import puppeteer from 'puppeteer';
import fs from 'fs';

/**
 * Test function to run puppeteer and generate a PDF.
 * @returns {Promise<void>}
 */
async function test() {
  let browser;
  try {
    console.log("Launching Puppeteer...");
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    console.log("Creating page...");
    await page.setContent('<html><body><h1>Test PDF</h1></body></html>', { waitUntil: "networkidle0" });
    console.log("Generating PDF...");
    const pdf = await page.pdf({ format: 'A4' });
    fs.writeFileSync('test.pdf', pdf);
    console.log("PDF saved to test.pdf");
  } catch (err) {
    console.error("Puppeteer Error:", err);
  } finally {
    if (browser) await browser.close();
  }
}

test();
