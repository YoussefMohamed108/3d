const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { extname, join, normalize } = require('node:path');
const { webkit } = require('playwright');

const root = join(__dirname, '..');
const types = { '.css': 'text/css', '.html': 'text/html', '.jpeg': 'image/jpeg', '.js': 'text/javascript', '.png': 'image/png' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = normalize(join(root, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')));
    if (!file.startsWith(root)) throw new Error('Invalid path');
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    response.end(await readFile(file));
  } catch (_) {
    response.writeHead(404);
    response.end();
  }
});

server.listen(0, '127.0.0.1', async () => {
  const browser = await webkit.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
    await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', route => route.abort());
    await page.route('https://dqdsgckzwiknmldhwjnw.supabase.co/rest/v1/products?**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        id: 'legacy-test', name: 'Legacy Safari Figure', price: 450,
        sale_price: null, hidden: false, class: 'Collector', image_url: '/1.jpeg'
      }])
    }));
    const address = server.address();
    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#shop-grid .legacy-product-card', { timeout: 7000 });
    const result = await page.evaluate(() => ({
      loaderVisibility: getComputedStyle(document.getElementById('loader')).visibility,
      cards: document.querySelectorAll('#shop-grid .legacy-product-card').length,
      name: document.querySelector('#shop-grid .product-name').textContent,
      orderLink: document.querySelector('#shop-grid .legacy-order-link').getAttribute('href')
    }));
    if (result.loaderVisibility !== 'hidden' || result.cards !== 1 || result.name !== 'Legacy Safari Figure' || !/^https:\/\/wa\.me\//.test(result.orderLink)) {
      throw new Error(`Legacy catalog regression: ${JSON.stringify(result)}`);
    }
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
    server.close();
  }
});

