import { createClient } from "npm:@supabase/supabase-js@2.112.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const ALLOWED_SIZES = new Set(["Not sure", "75mm", "100mm", "120mm", "150mm XL"]);
const ALLOWED_BUDGETS = new Set([
  "Not sure",
  "Under EGP 1,000",
  "EGP 1,000-2,500",
  "EGP 2,500-5,000",
  "EGP 5,000+",
]);
const CUSTOM_ORDER_RATE_LIMIT = { max: 5, windowSeconds: 60 * 10 };

function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
}

async function isRateLimited(admin: ReturnType<typeof createClient>, ip: string): Promise<boolean> {
  const { data: allowed, error } = await admin.rpc("check_rate_limit", {
    p_bucket: "custom-order",
    p_key: ip,
    p_max_hits: CUSTOM_ORDER_RATE_LIMIT.max,
    p_window_seconds: CUSTOM_ORDER_RATE_LIMIT.windowSeconds,
  });
  if (error) {
    console.error("custom-order rate limit check failed:", error.message);
    return false;
  }
  return allowed === false;
}

function validateDeadline(value: unknown): string | null | undefined {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;

  const requested = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(requested.getTime())) return undefined;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const latest = new Date(today);
  latest.setUTCDate(latest.getUTCDate() + 730);
  return requested >= today && requested <= latest ? value : undefined;
}

function buildCustomOrderMessage(request: {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  figure_type: string;
  preferred_size: string;
  budget_range: string;
  desired_deadline: string | null;
  description: string;
}) {
  const requestDate = new Date(request.created_at || Date.now()).toLocaleString("en-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    `🔔 NEW CUSTOM ORDER — PrintX\n` +
    `Request ID: ${String(request.id).slice(-6).toUpperCase()}\n` +
    `Date: ${requestDate}\n\n` +
    `👤 Customer\n` +
    `Name: ${request.name}\n` +
    `Email: ${request.email}\n` +
    `Phone: ${request.phone}\n\n` +
    `🎨 Commission\n` +
    `Type: ${request.figure_type}\n` +
    `Preferred size: ${request.preferred_size}\n` +
    `Budget: ${request.budget_range}\n` +
    `Desired deadline: ${request.desired_deadline || "Not specified"}\n\n` +
    `Description:\n${request.description.slice(0, 2000)}`
  );
}

async function notifyTelegram(request: Parameters<typeof buildCustomOrderMessage>[0]) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("Telegram secrets not set — custom-order notification skipped.");
    return;
  }

  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: buildCustomOrderMessage(request),
      }),
    },
  );

  if (!response.ok) {
    console.warn("Custom-order Telegram notification failed:", response.status, await response.text());
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("Required Supabase Edge Function secrets are missing.");
    return json({ error: "Server configuration error" }, 500);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  if (await isRateLimited(admin, getClientIp(req))) {
    return json({ error: "Too many requests. Please wait a few minutes and try again." }, 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const phone = String(body.phone || "").trim();
  const figureType = String(body.figure_type || "").trim();
  const description = String(body.description || "").trim();
  const preferredSize = String(body.preferred_size || "").trim();
  const budgetRange = String(body.budget_range || "").trim();
  const desiredDeadline = validateDeadline(body.desired_deadline);

  if (name.length < 2 || name.length > 80) return json({ error: "Invalid name" }, 400);
  if (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return json({ error: "Invalid email" }, 400);
  }
  if (phone.length > 24 || !/^[0-9+]{10,15}$/.test(phone.replace(/[\s-]/g, ""))) {
    return json({ error: "Invalid phone number" }, 400);
  }
  if (figureType.length < 1 || figureType.length > 80) return json({ error: "Invalid figure type" }, 400);
  if (description.length < 20 || description.length > 2000) {
    return json({ error: "Description must be between 20 and 2000 characters" }, 400);
  }
  if (!ALLOWED_SIZES.has(preferredSize)) return json({ error: "Invalid preferred size" }, 400);
  if (!ALLOWED_BUDGETS.has(budgetRange)) return json({ error: "Invalid budget range" }, 400);
  if (desiredDeadline === undefined) return json({ error: "Invalid desired deadline" }, 400);

  const { data: savedRequest, error: insertError } = await admin
    .from("custom_requests")
    .insert({
      name,
      email,
      phone,
      figure_type: figureType,
      description,
      preferred_size: preferredSize,
      budget_range: budgetRange,
      desired_deadline: desiredDeadline,
      status: "pending",
    })
    .select("id, created_at, status, name, email, phone, figure_type, description, preferred_size, budget_range, desired_deadline")
    .single();

  if (insertError) {
    console.error("custom request insert failed:", insertError.message);
    return json({ error: "Could not save your request. Please try again." }, 500);
  }

  try {
    await notifyTelegram(savedRequest);
  } catch (error) {
    console.warn("Custom-order Telegram notification error:", error);
  }

  return json({ request: { id: savedRequest.id, status: savedRequest.status } });
});
