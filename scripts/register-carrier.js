require('dotenv').config();

const required = [
  'SHOPIFY_SHOP',
  'SHOPIFY_ADMIN_ACCESS_TOKEN',
  'PUBLIC_BASE_URL',
  'CALLBACK_SECRET',
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in .env`);
    process.exit(1);
  }
}

const shop = process.env.SHOPIFY_SHOP.replace(/^https?:\/\//, '').replace(/\/$/, '');
const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-10';
const callback = `${process.env.PUBLIC_BASE_URL.replace(/\/$/, '')}/api/shipping/rates?key=${encodeURIComponent(process.env.CALLBACK_SECRET)}`;

const query = `
mutation CarrierServiceCreate($input: DeliveryCarrierServiceCreateInput!) {
  carrierServiceCreate(input: $input) {
    carrierService {
      id
      name
      callbackUrl
      active
      supportsServiceDiscovery
    }
    userErrors {
      field
      message
      code
    }
  }
}`;

async function main() {
  const response = await fetch(`https://${shop}/admin/api/${apiVersion}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
    },
    body: JSON.stringify({
      query,
      variables: {
        input: {
          name: process.env.CARRIER_SERVICE_NAME || 'Shiprocket Live Shipping',
          callbackUrl: callback,
          supportsServiceDiscovery: true,
          active: true,
        },
      },
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    console.error(JSON.stringify(json, null, 2));
    process.exit(1);
  }

  const payload = json?.data?.carrierServiceCreate;
  if (json.errors?.length || payload?.userErrors?.length) {
    console.error(JSON.stringify(json, null, 2));
    process.exit(1);
  }

  console.log('Carrier service created successfully:');
  console.log(JSON.stringify(payload.carrierService, null, 2));
  console.log('\nImportant: ensure this carrier service is added to the required Shopify shipping profile/zone.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
