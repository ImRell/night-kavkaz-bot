import { answerCallback } from '../transport.js';
import { starsForRub } from '../top-up-options.js';
import { starsInvoiceSentScreen, starsCreditedScreen } from '../../ui/screens.js';
export function registerStarsHandlers(bot, context) {
  const { store, transport, logger, agreed, requireAgreement, amountFrom, parseStarsPayload } =
    context;
  bot.action(/^top_up_stars:(\d{1,9})$/, async (ctx) => {
    if (!(await requireAgreement(ctx))) return;
    const amount = amountFrom(ctx);
    if (!amount)
      return answerCallback(ctx, 'Эта сумма недоступна. Выберите сумму или введите свою.');
    const stars = starsForRub(amount);
    await answerCallback(ctx);
    await ctx.telegram.sendInvoice(ctx.chat.id, {
      title: 'Пополнение баланса',
      description: `Пополнение баланса Night Kavkaz на ${amount} ₽`,
      payload: `stars:${amount}:${ctx.from.id}`,
      provider_token: '',
      currency: 'XTR',
      prices: [{ label: `Пополнение на ${amount} ₽`, amount: stars }],
    });
    await transport.show(ctx, starsInvoiceSentScreen(amount));
  });
  bot.on('pre_checkout_query', async (ctx) => {
    const query = ctx.preCheckoutQuery;
    const parsed = parseStarsPayload(query.invoice_payload);
    const valid =
      parsed &&
      parsed.userId === String(query.from.id) &&
      query.currency === 'XTR' &&
      query.total_amount === starsForRub(parsed.amount) &&
      Boolean(agreed(query.from.id));
    if (valid) await ctx.answerPreCheckoutQuery(true);
    else
      await ctx.answerPreCheckoutQuery(
        false,
        'Счёт устарел. Создайте новый в разделе «Пополнить баланс».',
      );
  });
  bot.on('successful_payment', async (ctx) => {
    const payment = ctx.message.successful_payment;
    if (payment.currency !== 'XTR') return;
    const parsed = parseStarsPayload(payment.invoice_payload);
    if (
      !parsed ||
      parsed.userId !== String(ctx.from.id) ||
      payment.total_amount !== starsForRub(parsed.amount) ||
      !payment.telegram_payment_charge_id
    ) {
      logger.error('Оплата Stars с некорректным payload.', {
        userId: ctx.from.id,
      });
      return ctx.reply(
        'Оплата получена, но не распознана. Напишите администратору и укажите время оплаты.',
      );
    }
    const result = store.creditStarsTopUp(
      ctx.from.id,
      parsed.amount,
      payment.total_amount,
      payment.telegram_payment_charge_id,
    );
    if (result.status === 'credited') {
      logger.info?.('Пополнение через Telegram Stars.', {
        userId: ctx.from.id,
        amount: result.amount,
        stars: result.stars,
        balance: result.balance,
        topUpId: result.topUpId,
      });
      await transport.reply(ctx, starsCreditedScreen(result));
      const user = store.findRegisteredUser(String(ctx.from.id));
      const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
      const userLabel = `${ctx.from.id}${ctx.from.username ? ` (@${ctx.from.username})` : ''}${userName ? `, ${userName}` : ''}`;
      const notice =
        `⭐ Пополнение баланса через Telegram Stars\n` +
        `Пользователь: ${userLabel}\n` +
        `Сумма: ${result.amount} ₽ (${result.stars} ⭐)\n` +
        `Новый баланс: ${result.balance} ₽\n` +
        `Заявка №${result.topUpId}`;
      for (const admin of store.listAdmins()) {
        try {
          await ctx.telegram.sendMessage(admin.telegramId, notice);
        } catch {}
      }
      return;
    }
    if (result.status === 'already_processed') return;
    logger.error('Не удалось зачислить оплату Stars.', {
      status: result.status,
      userId: ctx.from.id,
    });
    return ctx.reply(
      'Оплата получена, но зачислить её автоматически не удалось. Напишите администратору.',
    );
  });
}
