import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest, imageType } from '../supabase/functions/imagekit-media/handler.mjs';

const base = 'https://dqdsgckzwiknmldhwjnw.supabase.co';
const source = base + '/storage/v1/object/public/product-images/products/cover.jpg';
const destination = 'https://ik.imagekit.io/bxk734nq4h/printx/products/cover.jpg';
const id = '12345678-1234-1234-1234-123456789abc';
const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
function fixture({ admin = true, key = 'test-key', imageOk = true, conflict = false, row = { id, image_url: source, image_path: 'products/cover.jpg' } } = {}) {
  const calls = [];
  const deps = {
    env: name => ({ SUPABASE_URL: base, SUPABASE_ANON_KEY: 'test-anon', IMAGEKIT_PRIVATE_KEY: key })[name],
    fetch: async (url, options = {}) => {
      calls.push({ url, ...options });
      if (url.endsWith('/auth/v1/user')) return json({ id });
      if (url.endsWith('/rpc/is_admin')) return json(admin);
      if (url.includes('/rest/v1/products?')) return json(options.method === 'PATCH' ? conflict ? [] : [row] : [row]);
      if (url === 'https://upload.imagekit.io/api/v1/files/upload') return json({ fileId: 'file123', fileType: 'image', url: destination });
      if (url.startsWith(destination)) return new Response('image', { status: imageOk ? 200 : 404, headers: { 'Content-Type': imageOk ? 'image/jpeg' : 'text/plain' } });
      throw new Error('Unexpected request: ' + url);
    }
  };
  return { deps, calls };
}
function request(body, auth = true) {
  return new Request('https://example.com/imagekit-media', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer test-session' } : {}) }, body: JSON.stringify(body) });
}
const migration = { action: 'migrate', table: 'products', id, slot: 'cover' };
test('unauthenticated callers cannot trigger any upstream operation', async () => {
  const { deps, calls } = fixture();
  assert.equal((await handleRequest(request({ action: 'status' }, false), deps)).status, 401);
  assert.equal(calls.length, 0);
});
test('non-admin users cannot access ImageKit', async () => {
  const { deps, calls } = fixture({ admin: false });
  assert.equal((await handleRequest(request(migration), deps)).status, 403);
  assert.equal(calls.length, 2);
});
test('missing key gives an actionable error without touching images', async () => {
  const { deps, calls } = fixture({ key: '' });
  assert.equal((await handleRequest(request(migration), deps)).status, 503);
  assert.equal(calls.length, 2);
});
test('migration verifies the copy and uses a conditional update without deleting originals', async () => {
  const { deps, calls } = fixture();
  const response = await handleRequest(request(migration), deps);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).migrated, true);
  const patch = calls.find(call => call.method === 'PATCH');
  assert.ok(patch.url.includes(encodeURIComponent(source)));
  assert.deepEqual(JSON.parse(patch.body), { image_url: destination, image_path: 'imagekit:file123' });
  assert.equal(calls.some(call => call.method === 'DELETE'), false);
});
test('failed image verification leaves the original URL untouched', async () => {
  const { deps, calls } = fixture({ imageOk: false });
  assert.equal((await handleRequest(request(migration), deps)).status, 502);
  assert.equal(calls.some(call => call.method === 'PATCH'), false);
});
test('migration skips images already moved and does not fetch arbitrary URLs', async () => {
  for (const image_url of [destination, 'https://unrelated.example/photo.jpg']) {
    const { deps, calls } = fixture({ row: { id, image_url } });
    assert.equal((await (await handleRequest(request(migration), deps)).json()).skipped, true);
    assert.equal(calls.length, 3);
  }
});
test('concurrent edits cause a conflict instead of reporting success', async () => {
  const { deps } = fixture({ conflict: true });
  assert.equal((await handleRequest(request(migration), deps)).status, 409);
});
test('gallery migration changes only the requested image and guards the whole old array', async () => {
  const other = source.replace('cover.jpg', 'other.jpg');
  const { deps, calls } = fixture({ row: { id, gallery_urls: [other, source], gallery_paths: ['products/other.jpg', 'products/cover.jpg'] } });
  const response = await handleRequest(request({ ...migration, slot: 'gallery', index: 1 }), deps);
  assert.equal(response.status, 200);
  const patch = calls.find(call => call.method === 'PATCH');
  assert.ok(decodeURIComponent(patch.url).includes('gallery_urls=eq.{'));
  assert.deepEqual(JSON.parse(patch.body), { gallery_urls: [other, destination], gallery_paths: ['products/other.jpg', 'imagekit:file123'] });
});
test('hero slides accept their numeric database IDs', async () => {
  const { deps, calls } = fixture();
  deps.fetch = async (url, options = {}) => {
    calls.push({ url, ...options });
    if (url.endsWith('/auth/v1/user')) return json({ id });
    if (url.endsWith('/rpc/is_admin')) return json(true);
    if (url.includes('/rest/v1/hero_slides?')) return json(options.method === 'PATCH' ? [{ id: 1 }] : [{ id: 1, url: source, path: 'hero/slide.jpg' }]);
    if (url === 'https://upload.imagekit.io/api/v1/files/upload') return json({ fileId: 'file123', fileType: 'image', url: destination });
    if (url.startsWith(destination)) return new Response('image', { headers: { 'Content-Type': 'image/jpeg' } });
    throw new Error('Unexpected request: ' + url);
  };
  const response = await handleRequest(request({ action: 'migrate', table: 'hero_slides', id: 1, slot: 'cover' }), deps);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).migrated, true);
});
test('invalid upload bytes cannot reach ImageKit', async () => {
  const { deps, calls } = fixture();
  const form = new FormData();
  form.append('file', new Blob(['<script>alert(1)</script>'], { type: 'image/jpeg' }), 'fake.jpg');
  const response = await handleRequest(new Request('https://example.com', { method: 'POST', headers: { Authorization: 'Bearer test-session' }, body: form }), deps);
  assert.equal(response.status, 400);
  assert.equal(calls.length, 2);
});
test('WebP signatures require both RIFF and WEBP markers', () => {
  assert.deepEqual(imageType(new TextEncoder().encode('RIFF0000WEBP')), ['image/webp', 'webp']);
  assert.throws(() => imageType(new TextEncoder().encode('FAKE0000WEBP')));
});

