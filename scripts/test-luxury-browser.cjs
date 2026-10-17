/* Requires Playwright and PRINTX_TEST_SDK pointing to supabase-js UMD. No live writes. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createServer}=require('node:http');
const {chromium}=require('playwright'),fixture=require('./browser-fixtures.cjs'),catalog=require('../server/catalog.cjs');
const root=path.resolve(__dirname,'..');
const server=createServer((req,res)=>{try{const url=new URL(req.url,'http://localhost'),p=decodeURIComponent(url.pathname);let body,type;
 if(p.startsWith('/products/')){const product=fixture.products.find(x=>x.id===p.split('/')[2]&&!x.hidden);if(!product){res.statusCode=404;body=catalog.errorPage(404);}else body=catalog.renderProduct(fs.readFileSync(path.join(root,'index.html'),'utf8'),product,{});type='text/html';}
 else {const file=path.resolve(root,'.'+(p==='/'?'/index.html':p));if(!file.startsWith(root+'/'))throw Error();body=fs.readFileSync(file);type=({'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpeg':'image/jpeg','.png':'image/png'})[path.extname(file)];}
 res.setHeader('Content-Type',type||'application/octet-stream');res.end(body);
 }catch(_){res.statusCode=404;res.end();}});
server.listen(0,'127.0.0.1',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PRINTX_TEST_CHROMIUM}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url='http://127.0.0.1:'+server.address().port, id=fixture.products[0].id;
 try{
  await fixture.install(page);await page.goto(url);await page.waitForSelector('#px-featured .product-card');
  assert.equal(await page.locator('#px-featured .product-card').count(),4);
  assert.equal(await page.locator('#store-promotion').getAttribute('open'),null);
  // Hidden hero links must stay hidden when a product slide changes to a studio image.
  await page.waitForSelector('#px-hero-product:not([hidden])');
  await page.evaluate(()=>{const active=document.querySelector('.hero-slide.active');active.dataset.original='/studio-unmapped.jpeg';active.dataset.src='/studio-unmapped.jpeg';active.src='/studio-unmapped.jpeg';});
  await page.waitForFunction(()=>document.querySelector('#px-hero-product').hidden);
  assert.equal(await page.locator('#px-hero-product').isVisible(),false,'unmapped slide hides previous product link');
  await page.evaluate(()=>{const active=document.querySelector('.hero-slide.active');active.dataset.original='/1.jpeg';active.dataset.src='/1.jpeg';active.src='/1.jpeg';});
  // The full-catalog overlay must not conceal product variants.
  await page.locator('.shop-all-button').click();await page.waitForSelector('#shop-page-overlay.open');
  await page.locator('#shop-page-grid .product-view').first().click();await page.waitForSelector('#product-lightbox.open');
  assert.equal(await page.locator('#lb-sizes-list button').first().evaluate(e=>{const r=e.getBoundingClientRect();return !!document.elementFromPoint(r.x+r.width/2,r.y+r.height/2).closest('#product-lightbox');}),true,'product controls are above full catalog');
  await page.locator('#lb-sizes-list button').nth(1).click();assert.equal(await page.evaluate(()=>productGallery._selectedSizeIndex),1);
  await page.locator('.lightbox-close').click();await page.waitForSelector('#product-lightbox',{state:'hidden'});await page.locator('.shop-page-close-btn').click();await page.waitForSelector('#shop-page-overlay',{state:'hidden'});

  await page.locator('#px-featured .px-save').first().click();
  await page.locator('#px-featured .px-text-button').first().click();await page.waitForSelector('#px-saved[open] .product-card');
  await page.locator('#px-saved .px-close').click();
  await page.evaluate(()=>window.scrollTo(0,0));
  if(process.env.PRINTX_SCREENSHOTS)await page.screenshot({path:path.join(process.env.PRINTX_SCREENSHOTS,'desktop.png'),fullPage:false});
  await page.locator('#px-featured .product-view').first().click();await page.waitForSelector('#product-lightbox.open');
  assert.equal(new URL(page.url()).pathname,'/products/'+id);
  await page.locator('#lb-sizes-list button').nth(1).click();
  assert.match(await page.locator('#px-purchase-bar strong').textContent(),/1,400/);
  assert.match(await page.locator('#px-product-delivery').textContent(),/Free delivery/);
  await page.locator('#px-zoom-open').click();await page.waitForSelector('#px-zoom[open]');await page.keyboard.press('Escape');
  assert.ok(await page.locator('#product-lightbox').evaluate(e=>e.classList.contains('open')));
  // An old close timer must not hide a different product opened immediately afterwards.
  await page.evaluate(()=>{productGallery.close();productGallery.open(collectionApp._products[1]);});
  await page.waitForTimeout(350);assert.ok(await page.locator('#product-lightbox').isVisible(),'rapid reopen remains visible');
  await page.goto(url+'/products/'+id);await page.waitForSelector('#product-lightbox.open');
  await page.setViewportSize({width:390,height:844});
  await page.locator('#lb-sizes-list button').nth(1).click();await page.locator('#lb-colors-list button').first().click();
  assert.ok(await page.locator('#px-purchase-bar').isVisible());
  const bounds=await page.locator('#px-purchase-bar').boundingBox();assert.ok(bounds.y+bounds.height<=845,'mobile purchase bar inside viewport');
  if(process.env.PRINTX_SCREENSHOTS)await page.screenshot({path:path.join(process.env.PRINTX_SCREENSHOTS,'mobile-product.png')});
  await page.locator('#px-purchase-bar button').click();await page.waitForSelector('#product-lightbox',{state:'hidden'});
  if(!await page.locator('#cart-panel').evaluate(e=>e.classList.contains('open')))await page.locator('#nav-cart-btn').click();await page.waitForSelector('#cart-panel.open');
  await page.locator('#checkout-btn').click();await page.waitForSelector('#payment-overlay.open');
  await page.locator('#buyer-name').fill('Local QA');await page.locator('#buyer-phone').fill('01000000000');await page.locator('#buyer-address').fill('Local fixture address');await page.locator('#buyer-city').fill('Cairo');await page.locator('#buyer-notes').fill('Leave at reception.');await page.locator('#buyer-governorate').selectOption('cairo');
  await page.locator('.pay-method[data-method=cod]').click();
  const requests=[];let fail=true;
  await page.route('**/functions/v1/create-order',async route=>{requests.push(route.request().postDataJSON());await new Promise(r=>setTimeout(r,100));if(fail)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Local retry fixture'})});return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({order:{id:'fixture-order',total:1190,discount_amount:210,delivery_fee:0,items:[{id,name:'The Collector',price:1400,qty:1,size:'Large',color:'Ivory'}]}})});});
  await page.evaluate(()=>Promise.all([cartApp.confirmOrder(),cartApp.confirmOrder()]));assert.equal(requests.length,1);assert.equal(await page.locator('#buyer-name').inputValue(),'Local QA');assert.match(await page.locator('#px-checkout-error').textContent(),/Local retry/);
  await page.evaluate(()=>i18n.setLang('ar'));
  fail=false;await page.locator('#confirm-order-btn').click();await page.waitForSelector('#order-receipt-view:visible');assert.equal(requests.length,2);assert.equal(requests[0].requestKey,requests[1].requestKey,'language change keeps retry identity');assert.equal(requests[0].buyerNotes,'Leave at reception.');assert.match(await page.locator('#receipt-body').textContent(),/1,?190/);assert.match(await page.locator('#receipt-body').textContent(),/fixture-order/);
  await page.evaluate(()=>cartApp.closeReceipt());await page.goto(url);await page.waitForSelector('#px-featured .product-card');await page.evaluate(()=>i18n.setLang('ar'));
  assert.equal(await page.locator('html').getAttribute('dir'),'rtl');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(process.env.PRINTX_SCREENSHOTS)await page.screenshot({path:path.join(process.env.PRINTX_SCREENSHOTS,'mobile-arabic.png')});
  // Admin drafts do not leak to the public view when a save fails.
  await page.evaluate(async()=>{Store.getSession=async()=>({user:{id:'local-ui'}});Store.getProfile=async()=>({role:'admin',username:'Fixture'});Store.getOrders=Store.getCustomRequests=Store.getVouchers=async()=>[];await adminApp.open();adminApp.showPage('settings');});
  await page.locator('#px-content-editor summary').click();
  const material=page.locator('#px-content-editor label').filter({hasText:'Material — English'}).locator('textarea');await material.fill('Fixture material');
  let failSave=true;
  await page.route('**/rest/v1/settings*',route=>route.request().method()==='GET'?route.fallback():route.fulfill({status:failSave?409:200,contentType:'application/json',body:JSON.stringify(failSave?{message:'Local conflict'}:[{key:'luxury_content_v1'}])}));
  await page.locator('#px-content-editor button').filter({hasText:'Save storefront content'}).click();
  await page.waitForFunction(()=>document.querySelector('.px-editor-status').textContent.includes('Local conflict'));
  assert.equal(await page.evaluate(id=>(PrintXLuxury.config.products[id]||{}).material,id),undefined);
  failSave=false;await page.locator('#px-content-editor button').filter({hasText:'Save storefront content'}).click();await page.waitForFunction(()=>document.querySelector('.px-editor-status').textContent.startsWith('Saved.'));
  assert.equal(await page.evaluate(id=>PrintXLuxury.config.products[id].material,id),'Fixture material');
  assert.deepEqual(errors,[]);console.log('Luxury browser: curation, saved pieces, routes, zoom, reopen, mobile purchase, variants, retry, server receipt and Arabic passed.');
 }catch(e){console.error(e);process.exitCode=1;if(process.env.PRINTX_SCREENSHOTS)await page.screenshot({path:path.join(process.env.PRINTX_SCREENSHOTS,'failure.png')});}
 finally{await browser.close();server.close();}
});
