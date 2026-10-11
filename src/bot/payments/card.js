import { answerCallback } from '../transport.js';
import {
  welcomeScreen,
  topUpScreen,
  cardTopUpScreen,
  receiptPromptScreen,
  receiptReminderScreen,
  receiptExpiredScreen,
  receiptSentScreen,
  receiptTooManyScreen,
  topUpApprovedScreen,
  topUpRejectedScreen,
} from '../../ui/screens.js';
import { topUpAdminCaption } from '../../ui/admin/screens.js';
export function registerCardHandlers(bot, context) {
  const {
    store,
    transport,
    moneyAcceptCard,
    hooks,
    clock,
    logger,
    waitingReceipt,
    agreed,
    requireAgreement,
    blockIfPending,
    amountFrom,
    activeReceiptState,
    sendReceiptToAdmins,
    MAX_PENDING_CARD_TOP_UPS,
  } = context;
  bot.action(/^top_up_card:(\d{1,9})$/, async (ctx) => {
    if (!(await requireAgreement(ctx))) return;
    const amount = amountFrom(ctx);
    if (!amount) return answerCallback(ctx, 'Эта сумма недоступна. Выберите сумму из списка.');
    if (await blockIfPending(ctx)) return;
    waitingReceipt.delete(String(ctx.from.id));
    await answerCallback(ctx);
    await transport.show(ctx, cardTopUpScreen(amount, moneyAcceptCard));
  });
  bot.action(/^top_up_paid:(\d{1,9})$/, async (ctx) => {
    if (!(await requireAgreement(ctx))) return;
    const amount = amountFrom(ctx);
    if (!amount || !moneyAcceptCard)
      return answerCallback(ctx, 'Оплата картой сейчас недоступна.', { show_alert: true });
    if (await blockIfPending(ctx)) return;
    waitingReceipt.set(String(ctx.from.id), { amount, createdAt: clock() });
    await answerCallback(ctx);
    await transport.show(ctx, receiptPromptScreen(amount));
  });
  bot.action('top_up_receipt_cancel', async (ctx) => {
    waitingReceipt.delete(String(ctx.from.id));
    const record = await requireAgreement(ctx);
    if (!record) return;
    await answerCallback(ctx, 'Отменено.');
    await transport.show(ctx, topUpScreen(record));
  });
  hooks.onStart = (ctx) => waitingReceipt.delete(String(ctx.from.id));
  bot.on(['photo', 'document'], async (ctx, next) => {
    const userId = String(ctx.from.id);
    const state = activeReceiptState(userId);
    if (!state) return next();
    if (state === 'expired') return transport.reply(ctx, receiptExpiredScreen());
    if (!agreed(ctx.from.id)) {
      waitingReceipt.delete(userId);
      return transport.reply(ctx, welcomeScreen());
    }
    const photo = ctx.message.photo?.at(-1);
    const fileId = photo?.file_id ?? ctx.message.document?.file_id;
    const kind = photo ? 'photo' : 'document';
    const result = store.createCardTopUp(
      userId,
      state.amount,
      fileId,
      kind,
      MAX_PENDING_CARD_TOP_UPS,
    );
    waitingReceipt.delete(userId);
    if (result.status === 'too_many')
      return transport.reply(ctx, receiptTooManyScreen(store.pendingCardTopUp(userId)));
    if (result.status !== 'created') return transport.reply(ctx, receiptExpiredScreen());
    logger.info?.('Получен чек на пополнение.', {
      userId,
      topUpId: result.topUp.id,
      amount: result.topUp.amount,
      method: 'card',
    });
    await sendReceiptToAdmins(ctx, result.topUp);
    await transport.reply(ctx, receiptSentScreen(result.topUp));
  });
  bot.on('text', async (ctx, next) => {
    const userId = String(ctx.from.id);
    const state = activeReceiptState(userId);
    if (!state) return next();
    if (state === 'expired') return transport.reply(ctx, receiptExpiredScreen());
    if (ctx.message.text.trim().toLowerCase() === '/cancel') {
      waitingReceipt.delete(userId);
      const record = agreed(ctx.from.id);
      return record
        ? transport.reply(ctx, topUpScreen(record))
        : transport.reply(ctx, welcomeScreen());
    }
    return transport.reply(ctx, receiptReminderScreen());
  });
  bot.action(/^topup_(approve|reject):(\d{1,15})$/, async (ctx) => {
    if (!store.isAdmin(ctx.from.id)) {
      return answerCallback(ctx, 'Доступ только для администраторов.', { show_alert: true });
    }
    const topUpId = Number(ctx.match[2]);
    const decision = ctx.match[1] === 'approve' ? 'approved' : 'rejected';
    const result = store.reviewCardTopUp(topUpId, ctx.from.id, decision);
    if (result.status === 'forbidden')
      return answerCallback(ctx, 'Доступ только для администраторов.', { show_alert: true });
    if (result.status === 'not_found')
      return answerCallback(ctx, 'Заявка не найдена.', { show_alert: true });
    if (result.status === 'balance_limit') {
      return answerCallback(ctx, 'Зачисление превысит максимальный баланс. Заявка не изменена.', {
        show_alert: true,
      });
    }
    const topUp = result.topUp;
    if (['approved', 'rejected'].includes(result.status)) {
      logger.info?.(
        result.status === 'approved' ? 'Чек одобрен. Баланс пополнен.' : 'Чек отклонён.',
        {
          adminId: ctx.from.id,
          userId: topUp.telegramId,
          topUpId,
          amount: topUp.amount,
          balance: result.balance,
          status: result.status,
        },
      );
    }
    const reviewer = store.findRegisteredUser(String(topUp.reviewedBy ?? ctx.from.id));
    const caption = topUpAdminCaption(
      topUp,
      store.findRegisteredUser(String(topUp.telegramId)),
      reviewer,
    );
    const messages = store.listTopUpAdminMessages(topUp.id);
    const current = ctx.callbackQuery.message;
    if (
      current &&
      !messages.some(
        (m) => String(m.chatId) === String(current.chat.id) && m.messageId === current.message_id,
      )
    ) {
      messages.push({ chatId: current.chat.id, messageId: current.message_id });
    }
    for (const { chatId, messageId } of messages) {
      try {
        await ctx.telegram.editMessageCaption(chatId, messageId, undefined, caption, {
          reply_markup: { inline_keyboard: [] },
        });
      } catch {}
    }
    if (result.status === 'already_reviewed') {
      return answerCallback(
        ctx,
        topUp.status === 'approved' ? 'Заявка уже зачислена.' : 'Заявка уже отклонена.',
        { show_alert: true },
      );
    }
    await answerCallback(
      ctx,
      decision === 'approved' ? `Зачислено ${topUp.amount} ₽.` : 'Заявка отклонена.',
    );
    try {
      await transport.send(
        ctx.telegram,
        topUp.telegramId,
        decision === 'approved'
          ? topUpApprovedScreen(topUp, result.balance)
          : topUpRejectedScreen(topUp),
      );
    } catch {
      logger.warn('Не удалось уведомить пользователя о решении по заявке.', { topUpId: topUp.id });
    }
  });
}
