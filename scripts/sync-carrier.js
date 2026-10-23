'use strict';
require('dotenv').config();
const { graphql } = require('../src/services/shopify-admin');
const name = process.env.CARRIER_SERVICE_NAME || 'Shiprocket Live Shipping';
async function syncCarrier() {
  const base = process.env.PUBLIC_BASE_URL;
  const secret = process.env.CALLBACK_SECRET;
  if (!base || !/^https:\/\//.test(base) || !secret || secret.length < 24) {
    throw new Error('Provide HTTPS PUBLIC_BASE_URL and CALLBACK_SECRET (at least 24 characters)');
  }
  const callbackUrl = `${base.replace(/\/$/, '')}/api/shipping/rates?key=${encodeURIComponent(secret)}`;
  const data = await graphql(`query { carrierServices(first: 50) { nodes { id name callbackUrl active } } }`);
  const matches = data?.carrierServices?.nodes?.filter(s => s.name === name) || [];
  if (matches.length > 1) throw new Error('Multiple matching carrier services; update manually by ID');
  if (matches.length === 1) {
    const existing = matches[0];
    if (existing.callbackUrl === callbackUrl && existing.active) {
      console.log('Carrier already configured with correct Render endpoint');
      return;
    }
    const update = await graphql(`mutation ($input: DeliveryCarrierServiceUpdateInput!) { carrierServiceUpdate(input: $input) { carrierService { id name active } userErrors { message } } }`, {
      input: { id: existing.id, name, callbackUrl, active: true }
    });
    if (update.carrierServiceUpdate.userErrors?.length) throw new Error(JSON.stringify(update.carrierServiceUpdate.userErrors));
    console.log('Existing carrier callback updated successfully:', update.carrierServiceUpdate.carrierService.id);
    return;
  }
  // Create only when no same-name service exists. Requires Shopify CCS enabled.
  const create = await graphql(`mutation ($input: DeliveryCarrierServiceCreateInput!) { carrierServiceCreate(input: $input) { carrierService { id name active } userErrors { message } } }`, {
    input: { name, callbackUrl, active: true, supportsServiceDiscovery: true }
  });
  if (create.carrierServiceCreate.userErrors?.length) throw new Error(JSON.stringify(create.carrierServiceCreate.userErrors));
  console.log('Carrier created successfully:', create.carrierServiceCreate.carrierService.id);
}
if (require.main === module) syncCarrier().catch(err => { console.error(err.message); process.exitCode = 1; });
module.exports = { syncCarrier };
