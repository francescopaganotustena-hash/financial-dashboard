const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect console errors and network failures
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });

  page.on('requestfailed', request => {
    consoleMessages.push({ type: 'requestfailed', text: `${request.url()} - ${request.failure()?.errorText}` });
  });

  page.on('response', response => {
    if (response.status() >= 400) {
      consoleMessages.push({ type: 'response_error', text: `${response.url()} - ${response.status()} ${response.statusText()}` });
    }
  });

  await page.goto('http://localhost:3001', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  console.log('========== CONSOLE MESSAGES ==========');
  for (const msg of consoleMessages) {
    console.log(`[${msg.type}] ${msg.text}`);
  }

  await browser.close();
})();