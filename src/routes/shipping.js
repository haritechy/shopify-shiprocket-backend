const express = require('express');
const { env } = require('../config/env');
const { serviceability } = require('../services/shiprocket');
const { cleanPincode, calculateCart, buildRates } = require('../services/rateCalculator');
const { logInfo, logWarn, logError } = require('../utils/logger');

const router = express.Router();

function failResponse(res, message) {
  if (env.failMode === 'empty') return res.status(200).json({ rates: [] });
  return res.status(503).json({ error: message || 'Shipping rate temporarily unavailable' });
}

router.post('/rates', async (req, res) => {
  const startedAt = Date.now();

  try {
    if (env.callbackSecret && req.query.key !== env.callbackSecret) {
      logWarn('Rejected shipping callback with invalid key');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const rate = req.body?.rate;
    if (!rate || !Array.isArray(rate.items)) {
      return res.status(400).json({ error: 'Invalid Shopify carrier rate payload' });
    }

    const destinationCountry = String(rate.destination?.country || '').toUpperCase();
    if (env.allowedCountries.length && !env.allowedCountries.includes(destinationCountry)) {
      logInfo('Destination country not handled', { destinationCountry });
      return res.status(200).json({ rates: [] });
    }

    const requestCurrency = String(rate.currency || env.storeCurrency).toUpperCase();
    if (requestCurrency !== env.storeCurrency) {
      logWarn('Currency not supported by this backend', { requestCurrency, storeCurrency: env.storeCurrency });
      return res.status(200).json({ rates: [] });
    }

    const deliveryPincode = cleanPincode(rate.destination?.postal_code || rate.destination?.zip);
    if (!/^\d{6}$/.test(deliveryPincode)) {
      logInfo('Invalid or missing delivery pincode');
      return res.status(200).json({ rates: [] });
    }

    const cart = calculateCart(rate);
    if (cart.itemCount <= 0) return res.status(200).json({ rates: [] });

    const couriers = await serviceability({
      pickupPincode: env.pickupPincode,
      deliveryPincode,
      cod: env.codFlag === 1,
      weightKg: cart.weightKg,
      lengthCm: env.packageLengthCm,
      breadthCm: env.packageBreadthCm,
      heightCm: env.packageHeightCm,
      declaredValue: cart.subtotal,
    });

    if (!couriers.length) {
      logInfo('No Shiprocket courier available', { deliveryPincode, weightKg: cart.weightKg });
      return res.status(200).json({ rates: [] });
    }

    const rates = buildRates(couriers, cart);
    logInfo('Shipping rates calculated', {
      deliveryPincode,
      weightKg: cart.weightKg,
      subtotal: cart.subtotal,
      courierCount: couriers.length,
      returnedRateCount: rates.length,
      elapsedMs: Date.now() - startedAt,
    });

    return res.status(200).json({ rates });
  } catch (error) {
    logError('Shipping rate calculation failed', error, { elapsedMs: Date.now() - startedAt });
    return failResponse(res, 'Unable to calculate shipping rate');
  }
});

module.exports = router;
