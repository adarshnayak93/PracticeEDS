# Multistore & Localization Reference

## Store detection pattern

Detect the store from the URL in `commerce.js` and set all GraphQL headers once,
before any initializer runs.

```js
// commerce.js
import { setFetchGraphQlHeader } from '@dropins/tools/fetch-graphql.js';

const STORE_CONFIG = {
  'en-us': { storeCode: 'default', currencyCode: 'USD', locale: 'en_US' },
  'en-gb': { storeCode: 'gb_store', currencyCode: 'GBP', locale: 'en_GB' },
  'fr-fr': { storeCode: 'fr_store', currencyCode: 'EUR', locale: 'fr_FR' },
  'de-de': { storeCode: 'de_store', currencyCode: 'EUR', locale: 'de_DE' },
};

function detectStore() {
  const [, segment] = window.location.pathname.split('/');
  return STORE_CONFIG[segment] || STORE_CONFIG['en-us'];
}

const { storeCode, currencyCode, locale } = detectStore();

// Set before any drop-in initializes
setFetchGraphQlHeader('Store', storeCode);
setFetchGraphQlHeader('Content-Currency', currencyCode);

// Export for use in initializers
export { storeCode, currencyCode, locale };
```

## Locale-aware links

Set links once at startup so all drop-ins produce localized URLs automatically.

```js
// initializers/links.js
import { setLinks } from '@dropins/tools/links.js';
import { locale } from '../commerce.js';

const prefix = `/${locale}`;

export function initializeLinks() {
  setLinks({
    cart: `${prefix}/cart`,
    checkout: `${prefix}/checkout`,
    account: `${prefix}/account`,
    signin: `${prefix}/customer/account/login`,
    signout: `${prefix}/customer/account/logout`,
    register: `${prefix}/customer/account/create`,
    forgotPassword: `${prefix}/customer/account/forgotpassword`,
    orderHistory: `${prefix}/account/orders`,
    address: `${prefix}/account/addresses`,
    wishlist: `${prefix}/wishlist`,
  });
}
```

## Per-locale dictionary setup

Each drop-in maintains its own dictionary. Set locale strings per drop-in in their
respective initializers.

```js
// initializers/cart.js — French store
import { setLocale } from '@dropins/storefront-cart/api.js';
import { locale } from '../commerce.js';

const CART_LABELS = {
  fr_FR: {
    Cart: {
      Checkout: { label: 'Passer la commande' },
      EmptyCart: { heading: 'Votre panier est vide' },
      OrderSummary: { title: 'Récapitulatif' },
      Coupons: { placeholder: 'Code promo', apply: 'Appliquer' },
    },
  },
  de_DE: {
    Cart: {
      Checkout: { label: 'Zur Kasse' },
      EmptyCart: { heading: 'Ihr Warenkorb ist leer' },
      OrderSummary: { title: 'Bestellübersicht' },
    },
  },
};

if (CART_LABELS[locale]) {
  setLocale(CART_LABELS[locale]);
}
```

## Multistore with single Live Search instance

When running multiple AC stores from one AC environment and only migrating one to EDS:
- Live Search will be enabled globally by default
- Contact Adobe Commerce Support to activate Live Search for one store without
  disabling Elasticsearch for the others
- This is a backend configuration change, not a boilerplate change

## RTL support

For right-to-left locales (Arabic, Hebrew):

```css
/* In storefront.css */
[dir="rtl"] .dropin-cart-summary { direction: rtl; }
[dir="rtl"] .dropin-checkout-form { text-align: right; }
```

Set `dir="rtl"` on `<html>` when the locale requires it:

```js
// In commerce.js
if (['ar', 'he', 'fa'].includes(locale.split('_')[0])) {
  document.documentElement.dir = 'rtl';
}
```
