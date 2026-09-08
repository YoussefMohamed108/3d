import { createClient } from "npm:@supabase/supabase-js@2.112.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
const DEFAULT_ORIGINS = ["https://printx-eg.com", "https://www.printx-eg.com", "https://printx-eg.vercel.app"];
const MAX_BODY_BYTES = 64 * 1024;
const MAX_QTY_PER_ITEM = 20;
const MAX_TOTAL_QTY = 100;
const MAX_DISTINCT_ITEMS = 50;
const FREE_DELIVERY_THRESHOLD = 1000;
const CHECKOUT_RATE_LIMIT = { max: 5, windowSeconds: 600 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function allowedOrigins(): Set<string> {
  const configured = (Deno.env.get("ALLOWED_ORIGINS") || Deno.env.get("ALLOWED_ORIGIN") || "")
    .split(",").map((value) => value.trim()).filter((value) => value && value !== "*");
  return new Set(configured.length ? configured : DEFAULT_ORIGINS);
}

function responseHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  };
  if (origin && allowedOrigins().has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders(req) });
}

function originAllowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  return !origin || allowedOrigins().has(origin);
}

function text(value: unknown, max: number): string {
  const result = typeof value === "string" ? value.trim() : "";
  return result.length <= max ? result : "";
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0].trim();
  return (forwarded || "unknown").slice(0, 160);
}

async function enforceRateLimit(admin: ReturnType<typeof createClient>, req: Request) {
  const { data, error } = await admin.rpc("check_rate_limit", {
    p_bucket: "checkout",
    p_key: clientIp(req),
    p_max_hits: CHECKOUT_RATE_LIMIT.max,
    p_window_seconds: CHECKOUT_RATE_LIMIT.windowSeconds,
  });
  if (error) throw new Error(`rate limit unavailable: ${error.message}`);
  return data === true;
}

function paymentMethod(value: unknown): string | null {
  // The existing UI calls the generic wallet option `ewallet`; the database
  // stores it under its configured Vodafone wallet method.
  if (value === "ewallet") return "vodafone";
  return ["instapay", "vodafone", "etisalat", "cod"].includes(String(value)) ? String(value) : null;
}

function buildOrderMessage(order: Record<string, any>, items: Array<Record<string, any>>) {
  const labels: Record<string, string> = { instapay: "InstaPay", vodafone: "E-Wallet", etisalat: "Etisalat Cash", cod: "Cash on Delivery" };
  const quantity = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  return `🔔 NEW ORDER — PrintX\nOrder ID: ${String(order.id).slice(-6).toUpperCase()}\n` +
    `Items: ${quantity}\nTotal: EGP ${Number(order.total).toFixed(2)}\n` +
    `Method: ${labels[order.payment_method] || order.payment_method}\n\n` +
    `Open the protected PrintX admin dashboard to view customer and delivery details.`;
}

async function notifyTelegram(order: Record<string, any>, items: Array<Record<string, any>>) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: buildOrderMessage(order, items) }),
  });
  if (!response.ok) {
    await response.body?.cancel();
    console.warn("Telegram notification failed:", response.status);
  }
}

Deno.serve(async (req) => {
  if (!originAllowed(req)) return json(req, { error: "Origin not allowed." }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: responseHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed." }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) return json(req, { error: "Server configuration error." }, 500);
  if (!(req.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) {
    return json(req, { error: "Content-Type must be application/json." }, 415);
  }
  const declaredLength = Number(req.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) return json(req, { error: "Request body is too large." }, 413);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  try {
    if (!(await enforceRateLimit(admin, req))) return json(req, { error: "Too many checkout attempts. Please wait and try again." }, 429);
  } catch (error) {
    console.error(error);
    return json(req, { error: "Checkout is temporarily unavailable. Please try again." }, 503);
  }

  let body: Record<string, any>;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json(req, { error: "Request body is too large." }, 413);
    body = JSON.parse(raw);
  } catch {
    return json(req, { error: "Invalid JSON body." }, 400);
  }

  const items = body?.items;
  if (!Array.isArray(items) || !items.length || items.length > MAX_DISTINCT_ITEMS) return json(req, { error: "Invalid cart." }, 400);
  let totalQty = 0;
  for (const item of items) {
    if (!item || !UUID.test(String(item.id || "")) || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > MAX_QTY_PER_ITEM) {
      return json(req, { error: "Malformed cart item." }, 400);
    }
    if (item.size != null && (typeof item.size !== "string" || item.size.length > 80)) return json(req, { error: "Invalid size selection." }, 400);
    if (item.color != null && (typeof item.color !== "string" || item.color.length > 80)) return json(req, { error: "Invalid color selection." }, 400);
    totalQty += item.qty;
  }
  if (totalQty > MAX_TOTAL_QTY) return json(req, { error: "Cart quantity is too large." }, 400);

  const name = text(body.buyerName, 80);
  const phone = text(body.buyerPhone, 24);
  const address = text(body.buyerAddress, 240);
  const city = text(body.buyerCity, 100);
  const notes = body.buyerNotes == null ? null : text(body.buyerNotes, 1500);
  const governorate = text(body.buyerGovernorate, 80);
  const method = paymentMethod(body.paymentMethod);
  const voucherCode = body.voucherCode == null ? "" : text(body.voucherCode, 64).toUpperCase();
  if (name.length < 2) return json(req, { error: "Please provide a valid full name." }, 400);
  if (!/^[0-9+]{10,15}$/.test(phone.replace(/[\s-]/g, ""))) return json(req, { error: "Please provide a valid phone number." }, 400);
  if (address.length < 5 || city.length < 2 || !governorate) return json(req, { error: "Please provide a valid delivery address." }, 400);
  if (body.buyerNotes != null && notes === "" && String(body.buyerNotes).trim()) return json(req, { error: "Order notes are too long." }, 400);
  if (!method) return json(req, { error: "Invalid payment method." }, 400);
  if (body.voucherCode && !voucherCode) return json(req, { error: "Invalid voucher code." }, 400);

  const { data: setting, error: settingError } = await admin.from("settings").select("value")
    .eq("key", `delivery_${governorate}`).maybeSingle();
  const configuredFee = Number(setting?.value);
  if (settingError || !setting || !Number.isFinite(configuredFee) || configuredFee < 0) {
    return json(req, { error: setting ? "Could not verify delivery fee." : "Invalid governorate selected." }, setting ? 500 : 400);
  }

  let userId: string | null = null;
  let userEmail: string | null = null;
  const authorization = req.headers.get("authorization") || "";
  const jwt = authorization.replace(/^Bearer\s+/i, "");
  if (jwt) {
    const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: authorization } } });
    const { data } = await client.auth.getUser(jwt);
    if (data.user) { userId = data.user.id; userEmail = data.user.email || null; }
  }

  const ids = [...new Set(items.map((item: any) => item.id))];
  const { data: products, error: productError } = await admin.from("products")
    .select("id,name,price,sale_price,sizes,colors,hidden").in("id", ids).eq("hidden", false);
  if (productError) return json(req, { error: "Could not verify products." }, 500);
  const byId = new Map((products || []).map((product: any) => [product.id, product]));
  let subtotal = 0;
  const orderItems: Array<Record<string, any>> = [];
  for (const item of items) {
    const product: any = byId.get(item.id);
    if (!product) return json(req, { error: "A product in your cart is no longer available." }, 400);
    const sizes = Array.isArray(product.sizes) ? product.sizes : [];
    const requestedSize = String(item.size || "").trim();
    const selectedSize = sizes.find((size: any) => String(size?.name || "").trim().toLowerCase() === requestedSize.toLowerCase());
    if (sizes.length && !selectedSize) return json(req, { error: `Please choose an available size for “${product.name}”.` }, 400);
    const price = sizes.length ? Number(selectedSize.price) : Math.min(
      Number(product.price),
      product.sale_price != null && Number(product.sale_price) > 0 ? Number(product.sale_price) : Number(product.price),
    );
    if (!Number.isFinite(price) || price <= 0) return json(req, { error: "Could not verify a product price." }, 500);
    const colors = Array.isArray(product.colors) ? product.colors : [];
    const requestedColor = String(item.color || "").trim();
    const selectedColor = colors.find((color: any) => String(color?.name || "").trim().toLowerCase() === requestedColor.toLowerCase());
    if (colors.length && !selectedColor) return json(req, { error: `Please choose an available color for “${product.name}”.` }, 400);
    subtotal += price * item.qty;
    orderItems.push({ id: product.id, name: product.name, price, qty: item.qty, size: selectedSize?.name || null, color: selectedColor?.name || null });
  }

  let discount = 0;
  let appliedVoucher: string | null = null;
  if (voucherCode) {
    const { data: voucher } = await admin.from("vouchers").select("code,discount_type,discount_value,expires_at")
      .eq("code", voucherCode).eq("active", true).maybeSingle();
    if (voucher && (!voucher.expires_at || new Date(voucher.expires_at) > new Date())) {
      discount = voucher.discount_type === "percent" ? subtotal * Number(voucher.discount_value) / 100 : Number(voucher.discount_value);
      discount = Math.max(0, Math.min(Number.isFinite(discount) ? discount : 0, subtotal));
      appliedVoucher = voucher.code;
    }
  }
  const deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : configuredFee;
  const total = Math.max(0, subtotal - discount) + deliveryFee;
  const { data: order, error: insertError } = await admin.from("orders").insert({
    user_id: userId, items: orderItems, total, payment_method: method, buyer_name: name,
    buyer_phone: phone, buyer_email: userEmail, buyer_address: address, buyer_city: city,
    buyer_governorate: governorate, delivery_fee: deliveryFee, buyer_notes: notes,
    voucher_code: appliedVoucher, discount_amount: discount,
  }).select("id,created_at,status,total,delivery_fee,discount_amount,payment_method,buyer_name,buyer_phone,buyer_email,buyer_address,buyer_city,buyer_governorate,buyer_notes").single();
  if (insertError) {
    console.error("order insert failed:", insertError.message);
    return json(req, { error: "Could not save your order. Please try again." }, 500);
  }
  try { await notifyTelegram(order, orderItems); } catch (error) { console.warn("Telegram notification error:", error); }
  return json(req, { order: { id: order.id, status: order.status, total: order.total, delivery_fee: order.delivery_fee, discount_amount: order.discount_amount } });
});

