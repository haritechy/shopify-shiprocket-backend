const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

function numberEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${name} must be a number`);
  return value;
}

function booleanEnv(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase());
}

function csvEnv(name, fallback = []) {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw.split(',').map(v => v.trim().toUpperCase()).filter(Boolean);
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: numberEnv('PORT', 3000),
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, ''),
  callbackSecret: process.env.CALLBACK_SECRET || '',

  shiprocketEmail: process.env.SHIPROCKET_EMAIL || '',
  shiprocketPassword: process.env.SHIPROCKET_PASSWORD || '',
  pickupPincode: process.env.SHIPROCKET_PICKUP_PINCODE || '',
  shiprocketApiBase: (process.env.SHIPROCKET_API_BASE || 'https://apiv2.shiprocket.in/v1/external').replace(/\/$/, ''),
  shiprocketTimeoutMs: numberEnv('SHIPROCKET_TIMEOUT_MS', 5000),

  packageLengthCm: numberEnv('PACKAGE_LENGTH_CM', 20),
  packageBreadthCm: numberEnv('PACKAGE_BREADTH_CM', 15),
  packageHeightCm: numberEnv('PACKAGE_HEIGHT_CM', 10),
  minWeightKg: numberEnv('MIN_WEIGHT_KG', 0.1),

  handlingFee: numberEnv('SHIPPING_HANDLING_FEE', 0),
  markupPercent: numberEnv('SHIPPING_MARKUP_PERCENT', 0),
  minCharge: numberEnv('SHIPPING_MIN_CHARGE', 0),
  freeShippingAbove: numberEnv('FREE_SHIPPING_ABOVE', 0),
  freeShippingLabel: process.env.FREE_SHIPPING_LABEL || 'Free Shipping',
  returnMultipleRates: booleanEnv('RETURN_MULTIPLE_RATES', false),
  maxRates: Math.max(1, Math.floor(numberEnv('MAX_RATES', 3))),
  codFlag: String(process.env.SHIPROCKET_COD_FLAG ?? '0') === '1' ? 1 : 0,

  storeCurrency: (process.env.STORE_CURRENCY || 'INR').toUpperCase(),
  allowedCountries: csvEnv('ALLOWED_COUNTRIES', ['IN']),
  failMode: (process.env.FAIL_MODE || 'backup').toLowerCase(),
};

function validateRuntimeEnv() {
  const missing = [];
  if (!env.shiprocketEmail) missing.push('SHIPROCKET_EMAIL');
  if (!env.shiprocketPassword) missing.push('SHIPROCKET_PASSWORD');
  if (!env.pickupPincode) missing.push('SHIPROCKET_PICKUP_PINCODE');
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (!/^\d{6}$/.test(String(env.pickupPincode))) {
    throw new Error('SHIPROCKET_PICKUP_PINCODE must be a 6-digit Indian pincode');
  }

  if (!['backup', 'empty'].includes(env.failMode)) {
    throw new Error('FAIL_MODE must be either backup or empty');
  }
}

module.exports = { env, validateRuntimeEnv };
