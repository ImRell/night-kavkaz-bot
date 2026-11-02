import { answerCallback } from '../transport.js';
import { freeKassaInvoiceScreen } from '../../ui/screens.js';
export function registerFreeKassaHandlers(bot, context, freeKassa) {
  const { store, transport, openOrder, handlePaid } = context;
  bot.action(/^buy_fk:(\d{1,15}):(\d{1,16})$/, async (ctx) => {
    const order = await openOrder(ctx, 'freekassa');
    if (!order) return;
    await answerCallback(ctx);
    await transport.show(
      ctx,
      freeKassaInvoiceScreen(order, freeKassa.paymentUrl(order.orderId, order.amount)),
    );
  });
  // Called by the HTTP server for every notification with a valid signature.
  return function handleFreeKassa({ orderId, amount, operationId }) {
    return handlePaid(
      store.payOrder(orderId, { method: 'freekassa', paymentId: operationId, amount }),
    );
  };
}
