import { answerCallback } from '../transport.js';
import { adminDiscountsScreen, adminDiscountScreen } from '../../ui/admin/discounts.js';
import {
  discountNotificationScreen,
  discountBroadcastPreviewScreen,
} from '../../ui/admin/discount-notifications.js';
import { renderScreen } from '../../ui/emoji.js';
export function createDiscountTools(context) {
  const { store, transport, inputs, admin, deny } = context;
  const discountTarget = (value) => (value === 'all' ? null : Number(value));
  async function showDiscounts(ctx, page = 0) {
    if (!admin(ctx)) return deny(ctx);
    inputs.delete(String(ctx.from.id));
    await answerCallback(ctx);
    await transport.show(ctx, adminDiscountsScreen(store, page));
  }
  function validDiscountNotice(notice) {
    const current = store.getDiscount(notice.productId);
    return Boolean(
      current?.active &&
      current.percent === notice.percent &&
      current.endsAt === notice.endsAt &&
      current.updatedAt === notice.updatedAt &&
      current.updatedBy === notice.updatedBy &&
      (notice.productId === null || store.getProduct(notice.productId)),
    );
  }
  async function unavailableNotice(ctx, productId) {
    await answerCallback(
      ctx,
      'Предложение устарело или скидка изменена/отключена. Рассылка не отправлена.',
      { show_alert: true },
    );
    await transport.show(ctx, adminDiscountScreen(store, productId));
  }
  return { discountTarget, showDiscounts, validDiscountNotice, unavailableNotice };
}
export function registerDiscountsHandlers(bot, context) {
  const {
    store,
    transport,
    clock,
    inputs,
    drafts,
    discountOffers,
    admin,
    deny,
    startInput,
    discountTarget,
    showDiscounts,
    validDiscountNotice,
    unavailableNotice,
    confirmBroadcast,
    INPUT_TTL_MS,
  } = context;
  bot.action('admin_discounts', (ctx) => showDiscounts(ctx));
  bot.action(/^admin_discounts:(\d{1,6})$/, (ctx) => showDiscounts(ctx, Number(ctx.match[1])));
  bot.action(/^admin_discount:(all|[1-9]\d{0,14})$/, async (ctx) => {
    if (!admin(ctx)) return deny(ctx);
    inputs.delete(String(ctx.from.id));
    await answerCallback(ctx);
    await transport.show(ctx, adminDiscountScreen(store, discountTarget(ctx.match[1])));
  });
  bot.action(/^admin_discount_set:(all|[1-9]\d{0,14})$/, async (ctx) => {
    if (!admin(ctx)) return deny(ctx);
    const productId = discountTarget(ctx.match[1]);
    if (productId !== null && !store.getProduct(productId)) {
      return answerCallback(ctx, 'Товар недоступен.', { show_alert: true });
    }
    discountOffers.delete(String(ctx.from.id));
    if (drafts.get(String(ctx.from.id))?.discountNotice) drafts.delete(String(ctx.from.id));
    await startInput(
      ctx,
      'discount_percent',
      'Процент скидки',
      'Введите целый процент от 1 до 100. Следующим шагом укажите окончание скидки по Москве. До завершения обоих шагов текущая скидка не изменится.',
      { productId, cancelData: `admin_discount:${ctx.match[1]}` },
    );
  });
  bot.action(/^admin_discount_off:(all|[1-9]\d{0,14})$/, async (ctx) => {
    if (!admin(ctx)) return deny(ctx);
    inputs.delete(String(ctx.from.id));
    const productId = discountTarget(ctx.match[1]);
    const changed = store.disableDiscount(ctx.from.id, productId);
    await answerCallback(ctx, changed ? 'Скидка отключена.' : 'Скидка уже отключена.');
    await transport.show(ctx, adminDiscountScreen(store, productId));
  });
  bot.action(/^admin_discount_notify:(yes|no):([a-f0-9]{12})$/, async (ctx) => {
    if (!admin(ctx)) return deny(ctx);
    const actor = String(ctx.from.id);
    const offer = discountOffers.get(actor);
    if (!offer || offer.token !== ctx.match[2]) {
      return answerCallback(ctx, 'Это предложение уже закрыто или устарело.', { show_alert: true });
    }
    discountOffers.delete(actor);
    if (ctx.match[1] === 'no') {
      await answerCallback(ctx, 'Скидка сохранена без рассылки.');
      await transport.show(ctx, adminDiscountScreen(store, offer.productId));
      return;
    }
    if (offer.createdAt + INPUT_TTL_MS < clock() || !validDiscountNotice(offer)) {
      return unavailableNotice(ctx, offer.productId);
    }
    const notification = discountNotificationScreen(store, offer.productId, offer);
    const rendered = renderScreen(notification, false);
    const recipients = store.listOrdinaryUserIds();
    drafts.set(actor, {
      text: rendered.text,
      notification,
      recipients,
      createdAt: clock(),
      discountNotice: offer,
      token: offer.token,
    });
    await answerCallback(ctx);
    await transport.show(
      ctx,
      discountBroadcastPreviewScreen(notification, recipients.length, offer.token),
    );
  });
  bot.action(/^admin_discount_notify_cancel:([a-f0-9]{12})$/, async (ctx) => {
    if (!admin(ctx)) return deny(ctx);
    const actor = String(ctx.from.id);
    const draft = drafts.get(actor);
    if (!draft?.discountNotice || draft.token !== ctx.match[1]) {
      return answerCallback(ctx, 'Этот предпросмотр уже закрыт или устарел.', { show_alert: true });
    }
    drafts.delete(actor);
    await answerCallback(ctx, 'Рассылка отменена. Скидка сохранена.');
    await transport.show(ctx, adminDiscountScreen(store, draft.discountNotice.productId));
  });
  bot.action(/^admin_discount_send:([a-f0-9]{12})$/, (ctx) => confirmBroadcast(ctx, ctx.match[1]));
}
