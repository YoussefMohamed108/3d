import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
const syntaxFailures = [];

scripts.forEach((match, index) => {
  try {
    Function(match[1]);
  } catch (error) {
    syntaxFailures.push(`script ${index + 1}: ${error.message}`);
  }
});

const tagPairs = ['main', 'section', 'form', 'nav'].map((tag) => ({
  tag,
  opens: (html.match(new RegExp(`<${tag}\\b`, 'g')) || []).length,
  closes: (html.match(new RegExp(`</${tag}>`, 'g')) || []).length,
}));

const required = [
  'meta name="description"',
  'og.png',
  'class="trust-strip"',
  'class="confidence-section"',
  'id="cf-budget"',
  'id="delivery-estimate"',
  'class="faq-preview"',
  'class="whatsapp-float',
  "rpc('validate_voucher'",
  "role: 'customer'",
];
const missing = required.filter((value) => !html.includes(value));

const markup = html.replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi, '');
const staticIds = [...markup.matchAll(/\bid="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((id) => !id.includes('${'));
const duplicateIds = [...new Set(staticIds.filter((id, index) => staticIds.indexOf(id) !== index))];
const orphanLabels = [...new Set(
  [...markup.matchAll(/\bfor="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((id) => !id.includes('${') && !staticIds.includes(id)),
)];

const adminChecks = [
  'id="admin-page-dashboard"',
  'role="tablist"',
  'id="orders-filter-type"',
  'id="orders-filter-status"',
  'id="admin-status"',
  'handlePanelKeydown(event)',
  'handleModalKeydown(event)',
  'r.preferred_size',
  'r.budget_range',
  'r.desired_deadline',
];
const missingAdminChecks = adminChecks.filter((value) => !html.includes(value));

const storefrontChecks = [
  'class="store-announcement"',
  'aria-label="Store announcement"',
  'class="nav-shop-primary"',
  'class="hero-proof"',
  'class="catalog-toolbar"',
  'aria-live="polite" id="shop-count"',
  'class="product-card-actions"',
  'class="custom-service-card"',
  'class="supporting-story"',
  'class="footer-primary-link"',
  'data-storefront-version="collector"',
  'aria-labelledby="cart-title"',
  'class="checkout-primary-zone"',
  'class="product-detail-primary"',
  'aria-label="Search catalog"',
  'aria-label="Filter figures by category"',
  'touch-action: manipulation',
  'outline: 3px solid #fbbf24',
  '@media (prefers-reduced-motion: reduce)',
  'preferred_size: preferredSize',
  'budget_range: budgetRange',
  'desired_deadline: desiredDeadline',
  'missingStructuredColumn',
];
const missingStorefrontChecks = storefrontChecks.filter((value) => !html.includes(value));

const storefrontOrder = {
  hero: markup.indexOf('<section id="hero">'),
  shop: markup.indexOf('<section id="shop">'),
  confidence: markup.indexOf('<section class="confidence-section"'),
};
const storefrontOrderValid = storefrontOrder.hero >= 0 &&
  storefrontOrder.shop > storefrontOrder.hero &&
  storefrontOrder.confidence > storefrontOrder.shop;

const unscopedNavRules = [...html.matchAll(/(?:^|\n)\s*nav(?:\.scrolled)?\s*\{/g)].length;

const readZIndex = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`${escaped}\\s*\\{[^}]*z-index:\\s*(\\d+)`, 's'));
  return match ? Number(match[1]) : null;
};
const overlayLayers = {
  whatsapp: readZIndex('.whatsapp-float'),
  cart: readZIndex('#cart-panel'),
  admin: readZIndex('#admin-panel'),
};
const overlayLayerValid = Object.values(overlayLayers).every(Number.isFinite) &&
  overlayLayers.whatsapp < overlayLayers.cart && overlayLayers.whatsapp < overlayLayers.admin;

JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));

const result = {
  scripts: scripts.length,
  syntaxFailures,
  tagPairs,
  requiredChecks: required.length,
  missing,
  adminChecks: adminChecks.length,
  missingAdminChecks,
  storefrontChecks: storefrontChecks.length,
  missingStorefrontChecks,
  storefrontOrder,
  storefrontOrderValid,
  unscopedNavRules,
  duplicateIds,
  orphanLabels,
  overlayLayers,
  overlayLayerValid,
};
console.log(JSON.stringify(result, null, 2));

if (
  syntaxFailures.length || missing.length || missingAdminChecks.length || missingStorefrontChecks.length ||
  duplicateIds.length || orphanLabels.length || !overlayLayerValid || !storefrontOrderValid || unscopedNavRules > 0 ||
  tagPairs.some(({ opens, closes }) => opens !== closes)
) {
  process.exitCode = 1;
}
