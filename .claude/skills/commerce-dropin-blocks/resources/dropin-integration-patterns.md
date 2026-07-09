# Dropin Integration Patterns (from this codebase)

These are real patterns already in use in this repo — copy the pattern, not necessarily the exact block. Always verify current container/prop/event names against the Dropins MCP (`@dropins/mcp`) before relying on this file, since drop-in versions change.

## 1. Initializer wiring (`scripts/initializers/index.js`)

Global drop-ins (auth, personalization, cart) are booted once, on page load, with Canon's shared session/header wiring:

```js
import { events } from '@dropins/tools/event-bus.js';
import { initializers } from '@dropins/tools/initializer.js';
import { getConfigValue } from '@dropins/tools/lib/aem/configs.js';
import { CORE_FETCH_GRAPHQL, CS_FETCH_GRAPHQL, fetchPlaceholders } from '../commerce.js';

export default async function initializeDropins() {
  const init = async () => {
    // Auth headers follow the auth state
    events.on('authenticated', setAuthHeaders, { eager: true });

    // Cache cart data in session storage
    events.on('cart/data', persistCartDataInSession, { eager: true });

    await fetchPlaceholders('placeholders/global.json');

    await import('./auth.js');
    await import('./personalization.js');
    import('./cart.js');
  };

  document.addEventListener('prerenderingchange', initializeDropins, { once: true });
  return init();
}
```

`initializeDropin(cb)` (also in this file) is the guard helper for a *single* drop-in initializer — it prevents double-initialization and re-runs on `prerenderingchange` (bfcache restores). Reuse it for any new initializer:

```js
export function initializeDropin(cb) {
  let initialized = false;
  const init = async (force = false) => {
    if (initialized && !force) return;
    await cb();
    initialized = true;
  };
  document.addEventListener('prerenderingchange', () => init(true), { once: true });
  return init;
}
```

## 2. Block-level container rendering (`blocks/product-details/product-details.js`)

Blocks build a small DOM skeleton with named slots, then hand each slot to a drop-in container's `render()`:

```js
import { events } from '@dropins/tools/event-bus.js';
import * as pdpApi from '@dropins/storefront-pdp/api.js';
import { render as pdpRendered } from '@dropins/storefront-pdp/render.js';
import ProductHeader from '@dropins/storefront-pdp/containers/ProductHeader.js';
import ProductPrice from '@dropins/storefront-pdp/containers/ProductPrice.js';
import { fetchPlaceholders, rootLink } from '../../scripts/commerce.js';
import '../../scripts/initializers/cart.js';
import '../../scripts/initializers/wishlist.js';

export default async function decorate(block) {
  // Read state the PDP drop-in already fetched (avoid a second network round trip)
  const eventProduct = events.lastPayload('pdp/data') ?? null;
  const product = eventProduct?.sku ? eventProduct : null;

  const labels = await fetchPlaceholders();

  const fragment = document.createRange().createContextualFragment(`
    <div class="product-details__header"></div>
    <div class="product-details__price"></div>
  `);
  const $header = fragment.querySelector('.product-details__header');
  const $price = fragment.querySelector('.product-details__price');
  block.replaceChildren(fragment);

  await Promise.all([
    pdpRendered.render(ProductHeader, {})($header),
    pdpRendered.render(ProductPrice, {})($price),
  ]);
}
```

Key points:
- Build the skeleton DOM first with `document.createRange().createContextualFragment(...)`, then `block.replaceChildren(fragment)` once — not incremental `appendChild` calls.
- `render(Container, props)(targetElement)` is curried: config first, target element second.
- Use `Promise.all([...])` to render independent containers concurrently.
- Read `events.lastPayload('<event>')` for data the drop-in already fetched rather than re-fetching it yourself.
- Slots (e.g. `gallerySlots` in the real file) let you override how a container renders a specific piece — for example replacing gallery thumbnails with `tryRenderAemAssetsImage()` when AEM Assets is enabled.

## 3. Config-driven regional/environment behavior

Never branch on hostname or region name in a block. Read a `config.json` value instead:

```js
import { getConfigValue } from '@dropins/tools/lib/aem/configs.js';

// blocks/product-recommendations/product-recommendations.js
const storeViewCode = getConfigValue('headers.cs.Magento-Store-View-Code');
const isACO = getConfigValue('adobe-commerce-optimizer') === true
  || getConfigValue('adobe-commerce-optimizer') === 'true';
```

```js
// scripts/commerce.js — endpoint selection is config-driven, never hardcoded
CORE_FETCH_GRAPHQL.setEndpoint(
  getConfigValue('commerce-core-endpoint') || await getConfigValue('commerce-endpoint'),
);
```

If you need a new regional toggle (e.g. "is Social Share enabled for this store view"), add the flag name to the Config Service schema for that site (see `aem-project-management:admin`) and read it with `getConfigValue('social-share-enabled')` — do not invent a client-side region detector.

## 4. Direct ACCS GraphQL calls (non-drop-in commerce data)

For Canon-specific data that has no drop-in (specs, compatibility, where-to-buy), call ACCS directly using the same fetch instances the drop-ins use, so headers/auth stay consistent:

```js
import { CS_FETCH_GRAPHQL } from '../../scripts/commerce.js';

const { data } = await CS_FETCH_GRAPHQL.fetch(PRODUCT_ATTRIBUTES_QUERY, {
  variables: { sku },
});
```

Do not instantiate a separate `fetch()` call with its own headers — you'll miss the `Magento-Store-View-Code`, `x-api-key`, and auth headers already configured centrally.

## 5. Event bus reference

Common events already used in this codebase (via `@dropins/tools/event-bus.js`):

| Event | Emitted when | Used in |
|---|---|---|
| `authenticated` | Canon ID auth state changes | `scripts/initializers/index.js` (sets/clears auth header) |
| `cart/data` | Cart contents change | `scripts/initializers/index.js` (persists to session storage) |
| `pdp/data` | PDP drop-in loads product data | `blocks/product-details/product-details.js` (reads via `events.lastPayload`) |
| `aem/lcp` | Largest Contentful Paint fires | `scripts/initializers/index.js` (defers Recaptcha init past LCP) |
| `auth/group-uid` / `auth/adobe-commerce-optimizer` | Customer group / price-book resolved | `scripts/initializers/index.js` (sets GraphQL headers) |

Confirm the full, current event list for a specific drop-in via the Dropins MCP — this table is not exhaustive.
