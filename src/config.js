import { fileURLToPath } from 'node:url';
import { isAbsolute, resolve } from 'node:path';
export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const CHANNEL_ENV = Object.freeze({
  'dagestan-private': 'CHANNEL_DAGESTAN_ID',
  'ingush-private': 'CHANNEL_INGUSH_ID',
  'chechen-private': 'CHANNEL_CHECHEN_ID',
  covered: 'CHANNEL_COVERED_ID',
  everything: 'CHANNEL_EVERYTHING_ID',
});
function readChannels(env) {
  const channels = {};
  for (const [slug, name] of Object.entries(CHANNEL_ENV)) {
    const value = env[name]?.trim();
    if (!value) continue;
    if (!/^-100\d{5,20}$/.test(value))
      throw new Error(`${name} должен быть ID канала вида -1001234567890.`);
    channels[slug] = value;
  }
  return Object.freeze(channels);
}
// Official FreeKassa notification servers.
export const FREEKASSA_IPS = Object.freeze([
  '168.119.157.136',
  '168.119.60.227',
  '178.154.197.79',
  '51.250.54.238',
]);
function readPort(value, name) {
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535)
    throw new Error(`${name} должен быть портом от 1 до 65535.`);
  return port;
}
function readFreeKassa(env) {
  const merchantId = env.FREEKASSA_MERCHANT_ID?.trim();
  if (!merchantId) return null;
  if (!/^[1-9]\d{0,15}$/.test(merchantId))
    throw new Error('FREEKASSA_MERCHANT_ID должен быть числовым ID магазина.');
  const secret1 = env.FREEKASSA_SECRET_1 ?? '';
  const secret2 = env.FREEKASSA_SECRET_2 ?? '';
  if (!secret1 || !secret2)
    throw new Error('Укажите FREEKASSA_SECRET_1 и FREEKASSA_SECRET_2 в .env.');
  const rawIps = env.FREEKASSA_ALLOWED_IPS?.trim();
  const allowedIps = rawIps
    ? rawIps
        .split(',')
        .map((ip) => ip.trim())
        .filter(Boolean)
    : FREEKASSA_IPS;
  return Object.freeze({
    merchantId,
    secret1,
    secret2,
    allowedIps: Object.freeze([...new Set(allowedIps)]),
  });
}
function readXRocket(env) {
  const apiKey = env.XROCKET_API_KEY?.trim();
  if (!apiKey) return null;
  const webhookSecret = env.XROCKET_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) throw new Error('Укажите XROCKET_WEBHOOK_SECRET в .env.');
  const currency = env.XROCKET_CURRENCY?.trim() || 'USDT';
  if (!/^[A-Za-z0-9]{2,16}$/.test(currency))
    throw new Error('XROCKET_CURRENCY должен быть кодом валюты, например USDT.');
  const webhookUrl = env.XROCKET_WEBHOOK_URL?.trim() || null;
  if (webhookUrl && !/^https:\/\/\S{1,490}$/.test(webhookUrl))
    throw new Error('XROCKET_WEBHOOK_URL должен начинаться с https://.');
  return Object.freeze({ apiKey, webhookSecret, currency, webhookUrl });
}
function readHttp(env) {
  const trustProxy = env.HTTP_TRUST_PROXY?.trim().toLowerCase() || 'false';
  if (!['true', 'false'].includes(trustProxy)) throw new Error('HTTP_TRUST_PROXY: true или false.');
  return Object.freeze({
    host: env.HTTP_HOST?.trim() || '127.0.0.1',
    port: readPort(env.HTTP_PORT?.trim() || '3000', 'HTTP_PORT'),
    trustProxy: trustProxy === 'true',
  });
}
export function readConfig(env = process.env) {
  const token = env.BOT_TOKEN?.trim();
  if (!token || token === 'your_telegram_bot_token_here')
    throw new Error('Укажите BOT_TOKEN в .env.');
  const file = env.DATABASE_PATH?.trim() || 'data/bot.sqlite';
  const rawAdminIds = env.ADMIN_IDS?.trim() || '';
  const bootstrapAdminIds = rawAdminIds ? rawAdminIds.split(',').map((value) => value.trim()) : [];
  if (bootstrapAdminIds.some((id) => !/^[1-9]\d*$/.test(id))) {
    throw new Error('ADMIN_IDS должен содержать Telegram ID через запятую, без имён и @username.');
  }
  return {
    token,
    databasePath: isAbsolute(file) ? file : resolve(projectRoot, file),
    legacyPath: resolve(projectRoot, 'data/users.json'),
    rulesVersion: 1,
    bootstrapAdminIds: [...new Set(bootstrapAdminIds)],
    channels: readChannels(env),
    freeKassa: readFreeKassa(env),
    xRocket: readXRocket(env),
    http: readHttp(env),
  };
}
