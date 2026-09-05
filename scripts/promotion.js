(() => {
  const seenKey = 'printx-firstorder-promo-v1';
  const bar = document.querySelector('.store-announcement');
  if (!bar) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'store-promotion';
  dialog.setAttribute('aria-labelledby', 'promotion-title');
  dialog.innerHTML = `<form method="dialog"><button class="promotion-close" value="close" aria-label="Close offer">×</button></form>
    <p class="promotion-eyebrow"></p><h2 id="promotion-title"></h2>
    <p class="promotion-description"></p>
    <button type="button" class="promotion-code"><strong dir="ltr">FIRSTORDER</strong><span></span></button>
    <p class="promotion-copy-status" role="status"></p>
    <div class="promotion-shipping"><strong></strong><p></p></div>
    <button type="button" class="promotion-shop"></button>`;
  document.body.append(dialog);
  let previousFocus;
  const arabic = () => document.documentElement.lang === 'ar';
  function remember() { try { sessionStorage.setItem(seenKey, 'seen'); } catch {} }
  function open() {
    if (dialog.open) return;
    previousFocus = document.activeElement;
    dialog.showModal();
    remember();
  }
  function translate() {
    const ar = arabic();
    bar.innerHTML = `<button type="button" class="promotion-bar-button"><strong>${ar ? 'خصم ١٥٪' : '15% OFF'}</strong> <b dir="ltr">FIRSTORDER</b><span class="promotion-bar-shipping">${ar ? 'شحن مجاني من ١٬٠٠٠ جنيه' : 'Free shipping from EGP 1,000'}</span><span aria-hidden="true">${ar ? '←' : '→'}</span></button>`;
    bar.querySelector('button').addEventListener('click', open);
    dialog.querySelector('.promotion-close').setAttribute('aria-label', ar ? 'إغلاق العرض' : 'Close offer');
    dialog.querySelector('.promotion-eyebrow').textContent = ar ? 'عرض بيرنت إكس' : 'A little welcome from PrintX';
    dialog.querySelector('h2').textContent = ar ? 'قطعتك القادمة. بخصم ١٥٪.' : 'Save 15% on your first order';
    dialog.querySelector('.promotion-description').textContent = ar ? 'استخدم كود FIRSTORDER عند الدفع لتحصل على خصم ١٥٪.' : 'Enter FIRSTORDER at checkout for 15% off.';
    dialog.querySelector('.promotion-code span').textContent = ar ? 'نسخ الكود' : 'Copy code';
    dialog.querySelector('.promotion-copy-status').textContent = '';
    dialog.querySelector('.promotion-shipping strong').textContent = ar ? 'شحن مجاني من ١٬٠٠٠ جنيه' : 'Free shipping from EGP 1,000';
    dialog.querySelector('.promotion-shipping p').textContent = ar ? 'على إجمالي المنتجات قبل تطبيق الخصم.' : 'Based on your product subtotal before discounts.';
    dialog.querySelector('.promotion-shop').textContent = ar ? 'تسوق التماثيل' : 'Find your next figure';
    updateOffset();
  }
  function updateOffset() {
    const offset = Math.max(0, bar.getBoundingClientRect().bottom);
    document.documentElement.style.setProperty('--promotion-nav-offset', `${offset}px`);
  }
  dialog.querySelector('.promotion-code').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText('FIRSTORDER');
      dialog.querySelector('.promotion-copy-status').textContent = arabic() ? 'تم النسخ! أدخل الكود عند الدفع.' : 'Copied! Enter the code at checkout.';
    } catch {
      dialog.querySelector('.promotion-copy-status').textContent = arabic() ? 'انسخ الكود يدوياً: FIRSTORDER' : 'Copy this code manually: FIRSTORDER';
    }
  });
  dialog.querySelector('.promotion-shop').addEventListener('click', () => {
    dialog.close();
    document.getElementById('shop')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
  dialog.addEventListener('close', () => { remember(); previousFocus?.focus({ preventScroll: true }); });
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  new MutationObserver(translate).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  new ResizeObserver(updateOffset).observe(bar);
  window.addEventListener('scroll', updateOffset, { passive: true });
  translate();
  setTimeout(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(seenKey) === 'seen'; } catch {}
    // Avoid interrupting checkout, authentication, or a product already opened.
    const busy = document.querySelector('dialog[open], #product-lightbox.open, #cart-panel.open, #admin-panel.open, .modal-overlay.open, .overlay.open, .mobile-menu.open') || document.body.style.overflow === 'hidden';
    if (!seen && !busy && !document.hidden) open();
  }, 1800);
})();
