/* Public ImageKit endpoint only. The private key belongs in Edge Function secrets. */
window.PrintXMedia = {
  endpoint: 'https://ik.imagekit.io/bxk734nq4h',
  async request(client, body) {
    const { data, error } = await client.functions.invoke('imagekit-media', { body });
    if (error) {
      let message = error.message;
      try { message = (await error.context.json()).error || message; } catch {}
      throw new Error(message || 'Image operation failed.');
    }
    if (data && data.error) throw new Error(data.error);
    return data;
  },
  async upload(client, file, folder = 'products') {
    const body = new FormData();
    body.append('file', file);
    body.append('folder', folder);
    return this.request(client, body);
  },
  async remove(client, path) {
    if (!path) return;
    if (path.startsWith('imagekit:')) return this.request(client, { action: 'delete', path });
    const { error } = await client.storage.from('product-images').remove([path]);
    if (error) throw error;
  },
  async migrate(client, button) {
    const status = document.getElementById('imagekit-migration-status');
    button.disabled = true;
    let completed = 0;
    try {
      status.textContent = 'Checking image hosting…';
      await this.request(client, { action: 'status' });
      const [products, slides] = await Promise.all([
        client.from('products').select('id,image_url,gallery_urls'),
        client.from('hero_slides').select('id,url')
      ]);
      if (products.error || slides.error) throw new Error('Could not load the image list.');
      const tasks = [];
      const legacy = url => typeof url === 'string' && url.startsWith('https://dqdsgckzwiknmldhwjnw.supabase.co/storage/v1/object/public/product-images/');
      for (const p of products.data) {
        if (legacy(p.image_url)) tasks.push({ table: 'products', id: p.id, slot: 'cover' });
        (p.gallery_urls || []).forEach((url, index) => {
          if (legacy(url)) tasks.push({ table: 'products', id: p.id, slot: 'gallery', index });
        });
      }
      for (const slide of slides.data) if (legacy(slide.url)) tasks.push({ table: 'hero_slides', id: slide.id, slot: 'cover' });
      for (const task of tasks) {
        status.textContent = `Moving image ${completed + 1} of ${tasks.length}. Keep this page open…`;
        await this.request(client, { action: 'migrate', ...task });
        completed++;
      }
      status.textContent = `Finished: ${completed} images processed. Refresh the storefront to load the updated photos.`;
    } catch (error) {
      status.textContent = `${completed} images processed. ${error.message} You can retry to continue with the remaining images.`;
    } finally { button.disabled = false; }
  }
};

