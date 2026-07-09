# Customization Patterns Reference

## Design tokens — full token map

```css
:root {
  /* === Colors === */
  --color-brand-primary: #E63946;
  --color-brand-secondary: #457B9D;
  --color-neutral-50: #F9FAFB;
  --color-neutral-900: #111827;

  /* === Typography === */
  --font-family-primary: 'Inter', sans-serif;
  --font-family-secondary: 'Playfair Display', serif;
  --font-size-base: 16px;
  --font-size-small: 14px;
  --font-size-large: 20px;
  --font-weight-regular: 400;
  --font-weight-bold: 600;

  /* === Shapes === */
  --shape-border-radius: 4px;
  --shape-border-radius-lg: 8px;
  --shape-border-radius-pill: 999px;

  /* === Spacing === */
  --spacing-xsmall: 4px;
  --spacing-small: 8px;
  --spacing-medium: 16px;
  --spacing-large: 24px;
  --spacing-xlarge: 48px;
}
```

---

## Multi-step checkout implementation

The checkout drop-in is single-step by default. Here's the pattern for converting it
to multi-step by intercepting `checkout/step` events:

```js
// blocks/commerce-checkout/commerce-checkout.js
import { render } from '@dropins/tools/render.js';
import { events } from '@dropins/tools/event-bus.js';
import CheckoutProvider from '@dropins/storefront-checkout/containers/CheckoutProvider.js';
import ShippingMethods from '@dropins/storefront-checkout/containers/ShippingMethods.js';
import PaymentMethods from '@dropins/storefront-checkout/containers/PaymentMethods.js';
import PlaceOrder from '@dropins/storefront-checkout/containers/PlaceOrder.js';

export default async function decorate(block) {
  const steps = {
    shipping: block.querySelector('[data-step="shipping"]'),
    payment: block.querySelector('[data-step="payment"]'),
    review: block.querySelector('[data-step="review"]'),
  };

  function showStep(name) {
    Object.entries(steps).forEach(([key, el]) => {
      if (el) el.hidden = key !== name;
    });
    // Update progress indicator
    block.querySelectorAll('[data-step-indicator]').forEach((ind) => {
      ind.classList.toggle('active', ind.dataset.stepIndicator === name);
    });
  }

  events.on('checkout/step', ({ step }) => showStep(step));

  showStep('shipping');

  // Render each container into its step wrapper
  await render(ShippingMethods, {}, steps.shipping);
  await render(PaymentMethods, {}, steps.payment);
  await render(PlaceOrder, {
    slots: {
      // Inject terms acceptance before placing order
      Agreements: (ctx) => {
        const label = document.createElement('label');
        label.innerHTML = '<input type="checkbox" required> I agree to the terms';
        ctx.prependChild(label);
      },
    },
  }, steps.review);
}
```

---

## Add a custom payment method

```js
// initializers/checkout.js
import { initialise } from '@dropins/tools/initializer.js';
import { initializeCheckout, registerPaymentMethod } from '@dropins/storefront-checkout/api.js';

initialise(() => {
  initializeCheckout({ /* config */ });

  // Register a custom payment method
  registerPaymentMethod({
    code: 'my_custom_pay',
    label: 'Pay with MyCustomPay',
    icon: '/icons/my-custom-pay.svg',
    isAvailable: (cartData) => cartData.total.value > 0,
    renderForm: (container, { onValid }) => {
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Account number';
      input.addEventListener('input', () => onValid(input.value.length > 6));
      container.appendChild(input);
    },
    onPlaceOrder: async (cartData) => {
      // Return the payload required by your payment API
      return { token: await getMyCustomPayToken(cartData) };
    },
  });
});
```

---

## PDP slot customization

```js
// blocks/commerce-pdp/commerce-pdp.js
import { render } from '@dropins/tools/render.js';
import ProductDetails from '@dropins/storefront-pdp/containers/ProductDetails.js';

const sku = new URLSearchParams(window.location.search).get('sku')
  || window.location.pathname.split('/').pop();

export default async function decorate(block) {
  const container = block.querySelector(':scope > div');
  container.innerHTML = '';

  await render(ProductDetails, {
    sku,
    slots: {
      // Add a "Notify me when back in stock" CTA when out of stock
      Actions: (ctx) => {
        if (!ctx.data.inStock) {
          const btn = document.createElement('button');
          btn.className = 'notify-me-btn';
          btn.textContent = 'Notify me when back in stock';
          btn.addEventListener('click', () => openNotifyMeModal(ctx.data.sku));
          ctx.appendChild(btn);
        }
      },
      // Add social sharing below the product description
      Description: (ctx) => {
        const share = document.createElement('div');
        share.className = 'product-share';
        share.innerHTML = '<a href="#">Share</a> | <a href="#">Pin it</a>';
        ctx.appendChild(share);
      },
    },
    onAddToCart: (item) => {
      // Fires after a successful add-to-cart
      window.adobeDataLayer?.push({ event: 'add-to-cart', item });
    },
  }, container);
}
```

---

## Address validation integration (checkout)

```js
import { render } from '@dropins/tools/render.js';
import AddressValidation from '@dropins/storefront-checkout/containers/AddressValidation.js';

render(AddressValidation, {
  onValidate: async (address) => {
    // Call your address verification API (e.g. SmartyStreets, Loqate)
    const result = await myAddressVerificationAPI(address);
    if (result.suggestions.length) {
      return {
        valid: false,
        suggestions: result.suggestions,
      };
    }
    return { valid: true };
  },
  onAcceptSuggestion: (suggestion) => {
    // Fires when shopper accepts a suggested address
  },
}, container);
```

---

## Buy online, pick up in store (BOPIS)

```js
import ShippingMethods from '@dropins/storefront-checkout/containers/ShippingMethods.js';

render(ShippingMethods, {
  onShippingMethodSelect: (method) => {
    const pickupBlock = document.getElementById('store-pickup-block');
    if (pickupBlock) {
      pickupBlock.hidden = method.carrier_code !== 'in_store_pickup';
    }
  },
  slots: {
    // Inject store selector when in-store pickup is available
    PickupStore: (ctx) => {
      const storeSelector = createStoreSelector(ctx.data.stores);
      ctx.replaceWith(storeSelector);
    },
  },
}, container);
```

---

## Wishlist toggle on PLP cards

```js
import { render } from '@dropins/tools/render.js';
import WishlistToggle from '@dropins/storefront-wishlist/containers/WishlistToggle.js';

// Add to each product card during block decoration
document.querySelectorAll('.product-card').forEach((card) => {
  const sku = card.dataset.sku;
  const toggleContainer = document.createElement('div');
  card.appendChild(toggleContainer);

  render(WishlistToggle, { sku }, toggleContainer);
});
```

---

## Extending drop-in with new logic

```js
import { extend } from '@dropins/storefront-checkout/api.js';

// Add gift message capability to checkout
extend('PlaceOrder', {
  onBeforeSubmit: async (orderData) => {
    const giftMsg = document.getElementById('gift-message-input')?.value?.trim();
    if (giftMsg) {
      // Make your custom GraphQL mutation
      await setGiftMessageOnCart({ cartId: orderData.cartId, message: giftMsg });
    }
    return orderData;
  },
  onAfterSubmit: (orderData) => {
    // Clean up after order placed
    console.log('Order placed:', orderData.orderNumber);
  },
});
```

---

## Cart model transformer (custom fields)

```js
// initializers/cart.js
initializeCart({
  models: {
    CartSummaryItem: {
      transformer: (item) => ({
        ...item,
        // Add computed fields available inside slots
        discountPercent: item.prices?.discounts?.[0]?.percent ?? 0,
        isLowStock: item.product?.only_x_left_in_stock <= 3,
        estimatedDelivery: computeDeliveryDate(item.sku),
      }),
    },
  },
});
```

---

## Dictionary deep-merge example (multi-language)

```js
// For a French store view
import { setLocale } from '@dropins/storefront-cart/api.js';

setLocale({
  Cart: {
    Checkout: { label: 'Passer la commande' },
    EmptyCart: {
      heading: 'Votre panier est vide',
      description: 'Continuez vos achats pour ajouter des articles',
    },
    OrderSummary: { title: 'Récapitulatif de commande' },
    Coupons: { placeholder: 'Code promo' },
  },
});
```

Each drop-in has a `Dictionary` reference page in the docs listing every key available.
