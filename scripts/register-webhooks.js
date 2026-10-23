import { config } from '../src/config.js';
import { requireShopifySetup, shopifyGraphql } from './shopify-graphql.js';

requireShopifySetup();

const topics = [
  ['ORDERS_CREATE', `${config.publicBaseUrl}/api/webhooks/shopify/orders-create`],
  ['ORDERS_CANCELLED', `${config.publicBaseUrl}/api/webhooks/shopify/orders-cancelled`],
];

const listQuery = `
query WebhookSubscriptions($first: Int!) {
  webhookSubscriptions(first: $first) {
    edges { node { id topic uri } }
  }
}`;

const createMutation = `
mutation WebhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
  webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
    webhookSubscription { id topic uri }
    userErrors { field message }
  }
}`;

const current = await shopifyGraphql(listQuery, { first: 100 });
const existing = current?.webhookSubscriptions?.edges?.map((e) => e.node) || [];

for (const [topic, uri] of topics) {
  const match = existing.find((x) => x.topic === topic && x.uri === uri);
  if (match) {
    console.log(JSON.stringify({ action: 'exists', webhookSubscription: match, userErrors: [] }, null, 2));
    continue;
  }

  const data = await shopifyGraphql(createMutation, {
    topic,
    webhookSubscription: { uri },
  });
  const payload = data.webhookSubscriptionCreate;
  console.log(JSON.stringify({ action: 'created', ...payload }, null, 2));
  if (payload.userErrors?.length) process.exitCode = 1;
}
