# Mosaic React

React landing page template designed by Cruip.

## Project setup
```
npm install
```

### Compiles and hot-reloads for development
```
npm run dev
```

### Compiles and minifies for production
```
npm run build
```

### Customize configuration
See [Configuration Reference](https://vitejs.dev/guide/).

## Billing setup (Stripe)

Subscription billing uses Stripe Checkout and Customer Portal. See the backend docs:

- [Billing Setup (Stripe)](../homeops-backend/docs/BILLING_SETUP.md)

Required `.env` variables: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`, `APP_BASE_URL`. Run `npm run seed:stripe` in the backend after applying migrations.

## Support notes
We are shipping our templates with a very basic React configuration to let you quickly get into the development process, but we don't discourage you from using any other configuration or framework built on the top of React. So, please note that any request dealing with React (e.g. extra features, customisations, et cetera) is to be considered out of the support scope.

For more information about what support covers, please see our (FAQs)[https://cruip.com/faq/].
