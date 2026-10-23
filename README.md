# Shopify + Shiprocket Dynamic Shipping Backend

Production-oriented Node.js backend that lets a Shopify CarrierService callback fetch live courier serviceability/rates from Shiprocket and return a dynamic checkout shipping charge.

## What is included

- Shiprocket JWT authentication with in-memory token caching
- Automatic token refresh/retry on 401
- Shiprocket courier serviceability/rate lookup
- Shopify CarrierService POST callback
- Cart weight and declared-value calculation
- Cheapest courier selection (default)
- Optional multiple courier choices
- Handling fee, percentage markup, minimum charge
- Optional free-shipping threshold
- Callback URL secret
- Request timeout, rate limiting and basic hardening
- Shopify GraphQL script to register the carrier service
- Health endpoint for cPanel/Render monitoring

## Requirements

- Node.js 20 or newer
- A Shiprocket account and Shiprocket API user
- Shopify app/admin token with `write_shipping`
- A store eligible for CarrierService. Development stores are eligible for testing.
- Products/variants in Shopify must have correct weights.
- Public HTTPS backend URL. Shopify cannot call localhost.

## 1. Local setup

```bash
cp .env.example .env
npm install
```

Edit `.env` and set at minimum:

```env
SHIPROCKET_EMAIL=...
SHIPROCKET_PASSWORD=...
SHIPROCKET_PICKUP_PINCODE=...
CALLBACK_SECRET=...
PUBLIC_BASE_URL=https://shipping.yourdomain.com
```

Start:

```bash
npm start
```

Health check:

```bash
curl http://localhost:3000/health
```

## 2. Test the callback locally

The callback path is:

```text
POST /api/shipping/rates?key=CALLBACK_SECRET
```

Example:

```bash
curl -X POST "http://localhost:3000/api/shipping/rates?key=YOUR_SECRET" \
  -H "Content-Type: application/json" \
  --data @examples/shopify-rate-request.json
```

A successful response looks like:

```json
{
  "rates": [
    {
      "service_name": "Standard Delivery",
      "service_code": "shiprocket_standard",
      "total_price": "6900",
      "description": "Estimated delivery: 3 Days",
      "currency": "INR"
    }
  ]
}
```

`total_price` is returned in currency subunits, so ₹69.00 is `6900`.

## 3. Shipping pricing configuration

Base customer charge is:

```text
Shiprocket rate
+ SHIPPING_HANDLING_FEE
+ SHIPPING_MARKUP_PERCENT
then at least SHIPPING_MIN_CHARGE
```

Example:

```env
SHIPPING_HANDLING_FEE=10
SHIPPING_MARKUP_PERCENT=5
SHIPPING_MIN_CHARGE=60
```

To enable free shipping above ₹999:

```env
FREE_SHIPPING_ABOVE=999
```

To show multiple courier choices instead of only the cheapest:

```env
RETURN_MULTIPLE_RATES=true
MAX_RATES=3
```

## 4. Important weight/dimension note

Shopify sends item weight (`grams`) to a carrier callback. Keep product/variant weights correct in Shopify.

The standard CarrierService payload does not provide packed parcel dimensions, so this backend uses defaults from:

```env
PACKAGE_LENGTH_CM=20
PACKAGE_BREADTH_CM=15
PACKAGE_HEIGHT_CM=10
```

For a later advanced version, dimensions can be stored in product metafields or a backend database and fetched before requesting Shiprocket rates.

## 5. COD note

The carrier callback is called while Shopify is calculating delivery options, before a customer necessarily chooses a payment method. Therefore this project defaults Shiprocket serviceability to prepaid:

```env
SHIPROCKET_COD_FLAG=0
```

Do not assume you can reliably add a COD-only shipping fee from this callback alone. Handle COD-specific fees separately if needed.

## 6. Deploy on cPanel Node.js

If cPanel has **Setup Node.js App**:

1. Upload this project (do not upload an `.env` containing production secrets to GitHub).
2. Extract it, for example to `~/shopify-shiprocket-backend`.
3. Create Node.js app using Node 20/22.
4. Application root: `shopify-shiprocket-backend`
5. Startup file: `src/server.js`
6. Run `npm install` (or cPanel's NPM Install button).
7. Add environment variables or create `.env` outside public web root.
8. Map a subdomain such as `shipping.yourdomain.com`.
9. Confirm `https://shipping.yourdomain.com/health` returns `status: ok`.

## 7. Deploy on Render

1. Push the project to a private Git repository.
2. Create a Render Web Service.
3. Build command: `npm ci`
4. Start command: `npm start`
5. Add every value from `.env` in Render Environment settings.
6. Set `PUBLIC_BASE_URL` to the public Render/custom-domain URL.
7. Confirm `/health` works over HTTPS.

`render.yaml` is included as a starting point. Do not commit secrets.

## 8. Register the carrier service in Shopify

Your Shopify app/token needs `write_shipping`.

Set:

```env
SHOPIFY_SHOP=your-development-store.myshopify.com
SHOPIFY_ADMIN_ACCESS_TOKEN=...
SHOPIFY_API_VERSION=2026-10
PUBLIC_BASE_URL=https://shipping.yourdomain.com
CALLBACK_SECRET=...
```

Then run:

```bash
npm run shopify:register-carrier
```

It registers this callback URL:

```text
https://shipping.yourdomain.com/api/shipping/rates?key=CALLBACK_SECRET
```

Check existing carrier services:

```bash
npm run shopify:list-carriers
```

After registration, make sure the carrier service is assigned to the shipping profile/zone that should use it in Shopify Admin.

## 9. Shopify checkout flow

```text
Customer enters destination
        ↓
Shopify sends CarrierService request
        ↓
POST /api/shipping/rates
        ↓
Backend calculates cart weight/value
        ↓
Shiprocket serviceability API
        ↓
Available couriers + live rates
        ↓
Pricing rules applied
        ↓
Shopify receives rate(s)
        ↓
Customer sees dynamic shipping at checkout
```

## 10. Failure behavior

Default:

```env
FAIL_MODE=backup
```

If Shiprocket is unavailable, backend returns HTTP 503 so Shopify can use configured backup rates.

Alternative:

```env
FAIL_MODE=empty
```

This returns `{"rates":[]}` and hides this carrier's shipping option.

## 11. Security checklist

- Never put Shiprocket credentials in Shopify Liquid/theme JS.
- Never commit `.env`.
- Use a long random `CALLBACK_SECRET`.
- Use HTTPS only in production.
- Keep the Shopify admin token server-side only.
- Restrict permissions to what is required (`write_shipping` for registration).
- Use realistic package dimensions and Shopify product weights.

## API endpoints used

Shiprocket:

```text
POST https://apiv2.shiprocket.in/v1/external/auth/login
GET  https://apiv2.shiprocket.in/v1/external/courier/serviceability/
```

Backend:

```text
GET  /health
POST /api/shipping/rates?key=...
```

## Final setup checklist

- [ ] Shiprocket API user created
- [ ] Shiprocket pickup pincode set
- [ ] Shopify product weights set
- [ ] Backend deployed over HTTPS
- [ ] `.env` configured
- [ ] `/health` works
- [ ] Shopify app has `write_shipping`
- [ ] Carrier service registered
- [ ] Carrier service added to correct shipping profile/zone
- [ ] Checkout tested with multiple Indian pincodes and product weights
