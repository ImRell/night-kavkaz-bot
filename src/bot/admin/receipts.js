import { answerCallback } from '../transport.js';
import {
  adminReceiptsScreen,
  topUpAdminCaption,
  topUpAdminKeyboard,
} from '../../ui/admin/screens.js';
export function createReceiptTools(context) {
  const { store, transport, inputs, admin, deny } = context;
  async function showReceipts(ctx, page = 0, notice) {
    if (!admin(ctx)) return deny(ctx);
    inputs.delete(String(ctx.from.id));
    if (notice !== undefined) await answerCallback(ctx, notice);
    else await answerCallback(ctx);
    await transport.show(ctx, adminReceiptsScreen(store.listPendingReceipts(page, 5)));
  }
  return { showReceipts };
}
export function registerReceiptsHandlers(bot, context) {
  const { store, transport, logger, admin, deny, showReceipts } = context;
  bot.action('admin_receipts', (ctx) => showReceipts(ctx));
  bot.action(/^admin_receipts:(\d{1,6})$/, (ctx) => showReceipts(ctx, Number(ctx.match[1])));
  bot.action(/^admin_receipts_refresh:(\d{1,6})$/, (ctx) =>
    showReceipts(ctx, Number(ctx.match[1]), 'Данные обновлены.'),
  );
  bot.action(/^admin_receipt:(\d{1,15}):(\d{1,6})$/, async (ctx) => {
    if (!admin(ctx)) return deny(ctx);
    const topUp = store.getTopUp(Number(ctx.match[1]));
    const page = Number(ctx.match[2]);
    if (!topUp || topUp.method !== 'card' || topUp.status !== 'pending') {
      await answerCallback(ctx, 'Этот чек уже проверен. Список обновлён.', { show_alert: true });
      await transport.show(ctx, adminReceiptsScreen(store.listPendingReceipts(page, 5)));
      return;
    }
    const extra = {
      caption: topUpAdminCaption(topUp, store.findRegisteredUser(String(topUp.telegramId))),
      reply_markup: topUpAdminKeyboard(topUp.id),
    };
    try {
      const message =
        topUp.receiptKind === 'photo'
          ? await ctx.telegram.sendPhoto(ctx.chat.id, topUp.receiptFileId, extra)
          : await ctx.telegram.sendDocument(ctx.chat.id, topUp.receiptFileId, extra);
      store.addTopUpAdminMessage(topUp.id, ctx.chat.id, message.message_id);
      await answerCallback(ctx, `Чек №${topUp.id} отправлен ниже.`);
    } catch (error) {
      logger.warn('Не удалось открыть чек.', {
        topUpId: topUp.id,
        code: error.response?.error_code ?? error.code,
      });
      await answerCallback(ctx, 'Не удалось открыть чек. Попробуйте ещё раз.', {
        show_alert: true,
      });
    }
  });
}
