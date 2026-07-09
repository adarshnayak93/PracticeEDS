# Performance Guide — Lighthouse 100

## The core principle

EDS storefronts target a perfect 100 Lighthouse score. This is achievable because:
1. EDS handles delivery from the edge (CDN-first, static HTML baseline)
2. SaaS APIs (Catalog Service, Live Search) are fast enough; core AC GraphQL is not
3. Drop-ins are lazy-loaded; the browser never waits on commerce JS for LCP

Every optimization decision should be tested against Lighthouse before and after.

## Mandatory architecture decisions

### Use SaaS APIs for read operations

| Use case | Right API | Wrong API |
|---|---|---|
| PDP product data | Catalog Service GraphQL | AC core `products` query |
| PLP / category pages | Live Search API | AC core category products |
| Search results | Live Search API | AC core `products` with search |
| Product recommendations | Recommendations API | Custom AC query |
| Cart mutations (add, remove, update) | AC core GraphQL | — |
| Checkout (shipping, payment, place order) | AC core GraphQL | — |

The SaaS APIs return in <100ms consistently. AC core catalog queries can be 500ms–2s.

### Loading phase discipline

```
Eager   ← Only LCP: hero image preload, critical above-fold CSS
  ↓
Lazy    ← Commerce initializers, block JS, drop-in packages
  ↓
Delayed ← Analytics, A/B testing, chat widgets, social pixels (3s after load)
```

In `commerce.js`:
```js
// Correct: initializers in lazy
window.addEventListener('load', async () => {
  const { loadCartInitializer } = await import('./initializers/cart.js');
  loadCartInitializer();
});

// Wrong: initializers in eager (blocks LCP, destroys Lighthouse)
import './initializers/cart.js'; // ❌
```

### Preact not React

| Library | Gzip size | Impact on Lighthouse |
|---|---|---|
| React + ReactDOM | ~42KB | -10 to -20 points |
| Preact | ~3KB | Negligible |
| Preact + HTM (no build step) | ~4KB | Negligible |

```js
// Correct buildless Preact pattern in commerce blocks
import { h, render } from 'https://cdn.skypack.dev/preact';
import htm from 'https://cdn.skypack.dev/htm';
const html = htm.bind(h);

function MyBlock({ data }) {
  return html`<div class="my-block">${data.title}</div>`;
}

export default function decorate(block) {
  const props = parseBlockData(block);
  render(html`<${MyBlock} data=${props} />`, block);
}
```

### AEM Commerce Prerender

For PDP pages, enable prerendering to generate static HTML at build time. The drop-in
then hydrates client-side rather than rendering from scratch.

Configure in `commerce.js`:
```js
// Tell EDS which URL patterns are PDPs for prerender
window.hlx.RUM_GENERATION = 'product-pages';
```

And in `fstab.yaml` / site config, enable the AEM Commerce Prerender integration.

### CORS configuration

Mis-configured CORS creates waterfall fetches that crush Lighthouse. Checklist:
- AC GraphQL endpoint allows your EDS origin (`.hlx.page`, `.hlx.live`, custom domain)
- Catalog Service endpoint allows your EDS origin
- Live Search endpoint allows your EDS origin
- Payment Services allows your EDS origin

Test with:
```bash
curl -I -H "Origin: https://your-store.hlx.live" \
  https://your-ac-instance.com/graphql
# Must see: Access-Control-Allow-Origin: https://your-store.hlx.live
```

## Image optimization

All product images should go through AEM Assets integration:
- Automatic webp conversion
- Responsive srcset generation
- Image resizing at the CDN edge

```html
<!-- EDS auto-generates optimized images from AEM Assets -->
<img src="./media_hash.jpg?width=800&format=webp&optimize=medium"
     srcset="./media_hash.jpg?width=400&format=webp 400w,
             ./media_hash.jpg?width=800&format=webp 800w"
     loading="lazy" />
```

For LCP product images (the hero gallery image), add `loading="eager"` and a
`<link rel="preload">` in the page head.

## Eventing for algorithms

Live Search and Product Recommendations use machine learning trained on storefront
events. Set up eventing on day 1 — not as an afterthought.

```js
// In commerce.js, initialize the Adobe Data Layer
window.adobeDataLayer = window.adobeDataLayer || [];

// Product view event (PDP)
window.adobeDataLayer.push({
  event: 'product-page-view',
  eventInfo: { sku, name, price, categories },
});

// Add to cart event
window.adobeDataLayer.push({
  event: 'add-to-cart',
  eventInfo: { sku, name, price, quantity },
});

// Checkout initiated
window.adobeDataLayer.push({ event: 'initiate-checkout' });

// Purchase event
window.adobeDataLayer.push({
  event: 'place-order',
  eventInfo: { orderNumber, total, items },
});
```

The Data Connection extension syncs these events to AEP and the SaaS services.

## Lighthouse audit checklist

Run audits from:
- Chrome DevTools → Lighthouse tab (mobile, simulated throttling)
- `npx lighthouse https://your-store.hlx.live --preset=desktop`

**Performance (target 100):**
- [ ] LCP < 2.5s — product hero image preloaded or server-rendered
- [ ] No render-blocking scripts in `<head>`
- [ ] No commerce JS in eager phase
- [ ] Preact or plain JS — no React
- [ ] All images: webp + responsive srcset
- [ ] Fonts: `font-display: swap`
- [ ] Third-party scripts in delayed phase only

**Accessibility (target 100):**
- [ ] All interactive elements keyboard-accessible
- [ ] ARIA labels on icon buttons
- [ ] Color contrast ≥ 4.5:1 for body text
- [ ] Form fields have associated labels

**SEO (target 100):**
- [ ] Canonical URL set per page
- [ ] Meta description on PDP, PLP, cart, account pages
- [ ] Sitemap.xml configured
- [ ] robots.txt allows indexing of product pages

## Common pitfalls

| Pitfall | Symptom | Fix |
|---|---|---|
| AC GraphQL for PLP | LCP >3s, Lighthouse 40-60 | Switch to Live Search API |
| React in commerce block | Bundle >40KB, Lighthouse -15 | Replace with Preact or plain JS |
| Missing CORS headers | Drop-in fails in production, works locally | Configure AC + SaaS CORS for all EDS domains |
| Initializers in eager phase | LCP blocked by commerce JS | Move to lazy phase in `commerce.js` |
| No storefront events | Live Search "Most Viewed" shows nothing | Implement ACDL events on PDP and add-to-cart |
| Large unoptimized product images | CLS, slow LCP | AEM Assets integration + srcset |
| Missing Compatibility Package | Cart/checkout mutations fail | Install on AC backend before testing |
