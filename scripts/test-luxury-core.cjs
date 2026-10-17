const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, 'luxury-core.js');
const core = fs.existsSync(file) ? require(file) : {};
test('variant prices override base and sale prices', () => {
  assert.equal(typeof core.price, 'function');
  assert.equal(core.price({price:900,sale_price:700,sizes:[{name:'Large',price:1400}]},0),1400);
  assert.equal(core.price({price:900,sale_price:700}),700);
});
test('curation includes only current visible products and honours owner order', () => {
  assert.equal(typeof core.selected, 'function');
  const p=[{id:'a',price:30},{id:'b',hidden:true},{id:'c',badge:'Hot',price:20}];
  assert.deepEqual(core.selected(p,['b','c','a']).map(p=>p.id),['c','a']);
  assert.deepEqual(core.selected(p,[]).map(p=>p.id),['c','a']);
});
test('recommendations exclude current, hidden and unrelated products', () => {
  assert.equal(typeof core.related, 'function');
  const p=[{id:'a',categories:['Figures']},{id:'b',categories:['Figures']},{id:'c',hidden:true,categories:['Figures']},{id:'d',categories:['Keys']}];
  assert.deepEqual(core.related(p[0],p).map(p=>p.id),['b']);
});
test('media allowlist rejects scripts, foreign hosts and protocol-relative URLs', () => {
  assert.equal(typeof core.media, 'function');
  for(const u of ['javascript:alert(1)','//evil.test/a.jpg','https://evil.test/x','data:image/svg+xml,x']) assert.equal(core.media(u),'');
  assert.equal(core.media('https://ik.imagekit.io/bxk734nq4h/a.jpg'),'https://ik.imagekit.io/bxk734nq4h/a.jpg');
  assert.equal(core.media('/studio.mp4'),'/studio.mp4');
});
test('saved IDs are bounded, deduplicated strings', () => {
  assert.equal(typeof core.savedIds,'function');
  assert.deepEqual(core.savedIds(['a','a',null,{},'b']),['a','b']);
  assert.equal(core.savedIds(Array.from({length:300},(_,i)=>String(i))).length,100);
});
test('malformed optional content cannot break the storefront or editor', () => {
 const c=core.config({products:{bad:null,good:{material:'Resin'}},studio:[],hero:[],reviews:[null,42,{name:'Customer'}]});
 assert.deepEqual(c.products,{good:{material:'Resin'}});
 assert.deepEqual(c.reviews,[{name:'Customer'}]);
 assert.deepEqual(c.studio,{});
 assert.deepEqual(c.hero,{});
 assert.deepEqual(core.config(null).studio,{});
});
