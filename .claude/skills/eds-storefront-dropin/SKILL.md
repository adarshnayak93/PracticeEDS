---
name: eds-storefront-dropin
description: >
  Expert guide for developing, customizing, and optimizing Adobe Commerce Storefront
  drop-in components on Edge Delivery Services (EDS). Use this skill whenever the user
  is working with ACS Storefront drop-ins — implementing a block, customizing
  slots/styling/dictionaries, extending with business logic, troubleshooting
  cart/checkout/PDP/auth/order/wishlist, wiring the Drop-in SDK, setting up
  initializers, handling events, configuring multistore or localization, hitting
  Lighthouse 100, or preparing for launch. Also trigger for Commerce Boilerplate
  architecture, EDS block authoring for commerce pages, AC backend service requirements
  (Catalog Service, Live Search, Compatibility Package), and B2B drop-ins (Company
  Management, Purchase Order, Quote Management, Requisition List, Quick Order).
  Covers the full developer lifecycle: architecture → implementation → customization
  → optimization → launch.
---

# EDS Storefront Drop-in Developer

Comprehensive guide for building and customizing Adobe Commerce Storefronts on Edge
Delivery Services using drop-in components.

## Quick orientation

Before diving in, establish which layer of the stack the task lives in:

| Layer | Files | Responsibility |
|---|---|---|
| **EDS delivery** | Hosted by Adobe | CDN, doc → HTML transform, Lighthouse infra |
| **Commerce Boilerplate** | `scripts.js`, `commerce.js`, `initializers/`, `blocks/` | Per-project JS/CSS, block decoration |
| **Drop-in packages** | `@dropins/storefront-*` NPM | Commerce UI components (private source, public API) |
| **AC Backend** | Adobe Commerce / ACaaCS | GraphQL APIs, Catalog, Live Search, Recs |

Read `references/architecture.md` when you need the full runtime flow or boilerplate
file-map detail.

---

## Drop-ins available

### B2C packages

| Drop-in | NPM package | Key containers |
|---|---|---|
| Cart | `@dropins/storefront-cart` | CartSummaryList, CartSummaryGrid, CartSummaryTable, MiniCart, OrderSummary, Coupons, GiftCards, EstimateShipping |
| Checkout | `@dropins/storefront-checkout` | ShippingMethods, PaymentMethods, PlaceOrder, AddressValidation, LoginForm, TermsAndConditions, OutOfStock |
| Order | `@dropins/storefront-order` | OrderHeader, OrderStatus, OrderProductList, OrderCostSummary, OrderSearch, CreateReturn, ShippingStatus |
| Payment Services | `@dropins/storefront-payment-services` | CreditCard, ApplePay |
| Product Details (PDP) | `@dropins/storefront-pdp` | ProductDetails, ProductGallery, ProductOptions, ProductPrice, ProductHeader, ProductQuantity, ProductDescription |
| Product Discovery | `@dropins/storefront-product-discovery` | SearchResults, Facets, SortBy, Pagination |
| Recommendations | `@dropins/storefront-recommendations` | ProductList |
| User Account | `@dropins/storefront-account` | CustomerInformation, Addresses, AddressForm, OrdersList |
| User Auth | `@dropins/storefront-auth` | SignIn, SignUp, AuthCombine, ResetPassword, UpdatePassword |
| Wishlist | `@dropins/storefront-wishlist` | Wishlist, WishlistToggle, WishlistAlert, WishlistItem |
| Personalization | `@dropins/storefront-personalization` | TargetedBlock |

### B2B packages

| Drop-in | Key containers |
|---|---|
| Company Management | CompanyProfile, CompanyStructure, CompanyUsers, RolesAndPermissions, CompanyCredit |
| Company Switcher | CompanySwitcher |
| Purchase Order | CustomerPurchaseOrders, CompanyPurchaseOrders, PurchaseOrderApprovalFlow, ApprovalRulesList |
| Quote Management | RequestNegotiableQuoteForm, ManageNegotiableQuote, QuotesListTable |
| Requisition List | RequisitionListGrid, RequisitionListSelector, RequisitionListView |
| Quick Order | QuickOrderItems, QuickOrderMultipleSku, QuickOrderCsvUpload |

Read `references/dropins-catalog.md` for full container lists per drop-in.

---

## Implementing a commerce block

Every drop-in lives inside a "commerce block" — an EDS block whose decorator loads and
initializes the drop-in. The pattern is always the same:

```js
// blocks/commerce-cart/commerce-cart.js
import { render } from '@dropins/tools/render.js';
import CartSummaryList from '@dropins/storefront-cart/containers/CartSummaryList.js';

export default async function decorate(block) {
  const container = block.querySelector(':scope > div');
  container.innerHTML = '';

  await render(CartSummaryList, {
    // config, slots, callbacks here
  }, container);
}
```

The doc table that authors create looks like:

```
| Commerce Cart |
| ------------- |
```

EDS turns this into `<div class="commerce-cart">` and the block decorator fires.

**Key rules:**
- Each commerce block maps 1:1 to one dropin container (or a composed set).
- Keep business logic in the initializer, not in the block decorator.
- Use Preact + HTM only for blocks with complex multi-state UIs. Plain JS for everything else.

---

## Initializer pattern

Initializers in `initializers/` bootstrap a drop-in once for the entire page, wiring up
shared config, locale, and event handlers. They run before block decoration.

```js
// initializers/cart.js
import { initialise } from '@dropins/tools/initializer.js';
import { initializeCart } from '@dropins/storefront-cart/api.js';

initialise(() => {
  initializeCart({
    langDefinitions: { /* optional locale overrides */ },
    models: {
      CartSummaryItem: {
        transformer: (item) => ({
          ...item,
          customField: computeCustomField(item),
        }),
      },
    },
  });
});
```

Load initializers in `commerce.js` in the lazy or delayed phase — never eager.

---

## Customization hierarchy (least → most invasive)

Always start at the top and only go deeper when needed.

### 1. Design tokens — global brand

Override CSS custom properties. Changes apply across all drop-ins instantly.

```css
/* storefront.css or a dropin-specific override file */
:root {
  --color-brand-primary: #E63946;
  --color-brand-secondary: #457B9D;
  --font-family-primary: 'Brand Font', sans-serif;
  --shape-border-radius: 4px;
  --spacing-small: 8px;
  --spacing-medium: 16px;
}
```

Reference: `references/customization-patterns.md` → Design Tokens section.

### 2. CSS class overrides — component-level restyling

Drop-ins expose BEM-style class names. Override them in your block's CSS file.

```css
/* blocks/commerce-cart/commerce-cart.css */
.cart-summary-list__item { border-radius: 8px; }
.cart-summary-list__quantity { font-weight: 500; }
```

### 3. Dictionaries — all user-facing text and labels

Deep-merge locale overrides for any language or branding need.

```js
import { setLocale } from '@dropins/storefront-cart/api.js';

setLocale({
  Cart: {
    Checkout: { label: 'Proceed to Checkout →' },
    EmptyCart: { heading: 'Your bag is empty' },
    OrderSummary: { title: 'Order Details' },
  },
});
```

### 4. Slots — inject or replace UI sections

Slots are named extension points inside containers. Use them to add or replace content
without touching drop-in internals.

```js
render(CartSummaryList, {
  slots: {
    // Slot name matches the drop-in's documented slot list
    OrderSummary: (ctx) => {
      // ctx exposes: data, emit, element, prependChild, appendChild, replaceWith
      const promo = document.createElement('div');
      promo.className = 'cart-promo-banner';
      promo.textContent = 'Free shipping on orders over $50';
      ctx.prependChild(promo);
    },
    ProductItem: (ctx) => {
      // Slot fires per item — ctx.data has the item
      if (ctx.data.isSale) {
        const badge = document.createElement('span');
        badge.textContent = 'SALE';
        ctx.appendChild(badge);
      }
    },
  },
}, container);
```

### 5. Layouts — page structure via HTML fragments

Configure which containers appear on a page and in what order by editing the HTML
fragment file for that page template. Drop-in containers are composed in the HTML
structure, not hardcoded.

### 6. Extending — add new features / API integrations

Add new Commerce API integrations to an existing drop-in without forking it.

```js
// Extend checkout with a gift message feature
import { extend } from '@dropins/storefront-checkout/api.js';

extend('PlaceOrder', {
  onBeforeSubmit: async (data) => {
    const giftMsg = document.getElementById('gift-message')?.value;
    if (giftMsg) {
      await setGiftMessageOnCart(giftMsg); // your GraphQL call
    }
    return data;
  },
});
```

See `references/customization-patterns.md` for a multi-step checkout example and
payment method injection.

### 7. Creating a new drop-in (SDK)

Use the Drop-in SDK CLI to scaffold when no existing drop-in covers the domain.

```bash
npx @dropins/tools create my-loyalty-dropin
```

Read `references/sdk-guide.md` for the full SDK component library, design tokens, and
VComponent render API.

---

## Event system

Drop-ins communicate via a shared event bus. Subscribe and emit across blocks.

```js
import { events } from '@dropins/tools/event-bus.js';

// Subscribe
events.on('cart/data', (payload) => {
  updateMiniCartCount(payload.totalQuantity);
});

// Emit custom events
events.emit('storefront/custom-event', { sku, quantity });
```

Common built-in events: `cart/data`, `cart/error`, `checkout/step`,
`user/authenticated`, `pdp/sku-change`. Each drop-in's Events doc lists its full set.

---

## GraphQL configuration

```js
import { setFetchGraphQlHeader } from '@dropins/tools/fetch-graphql.js';

// Store view (multistore)
setFetchGraphQlHeader('Store', storeCode);

// Currency
setFetchGraphQlHeader('Content-Currency', 'EUR');

// Call from commerce.js during initialisation — before any drop-in initializes
```

For multistore, detect the store from the URL in `commerce.js` and set headers once.
Read `references/multistore-localization.md` for locale-aware link setup.

---

## Localized links

```js
import { setLinks } from '@dropins/tools/links.js';

const locale = document.documentElement.lang || 'en';
setLinks({
  cart: `/${locale}/cart`,
  checkout: `/${locale}/checkout`,
  account: `/${locale}/account`,
  signin: `/${locale}/customer/account/login`,
});
```

---

## Performance — hitting Lighthouse 100

The storefront targets a perfect Lighthouse score. Every architectural decision flows
from this.

**Critical rules:**
- Use **Catalog Service / Live Search APIs** for PDP and PLP data — AC core GraphQL is
  too slow for 100 Lighthouse.
- Drop-ins are **lazy or delayed** — never load commerce JS in the eager phase.
- Use **Preact** (3KB) not React (40KB+) for complex blocks.
- Enable **AEM Commerce Prerender** for PDP pages to generate static HTML at build time.
- Configure **CORS** correctly on all AC GraphQL and SaaS endpoints before going live.
- Implement **storefront events** (view, add-to-cart, checkout) on day 1 — Live Search
  and Recommendations degrade silently without them.
- All product images through **AEM Assets** for auto webp + responsive srcset.

Read `references/performance-guide.md` for the full optimization checklist and common
pitfall list.

---

## Backend requirements checklist

Before a drop-in will function, confirm these are configured on the AC backend:

- [ ] Adobe Commerce 2.4.7+ **or** Adobe Commerce as a Cloud Service
- [ ] **Storefront Compatibility Package** installed (extends GraphQL schema)
- [ ] **Catalog Service** configured and syncing catalog data
- [ ] **Live Search** active, indexed, and eventing configured
- [ ] **Product Recommendations** enabled (optional but recommended)
- [ ] **Data Connection** installed and connected to Adobe Experience Platform
- [ ] **Services Connector** wiring AC to all SaaS services above
- [ ] **CORS** allowing your EDS domain on all AC and SaaS endpoints
- [ ] **B2B Compatibility Package** if B2B drop-ins are used

---

## Extend vs substitute vs create — decision guide

| Situation | Approach |
|---|---|
| Need to add content/behavior to an existing drop-in | **Extend** via slots or the extending API |
| Need to replace a drop-in with a third-party solution (e.g. different payment UI) | **Substitute** — swap the NPM package and write a compatibility wrapper |
| Need a net-new commerce domain (loyalty, subscriptions, bundles) | **Create** a new drop-in with the SDK |

Do not fork drop-in internals — they are private packages. Extension and substitution
are the supported paths. Breaking changes in internals won't be announced.

---

## Reference files

Load these as needed:

- `references/architecture.md` — Full composable architecture, runtime flow, boilerplate
  file structure detail
- `references/dropins-catalog.md` — Complete container + slot + event + function
  inventory per drop-in
- `references/customization-patterns.md` — Code examples: multi-step checkout, payment
  method injection, PDP slot customization, address validation integration, gift options
- `references/performance-guide.md` — Lighthouse 100 checklist, SaaS API vs AC GraphQL
  guidance, loading phase breakdown, common pitfalls
- `references/multistore-localization.md` — Multistore URL detection, GraphQL header
  setup, locale-aware links, dictionary setup per locale
- `references/b2b-guide.md` — B2B drop-in setup, B2B Compatibility Package, company
  context management, requisition/quote/PO workflows
- `references/sdk-guide.md` — Drop-in SDK CLI, component library (35+ components),
  design token system, VComponent render API, SDK utilities
