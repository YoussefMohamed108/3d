import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const order = read('../supabase/functions/create-order/index.ts');
const custom = read('../supabase/functions/create-custom-order/index.ts');
const media = read('../supabase/functions/imagekit-media/handler.mjs');
const migration = read('../supabase/migrations/20260908084500_fix_signup_role_escalation.sql') +
  read('../supabase/migrations/20260908085000_harden_database_functions.sql');
const headers = JSON.parse(read('../vercel.json'));

test('signup roles are server assigned and helper functions have fixed search paths', () => {
  assert.match(migration, /values \(new\.id, v_username, 'customer'\)/);
  assert.doesNotMatch(migration, /raw_user_meta_data\s*->>\s*'role'/);
  assert.match(migration, /create or replace function public\.handle_new_user\(\)[\s\S]*?set search_path = ''/);
  assert.match(migration, /revoke all on function public\.handle_new_user\(\) from public, anon, authenticated/);
});

test('internal helpers are private and rate limiting is concurrency-safe', () => {
  assert.match(migration, /revoke all on function public\.check_rate_limit[\s\S]*?from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.check_rate_limit[\s\S]*?to service_role/);
  assert.match(migration, /pg_advisory_xact_lock/);
});

test('public functions enforce origins, body limits, and fail-closed rate limits', () => {
  for (const source of [order, custom]) {
    assert.doesNotMatch(source, /Access-Control-Allow-Origin["']\s*:\s*["']\*/);
    assert.match(source, /Origin not allowed/);
    assert.match(source, /Request body is too large/);
    assert.match(source, /temporarily unavailable/);
    assert.match(source, /value !== "\*"/);
  }
  assert.doesNotMatch(media, /Access-Control-Allow-Origin["']\s*:\s*["']\*/);
  assert.match(media, /Origin not allowed/);
  assert.match(media, /Administrator access required/);
  assert.match(media, /value !== '\*'/);
});

test('checkout trusts server catalog data and minimizes its response', () => {
  assert.match(order, /\.eq\("hidden", false\)/);
  assert.match(order, /MAX_TOTAL_QTY/);
  assert.match(order, /colors,hidden/);
  assert.match(order, /order: \{ id: order\.id, status: order\.status, total: order\.total/);
  assert.doesNotMatch(order, /return json\(req, \{ order \}\)/);
});

test('Telegram alerts do not copy customer PII out of the database', () => {
  const orderMessage = order.match(/function buildOrderMessage[\s\S]*?\n}\n\nasync function notifyTelegram/)?.[0] || '';
  const customMessage = custom.match(/function buildCustomOrderMessage[\s\S]*?\n}\n\nasync function notifyTelegram/)?.[0] || '';
  for (const message of [orderMessage, customMessage]) {
    assert.doesNotMatch(message, /request\.(name|email|phone|description)/);
    assert.doesNotMatch(message, /order\.(buyer_name|buyer_phone|buyer_email|buyer_address|buyer_notes)/);
    assert.match(message, /protected PrintX admin dashboard/);
  }
});

test('deployment has a restrictive baseline and auth callback is not cached', () => {
  const rules = headers.headers;
  const allHeaders = Object.fromEntries(rules.find(rule => rule.source === '/(.*)').headers.map(({ key, value }) => [key, value]));
  assert.equal(allHeaders['X-Frame-Options'], 'DENY');
  assert.equal(allHeaders['X-Content-Type-Options'], 'nosniff');
  assert.equal(allHeaders['X-XSS-Protection'], '0');
  assert.match(allHeaders['Content-Security-Policy'], /frame-ancestors 'none'/);
  assert.match(allHeaders['Content-Security-Policy'], /object-src 'none'/);
  assert.equal(rules.find(rule => rule.source === '/verified.html').headers[0].value, 'no-store, max-age=0');
});

