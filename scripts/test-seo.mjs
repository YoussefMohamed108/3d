import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const html = fs.readFileSync(new URL('index.html', root), 'utf8');
const robots = fs.readFileSync(new URL('robots.txt', root), 'utf8');
const sitemap = fs.readFileSync(new URL('sitemap.xml', root), 'utf8');

const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

expect(html.includes('<link rel="canonical" href="https://printx-eg.com/" />'), 'Missing canonical homepage URL');
expect(html.includes('<meta property="og:url" content="https://printx-eg.com/" />'), 'Missing absolute Open Graph URL');
expect(html.includes('<meta property="og:image" content="https://printx-eg.com/og.png" />'), 'Open Graph image must be absolute');
expect(html.includes('<meta name="twitter:image" content="https://printx-eg.com/og.png" />'), 'Twitter image must be absolute');
expect(robots.includes('Sitemap: https://printx-eg.com/sitemap.xml'), 'robots.txt must advertise the sitemap');
expect(sitemap.includes('<loc>https://printx-eg.com/</loc>'), 'Sitemap must include the canonical homepage');
expect(!sitemap.includes('verified.html'), 'Noindex verification page must not be in the sitemap');
expect(html.includes('https://www.instagram.com/printxstudio.eg/'), 'Missing stable Instagram profile URL');
expect(html.includes('https://www.facebook.com/profile.php?id=61594069827538'), 'Missing stable Facebook profile URL');

const jsonLdBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
expect(jsonLdBlocks.length > 0, 'Missing JSON-LD structured data');

for (const [index, match] of jsonLdBlocks.entries()) {
  try {
    const data = JSON.parse(match[1]);
    if (index === 0) {
      const types = (data['@graph'] || []).map((node) => node['@type']);
      for (const type of ['OnlineStore', 'WebSite', 'WebPage']) {
        expect(types.includes(type), `Missing ${type} schema`);
      }
      const store = (data['@graph'] || []).find((node) => node['@type'] === 'OnlineStore');
      expect(store?.sameAs?.length === 2, 'OnlineStore schema must include both verified social profiles');
    }
  } catch (error) {
    failures.push(`Invalid JSON-LD block ${index + 1}: ${error.message}`);
  }
}

console.log(JSON.stringify({
  canonical: 'https://printx-eg.com/',
  sitemapUrls: [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]),
  structuredDataBlocks: jsonLdBlocks.length,
  failures,
}, null, 2));

if (failures.length) process.exitCode = 1;