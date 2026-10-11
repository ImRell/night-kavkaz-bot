import { Telegraf } from 'telegraf';
import { createLogger } from './logger.js';
import { CHANNEL_ENV } from './config.js';
import { registerHandlers } from './bot/handlers.js';
import { registerPaymentHandlers } from './bot/payments.js';
import { registerAdminHandlers } from './bot/admin.js';
import { createTransport } from './bot/transport.js';
import { createBroadcastQueue } from './bot/broadcast-queue.js';
export function createApplication(config, store, { logger = createLogger() } = {}) {
  const bot = new Telegraf(config.token);
  const transport = createTransport({ logger });
  const hooks = {};
  for (const [slug, name] of Object.entries(CHANNEL_ENV)) {
    if (!config.channels[slug])
      logger.warn(`Не указан ${name}: покупка этого товара будет недоступна.`);
  }
  if (!config.moneyAcceptCard)
    logger.warn('Не указан MONEY_ACCEPT_CARD: оплата картой будет недоступна.');
  registerHandlers(bot, {
    store,
    rulesVersion: config.rulesVersion,
    transport,
    channels: config.channels,
    hooks,
    logger,
  });
  registerPaymentHandlers(bot, {
    store,
    transport,
    rulesVersion: config.rulesVersion,
    moneyAcceptCard: config.moneyAcceptCard,
    hooks,
    logger,
  });
  const broadcastQueue = createBroadcastQueue({ store, telegram: bot.telegram, transport, logger });
  registerAdminHandlers(bot, { store, transport, broadcastQueue, logger });
  return { bot, broadcastQueue, logger };
}
