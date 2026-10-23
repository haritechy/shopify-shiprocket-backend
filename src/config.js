import 'dotenv/config';

function numberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function boolEnv(name, fallback = false) {
  const value = String(process.env[name] ?? '').trim().toLowerCase();
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value);
}

function csvEnv(name, fallback = []) {
  const raw = String(process.env[name] ?? '').trim();
  if (!raw) return fallback;
  return raw.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
}

export const config = {
  port: numberEnv('PORT', 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  publicBaseUrl: String(process.env.PUBLIC_BASE_URL || '').replace(/\/$/, ''),

  shopify: {
    storeDomain: process.env.SHOPIFY_STORE_DOMAIN || '',
    accessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || '',
    apiVersion: process.env.SHOPIFY_API_VERSION || '2026-10',
    appSecret: process.env.SHOPIFY_APP_SECRET || '',
    carrierName: process.env.SHOPIFY_CARRIER_NAME || 'Shiprocket Dynamic Shipping',
    allowInsecureWebhooks: boolEnv('ALLOW_INSECURE_WEBHOOKS', false),
  },

  shiprocket: {
    email: process.env.SHIPROCKET_EMAIL || '',
    password: process.env.SHIPROCKET_PASSWORD || '',
    pickupLocation: process.env.SHIPROCKET_PICKUP_LOCATION || 'Primary',
    pickupPostcode: process.env.SHIPROCKET_PICKUP_POSTCODE || '',
    orderPrefix: process.env.SHIPROCKET_ORDER_PREFIX || 'SHOPIFY-',
  },

  parcel: {
    defaultWeightKg: numberEnv('DEFAULT_ITEM_WEIGHT_KG', 0.5),
    lengthCm: numberEnv('DEFAULT_LENGTH_CM', 10),
    breadthCm: numberEnv('DEFAULT_BREADTH_CM', 10),
    heightCm: numberEnv('DEFAULT_HEIGHT_CM', 10),
  },

  rates: {
    mode: (process.env.RATE_MODE || 'cheapest').toLowerCase(),
    maxOptions: Math.max(1, numberEnv('MAX_RATE_OPTIONS', 3)),
    currency: process.env.RATE_CURRENCY || 'INR',
    markupPercent: numberEnv('SHIPPING_MARKUP_PERCENT', 0),
    markupFlatInr: numberEnv('SHIPPING_MARKUP_FLAT_INR', 0),
    cod: boolEnv('RATE_COD', false),
    allowFallback: boolEnv('ALLOW_FALLBACK_RATE', false),
    fallbackRateInr: numberEnv('FALLBACK_RATE_INR', 99),
  },

  sync: {
    codGatewayKeywords: csvEnv('COD_GATEWAY_KEYWORDS', ['cod', 'cash on delivery']),
    stateFile: process.env.STATE_FILE || './data/sync-state.json',
    asyncAck: boolEnv('WEBHOOK_ASYNC_ACK', false),
  },
};

export function assertServerConfig() {
  const missing = [];
  if (!config.shiprocket.email) missing.push('SHIPROCKET_EMAIL');
  if (!config.shiprocket.password) missing.push('SHIPROCKET_PASSWORD');
  if (!config.shiprocket.pickupPostcode) missing.push('SHIPROCKET_PICKUP_POSTCODE');
  if (missing.length) {
    console.warn(`[config] Missing: ${missing.join(', ')}. Related features will fail until configured.`);
  }
}
