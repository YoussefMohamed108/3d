(function () {
  'use strict';

  var apiUrl = 'https://dqdsgckzwiknmldhwjnw.supabase.co/rest/v1/products?select=*&order=created_at.asc';
  var apiKey = 'sb_publishable_UI_WZCeYhmxu7zel6AlNKg_JMZeiYGH';

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function imageUrl(url) {
    if (!url) return '';
    if (url.indexOf('https://ik.imagekit.io/bxk734nq4h/') === 0) {
      return url + (url.indexOf('?') === -1 ? '?' : '&') + 'tr=w-640,q-70,c-at_max,f-auto';
    }
    return url;
  }

  function render(products) {
    var grid = document.getElementById('shop-grid');
    var count = document.getElementById('shop-count');
    var cards = [];
    var i;
    var product;
    var price;
    var message;

    if (!grid || grid.querySelector('.product-card')) return;
    for (i = 0; i < products.length && cards.length < 8; i += 1) {
      product = products[i];
      if (product.hidden) continue;
      price = product.sale_price !== null && product.sale_price !== '' ? product.sale_price : product.price;
      message = encodeURIComponent('Hello PrintX, I would like to order ' + (product.name || 'this figure') + '.');
      cards.push(
        '<article class="product-card legacy-product-card">' +
          '<a class="product-media" href="' + escapeHtml(product.image_url || '#shop') + '" target="_blank" rel="noopener" aria-label="View ' + escapeHtml(product.name) + '">' +
            (product.image_url ? '<img src="' + escapeHtml(imageUrl(product.image_url)) + '" alt="' + escapeHtml(product.name) + '" loading="lazy">' : '') +
          '</a>' +
          '<div class="product-info">' +
            '<div class="product-tag">' + escapeHtml(product.class || 'PrintX figure') + '</div>' +
            '<h3 class="product-name">' + escapeHtml(product.name) + '</h3>' +
            '<div class="product-card-meta"><div class="product-price"><strong>EGP ' + escapeHtml(price) + '</strong></div><span class="product-fulfilment">Ready in 3–7 days</span></div>' +
            '<div class="product-card-actions"><a class="product-add legacy-order-link" href="https://wa.me/201125607937?text=' + message + '" target="_blank" rel="noopener">Order on WhatsApp</a></div>' +
          '</div>' +
        '</article>'
      );
    }
    if (!cards.length) return;
    grid.innerHTML = cards.join('');
    grid.setAttribute('aria-busy', 'false');
    if (count) count.innerHTML = cards.length + (cards.length === 1 ? ' figure' : ' figures');
  }

  function loadLegacyCatalog() {
    var grid = document.getElementById('shop-grid');
    var request;
    if (!grid || grid.querySelector('.product-card')) return;
    request = new XMLHttpRequest();
    request.open('GET', apiUrl, true);
    request.setRequestHeader('apikey', apiKey);
    request.setRequestHeader('Authorization', 'Bearer ' + apiKey);
    request.onreadystatechange = function () {
      var data;
      if (request.readyState !== 4 || request.status < 200 || request.status >= 300) return;
      try {
        data = JSON.parse(request.responseText);
        if (Object.prototype.toString.call(data) === '[object Array]') render(data);
      } catch (_) {
        /* Keep the existing catalog status and the rest of the page usable. */
      }
    };
    request.send(null);
  }

  function schedule() {
    window.setTimeout(loadLegacyCatalog, 2800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, false);
  else schedule();
}());

