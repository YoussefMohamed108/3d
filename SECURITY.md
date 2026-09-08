# PrintX security review

Reviewed: 2026-08-10

## Fixed in this workspace

- Admin UI no longer trusts `user_metadata.role`, which a user can edit. Missing profiles now fail closed as `customer`, and opening the admin panel re-checks the authenticated user's server-side profile.
- Voucher validation now uses a narrowly scoped database function instead of allowing anonymous clients to query the vouchers table.
- The security migration adds row-level access guards for profiles, products, settings, orders, custom requests, vouchers, categories, hero slides, and product-image storage.
- Customer-controlled category and voucher values are escaped before being inserted into admin HTML. Dynamic action arguments use JSON data attributes rather than interpolated JavaScript strings.
- Commission inputs have length limits, generic public error messages, and a honeypot field. Database-side checks enforce the important limits even when browser validation is bypassed.
- Deployment headers now also block plugins/objects, upgrade insecure requests, isolate the browsing context, and disable DNS prefetching.

## Deployment actions required

1. Apply `supabase/migrations/20260810000000_security_hardening.sql` to the linked Supabase project before deploying the updated frontend. The voucher UI depends on its `validate_voucher` function.
2. Confirm the `product-images` bucket allows only JPEG, PNG, WebP, and GIF files and enforces a 20 MB maximum. Browser checks are not a security boundary.
3. Add rate limiting or CAPTCHA at the edge for sign-in, commission submissions, voucher checks, and guest order creation. The browser honeypot only reduces basic automated spam.
4. Keep the `create-order` Edge Function in source control and test it for server-side price lookup, delivery-fee lookup, voucher validation, quantity caps, input length limits, CORS allowlisting, and abuse throttling. Its source is not present in this workspace, so those controls could not be verified here.
5. Review Supabase Auth settings: email confirmation enabled, leaked-password protection enabled, minimum password length of at least 10, and MFA required for administrator accounts.

## Remaining architectural risk

The storefront is a single HTML file with inline scripts, inline styles, and many inline event handlers. This requires `'unsafe-inline'` in the Content Security Policy, weakening its protection against script injection. The current output escaping reduces immediate risk, but the durable fix is to move JavaScript and CSS into separate files and replace all inline handlers; CSP can then use self-hosted scripts or hashes without `'unsafe-inline'`.

The Supabase publishable/anonymous key in `index.html` is expected to be public. Security must come from row-level policies and trusted server functions; never place the Supabase service-role key in browser code.
