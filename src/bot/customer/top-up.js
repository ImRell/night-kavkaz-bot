import { topUpScreen, topUpMethodScreen, customTopUpScreen } from '../../ui/screens.js';
import { answerCallback } from '../transport.js';
import { isTopUpAmount, parseTopUpAmount } from '../top-up-options.js';
const INPUT_TTL_MS = 10 * 60 * 1000;
export function registerTopUpHandlers(bot, context) {
  const { transport, requireAgreement, hasAgreement, store } = context;
  const waitingAmount = new Map();
  bot.use(async (ctx, next) => {
    if (ctx.from && (ctx.callbackQuery || ctx.message?.text?.startsWith('/'))) {
      if (
        ctx.message?.text?.trim().toLowerCase() === '/cancel' &&
        waitingAmount.has(String(ctx.from.id))
      ) {
        waitingAmount.delete(String(ctx.from.id));
        const record = store.get(ctx.from.id);
        if (!hasAgreement(record)) return requireAgreement(ctx);
        return transport.reply(ctx, topUpScreen(record));
      }
      waitingAmount.delete(String(ctx.from.id));
    }
    return next();
  });
  bot.action('top_up', async (ctx) => {
    const record = await requireAgreement(ctx);
    if (!record) return;
    await answerCallback(ctx);
    await transport.show(ctx, topUpScreen(record));
  });
  bot.action('top_up_custom', async (ctx) => {
    if (!(await requireAgreement(ctx))) return;
    const now = Date.now();
    for (const [id, createdAt] of waitingAmount) {
      if (createdAt + INPUT_TTL_MS < now) waitingAmount.delete(id);
    }
    await answerCallback(ctx);
    await transport.show(ctx, customTopUpScreen());
    waitingAmount.set(String(ctx.from.id), now);
  });
  bot.action(/^top_up_amount:(\d{1,9})$/, async (ctx) => {
    const record = await requireAgreement(ctx);
    if (!record) return;
    const amount = Number(ctx.match[1]);
    if (!isTopUpAmount(amount)) {
      await answerCallback(ctx, 'Эта сумма недоступна. Выберите сумму или введите свою.');
      await transport.show(ctx, topUpScreen(record));
      return;
    }
    await answerCallback(ctx);
    await transport.show(ctx, topUpMethodScreen(record, amount));
  });
  // Old messages must not allow bank transfers or receipt approval.
  bot.action(
    /^(?:top_up_card:|top_up_paid:|topup_approve:|topup_reject:|top_up_receipt_cancel$|admin_receipt)/,
    async (ctx) => {
      const record = await requireAgreement(ctx);
      if (!record) return;
      await answerCallback(
        ctx,
        'Этот раздел отключён. Пополнение доступно только через Telegram Stars.',
        { show_alert: true },
      );
      await transport.reply(ctx, topUpScreen(record));
    },
  );
  bot.on('text', async (ctx, next) => {
    const id = String(ctx.from.id);
    const createdAt = waitingAmount.get(id);
    if (createdAt === undefined) return next();
    if (createdAt + INPUT_TTL_MS < Date.now()) {
      waitingAmount.delete(id);
      return transport.reply(ctx, {
        parts: ['Время ввода истекло. Нажмите «Ввести свою сумму» ещё раз.'],
        rows: [[{ text: 'К пополнению', data: 'top_up' }]],
      });
    }
    const record = store.get(ctx.from.id);
    if (!hasAgreement(record)) {
      waitingAmount.delete(id);
      return requireAgreement(ctx);
    }
    const amount = parseTopUpAmount(ctx.message.text);
    if (amount === null) return transport.reply(ctx, customTopUpScreen(true));
    waitingAmount.delete(id);
    await transport.reply(ctx, topUpMethodScreen(record, amount));
  });
}
