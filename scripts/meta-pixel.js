/* Meta base pixel: one public storefront PageView, without automatic form events. */
(function (window, document) {
  'use strict';

  var pixelId = '1404442528337355';
  var location = window.location;
  if (window.__printxMetaPixelInitialized || location.protocol !== 'https:' ||
      !/^(?:www\.)?printx-eg\.com$/i.test(location.hostname) ||
      !/^\/(?:index\.html)?$/.test(location.pathname)) return;

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
}(window, document));
