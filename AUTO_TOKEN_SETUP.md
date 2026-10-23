# Shopify auto token renewal and carrier sync

The client-credentials access token lasts approximately 24 hours. This version requests a new token on demand, caches it in memory, refreshes five minutes before expiry, and retries once if a Shopify Admin request returns 401. The client ID and secret never appear in command output. When Render restarts it requests a new token as needed.

**Immediately rotate any previously pasted SHOPIFY_CLIENT_SECRET and access token.** Reinstall/re-authorize the app as needed. The client credentials grant only works on stores belonging to the same Shopify organization as the app.

## Render environment variables

SHOPIFY_SHOP=<correct installed store domain>
SHOPIFY_CLIENT_ID=<rotated client ID>
SHOPIFY_CLIENT_SECRET=<rotated client secret>
PUBLIC_BASE_URL=https://shopify-shiprocket-backend.onrender.com
CALLBACK_SECRET=<new 32+ character random secret, identical for Shopify callback and Render backend>
SHOPIFY_AUTO_SYNC_CARRIER=true
SHIPROCKET_EMAIL=<Shiprocket API email>
SHIPROCKET_PASSWORD=<Shiprocket API password>
SHIPROCKET_PICKUP_PINCODE=<6-digit Indian postal code>
NODE_ENV=production

Never commit .env. Do not copy the user-shared old access token or client secret into a repository.

## On workstation or Render

1. `npm ci`
2. `npm run shopify:token-check` (validates client credentials)
3. `npm run shopify:list-carriers` (shows sanitized callback URL)
4. `npm run shopify:sync-carrier` (updates existing carrier if its URL changed, otherwise leaves it as-is; creates only if none exists)
5. `npm start` (auto-sync runs once at startup when SHOPIFY_AUTO_SYNC_CARRIER=true)

Important: `SHOPIFY_AUTO_SYNC_CARRIER=true` syncs *on startup*, not on every request, and token refresh is automatic **when Admin API operations occur**, not a background timer. The shipping checkout callback does not need a Shopify Admin API access token; Shiprocket has separate API authentication.

Only the app that originally created a carrier service can update that carrier. This means SHOPIFY_CLIENT_ID/SECRET must refer to that app. If API returns an ownership error, do not delete the existing carrier blindly.

Shopify rates appear only if CCS is enabled and the carrier is added to the appropriate shipping profile.
