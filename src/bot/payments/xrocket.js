import { answerCallback } from '../transport.js';
import { cryptoInvoiceScreen } from '../../ui/screens.js';
export function registerXRocketHandlers(bot, context, xRocket) {
  const { store, transport, logger, openOrder, showMethods, handlePaid } = context;
  bot.action(/^buy_xr:(\d{1,15}):(\d{1,16})$/, async (ctx) => {
    const order = await openOrder(ctx, 'xrocket');
    if (!order) return;
    let invoice;
    try {
      invoice = await xRocket.createInvoice({
        orderId: order.orderId,
        amount: order.amount,
        description: `Доступ к каналу «${order.productTitle}» в Night Kavkaz`,
      });
    } catch (error) {
      logger.error('Не удалось создать счёт xRocket.', {
        orderId: order.orderId,
        code: error.code ?? error.name,
      });
      await answerCallback(
        ctx,
        'Оплата криптовалютой временно недоступна. Выберите другой способ.',
        {
          show_alert: true,
        },
      );
      await showMethods(ctx, order.productId);
      return;
    }
    store.attachOrderInvoice(order.orderId, invoice);
    await answerCallback(ctx);
    await transport.show(ctx, cryptoInvoiceScreen(order, invoice));
  });
  // Called by the HTTP server for every paid invoice with a valid signature.
  return function handleXRocket({ orderId, externalId, cryptoAmount }) {
    return handlePaid(
      store.payOrder(orderId, {
        method: 'xrocket',
        paymentId: externalId,
        externalId,
        cryptoAmount,
      }),
    );
  };
}
