/* Retry identity is independent of current catalog prices. Only receipt fields are returned. */
export async function fingerprint(body) {
  const fields=['items','paymentMethod','buyerName','buyerPhone','buyerAddress','buyerCity','buyerNotes','voucherCode','buyerGovernorate'];
  const values=fields.map(key=>body[key]??null);
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(values)));
  return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
export function receipt(order) {
  return {id:order.id,status:order.status,total:order.total,delivery_fee:order.delivery_fee,discount_amount:order.discount_amount,items:order.items};
}
export function replay(order,hash) {
  if(!order)return null;
  if(order.request_hash!==hash)return {status:409,error:'This request reference belongs to different order details. Please reopen checkout.'};
  return {status:200,order:receipt(order)};
}
