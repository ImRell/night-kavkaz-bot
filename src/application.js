import { Telegraf } from 'telegraf';
import { createLogger } from './logger.js';
import { CHANNEL_ENV } from './config.js';
import { registerHandlers } from './bot/handlers.js';
import { registerPaymentHandlers } from './bot/payments.js';
import { registerAdminHandlers } from './bot/admin.js';
import { createTransport } from './bot/transport.js';
import { createBroadcastQueue } from './bot/broadcast-queue.js';
import { createDelivery } from './bot/delivery.js';
import { createAccessGate } from './bot/access-gate.js';
import { createBackups } from './bot/backup.js';
import { createWebhookServer } from './http/server.js';
export function createApplication(config, store, { logger = createLogger() } = {}) {
  const bot = new Telegraf(config.token);
  const transport = createTransport({ logger });
  for (const [slug, name] of Object.entries(CHANNEL_ENV)) {
    if (!config.channels[slug])
      logger.warn(`Не указан ${name}: покупка этого товара будет недоступна.`);
  }
  const delivery = createDelivery({
    store,
    telegram: bot.telegram,
    transport,
    channels: config.channels,
    logger,
  });
  const gate = createAccessGate({ store, rulesVersion: config.rulesVersion });
  const backups = createBackups({
    store,
    telegram: bot.telegram,
    recipients: config.bootstrapAdminIds,
    logger,
  });
  registerHandlers(bot, {
    store,
    rulesVersion: config.rulesVersion,
    gate,
    transport,
    channels: config.channels,
    logger,
  });
  registerPaymentHandlers(bot, {
    store,
    transport,
    gate,
    channels: config.channels,
    delivery,
    logger,
  });
  const broadcastQueue = createBroadcastQueue({ store, telegram: bot.telegram, transport, logger });
  registerAdminHandlers(bot, { store, transport, broadcastQueue, delivery, logger });
  // Payment provider webhooks are registered here; the server stays off while there are none.
  const routes = {};
  const webhookServer = Object.keys(routes).length
    ? createWebhookServer({ http: config.http, routes, logger })
    : null;
  return { bot, broadcastQueue, webhookServer, delivery, backups, logger };
}
