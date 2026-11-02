import { answerCallback } from '../transport.js';
import { starsInvoiceSentScreen } from '../../ui/screens.js';
export function registerStarsHandlers(bot, context) {
  const { store, transport, logger, agreed, openOrder, parseOrderPayload, handlePaid } = context;
  bot.action(/^buy_stars:(\d{1,15}):(\d{1,16})$/, async (ctx) => {
    const order = await openOrder(ctx, 'stars');
    if (!order) return;
    await answerCallback(ctx);
    await ctx.telegram.sendInvoice(ctx.chat.id, {
      title: order.productTitle.slice(0, 32),
      description: `Доступ к каналу «${order.productTitle}» в Night Kavkaz`.slice(0, 255),
      payload: `order:${order.orderId}`,
      provider_token: '',
      currency: 'XTR',
      prices: [{ label: order.productTitle.slice(0, 32), amount: order.stars }],
    });
    await transport.show(ctx, starsInvoiceSentScreen(order));
  });
  bot.on('pre_checkout_query', async (ctx) => {
    const query = ctx.preCheckoutQuery;
    const orderId = parseOrderPayload(query.invoice_payload);
    const order = orderId ? store.getOrder(orderId) : undefined;
    const valid =
      order &&
      order.method === 'stars' &&
      order.status === 'pending' &&
      !order.owned &&
      order.telegramId === String(query.from.id) &&
      query.currency === 'XTR' &&
      query.total_amount === order.stars &&
      Boolean(agreed(query.from.id));
    if (valid) await ctx.answerPreCheckoutQuery(true);
    else
      await ctx.answerPreCheckoutQuery(
        false,
        order?.owned
          ? 'Этот товар у вас уже куплен.'
          : 'Счёт устарел. Откройте товар и нажмите «Купить» ещё раз.',
      );
  });
  bot.on('successful_payment', async (ctx) => {
    const payment = ctx.message.successful_payment;
    if (payment.currency !== 'XTR') return;
    const orderId = parseOrderPayload(payment.invoice_payload);
    const chargeId = payment.telegram_payment_charge_id;
    if (!orderId || !chargeId) {
      logger.error('Оплата Stars с некорректным payload.', { userId: ctx.from.id });
      return ctx.reply(
        'Оплата получена, но не распознана. Напишите администратору и укажите время оплаты.',
      );
    }
    const result = store.payOrder(orderId, {
      method: 'stars',
      paymentId: chargeId,
      stars: payment.total_amount,
    });
    const accepted = await handlePaid(result, {
      refund: () =>
        ctx.telegram.callApi('refundStarPayment', {
          user_id: ctx.from.id,
          telegram_payment_charge_id: chargeId,
        }),
    });
    if (!accepted)
      await ctx.reply(
        'Оплата получена, но обработать её автоматически не удалось. Напишите администратору.',
      );
  });
}
