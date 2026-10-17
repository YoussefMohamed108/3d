/* Optional, public editorial content. Only an authenticated administrator may save it. */
(function () {
  'use strict';
  const A=window.PrintXLuxury;if(!A)return;
  const {C,q,tx,el,button}=A, key='luxury_content_v1';
  let originalValue=null,loaded=false;
  const fields=[['dimensions','Dimensions'],['material','Material'],['finish','Finish'],['included','What is included'],['care','Care instructions'],['fulfilment','Availability / production status'],['delivery','Delivery estimate']];
  function localized(object,name){return C.text(object[A.ar()?name+'_ar':name]||object[name],4000);}
  A.renderStory=function(){
    let section=q('#px-studio-story');if(section)section.remove();
    const studio=A.config.studio||{}, image=C.media(studio.image), body=localized(studio,'body');
    if(body||image||C.media(studio.video)) {
      section=el('section','px-section');section.id='px-studio-story';const grid=el('div','px-story-grid'),copy=el('div');
      copy.append(el('p','px-eyebrow',tx('Inside PrintX','داخل PrintX')),el('h2','px-heading',localized(studio,'title')||tx('From our studio to your space.','من الاستوديو إلى مساحتك.')));
      if(body)copy.append(el('p','px-story-copy',body));
      const founder=localized(studio,'founder');if(founder)copy.append(el('p','px-story-copy',founder));
      const gift=localized(studio,'gifting');if(gift)copy.append(el('p','px-story-copy',gift));
      grid.append(copy);
      const video=C.media(studio.video);
      if(video&&video.startsWith('/')) {const v=el('video');v.src=video;v.controls=true;v.preload='none';v.playsInline=true;if(image)v.poster=image;grid.append(v);}
      else if(image){const img=el('img');img.src=image;img.alt=localized(studio,'imageAlt')||tx('The PrintX studio','استوديو PrintX');img.loading='lazy';img.decoding='async';grid.append(img);}
      section.append(grid);q('#custom').before(section);
    }
    let reviews=q('#px-customer-stories');if(reviews)reviews.remove();
    const visible=A.config.reviews.filter(r=>r&&r.approved===true&&localized(r,'quote')&&C.text(r.name)&&(!r.productId||collectionApp._products.some(p=>!p.hidden&&p.id===r.productId)));
    if(visible.length){reviews=el('section','px-section');reviews.id='px-customer-stories';reviews.append(el('p','px-eyebrow',tx('Collector stories','قصص العملاء')),el('h2','px-heading',tx('At home in your collection.','مكانها وسط مجموعتك.')));const grid=el('div','px-reviews');visible.slice(0,6).forEach(r=>{const b=el('blockquote');if(C.media(r.image)){const img=el('img');img.src=C.media(r.image);img.alt=tx('Customer photograph shared by ','صورة من العميل ')+C.text(r.name,80);img.loading='lazy';b.append(img);}b.append(el('p','',localized(r,'quote')),el('cite','',C.text(r.name,80)));grid.append(b);});reviews.append(grid);q('#custom').before(reviews);}
  };
  A.decorateProduct=function(p,box){
    const m=A.config.products[p.id]||{};
    if(C.media(m.packaging_image)){const section=el('div','px-extra');section.append(el('h3','',tx('How it arrives','كيف تصلك القطعة')));const img=el('img');img.src=C.media(m.packaging_image);img.alt=tx('Packaging for ','تغليف ')+p.name;img.loading='lazy';img.style.width='100%';section.append(img);box.append(section);}
    const frames=(Array.isArray(m.spin)?m.spin:[]).map(C.media).filter(Boolean).slice(0,72);
    if(frames.length>=8)box.append(button(tx('Explore in 360°','شاهد بزاوية ٣٦٠°'),'px-button px-secondary',()=>{
      const d=A.dialog('px-spin',p.name+' · 360°'),img=el('img'),label=el('label','',tx('Rotate the piece','أدر القطعة')),range=el('input'),count=el('p','px-checkout-note');
      img.alt=p.name;img.style.cssText='display:block;width:100%;height:55vh;object-fit:contain';range.type='range';range.min=0;range.max=frames.length-1;range.value=0;range.id='px-spin-range';label.htmlFor=range.id;range.style.width='100%';
      const update=()=>{img.src=optimizedImageUrl(frames[Number(range.value)],960);count.textContent=(Number(range.value)+1)+' / '+frames.length;};range.addEventListener('input',update);update();
      d.append(img,label,range,count);if(d.showModal)d.showModal();
    }));
    const feedback=A.config.reviews.filter(r=>r&&r.approved===true&&r.productId===p.id&&localized(r,'quote'));
    if(feedback.length){const section=el('div','px-extra');section.append(el('h3','',tx('From collectors','آراء العملاء')));feedback.slice(0,3).forEach(r=>{const quote=el('blockquote');quote.append(el('p','',localized(r,'quote')),el('cite','',C.text(r.name,80)));section.append(quote);});box.append(section);}
  };
  function input(label,value,type='text'){const l=el('label','',label),i=el(type==='textarea'?'textarea':'input');if(type!=='textarea')i.type=type;i.value=C.text(value,4000);l.append(i);return {label:l,input:i};}
  function editor(){
    let draft=C.config(JSON.parse(JSON.stringify(A.config)));
    const panel=q('#admin-page-settings');if(!panel||q('#px-content-editor'))return;
    const d=el('details','px-editor');d.id='px-content-editor';d.append(el('summary','', 'Collector storefront content'));
    d.append(el('p','', 'Public content only. Add accurate specifications and real media. Leave unavailable information blank. Product covers, galleries, colors and sizes remain in Products.'));
    const status=el('p','px-editor-status');status.setAttribute('role','status');d.append(status);
    const productSelect=el('select');productSelect.setAttribute('aria-label','Choose a product for specifications');
    const grid=el('div','px-editor-grid'), controls={};
    fields.forEach(([name,label])=>['','_ar'].forEach(suffix=>{const f=input(label+(suffix?' — العربية':' — English'),'','textarea');controls[name+suffix]=f.input;grid.append(f.label);}));
    const packageImage=input('Packaging photograph URL (optional)','','url');controls.packaging_image=packageImage.input;grid.append(packageImage.label);
    const spin=input('360° image URLs, one per line (optional)','','textarea');controls.spin=spin.input;grid.append(spin.label);
    let activeId=null;
    function storeProduct(){if(!activeId)return;const m={...(draft.products[activeId]||{})};Object.keys(controls).forEach(k=>{m[k]=k==='spin'?controls[k].value.split('\n').map(s=>s.trim()).filter(Boolean):controls[k].value.trim();});draft.products[activeId]=m;}
    function showProduct(){activeId=productSelect.value;const m=draft.products[activeId]||{};Object.keys(controls).forEach(k=>controls[k].value=k==='spin'?(Array.isArray(m[k])?m[k].join('\n'):''):C.text(m[k],4000));}
    productSelect.onchange=()=>{storeProduct();showProduct();};d.append(el('h3','', 'Product details'),productSelect,grid);
    const featured=el('div','px-editor-grid');d.append(el('h3','', 'Selected by PrintX — choose up to four pieces'),featured);
    const hero=el('div','px-editor-grid');d.append(el('h3','', 'Connect hero images to products'),hero);
    const studioGrid=el('div','px-editor-grid'),studioControls={};
    [['title','Studio heading'],['body','Studio story'],['founder','Founder introduction'],['gifting','Available gift services'],['imageAlt','Image description']].forEach(([name,label])=>['','_ar'].forEach(s=>{const f=input(label+(s?' — العربية':' — English'),(draft.studio||{})[name+s],'textarea');studioControls[name+s]=f.input;studioGrid.append(f.label);}));
    [['image','Studio / craftsmanship image URL'],['video','Craftsmanship video path (e.g. /media/studio.mp4)']].forEach(([k,label])=>{const f=input(label,(draft.studio||{})[k]);studioControls[k]=f.input;studioGrid.append(f.label);});
    d.append(el('h3','', 'Studio and gifting'),studioGrid);
    const reviews=el('div');const reviewControls=[];
    function addReview(value={}){if(reviewControls.length>=30)return;const row=el('div','px-editor-grid'),record={row};[['name','Customer display name'],['quote','Actual feedback — English'],['quote_ar','Actual feedback — العربية'],['image','Customer photograph URL'],['productId','Product ID (optional)']].forEach(([k,label])=>{const f=input(label,value[k],k.startsWith('quote')?'textarea':'text');record[k]=f.input;row.append(f.label);});const approved=el('label','', 'I have permission to publish this genuine customer feedback');record.approved=el('input');record.approved.type='checkbox';record.approved.checked=value.approved===true;approved.prepend(record.approved);row.append(approved,button('Remove feedback','px-text-button',()=>{row.remove();reviewControls.splice(reviewControls.indexOf(record),1);}));reviewControls.push(record);reviews.append(row);}
    d.append(el('h3','', 'Customer feedback'),reviews,button('Add customer feedback','px-button px-secondary',()=>addReview()));
    function populate(){
      draft=C.config(JSON.parse(JSON.stringify(A.config)));
      productSelect.replaceChildren();collectionApp._products.forEach(p=>productSelect.append(new Option(p.name,p.id)));showProduct();
      featured.replaceChildren();collectionApp._products.forEach(p=>{const l=el('label','',p.name),c=el('input');c.type='checkbox';c.value=p.id;c.checked=draft.featured.includes(p.id);l.prepend(c);featured.append(l);});
      hero.replaceChildren();[...q('#hero-slides').querySelectorAll('img')].forEach(img=>{let u;try{u=new URL(img.dataset.src||img.src,location.href);u.searchParams.delete('tr');}catch(_){return;}const l=el('label','',decodeURIComponent(u.pathname.split('/').pop())),s=el('select');s.dataset.image=u.href;s.append(new Option('No product linked',''));collectionApp._products.forEach(p=>s.append(new Option(p.name,p.id)));s.value=draft.hero[u.href]||'';l.append(s);hero.append(l);});
      Object.keys(studioControls).forEach(k=>studioControls[k].value=C.text((draft.studio||{})[k],4000));
      reviews.replaceChildren();reviewControls.length=0;draft.reviews.forEach(addReview);
    }
    d.addEventListener('toggle',()=>{if(d.open&&!d.dataset.loaded&&loaded){populate();d.dataset.loaded='true';}});
    const save=button('Save storefront content','px-button',async()=>{
      save.disabled=true;status.textContent='Saving…';
      try{
        const session=await Store.getSession(),profile=session&&await Store.getProfile(session.user.id);if(!profile||profile.role!=='admin')throw new Error('Administrator access is required.');
        if(!loaded)throw new Error('Content has not loaded. Please reopen the page.');
        storeProduct();const ids=[...featured.querySelectorAll('input:checked')].map(i=>i.value);if(ids.length>4)throw new Error('Choose no more than four featured products.');
        draft.featured=ids;draft.hero={};hero.querySelectorAll('select').forEach(s=>{if(s.value)draft.hero[s.dataset.image]=s.value;});
        draft.studio={};Object.keys(studioControls).forEach(k=>draft.studio[k]=studioControls[k].value.trim());
        for(const [k,v] of Object.entries(draft.studio)){if((k==='image'||k==='video')&&v&&!C.media(v))throw new Error('Use your ImageKit, Supabase or site URL for media.');}
        if(draft.studio.video&&!draft.studio.video.startsWith('/'))throw new Error('Video must be hosted on this site, e.g. /media/studio.mp4.');
        for(const m of Object.values(draft.products)){if(m.packaging_image&&!C.media(m.packaging_image))throw new Error('Invalid packaging image URL.');if(Array.isArray(m.spin)&&m.spin.some(u=>!C.media(u)))throw new Error('Invalid 360° image URL.');}
        draft.reviews=reviewControls.map(r=>{const value={approved:r.approved.checked};['name','quote','quote_ar','image','productId'].forEach(k=>value[k]=r[k].value.trim());if(value.image&&!C.media(value.image))throw new Error('Invalid customer photo URL.');return value;});
        const value=JSON.stringify(draft);if(value.length>100000)throw new Error('Content is too large. Please shorten the text.');
        const result=originalValue===null?await _sb.from('settings').insert({key,value}).select('key'):await _sb.from('settings').update({value}).eq('key',key).eq('value',originalValue).select('key');
        if(result.error)throw result.error;if(!result.data||!result.data.length)throw new Error('Another administrator changed this content. Reload before saving.');
        originalValue=value;A.config=C.config(JSON.parse(value));status.textContent='Saved. Public storefront content updated.';A.refresh();collectionApp._renderMainGrid();
      }catch(e){status.textContent=e.message||'Could not save content.';}finally{save.disabled=false;}
    });d.append(save);panel.append(d);
  }
  A.hook(adminApp,'showPage',name=>{if(name==='settings')editor();});
  A.hook(authApp,'_renderMenu',(user,profile)=>{if(profile&&profile.role==='admin')editor();});
  (async()=>{try{const {data,error}=await _sb.from('settings').select('value').eq('key',key).maybeSingle();if(error)throw error;originalValue=data?data.value:null;A.config=C.config(originalValue?JSON.parse(originalValue):{});loaded=true;A.refresh();const d=q('#px-content-editor');if(d&&d.open)d.dispatchEvent(new Event('toggle'));}catch(_){loaded=false;/* Existing store continues when optional content is unavailable. */}})();
}());
