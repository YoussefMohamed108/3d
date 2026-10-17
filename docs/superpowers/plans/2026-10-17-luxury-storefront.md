# Luxury Storefront Implementation Plan

> **For agentic workers:** Execute inline using executing-plans; obtain an independent final code review.

**Goal:** Implement the owner's approved luxury storefront, motion, discovery, product information and checkout improvements.

**Architecture:** Keep the existing vanilla store, Supabase authorization, server pricing and admin. Add isolated enhancement modules and scoped CSS. Store optional public editorial content in an admin-managed settings record. Serve indexable product URLs through Vercel; retain the original shopping flow. Prepare independently deployed backend idempotency changes.

**Tech Stack:** HTML, CSS, JavaScript, Vercel Functions, Supabase/Deno/PostgreSQL; Node tests and Playwright.

**Spec:** Owner's approved upgrade list in the conversation, 2026-10-17.

## Global Constraints

- Preserve existing inline scripts, selectors, forms, translations and event handlers through additive hooks.
- Preserve EGP pricing and free delivery at EGP 1,000 before discounts; server remains authoritative.
- No fabricated reviews, specifications, founder history, media or new business guarantees.
- English/Arabic, RTL, reduced motion, keyboard operation and graceful enhancement failure.
- No production test orders, accounts, uploads or SQL execution.
- Branch/PR delivery; independently deployed SQL/functions must be identified explicitly.

## Review Focus

- Selected-size prices and required variants must match the original cart and server.
- Public saved products and routes must exclude hidden/removed records.
- Untrusted editorial content/URLs must not introduce HTML/script injection.
- Failed/retried orders must keep the cart and avoid duplicate writes.
- New overlays must preserve focus, scrolling, touch access and narrow layouts.

## Task 1: Luxury presentation and discovery

Files: `luxury-storefront.css`, `scripts/luxury-core.js`, `scripts/luxury-storefront.js`, `index.html`, `scripts/promotion.js`.

- [x] Add unit tests for variant pricing, visible curated products, recommendations and untrusted media.
- [x] Implement pure helpers and scoped presentation; preserve existing inline logic.
- [x] Add featured collection, category routes, saved pieces, hover imagery, hero links and motion.
- [x] Verify original preservation tests and browser layouts.

## Task 2: Product content and commerce

Files: `scripts/luxury-content.js`, `scripts/luxury-commerce.js`, `scripts/meta-pixel.js`.

- [x] Add admin fields for real specifications, hero mappings, editorial/media content and approved testimonials.
- [x] Display optional content only when supplied; add zoom, swipe, recommendations, share links and mobile purchase controls.
- [x] Add delivery estimation, shipping progress, payment guidance, checkout field retention, saved-order reference and submit guard.
- [x] Add privacy-gated ViewContent/InitiateCheckout events; test without real external writes.

## Task 3: Product URLs and reliable retries

Files: `api/product.js`, `api/sitemap.js`, `vercel.json`, `supabase/functions/create-order/index.ts`, `supabase/functions/create-order/idempotency.mjs`, new migration.

- [x] Write server-route and idempotency tests; verify failure before implementation.
- [x] Add server-rendered product metadata/JSON-LD, visible-product sitemap and safe not-found states.
- [x] Add optional idempotency keys with atomic uniqueness; preserve legacy callers.
- [x] Document separate backend deployment order and limitations.

## Task 4: Verify and deliver

- [x] Run original nonmutating checks and focused browser regressions at mobile/desktop in both languages.
- [x] Inspect rendered screenshots and request an independent whole-branch review.
- [x] Resolve material findings, update handover and asset checklist, and prepare the reviewed branch for GitHub delivery.

## Decisions and progress

- Source baseline: `04d6865b2abbfce3c7b175abc235791b66dd0f8f`. Baseline validator and 42 unit/source checks passed.
- Existing enhancement/preservation architecture retained; new assets are optional, not invented.
- New photography, actual reviews, founder biography and gift packaging service cannot be manufactured by a code change. Site support and an explicit content checklist are included.

- Verification: 59 unit/source checks and validator passed; Chromium original smoke passed 32 header layouts and commerce/admin flows. Focused luxury browser checks passed including failed/retried checkout and admin draft isolation. Screenshots inspected at 1440px and 390px, Arabic included.
- Additional fixes verified RED→GREEN: malformed content normalization; non-object checkout JSON; gallery close/reopen race; static sitemap shadowing.
- Dynamic product sitemap uses a separate advertised path to preserve the original homepage sitemap and avoid filesystem precedence. No production data changed.

- Final review: three important findings, all fixed with RED→GREEN regression evidence: gallery stacking above the full catalog; locale-independent customer notes/retry identity; explicit hidden-state styles for hero and zoom controls. No critical or minor findings remain.
- Final verification: validator plus 60 unit/source checks passed; focused Chromium flow passed all review regressions, variants, retry, receipt, RTL and admin draft checks. Original 32-layout smoke rerun before delivery.
- Deployment boundaries: live Supabase RLS/migration/payment/Telegram, Vercel production routing, other browser engines and future asset authenticity are not claimed by local fixture results. See release guide for checks before production.
