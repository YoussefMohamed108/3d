import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./meta-pixel.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const verified = fs.readFileSync(new URL('../verified.html', import.meta.url), 'utf8');
const config = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const pixelId = '1404442528337355';

function run(url = 'https://printx-eg.com/', navigator = {}, storage) {
  const inserted = [];
  const window = { location: new URL(url), navigator, localStorage: storage };
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

const events = window => JSON.parse(JSON.stringify(Array.from(window.fbq.queue, args => Array.from(args))));
function commerce(options = {}) {
  const result = run('https://printx-eg.com/', {}, options.storage);
  assert.equal(typeof result.window.PrintXMeta?.addToCart, 'function');
  assert.equal(typeof result.window.PrintXMeta?.purchase, 'function');
  return result;
}

test('AddToCart reports only the newly added quantity and its effective EGP price', () => {
  const { window } = commerce();
  window.PrintXMeta.addToCart({ id: 'product-1', price: 125, qty: 9, buyer_email: 'private@example.com' }, 2);
  const event = events(window).at(-1);
  assert.deepEqual(event, ['track', 'AddToCart', {
    content_type: 'product', content_ids: ['product-1'],
    contents: [{ id: 'product-1', quantity: 2, item_price: 125 }],
    currency: 'EGP', value: 250, num_items: 2
  }]);
});

test('Purchase uses the server total and groups quantities by public product ID', () => {
  const { window } = commerce();
  window.PrintXMeta.purchase({ id: 'order-1', total: '367.50', status: 'pending', buyer_name: 'Private Name' }, [
    { id: 'product-1', qty: 2, price: 900, selectedColor: { name: 'Blue' } },
    { id: 'product-1', qty: 1, price: 900, selectedColor: { name: 'Red' } },
    { id: 'product-2', qty: 1, price: 900 }
  ]);
  assert.deepEqual(events(window).at(-1), ['track', 'Purchase', {
    content_type: 'product', content_ids: ['product-1', 'product-2'],
    contents: [{ id: 'product-1', quantity: 3 }, { id: 'product-2', quantity: 1 }],
    currency: 'EGP', value: 367.5, num_items: 4, order_id: 'order-1'
  }, { eventID: 'printx-purchase-order-1' }]);
});

test('a repeated order is counted once even when the page reloads', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value) };
  const order = { id: 'order-1', total: 100 };
  const cart = [{ id: 'product-1', qty: 1 }];
  const first = commerce({ storage }).window;
  first.PrintXMeta.purchase(order, cart);
  first.PrintXMeta.purchase(order, cart);
  assert.equal(events(first).filter(event => event[1] === 'Purchase').length, 1);
  const second = commerce({ storage }).window;
  second.PrintXMeta.purchase(order, cart);
  assert.equal(events(second).filter(event => event[1] === 'Purchase').length, 0);
  second.PrintXMeta.purchase({ id: 'order-2', total: 0 }, cart);
  assert.equal(events(second).filter(event => event[1] === 'Purchase').length, 1);
  assert.equal(events(second).at(-1)[2].value, 0);
});

test('missing order IDs, totals, products, and invalid quantities do not create conversions', () => {
  const { window } = commerce();
  const cart = [{ id: 'product-1', qty: 1 }];
  for (const order of [null, {}, { id: 'order-1' }, { id: 'order-1', total: null },
    { id: 'order-1', total: '' }, { id: 'order-1', total: NaN }, { id: 'order-1', total: -1 }]) {
    window.PrintXMeta.purchase(order, cart);
  }
  for (const items of [[], null, [{ qty: 1 }], [{ id: 'product-1', qty: 0 }], [{ id: 'product-1', qty: 1.5 }]]) {
    window.PrintXMeta.purchase({ id: 'order-1', total: 100 }, items);
  }
  for (const quantity of [0, -1, 1.5, Infinity]) {
    window.PrintXMeta.addToCart({ id: 'product-1', price: 100 }, quantity);
  }
  assert.equal(events(window).length, 3);
});

test('tracking still works when browser storage is unavailable', () => {
  const { window } = commerce({ storage: { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } } });
  const order = { id: 'order-1', total: 100 };
  const cart = [{ id: 'product-1', qty: 1 }];
  assert.doesNotThrow(() => window.PrintXMeta.purchase(order, cart));
  window.PrintXMeta.purchase(order, cart);
  assert.equal(events(window).filter(event => event[1] === 'Purchase').length, 1);
});

test('a Meta SDK exception does not interrupt the cart or mark an unsent purchase as sent', () => {
  const { window } = commerce();
  const fbq = window.fbq;
  window.fbq = () => { throw Error('SDK unavailable'); };
  assert.doesNotThrow(() => window.PrintXMeta.addToCart({ id: 'product-1', price: 100 }, 1));
  assert.doesNotThrow(() => window.PrintXMeta.purchase({ id: 'order-1', total: 100 }, [{ id: 'product-1', qty: 1 }]));
  window.fbq = fbq;
  window.PrintXMeta.purchase({ id: 'order-1', total: 100 }, [{ id: 'product-1', qty: 1 }]);
  assert.equal(events(window).filter(event => event[1] === 'Purchase').length, 1);
});

// Exercise the real cart code while isolating database/storage and visual rendering.
function storefront() {
  const { window } = commerce();
  let cart = [];
  const fields = {
    'buyer-name': 'Test Customer', 'buyer-phone': '01000000000',
    'buyer-address': 'Test Street 123', 'buyer-city': 'Cairo', 'buyer-governorate': 'cairo'
  };
  const elements = Object.fromEntries(Object.entries(fields).map(([id, value]) => [id, { value, style: {}, focus() {} }]));
  elements['confirm-order-btn'] = { disabled: false, textContent: 'Confirm Order' };
  elements['cart-panel'] = { classList: { contains: () => true } };
  const Store = {
    getCart: () => JSON.parse(JSON.stringify(cart)),
    setCart: items => { cart = JSON.parse(JSON.stringify(items)); },
    createOrder: async () => ({ id: 'order-1', total: 175, status: 'pending', delivery_fee: 25, discount_amount: 50 })
  };
  const alerts = [];
  const context = vm.createContext({
    window, Store, document: { getElementById: id => elements[id] || null },
    console: { warn() {} }, alert: message => alerts.push(message),
    showCartToast() {}, govLabel: value => value, paymentUI: { _numbers: {} }
  });
  const start = html.indexOf('  const cartApp = {');
  const end = html.indexOf('  /* ─── AUTH APPLICATION', start);
  assert.ok(start >= 0 && end > start);
  vm.runInContext(html.slice(start, end) + '\nthis.cartApp = cartApp;', context);
  const app = context.cartApp;
  app.render = () => {};
  app.updateBadge = () => {};
  app._renderReceipt = () => {};
  app.selectedPaymentMethod = 'cod';
  return { window, app, Store, elements, alerts };
}

test('real cart additions use sale and size prices and track only positive quantity changes', () => {
  const { window, app, Store } = storefront();
  const product = { id: 'product-1', name: 'Figure', price: 200, sale_price: 150 };
  app.add(product);
  app.add(product, null, { name: 'Large', price: 300 });
  app.changeQty('product-1::Large', 2);
  app.changeQty('product-1::Large', -1);
  app.render();
  const additions = events(window).filter(event => event[1] === 'AddToCart');
  assert.equal(additions.length, 3);
  assert.deepEqual(additions.map(event => event[2].value), [150, 300, 600]);
  assert.deepEqual(additions.map(event => event[2].num_items), [1, 1, 2]);
  assert.equal(Store.getCart()[1].qty, 2);
});

test('a failed cart save never sends AddToCart', () => {
  const { window, app, Store } = storefront();
  Store.setCart = () => { throw Error('Storage unavailable'); };
  assert.throws(() => app.add({ id: 'product-1', name: 'Figure', price: 200 }), /Storage unavailable/);
  assert.equal(events(window).filter(event => event[1] === 'AddToCart').length, 0);
});

test('checkout waits for a saved order before tracking Purchase and clearing the cart', async () => {
  const { window, app, Store } = storefront();
  Store.setCart([{ id: 'product-1', name: 'Figure', price: 200, qty: 1 }]);
  let resolveOrder;
  Store.createOrder = () => new Promise(resolve => { resolveOrder = resolve; });
  const pending = app.confirmOrder();
  assert.equal(events(window).filter(event => event[1] === 'Purchase').length, 0);
  resolveOrder({ id: 'order-1', total: 175, status: 'pending', delivery_fee: 25, discount_amount: 50 });
  await pending;
  const purchases = events(window).filter(event => event[1] === 'Purchase');
  assert.equal(purchases.length, 1);
  assert.equal(purchases[0][2].value, 175);
  assert.equal(Store.getCart().length, 0);
});

test('failed checkout does not report a purchase or empty the cart', async () => {
  const { window, app, Store, alerts } = storefront();
  Store.setCart([{ id: 'product-1', name: 'Figure', price: 200, qty: 1 }]);
  Store.createOrder = async () => { throw Error('Order unavailable'); };
  await app.confirmOrder();
  assert.equal(events(window).filter(event => event[1] === 'Purchase').length, 0);
  assert.equal(Store.getCart().length, 1);
  assert.equal(alerts.length, 1);
});

test('cart and checkout continue normally when tracking is disabled', async () => {
  const { window, app, Store, alerts } = storefront();
  delete window.PrintXMeta;
  app.add({ id: 'product-1', name: 'Figure', price: 200 });
  await app.confirmOrder();
  assert.equal(Store.getCart().length, 0);
  assert.equal(alerts.length, 0);
});

test('product and checkout events contain product data but no customer fields', () => {
  const {window}=run();
  assert.equal(typeof window.PrintXMeta.viewContent,'function');
  assert.equal(typeof window.PrintXMeta.initiateCheckout,'function');
  window.PrintXMeta.viewContent({id:'piece',price:900,name:'Private marker'});
  window.PrintXMeta.initiateCheckout([{id:'piece',qty:2,price:900,buyerPhone:'private-phone'}]);
  const events=Array.from(window.fbq.queue,a=>Array.from(a));
  assert.equal(events.at(-2)[1],'ViewContent');
  assert.equal(events.at(-1)[1],'InitiateCheckout');
  assert.equal(events.at(-1)[2].value,1800);
  assert.doesNotMatch(JSON.stringify(events),/Private marker|private-phone/);
});

test('product routes keep the same privacy checks', () => {
  const url='https://printx-eg.com/products/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  assert.equal(run(url).inserted.length,1);
  assert.equal(run(url,{globalPrivacyControl:true}).inserted.length,0);
  assert.equal(run(url+'?code=secret').inserted.length,0);
});
