/* Checkout enhancements: server-priced receipts, explicit estimates and retry identity. */
(function () {
  'use strict';
  const A=window.PrintXLuxury;if(!A)return;
  const {q,tx,el,button,money}=A;
  let pending=false,currentBuyerNotes=null,lastSavedOrder=null,cartGovernorate='',deliveryPrices=null,deliveryLoading=null;
  const fields=['buyer-name','buyer-phone','buyer-address','buyer-city','buyer-governorate','buyer-notes'];
  function snapshot(){const value={};fields.forEach(id=>value[id]=q('#'+id).value);value.method=cartApp.selectedPaymentMethod;return value;}
  function restore(value){fields.forEach(id=>q('#'+id).value=value[id]||'');if(value.method)cartApp.selectPaymentMethod(value.method);if(value['buyer-governorate'])cartApp.onGovernorateChange();}
  function setError(message){let n=q('#px-checkout-error');if(!n){n=el('p','px-error');n.id='px-checkout-error';n.setAttribute('role','alert');q('#confirm-order-btn').before(n);}n.textContent=message;n.hidden=false;}
  A.showCheckoutError=setError;
  async function prices(){if(deliveryPrices)return deliveryPrices;if(!deliveryLoading)deliveryLoading=Store.getDeliveryPrices().then(p=>{if(Object.keys(p).length)deliveryPrices=p;return p;}).finally(()=>deliveryLoading=null);return deliveryLoading;}
  function subtotal(){return Store.getCart().reduce((sum,i)=>sum+Number(i.price)*Number(i.qty),0);}
  function shipping(){
    const old=q('#px-cart-shipping');if(old)old.remove();const sum=subtotal();if(!Store.getCart().length)return;
    const box=el('div','px-shipping');box.id='px-cart-shipping';
    box.append(el('p','',sum>=FREE_DELIVERY_THRESHOLD?tx('Your selection includes free delivery.','اختياراتك تشمل التوصيل المجاني.'):tx('Add '+money(FREE_DELIVERY_THRESHOLD-sum)+' for free delivery.','أضف منتجات بقيمة '+money(FREE_DELIVERY_THRESHOLD-sum)+' للتوصيل المجاني.')));
    const progress=el('progress');progress.max=FREE_DELIVERY_THRESHOLD;progress.value=Math.min(sum,FREE_DELIVERY_THRESHOLD);progress.setAttribute('aria-label',tx('Progress toward free delivery','التقدم نحو التوصيل المجاني'));box.append(progress);
    box.append(el('small','',tx('Based on product subtotal before discounts.','يُحسب على إجمالي المنتجات قبل الخصم.')));
    const label=el('label','',tx('Delivery estimate','تكلفة التوصيل'));const select=el('select','px-delivery-select');select.id='px-cart-governorate';label.htmlFor=select.id;select.append(new Option(tx('Choose your governorate','اختر محافظتك'),''));EGYPT_GOVERNORATES.forEach(g=>select.append(new Option(govLabel(g.key),g.key)));select.value=cartGovernorate;
    const total=el('p');total.setAttribute('role','status');box.append(label,select,total);
    const update=async()=>{cartGovernorate=select.value;if(!select.value){total.textContent=tx('Choose a governorate to see the estimated total.','اختر المحافظة لعرض الإجمالي المتوقع.');return;}total.textContent=tx('Checking delivery…','جارٍ حساب التوصيل…');const p=await prices();if(!select.isConnected)return;if(p[select.value]==null){total.textContent=tx('Delivery estimate unavailable. Contact the studio.','تعذر حساب التوصيل. تواصل مع الاستوديو.');return;}const fee=sum>=FREE_DELIVERY_THRESHOLD?0:p[select.value];total.textContent=tx('Estimated total: ','الإجمالي المتوقع: ')+money(cartApp.getTotals(sum).total+fee)+tx(' · Delivery: ',' · التوصيل: ')+money(fee);};
    select.addEventListener('change',update);q('#checkout-btn').before(box);update();
  }
  A.hook(cartApp,'render',shipping);
  const originalCheckout=cartApp.checkout;
  cartApp.checkout=function(){if(!Store.getCart().length)return;const values=snapshot();if(!values['buyer-governorate'])values['buyer-governorate']=cartGovernorate;originalCheckout.call(this);restore(values);
    if(!q('#px-guest-note')){const n=el('p','px-checkout-note',tx('Guest checkout · No account needed. Your final total is verified when the order is placed.','إتمام الطلب كزائر · لا تحتاج إلى حساب. يتم التحقق من الإجمالي عند تأكيد الطلب.'));n.id='px-guest-note';q('#checkout-form-view').prepend(n);}
    if(window.PrintXMeta&&window.PrintXMeta.initiateCheckout)window.PrintXMeta.initiateCheckout(Store.getCart());
    q('#buyer-name').focus();
  };
  A.hook(cartApp,'selectPaymentMethod',method=>{let n=q('#px-payment-help');if(!n){n=el('p','px-checkout-note');n.id='px-payment-help';q('#confirm-order-btn').before(n);}n.textContent=method==='cod'?tx('Pay on delivery. We will contact you to confirm the order and delivery details.','ادفع عند الاستلام. سنتواصل معك لتأكيد الطلب وتفاصيل التوصيل.'):tx('Place your order, then follow the transfer instructions. Your transfer is checked by the studio.','أكد الطلب، ثم اتبع تعليمات التحويل. يراجع الاستوديو التحويل لتأكيد الدفع.');});
  A.hook(cartApp,'updateOrderSummary',()=>{const gov=q('#buyer-governorate').value;if(!gov&&subtotal()<FREE_DELIVERY_THRESHOLD)q('#summary-total').textContent=tx('Choose governorate for total','اختر المحافظة لعرض الإجمالي');});
  const originalConfirm=cartApp.confirmOrder;
  cartApp.confirmOrder=async function(){
    if(pending)return;if(!Store.getCart().length){setError(tx('Your cart is empty.','سلتك فارغة.'));return;}
    pending=true;const error=q('#px-checkout-error');if(error)error.hidden=true;
    try{const gov=q('#buyer-governorate').value;if(gov){const p=await prices();if(p[gov]==null){setError(tx('We could not verify delivery. Please try again or contact the studio.','تعذر التحقق من تكلفة التوصيل. حاول مجدداً أو تواصل معنا.'));return;}this._deliveryPrices=p;await this.onGovernorateChange();}
      // The legacy caller appends translated delivery/variant labels to notes.
      // Send the customer's own notes; structured fields already carry those details.
      currentBuyerNotes=q('#buyer-notes').value.trim();
      await originalConfirm.call(this);
    }catch(e){setError(tx('Unable to verify your order. Your cart has been kept. Please try again.','تعذر التحقق من الطلب. احتفظنا بسلتك، يرجى المحاولة مجدداً.'));}finally{pending=false;currentBuyerNotes=null;}
  };
  // Store only a request digest and random key: no customer fields in session storage.
  let retryMemory=null;
  async function retryKey(body){
    if(!window.crypto||!crypto.subtle||!crypto.randomUUID)return null;
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(body))))).map(b=>b.toString(16).padStart(2,'0')).join('');
    let previous=retryMemory;try{previous=JSON.parse(sessionStorage.getItem('printx-order-retry-v1')||'null')||previous;}catch(_){}
    if(!previous||previous.digest!==digest)previous={digest,key:crypto.randomUUID()};retryMemory=previous;
    try{sessionStorage.setItem('printx-order-retry-v1',JSON.stringify(previous));}catch(_){}return previous.key;
  }
  Store.createOrder=async function({items,paymentMethod,buyerName,buyerPhone,buyerAddress,buyerCity,buyerNotes,voucherCode,buyerGovernorate}){
    const body={items:items.map(i=>({id:i.id,qty:i.qty,color:(i.selectedColor&&i.selectedColor.name)||null,size:(i.selectedSize&&i.selectedSize.name)||null})),paymentMethod,buyerName,buyerPhone,buyerAddress,buyerCity,buyerNotes:(currentBuyerNotes===null?buyerNotes:currentBuyerNotes)||null,voucherCode:voucherCode||null,buyerGovernorate:buyerGovernorate||null};
    const requestKey=await retryKey(body);if(requestKey)body.requestKey=requestKey;
    const {data,error}=await _sb.functions.invoke('create-order',{body});
    if(error){let message=tx('Could not confirm your order. Your cart has been kept. Please retry.','تعذر تأكيد الطلب. احتفظنا بسلتك، يرجى المحاولة مجدداً.');try{const payload=await error.context.json();if(payload.error)message=payload.error;}catch(_){}throw new Error(message);}
    if(data&&data.error)throw new Error(data.error);
    if(!data||!data.order||!data.order.id||data.order.total==null||data.order.total===''||!Number.isFinite(Number(data.order.total))||Number(data.order.total)<0)throw new Error(tx('Order confirmation was incomplete. Please contact the studio before trying again.','تأكيد الطلب غير مكتمل. يرجى التواصل مع الاستوديو قبل إعادة المحاولة.'));
    lastSavedOrder=data.order;retryMemory=null;try{sessionStorage.removeItem('printx-order-retry-v1');}catch(_){}return data.order;
  };
  const originalReceipt=cartApp._renderReceipt;
  cartApp._renderReceipt=function(details){
    if(lastSavedOrder){details.finalTotal=Number(lastSavedOrder.total);if(lastSavedOrder.delivery_fee!=null)details.deliveryFee=Number(lastSavedOrder.delivery_fee);if(lastSavedOrder.discount_amount!=null)details.discount=Number(lastSavedOrder.discount_amount);details.subtotal=details.finalTotal+details.discount-details.deliveryFee;
      if(Array.isArray(lastSavedOrder.items))details.cart=lastSavedOrder.items.map(i=>({...i,selectedSize:i.size?{name:i.size}:null,selectedColor:i.color?{name:i.color}:null}));}
    originalReceipt.call(this,details);
    if(lastSavedOrder){const ref=el('p','px-order-reference',tx('Order reference: ','رقم الطلب: ')+lastSavedOrder.id);q('#receipt-body').prepend(ref);}
    fields.forEach(id=>q('#'+id).value='');cartGovernorate='';
  };
  A.hook(cartApp,'updateBadge',()=>document.querySelectorAll('.cart-badge').forEach(n=>{n.classList.remove('px-cart-pulse');requestAnimationFrame(()=>n.classList.add('px-cart-pulse'));}));
  [['buyer-name','name'],['buyer-phone','tel'],['buyer-address','street-address'],['buyer-city','address-level2']].forEach(([id,autocomplete])=>q('#'+id).autocomplete=autocomplete);
  q('#buyer-phone').inputMode='tel';
  q('#buyer-notes').placeholder=tx('Delivery instructions or a gift note request','تعليمات التوصيل أو طلب رسالة هدية');
  shipping();
}());
