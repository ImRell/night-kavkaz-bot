import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
const API_URL = 'https://pay.api.xrocket.exchange';
const REQUEST_TIMEOUT_MS = 10_000;
const INVOICE_TTL_MS = 60 * 60 * 1000;
const RATE_TTL_MS = 60 * 1000;
const RATE_STALE_MS = 30 * 60 * 1000;
const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;
const STABLECOINS = new Set(['USDT', 'USDC']);
const CLIENT_INVOICE_ID = /^nk-([1-9]\d{0,15})-[0-9a-f]{8}$/;
function safeEqual(a, b) {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}
export function createXRocket(
  { apiKey, webhookSecret, currency, webhookUrl },
  { fetch = globalThis.fetch, clock = Date.now } = {},
) {
  const decimals = STABLECOINS.has(currency) ? 2 : 6;
  let cachedRate = null;
  async function request(path, init = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.auth ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(body?.detail ?? `xRocket HTTP ${response.status}`);
      error.code = body?.type?.split('/').pop() ?? `HTTP_${response.status}`;
      throw error;
    }
    return body;
  }
  // xRocket publishes RUB rates without auth; a short cache keeps us far below its rate limit.
  async function rubRate() {
    const now = clock();
    if (cachedRate && now - cachedRate.at < RATE_TTL_MS) return cachedRate.value;
    try {
      const rates = await request(`/api/v1/rates?base=RUB&assets=${encodeURIComponent(currency)}`);
      const value = Number(rates?.find?.((rate) => rate.currency === currency)?.rate);
      if (!Number.isFinite(value) || value <= 0) throw new Error('Некорректный курс xRocket.');
      cachedRate = { value, at: now };
      return value;
    } catch (error) {
      if (cachedRate && now - cachedRate.at < RATE_STALE_MS) return cachedRate.value;
      throw error;
    }
  }
  // Rounds up so the merchant never receives less than the ruble price.
  function cryptoForRub(rub, rate) {
    const scale = 10 ** decimals;
    return (Math.ceil((rub * scale) / rate - 1e-9) / scale).toFixed(decimals);
  }
  async function createInvoice({ orderId, amount, description }) {
    const cryptoAmount = cryptoForRub(amount, await rubRate());
    const invoice = await request('/api/v1/invoices', {
      method: 'POST',
      auth: true,
      body: JSON.stringify({
        priceAmount: cryptoAmount,
        priceCurrency: currency,
        numPayments: 1,
        // Random suffix keeps IDs unique even if the database is ever recreated.
        clientInvoiceId: `nk-${orderId}-${randomBytes(4).toString('hex')}`,
        description: description.slice(0, 1000),
        expiresIn: INVOICE_TTL_MS,
        callback: { ...(webhookUrl ? { callbackUrl: webhookUrl } : {}), payload: { orderId } },
      }),
    });
    const payUrl = invoice?.links?.telegramBotLink;
    if (!invoice?.id || typeof payUrl !== 'string' || !payUrl.startsWith('https://'))
      throw new Error('xRocket вернул счёт без ссылки на оплату.');
    return { externalId: String(invoice.id), payUrl, cryptoAmount, cryptoCurrency: currency };
  }
  function verifySignature(headers, rawBody) {
    const signature = String(headers['signature'] ?? '').toLowerCase();
    const timestamp = String(headers['signature-timestamp'] ?? '');
    if (headers['signature-version'] !== 'v1' || !/^\d{10,16}$/.test(timestamp)) return false;
    if (Math.abs(clock() - Number(timestamp)) > SIGNATURE_TOLERANCE_MS) return false;
    const expected = createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');
    return safeEqual(signature, expected);
  }
  // Returns { ignore } for events we do not act on, { error } for bad data, or a paid invoice.
  function parseWebhook(event) {
    if (event?.type !== 'invoice') return { ignore: true };
    const { invoice, payment } = event.data ?? {};
    const paid =
      (event.data?.event === 'payment_status_changed' && payment?.status === 'paid') ||
      (event.data?.event === 'invoice_status_changed' && invoice?.status === 'paid');
    if (!paid) return { ignore: true };
    const match = CLIENT_INVOICE_ID.exec(invoice?.clientInvoiceId ?? '');
    if (!match) return { error: 'unknown_invoice' };
    if (invoice.priceCurrency !== currency) return { error: 'wrong_currency' };
    if (!invoice.id || typeof invoice.priceAmount !== 'string') return { error: 'bad_params' };
    return {
      orderId: Number(match[1]),
      externalId: String(invoice.id),
      cryptoAmount: invoice.priceAmount,
    };
  }
  return { currency, rubRate, cryptoForRub, createInvoice, verifySignature, parseWebhook };
}
