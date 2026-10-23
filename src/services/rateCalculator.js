const { env } = require('../config/env');

function cleanPincode(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 6);
}

function calculateCart(rateRequest) {
  const shippableItems = (rateRequest.items || []).filter(item => item.requires_shipping !== false);

  const grams = shippableItems.reduce((sum, item) => {
    const itemGrams = Math.max(0, Number(item.grams || 0));
    const qty = Math.max(0, Number(item.quantity || 0));
    return sum + itemGrams * qty;
  }, 0);

  const itemSubtotalSubunits = shippableItems.reduce((sum, item) => {
    const price = Math.max(0, Number(item.price || 0));
    const qty = Math.max(0, Number(item.quantity || 0));
    return sum + price * qty;
  }, 0);

  const providedSubtotal = Number(rateRequest?.order_totals?.subtotal_price);
  const subtotalSubunits = Number.isFinite(providedSubtotal) ? providedSubtotal : itemSubtotalSubunits;

  return {
    weightKg: Math.max(grams / 1000, env.minWeightKg),
    subtotal: Math.max(0, subtotalSubunits / 100),
    itemCount: shippableItems.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0)), 0),
  };
}

function finalCustomerPrice(baseRate) {
  const markup = baseRate * (env.markupPercent / 100);
  const adjusted = baseRate + env.handlingFee + markup;
  return Math.max(env.minCharge, adjusted, 0);
}

function toSubunits(amount) {
  return String(Math.round((amount + Number.EPSILON) * 100));
}

function sanitizeCode(input) {
  return String(input || 'shiprocket')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'shiprocket';
}

function formatEtd(courier) {
  if (!courier.etd) return 'Tracked delivery via Shiprocket';
  return `Estimated delivery: ${String(courier.etd)}`;
}

function buildRates(couriers, cart) {
  if (env.freeShippingAbove > 0 && cart.subtotal >= env.freeShippingAbove) {
    return [{
      service_name: env.freeShippingLabel,
      service_code: 'shiprocket_free_shipping',
      total_price: '0',
      description: `Free shipping for orders above ₹${env.freeShippingAbove}`,
      currency: env.storeCurrency,
    }];
  }

  const selected = env.returnMultipleRates ? couriers.slice(0, env.maxRates) : couriers.slice(0, 1);

  return selected.map((courier, index) => {
    const finalPrice = finalCustomerPrice(courier.rate);
    const stablePart = courier.id ? `id_${courier.id}` : sanitizeCode(courier.name);
    return {
      service_name: env.returnMultipleRates ? courier.name : 'Standard Delivery',
      service_code: env.returnMultipleRates ? `shiprocket_${stablePart}` : 'shiprocket_standard',
      total_price: toSubunits(finalPrice),
      description: formatEtd(courier),
      currency: env.storeCurrency,
    };
  });
}

module.exports = { cleanPincode, calculateCart, buildRates, finalCustomerPrice, toSubunits };
