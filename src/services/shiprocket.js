const { env } = require('../config/env');

let cachedToken = null;
let tokenExpiresAt = 0;

function parseJsonSafe(text) {
  try { return JSON.parse(text); } catch { return null; }
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.shiprocketTimeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    const json = text ? parseJsonSafe(text) : null;

    if (!response.ok) {
      const message = json?.message || json?.error || text || `HTTP ${response.status}`;
      const err = new Error(`Shiprocket request failed (${response.status}): ${message}`);
      err.status = response.status;
      err.body = json;
      throw err;
    }

    return json ?? {};
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Shiprocket request timed out after ${env.shiprocketTimeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function getToken(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedToken && now < tokenExpiresAt) return cachedToken;

  const data = await fetchJson(`${env.shiprocketApiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: env.shiprocketEmail,
      password: env.shiprocketPassword,
    }),
  });

  if (!data?.token) throw new Error('Shiprocket authentication succeeded but no token was returned');

  cachedToken = data.token;
  // Shiprocket documents token validity as 10 days. Refresh at 9 days.
  tokenExpiresAt = now + 9 * 24 * 60 * 60 * 1000;
  return cachedToken;
}

function normalizeCourier(raw) {
  const rate = Number(raw?.rate ?? raw?.freight_charge ?? NaN);
  return {
    id: raw?.courier_company_id ?? raw?.courier_id ?? null,
    name: raw?.courier_name || raw?.courier_company_name || 'Courier',
    rate,
    etd: raw?.etd || raw?.estimated_delivery_days || raw?.estimated_delivery_date || null,
    raw,
  };
}

async function serviceability(params, retryAuth = true) {
  const token = await getToken(false);
  const query = new URLSearchParams({
    pickup_postcode: String(params.pickupPincode),
    delivery_postcode: String(params.deliveryPincode),
    cod: String(params.cod ? 1 : 0),
    weight: Number(params.weightKg).toFixed(2),
    length: String(params.lengthCm),
    breadth: String(params.breadthCm),
    height: String(params.heightCm),
    declared_value: Number(params.declaredValue).toFixed(2),
    is_return: '0',
  });

  try {
    const data = await fetchJson(`${env.shiprocketApiBase}/courier/serviceability/?${query.toString()}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    const couriers = data?.data?.available_courier_companies;
    if (!Array.isArray(couriers)) return [];

    return couriers
      .map(normalizeCourier)
      .filter(c => Number.isFinite(c.rate) && c.rate >= 0)
      .sort((a, b) => a.rate - b.rate);
  } catch (error) {
    if (retryAuth && error?.status === 401) {
      cachedToken = null;
      tokenExpiresAt = 0;
      await getToken(true);
      return serviceability(params, false);
    }
    throw error;
  }
}

module.exports = { getToken, serviceability };
