
require('dotenv').config();

const required = [
  'SHOPIFY_SHOP',
  'SHOPIFY_ADMIN_ACCESS_TOKEN',
  'PUBLIC_BASE_URL',
  'CALLBACK_SECRET'
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing ${key} in .env`);
  }
}

const shop = process.env.SHOPIFY_SHOP
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '');

const callback =
  process.env.PUBLIC_BASE_URL.replace(/\/$/, '') +
  '/api/shipping/rates?key=' +
  encodeURIComponent(process.env.CALLBACK_SECRET);

const query = `
mutation UpdateCarrier($input: DeliveryCarrierServiceUpdateInput!) {
  carrierServiceUpdate(input: $input) {
    carrierService {
      id
      name
      active
      callbackUrl
    }
    userErrors {
      field
      message
    }
  }
}`;

async function main() {
  const response = await fetch(
    `https://${shop}/admin/api/2026-10/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token':
          process.env.SHOPIFY_ADMIN_ACCESS_TOKEN
      },
      body: JSON.stringify({
        query,
        variables: {
          input: {
            id: 'gid://shopify/DeliveryCarrierService/87283728538',
            name: 'Shiprocket Live Shipping',
            callbackUrl: callback,
            active: true
          }
        }
      })
    }
  );

  const json = await response.json();

  if (!response.ok || json.errors?.length) {
    console.error('Shopify API error:', response.status);
    console.error(json.errors);
    process.exit(1);
  }

  const result = json.data?.carrierServiceUpdate;

  if (!result || result.userErrors?.length) {
    console.error(result?.userErrors || 'No update result');
    process.exit(1);
  }

  console.log('Carrier updated successfully!');
  console.log('Name:', result.carrierService.name);
  console.log('Active:', result.carrierService.active);
  console.log('Endpoint:', new URL(callback).origin +
    new URL(callback).pathname);
}

main().catch(console.error);
