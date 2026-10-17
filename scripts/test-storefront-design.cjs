/* Local-only release smoke test. Public catalog/settings may be read; all
   external writes are blocked or fulfilled with fixtures. No real orders,
   accounts, admin changes or uploads are created. Requires Playwright. */
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { join, resolve, extname } = require('node:path');
const { chromium, webkit, firefox } = require('playwright');
const root = resolve(__dirname, '..');
const mime = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.json':'application/json', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png' };
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const relative = path === '/' ? 'index.html' : path.slice(1);
    if (!['GET','HEAD'].includes(req.method) || !/^(?:[^/.][^/]*\.(?:html|css|js|json|jpg|jpeg|png)|scripts\/[^/.][^/]*\.js)$/.test(relative)) throw new Error('Not public');
    const body = await readFile(join(root, relative));
    res.writeHead(200, { 'Content-Type':mime[extname(relative)] || 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (_) { res.writeHead(404); res.end(); }
});

async function check(name, type, url) {
  const browser = await type.launch({ headless:true });
  const context = await browser.newContext({ viewport:{ width:1440, height:1000 }, ignoreHTTPSErrors:true, reducedMotion:'reduce' });
  const page = await context.newPage();
  const errors = [], writes = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    sessionStorage.setItem('printx-firstorder-promo-v1', 'seen');
    localStorage.setItem('printx_lang', 'en');
  });
  await page.route('**/*', route => {
    const request = route.request();
    if (['GET','HEAD'].includes(request.method()) || new URL(request.url()).origin === new URL(url).origin) return route.continue();
    writes.push(new URL(request.url()).pathname);
    if (request.url().includes('/functions/v1/create-order')) return route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify({ order:{ id:'local-design-smoke', total:1234 } }) });
    if (request.url().includes('/functions/v1/create-custom-order')) return route.fulfill({ status:200, contentType:'application/json', body:'{}' });
    if (request.url().includes('/rest/v1/rpc/validate_voucher')) return route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify({ code:'FIRSTORDER', discount_type:'percent', discount_value:15 }) });
    return route.abort();
  });
  try {
    await page.goto(url, { waitUntil:'domcontentloaded' });
    await page.waitForSelector('#shop-grid .product-card', { timeout:30000 });
    await page.waitForFunction(() => document.querySelectorAll('.hero-slide').length > 1 && document.querySelector('.simple-hero-count').textContent.includes('/'));
    await page.waitForFunction(() => { const i=document.querySelector('.hero-slide.active'); return i.complete && i.naturalWidth>0; });
    const slides = await page.locator('.hero-slide').count();
    const current = () => page.evaluate(() => Array.from(document.querySelectorAll('.hero-slide')).findIndex(i => i.classList.contains('active')));
    let before = await current();
    await page.locator('#slider-next').click();
    await page.waitForFunction(i => Array.from(document.querySelectorAll('.hero-slide')).findIndex(x=>x.classList.contains('active')) !== i, before);
    assert.equal(await current(), (before+1)%slides, name+' hero next');
    await page.locator('#slider-next').press('ArrowLeft');
    assert.equal(await current(), before, name+' hero keyboard');
    await page.waitForFunction(() => document.querySelector('.simple-hero-count').textContent.startsWith((Array.from(document.querySelectorAll('.hero-slide')).findIndex(i=>i.classList.contains('active'))+1)+' /'));

    // Every visible header action must fit, including authenticated admin/RTL.
    await page.evaluate(() => { Store.setCart([{id:collectionApp._products[0].id,name:'Local header fixture',price:1,qty:99}]); cartApp.updateBadge(); });
    await page.evaluate(() => document.fonts.ready);
    const matrix = [];
    for (const width of [320,375,390,640,800,1024,1280,1440]) {
      await page.setViewportSize({ width, height:900 });
      for (const lang of ['en','ar']) for (const admin of [false,true]) {
        await page.evaluate(({lang,admin}) => {
          i18n.setLang(lang);
          authApp._renderMenu(admin?{id:'local-ui-only'}:null,admin?{username:'reviewadmin',role:'admin'}:null);
          window.scrollTo(0,0);
        }, {lang,admin});
        const layout = await page.evaluate(() => {
          const visible = el => !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
          const rect = el => { const r=el.getBoundingClientRect(); return { label:el.textContent.trim().slice(0,24)||el.id||el.className, x:r.x, right:r.right, y:r.y, bottom:r.bottom }; };
          const controls = Array.from(document.querySelectorAll('#nav a,#nav button')).filter(visible).map(rect);
          const outside = controls.filter(r=>r.x < -1 || r.right > innerWidth+1);
          const overlap = controls.filter((r,i)=>controls.slice(i+1).some(s=>Math.min(r.right,s.right)-Math.max(r.x,s.x)>2 && Math.min(r.bottom,s.bottom)-Math.max(r.y,s.y)>2));
          return { outside, overlap, overflow:document.documentElement.scrollWidth>innerWidth, actions:controls.length, controls };
        });
        assert.deepEqual(layout.outside, [], `${name} ${width} ${lang} admin=${admin} offscreen: ${JSON.stringify(layout.controls)}`);
        assert.deepEqual(layout.overlap, [], `${name} ${width} ${lang} admin=${admin} overlap`);
        assert.equal(layout.overflow,false,`${name} ${width} document overflow`);
        matrix.push({width,lang,admin,actions:layout.actions});
      }
    }
    await page.evaluate(() => { Store.setCart([]); i18n.setLang('en'); authApp._renderMenu(null,null); });
    await page.setViewportSize({width:390,height:844});
    await page.locator('#hamburgerBtn').click();
    await page.waitForSelector('#mobileMenu.open');
    await page.locator('#mobileClose').click();
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('#shop-search-input').fill('zzzz-no-product-smoke');
    assert.equal(await page.locator('#shop-grid .product-card').count(),0);
    await page.locator('#shop-search-input').fill('');
    assert.ok(await page.locator('#shop-grid .product-card').count()>0);
    const category = page.locator('#shop-filter-bar .filter-chip').nth(1);
    await category.click();
    assert.equal(await category.getAttribute('aria-pressed'),'true');
    await page.locator('#shop-filter-bar .filter-chip').first().click();

    // Exercise original variants/gallery/cart with public catalog data.
    await page.evaluate(() => {
      const product=collectionApp._products.find(p=>p.gallery_urls && p.gallery_urls.length) || collectionApp._products[0];
      productGallery.open(product);
    });
    await page.waitForSelector('#product-lightbox.open');
    if (await page.locator('#lb-next').isVisible()) {
      await page.locator('#lb-next').click();
      assert.equal(await page.evaluate(()=>productGallery._current),1);
    }
    for (const selector of ['#lb-colors-list button','#lb-sizes-list button']) {
      if (await page.locator(selector).count()) await page.locator(selector).first().click();
    }
    await page.locator('#lb-info button[onclick="productGallery.addToCart()"]',).click();
    assert.ok(await page.evaluate(()=>Store.getCart().length)>0);
    if (!(await page.locator('#cart-panel').getAttribute('class')).includes('open')) await page.locator('#nav-cart-btn').click();
    await page.waitForSelector('#cart-panel.open');
    await page.locator('#voucher-input').fill('FIRSTORDER');
    await page.locator('button[onclick="cartApp.applyVoucher()"]',).click();
    await page.waitForFunction(()=>cartApp.appliedVoucher && cartApp.appliedVoucher.value===15);
    await page.locator('#checkout-btn').click();
    await page.waitForSelector('#payment-overlay.open');
    await page.locator('#confirm-order-btn').click();
    assert.ok(await page.locator('#buyer-error').isVisible());
    await page.locator('#buyer-name').fill('Local QA');
    await page.locator('#buyer-phone').fill('01000000000');
    await page.locator('#buyer-address').fill('Local test address');
    await page.locator('#buyer-city').fill('Cairo');
    await page.locator('#buyer-governorate').selectOption({index:1});
    for (const method of ['instapay','ewallet','cod']) {
      await page.locator(`.pay-method[data-method="${method}"]`).click();
      assert.equal(await page.locator(`.pay-method[data-method="${method}"]`).getAttribute('aria-pressed'),'true');
    }
    await page.locator('#confirm-order-btn').click();
    await page.waitForSelector('#order-receipt-view:visible');
    assert.ok((await page.locator('#receipt-body').textContent()).includes('1,234') || (await page.locator('#receipt-body').textContent()).includes('1234'));
    assert.equal(await page.evaluate(()=>Store.getCart().length),0);
    await page.evaluate(()=>cartApp.closeReceipt());

    await page.evaluate(()=>authApp.open());
    await page.locator('.auth-tab').nth(1).click();
    assert.ok(await page.locator('#form-signup').isVisible());
    await page.locator('.auth-tab').first().click();
    assert.ok(await page.locator('#form-signin').isVisible());
    await page.locator('.auth-close').click();
    await page.locator('details.simple-commission>summary').click();
    await page.locator('#cf-name').fill('Local QA');
    await page.locator('#cf-email').fill('local-qa@example.com');
    await page.locator('#cf-phone').fill('01000000000');
    await page.locator('#cf-type').selectOption({index:1});
    await page.locator('#cf-desc').fill('A local fixture request to check the original commission form.');
    await page.locator('.custom-form button[type="submit"]').click();
    await page.waitForSelector('#form-success:visible');
    for (const name of ['shipping','returns','faq','contact']) {
      await page.evaluate(name=>infoPages.open(name),name);
      await page.waitForSelector('#info-page-overlay.visible');
      await page.evaluate(()=>infoPages.close());
      await page.waitForSelector('#info-page-overlay', {state:'hidden'});
    }
    // Isolated admin UI fixture: no protected orders/profiles are fetched.
    await page.evaluate(async () => {
      Store.getSession=async()=>({user:{id:'local-ui-only'}});
      Store.getProfile=async()=>({username:'reviewadmin',role:'admin'});
      Store.getProducts=async()=>collectionApp._products;
      Store.getOrders=async()=>[];
      Store.getCustomRequests=async()=>[];
      Store.getVouchers=async()=>[];
      await adminApp.open();
    });
    for (const name of ['products','orders','settings','dashboard']) {
      await page.locator('#admin-nav-'+name).click();
      assert.ok(await page.locator('#admin-page-'+name).isVisible());
    }
    await page.locator('.admin-quick-action').first().click();
    await page.waitForSelector('#add-product-modal.open');
    assert.deepEqual(errors, [], name+' page errors');
    assert.ok(writes.some(p=>p.includes('create-order')));
    assert.ok(writes.some(p=>p.includes('create-custom-order')));
    return {browser:name,headerLayouts:matrix.length,adminManagedSlides:slides,catalog:true,gallery:true,variants:true,cart:true,fixtureCheckout:true,fixtureCommission:true,authDialogs:true,adminNavigation:true,pageErrors:errors};
  } finally { await browser.close(); }
}
server.listen(0,'127.0.0.1',async()=> {
  try {
    const url=`http://127.0.0.1:${server.address().port}/`;
    const requested=new Set((process.env.BROWSERS||'Chromium,WebKit,Firefox').split(','));
    for (const [name,type] of [['Chromium',chromium],['WebKit',webkit],['Firefox',firefox]]) if(requested.has(name)) console.log(JSON.stringify(await check(name,type,url)));
  } catch(e) { console.error(e); process.exitCode=1; }
  finally { server.close(); }
});
