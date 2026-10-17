/* Additive storefront enhancements. The original catalog, variants and cart remain authoritative. */
(function () {
  'use strict';
  if (typeof collectionApp === 'undefined' || typeof productGallery === 'undefined' || !window.PrintXLuxuryCore) return;
  const C = window.PrintXLuxuryCore;
  const q = (s, root = document) => root.querySelector(s);
  const ar = () => document.documentElement.lang === 'ar';
  const tx = (en, arabic) => ar() ? arabic : en;
  const money = n => 'EGP ' + Number(n || 0).toLocaleString('en-EG', {minimumFractionDigits:2, maximumFractionDigits:2});
  const el = (tag, cls, text) => { const n=document.createElement(tag); if(cls)n.className=cls; if(text != null)n.textContent=text; return n; };
  const button = (text, cls, action) => { const b=el('button',cls,text); b.type='button'; b.addEventListener('click',action); return b; };
  const hook = (object, name, after) => { const original=object[name]; object[name]=function(...args){ const result=original.apply(this,args); after.apply(this,args); return result; }; };
  const path = p => '/products/' + encodeURIComponent(p.id);
  let saved=[];
  try { saved=C.savedIds(JSON.parse(localStorage.getItem('printx-saved-v1') || '[]')); } catch (_) {}
  const api = window.PrintXLuxury = {C,q,ar,tx,money,el,button,hook,path,config:C.config({}),ready:false};
  function saveIds() { try { localStorage.setItem('printx-saved-v1',JSON.stringify(saved)); } catch (_) { announce(tx('Saved for this visit. Browser storage is unavailable.','تم الحفظ لهذه الزيارة فقط. تخزين المتصفح غير متاح.')); } }
  function announce(text) { q('#px-status').textContent=text; }
  const live=el('div','px-sr-only'); live.id='px-status'; live.setAttribute('role','status'); document.body.append(live);
  api.announce=announce;
  api.dialog=function(id,title) {
    let d=q('#'+id); if(d)d.remove();
    d=el('dialog','px-dialog'); d.id=id;
    const head=el('div','px-dialog-head'), h=el('h2','',title); h.id=id+'-title'; d.setAttribute('aria-labelledby',h.id);
    const close=button('×','px-close',()=>d.close()); close.setAttribute('aria-label',tx('Close','إغلاق'));
    head.append(h,close); d.append(head); document.body.append(d);
    const previous=document.activeElement;
    d.addEventListener('close',()=>{ if(previous && previous.isConnected)previous.focus(); });
    d.addEventListener('click',e=>{ if(e.target===d) {const r=d.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();} });
    return d;
  };
  function syncSaveButtons() {
    document.querySelectorAll('[data-px-save]').forEach(b=>{
      const on=saved.includes(b.dataset.pxSave); b.setAttribute('aria-pressed',String(on)); b.textContent=on?'♥':'♡';
      b.setAttribute('aria-label',tx(on?'Remove from saved pieces':'Save this piece',on?'إزالة من القطع المحفوظة':'احفظ هذه القطعة'));
    });
  }
  function toggleSaved(id) {
    saved=saved.includes(id)?saved.filter(x=>x!==id):C.savedIds(saved.concat(id)); saveIds(); syncSaveButtons();
    announce(tx('Saved pieces updated.','تم تحديث القطع المحفوظة.'));
    if(q('#px-saved[open]')) renderSaved(q('#px-saved'));
  }
  function enhanceCards(grid, products) {
    if(!grid)return;
    grid.querySelectorAll('.product-card').forEach(card=>{
      if(card.dataset.pxReady)return; card.dataset.pxReady='true';
      const p=products.find(p=>p.id===card.dataset.pid); if(!p)return;
      const save=button('♡','px-save',e=>{e.stopPropagation();toggleSaved(p.id);}); save.dataset.pxSave=p.id;
      const media=q('.product-media',card);(media||card).append(save);const second=(p.gallery_urls||[]).find(u=>u!==p.image_url && C.media(u));
      if(second && matchMedia('(hover:hover)').matches) {
        const img=el('img','px-second-image'); img.alt=''; img.setAttribute('aria-hidden','true'); img.loading='lazy'; img.decoding='async';
        img.src=optimizedImageUrl(second,640); media.append(img);
      }
      const view=q('.product-view',card);
      if(view) { const a=el('a','product-view',tx('Explore piece','اكتشف القطعة')); a.href=path(p); a.addEventListener('click',e=>{ e.stopPropagation();if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return; e.preventDefault();productGallery.open(p); }); view.replaceWith(a); }
      const badge=q('.product-badge',card); if(badge && String(p.badge).toLowerCase()==='hot')badge.textContent=tx('Selected','مختارة');
      const fulfil=q('.product-fulfilment',card); const m=api.config.products[p.id]||{};
      if(fulfil)fulfil.textContent=C.text(m[ar()?'delivery_ar':'delivery'],100)||tx('3–7 business days','٣–٧ أيام عمل');
      const imageCount=media&&media.querySelector('div:not(.product-badges)');
      if(imageCount && /photos$/.test(imageCount.textContent))imageCount.textContent=(p.gallery_urls.length+1)+' '+tx('photos','صور');
      animate(card);
    }); syncSaveButtons();
  }
  let observer;
  if('IntersectionObserver' in window)observer=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('px-arrive');observer.unobserve(e.target);}});},{threshold:.08});
  function animate(n){if(observer&&!matchMedia('(prefers-reduced-motion: reduce)').matches)observer.observe(n);}
  api.cards=function(container, products){container.innerHTML=products.map(p=>collectionApp._cardHTML(p)).join(''); collectionApp._wireGrid(container,products); enhanceCards(container,products);};
  hook(collectionApp,'_wireGrid',enhanceCards);
  // Full catalog has its own original wiring, so enhance after its render too.
  hook(shopPage,'_renderGrid',()=>enhanceCards(q('#shop-page-grid'),collectionApp._products));
  function renderSaved(d) {
    let body=q('.px-saved-body',d);if(!body){body=el('div','px-saved-body');d.append(body);} body.replaceChildren();
    const items=collectionApp._products.filter(p=>!p.hidden&&saved.includes(p.id));
    if(!items.length) { body.append(el('p','px-empty',tx('Save pieces you love and return to them here. Saved on this browser.','احفظ القطع التي تعجبك لتعود إليها هنا. تُحفظ على هذا المتصفح.'))); return; }
    const grid=el('div','px-grid'); body.append(grid);api.cards(grid,items);
    grid.addEventListener('click',e=>{if(!e.target.closest('[data-px-save]'))d.close();},{capture:true});
  }
  function openSaved(){const d=api.dialog('px-saved',tx('Your saved pieces','قطعك المحفوظة'));renderSaved(d); if(d.showModal)d.showModal();else d.setAttribute('open','');}
  api.openSaved=openSaved;
  function collectionSection() {
    const products=collectionApp._products.filter(p=>!p.hidden); if(!products.length)return;
    let section=q('#px-featured');if(!section){section=el('section','px-section');section.id='px-featured';q('#shop').before(section);}
    section.replaceChildren();
    const head=el('div','px-section-head'), intro=el('div'); intro.append(el('p','px-eyebrow',tx('The PrintX selection','اختيارات PrintX')),el('h2','px-heading',tx('Pieces with presence.','قطع تلفت الأنظار.')));
    head.append(intro,button(tx('Saved pieces ♡','القطع المحفوظة ♡'),'px-text-button',openSaved));section.append(head);
    const grid=el('div','px-grid');section.append(grid);api.cards(grid,C.selected(products,api.config.featured));
    const cats=el('div','px-categories'); const names=[...new Set(products.flatMap(p=>getProductCategories(p)))];
    names.forEach(name=>cats.append(button(name,'',()=>{collectionApp.mainFilter.clear();collectionApp.setMainFilter(name);q('#shop').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});})));section.append(cats);
    if(!q('#px-catalog-tools')) { const tools=el('div','px-toolbar');tools.id='px-catalog-tools';tools.append(el('span','px-eyebrow',tx('Find your next piece','ابحث عن قطعتك القادمة')),button(tx('Saved pieces ♡','القطع المحفوظة ♡'),'px-text-button',openSaved));q('#shop-grid').before(tools); }
  }
  function heroLink() {
    const img=q('.hero-slide.active');if(!img)return;
    const original=img.dataset.original||img.dataset.src||img.src;
    let u;try{u=new URL(original,location.href);u.searchParams.delete('tr');}catch(_){return;}
    const mapped=api.config.hero[u.href] || api.config.hero[u.pathname];
    const p=collectionApp._products.find(p=>!p.hidden&&(p.id===mapped || [p.image_url,...(p.gallery_urls||[])].some(src=>{try{const a=new URL(src,location.href);a.searchParams.delete('tr');return a.href===u.href;}catch(_){return false;}})));
    let link=q('#px-hero-product');if(!link){link=el('a','px-hero-link');link.id='px-hero-product';q('#hero-slider').append(link);}
    link.hidden=!p; if(!p)return;
    link.replaceChildren();const label=el('div');label.append(el('span','',tx('On display','القطعة المعروضة')),el('strong','',p.name));link.append(label,el('small','',tx('View this piece ↗','اكتشف القطعة ↖')));link.href=path(p);link.onclick=e=>{if(e.ctrlKey||e.metaKey)return;e.preventDefault();productGallery.open(p);};
  }
  function updateCopy(){
    q('.hero-title').innerHTML=tx('A statement piece<br>for <em>your collection.</em>','قطعة مميزة<br>تُكمل <em>مجموعتك.</em>');
    q('.hero-sub').textContent=tx('Discover 3D-printed figures and custom creations from PrintX, made in Egypt. Find a piece that belongs in your space.','اكتشف المجسمات المطبوعة ثلاثياً والتصاميم الخاصة من PrintX، المصنوعة في مصر. اختر قطعة تعبّر عنك وتناسب مساحتك.');
    q('.hero-eyebrow').textContent=tx('PrintX · Pharaonic precision','PrintX · دقة فرعونية');
    q('.hero-actions .btn-primary').textContent=tx('Explore the collection','اكتشف المجموعة');
    q('.hero-actions .btn-ghost').textContent=tx('Create a custom piece','صمّم قطعتك الخاصة');
    const title=q('#shop .section-title');if(title)title.textContent=tx('Find your next piece.','اختر قطعتك القادمة.');
    const toolbar=q('#px-catalog-tools');if(toolbar)toolbar.remove();collectionSection();heroLink();
  }
  api.refresh=function(){updateCopy();if(api.renderStory)api.renderStory();if(productGallery._product&&q('#product-lightbox.open'))detail();};
  hook(collectionApp,'_renderMainGrid',()=>{collectionSection();heroLink();openInitial();});
  hook(i18n,'apply',()=>{api.refresh();const pause=q('#px-hero-pause');if(pause)pause.textContent=window.PrintXHeroPaused?tx('Play slideshow','تشغيل العرض'):tx('Pause slideshow','إيقاف العرض');});
  if('MutationObserver' in window)new MutationObserver(heroLink).observe(q('#hero-slides'),{childList:true,subtree:true,attributes:true,attributeFilter:['class','src']});
  function supportUrl(p){let n=(paymentUI._numbers&&paymentUI._numbers.whatsapp)||'201125607937';n=n.replace(/\D/g,'');if(n.startsWith('0'))n='2'+n;return 'https://wa.me/'+n+'?text='+encodeURIComponent(tx('Hello PrintX, I have a question about ','مرحباً PrintX، لدي سؤال عن ')+p.name+'\nhttps://printx-eg.com'+path(p));}
  function detail() {
    const p=productGallery._product;if(!p)return;
    const old=q('#px-product-extra');if(old)old.remove();const sticky=q('#px-purchase-bar');if(sticky)sticky.remove();
    const box=el('div','px-extra');box.id='px-product-extra';const m=api.config.products[p.id]||{}, suffix=ar()?'_ar':'';
    const specs=el('dl','px-specs');
    [['dimensions','Dimensions','الأبعاد'],['material','Material','الخامة'],['finish','Finish','التشطيب'],['included','Included','المحتويات'],['care','Care','العناية'],['fulfilment','Availability','التجهيز']].forEach(([key,en,a])=>{const v=C.text(m[key+suffix]||m[key],800);if(v){const row=el('div');row.append(el('dt','',tx(en,a)),el('dd','',v));specs.append(row);}});
    if(specs.children.length)box.append(el('h3','',tx('The details','تفاصيل القطعة')),specs);
    const actions=el('div','px-detail-actions');
    actions.append(button(saved.includes(p.id)?tx('Saved ♥','محفوظة ♥'):tx('Save piece ♡','احفظ القطعة ♡'),'px-button px-secondary',()=>{toggleSaved(p.id);detail();}));
    actions.append(button(tx('Share','مشاركة'),'px-button px-secondary',async()=>{const url='https://printx-eg.com'+path(p);try{if(navigator.share)await navigator.share({title:p.name,url});else {await navigator.clipboard.writeText(url);announce(tx('Product link copied.','تم نسخ رابط المنتج.'));}}catch(_){announce(tx('Product link: ','رابط المنتج: ')+url);}}));
    box.append(actions);
    const label=el('label','',tx('Delivery to your governorate','التوصيل إلى محافظتك'));const select=el('select','px-delivery-select');select.id='px-product-governorate';label.htmlFor=select.id;
    select.append(new Option(tx('Check delivery cost','اعرف تكلفة التوصيل'),''));EGYPT_GOVERNORATES.forEach(g=>select.append(new Option(govLabel(g.key),g.key)));box.append(label,select);
    const status=el('p','');status.id='px-product-delivery';status.setAttribute('role','status');box.append(status);
    async function updateDelivery(){const price=C.price(p,productGallery._selectedSizeIndex);if(price>=FREE_DELIVERY_THRESHOLD){status.textContent=tx('Free delivery for this selection.','توصيل مجاني لهذا الاختيار.');return;}if(!select.value){status.textContent=tx('Free delivery on product subtotals of EGP 1,000 before discounts.','توصيل مجاني لإجمالي منتجات ١٬٠٠٠ جنيه قبل الخصم.');return;}status.textContent=tx('Checking delivery…','جارٍ حساب التوصيل…');try{const prices=await Store.getDeliveryPrices();const fee=prices[select.value];status.textContent=fee==null?tx('Confirm delivery with the studio.','تواصل مع الاستوديو لتأكيد تكلفة التوصيل.'):tx('Delivery: ','التوصيل: ')+money(fee);}catch(_){status.textContent=tx('Unable to check delivery. Please contact us.','تعذر حساب التوصيل. يرجى التواصل معنا.');}}
    select.addEventListener('change',updateDelivery);updateDelivery();api.updateProductDelivery=updateDelivery;
    box.append(el('p','',C.text(m['delivery'+suffix]||m.delivery,200)||tx('Estimated delivery: 3–7 business days after confirmation.','التوصيل المتوقع: ٣–٧ أيام عمل بعد التأكيد.')));
    const policies=el('div','px-detail-actions');[['shipping','Shipping','الشحن'],['returns','Returns','الاسترجاع']].forEach(([key,en,a])=>policies.append(button(tx(en,a),'px-text-button',()=>{productGallery.close();infoPages.open(key);})));box.append(policies);
    const wa=el('a','px-button px-secondary',tx('Ask about this piece','اسأل عن هذه القطعة'));wa.href=supportUrl(p);wa.target='_blank';wa.rel='noopener noreferrer';box.append(wa);
    const recommended=C.related(p,collectionApp._products);if(recommended.length){box.append(el('h3','',tx('Explore the collection','اكتشف المزيد')));const list=el('div','px-related');recommended.forEach(other=>{const a=el('a');a.href=path(other);if(C.media(other.image_url)){const img=el('img');img.src=optimizedImageUrl(other.image_url,160);img.alt=other.name;img.loading='lazy';a.append(img);}const title=el('span','',other.name);title.append(el('small','',money(C.price(other))));a.append(title);a.addEventListener('click',e=>{if(e.ctrlKey||e.metaKey)return;e.preventDefault();productGallery.open(other);});list.append(a);});box.append(list);}
    q('#lb-info').append(box);
    const bar=el('div','px-purchase-bar');bar.id='px-purchase-bar';bar.append(el('strong','',money(C.price(p,productGallery._selectedSizeIndex))),button(tx('Add to cart','أضف للسلة'),'px-button',()=>productGallery.addToCart()));q('.lightbox-inner').append(bar);
    let zoom=q('#px-zoom-open');if(!zoom){zoom=button(tx('Zoom +','تكبير +'),'px-button px-secondary px-zoom-button',openZoom);zoom.id='px-zoom-open';q('.lightbox-media').append(zoom);}zoom.hidden=productGallery._allImages[productGallery._current]==='__SVG__';
    document.querySelectorAll('#lb-colors-list button,#lb-sizes-list button').forEach(b=>b.style.minHeight='44px');
    if(api.decorateProduct)api.decorateProduct(p,box);
  }
  function openZoom(){const p=productGallery._product,src=C.media(productGallery._allImages[productGallery._current]);if(!src)return;const d=api.dialog('px-zoom',p.name),stage=el('div','px-zoom-stage'),img=el('img');img.src=optimizedImageUrl(src,1800,90);img.alt=p.name;img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label',tx('Toggle detailed zoom','تبديل التكبير'));img.setAttribute('aria-pressed','false');const toggle=()=>{const on=img.classList.toggle('px-zoomed');img.setAttribute('aria-pressed',String(on));};img.onclick=toggle;img.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}};stage.append(img);d.append(stage,el('p','px-checkout-note',tx('Select the image to zoom. Scroll to inspect details.','اضغط على الصورة لتكبيرها، ثم مرّر لرؤية التفاصيل.')));if(d.showModal)d.showModal();}
  let routing=false,initialOpened=false,pendingBack=false,queuedProduct=null;
  function requestedId(){const match=location.pathname.match(/^\/products\/([\w-]+)\/?$/);return match?match[1]:new URLSearchParams(location.search).get('product');}
  function openInitial(){if(initialOpened||!collectionApp._products.length)return;initialOpened=true;const id=requestedId();if(!id)return;const p=collectionApp._products.find(p=>p.id===id&&!p.hidden);if(p){routing=true;productGallery.open(p);routing=false;const entry=q('#px-server-product');if(entry)entry.hidden=true;}}
  const originalOpen=productGallery.open;
  productGallery.open=function(p){if(!p||p.hidden)return;if(pendingBack){queuedProduct=p;return;}const previous=q('#product-lightbox.open')?this._previousFocus:null;originalOpen.call(this,p);if(previous)this._previousFocus=previous;detail();if(!routing){const url=path(p);if(location.pathname!==url)history[history.state&&history.state.pxProduct?'replaceState':'pushState']({pxProduct:true},'',url);}if(window.PrintXMeta&&window.PrintXMeta.viewContent)window.PrintXMeta.viewContent(p);};
  const originalClose=productGallery.close;
  productGallery.close=function(){originalClose.call(this);if(!routing&&requestedId()){if(history.state&&history.state.pxProduct){pendingBack=true;history.back();}else history.replaceState(null,'','/');}};
  window.addEventListener('popstate',()=>{routing=true;const p=collectionApp._products.find(p=>p.id===requestedId()&&!p.hidden);pendingBack=false;if(p)productGallery.open(p);else if(q('#product-lightbox.open'))originalClose.call(productGallery);routing=false;if(queuedProduct){const next=queuedProduct;queuedProduct=null;productGallery.open(next);}});
  hook(productGallery,'selectSize',()=>{const bar=q('#px-purchase-bar strong');if(bar)bar.textContent=money(C.price(productGallery._product,productGallery._selectedSizeIndex));if(api.updateProductDelivery)api.updateProductDelivery();});
  hook(productGallery,'select',()=>{const b=q('#px-zoom-open');if(b)b.hidden=productGallery._allImages[productGallery._current]==='__SVG__';});
  let touch;
  q('#lb-main').addEventListener('touchstart',e=>{if(e.touches.length===1)touch={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});
  q('#lb-main').addEventListener('touchend',e=>{if(!touch)return;const dx=e.changedTouches[0].clientX-touch.x,dy=e.changedTouches[0].clientY-touch.y;touch=null;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5){if(dx<0)productGallery.next();else productGallery.previous();}},{passive:true});
  document.addEventListener('keydown',e=>{if(q('dialog[open]'))return;if(e.key!=='Tab'||!q('#product-lightbox.open'))return;const nodes=[...q('#product-lightbox').querySelectorAll('button:not([disabled]),a[href],select,[tabindex="0"]')].filter(n=>n.getClientRects().length);const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
  document.addEventListener('keydown',e=>{if(q('dialog[open]')&&['Escape','ArrowLeft','ArrowRight'].includes(e.key))e.stopImmediatePropagation();},true);
  window.addEventListener('storage',e=>{if(e.key==='printx-saved-v1'){try{saved=C.savedIds(JSON.parse(e.newValue||'[]'));}catch(_){saved=[];}syncSaveButtons();}});
  const pause=button(tx('Pause slideshow','إيقاف العرض'),'px-text-button',()=>{window.PrintXHeroPaused=!window.PrintXHeroPaused;pause.textContent=window.PrintXHeroPaused?tx('Play slideshow','تشغيل العرض'):tx('Pause slideshow','إيقاف العرض');pause.setAttribute('aria-pressed',String(!!window.PrintXHeroPaused));});
  pause.id='px-hero-pause';pause.setAttribute('aria-pressed','false');q('#hero-slider').append(pause);
  document.body.classList.add('px-enhanced');
  updateCopy();api.ready=true;
}());
