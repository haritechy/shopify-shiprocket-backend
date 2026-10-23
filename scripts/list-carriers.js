'use strict';
require('dotenv').config();
const { graphql } = require('../src/services/shopify-admin');
(async () => {
  const data = await graphql(`query { carrierServices(first: 50) { nodes { id name callbackUrl active supportsServiceDiscovery } } }`);
  // Do not print the callback query string: it contains CALLBACK_SECRET.
  console.log(JSON.stringify((data?.carrierServices?.nodes || []).map(s => ({
    id: s.id, name: s.name, active: s.active,
    callbackUrl: s.callbackUrl ? s.callbackUrl.split('?')[0] : null,
    supportsServiceDiscovery: s.supportsServiceDiscovery
  })), null, 2));
})().catch(err => { console.error(err.message); process.exitCode = 1; });
