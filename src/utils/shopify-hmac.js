import crypto from 'node:crypto';

export function verifyShopifyHmac(rawBody, providedHmac, secret) {
  if (!rawBody || !providedHmac || !secret) return false;

  const computed = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');

  const provided = Buffer.from(String(providedHmac), 'utf8');
  const expected = Buffer.from(computed, 'utf8');
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(provided, expected);
}
