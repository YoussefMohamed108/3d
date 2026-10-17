const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('a lost-response retry keeps its identity across language changes and preserves only customer notes',async()=>{
 const requests=[],storage=new Map();let locale='Cairo',cart=[];
 const nodes=new Map(['buyer-name','buyer-phone','buyer-address','buyer-city','buyer-governorate','buyer-notes','confirm-order-btn'].map(id=>['#'+id,{value:id==='buyer-governorate'?'cairo':id==='buyer-notes'?'Leave at reception.':'',before(){},focus(){}}]));
 const createNode=()=>({append(){},setAttribute(){}});
 const Store={getCart:()=>cart,getDeliveryPrices:async()=>({cairo:75})};
 const cartApp={checkout(){},_renderReceipt(){},onGovernorateChange(){},async confirmOrder(){return Store.createOrder({items:cart,paymentMethod:'cod',buyerName:'Local QA',buyerPhone:'01000000000',buyerAddress:'Local fixture address',buyerCity:'Cairo',buyerGovernorate:'cairo',buyerNotes:'Leave at reception.\nGovernorate: '+locale});}};
 const window={crypto,PrintXLuxury:{q:s=>nodes.get(s)||null,tx:en=>en,el:createNode,button:createNode,money:String,hook(){}}};
 vm.runInNewContext(fs.readFileSync(new URL('luxury-commerce.js',`file://${__dirname}/`),'utf8'),{window,crypto,TextEncoder,Store,cartApp,document:{querySelectorAll:()=>[]},sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},_sb:{functions:{invoke:async(name,{body})=>{requests.push(body);return {error:new Error('lost response')};}}}});
 cart=[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',qty:1,price:900,selectedSize:{name:'Small'},selectedColor:{name:'Ivory'}}];
 await cartApp.confirmOrder();locale='القاهرة';await cartApp.confirmOrder();
 assert.equal(requests.length,2);assert.equal(requests[0].requestKey,requests[1].requestKey);assert.equal(requests[0].buyerNotes,'Leave at reception.');
 cart[0].qty=2;await cartApp.confirmOrder();assert.notEqual(requests[1].requestKey,requests[2].requestKey);
 assert.equal([...storage.values()].some(v=>v.includes('Leave at reception')||v.includes('01000000000')),false);
});
