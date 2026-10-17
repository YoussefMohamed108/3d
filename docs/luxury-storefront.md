# Collector storefront release

Implemented on `feature/luxury-storefront`, based on `04d6865b2abbfce3c7b175abc235791b66dd0f8f`. This document describes source changes; it is not evidence of production deployment.

## Experience

- Navy, ivory and restrained cyan palette, editorial type and spacious product presentation; English/Arabic and RTL.
- Selected collection (up to four pieces), category discovery, saved pieces in the current browser, real second-image hover previews and related products.
- Hero links to the pictured product when an exact image match or an administrator mapping exists. Pause/play controls; no autoplay for reduced-motion users. Welcome offer opens only on request.
- Product links at `/products/<UUID>`, image zoom, touch gallery navigation, product sharing, WhatsApp inquiry and a mobile purchase bar using the existing variant validation.
- Governorate delivery estimates, free-delivery progress based on the product subtotal **before discounts**, guest-checkout guidance and retained form details after failure.
- Confirmation uses the saved order's total and reference. The old backend remains compatible; duplicate-order protection requires the separate backend release below.
- Meta ViewContent and InitiateCheckout extend the existing production/privacy gates. Purchase still means an order was saved, not that payment settled.

## Content administration

Admin → Settings → **Collector storefront content**. Product cover/gallery images, descriptions, prices, colors and sizes remain in **Products**.

The new editor saves public JSON in `settings.key = luxury_content_v1`. It checks administrator access and relies on existing settings-table RLS. It compares the last-loaded value on update to avoid overwriting another editor's changes. A failed save retains the draft without changing the storefront. Do not put customer contact details, private notes or credentials in this public record.

- Product: dimensions, material, finish, included items, care, availability and delivery estimate, each in English and Arabic. Blank fields do not display.
- Product media: an actual packaging photo; at least 8 consistent photographs for a 360° viewer (up to 72). The viewer uses a keyboard/touch range control and requests frames as selected.
- Collection: up to four existing products; hidden products are excluded publicly.
- Hero: explicitly connect a slide to its matching product. Unmapped non-product studio slides have no shopping link.
- Studio: actual story, founder introduction, confirmed gifting services, photo with alt text and optional site-hosted video. Video plays only on request.
- Feedback: genuine quote and customer display name, optional product/photo, and permission checkbox before publication. No invented ratings or reviews.

Allowed media: relative site paths, the configured ImageKit endpoint, the configured Supabase host, and `https://printx-eg.com`. Video must be a relative path such as `/media/studio.mp4` because the current CSP allows same-origin video only. Upload site video through the repository/deployment; the editor stores its path.

Suggested content to supply before a campaign: accurate specifications for each product, scale photographs, detail/finish photos, actual packaging, a studio/process sequence, a founder introduction, approved feedback, and confirmed gift-service wording. The code does not create these facts or media. Existing product descriptions remain authoritative.

## Product discovery and hosting

Vercel Node Functions `api/product.js` and `api/sitemap.js` read the public catalog with the same publishable key as the browser. No service key is embedded. Product pages have escaped server HTML, canonical/social metadata and Product/Offer JSON-LD. They show real size prices and reject hidden/removed products. Catalog outages return 503 with no caching; unknown products return 404.

`/sitemap.xml` retains the static homepage sitemap. `/products-sitemap.xml` maps to the dynamic function and is separately advertised in `robots.txt`. This avoids a static file shadowing a rewrite (Vercel filesystem precedence). The function excludes hidden products. New routes require a Vercel deployment with Node Functions enabled; a static-only local server cannot serve deep links.

The original inline application remains, with three narrowly reviewed changes: inline checkout-error delivery, reduced-motion/paused hero autoplay, and a guard against a stale gallery-close timer. The preservation test normalizes only these exact edits; existing handlers, controls and IDs remain guarded by the original baseline.

## Separate backend release — not performed by this branch push

1. Review and apply `supabase/migrations/20261017070000_order_idempotency.sql` to the intended Supabase project through the existing migration process. It adds nullable request fields and a partial unique index; legacy order inserts remain supported.
2. Deploy `supabase/functions/create-order/index.ts` together with `idempotency.mjs`, preserving tracked JWT settings, secrets and existing rate limiting. **Migration before function.**
3. Confirm the deployed function/schema versions. Production order creation is not part of the nonmutating browser test suite.

The client stores only a SHA-256 request digest and random UUID in session storage, never the customer's form fields. It retains the key on failure and clears it on confirmed success. Checkout sends the customer’s own notes and structured order fields; generated translated delivery annotations are excluded so a language change does not alter retry identity. The handler returns the existing receipt for a matching retry; changed payloads with the same key return 409. The unique database index arbitrates simultaneous inserts. No client-supplied price is trusted. Browser-only double-click guarding works with the older backend; cross-request duplicate protection does not become active until the backend is deployed.

## Verification

Use Node 24 (handler tests use `node:module.stripTypeScriptTypes`):

```sh
node scripts/validate-site.mjs
node --test scripts/test-*.mjs scripts/test-luxury-core.cjs scripts/test-product-routes.cjs scripts/test-checkout-retry.cjs
```

For browser checks install Playwright outside the production tree and its Chromium browser. Set `NODE_PATH` to that installation's `node_modules`; set `PRINTX_TEST_SDK` to the official Supabase JS v2 UMD file downloaded from the same jsDelivr endpoint used in `index.html`.

```sh
BROWSERS=Chromium node scripts/test-storefront-design.cjs
node scripts/test-luxury-browser.cjs
```

With `PRINTX_TEST_SDK`, every remote request is fulfilled with a deterministic fixture; no production order, account, review, content save or upload occurs. Without it, the older smoke reads public data but still intercepts external writes. `PRINTX_TEST_CHROMIUM` optionally selects an installed Chromium executable. `PRINTX_SCREENSHOTS` optionally selects an existing output directory for local visual evidence. Do not publish screenshots containing real buyer data.

Coverage: 60 unit/source checks; original smoke including 32 header combinations, variants, voucher, checkout, custom inquiry and admin; new browser checks for saved pieces, deep links, zoom, rapid gallery reopen, mobile purchase, failed/retried orders across a language change, server totals, Arabic and admin draft/save behavior. Full-catalog variant controls are hit-tested above the catalog overlay; unmapped hero links are verified hidden. Chromium screenshots inspected. Browser fixtures prove UI behavior, not payment settlement or deployed RLS. Firefox/WebKit and production Function routing still require deployment/device checks.

## Rollback

Revert the frontend commit or promote the previous verified Vercel deployment. The nullable columns/index can remain if the old function is restored. Do not drop request columns while the new function is active. Never roll back customer orders as part of a presentation rollback.

## Independent review

Three important findings were reproduced and fixed: full-catalog lightbox stacking, retry identity after a language-only change, and hidden hero/zoom controls overridden by CSS display rules. Regression checks passed after each fix; no critical or deferred minor findings remain. Live RLS, payment/Telegram delivery and production Vercel bundling remain deployment checks, because the local fixture suite cannot establish those external states. Authentic assets remain an owner content task.
