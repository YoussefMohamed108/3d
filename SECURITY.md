# PrintX security review

Reviewed: 2026-09-08

## Deployed controls

- Signup authorization is server assigned: `handle_new_user()` always creates a
  `customer` profile and never trusts `raw_user_meta_data.role`.
- Database helper functions use a fixed empty `search_path`; trigger and
  rate-limit helpers are no longer executable by browser roles.
- Checkout, custom-order, and ImageKit Edge Functions use an exact browser
  origin allowlist, reject oversized/non-JSON bodies, return `no-store`, and do
  not expose permissive wildcard CORS.
- Public order endpoints fail closed if their database-backed rate limiter is
  unavailable. The limiter serializes concurrent hits for the same IP bucket.
- Checkout validates UUIDs, field lengths, item and total quantity caps,
  server-side prices, available sizes/colors, hidden-product status, delivery
  fees, and vouchers. Its response contains only non-sensitive receipt fields.
- Telegram alerts contain only IDs and non-sensitive summaries; customer contact,
  delivery, and commission details remain in the protected admin dashboard.
- ImageKit operations still require a valid user session plus the server-side
  administrator check, validate image signatures, and retain Supabase originals
  as a recovery copy.
- Dynamic database error messages are rendered with `textContent`, not HTML.
- Vercel sends HSTS, clickjacking, MIME-sniffing, referrer, permissions,
  cross-origin isolation, and Content Security Policy headers. The verification
  callback is explicitly non-cacheable.
- Supabase Auth requires a minimum 10-character password and email confirmation.

## Pending maintenance decision

The audit found older duplicate permissive RLS policies and broader-than-needed
table grants. Their replacement is intentionally not included in the deployable
commit because it touches all storefront access paths. It should be handled in
a separate maintenance window with explicit approval, a fresh database backup,
and immediate public-catalog plus administrator-CRUD verification. The smaller,
backward-compatible critical function migrations have already been applied.

## Intentional advisor findings

- `rate_limit_hits` has RLS and no client policies by design; only `service_role`
  can use its RPC.
- `validate_voucher(text)` is intentionally callable by visitors and returns
  only one active, unexpired voucher supplied by exact code.
- `is_admin()` is currently callable by browser roles because existing RLS
  policies depend on it. It returns only a boolean for the current session.
- Supabase leaked-password detection is unavailable on the Free plan. Enable it
  if the project moves to Pro.

## Remaining architectural work

The storefront is a single HTML file with inline scripts, styles, and event
handlers. This still requires `'unsafe-inline'` in the Content Security Policy.
The durable fix is to move JavaScript and CSS to separate files and replace
inline event handlers, after which `'unsafe-inline'` can be removed.

The Supabase publishable key in browser code is expected to be public. Never put
the service-role key, ImageKit private key, Telegram token, or other private
credential in frontend code or Git history.

The BrowserStack access key previously shared in chat should be rotated in the
BrowserStack dashboard because chat messages are not a secrets vault.

