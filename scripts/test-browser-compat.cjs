const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { extname, join, normalize } = require('node:path');
const { chromium, firefox, webkit } = require('playwright');

const root = join(__dirname, '..');
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png'
};

const server = createServer(async (request, response) => {
  try {
    const requested = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relative = requested === '/' ? 'index.html' : requested.replace(/^\/+/, '');
    const file = normalize(join(root, relative));
    if (!file.startsWith(root)) throw new Error('Invalid path');
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});

async function testBrowser(name, browserType, url) {
  const launchOptions = { headless: true, timeout: 30000 };
  if (name === 'Firefox') {
    launchOptions.firefoxUserPrefs = {
      'gfx.webrender.all': false,
      'gfx.webrender.software': false
    };
  }
  const browser = await browserType.launch(launchOptions);
  const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('requestfailed', request => {
    errors.push(`request: ${request.url()} (${request.failure() && request.failure().errorText})`);
  });
  await page.addInitScript(() => {
    try { sessionStorage.setItem('printx-firstorder-promo-v1', 'seen'); } catch (_) {}
  });
  const started = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  try {
    await page.waitForSelector('#shop-grid .product-card', { timeout: 20000 });
    await page.waitForFunction(() => {
      const image = document.querySelector('#shop-grid img');
      return Boolean(image && image.complete && image.naturalWidth > 0);
    }, null, { timeout: 20000 });
  } catch (error) {
    errors.push(`content: ${error.message.split('\n')[0]}`);
  }
  // Let autoplay advance once. This catches carousel scope/runtime errors that
  // are invisible during the first static frame.
  await page.waitForTimeout(4500);
  const result = await page.evaluate(() => ({
    cards: document.querySelectorAll('#shop-grid .product-card').length,
    heroActive: document.querySelectorAll('.hero-slide.active').length,
    heroImageLoaded: (() => {
      const image = document.querySelector('.hero-slide.active');
      return Boolean(image && image.complete && image.naturalWidth > 0);
    })(),
    loaderHidden: document.getElementById('loader').classList.contains('hidden'),
    menuPresent: Boolean(document.getElementById('mobileMenu')),
    firstImageLoaded: (() => {
      const image = document.querySelector('#shop-grid img');
      return Boolean(image && image.complete && image.naturalWidth > 0);
    })()
  }));
  await browser.close();
  if (errors.length || !result.cards || result.heroActive !== 1 || !result.heroImageLoaded || !result.loaderHidden || !result.menuPresent || !result.firstImageLoaded) {
    throw new Error(`${name} failed: ${JSON.stringify({ errors, ...result })}`);
  }
  return { browser: name, durationMs: Date.now() - started, ...result };
}

server.listen(0, '127.0.0.1', async () => {
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}/`;
  try {
    const results = [];
    const requested = new Set((process.env.BROWSERS || 'Chromium,Firefox,WebKit').split(','));
    for (const [name, browserType] of [['Chromium', chromium], ['WebKit', webkit], ['Firefox', firefox]]) {
      if (!requested.has(name)) continue;
      results.push(await testBrowser(name, browserType, url));
    }
    console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});

