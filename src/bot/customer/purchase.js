import {
  productsScreen,
  purchaseConfirmScreen,
  purchaseCompleteScreen,
  insufficientFundsText,
  changedPriceText,
  purchaseFailedText,
} from '../../ui/screens.js';
import { answerCallback } from '../transport.js';
export function registerPurchaseHandlers(bot, context) {
  const { store, transport, channels, logger, purchasedProductIds, requireAgreement } = context;
  async function notifyAdmins(ctx, text) {
    for (const target of store.listAdmins()) {
      try {
        await ctx.telegram.sendMessage(target.telegramId, text);
      } catch {}
    }
  }
  async function failPurchase(ctx, reason, productTitle) {
    logger.error('Не удалось выдать ссылку на канал.', { userId: ctx.from.id });
    await answerCallback(ctx, purchaseFailedText(), { show_alert: true });
    await transport.show(
      ctx,
      productsScreen(store.listProducts(), purchasedProductIds(ctx.from.id)),
    );
    await notifyAdmins(
      ctx,
      `Покупка «${productTitle}» не прошла: ${reason}. Деньги пользователю ${ctx.from.id} не списаны.`,
    );
  }
  bot.action(/^confirm_purchase:(\d{1,15}):(\d{1,16})$/, async (ctx) => {
    if (!(await requireAgreement(ctx))) return;
    const productId = Number(ctx.match[1]);
    const product = store.getProduct(productId);
    const channelId = product?.slug ? channels[product.slug] : undefined;
    if (product && !channelId) {
      await failPurchase(ctx, 'для товара не указан ID канала в .env', product.title);
      return;
    }
    const result = store.purchaseProduct(
      ctx.from.id,
      productId,
      ctx.callbackQuery.id,
      Number(ctx.match[2]),
    );
    if (result.status === 'insufficient_funds') {
      await answerCallback(ctx, insufficientFundsText(result), { show_alert: true });
      return;
    }
    if (result.status === 'unavailable') {
      await answerCallback(ctx, 'Товар больше недоступен.', { show_alert: true });
      await transport.show(
        ctx,
        productsScreen(store.listProducts(), purchasedProductIds(ctx.from.id)),
      );
      return;
    }
    if (result.status === 'user_not_found') {
      await answerCallback(ctx, 'Не удалось найти ваш профиль. Отправьте /start.', {
        show_alert: true,
      });
      return;
    }
    if (result.status === 'already_owned') {
      await answerCallback(ctx, 'Вы уже приобрели этот товар. Повторная покупка недоступна.', {
        show_alert: true,
      });
      await transport.show(
        ctx,
        productsScreen(store.listProducts(), purchasedProductIds(ctx.from.id)),
      );
      return;
    }
    if (result.status === 'already_processed') {
      await answerCallback(ctx, 'Эта покупка уже обработана.', { show_alert: true });
      return;
    }
    if (result.status === 'price_changed') {
      const product = store.getProduct(result.productId);
      await answerCallback(ctx, changedPriceText(), { show_alert: true });
      await transport.show(ctx, purchaseConfirmScreen(product, result.balance));
      return;
    }
    const purchaseChannelId = channels[result.productSlug] ?? channelId;
    let inviteLink;
    try {
      const invite = await ctx.telegram.createChatInviteLink(purchaseChannelId, {
        member_limit: 1,
        name: `Покупка №${result.purchaseId}`.slice(0, 32),
      });
      inviteLink = invite?.invite_link;
      if (!inviteLink) throw new Error('empty invite link');
    } catch (error) {
      store.revertPurchase(result.purchaseId);
      logger.warn('Покупка отменена. Деньги возвращены.', {
        userId: ctx.from.id,
        purchaseId: result.purchaseId,
        amount: result.price,
        code: error.response?.error_code ?? error.code ?? 'UNKNOWN',
      });
      await failPurchase(
        ctx,
        `Telegram не создал ссылку (${error.response?.description ?? error.message}). ` +
          'Проверьте, что бот админ канала с правом приглашать',
        result.productTitle,
      );
      return;
    }
    if (!store.completePurchase(result.purchaseId, inviteLink)) {
      try {
        await ctx.telegram.revokeChatInviteLink(purchaseChannelId, inviteLink);
      } catch {}
      await answerCallback(ctx, purchaseFailedText(), { show_alert: true });
      return;
    }
    logger.info?.('Покупка завершена. Приглашение создано.', {
      userId: ctx.from.id,
      purchaseId: result.purchaseId,
      productId,
      amount: result.price,
      balance: result.balance,
    });
    await answerCallback(ctx, 'Оплата прошла!');
    await transport.show(ctx, purchaseCompleteScreen({ ...result, inviteLink }));
  });
}
