/* Deterministic browser fixtures. All remote reads/writes are intercepted. */
const fs=require('node:fs');
const path=require('node:path');
const products=Array.from({length:5},(_,i)=>({
 id:`aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${i}`,name:['The Collector','The Sculptural Pair','Studio Figure','Desk Companion','Hidden fixture'][i],
 description:'A detailed display piece from the PrintX collection.',price:900,sale_price:null,
 image_url:'/1.jpeg',gallery_urls:['/2.jpeg'],categories:['Figures'],category:'Figures',hidden:i===4,sort_order:i,badge:i===0?'Hot':'',
 colors:[{name:'Ivory',hex:'#eee7dc'},{name:'Navy',hex:'#162b3b'}],sizes:[{name:'Small',price:900},{name:'Large',price:1400}],created_at:'2026-01-01T00:00:00Z'
}));
async function install(page){
 const sdk=fs.readFileSync(process.env.PRINTX_TEST_SDK,'utf8');
 if(page.routeWebSocket)await page.routeWebSocket(/supabase\.co/,ws=>ws.close());
 await page.route('**/*',async route=>{
  const r=route.request(),u=new URL(r.url());
  if(u.hostname==='127.0.0.1'||u.hostname==='localhost')return route.continue();
  const json=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  if(u.hostname==='cdn.jsdelivr.net')return route.fulfill({contentType:'text/javascript',body:sdk});
  if(u.pathname.includes('/rest/v1/products'))return json(products);
  if(u.pathname.includes('/rest/v1/categories'))return json([{id:'figures',name:'Figures',sort_order:0},{id:'custom',name:'Custom',sort_order:1}]);
  if(u.pathname.includes('/rest/v1/hero_slides'))return json([{id:1,url:'/1.jpeg',sort_order:0},{id:2,url:'/2.jpeg',sort_order:1}]);
  if(u.pathname.includes('/rest/v1/settings')){
   if(u.search.includes('luxury_content'))return json(null);
   const keys=['cairo','giza','alexandria','dakahlia','red_sea','beheira','fayoum','gharbia','ismailia','monufia','minya','qalyubia','new_valley','suez','aswan','assiut','beni_suef','port_said','damietta','sharqia','south_sinai','kafr_el_sheikh','matrouh','luxor','qena','north_sinai','sohag'];
   return json(keys.map(k=>({key:'delivery_'+k,value:'75'})));
  }
  if(u.pathname.includes('validate_voucher'))return json({code:'FIRSTORDER',discount_type:'percent',discount_value:15});
  if(u.pathname.includes('create-order'))return json({order:{id:'local-design-smoke',total:1234,delivery_fee:75,discount_amount:135}});
  if(u.pathname.includes('create-custom-order'))return json({});
  if(u.hostname==='ik.imagekit.io'||u.hostname.endsWith('.supabase.co')&&u.pathname.includes('/storage/'))return route.fulfill({contentType:'image/jpeg',body:fs.readFileSync(path.join(__dirname,'../1.jpeg'))});
  return route.fulfill({status:200,body:''});
 });
}
module.exports={install,products};
