const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { extname, join, normalize } = require('node:path');
const { webkit } = require('playwright');

const root = join(__dirname, '..');
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
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
  } catch (_) {
    response.writeHead(404);
    response.end('Not found');
  }
});

server.listen(0, '127.0.0.1', async () => {
  const browser = await webkit.launch({ headless: true });
  try {
    const address = server.address();
    const page = await browser.newPage({
      javaScriptEnabled: false,
      viewport: { width: 375, height: 667 }
    });
    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'load' });
    await page.waitForTimeout(3500);

    const state = await page.evaluate(() => {
      const loader = document.getElementById('loader');
      const reveal = document.querySelector('#shop .reveal');
      const hero = document.querySelector('.hero-slide.active');
      return {
        loaderVisibility: getComputedStyle(loader).visibility,
        loaderPointerEvents: getComputedStyle(loader).pointerEvents,
        revealOpacity: getComputedStyle(reveal).opacity,
        heroLoaded: Boolean(hero && hero.complete && hero.naturalWidth > 0)
      };
    });

    if (state.loaderVisibility !== 'hidden' || state.loaderPointerEvents !== 'none' || Number(state.revealOpacity) < 0.9 || !state.heroLoaded) {
      throw new Error(`Old Safari fail-open regression: ${JSON.stringify(state)}`);
    }
    console.log(JSON.stringify(state, null, 2));
  } finally {
    await browser.close();
    server.close();
  }
});

