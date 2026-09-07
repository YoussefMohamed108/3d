const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { extname, join, normalize } = require('node:path');
const { chromium, webkit } = require('playwright');

const root = join(__dirname, '..');
const types = { '.html': 'text/html; charset=utf-8', '.jpeg': 'image/jpeg', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = normalize(join(root, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')));
    if (!file.startsWith(root)) throw new Error('Invalid path');
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    response.end(body);
  } catch (_) {
    response.writeHead(404);
    response.end('Not found');
  }
});

async function verify(browserType, name, url) {
  const browser = await browserType.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
    await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', route => route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: `window.supabase={createClient:function(){return {auth:{getSession:function(){return Promise.resolve({data:{session:{user:{email:'collector@example.com'}}},error:null});}}};}};`
    }));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body[data-verification-state="success"]', { timeout: 5000 });
    const state = await page.evaluate(() => ({
      title: document.getElementById('verify-title').textContent.trim(),
      homeHref: document.getElementById('verify-home').getAttribute('href'),
      logoLoaded: document.querySelector('.verify-logo img').complete,
      touchHeight: Math.round(document.getElementById('verify-home').getBoundingClientRect().height),
      background: getComputedStyle(document.body).backgroundColor
    }));
    if (state.title !== 'Account verified' || state.homeHref !== '/?verified=1' || !state.logoLoaded || state.touchHeight < 44 || state.background === 'rgba(0, 0, 0, 0)') {
      throw new Error(`${name} verification page failed: ${JSON.stringify(state)}`);
    }
    return { browser: name, ...state };
  } finally {
    await browser.close();
  }
}

server.listen(0, '127.0.0.1', async () => {
  try {
    const port = server.address().port;
    const url = `http://127.0.0.1:${port}/verified.html#access_token=test&type=signup`;
    const results = [];
    results.push(await verify(chromium, 'Chromium', url));
    results.push(await verify(webkit, 'WebKit', url));
    const redirectBrowser = await chromium.launch({ headless: true });
    try {
      const redirectPage = await redirectBrowser.newPage();
      await redirectPage.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', route => route.abort());
      await redirectPage.goto(`http://127.0.0.1:${port}/#access_token=test&type=signup`, { waitUntil: 'domcontentloaded' });
      if (new URL(redirectPage.url()).pathname !== '/verified.html') {
        throw new Error(`Confirmation callback was not forwarded: ${redirectPage.url()}`);
      }
    } finally {
      await redirectBrowser.close();
    }
    console.log(JSON.stringify(results, null, 2));
  } finally {
    server.close();
  }
});

