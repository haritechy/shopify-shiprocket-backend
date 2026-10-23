import { config } from '../config.js';

function cleanText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function digits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function normalizePhone(value) {
  const d = digits(value);
  if (!d) return '';
  // Shiprocket examples use 10-digit Indian phone numbers. If an ISD prefix
  // is present, keep the last 10 digits for the billing/shipping phone field.
  return d.length > 10 ? d.slice(-10) : d;
}

function normalizePincode(value) {
  const d = digits(value);
  return d;
}

function countryName(address) {
  const country = cleanText(address?.country);
  if (country) return country;
  const code = cleanText(address?.country_code).toUpperCase();
  if (code === 'IN') return 'India';
  return code || 'India';
}

function orderDate(order) {
  const date = new Date(order.created_at || Date.now());
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isCodOrder(order) {
  const joined = [
    ...(Array.isArray(order.payment_gateway_names) ? order.payment_gateway_names : []),
    order.gateway,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return config.sync.codGatewayKeywords.some((keyword) => joined.includes(keyword));
}

function shippingCharge(order) {
  return (order.shipping_lines || []).reduce((sum, line) => {
    return sum + number(line.discounted_price ?? line.price, 0);
  }, 0);
}

function itemWeightKg(order) {
  let grams = 0;
  for (const item of order.line_items || []) {
    const qty = Math.max(1, number(item.quantity, 1));
    grams += Math.max(0, number(item.grams, 0)) * qty;
  }
  if (grams > 0) return Math.max(0.01, grams / 1000);
  const units = (order.line_items || []).reduce((sum, item) => sum + Math.max(1, number(item.quantity, 1)), 0) || 1;
  return Math.max(0.01, config.parcel.defaultWeightKg * units);
}

function mapItems(order) {
  const items = (order.line_items || []).map((item, index) => ({
    name: cleanText(item.name || item.title, `Item ${index + 1}`),
    sku: cleanText(item.sku, String(item.variant_id || item.product_id || item.id || `ITEM-${index + 1}`)),
    units: Math.max(1, number(item.quantity, 1)),
    selling_price: number(item.price, 0),
    discount: number(item.total_discount, 0),
    tax: Array.isArray(item.tax_lines)
      ? item.tax_lines.reduce((sum, tax) => sum + number(tax.price, 0), 0)
      : 0,
    hsn: cleanText(item.hsn_code || ''),
  }));

  if (!items.length) throw new Error('Shopify order has no line items; cannot create Shiprocket order');
  return items;
}

function personName(address, fallback) {
  return {
    first: cleanText(address?.first_name, fallback || 'Customer'),
    last: cleanText(address?.last_name),
  };
}

function hasUsableAddress(address) {
  if (!address || typeof address !== 'object') return false;
  return Boolean(
    cleanText(address.address1)
    && cleanText(address.city)
    && normalizePincode(address.zip)
    && cleanText(address.province || address.province_code),
  );
}

function comparableAddress(address) {
  return [
    cleanText(address?.address1).toLowerCase(),
    cleanText(address?.address2).toLowerCase(),
    cleanText(address?.city).toLowerCase(),
    cleanText(address?.province || address?.province_code).toLowerCase(),
    normalizePincode(address?.zip),
    cleanText(address?.country || address?.country_code).toLowerCase(),
  ].join('|');
}

function validateAddress(label, address) {
  const missing = [];
  if (!cleanText(address?.address1)) missing.push('address1');
  if (!cleanText(address?.city)) missing.push('city');
  if (!normalizePincode(address?.zip)) missing.push('pincode');
  if (!cleanText(address?.province || address?.province_code)) missing.push('state/province');
  if (missing.length) {
    throw new Error(
      `Shopify ${label} address is incomplete (${missing.join(', ')}). `
      + 'Check Shopify order address and Protected customer data access for the app.',
    );
  }
}

export function shopifyOrderToShiprocket(order) {
  const rawBilling = order.billing_address || null;
  const rawShipping = order.shipping_address || null;

  // Shiprocket always requires billing details. If Shopify has only a shipping
  // address, use it as billing and mark shipping_is_billing=true.
  const billing = hasUsableAddress(rawBilling) ? rawBilling : rawShipping;
  const shipping = hasUsableAddress(rawShipping) ? rawShipping : billing;

  if (!billing) {
    throw new Error(
      'Shopify order does not contain billing/shipping address data. '
      + 'Enable order/customer protected data access and place a new test order with a complete shipping address.',
    );
  }

  validateAddress('billing', billing);
  validateAddress('shipping', shipping);

  const shippingIsBilling = !rawShipping
    || !rawBilling
    || comparableAddress(billing) === comparableAddress(shipping);

  const billingName = personName(billing, order.customer?.first_name);
  const shippingName = personName(shipping, billingName.first);

  const phone = normalizePhone(
    shipping.phone || billing.phone || order.phone || order.customer?.phone,
  );
  const email = cleanText(order.email || order.contact_email || order.customer?.email);
  const orderName = cleanText(order.name || order.order_number || order.id).replace(/^#/, '');

  if (!phone) {
    throw new Error(
      'Shopify order phone number is missing. Shiprocket requires billing_phone. '
      + 'Make phone required at checkout or add a valid phone to the test order.',
    );
  }
  if (!email) {
    throw new Error(
      'Shopify order email is missing. Shiprocket requires billing_email.',
    );
  }

  const payload = {
    order_id: `${config.shiprocket.orderPrefix}${orderName}`.slice(0, 50),
    order_date: orderDate(order),
    pickup_location: config.shiprocket.pickupLocation,
    channel_id: '',
    comment: `Shopify order ${cleanText(order.name || order.id)}`,

    billing_customer_name: billingName.first,
    billing_last_name: billingName.last,
    billing_address: cleanText(billing.address1),
    billing_address_2: cleanText(billing.address2),
    billing_city: cleanText(billing.city),
    billing_pincode: normalizePincode(billing.zip),
    billing_state: cleanText(billing.province || billing.province_code),
    billing_country: countryName(billing),
    billing_email: email,
    billing_phone: phone,

    shipping_is_billing: shippingIsBilling,
    shipping_customer_name: shippingIsBilling ? '' : shippingName.first,
    shipping_last_name: shippingIsBilling ? '' : shippingName.last,
    shipping_address: shippingIsBilling ? '' : cleanText(shipping.address1),
    shipping_address_2: shippingIsBilling ? '' : cleanText(shipping.address2),
    shipping_city: shippingIsBilling ? '' : cleanText(shipping.city),
    shipping_pincode: shippingIsBilling ? '' : normalizePincode(shipping.zip),
    shipping_country: shippingIsBilling ? '' : countryName(shipping),
    shipping_state: shippingIsBilling ? '' : cleanText(shipping.province || shipping.province_code),
    shipping_email: shippingIsBilling ? '' : email,
    shipping_phone: shippingIsBilling ? '' : phone,

    order_items: mapItems(order),
    payment_method: isCodOrder(order) ? 'COD' : 'Prepaid',
    shipping_charges: shippingCharge(order),
    giftwrap_charges: 0,
    transaction_charges: 0,
    total_discount: number(order.total_discounts, 0),
    sub_total: number(order.subtotal_price, 0),

    length: config.parcel.lengthCm,
    breadth: config.parcel.breadthCm,
    height: config.parcel.heightCm,
    weight: Number(itemWeightKg(order).toFixed(3)),
  };

  return payload;
}

export function shiprocketPayloadSummary(payload) {
  const maskPhone = (value) => {
    const d = digits(value);
    if (!d) return '';
    return `${'*'.repeat(Math.max(0, d.length - 4))}${d.slice(-4)}`;
  };

  return {
    order_id: payload.order_id,
    pickup_location: payload.pickup_location,
    billing_city: payload.billing_city,
    billing_pincode: payload.billing_pincode,
    billing_state: payload.billing_state,
    billing_country: payload.billing_country,
    billing_phone: maskPhone(payload.billing_phone),
    shipping_is_billing: payload.shipping_is_billing,
    shipping_city: payload.shipping_city || '(same as billing)',
    shipping_pincode: payload.shipping_pincode || '(same as billing)',
    items: Array.isArray(payload.order_items) ? payload.order_items.length : 0,
    payment_method: payload.payment_method,
    sub_total: payload.sub_total,
    shipping_charges: payload.shipping_charges,
    weight: payload.weight,
  };
}
