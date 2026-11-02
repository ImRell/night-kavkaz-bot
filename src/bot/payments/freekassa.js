import { answerCallback } from '../transport.js';
import { freeKassaInvoiceScreen, freeKassaCreditedScreen } from '../../ui/screens.js';
// Only these statuses are acknowledged with "YES"; the rest are logged for manual review.
const FINAL_STATUSES = new Set(['credited', 'already_processed']);
export function registerFreeKassaHandlers(bot, context, freeKassa) {
  const { store, transport, logger, requireAgreement, amountFrom } = context;
  bot.action(/^top_up_fk:(\d{1,9})$/, async (ctx) => {
    if (!(await requireAgreement(ctx))) return;
    const amount = amountFrom(ctx);
    if (!amount)
      return answerCallback(ctx, 'Эта сумма недоступна. Выберите сумму или введите свою.');
    const orderId = store.createFreeKassaOrder(ctx.from.id, amount);
    if (!orderId) return answerCallback(ctx, 'Не удалось создать заказ. Нажмите /start.');
    await answerCallback(ctx);
    await transport.show(
      ctx,
      freeKassaInvoiceScreen(amount, freeKassa.paymentUrl(orderId, amount)),
    );
  });
  async function notifyCredited(result) {
    try {
      await transport.send(bot.telegram, result.userId, freeKassaCreditedScreen(result));
    } catch {
      logger.warn('Не удалось уведомить пользователя о пополнении.', { userId: result.userId });
    }
    const user = store.findRegisteredUser(result.userId);
    const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
    const userLabel = `${result.userId}${user?.username ? ` (@${user.username})` : ''}${userName ? `, ${userName}` : ''}`;
    const notice =
      `💳 Пополнение баланса через FreeKassa\n` +
      `Пользователь: ${userLabel}\n` +
      `Сумма: ${result.amount} ₽\n` +
      `Новый баланс: ${result.balance} ₽\n` +
      `Заказ №${result.orderId}`;
    for (const admin of store.listAdmins()) {
      try {
        await bot.telegram.sendMessage(admin.telegramId, notice);
      } catch {}
    }
  }
  // Called by the HTTP server for every notification with a valid signature.
  return async function handleFreeKassa({ orderId, amount, operationId }) {
    const result = store.creditFreeKassaOrder(orderId, amount, operationId);
    if (result.status === 'credited') {
      logger.info('Пополнение через FreeKassa.', {
        userId: result.userId,
        amount: result.amount,
        balance: result.balance,
        orderId,
        operationId,
      });
      notifyCredited(result).catch(() => {});
    } else if (result.status !== 'already_processed') {
      logger.error('Не удалось зачислить оплату FreeKassa.', {
        status: result.status,
        userId: result.userId,
        amount,
        orderId,
        operationId,
      });
    }
    return FINAL_STATUSES.has(result.status);
  };
}
