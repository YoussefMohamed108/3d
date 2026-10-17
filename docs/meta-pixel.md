# PrintX Meta Pixel

Pixel ID: `1404442528337355`.

The public storefront loads `scripts/meta-pixel.js` with `defer`. Meta's SDK then
loads asynchronously and receives one `PageView` per full page load. Product
modals, anchor navigation, and cart changes do not send additional page views.
Automatic event detection is disabled; this installation does not send form
fields or implement `Purchase`, `AddToCart`, or Conversions API events.

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

## Local checks and rollback

Run `node --test scripts/test-meta-pixel.mjs` and
`node scripts/validate-site.mjs` before publishing changes to the loader.

The previous production source is commit
`28e8c383766e1561a75ac787ea2e430e073097d9`. To remove this integration, revert
the Pixel installation commit in GitHub, preserving later unrelated changes.
No database or ImageKit changes are needed.
