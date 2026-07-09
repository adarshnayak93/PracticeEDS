# B2B Drop-in Guide

## Prerequisites

- Adobe Commerce B2B module installed on the AC backend
- **B2B Compatibility Package** installed (separate from the base Compatibility Package)
- B2B features enabled in AC Admin (company accounts, purchase orders, quotes, etc.)
- Company admin user configured for testing

## B2B Compatibility Package

The B2B package extends the GraphQL schema for B2B-specific mutations and queries.
Install it on the AC backend alongside the standard Storefront Compatibility Package.

Documentation: https://experienceleague.adobe.com/developer/commerce/storefront/setup/configuration/storefront-compatibility-b2b/

## Company context management

B2B storefronts may need to pass a company context header in GraphQL requests when a
user is operating on behalf of a company.

```js
// commerce.js — set company context after user authenticates
import { setFetchGraphQlHeader } from '@dropins/tools/fetch-graphql.js';
import { events } from '@dropins/tools/event-bus.js';

events.on('user/authenticated', ({ user }) => {
  if (user.companyId) {
    setFetchGraphQlHeader('Company-Id', user.companyId);
  }
});

// For Company Switcher — update header when company is switched
events.on('company/switched', ({ companyId }) => {
  setFetchGraphQlHeader('Company-Id', companyId);
});
```

## Company Switcher drop-in

Allows users who belong to multiple companies to switch context.

```js
// blocks/commerce-company-switcher/commerce-company-switcher.js
import { render } from '@dropins/tools/render.js';
import CompanySwitcher from '@dropins/storefront-b2b-company-switcher/containers/CompanySwitcher.js';

export default async function decorate(block) {
  const container = block.querySelector(':scope > div');
  container.innerHTML = '';

  await render(CompanySwitcher, {
    onSwitch: ({ companyId, companyName }) => {
      // Reload the page or update page state after switch
      window.location.reload();
    },
  }, container);
}
```

## Purchase Order workflow

```js
// blocks/commerce-purchase-orders/commerce-purchase-orders.js
import { render } from '@dropins/tools/render.js';
import CustomerPurchaseOrders from '@dropins/storefront-b2b-purchase-order/containers/CustomerPurchaseOrders.js';
import PurchaseOrderApprovalFlow from '@dropins/storefront-b2b-purchase-order/containers/PurchaseOrderApprovalFlow.js';

export default async function decorate(block) {
  const isApprover = block.classList.contains('approver-view');

  await render(
    isApprover ? PurchaseOrderApprovalFlow : CustomerPurchaseOrders,
    {},
    block.querySelector(':scope > div')
  );
}
```

## Requisition list integration with PDP

Add a "Save to Requisition List" button on the PDP using slots:

```js
// blocks/commerce-pdp/commerce-pdp.js
import RequisitionListSelector from '@dropins/storefront-b2b-requisition-list/containers/RequisitionListSelector.js';

await render(ProductDetails, {
  sku,
  slots: {
    Actions: async (ctx) => {
      const selectorContainer = document.createElement('div');
      ctx.appendChild(selectorContainer);

      await render(RequisitionListSelector, {
        sku: ctx.data.sku,
        quantity: ctx.data.selectedQuantity || 1,
      }, selectorContainer);
    },
  },
}, container);
```

## Negotiable quote from cart

```js
// blocks/commerce-cart/commerce-cart.js  (B2B extension)
import { render } from '@dropins/tools/render.js';
import CartSummaryList from '@dropins/storefront-cart/containers/CartSummaryList.js';
import RequestNegotiableQuoteForm from '@dropins/storefront-b2b-quote-management/containers/RequestNegotiableQuoteForm.js';

export default async function decorate(block) {
  const container = block.querySelector(':scope > div');
  container.innerHTML = '';

  // Render standard cart
  await render(CartSummaryList, {
    slots: {
      OrderSummary: (ctx) => {
        // Inject "Request a Quote" below the order summary
        const quoteContainer = document.createElement('div');
        ctx.appendChild(quoteContainer);
        render(RequestNegotiableQuoteForm, {
          cartId: ctx.data.id,
          onSuccess: (quote) => {
            window.location.href = `/account/quotes/${quote.uid}`;
          },
        }, quoteContainer);
      },
    },
  }, container);
}
```

## B2B-specific CORS requirements

B2B GraphQL mutations use additional headers. Ensure the AC CORS configuration also
allows:
- `Company-Id` header in preflight
- `X-RMA-*` headers for returns (if applicable)
