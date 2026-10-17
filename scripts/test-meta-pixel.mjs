import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./meta-pixel.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const verified = fs.readFileSync(new URL('../verified.html', import.meta.url), 'utf8');
const config = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const pixelId = '1404442528337355';

function run(url = 'https://printx-eg.com/', navigator = {}) {
  const inserted = [];
  const window = { location: new URL(url), navigator };
  const document = {
    createElement: tag => ({ tagName: tag }),
    getElementsByTagName: () => [{ parentNode: { insertBefore: node => inserted.push(node) } }]
  };
  const context = vm.createContext({ window, document });
  const execute = () => vm.runInContext(source, context);
  execute();
  return { window, inserted, execute };
}

test('production visits initialize the supplied pixel and queue one PageView', () => {
  const { window, inserted } = run('https://printx-eg.com/?utm_source=instagram&fbclid=test#shop');
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].src, 'https://connect.facebook.net/en_US/fbevents.js');
  assert.equal(inserted[0].async, true);
  const queue = Array.from(window.fbq.queue, args => Array.from(args));
  assert.deepEqual(queue, [
    ['set', 'autoConfig', false, pixelId],
    ['init', pixelId],
    ['track', 'PageView']
  ]);
  assert.equal(run('https://www.printx-eg.com/').inserted.length, 1);
});

test('running the loader twice does not duplicate scripts, initialization, or page views', () => {
  const { window, inserted, execute } = run();
  execute();
  assert.equal(inserted.length, 1);
  assert.equal(window.fbq.queue.length, 3);
});

test('verification pages and authentication callbacks never load Meta', () => {
  for (const suffix of [
    'verified.html',
    '#access_token=secret&refresh_token=secret&type=signup',
    '?code=secret',
    '?token_hash=secret&type=email',
    '#type=signup',
    '#type=recovery',
    '#error_code=otp_expired',
    '?%61ccess_token=secret',
    '?code%3Dsecret',
    '?malformed=%E0%A4%A'
  ]) {
    const result = run('https://printx-eg.com/' + suffix);
    assert.equal(result.inserted.length, 0, suffix);
    assert.equal(result.window.fbq, undefined, suffix);
  }
  assert.doesNotMatch(verified, /meta-pixel|fbevents\.js|facebook\.com\/tr/);
});

test('development and preview visits do not pollute production analytics', () => {
  for (const url of ['http://localhost:3000/', 'https://example.vercel.app/', 'http://printx-eg.com/']) {
    assert.equal(run(url).inserted.length, 0, url);
  }
});

test('browser privacy preferences prevent tracking', () => {
  for (const navigator of [{ globalPrivacyControl: true }, { doNotTrack: '1' }, { doNotTrack: 'yes' }]) {
    assert.equal(run('https://printx-eg.com/', navigator).inserted.length, 0);
  }
});

test('the public storefront loads the deferred script and supplies a valid no-JavaScript fallback', () => {
  assert.match(html.split('</head>')[0], /<script src="scripts\/meta-pixel\.js" defer><\/script>/);
  assert.equal((html.match(/src="scripts\/meta-pixel\.js"/g) || []).length, 1);
  const fallback = html.match(/<noscript>\s*<img[^>]+facebook\.com\/tr[^>]+>\s*<\/noscript>/)?.[0];
  assert.ok(fallback);
  assert.ok(html.indexOf(fallback) > html.indexOf('<body'));
  assert.ok(fallback.includes(`id=${pixelId}&amp;ev=PageView&amp;noscript=1`));
});

test('CSP allows Meta requests without relaxing unrelated security directives', () => {
  const value = config.headers.find(rule => rule.source === '/(.*)').headers
    .find(header => header.key === 'Content-Security-Policy').value;
  const directives = Object.fromEntries(value.split(';').filter(part => part.trim())
    .map(part => { const [name, ...sources] = part.trim().split(/\s+/); return [name, sources]; }));
  assert.ok(directives['script-src'].includes('https://connect.facebook.net'));
  assert.ok(directives['img-src'].includes('https://www.facebook.com'));
  assert.ok(directives['connect-src'].includes('https://www.facebook.com'));
  assert.ok(directives['connect-src'].includes('https://connect.facebook.net'));
  assert.deepEqual(directives['object-src'], ["'none'"]);
  assert.deepEqual(directives['frame-ancestors'], ["'none'"]);
  assert.deepEqual(directives['frame-src'], ["'none'"]);
  assert.ok(!value.includes('https://*.facebook.com'));
});
