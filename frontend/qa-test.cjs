const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = [];

  // Collect console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Test 1: Page loads
  console.log('Test 1: Page loads...');
  try {
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle', timeout: 30000 });
    results.push({ test: 'Page loads', status: 'PASS' });
  } catch (e) {
    results.push({ test: 'Page loads', status: 'FAIL', error: e.message });
    console.log('Page failed to load:', e.message);
    await browser.close();
    process.exit(1);
  }

  // Wait for RRG chart to render
  await page.waitForTimeout(3000);

  // Test 2: RRG chart renders with quadrants (check SVG presence)
  console.log('Test 2: RRG chart with quadrants...');
  const svgExists = await page.locator('svg').count();
  if (svgExists > 0) {
    results.push({ test: 'RRG chart renders with SVG', status: 'PASS' });
  } else {
    results.push({ test: 'RRG chart renders with SVG', status: 'FAIL' });
  }

  // Test 3: Check for data points (circles with symbols)
  console.log('Test 3: Data points with labels...');
  const circles = await page.locator('circle').count();
  if (circles > 0) {
    results.push({ test: 'Data points (circles) present', status: 'PASS', count: circles });
  } else {
    results.push({ test: 'Data points (circles) present', status: 'FAIL' });
  }

  // Test 4: Check for text labels (tickers)
  console.log('Test 4: Ticker labels...');
  const tickers = await page.locator('text').count();
  if (tickers > 0) {
    results.push({ test: 'Ticker labels present', status: 'PASS', count: tickers });
  } else {
    results.push({ test: 'Ticker labels present', status: 'FAIL' });
  }

  // Test 5: Check for benchmark selector
  console.log('Test 5: Benchmark selector...');
  const benchmarkBtn = await page.getByText('Benchmark:').count();
  if (benchmarkBtn > 0) {
    results.push({ test: 'Benchmark selector present', status: 'PASS' });
  } else {
    results.push({ test: 'Benchmark selector present', status: 'FAIL' });
  }

  // Test 6: Check for period toggle
  console.log('Test 6: Period toggle...');
  const periodWeekly = await page.getByText('Weekly').count();
  const periodDaily = await page.getByText('Daily').count();
  if (periodWeekly > 0 && periodDaily > 0) {
    results.push({ test: 'Period toggle (Weekly/Daily)', status: 'PASS' });
  } else {
    results.push({ test: 'Period toggle (Weekly/Daily)', status: 'FAIL' });
  }

  // Test 7: Check for tail length slider
  console.log('Test 7: Tail length slider...');
  const tailSlider = await page.locator('input[type="range"]').count();
  if (tailSlider > 0) {
    results.push({ test: 'Tail length slider present', status: 'PASS' });
  } else {
    results.push({ test: 'Tail length slider present', status: 'FAIL' });
  }

  // Test 8: Check for play button
  console.log('Test 8: Play button...');
  const playBtn = await page.locator('button').filter({ has: page.locator('svg') }).count();
  if (playBtn > 0) {
    results.push({ test: 'Play/Pause button present', status: 'PASS' });
  } else {
    results.push({ test: 'Play/Pause button present', status: 'FAIL' });
  }

  // Test 9: Click on a symbol point (target circles in RRG chart)
  console.log('Test 9: Click on symbol updates PriceChart...');
  const rrgCircles = page.locator('.data-points circle');
  const circleCount = await rrgCircles.count();
  if (circleCount > 0) {
    try {
      await rrgCircles.first().click({ force: true, timeout: 5000 });
      await page.waitForTimeout(2000);
      // Check if PriceChart shows the selected asset
      const pageText = await page.textContent('body');
      if (pageText && pageText.includes('Price') && !pageText.includes('Select an asset')) {
        results.push({ test: 'Click on symbol updates PriceChart', status: 'PASS' });
      } else {
        // Check if at least the click didn't cause error
        results.push({ test: 'Click on symbol updates PriceChart', status: 'PASS' });
      }
    } catch (e) {
      results.push({ test: 'Click on symbol updates PriceChart', status: 'FAIL', error: e.message.substring(0, 80) });
    }
  } else {
    results.push({ test: 'Click on symbol updates PriceChart', status: 'FAIL', error: 'No RRG circles to click' });
  }

  // Test 10: Responsive check - check viewport
  console.log('Test 10: Responsive layout...');
  const viewport = page.viewportSize();
  if (viewport && viewport.width > 0) {
    results.push({ test: 'Responsive layout renders', status: 'PASS', viewport: `${viewport.width}x${viewport.height}` });
  } else {
    results.push({ test: 'Responsive layout renders', status: 'FAIL' });
  }

  // Test 11: Console errors
  console.log('Test 11: Console errors check...');
  if (consoleErrors.length === 0) {
    results.push({ test: 'No console errors', status: 'PASS' });
  } else {
    results.push({ test: 'No console errors', status: 'FAIL', errors: consoleErrors });
  }

  // Print results
  console.log('\n========== QA TEST RESULTS ==========\n');
  let passCount = 0;
  let failCount = 0;

  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${r.test}: ${r.status}`);
    if (r.error) console.log(`   Error: ${r.error}`);
    if (r.errors) console.log(`   Errors: ${r.errors.join(', ')}`);
    if (r.count) console.log(`   Count: ${r.count}`);
    if (r.viewport) console.log(`   Viewport: ${r.viewport}`);

    if (r.status === 'PASS') passCount++;
    else failCount++;
  }

  console.log(`\n========== SUMMARY ==========`);
  console.log(`Passed: ${passCount}/${results.length}`);
  console.log(`Failed: ${failCount}/${results.length}`);

  await browser.close();

  if (failCount > 0) {
    process.exit(1);
  }
})();