require('dotenv').config();

const shop = (process.env.SHOPIFY_SHOP || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-10';

if (!shop || !token) {
  console.error('SHOPIFY_SHOP and SHOPIFY_ADMIN_ACCESS_TOKEN are required in .env');
  process.exit(1);
}

const query = `
query CarrierServices {
  carrierServices(first: 50) {
    nodes {
      id
      name
      callbackUrl
      active
      supportsServiceDiscovery
    }
  }
}`;

async function main() {
  const response = await fetch(`https://${shop}/admin/api/${apiVersion}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query }),
  });
  const json = await response.json();
  console.log(JSON.stringify(json, null, 2));
  if (!response.ok || json.errors?.length) process.exit(1);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
