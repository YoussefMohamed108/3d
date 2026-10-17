# ImageKit image hosting

The storefront uses `https://ik.imagekit.io/bxk734nq4h`. Product data, accounts, and orders remain in Supabase. ImageKit media requests are authorized by the existing Supabase admin role; the private ImageKit API key is never sent to the browser.

## Activate

1. In the Supabase project `dqdsgckzwiknmldhwjnw`, open Edge Functions → Secrets. Set `IMAGEKIT_PRIVATE_KEY` to the ImageKit private API key and `IMAGEKIT_URL_ENDPOINT` to `https://ik.imagekit.io/bxk734nq4h`. Never commit the private key.
2. Deploy `supabase/functions/imagekit-media/index.js` as `imagekit-media`. Its handler validates the caller with Supabase Auth and checks `is_admin()`; gateway JWT verification is disabled to support the project's current keys.
3. Publish the frontend, including `scripts/imagekit-media.js`, the updated image helpers, and the ImageKit domain in the image CSP.
4. New cover/gallery/hero uploads use ImageKit automatically. The historical **Move existing photos to ImageKit** quick-action button has been removed by owner request. Its migration helper remains in source for controlled maintenance only; do not re-enable or run a bulk migration without a fresh metadata backup and owner approval. When deliberately invoked, it handles covers, galleries and homepage slides, can resume after an interruption, and skips URLs already moved.
5. Verify a new cover/gallery/slide upload, image removal, and desktop/mobile image display before treating the switch as complete.

## Migration behavior

The server copies each original into the ImageKit `/printx` folder and verifies that ImageKit serves an image before updating its database URL. It checks the old URL while saving to avoid overwriting a concurrent edit. Existing Supabase files are retained for recovery; deleting them is a separate cleanup operation. Old open browser tabs and stored carts may continue to request their saved Supabase URLs until refreshed.

ImageKit copies may remain unreferenced if a request is interrupted after upload or a concurrent edit is detected. Review these in the ImageKit media library before deleting anything. Supabase bandwidth already used this billing cycle cannot be undone. This migration itself downloads each original once into ImageKit.

New ImageKit uploads are not automatically copied into Supabase. Historical retained Supabase originals are recovery copies for migrated files only; arrange a separate backup of new ImageKit originals and their URL/file-ID metadata. See [the full handover](../handover.md).

## Rollback

Before migration, save the product and hero-slide image URL/path fields using the Supabase dashboard or an authorized database client. The original files remain available. Restore those fields and the previous frontend revision to return delivery and uploads to Supabase. Do not delete migrated or original files until rollback is no longer needed.
