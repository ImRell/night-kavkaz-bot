import { createHash, timingSafeEqual } from 'node:crypto';
import { URLSearchParams } from 'node:url';
const PAY_URL = 'https://pay.fk.money/';
const CURRENCY = 'RUB';
const md5 = (value) => createHash('md5').update(value, 'utf8').digest('hex');
function safeEqual(a, b) {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}
// Accepts "249", "249.0" or "249.00" and returns whole rubles; kopecks are not supported.
function parseRubles(value) {
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(value ?? '');
  if (!match || Number(match[2] ?? 0) !== 0) return null;
  return Number(match[1]);
}
export function createFreeKassa({ merchantId, secret1, secret2 }) {
  function paymentUrl(orderId, amount) {
    const oa = String(amount);
    const o = String(orderId);
    const params = new URLSearchParams({
      m: merchantId,
      oa,
      currency: CURRENCY,
      o,
      s: md5(`${merchantId}:${oa}:${secret1}:${CURRENCY}:${o}`),
      lang: 'ru',
    });
    return `${PAY_URL}?${params}`;
  }
  // Returns a normalized notification or a reason why it must be rejected.
  function parseNotification(params) {
    const merchant = params.get('MERCHANT_ID') ?? '';
    const rawAmount = params.get('AMOUNT') ?? '';
    const rawOrderId = params.get('MERCHANT_ORDER_ID') ?? '';
    const operationId = params.get('intid') ?? '';
    const sign = (params.get('SIGN') ?? '').toLowerCase();
    if (merchant !== merchantId) return { error: 'wrong_merchant' };
    if (!safeEqual(sign, md5(`${merchant}:${rawAmount}:${secret2}:${rawOrderId}`)))
      return { error: 'wrong_sign' };
    const amount = parseRubles(rawAmount);
    if (
      !/^[1-9]\d{0,15}$/.test(rawOrderId) ||
      amount === null ||
      !/^[\w-]{1,64}$/.test(operationId)
    )
      return { error: 'bad_params' };
    return { orderId: Number(rawOrderId), amount, operationId };
  }
  return { paymentUrl, parseNotification };
}
