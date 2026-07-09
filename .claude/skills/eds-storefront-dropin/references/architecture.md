# Architecture Reference

## Composable architecture overview

```
Browser
  └── Edge Delivery Services (CDN + doc transform)
        └── Commerce Boilerplate (GitHub project)
              ├── scripts.js        ← AEM core
              ├── commerce.js       ← Commerce engine
              ├── initializers/     ← Drop-in bootstrap
              └── blocks/           ← Content + Commerce blocks
                    └── Drop-in NPM packages (@dropins/storefront-*)
                          └── Adobe Commerce Backend
                                ├── Catalog Service (fast read GraphQL)
                                ├── Live Search
                                ├── Product Recommendations
                                └── Core AC GraphQL (mutations, cart, checkout)
```

## Runtime flow (author → rendered page)

1. Author creates a table in Google Docs / SharePoint / DA.live:
   ```
   | Commerce Cart |
   ```
2. EDS transform generates server-side HTML:
   ```html
   <div class="commerce-cart"><div><div></div></div></div>
   ```
3. Browser loads HTML → `scripts.js` orchestrates eager/lazy/delayed loading.
4. Block decorator fires: `blocks/commerce-cart/commerce-cart.js` → `decorate(block)`
5. The decorator dynamically imports the Cart drop-in and calls `render()`.
6. Drop-in calls AC Catalog Service / Core GraphQL, renders the UI.

## scripts.js loading phases

| Phase | Timing | What goes here |
|---|---|---|
| **Eager** | Synchronous, before LCP | LCP element, above-fold critical CSS only |
| **Lazy** | After LCP (`requestIdleCallback`) | Commerce initializers, most blocks |
| **Delayed** | 3s after load | Analytics, A/B testing, third-party scripts |

Never load drop-in initializers in the eager phase. This kills Lighthouse scores.

## Boilerplate file responsibilities

### `scripts.js`
- Core AEM page loading and block decoration
- Font loading, DOM orchestration
- Eager/lazy/delayed phase management
- Aligns with upstream AEM Boilerplate (minimal delta for easy upgrades)
- Place: global DOM decorators, third-party plugins, experimentation tools

### `commerce.js`
- All Commerce-specific logic (separated from AEM core intentionally)
- Backend connections — sets GraphQL headers, store config
- Template handling and page type detection (PDP, PLP, cart, etc.)
- Adobe Data Layer (ACDL) initialization
- Commerce utility functions used across blocks
- Place: store detection, CORS config, multistore logic

### `initializers/`
- One file per drop-in (e.g. `cart.js`, `checkout.js`, `auth.js`)
- Bootstraps the drop-in's API: `initializeCart()`, `initializeCheckout()`, etc.
- Wires locale/dictionary overrides, model transformers, global event handlers
- Runs once per page; individual blocks then render containers
- Called from `commerce.js` in the lazy phase

### `blocks/`
- **Content blocks**: Authored in DA.live / Docs / Word; basic HTML + JS + CSS
- **Commerce blocks**: Extend content blocks with drop-in container rendering
  - `blocks/commerce-cart/commerce-cart.js` — block decorator
  - `blocks/commerce-cart/commerce-cart.css` — block styles
  - Use Preact + HTM for complex multi-state UIs (keep it minimal)
  - Use plain JS for simple display blocks

## API Mesh (optional)

For projects aggregating multiple GraphQL APIs, API Mesh for Adobe Developer App
Builder provides a single composite endpoint. Place mesh configuration outside the
boilerplate; point drop-in GraphQL headers at the mesh endpoint.

## Backend services

### Catalog Service
- Fast read-only access to catalog data via GraphQL
- Required by the Product Details (PDP) drop-in
- Data synced from AC via the SaaS data pipeline
- Response is cached — very fast, safe for Lighthouse 100

### Live Search
- Replaces AC default search
- Powers the Product Discovery drop-in
- Requires storefront eventing setup (product view, add-to-cart events)
- Contact AC Support if running multiple stores in one AC instance and only migrating one to EDS — ensure Elasticsearch isn't disabled for the others

### Product Recommendations
- AI/ML via Adobe Sensei ("Customers who viewed this also viewed...")
- Configurable from AC Admin
- Requires storefront events for algorithm training
- Not strictly required but strongly recommended

### Data Connection
- Connects storefront to Adobe Experience Platform
- Enables personalization via the Personalization drop-in
- Required for ACDL → AEP event streaming

### Storefront Compatibility Package
- Installed on AC backend (not in the boilerplate)
- Extends AC's GraphQL schema with mutations needed by cart, checkout, user account, order drop-ins
- Required for AC 2.4.7 / 2.4.8; ACaaCS includes equivalent schema natively
