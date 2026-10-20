# PrintX website — engineering and operations handover

Last source review: **2026-10-17**. Audience: the owner, future developers, administrators and deployment maintainers.

This is a source-verified map of the existing application, not a claim that every dashboard setting, quota, account permission or historical migration has been independently re-audited today. Review the live dashboards before changing infrastructure. Never add credentials, customer exports, authentication callback URLs or private logs to this document or Git.

## 1. Start here

- Production: <https://printx-eg.com>.
- Repository: <https://github.com/YoussefMohamed108/3d>, production branch `main`.
- Business: PrintX, an online-only Egyptian 3D-printing studio; EGP pricing, catalog purchases and custom commissions. Do not invent a walk-in address.
- Frontend hosting: Vercel project `3d` (`prj_hIavgOO0HEqGJcGscsdBU6S8wGFB`), team `team_0JDFBbMA8A0s12Et63feEX0V`.
- Backend: Supabase project reference `dqdsgckzwiknmldhwjnw`, API origin `https://dqdsgckzwiknmldhwjnw.supabase.co`.
- Media delivery/upload destination: ImageKit endpoint `https://ik.imagekit.io/bxk734nq4h`, folders under `/printx/products` and `/printx/hero`.
- Meta Pixel: public dataset/pixel ID `1400841768676484`.
- Instagram: <https://www.instagram.com/printxstudio.eg/>. Facebook owner-supplied link: <https://www.facebook.com/share/1HiDsEVsQH/>. Preserve the actual links in source when editing.
- WhatsApp links exist throughout the frontend; the current fallback is `https://wa.me/201125607937`. Payment/contact numbers can also come from admin-managed settings. Verify with the owner before changing any number.

The collector storefront changes and separate backend release checklist are documented in [docs/luxury-storefront.md](docs/luxury-storefront.md). They are source changes until a deployment is verified.

For a safe first contribution: read this file, [SECURITY.md](SECURITY.md), [the image integration guide](docs/imagekit-setup.md), [the analytics guide](docs/meta-pixel.md), run the non-mutating tests, then inspect the relevant part of `index.html`. Do not start by rebuilding the app in a different framework.

## 2. Architecture and what is NOT in this repository

```text
Browser -> Vercel static HTML/CSS/JS
  |-- Supabase Auth -> profiles / session / admin authorization
  |-- Supabase PostgREST + RLS -> catalog, categories, settings, hero slides
  |-- Supabase Realtime -> product refresh
  |-- create-order Edge Function -> validates/reprices -> protected orders
  |-- create-custom-order Edge Function -> validates -> protected requests
  |-- imagekit-media Edge Function -> verifies admin -> ImageKit API
  |-- ImageKit CDN -> resized catalog/gallery/hero images
  `-- Meta SDK (production only, privacy checks) -> commerce measurement
Edge Functions may send non-sensitive Telegram notifications.
```

The storefront is **plain HTML, CSS and JavaScript**, not React/Next.js/Vite. There is no `package.json`, production bundle or npm build step. Most existing CSS, translations, UI markup and application code are still inside the large `index.html`. New design overrides are separate files; do not confuse them with a replacement application.

Supabase is the database, authentication and server execution layer. ImageKit is not the database. GitHub stores source, not customer records or a complete media/database backup. Vercel serves the frontend; Supabase Functions are deployed independently.

Important omissions from source control:

- No complete, verified initial database schema dump. The migrations modify an already-existing database; **running them against an empty project is not a complete installation procedure**.
- No database contents, Supabase Auth user export, storage object backup, ImageKit originals, private keys or dashboard access grants.
- Dashboard-only Auth settings, live RLS/grant history, actual service quotas, billing, DNS ownership and email deliverability require separate verification.
- No checked-in GitHub Actions workflow at this review. Local tests are not automatically a required merge gate. Confirm repository protection/settings in GitHub.
- No automated card payment gateway, inventory reservation service, payment settlement verification, transactional order-email integration or Meta Conversions API in this source.
- The web manifest supplies install metadata/icons, not an offline checkout service. No service worker is supplied here.

## 3. File map

| File/directory | Responsibility |
| --- | --- |
| `index.html` | Storefront/admin markup; original inline CSS, EN/AR copy, data store and application modules; SEO metadata/JSON-LD |
| `simple-storefront.css` | Approved simplified navy/cyan design, scoped to `body.printx-simple[data-storefront-version]`; responsive and RTL rules |
| `scripts/storefront-design.js` | ES5 enhancement: hero image counter, keyboard arrows and horizontal swipe; reuses original carousel buttons |
| `promotion.css`, `scripts/promotion.js` | Announcement bar and first-session offer dialog, EN/AR and clipboard fallback |
| `scripts/imagekit-media.js` | Browser upload/delete client and retained migration helper; contains only the PUBLIC endpoint |
| `scripts/legacy-storefront.js` | ES5/XHR fallback catalog with WhatsApp ordering for older/broken modern-JS environments |
| `scripts/meta-pixel.js` | Production-only Meta loader, privacy/callback exclusions and event deduplication |
| `verified.html` | Email-verification landing page and callback/session display logic; noindex and no-store |
| `vercel.json` | Static response security headers, CSP and verification cache rule |
| `robots.txt`, `sitemap.xml` | Crawler policy and sitemap (homepage only in current source) |
| `manifest.json`, `browserconfig.xml`, icon files | Browser/install metadata and platform icons |
| `final logo.jpeg`, `1.jpeg`, `2.jpeg`, `og.png` | Identity, fallback/studio images and social sharing artwork; preserve filenames/case/spaces |
| `whatsapp icon.png`, payment logos | Local device-compatible support/payment artwork |
| `supabase/config.toml` | Per-function gateway JWT verification flags |
| `supabase/functions/create-order/index.ts` | Public checkout validation, trusted totals, order persistence, optional Telegram |
| `supabase/functions/create-custom-order/index.ts` | Public commission validation, rate limits and persistence |
| `supabase/functions/imagekit-media/index.js` | Deno adapter for the media handler |
| `supabase/functions/imagekit-media/handler.mjs` | Testable authenticated media handler, ImageKit API requests, historical migration |
| `supabase/migrations/` | Incremental SQL security, commission-field and permission fixes; not a full schema |
| `supabase/tests/product_size_validator_permissions.sql` | Privileged transactional admin/non-admin product permission regression test |
| `scripts/test-*.mjs`, `scripts/test-*.cjs`, `scripts/validate-site.mjs` | Unit/source-contract/browser regression checks |
| `docs/simple-storefront-baseline.json` | Hashes of original scripts/handlers/IDs/form controls before the design rollout |
| `docs/meta-pixel.md`, `docs/imagekit-setup.md`, `SECURITY.md` | Integration/security detail and historic decisions |

Do not publish local demo folders, ZIP backups, `node_modules`, browser profiles, screenshots, test artifacts or `debug.log` as replacement source. A local simplified preview used mocked/disabled actions and is **not** the production app.

## 4. Local setup and safe development

1. Obtain repository access from the owner; clone with your own Git credentials:

   ```sh
   git clone https://github.com/YoussefMohamed108/3d.git
   cd 3d
   git switch -c your-scoped-change
   ```

2. Use a recent Node.js version for repository tests (Node 24 used for this release). Python is an optional simple static-server dependency. No production npm install is necessary.
3. Serve over HTTP, not `file://`. For example, from the repo root:

   ```sh
   python -m http.server 4176 --bind 127.0.0.1
   ```

   Open `http://127.0.0.1:4176/`. Keep this development server loopback-only: a generic static server may expose source/test files to anyone who can reach it. It does not emulate Vercel security headers or Supabase Functions.

4. The current browser configuration points at **production Supabase**. Catalog/settings reads are real. Admin writes, signup and order submission are real unless explicitly intercepted. Never create casual production test orders, accounts, uploads or deletions.
5. Localhost is NOT in the default Edge Function origin allowlist. Live write requests may correctly fail CORS locally. Use the fixture-only UI regression test or an isolated staging Supabase project. Do not weaken production CORS to `*` for convenience.
6. No frontend `.env` loader exists. Public Supabase origin/publishable key are in `index.html`, `verified.html` and the legacy fallback. A project switch requires updating all references and the CSP, plus staging Auth/functions/database/media configuration. Do not paste service-role credentials into those files.
7. Modern browser tests need Playwright resolvable by Node and installed browser binaries. Install it into a **separate tooling directory** and set `NODE_PATH` if not already provided by your development environment:

   ```sh
   npm install --prefix ../printx-test-tools playwright
   ../printx-test-tools/node_modules/.bin/playwright install chromium firefox webkit
   ```

   Point `NODE_PATH` at that tooling directory's `node_modules` (PowerShell: `$env:NODE_PATH='C:\path\printx-test-tools\node_modules'`; POSIX: `export NODE_PATH=/path/printx-test-tools/node_modules`). Browser tests use Playwright's normal browser cache, or `PLAYWRIGHT_BROWSERS_PATH` if configured. The release was tested with the existing bundled tooling rather than a committed dependency installation. Avoid adding generated dependencies/lockfiles accidentally.

## 5. Frontend modules and contracts

These are top-level lexical globals in inline scripts; do not assume each is a property on `window`. Search by module name; line numbers change frequently.

| Module/helper | Purpose and integration boundaries |
| --- | --- |
| `i18n`, translation maps, `t()` | EN/AR language, RTL and UI re-rendering; updates nav, info pages and dynamic content |
| `Store` | Supabase CRUD wrappers; local cart; Auth wrappers; public voucher RPC; image proxy calls |
| `collectionApp` | Public product/category fetch in parallel, cached in memory, search, multi-select categories, pagination, realtime refresh |
| `sortProducts` | Existing Hot/sale/order behavior; admin `sort_order` influences display; do not replace with a curated demo array |
| `productGallery` | Product detail modal, cover+gallery navigation, color/size selection, accessible buttons and add-to-cart |
| `cartApp` | Drawer, quantity/price display, voucher estimate, governorate/delivery, checkout validation and saved-order receipt |
| `authApp` | Sign-in/signup/resend/signout, profile lookups and role-dependent navigation |
| `adminApp` | Dashboard, protected products/orders/settings screens, variants, vouchers/categories, media and CRUD actions |
| `paymentUI` | Loads saved payment/contact numbers and refreshes corresponding live UI |
| `heroSlider` | Fetches admin `hero_slides` in `sort_order`; builds images/dots; prev/next, 4-second autoplay, admin refresh |
| `infoPages` / `INFO_CONTENT` / `INFO_CONTENT_AR` | Shipping, returns, FAQ and contact overlays |
| `shopPage` | Full catalog overlay and its filters/search |
| `handleForm(event)` | Original commission form validation and `create-custom-order` submission |
| `escapeHtml`, action dispatch/hover helpers | Escape untrusted content and handle original/dynamic UI actions; retain when refactoring |
| `optimizedImageUrl`, image source helpers | ImageKit resizing/format/srcset behavior; keep external-origin validation and contain behavior |

Preserve selector IDs, original `on*` attributes, dynamic action dispatcher targets and form field IDs unless updating every consumer and test. Many generated controls are built with template strings. An attractive static page can silently disable the store if these contracts disappear.

### The simplified design rollout

- The original production logic, all nonempty inline scripts (including translations/JSON-LD), event handlers, static IDs and form controls were preserved against baseline commit `cd44dbf9707ee53026d6dc787bf029cd8ad0eb95`.
- Keep `data-storefront-version="collector"` and `class="printx-simple"` on the body; the former remains an existing compatibility/validation marker.
- `simple-storefront.css?v=20261017` and `scripts/storefront-design.js?v=20261017` are loaded from the head. Bump cache-version strings when changing these assets in a future release.
- The studio eyebrow was removed at the owner's request; original title at left, original paragraph at right.
- The real custom form is inside native `details.simple-commission`, not replaced by a demo contact button.
- Nav becomes compact below/equal 1100px; username label alone is hidden at small widths, **not Admin/Logout/Cart actions**. Check both roles and both languages at narrow sizes.
- Hero content continues to come from admin records; the design script observes the existing slides and delegates to the real controls. It does not keep a second slide list. Without MutationObserver, its counter polls once per second.
- Product, gallery and hero images use contain-style presentation to avoid cropping. Some source images contain baked-in background/space; CSS cannot remove that without altering the image.
- Existing verification/admin/checkout functionality remains; their denser operational layouts were not rewritten as a new application.
- Preservation tests are deliberate rollout guards. For future legitimate business-logic changes, review/update these tests intentionally; never regenerate the hashes merely to make an unexplained diff pass.

## 6. Persistent data model and trust boundaries

This is the **application contract**, not complete SQL DDL. Inspect the live schema, constraints, triggers, grants, indexes and policies before migration. Table data is not in Git.

| Supabase resource | Expected use/fields |
| --- | --- |
| Auth users | Email/password, confirmation, session; profile linked by user UUID |
| `profiles` | `id`, `username`, `role`; server creates `customer`; admin authorization checks this role |
| `products` | UUID, name, class/category information, price/sale price, hidden flag, sort order, descriptions, image URL/path, parallel gallery URL/path arrays, color and size objects, timestamps |
| `categories` | Admin-managed category names/IDs; catalog filters and commission type choices |
| `hero_slides` | Numeric ID, `url`, `path`, `sort_order`; separate from selecting products in the catalog |
| `settings` | Key/value rows; `phone_instapay`, `phone_ewallet`, `phone_whatsapp`, and `delivery_<governorate key>` |
| `vouchers` | Code, discount type/value, active/expiry fields; admin manages rows, visitors validate one exact code through RPC |
| `orders` | Persisted server-priced items, quantities, variant names, total, delivery/discount, contact/address, method, status, user/reference timestamps |
| `custom_requests` | Contact, type, description, preferred size/budget/date, pending/completed state, timestamps |
| `rate_limit_hits` | Internal bucket/key/time records; service role only, no browser policies intentionally |
| `product-images` storage bucket | Legacy originals/recovery copies; ImageKit is current new-upload destination |

Important RPC/trigger functions: `is_admin()`, `validate_voucher(text)`, `check_rate_limit(...)`, `cleanup_rate_limit_hits()`, `handle_new_user()`, `prevent_role_self_escalation()`, `products_sizes_are_valid(jsonb)`, normalization/timestamp triggers. `is_admin()` returns a boolean for the current authenticated identity; it is not a replacement for RLS.

Browser state:

- `printx_cart` in localStorage: cart snapshot/variants/quantities; persists on this browser, **not a cross-device cloud saved-cart feature**.
- `printx_lang`: saved language.
- `printx-meta-purchases-v1`: last 100 tracked purchase IDs; in-memory fallback if blocked.
- `printx-firstorder-promo-v1` in sessionStorage: whether the offer dialog has been shown in this tab/session.
- Supabase SDK manages its own auth/session storage. Do not export it, log it or include callback fragments in screenshots shared publicly.
- Public catalog is primarily in-memory and refreshed from Supabase/Realtime, not an offline database.

## 7. Customer flows and business rules

### Catalog and product images

Public products/categories load in parallel. Hidden products are filtered by the client and must also be restricted by the live RLS configuration. Homepage pagination is eight products per page; full catalog has a separate overlay. Search/categories and original admin display order remain live.

Product detail combines cover and `gallery_urls`. Arrows/thumbnails/keyboard navigate; optional color and size must be selected before adding when more than one option exists. A selected size may override the displayed base price. Keep selected variants in the local cart, server request and saved order/notes.

The hero reads **`hero_slides`**, not automatically every product's cover. Admin adds/removes these separately in Store settings. A product edit does not automatically replace its old separately uploaded hero image. If no slides are returned, local `1.jpeg` is the fallback. First/next images are prioritized/warmed; later slides are deferred. Hero JPEG is deliberate for older Safari rendering compatibility.

### Checkout

Guest checkout is supported; account creation is not required. The frontend collects name, phone, address, city, governorate and optional notes. It displays an estimate, then calls `create-order` with IDs, quantities and selected variant names — **never trust a client-supplied price/discount/delivery total**.

`create-order` currently:

- Validates body/origin/method, cart UUIDs/quantities, contact/address lengths, governorate, payment method and variant membership.
- Caps 50 distinct request entries, 20 quantity per entry and 100 total quantity; body limit 64 KiB.
- Rate limits five attempts per ten minutes per IP bucket; fails closed if the limiter is unavailable.
- Reads current visible products, size/base/sale prices, governorate delivery setting and active/unexpired voucher itself.
- Applies **free shipping when product subtotal before voucher discount is >= EGP 1,000**. Changing this rule requires matching frontend estimate/promotion and backend constant.
- Accepts InstaPay, wallet and COD variants; UI `ewallet` maps to stored `vodafone`. Retain this mapping when changing payment labels.
- Saves the order before returning only the necessary receipt fields. Cart clears only after a successful response. Failed saves keep the cart for retry.
- Optionally sends Telegram a non-sensitive summary; no customer PII in the message. Notification failure is logged but does not undo an already-saved order.

InstaPay/wallet transfer and COD are manual operational workflows, not payment-provider confirmation. Staff must verify payment and communicate through WhatsApp. A displayed receipt is not proof that a transfer settled. There is no server-side order idempotency key currently: investigate repeated submissions/network retries before manually duplicating an order.

### Offer/voucher

The public offer is **FIRSTORDER, 15%**, not the superseded 50% request. Bar/dialog text does not create a voucher or enforce eligibility. The real voucher row controls active/expiry/type/value. Keep database configuration, EN/AR promo copy and server behavior aligned. The current backend checks code/active/expiry, not first-purchase history or a per-customer usage limit; the name alone does not enforce first-order-only redemption.

### Account creation and verification

Supabase sends email confirmation. Signup and resend explicitly set `https://printx-eg.com/verified.html` as `emailRedirectTo`; old homepage callback links are forwarded to the verification page. Auth URL configuration in the Supabase dashboard must allow the production site/callback and must not default public users to `localhost:3000`.

Existing-account signup feedback intentionally guides users to sign in; Supabase may conceal whether an email exists to discourage enumeration. Do not promise that every duplicate signup generates a distinct API error. Use trusted owner-controlled test accounts for email/resend checks; no throwaway production users without approval.

Important pre-existing limitation: `verified.html` can display success when callback parameters are present but the SDK/session check is unavailable or yields no session. This display is **not a cryptographic proof of verification**. Supabase Auth remains the authority. A future scoped fix should only claim success after a real verified session/validated callback and show recoverable error states otherwise; preserve old-browser usability while doing so. No auth logic was changed by the design release.

### Custom commissions

Open the native commission disclosure; all original fields remain. Browser honeypot silently absorbs obvious bots. The Edge Function independently validates name/email/phone/type, description 20–2000 characters, accepted sizes/budgets and optional date within about two years. Body limit 32 KiB; five attempts per ten minutes per IP. It inserts pending `custom_requests` and optionally sends a non-sensitive Telegram alert. These requests are **not Meta purchases** and do not mean the project/quote is accepted.

## 8. Administrator operating guide

1. Sign in with an owner-approved account whose **server-side profile** has `role='admin'`. Only a trusted operator may grant this role; never signup metadata or a public form. Use minimal individual accounts rather than shared credentials.
2. Open **Admin** in the header. The panel checks session/profile; backend RLS/media handler enforce authorization separately. Hiding the button is not a security boundary.
3. Overview shows catalog/visible/hidden counts, pending store orders, pending custom requests and active vouchers.
4. Products: add/edit name/details/categories, price/sale, colors, sizes/prices, visibility/order, cover and gallery. Add/edit invokes live database writes and uploads. A partially successful product save followed by image failure can leave a product needing attention; inspect rather than blindly re-adding it.
5. Images: new covers/galleries/hero uploads go through the admin-checked Edge Function into ImageKit automatically. Keep the URL together with its `imagekit:<fileId>` path so removal works. Gallery URL/path arrays must stay aligned by index.
6. Orders combines store orders and custom requests with filters/search, details and pending/completed actions. These views contain customer PII. Do not screenshot/export them into public Git issues or logs. Completing a record is an operational status change, not automatic payment settlement or a Meta event.
7. Store settings manages public payment/WhatsApp numbers, delivery fee per governorate, categories, vouchers and homepage hero images. Verify the customer-facing checkout/contact views after editing numbers/fees.
8. Product/slide/media deletion can be permanent, not a trash operation. Get an export/backup and explicit deletion intent first. Some ImageKit orphans can remain after failed saves/concurrent edits; review references before deleting any media.
9. The former **Move existing photos to ImageKit** quick-action button was removed by owner request. Do not re-add or run a mass migration automatically. The helper remains for controlled maintenance only.

Historic product-save error `permission denied for function products_sizes_are_valid` is addressed by `20261002110356_restore_product_size_validator_execution.sql`: the immutable SECURITY INVOKER JSON validator needs EXECUTE for `authenticated` because product checks run as the caller. Product writes still require admin through RLS. Do not disable the constraint or expose privileged helper functions to fix this symptom.

## 9. Media lifecycle, bandwidth and performance

See [imagekit setup](docs/imagekit-setup.md) for the handler's historical migration behavior. New uploads accept JPG/PNG/WebP/GIF, maximum 20 MiB, with byte-signature validation in browser/server. SVG is intentionally not accepted. The function verifies Auth + `is_admin()` on every action even though gateway JWT verification is disabled.

New uploads are **not automatically mirrored back to Supabase**. Retained Supabase originals are a recovery copy for historical migrated media, not a backup system for all new ImageKit files. Export/download new originals separately through an authorized media-backup workflow. Preserve both metadata and binary files.

ImageKit transformations/srcset/lazy loading reduce bytes delivered. Keep image containment, dimensions/aspect ratio and format fallback. Do not load full original covers/galleries on every catalog card or preload every hero slide. Eager-load only important visible imagery; do not lazy-load the only hero image with no fallback.

Supabase cached egress already consumed in a billing period cannot be undone. It may still grow because of old saved URLs/carts/tabs, historic links, remaining Supabase media, public traffic or the migration fetching originals. A URL served through ImageKit versus Supabase changes where bytes are counted; GitHub hosting is not the backend/media replacement here.

For usage checks, inspect the Supabase **organization** usage and project breakdown, ImageKit delivery/storage/transformation usage and Vercel bandwidth/requests for the **same time window**. Plan limits/reset dates change; this file intentionally does not quote an unverified current quota. Compare the growth rate after migration, not only the lifetime/current-period total. Do not delete recovery files just to make a usage chart decrease.

Performance work still available: pin/review the browser SDK dependency, progressively split the monolithic app, reduce unnecessary public product refetches/large metadata payloads, optimize uploaded source dimensions, monitor actual Core Web Vitals and real-device Safari. Measure before adding caches; never cache private responses or let displayed cart estimates become trusted prices.

## 10. External configuration and credentials

Get least-privilege access from the owner separately for GitHub, Vercel, Supabase, ImageKit, domain/DNS, Meta Business/Events Manager, Search Console, notification Telegram account and any BrowserStack testing account. Dashboard account ownership/2FA/recovery email is not defined by this source. Keep a private access/recovery register outside Git.

| Setting | Location | Notes |
| --- | --- | --- |
| Supabase origin / publishable browser key | Frontend source + verification + fallback | Expected public; RLS is essential. Never substitute service-role key |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` | Supabase Edge Function environment | Platform/server-side; service key bypasses RLS and is highly sensitive |
| `IMAGEKIT_PRIVATE_KEY` | Edge Function secrets | Server only; do not put in Vercel public variables/frontend/Git/chat |
| `IMAGEKIT_URL_ENDPOINT` | Edge secrets and matching browser endpoint | Must equal the configured PrintX endpoint; handler rejects mismatches |
| `ALLOWED_ORIGINS` (or singular fallback `ALLOWED_ORIGIN`) | Edge secrets | Comma-separated exact origins, no wildcard; defaults include production/www and historical `printx-eg.vercel.app` |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Edge secrets | Optional notifications; no secrets in error screenshots or request URLs shared publicly |
| Auth Site URL / allowed Redirect URLs / confirmation/password policies | Supabase Auth dashboard | Include production `verified.html`; verify SMTP and confirmation settings separately |
| Vercel Git connection/domain/branch/access protection | Vercel dashboard | Main production; preview URLs may be protected even when custom domain is public |
| Meta Pixel ID and access | Source / Meta dashboard | Public ID; no private Meta token currently needed for browser-only events |
| Search Console verification/DNS | Owner domain account / Google dashboard | Verification was previously reported incomplete; current status not verified by this release |

Never commit `.env`, service keys, private tokens, database dumps, customer exports or authenticated test-browser state. A BrowserStack key shared historically in chat should be rotated; do not reproduce it. If a secret is exposed, rotate/revoke it first, then assess history/access and notify the owner. Removing visible text alone does not revoke it.

## 11. Security baseline and outstanding work

[SECURITY.md](SECURITY.md) remains the detailed source record. Important controls:

- Server-assigned customer role and role-escalation protection; pinned function search paths.
- Public order/custom inserts routed through validated/rate-limited Functions; no browser service key.
- Exact-origin CORS, bounded JSON bodies, no-store responses, no permissive blanket `*`.
- Admin verification for media and RLS for direct database paths. CORS is not authentication and does not stop non-browser callers.
- Customer fields escaped before dynamic HTML; use `textContent` or `escapeHtml` for every new untrusted value. Admin order rendering is a stored-XSS-sensitive surface.
- Vercel headers include HSTS, CSP, frame denial, MIME-sniff protection, referrer/permissions and cross-origin policies. Update CSP intentionally when adding a domain, not by dropping it.
- CSP still contains `'unsafe-inline'` because inline scripts/event attributes remain. A file extraction alone does not justify removing it before all handlers are migrated and tested.
- `rate_limit_hits` intentionally has no browser policies; `validate_voucher` is public for exact active codes; `is_admin` is needed by existing policies.

Outstanding work explicitly **not** silently completed by this design release:

1. Audit/replace legacy duplicate permissive policies and overly broad grants in an approved maintenance window. PostgreSQL permissive policies can combine; do not assume that adding a new policy removed every older access path. Back up live schema/data and verify public reads plus admin/non-admin CRUD immediately afterward.
2. Strict verification-page success logic (see Section 7), including expired/replayed links and blocked SDK/session cases.
3. Reviewed dependency pinning/upgrades, CI gates, independent staging and periodic real-device testing.
4. Order idempotency, first-order-only voucher enforcement if desired, payment/stock workflow improvements only with explicit product decisions.
5. Consent/privacy notice and data-retention policy review with the owner; respecting GPC/DNT is not a full legal compliance assessment.
6. Complete encrypted database/Auth/media backups with restore drills and agreed retention/access. A source branch alone cannot restore the store.

Do not execute SQL snippets displayed in historical UI alerts blindly. Compare current schema/policies, use the checked-in migration approach and review the minimum grant required.

## 12. Analytics and discoverability

[Meta tracking detail](docs/meta-pixel.md): one PageView per full production load; AddToCart after saved local cart/positive quantity change; Purchase only after a successfully saved order ID + server total (EGP, including discounts/delivery). Purchase means **order placed**, not paid. Stable event IDs and remembered last 100 IDs deduplicate browser retries. No names, emails, phone/address/notes are sent by explicit commerce events. Custom requests/admin status changes do not send Purchase.

Loader only enables on HTTPS production/www homepage; skips auth-token/callback URLs, preview hosts, verification page, GPC and DNT. Meta is async and must not block shopping. Ad blockers/browser privacy can suppress events. No Conversions API. Static noscript pixel cannot inspect JS privacy preferences. Test in Meta Test Events with deliberate approval before submitting a real store order.

SEO source includes canonical/social metadata and JSON-LD, online-only identity, robots and sitemap. Product pages now have server-rendered `/products/<UUID>` URLs through Vercel Functions, with Product/Offer data and visible-product filtering. The static homepage sitemap remains; `/products-sitemap.xml` adds the live catalog. See the collector release guide for deployment and failure behavior. Preserve accurate shipping/returns/contact copy, EGP prices, admin descriptions and both language dictionaries. Do not substitute invented copy for approved wording.

Ask the owner to confirm Google Search Console ownership and submit/inspect `https://printx-eg.com/sitemap.xml`; do not claim verification from the existence of a sitemap. Check indexing and real product keywords/content before expanding SEO scope.

## 13. Test commands and what they prove

Run from repository root:

```sh
node scripts/validate-site.mjs
node --test scripts/test-simple-storefront.mjs scripts/test-meta-pixel.mjs scripts/test-imagekit.mjs scripts/test-security-hardening.mjs scripts/test-seo.mjs
node scripts/test-storefront-design.cjs
node scripts/test-browser-compat.cjs
node scripts/test-old-safari-fallback.cjs
node scripts/test-legacy-catalog.cjs
node scripts/test-verification-page.cjs
git diff --check
```

- Validator parses inline JS, checks key markup/contracts and security/SEO/admin requirements; it is not a full browser or live DB audit.
- Simple-storefront tests verify unchanged inline logic/translations/event handlers/IDs/form controls against the pre-release source, correct design assets and preserved commission form.
- Meta unit tests run isolated browser-like fixtures; ImageKit handler tests mock dependencies; security/SEO tests inspect source/config. They do not upload/delete real images or prove current dashboard configuration.
- `test-storefront-design.cjs` starts a loopback static server, reads the public catalog/settings/slides, checks Chromium/WebKit/Firefox, hero navigation, 32 width/language/role header layouts **per browser** with a visible two-digit cart badge and fonts loaded, search/category/gallery/variants/cart, voucher/checkout/custom response fixtures, auth dialogs and isolated admin navigation. External non-GET/HEAD requests are aborted unless fulfilled with test responses. No real order, commission, account, upload or admin write is created; protected admin data reads are stubbed. `BROWSERS=Chromium` (PowerShell `$env:BROWSERS='Chromium'`) narrows a run. These fixtures validate UI wiring, not live payment settlement or production backend writes.
- Browser-compat suite checks loaded catalog/hero images, compatible JPEG, loader fail-open and autoplay using public reads. It also records console/request errors; Firefox may surface an upstream Cloudflare cookie-domain warning even when content works. Inspect the exact failure, do not erase unrelated warnings or mistake them for a blank page.
- Old-Safari fallback checks WebKit with JavaScript disabled; legacy-catalog blocks the modern SDK and provides a fixture to verify the ES5 catalog/WhatsApp route. They do not prove every historic iOS version supports full modern checkout.
- Verification tests mock the SDK/session and confirm callback forwarding. They do not send email or solve the success-display limitation noted above.
- SQL permission regression requires an existing admin profile and a privileged connection; it creates temporary rows inside a transaction and rolls back. Run only with explicit database-testing approval; it is not part of the read-only design rollout.

Manual release checklist: guest and signed-in/admin headers; EN/AR; widths 320/375/390/640/800/1024/1280/1440; mobile menu; hero's actual admin images and controls; no image crop; product variants; cart/qty/voucher; all methods/governorates; dialogs close/Escape/focus; custom disclosure; support links; readable loading/error/empty states; keyboard/reduced motion; actual Safari on the affected device when available. An emulated viewport is not a real old iPhone.

## 14. Deployment and safe change procedure

1. Confirm which account/team/project/domain/branch you are changing. Inspect `git status`; preserve unrelated work. Fetch current `main` and inspect concurrent changes.
2. Back up source before rollout; include independent DB/media backups if touching data. Do not represent a source snapshot as a DB backup.
3. Make the smallest scoped change on a branch/current approved checkout. Preserve source copy and functional contracts. Update docs/tests in the same reviewed commit.
4. Run the relevant tests and inspect screenshots/browser flows, then get a second review for changes affecting checkout/auth/admin/security.
5. Publish the reviewed commit to `main` only with owner approval (this design rollout has that approval). Prefer normal fast-forward pushes/atomic commits, never force-push over concurrent work.
6. Vercel's connected Git project is expected to deploy main. Verify a new production deployment actually exists, matches the commit SHA and reaches READY. A GitHub commit alone is not proof the public site changed. Preview deployment access protection can differ from custom-domain access.
7. Verify `https://printx-eg.com/` plus new CSS/JS return successfully, inspect CSP and mobile page errors, confirm public catalog/hero load and checkout opens. Avoid real test submissions without authorization.
8. Supabase Functions/SQL are a **separate deployment**. A frontend Git push does not deploy them. For an approved backend change, review migration history/diff against the linked production project before using Supabase CLI `db push` or individual function deployment. Never run migrations automatically just to publish CSS.
9. Supabase CLI examples for an explicitly approved function release: `supabase link --project-ref dqdsgckzwiknmldhwjnw`, then `supabase functions deploy create-order`, `... create-custom-order` or `... imagekit-media` as required. Preserve the tracked JWT configuration. Secrets are provisioned separately in the dashboard/secure environment; do not type secret values into a shared transcript.
10. Record date, source SHA, deployment identifier, tests, any backend changes and rollback target. Keep private evidence containing PII outside Git.

## 15. Backup and rollback for the simplified-design release

Created **before** editing production source:

- Baseline commit: `cd44dbf9707ee53026d6dc787bf029cd8ad0eb95`.
- GitHub recovery branch: [`backup/pre-simplified-design-20261017`](https://github.com/YoussefMohamed108/3d/tree/backup/pre-simplified-design-20261017), pointing at that exact source.
- Local full tracked-source ZIP: `printx-before-simplified-design-20261017-cd44dbf.zip`, kept outside the publishable checkout in the owner's workspace `backups` directory.
- ZIP SHA-256: `002207495B024AAFD5F4765A9DB607D99D646FE9DF8A7BE1F8118327FDD58E42`.
- Previous production deployment identified before rollout: `dpl_EpN5Zak6r5euetzqEufXmCVxkS1w`. Confirm its availability/association in Vercel before selecting rollback.

This design release changes presentation/hero controls and adds tests/docs; **no database migration, customer/order modification, media migration or account/secret change** is required.

If the design causes an incident:

1. Identify the failed deployment/commit. For immediate recovery, an authorized owner can use Vercel's rollback/promote workflow for the verified previous production deployment; then make Git source consistent so the next push does not reintroduce the issue.
2. For durable source recovery, create a reviewed revert of the simplified-design commit on current main (find it with `git log --oneline`), test and push it. A revert preserves later commits; do not reset/force-push main to an old SHA.
3. If only the design layer must be removed, restore the baseline presentation markup and remove the new stylesheet/script references under review, retaining subsequent unrelated functionality. Use the backup branch as the comparison source, not a blind replacement of current main.
4. Recheck auth/cart/catalog/admin/Meta and production deployment. No database rollback is appropriate for a CSS-only failure.
5. Keep the backup branch and ZIP until the owner deliberately retires them. Backup retention is not guaranteed by an uncommitted local file; owner must maintain an off-device copy.

Older analytics backups: `backup/pre-meta-commerce-20261017` and `backup/pre-meta-pixel-20261017` are documented in `docs/meta-pixel.md`; use only for that scoped behavior, not to overwrite newer site changes.

## 16. Troubleshooting runbook

| Symptom | First checks / safe response |
| --- | --- |
| Blank/empty site, especially old iPhone | Record exact iOS/Safari version, page errors and failed resources; check SDK availability, loader fail-open, ES5 legacy fallback, JS support and images; retain static content if a script fails. Do not add newer syntax to fallback files |
| Hero empty | Read public `hero_slides`, active image URL/network/content type, CSP and fallback `1.jpeg`; preserve first active slide and JPEG compatibility; do not substitute a preview catalog |
| Hero controls absent | Check `.single`, number of slides, CSS specificity/z-index, new counter and original prev/next IDs. Admin-set slide count/order is the source of truth |
| Nav clipped or disconnected | Test sticky top0 at scroll and all role/EN/AR widths, not only document scrollWidth; hidden overflow can mask an offscreen button. Check actual action bounding rectangles |
| Product image appears cropped | Inspect contain vs cover on actual catalog/lightbox/hero selector and ImageKit transformation; distinguish crop from source image padding |
| Supabase egress rising after ImageKit | Inspect real image request host, old cart/tab URLs, remaining historical Supabase URLs and dashboard period; migration downloads and historic bytes do not disappear |
| Upload fails | Admin session/role, 20MiB/signature/type, function logs/origin, ImageKit endpoint/key/quota; preserve product record/original until upload verified |
| Product save validator permission error | Review October permission migration and live authenticated EXECUTE for `products_sizes_are_valid`; do not disable validation or RLS |
| Checkout fails CORS locally | Expected default allowlist behavior; use fixtures/staging, not wildcard production CORS |
| Checkout 429 / 503 | Rate-limit bucket or unavailable DB limiter; inspect Functions logs and RPC grants. Do not bypass limiter to hide errors |
| Checkout fails validation/price changed | Compare current product visibility/variant names, voucher state, configured governorate delivery fee; server total is authoritative |
| Customer sees receipt but staff sees no notification | Check saved order in protected admin first, then Telegram configuration/logs; don't ask customer to resubmit solely because Telegram failed |
| Verification redirects to localhost | Fix Supabase Site URL/redirect allowlist and send a NEW approved confirmation link; old emails can retain bad redirects |
| Duplicate signup does not say “already exists” | Check Auth anti-enumeration behavior and current sign-in/resend guidance; don't expose account existence unnecessarily |
| Admin unauthorized or cannot update | Check real auth session, profile role, current RLS/grants/function permissions; never work around with a public service key |
| Pixel not detected | Production host/path only, GPC/DNT, callback exclusion, ad blocker, CSP, correct Pixel ID and Meta account access; no localhost events expected |
| Browser suite Firefox cookie error only | Inspect whether catalog/images/hero/loader actually passed and distinguish upstream cookie warning from application page errors; record rather than claim a crash |
| GitHub changed but site did not | Vercel Git connection/main branch/commit SHA/build logs/READY state/custom-domain alias/cache; do not repeatedly force-push |
| Site shows tool/log text instead of markup | Inspect actual committed/deployed `index.html`; compare expected doctype/script contracts and backup. Never copy truncated terminal output into a production file |

Logs: browser DevTools for UI/network, Vercel deployment logs for static release, Supabase Function logs for endpoint errors and database logs/advisors for policies/RPC, ImageKit dashboard for delivery/uploads, Meta Test Events for measurement. Scrub PII/tokens before sharing any evidence.

## 17. Future-maintainer checklist and owner decisions

Before taking over, confirm owner access/recovery contacts, hosting/domain renewals, service plan/reset dates, notification recipient, payment numbers, delivery rates, returns/custom-order promises, database policy state, backup restore ability, Search Console verification and whether FIRSTORDER should truly be first-purchase-only. Do not infer missing business policy from a marketing phrase.

Prioritize small, measurable improvements: restore drills and CI/staging; strict verification error states; RLS/grant audit with approval; product-level SEO URLs; checkout idempotency; code modularization and stricter CSP; monitored image/egress budgets; real-device Safari and accessibility testing. These are **recommendations, not completed work or authorization to make changes**.

After every feature/integration/migration, update this handover, linked guides and relevant tests. Add newly discovered limitations honestly; preserve known-good backups and the ability to return to a working store.
