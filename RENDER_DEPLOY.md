# Render deployment

1. Push this project to a private GitHub repository. Do not commit `.env` or `.env.development`.
2. In Render, **New > Blueprint**, choose the GitHub repo, and approve the `render.yaml` service. Alternatively create a Node web service with **Build:** `npm ci`, **Start:** `npm start`, **Health check:** `/health`.
3. Set secrets in Render > Service > Environment: `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`, `SHIPROCKET_PICKUP_PINCODE`, `SHOPIFY_SHOP`, `SHOPIFY_ADMIN_ACCESS_TOKEN`, `PUBLIC_BASE_URL` (actual https:// service URL), and `CALLBACK_SECRET`. Ensure `STORE_CURRENCY=INR`, `ALLOWED_COUNTRIES=IN` as appropriate.
4. Once `/health` returns 200, register the Shopify carrier callback to `https://<render-service>.onrender.com/api/shipping/rates?key=<CALLBACK_SECRET>` using the included `scripts/register-carrier.js` from a trusted workstation with env configured. Do not log or share the secret query string.
5. Make a test rate request with `examples/shopify-rate-request.json`, check Shiprocket serviceability, and run a Shopify checkout.

**Note:** The recoverable project files contain only shipping-rate routes. Shopify order-create/cancel webhook handlers are **not** included in this deployment build. Do not configure order webhooks until their handlers are separately restored and tested.

Render ephemeral filesystem: do not rely on local JSON files for durable order sync state. Use a hosted DB for webhook deduplication/state in production.
