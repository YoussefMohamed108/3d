const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const file=require('node:path').join(__dirname,'../server/catalog.cjs');
const catalog=fs.existsSync(file)?require(file):{};
test('product rendering escapes content, emits canonical data and real size prices',()=>{
 assert.equal(typeof catalog.renderProduct,'function');
 const shell='<html><head><title>PrintX</title><link rel="canonical" href="https://printx-eg.com/" /></head><body><section id="hero"></section></body></html>';
 const p={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'<img onerror=alert(1)>',description:'</script><script>alert(1)</script>',price:900,sizes:[{name:'Small',price:500},{name:'Large',price:1200}]};
 const html=catalog.renderProduct(shell,p,{});
 assert.ok(html.includes('https://printx-eg.com/products/img-onerror-alert-1/'+p.id));
 assert.equal(catalog.productPath({name:'Moon Knight',id:p.id}),'/products/moon-knight/'+p.id);
 assert.ok(html.includes('&lt;img onerror=alert(1)&gt;'));
 assert.ok(!html.includes('</script><script>alert(1)</script>'));
 assert.match(html,/"lowPrice":500/);assert.match(html,/"highPrice":1200/);
 assert.match(html,/<base href="\/">/);
});
test('legacy or incorrect product URLs redirect to the canonical slug and keep campaign tags',async()=>{
 const handler=require('../api/product.js');
 const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const originalReadProducts=catalog.readProducts,originalReadContent=catalog.readContent;
 catalog.readProducts=async()=>[{id,name:'Moon Knight',price:900}];
 catalog.readContent=async()=>({});
 const res={headers:{},setHeader(key,value){this.headers[key]=value;},end(body){this.body=body;}};
 try{
  await handler({method:'GET',query:{id,slug:'old-name'},url:'/api/product?id='+id+'&slug=old-name&utm_source=instagram'},res);
  assert.equal(res.statusCode,308);
  assert.equal(res.headers.Location,'/products/moon-knight/'+id+'?utm_source=instagram');
 }finally{catalog.readProducts=originalReadProducts;catalog.readContent=originalReadContent;}
});
test('invalid and hidden products cannot be rendered',()=>{
 assert.equal(typeof catalog.renderProduct,'function');
 assert.throws(()=>catalog.renderProduct('',{id:'bad',hidden:true},{}));
});
test('public catalog requests always filter hidden records and time out',async()=>{
 assert.equal(typeof catalog.readProducts,'function');
 let seen;
 await catalog.readProducts('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',async(url,options)=>{seen={url,options};return {ok:true,json:async()=>[]};});
 assert.match(seen.url,/hidden=eq.false/);assert.ok(seen.options.signal);
});
test('dynamic sitemap is advertised on an unshadowed path',()=>{
 const root=require('node:path').join(__dirname,'..');
 const routes=JSON.parse(fs.readFileSync(root+'/vercel.json','utf8')).rewrites;
 const slugRoute=routes.find(r=>r.source==='/products/:slug/:id');
 const legacyRoute=routes.find(r=>r.source==='/products/:id');
 assert.ok(slugRoute);assert.ok(legacyRoute);
 assert.ok(routes.indexOf(slugRoute)<routes.indexOf(legacyRoute),'readable routes must be checked before legacy ID routes');
 const route=routes.find(r=>r.destination==='/api/sitemap');
 assert.ok(route);assert.equal(fs.existsSync(root+route.source),false,'static files take precedence over Vercel rewrites');
 assert.ok(fs.readFileSync(root+'/robots.txt','utf8').includes('Sitemap: https://printx-eg.com'+route.source));
});
