const MAX_BYTES = 20 * 1024 * 1024;
const ENDPOINT = 'https://ik.imagekit.io/bxk734nq4h';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store' };
class MediaError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function imageType(bytes) {
  const prefix = Array.from(bytes.slice(0, 4), b => b.toString(16).padStart(2, '0')).join('');
  if (prefix.startsWith('ffd8ff')) return ['image/jpeg', 'jpg'];
  if (prefix === '89504e47') return ['image/png', 'png'];
  if (prefix === '47494638') return ['image/gif', 'gif'];
  if (prefix === '52494646' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return ['image/webp', 'webp'];
  throw new MediaError('Use a JPG, PNG, WebP, or GIF image.');
}
export async function handleRequest(req, deps) {
  const respond = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405);
  try {
    const base = deps.env('SUPABASE_URL');
    const apiKey = deps.env('SUPABASE_ANON_KEY');
    const authorization = req.headers.get('authorization') || '';
    if (!authorization.startsWith('Bearer ')) throw new MediaError('Sign in as an administrator.', 401);
    const headers = { apikey: apiKey, Authorization: authorization };
    const user = await deps.fetch(base + '/auth/v1/user', { headers });
    if (!user.ok || !(await user.json()).id) throw new MediaError('Your session has expired. Sign in again.', 401);
    const admin = await deps.fetch(base + '/rest/v1/rpc/is_admin', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}' });
    if (!admin.ok || await admin.json() !== true) throw new MediaError('Administrator access required.', 403);
    const privateKey = deps.env('IMAGEKIT_PRIVATE_KEY');
    if (!privateKey) throw new MediaError('Add IMAGEKIT_PRIVATE_KEY to the Supabase Edge Function secrets to enable ImageKit.', 503);
    const endpoint = (deps.env('IMAGEKIT_URL_ENDPOINT') || ENDPOINT).replace(/\/$/, '');
    if (endpoint !== ENDPOINT) throw new MediaError('ImageKit endpoint does not match the storefront configuration.', 503);
    const ikHeaders = { Authorization: 'Basic ' + btoa(privateKey + ':') };
    async function db(path, options = {}) {
      const response = await deps.fetch(base + '/rest/v1/' + path, { ...options, headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation', ...options.headers } });
      if (!response.ok) throw new MediaError('Could not read or save the image record.', 502);
      return response.json();
    }
    async function upload(file, fileName, folder) {
      const body = new FormData();
      body.set('file', file);
      body.set('fileName', fileName);
      body.set('folder', '/printx/' + folder);
      body.set('useUniqueFileName', 'true');
      const response = await deps.fetch('https://upload.imagekit.io/api/v1/files/upload', { method: 'POST', headers: ikHeaders, body, signal: AbortSignal.timeout(90000) });
      if (!response.ok) throw new MediaError('ImageKit upload failed. Check the API key and account quota.', 502);
      const result = await response.json();
      if (!result.fileId || !result.url?.startsWith(endpoint + '/') || result.fileType !== 'image') throw new MediaError('ImageKit did not return a valid image.', 502);
      const check = await deps.fetch(result.url + '?tr=w-80,q-60', { signal: AbortSignal.timeout(20000) });
      const valid = check.ok && (check.headers.get('content-type') || '').startsWith('image/');
      await check.body?.cancel();
      if (!valid) throw new MediaError('ImageKit image could not be verified; the original is still in use.', 502);
      return { publicUrl: result.url, path: 'imagekit:' + result.fileId };
    }
    if ((req.headers.get('content-type') || '').startsWith('multipart/form-data')) {
      if (Number(req.headers.get('content-length')) > MAX_BYTES + 65536) throw new MediaError('Image exceeds 20 MB.', 413);
      const form = await req.formData();
      const file = form.get('file');
      if (!(file instanceof Blob) || !file.size || file.size > MAX_BYTES) throw new MediaError('Choose an image smaller than 20 MB.', 413);
      const [mime, ext] = imageType(new Uint8Array(await file.slice(0, 12).arrayBuffer()));
      const folder = form.get('folder') === 'hero' ? 'hero' : 'products';
      return respond(await upload(new Blob([file], { type: mime }), crypto.randomUUID() + '.' + ext, folder));
    }
    const body = await req.json();
    if (body.action === 'status') {
      const account = await deps.fetch('https://api.imagekit.io/v1/files?limit=1', { headers: ikHeaders, signal: AbortSignal.timeout(15000) });
      await account.body?.cancel();
      if (!account.ok) throw new MediaError('ImageKit could not authenticate. Check IMAGEKIT_PRIVATE_KEY.', 503);
      return respond({ ready: true, endpoint });
    }
    if (body.action === 'delete') {
      const id = String(body.path || '').replace(/^imagekit:/, '');
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id) || !String(body.path).startsWith('imagekit:')) throw new MediaError('Invalid image reference.');
      const url = 'https://api.imagekit.io/v1/files/' + id;
      const details = await deps.fetch(url + '/details', { headers: ikHeaders });
      if (details.status === 404) return respond({ deleted: true });
      if (!details.ok || !(await details.json()).filePath?.startsWith('/printx/')) throw new MediaError('Image is outside the PrintX folder.', 403);
      const removed = await deps.fetch(url, { method: 'DELETE', headers: ikHeaders });
      if (!removed.ok && removed.status !== 404) throw new MediaError('Could not delete the ImageKit image.', 502);
      return respond({ deleted: true });
    }
    if (body.action !== 'migrate' || !['products', 'hero_slides'].includes(body.table) || !/^[0-9a-f-]{36}$/i.test(body.id || '')) throw new MediaError('Invalid migration request.');
    const rows = await db(body.table + '?id=eq.' + body.id + '&select=*');
    const row = rows[0];
    if (!row) throw new MediaError('Image record no longer exists.', 404);
    const gallery = body.slot === 'gallery';
    if (gallery && (body.table !== 'products' || !Number.isInteger(body.index) || body.index < 0)) throw new MediaError('Invalid gallery index.');
    if (!gallery && body.slot !== 'cover') throw new MediaError('Invalid image slot.');
    const field = body.table === 'hero_slides' ? 'url' : gallery ? 'gallery_urls' : 'image_url';
    const pathField = body.table === 'hero_slides' ? 'path' : gallery ? 'gallery_paths' : 'image_path';
    const source = gallery ? row[field]?.[body.index] : row[field];
    const originPrefix = base + '/storage/v1/object/public/product-images/';
    if (!source?.startsWith(originPrefix)) return respond({ skipped: true });
    const objectPath = source.slice(originPrefix.length);
    if (objectPath.includes('?') || objectPath.includes('#') || objectPath.split('/').includes('..')) throw new MediaError('Unsupported source image path.');
    const result = await upload(source, objectPath.split('/').pop(), body.table === 'hero_slides' ? 'hero' : 'products');
    const values = { [field]: result.publicUrl, [pathField]: result.path };
    let condition;
    if (gallery) {
      values[field] = [...row[field]];
      values[pathField] = [...(row[pathField] || [])];
      values[field][body.index] = result.publicUrl;
      values[pathField][body.index] = result.path;
      condition = 'gallery_urls=eq.' + encodeURIComponent(JSON.stringify(row[field]).replace(/^\[/, '{').replace(/\]$/, '}'));
    } else {
      condition = field + '=eq.' + encodeURIComponent(source);
    }
    const saved = await db(body.table + '?id=eq.' + body.id + '&' + condition, { method: 'PATCH', body: JSON.stringify(values) });
    if (!saved.length) throw new MediaError('This image changed during migration. Refresh and retry.', 409);
    // Supabase originals are deliberately retained for recovery.
    return respond({ migrated: true, ...result });
  } catch (error) {
    return respond({ error: error instanceof MediaError ? error.message : 'Image operation failed. Please retry.' }, error instanceof MediaError ? error.status : 500);
  }
}
