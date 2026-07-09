---
name: commerce-dropin-blocks
description: Guide for implementing AEM Edge Delivery Services blocks in the Canon storefront repo, in particular blocks that wrap or integrate an Adobe Commerce Storefront Drop-in (@dropins/storefront-*). Use for any new/modified block, whether commerce-backed or purely presentational. Extends the global aem-edge-delivery-services:building-blocks skill with Canon-specific dropin, initializer, and regional-config patterns.
license: Apache-2.0
metadata:
  version: "1.0.0"
---

# Commerce Dropin Blocks (Canon)

This is the project-specific skill for **writing block code** (JS/CSS) in this repo. It sits on top of the global `aem-edge-delivery-services:building-blocks` skill: use that skill's JS/CSS guidelines (DOM patterns, scoping, responsive rules, linting) for every block; use *this* skill for anything specific to Canon's commerce integration.

## Related skills

| Skill | When to use it instead / alongside |
|---|---|
| `aem-edge-delivery-services:building-blocks` | Base JS/CSS implementation guidelines — always apply these first |
| `aem-edge-delivery-services:content-driven-development` | Full workflow (content model → implementation → test) — start here for new features |
| `aem-edge-delivery-services:testing-blocks` | Testing after implementation |
| `commerce-block-doc-skill` | Writing the `.md` authoring spec for a block (not code) |
| This skill | Canon-specific dropin wiring, initializers, regional config, design tokens |

## Step 0 — Look up the drop-in API before writing code

This repo has the **Commerce Dropins MCP** configured (`.mcp.json`, package `@dropins/mcp`). Before writing or modifying any dropin-integration code:

1. Ask the MCP for the actual slots/events/containers/API functions of the drop-in you're touching (e.g. "What slots does `ProductHeader` have in `@dropins/storefront-pdp`?", "What events does `@dropins/storefront-cart` emit?").
2. Never guess at container names, prop shapes, or event names — they change between drop-in versions and the MCP is source-backed against the installed version.
3. If the MCP isn't available in your session, run `npm ls @dropins/mcp` / check `.mcp.json`, or fall back to reading the installed package directly under `node_modules/@dropins/storefront-*` and `scripts/__dropins__/`.
4. Optional: `aio auth login` (Adobe I/O CLI) enables the MCP's `search_commerce_docs` tool for remote doc search.

## Step 1 — Decide: does this block need a drop-in?

| Block renders… | Approach |
|---|---|
| Static/authored content only (hero, cards, accordion, columns…) | Plain EDS block — follow `building-blocks` skill only, no drop-in involved |
| Standard commerce UI (cart, checkout, PDP, account, order, wishlist, payment methods, product discovery/search, recommendations) | Wrap the matching Commerce Storefront Drop-in — see the table below and Step 3 |
| Canon-specific, non-standard commerce data (Specifications, Compatibility, Where-to-Buy, chatbot, social share) | Custom block calling ACCS GraphQL directly via `CORE_FETCH_GRAPHQL`/`CS_FETCH_GRAPHQL` from `scripts/commerce.js` — no drop-in |

### Drop-in package reference

| Drop-in | Package | Use case |
|---|---|---|
| PDP | `@dropins/storefront-pdp` | Product detail page |
| Cart | `@dropins/storefront-cart` | Cart page, mini-cart, added-to-cart overlay |
| Checkout | `@dropins/storefront-checkout` | Checkout flow |
| Order | `@dropins/storefront-order` | Order confirmation, order detail, order history |
| Account | `@dropins/storefront-account` | My Account: orders list, payment tokens, addresses |
| Auth | `@dropins/storefront-auth` | Sign-in / sign-up |
| Wishlist | `@dropins/storefront-wishlist` | My Favourites / saved products |
| Payment Services | `@dropins/storefront-payment-services` | Credit card entry, payment method management |
| Product Discovery | `@dropins/storefront-product-discovery` | PLP, search results, product grids |
| Recommendations | `@dropins/storefront-recommendations` | Cross-sell / upsell modules |
| Personalization | `@dropins/storefront-personalization` | Personalised content/targeting |

All installed versions are pinned in `package.json`; built assets are synced into `scripts/__dropins__/` by `npm run postinstall` — never hand-edit files under `scripts/__dropins__/`.

## Step 2 — Reuse the existing initializer, don't create a new one

Every drop-in used globally is already wired up in `scripts/initializers/*.js` (e.g. `cart.js`, `pdp.js`, `auth.js`, `wishlist.js`, `personalization.js`, `order.js`, `payment-services.js`, `recommendations.js`, `search.js`). `scripts/initializers/index.js` is the entry point that sets auth headers, customer-group headers, AC Optimizer headers, and boots the global drop-ins (auth, personalization, cart) on page load.

**In your block:**
```js
// Import the initializer for the drop-in you need — this ensures it's configured
// exactly once, with Canon's shared auth/header/session wiring already applied.
import '../../scripts/initializers/wishlist.js';
import { IMAGES_SIZES } from '../../scripts/initializers/pdp.js'; // re-export example
```

Only add a **new** initializer file if you're integrating a drop-in that isn't used anywhere yet. If you do, follow the pattern in `scripts/initializers/index.js`: register via `events.on(...)`, guard re-initialization with `initializeDropin()`, and clear the relevant session/cookie state on `prerenderingchange`.

## Step 3 — Render using drop-in containers, not raw API calls

Drop-ins ship pre-built Preact containers. Compose them; don't hand-roll markup for things the drop-in already renders. See `resources/dropin-integration-patterns.md` for a full annotated example pulled from `blocks/product-details/product-details.js`. Summary:

```js
import { provider as UI } from '@dropins/tools/components.js';
import { h } from '@dropins/tools/preact.js';
import * as pdpApi from '@dropins/storefront-pdp/api.js';
import { render as pdpRendered } from '@dropins/storefront-pdp/render.js';
import ProductHeader from '@dropins/storefront-pdp/containers/ProductHeader.js';

export default async function decorate(block) {
  await pdpApi.initialize(sku, { langDefinitions });
  await pdpRendered.render(ProductHeader, { /* props */ })(block);
}
```

- Use `events.on('<event-name>', handler, { eager: true })` from `@dropins/tools/event-bus.js` to react to drop-in state changes (auth, cart data, etc.) instead of polling.
- Use `fetchPlaceholders()` from `scripts/commerce.js` for i18n strings — don't hardcode copy that needs to vary per locale.
- Use `rootLink()` / `getProductLink()` from `scripts/commerce.js` for any URL construction so region root-path prefixes (`getRootPath()`) are respected.

## Step 4 — Regional behavior goes through config, never a code branch

Per `CLAUDE.md`, this codebase is shared across all Canon regions. Any behavior that differs by region (CUSA vs. CCI vs. LATAM vs. Brazil) must be driven by a `config.json` / Config Service flag read via `getConfigValue()` (`@dropins/tools/lib/aem/configs.js`), not an `if (region === 'cci')` branch or a hardcoded region check.

```js
// Good
if (getConfigValue('social-share-enabled')) { /* ... */ }

// Bad — do not do this
if (window.location.hostname.includes('canon.ca')) { /* ... */ }
```

If a needed config flag doesn't exist yet, flag it as an open item rather than inventing a hostname/locale check.

## Step 5 — Styling: dropin tokens today, Canon tokens once confirmed

`styles/styles.css` currently defines the **generic Adobe Commerce Dropin design tokens** (`--color-brand-*`, `--color-neutral-*`, `--type-*`, `--spacing-*`, `--shape-*`) under `:root, .dropin-design`. These are placeholders, not final Canon brand values.

- See `docs/design-system.md` for the full token inventory and status.
- Do not hardcode hex colors, font names, or pixel spacing in block CSS — always reference a `var(--...)` token, even if that token's value is still a placeholder. This keeps the eventual brand-token swap to a single file.
- If a design requires a token that doesn't exist yet, add it to `styles/styles.css` and note it in `docs/design-system.md` rather than inlining a one-off value.

## Step 6 — Test

Once implementation is complete, follow the `aem-edge-delivery-services:testing-blocks` skill. For dropin-backed blocks, additionally verify:
- Behavior with the user authenticated and unauthenticated (Canon ID)
- Cart/wishlist state persists correctly across page navigation (session storage keys set by `scripts/initializers/index.js`)
- No console errors from the drop-in's GraphQL calls (check `CORE_FETCH_GRAPHQL` / `CS_FETCH_GRAPHQL` network requests)

## Reference materials

- `resources/dropin-integration-patterns.md` — annotated real examples from this codebase (initializer wiring, container rendering, event bus, config-driven regional behavior)
- Global `aem-edge-delivery-services:building-blocks` skill resources (`js-guidelines.md`, `css-guidelines.md`) — base implementation rules
- `commerce-block-doc-skill` — for writing the authoring spec `.md` once the block is implemented
- Dropin docs root: https://experienceleague.adobe.com/developer/commerce/storefront/dropins/all/introduction/
- Dropins MCP docs: https://experienceleague.adobe.com/developer/commerce/storefront/ai/dropins-mcp/