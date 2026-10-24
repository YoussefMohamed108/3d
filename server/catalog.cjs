'use strict';
const core=require('../scripts/luxury-core.js');
const origin='https://dqdsgckzwiknmldhwjnw.supabase.co';
// Public publishable key, identical to the browser store. Never use a service-role key here.
const publicKey='sb_publishable_UI_WZCeYhmxu7zel6AlNKg_JMZeiYGH';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const escape=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function read(path,fetcher=fetch){const r=await fetcher(origin+'/rest/v1/'+path,{headers:{apikey:publicKey,Authorization:'Bearer '+publicKey},signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error('Catalog unavailable');return r.json();}
async function readProducts(id,fetcher=fetch){if(id&&!uuid.test(id))return [];const rows=[];for(let offset=0;;offset+=1000){const batch=await read('products?select=id,name,description,price,sale_price,sizes,image_url,gallery_urls,hidden&hidden=eq.false'+(id?'&id=eq.'+id:'&order=id&limit=1000&offset='+offset),fetcher);if(!Array.isArray(batch))throw new Error('Invalid catalog');rows.push(...batch.filter(p=>!p.hidden));if(id||batch.length<1000)break;}return rows;}
async function readContent(){try{const r=await read('settings?select=value&key=eq.luxury_content_v1');return core.config(r[0]?JSON.parse(r[0].value):{});}catch(_){return core.config({});}}
function renderProduct(shell,p,content){
 if(!p||p.hidden||!uuid.test(p.id))throw new Error('Product unavailable');
 const canonical='https://printx-eg.com'+core.productPath(p), title=p.name+' — PrintX', desc=core.text(p.description,280)||'Discover '+p.name+' from PrintX, made in Egypt.';
 const prices=(Array.isArray(p.sizes)?p.sizes:[]).map(s=>Number(s.price)).filter(n=>Number.isFinite(n)&&n>0);if(!prices.length)prices.push(core.price(p));
 if(prices.some(n=>!Number.isFinite(n)||n<=0))throw new Error('Product price unavailable');
 const images=[p.image_url,...(p.gallery_urls||[])].map(core.media).filter(Boolean).map(u=>new URL(u,'https://printx-eg.com').href);
 const schema={'@context':'https://schema.org','@type':'Product',name:p.name,description:p.description||desc,image:images,sku:p.id,url:canonical,brand:{'@type':'Brand',name:'PrintX'},offers:prices.length>1?{'@type':'AggregateOffer',priceCurrency:'EGP',lowPrice:Math.min(...prices),highPrice:Math.max(...prices),offerCount:prices.length,url:canonical}:{'@type':'Offer',priceCurrency:'EGP',price:prices[0],url:canonical}};
 let html=shell.replace('<head>','<head>\n<base href="/">').replace(/<title>[\s\S]*?<\/title>/,'<title>'+escape(title)+'</title>').replace(/<link rel="canonical"[^>]+>/,'<link rel="canonical" href="'+canonical+'" />');
 for(const [name,value] of [['description',desc],['og:title',title],['og:description',desc],['og:url',canonical],['twitter:title',title],['twitter:description',desc],...(images.length?[['og:image',images[0]],['twitter:image',images[0]]]:[])]){
  const re=new RegExp('<meta (?:name|property)="'+name+'"[^>]*>');html=html.replace(re,'<meta '+(name.startsWith('og:')?'property':'name')+'="'+name+'" content="'+escape(value)+'" />');
 }
 html=html.replace(/<meta property="og:image:width"[^>]*>|<meta property="og:image:height"[^>]*>/g,'');
 html=html.replace('<body ', '<body data-product-id="'+p.id+'" ');
 const m=(content.products||{})[p.id]||{};
 const details=['dimensions','material','finish','included','care','fulfilment'].filter(k=>core.text(m[k])).map(k=>'<div><dt>'+escape(k)+'</dt><dd>'+escape(core.text(m[k]))+'</dd></div>').join('');
 const entry='<section class="px-section" id="px-server-product"><div class="px-story-grid">'+(images[0]?'<img src="'+escape(images[0])+'" alt="'+escape(p.name)+'" fetchpriority="high" />':'')+'<div><p class="px-eyebrow">PrintX collection</p><h1 class="px-heading">'+escape(p.name)+'</h1><p>EGP '+Math.min(...prices).toFixed(2)+(prices.length>1?'–'+Math.max(...prices).toFixed(2):'')+'</p><p class="px-story-copy">'+escape(p.description||'')+'</p><dl class="px-specs">'+details+'</dl><a class="px-button" href="/?product='+p.id+'">Choose options &amp; order</a><p><a href="/">Explore the collection</a></p></div></div></section>';
 html=html.replace('<!-- HERO -->',entry+'\n<!-- HERO -->');
 if(!html.includes('id="px-server-product"'))html=html.replace('<section id="hero">',entry+'<section id="hero">');
 return html.replace('</body>','<script type="application/ld+json">'+JSON.stringify(schema).replace(/</g,'\\u003c')+'</script></body>');
}
function errorPage(status){const missing=status===404;return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>PrintX</title><link rel="stylesheet" href="/luxury-storefront.css"></head><body class="printx-simple" data-storefront-version="collector"><main class="px-section"><p class="px-eyebrow">PrintX</p><h1 class="px-heading">'+(missing?'This piece is unavailable.':'The collection is temporarily unavailable.')+'</h1><a class="px-button" href="/">Explore the collection</a></main></body></html>';}
module.exports={readProducts,readContent,renderProduct,errorPage,uuid,escape,slug:core.slug,productPath:core.productPath};
