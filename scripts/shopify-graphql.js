import 'dotenv/config';
import { config } from '../src/config.js';

export function requireShopifySetup() {
  const missing = [];
  if (!config.shopify.storeDomain) missing.push('SHOPIFY_STORE_DOMAIN');
  if (!config.shopify.accessToken) missing.push('SHOPIFY_ADMIN_ACCESS_TOKEN');
  if (!config.publicBaseUrl) missing.push('PUBLIC_BASE_URL');
  if (missing.length) throw new Error(`Missing env: ${missing.join(', ')}`);
}

export async function shopifyGraphql(query, variables = {}) {
  const url = `https://${config.shopify.storeDomain}/admin/api/${config.shopify.apiVersion}/graphql.json`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': config.shopify.accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`Shopify HTTP ${response.status}: ${JSON.stringify(data)}`);
  if (data.errors?.length) throw new Error(`Shopify GraphQL errors: ${JSON.stringify(data.errors)}`);
  return data.data;
}
