import { Telegraf } from 'telegraf';
import { createLogger } from './logger.js';
import { CHANNEL_ENV } from './config.js';
import { registerHandlers } from './bot/handlers.js';
import { registerPaymentHandlers } from './bot/payments.js';
import { registerAdminHandlers } from './bot/admin.js';
import { createTransport } from './bot/transport.js';
import { createBroadcastQueue } from './bot/broadcast-queue.js';
import { createFreeKassa } from './integrations/freekassa.js';
import { createWebhookServer } from './http/server.js';
export function createApplication(config, store, { logger = createLogger() } = {}) {
  const bot = new Telegraf(config.token);
  const transport = createTransport({ logger });
  const hooks = {};
  for (const [slug, name] of Object.entries(CHANNEL_ENV)) {
    if (!config.channels[slug])
      logger.warn(`Не указан ${name}: покупка этого товара будет недоступна.`);
  }
  const freeKassa = config.freeKassa ? createFreeKassa(config.freeKassa) : null;
  if (!freeKassa) logger.warn('FreeKassa не настроена: доступна только оплата через Stars.');
  registerHandlers(bot, {
    store,
    rulesVersion: config.rulesVersion,
    transport,
    channels: config.channels,
    hooks,
    freeKassaEnabled: Boolean(freeKassa),
    logger,
  });
  const { handleFreeKassa } = registerPaymentHandlers(bot, {
    store,
    transport,
    rulesVersion: config.rulesVersion,
    hooks,
    logger,
    freeKassa,
  });
  const broadcastQueue = createBroadcastQueue({ store, telegram: bot.telegram, transport, logger });
  registerAdminHandlers(bot, { store, transport, broadcastQueue, logger });
  const webhookServer = freeKassa
    ? createWebhookServer({
        http: config.freeKassa.http,
        allowedIps: config.freeKassa.allowedIps,
        freeKassa,
        handleFreeKassa,
        logger,
      })
    : null;
  return { bot, broadcastQueue, webhookServer, logger };
}
