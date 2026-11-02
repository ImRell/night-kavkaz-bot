import { Telegraf } from 'telegraf';
import { createLogger } from './logger.js';
import { CHANNEL_ENV } from './config.js';
import { registerHandlers } from './bot/handlers.js';
import { registerPaymentHandlers } from './bot/payments.js';
import { registerAdminHandlers } from './bot/admin.js';
import { createTransport } from './bot/transport.js';
import { createBroadcastQueue } from './bot/broadcast-queue.js';
import { createDelivery } from './bot/delivery.js';
import { createFreeKassa } from './integrations/freekassa.js';
import { createXRocket } from './integrations/xrocket.js';
import {
  createWebhookServer,
  freeKassaRoute,
  xRocketRoute,
  FREEKASSA_NOTIFY_PATH,
  XROCKET_NOTIFY_PATH,
} from './http/server.js';
export function createApplication(config, store, { logger = createLogger() } = {}) {
  const bot = new Telegraf(config.token);
  const transport = createTransport({ logger });
  const hooks = {};
  for (const [slug, name] of Object.entries(CHANNEL_ENV)) {
    if (!config.channels[slug])
      logger.warn(`Не указан ${name}: покупка этого товара будет недоступна.`);
  }
  const freeKassa = config.freeKassa ? createFreeKassa(config.freeKassa) : null;
  if (!freeKassa) logger.warn('FreeKassa не настроена: оплата картой недоступна.');
  const xRocket = config.xRocket ? createXRocket(config.xRocket) : null;
  if (!xRocket) logger.warn('xRocket не настроен: оплата криптовалютой недоступна.');
  const delivery = createDelivery({
    store,
    telegram: bot.telegram,
    transport,
    channels: config.channels,
    logger,
  });
  registerHandlers(bot, {
    store,
    rulesVersion: config.rulesVersion,
    transport,
    channels: config.channels,
    hooks,
    logger,
  });
  const { handleFreeKassa, handleXRocket } = registerPaymentHandlers(bot, {
    store,
    transport,
    rulesVersion: config.rulesVersion,
    channels: config.channels,
    delivery,
    logger,
    freeKassa,
    xRocket,
  });
  const broadcastQueue = createBroadcastQueue({ store, telegram: bot.telegram, transport, logger });
  registerAdminHandlers(bot, { store, transport, broadcastQueue, delivery, logger });
  const routes = {};
  if (freeKassa)
    routes[FREEKASSA_NOTIFY_PATH] = freeKassaRoute({
      allowedIps: config.freeKassa.allowedIps,
      freeKassa,
      handle: handleFreeKassa,
      logger,
    });
  if (xRocket)
    routes[XROCKET_NOTIFY_PATH] = xRocketRoute({ xRocket, handle: handleXRocket, logger });
  const webhookServer = Object.keys(routes).length
    ? createWebhookServer({ http: config.http, routes, logger })
    : null;
  return { bot, broadcastQueue, webhookServer, delivery, logger };
}
