const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const file=require('node:path').join(__dirname,'../server/catalog.cjs');
const catalog=fs.existsSync(file)?require(file):{};
test('product rendering escapes content, emits canonical data and real size prices',()=>{
 assert.equal(typeof catalog.renderProduct,'function');
 const shell='<html><head><title>PrintX</title><link rel="canonical" href="https://printx-eg.com/" /></head><body><section id="hero"></section></body></html>';
 const p={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'<img onerror=alert(1)>',description:'</script><script>alert(1)</script>',price:900,sizes:[{name:'Small',price:500},{name:'Large',price:1200}]};
 const html=catalog.renderProduct(shell,p,{});
 assert.ok(html.includes('https://printx-eg.com/products/'+p.id));
 assert.ok(html.includes('&lt;img onerror=alert(1)&gt;'));
 assert.ok(!html.includes('</script><script>alert(1)</script>'));
 assert.match(html,/"lowPrice":500/);assert.match(html,/"highPrice":1200/);
 assert.match(html,/<base href="\/">/);
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
 const route=routes.find(r=>r.destination==='/api/sitemap');
 assert.ok(route);assert.equal(fs.existsSync(root+route.source),false,'static files take precedence over Vercel rewrites');
 assert.ok(fs.readFileSync(root+'/robots.txt','utf8').includes('Sitemap: https://printx-eg.com'+route.source));
});
