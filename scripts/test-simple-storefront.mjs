import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const baseline = JSON.parse(fs.readFileSync(new URL('../docs/simple-storefront-baseline.json', import.meta.url), 'utf8'));
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const markup = html.replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi, '');

test('approved simple design is enabled without using the demo application', () => {
  assert.match(html, /<body[^>]*class="printx-simple"/);
  assert.match(html, /href="simple-storefront\.css/);
  assert.match(html, /src="scripts\/storefront-design\.js/);
  assert.doesNotMatch(html, /original-content\.js|catalog\.json|127\.0\.0\.1:4175|No live orders/);
  assert.ok(fs.existsSync(new URL('../simple-storefront.css', import.meta.url)));
});
test('every existing inline application script and translation is unchanged', () => {
  const scripts = [...html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)].filter(m => m[2].trim()).map(m => m[0]);
  assert.equal(hash(scripts), baseline.inlineScripts);
});
test('all existing event handlers are preserved', () => {
  const handlers = [...html.matchAll(/\bon(?:click|submit|keydown|input|change|mouseover|mouseout|focus|blur)\s*=\s*(?:"[^"]*"|'[^']*')/gi)].map(m => m[0]);
  assert.equal(hash(handlers), baseline.eventHandlers);
});
test('all existing DOM IDs and form controls are preserved', () => {
  assert.equal(hash([...markup.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]).filter(id => !id.includes('${'))), baseline.staticIds);
  assert.equal(hash([...markup.matchAll(/<(?:form|input|select|textarea)\b[^>]*>/gi)].map(m => m[0])), baseline.forms);
});
test('approved studio section has no extra eyebrow and the real commission form remains available', () => {
  const about = markup.match(/<div id="about">([\s\S]*?)<!-- SHOP -->/)?.[1] || '';
  assert.doesNotMatch(about, /data-i18n="aboutEyebrow"/);
  assert.match(about, /data-i18n-html="aboutTitle"/);
  assert.match(about, /data-i18n="aboutBody"/);
  assert.match(markup, /<details class="simple-commission">/);
  assert.match(markup, /onsubmit="handleForm\(event\)"/);
});
