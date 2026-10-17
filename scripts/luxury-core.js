/* Shared, dependency-free merchandising rules. Also used by server product pages. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PrintXLuxuryCore = factory();
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  function price(p, sizeIndex) {
    var s = p.sizes && p.sizes[sizeIndex];
    if (s && s.price !== '' && isFinite(Number(s.price))) return Number(s.price);
    var base = Number(p.price), sale = Number(p.sale_price);
    return sale > 0 && sale < base ? sale : base;
  }
  function categories(p) {
    if (Array.isArray(p.categories)) return p.categories.filter(function(c) { return typeof c === 'string'; });
    return p.category ? [p.category] : [];
  }
  function selected(products, ids) {
    var visible = products.filter(function(p) { return !p.hidden; });
    var choices = savedIds(ids).map(function(id) { return visible.find(function(p) { return p.id === id; }); }).filter(Boolean);
    if (choices.length) return choices.slice(0, 4);
    return visible.slice().sort(function(a,b) {
      return Number(String(b.badge).toLowerCase() === 'hot') - Number(String(a.badge).toLowerCase() === 'hot') || (Number(a.sort_order)||0) - (Number(b.sort_order)||0);
    }).slice(0,4);
  }
  function related(product, products) {
    var cats = categories(product);
    return products.filter(function(p) {
      return !p.hidden && p.id !== product.id && categories(p).some(function(c) { return cats.indexOf(c) >= 0; });
    }).slice(0,3);
  }
  function savedIds(ids) {
    return (Array.isArray(ids) ? ids : []).filter(function(id, i, a) {
      return typeof id === 'string' && id.length > 0 && id.length <= 100 && a.indexOf(id) === i;
    }).slice(0,100);
  }
  function media(value) {
    if (typeof value !== 'string' || value.length > 2000 || /[\s<>"'\\]/.test(value)) return '';
    if (/^\/(?!\/)/.test(value)) return value;
    try {
      var u = new URL(value);
      if (u.protocol !== 'https:' || u.username || u.password) return '';
      if ((u.hostname === 'ik.imagekit.io' && u.pathname.indexOf('/bxk734nq4h/') === 0) ||
          u.hostname === 'dqdsgckzwiknmldhwjnw.supabase.co' || u.hostname === 'printx-eg.com') return u.href;
    } catch (_) {}
    return '';
  }
  function text(value, max) { return typeof value === 'string' ? value.slice(0,max || 2000) : ''; }
  function config(value) {
    function record(v) { return v && typeof v === 'object' && !Array.isArray(v); }
    if (!record(value)) value = {};
    var products = {};
    if (record(value.products)) Object.keys(value.products).forEach(function(id) {
      if (id !== '__proto__' && id !== 'constructor' && record(value.products[id])) products[id] = value.products[id];
    });
    return {products:products, featured:savedIds(value.featured),
      hero:record(value.hero) ? value.hero : {}, studio:record(value.studio) ? value.studio : {},
      reviews:Array.isArray(value.reviews) ? value.reviews.filter(record).slice(0,30) : []};
  }
  return {price:price,categories:categories,selected:selected,related:related,savedIds:savedIds,media:media,text:text,config:config};
}));
