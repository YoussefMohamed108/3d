# PrintX Meta Pixel

Pixel ID: `1404442528337355`.

The public storefront loads `scripts/meta-pixel.js` with `defer`. Meta's SDK then
loads asynchronously and receives one `PageView` per full page load. Product
modals, anchor navigation, and cart changes do not send additional page views.
Automatic event detection is disabled. Explicit `AddToCart` and `Purchase`
events send public product IDs, quantities, EGP values, and an order reference.
Customer names, email addresses, phone numbers, addresses, and notes are excluded.
Conversions API is not configured.

## Commerce events

- `AddToCart`: after the cart is saved, including positive quantity increases.
  Only the quantity added in that action is counted. Sale and selected size
  prices are reflected in the event value.
- `Purchase`: after `create-order` returns a saved order ID and a valid total.
  The value comes from the server and includes applicable discounts and delivery.
  Opening checkout, validation errors, failed requests, and receipt rendering
  do not create purchase events.

For the current manual-transfer and cash-on-delivery checkout, `Purchase` means
**order placed**, rather than payment settled. Later admin status changes do not
send another purchase event. Custom commission requests are excluded.

The browser remembers the last 100 tracked order IDs to prevent repeated
purchase events across reloads. An in-memory fallback handles blocked storage.
Each purchase also has a stable Meta event ID, `printx-purchase-<order ID>`.
This is browser-side measurement; ad blockers and browser restrictions can
prevent events from reaching Meta.

The JavaScript loader runs on HTTPS `printx-eg.com` and `www.printx-eg.com` only.
It skips authentication callback URLs, the verification page, preview hosts,
Global Privacy Control, and Do Not Track. A standard image fallback is included
in the storefront body for visitors with JavaScript disabled. That static
fallback cannot inspect browser privacy signals.

`vercel.json` allows the Meta script from `connect.facebook.net` and tracking
requests to `www.facebook.com`. Other security restrictions remain in place.

## Verify in Meta

1. Open Meta Events Manager and select the data source with the Pixel ID above.
2. Open **Test events**, enter `https://printx-eg.com/`, and open the website.
3. Confirm a browser `PageView` arrives for this Pixel ID. Use a browser with
   ad blocking disabled for this test; browser privacy preferences still apply.
4. Continue the Pixel setup wizard. Business verification and dataset access
   remain settings in the Meta account.
5. Add a product to the cart and confirm `AddToCart` with its price and `EGP`.
   To check `Purchase`, use a deliberate test order and check its saved total.
   A real checkout test creates a store order; do not submit one accidentally.

## Local checks and rollback

Run `node --test scripts/test-meta-pixel.mjs` and
`node scripts/validate-site.mjs` before publishing changes to the loader.

The PageView-only version is commit
`91df9b99c8d42a877323114c54584a652e06042c`, preserved on
`backup/pre-meta-commerce-20261017`. Revert the commerce tracking commit to
restore that behavior while preserving later unrelated changes. The full
pre-Pixel source is preserved on `backup/pre-meta-pixel-20261017`.
No database or ImageKit changes are needed for either rollback.
