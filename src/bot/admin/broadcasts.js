import { answerCallback } from '../transport.js';
import {
  broadcastMenuScreen,
  broadcastStatusScreen,
  broadcastJobsScreen,
} from '../../ui/admin/broadcasts.js';
import { discountNotificationScreen } from '../../ui/admin/discount-notifications.js';
import { adminDiscountScreen } from '../../ui/admin/discounts.js';
import { renderScreen } from '../../ui/emoji.js';
export function createBroadcastTools(context) {
  const {
    store,
    logger,
    transport,
    broadcastQueue,
    clock,
    inputs,
    drafts,
    discountOffers,
    admin,
    deny,
    validDiscountNotice,
    unavailableNotice,
    INPUT_TTL_MS,
  } = context;
  async function showBroadcastMenu(ctx) {
    if (!admin(ctx)) return deny(ctx);
    const actor = String(ctx.from.id);
    inputs.delete(actor);
    drafts.delete(actor);
    discountOffers.delete(actor);
    await answerCallback(ctx);
    await transport.show(ctx, broadcastMenuScreen());
  }
  async function confirmBroadcast(ctx, expectedToken) {
    if (!admin(ctx)) return deny(ctx);
    const actor = String(ctx.from.id);
    inputs.delete(actor);
    const draft = drafts.get(actor);
    if (
      (expectedToken && (!draft?.discountNotice || draft.token !== expectedToken)) ||
      (!expectedToken && draft?.discountNotice)
    ) {
      return answerCallback(ctx, 'Этот предпросмотр уже закрыт или устарел.', { show_alert: true });
    }
    if (!draft || draft.createdAt + INPUT_TTL_MS < clock()) {
      drafts.delete(actor);
      await answerCallback(ctx, 'Предпросмотр устарел. Создайте рассылку заново.', {
        show_alert: true,
      });
      await showBroadcastMenu(ctx);
      return;
    }
    if (draft.discountNotice && !validDiscountNotice(draft.discountNotice)) {
      drafts.delete(actor);
      return unavailableNotice(ctx, draft.discountNotice.productId);
    }
    if (draft.discountNotice && draft.discountNotice.productId !== null) {
      const notification = renderScreen(
        discountNotificationScreen(store, draft.discountNotice.productId, draft.discountNotice),
        false,
      );
      if (notification.text !== draft.text) {
        drafts.delete(actor);
        await answerCallback(
          ctx,
          'Цена товара изменилась. Установите скидку заново для нового предпросмотра.',
          { show_alert: true },
        );
        await transport.show(ctx, adminDiscountScreen(store, draft.discountNotice.productId));
        return;
      }
    }
    const allowed = new Set(store.listOrdinaryUserIds());
    const recipients = draft.recipients.filter((id) => allowed.has(id));
    const payload = { text: draft.text };
    if (draft.discountNotice) {
      payload.notification = draft.notification;
      payload.discountNotice = draft.discountNotice;
      if (draft.discountNotice.productId !== null) {
        const product = store.getProduct(draft.discountNotice.productId);
        payload.expectedPrice = product.price;
        payload.expectedBasePrice = product.basePrice;
      }
    }
    const job = broadcastQueue.enqueue(actor, payload, recipients);
    logger.info?.('Администратор поставил рассылку в очередь.', {
      adminId: actor,
      jobId: job.id,
      recipients: job.total,
    });
    drafts.delete(actor);
    await answerCallback(ctx, 'Рассылка поставлена в фоновую очередь.');
    await transport.show(ctx, broadcastStatusScreen(job));
  }
  async function showBroadcastJobs(ctx, page = 0) {
    if (!admin(ctx)) return deny(ctx);
    inputs.delete(String(ctx.from.id));
    await answerCallback(ctx);
    await transport.show(ctx, broadcastJobsScreen(store.listBroadcasts(ctx.from.id, page)));
  }
  return { showBroadcastMenu, confirmBroadcast, showBroadcastJobs };
}
export function registerBroadcastsHandlers(bot, context) {
  const {
    store,
    logger,
    transport,
    inputs,
    drafts,
    admin,
    deny,
    confirmBroadcast,
    showBroadcastJobs,
  } = context;
  bot.action('admin_broadcast_cancel', async (ctx) => {
    if (!admin(ctx)) return deny(ctx);
    drafts.delete(String(ctx.from.id));
    inputs.delete(String(ctx.from.id));
    await answerCallback(ctx, 'Рассылка отменена.');
    await transport.show(ctx, broadcastMenuScreen());
  });
  bot.action('admin_broadcast_confirm', (ctx) => confirmBroadcast(ctx));
  bot.action('admin_broadcast_jobs', (ctx) => showBroadcastJobs(ctx));
  bot.action(/^admin_broadcast_jobs:(\d{1,6})$/, (ctx) =>
    showBroadcastJobs(ctx, Number(ctx.match[1])),
  );
  bot.action(/^admin_broadcast_status:([1-9]\d{0,14})$/, async (ctx) => {
    if (!admin(ctx)) return deny(ctx);
    const job = store.getBroadcast(Number(ctx.match[1]));
    if (!job || job.actorId !== String(ctx.from.id))
      return answerCallback(ctx, 'Рассылка не найдена или принадлежит другому администратору.', {
        show_alert: true,
      });
    await answerCallback(ctx);
    await transport.show(ctx, broadcastStatusScreen(job));
  });
  bot.action(/^admin_broadcast_stop:([1-9]\d{0,14})$/, async (ctx) => {
    if (!admin(ctx)) return deny(ctx);
    const id = Number(ctx.match[1]);
    const job = store.getBroadcast(id);
    if (!job || job.actorId !== String(ctx.from.id))
      return answerCallback(ctx, 'Рассылка не найдена или принадлежит другому администратору.', {
        show_alert: true,
      });
    const cancelled = store.cancelBroadcast(id, ctx.from.id);
    if (cancelled)
      logger.info?.('Администратор остановил рассылку.', { adminId: ctx.from.id, jobId: id });
    await answerCallback(
      ctx,
      cancelled ? 'Отправка оставшихся сообщений остановлена.' : 'Рассылка уже закончена.',
    );
    await transport.show(ctx, broadcastStatusScreen(store.getBroadcast(id)));
  });
}
