/* Meta storefront events. Authentication URLs and form fields are excluded. */
(function (window, document) {
  'use strict';

  var pixelId = '1400841768676484';
  var location = window.location;
  if (window.__printxMetaPixelInitialized || location.protocol !== 'https:' ||
      !/^(?:www\.)?printx-eg\.com$/i.test(location.hostname) ||
      !/^\/(?:index\.html|products\/[a-f0-9-]{36}\/?)?$/i.test(location.pathname)) return;

  /* Confirmation links can land on the homepage before being redirected.
     Never give a third-party script access to authentication callback URLs. */
  var parameters;
  try { parameters = decodeURIComponent(location.search + location.hash); }
  catch (_) { return; }
  if (/(?:^|[?#&])(?:access_token|refresh_token|token_hash|code|error(?:_code|_description)?)=/i.test(parameters) ||
      /(?:^|[?#&])type=(?:signup|email|email_change|recovery|invite|magiclink)(?:&|$)/i.test(parameters)) return;

  var preferences = window.navigator;
  if (preferences.globalPrivacyControl === true || preferences.doNotTrack === '1' ||
      preferences.doNotTrack === 'yes') return;

  /* Meta's standard asynchronous loader. A blocked download cannot hold up the shop. */
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
  (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');

  window.__printxMetaPixelInitialized = true;
  window.fbq('set', 'autoConfig', false, pixelId);
  window.fbq('init', pixelId);
  window.fbq('track', 'PageView');

  var sentPurchases = [];
  var purchaseStorageKey = 'printx-meta-purchases-v1';

  function itemData(items) {
    if (!Array.isArray(items) || !items.length) return null;
    var ids = [], contents = [], count = 0;
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var quantity = Number(item && item.qty);
      if (!item || typeof item.id !== 'string' || !item.id ||
          !isFinite(quantity) || quantity < 1 || Math.floor(quantity) !== quantity) return null;
      var index = ids.indexOf(item.id);
      if (index < 0) {
        ids.push(item.id);
        contents.push({ id: item.id, quantity: quantity });
      } else contents[index].quantity += quantity;
      count += quantity;
    }
    return { content_type: 'product', content_ids: ids, contents: contents, currency: 'EGP', num_items: count };
  }

  function storedPurchases() {
    try {
      var ids = JSON.parse(window.localStorage.getItem(purchaseStorageKey) || '[]');
      return Array.isArray(ids) ? ids : [];
    } catch (_) { return []; }
  }

  window.PrintXMeta = {
    viewContent: function (product) {
      try {
        var data = itemData([{ id: product && product.id, qty: 1 }]);
        var price = Number(product && product.price);
        if (!data || !isFinite(price) || price <= 0) return false;
        data.value = price;
        window.fbq('track', 'ViewContent', data);
        return true;
      } catch (_) { return false; }
    },
    initiateCheckout: function (items) {
      try {
        var data = itemData(items), total = 0;
        if (!data) return false;
        for (var i = 0; i < items.length; i++) {
          var price = Number(items[i].price);
          if (!isFinite(price) || price <= 0) return false;
          total += price * Number(items[i].qty);
        }
        data.value = Math.round(total * 100) / 100;
        window.fbq('track', 'InitiateCheckout', data);
        return true;
      } catch (_) { return false; }
    },
    addToCart: function (item, quantity) {
      try {
        var price = Number(item && item.price);
        var data = itemData([{ id: item && item.id, qty: quantity == null ? 1 : quantity }]);
        if (!data || !isFinite(price) || price <= 0) return false;
        data.contents[0].item_price = price;
        data.value = Math.round(price * data.num_items * 100) / 100;
        window.fbq('track', 'AddToCart', data);
        return true;
      } catch (_) { return false; }
    },
    purchase: function (order, items) {
      try {
        if (!order || typeof order.id !== 'string' || !order.id ||
            order.total == null || order.total === '') return false;
        var total = Number(order.total);
        var data = itemData(items);
        if (!data || !isFinite(total) || total < 0) return false;
        var previous = storedPurchases();
        if (sentPurchases.indexOf(order.id) >= 0 || previous.indexOf(order.id) >= 0) return false;
        data.value = Math.round(total * 100) / 100;
        data.order_id = order.id;
        window.fbq('track', 'Purchase', data, { eventID: 'printx-purchase-' + order.id });
        sentPurchases.push(order.id);
        previous.push(order.id);
        try { window.localStorage.setItem(purchaseStorageKey, JSON.stringify(previous.slice(-100))); }
        catch (_) { /* Memory still prevents repeat events in this page. */ }
        return true;
      } catch (_) { return false; }
    }
  };
}(window, document));
