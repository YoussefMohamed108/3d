/* ES5 enhancement only. The original heroSlider remains the source of slides,
   navigation, admin refreshes, and autoplay. No storefront data is copied here. */
(function () {
  'use strict';
  function init() {
    var slider = document.getElementById('hero-slider');
    var slides = document.getElementById('hero-slides');
    var previous = document.getElementById('slider-prev');
    var next = document.getElementById('slider-next');
    var counter;
    var touch;
    if (!slider || !slides || !previous || !next || slider.querySelector('.simple-hero-count')) return;
    counter = document.createElement('span');
    counter.className = 'simple-hero-count';
    counter.setAttribute('aria-live', 'polite');
    counter.setAttribute('aria-atomic', 'true');
    slider.appendChild(counter);
    function update() {
      var images = slides.querySelectorAll('.hero-slide');
      var i;
      for (i = 0; i < images.length; i += 1) {
        if (/(^|\s)active(\s|$)/.test(images[i].className)) {
          counter.textContent = (i + 1) + ' / ' + images.length;
          return;
        }
      }
      counter.textContent = '—';
    }
    if (window.MutationObserver) new MutationObserver(update).observe(slides, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    else window.setInterval(update, 1000);
    slider.addEventListener('keydown', function (event) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      var forward = event.key === 'ArrowRight';
      if (document.documentElement.dir === 'rtl') forward = !forward;
      (forward ? next : previous).click();
    });
    slides.addEventListener('touchstart', function (event) {
      touch = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
    }, { passive: true });
    slides.addEventListener('touchend', function (event) {
      if (!touch || !event.changedTouches.length) return;
      var dx = event.changedTouches[0].clientX - touch.x;
      var dy = event.changedTouches[0].clientY - touch.y;
      touch = null;
      if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) return;
      var forward = dx < 0;
      if (document.documentElement.dir === 'rtl') forward = !forward;
      (forward ? next : previous).click();
    }, { passive: true });
    slides.addEventListener('touchcancel', function () { touch = null; }, { passive: true });
    update();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
