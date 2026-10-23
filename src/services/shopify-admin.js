'use strict';
// Shopify client-credentials grant: new token is issued when the cached one nears expiry.
let cached = null;
let pending = null;
const shop = () => String(process.env.SHOPIFY_SHOP || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const apiVersion = () => process.env.SHOPIFY_API_VERSION || '2026-10';
async function getToken(force = false) {
  if (!force && cached && Date.now() < cached.expiresAt) return cached.value;
  if (!force && pending) return pending;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!shop() || !clientId || !clientSecret) throw new Error('SHOPIFY_SHOP, SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET are required');
  pending = (async () => {
    const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret });
    const response = await fetch(`https://${shop()}/admin/oauth/access_token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Shopify token request failed: HTTP ${response.status} (check app installation and client credentials)`);
    const json = await response.json();
    if (!json.access_token || !Number.isFinite(Number(json.expires_in))) throw new Error('Shopify token response missing expiry');
    const ttl = Number(json.expires_in);
    cached = { value: json.access_token, expiresAt: Date.now() + Math.max(0, ttl - 300) * 1000 };
    return cached.value;
  })();
  try { return await pending; } finally { pending = null; }
}
async function graphql(query, variables = {}) {
  async function request(token) {
    const res = await fetch(`https://${shop()}/admin/api/${apiVersion()}/graphql.json`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
      body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(20000)
    });
    return { res, data: await res.json() };
  }
  let result = await request(await getToken());
  if (result.res.status === 401) { cached = null; result = await request(await getToken(true)); }
  if (!result.res.ok || result.data.errors?.length) {
    throw new Error(`Shopify GraphQL failed: HTTP ${result.res.status} ${JSON.stringify(result.data.errors || []).slice(0,500)}`);
  }
  return result.data.data;
}
module.exports = { getToken, graphql };
