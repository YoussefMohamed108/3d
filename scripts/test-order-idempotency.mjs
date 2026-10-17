import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const file=new URL('../supabase/functions/create-order/idempotency.mjs',import.meta.url);
const api=fs.existsSync(file)?await import(file):{};
test('request fingerprint is stable and changes with order details',async()=>{
 assert.equal(typeof api.fingerprint,'function');
 const a={items:[{id:'a',qty:1}],buyerName:'Test',buyerPhone:'01234567890',paymentMethod:'cod'};
 assert.equal(await api.fingerprint(a),await api.fingerprint({...a,requestKey:'ignored'}));
 assert.notEqual(await api.fingerprint(a),await api.fingerprint({...a,items:[{id:'a',qty:2}]}));
});
test('same-key replay returns receipt fields only; changed payload conflicts',()=>{
 assert.equal(typeof api.replay,'function');
 const order={id:'123',request_hash:'abc',total:123,status:'pending',buyer_phone:'private',items:[]};
 assert.equal(api.replay(order,'abc').order.total,123);
 assert.equal(api.replay(order,'changed').status,409);
 assert.equal(JSON.stringify(api.replay(order,'abc')).includes('private'),false);
 assert.equal(api.replay(null,'abc'),null);
});

// Execute the actual handler with a local Supabase double; no network or real database.
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
async function handlerFixture(){
 const source=fs.readFileSync(new URL('../supabase/functions/create-order/index.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 const orders=new Map();let inserts=0,handler;
 const product={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Fixture',price:900,sizes:[],colors:[]};
 const admin={rpc:async()=>({data:true}),from(table){let inserted,filters={};const builder={select(){return this;},eq(k,v){filters[k]=v;return this;},in(){return this;},insert(row){inserted=row;return this;},async maybeSingle(){return {data:table==='orders'?orders.get(filters.request_key)||null:table==='settings'?{value:'75'}:null};},async single(){inserts++;if(inserted.request_key&&orders.has(inserted.request_key))return {error:{code:'23505'}};const order={...inserted,id:'saved-order',status:'pending'};if(inserted.request_key)orders.set(inserted.request_key,order);return {data:order};},then(resolve){return Promise.resolve({data:[product]}).then(resolve);}};return builder;}};
 const context={Request,Response,TextEncoder,Headers,crypto,console,Set,Map,fingerprint:api.fingerprint,replay:api.replay,receipt:api.receipt,createClient:()=>admin,Deno:{env:{get:k=>k.startsWith('SUPABASE_')?'local-only':undefined},serve:fn=>handler=fn}};
 vm.runInNewContext(stripTypeScriptTypes(source),context);
 const body={items:[{id:product.id,qty:1}],buyerName:'Local QA',buyerPhone:'01000000000',buyerAddress:'Local test address',buyerCity:'Cairo',buyerGovernorate:'cairo',paymentMethod:'cod',requestKey:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'};
 const send=async value=>{const r=await handler(new Request('https://local.test',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)}));return {status:r.status,body:await r.json()};};
 return {body,send,orders,get inserts(){return inserts;}};
}
test('handler rejects non-object JSON without crashing',async()=>{
 const f=await handlerFixture();for(const body of [null,[],42])assert.equal((await f.send(body)).status,400);
});
test('simultaneous retries return one saved order and server-authoritative prices',async()=>{
 const f=await handlerFixture();const results=await Promise.all([f.send(f.body),f.send(f.body)]);
 assert.deepEqual(results.map(r=>r.status),[200,200]);assert.equal(f.orders.size,1);
 for(const r of results){assert.equal(r.body.order.total,975);assert.equal(r.body.order.delivery_fee,75);assert.equal(r.body.order.buyer_phone,undefined);}
 const prior=f.inserts;assert.equal((await f.send(f.body)).status,200);assert.equal(f.inserts,prior);
 assert.equal((await f.send({...f.body,items:[{...f.body.items[0],qty:2}]})).status,409);
});
test('legacy clients can still submit without a request reference',async()=>{
 const f=await handlerFixture();const {requestKey,...body}=f.body;assert.equal((await f.send(body)).status,200);
});
