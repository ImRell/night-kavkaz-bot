import { topUpScreen, topUpMethodScreen } from '../../ui/screens.js';
import { answerCallback } from '../transport.js';
import { isTopUpAmount } from '../top-up-options.js';
export function registerTopUpHandlers(bot, context) {
  const { transport, requireAgreement } = context;
  bot.action('top_up', async (ctx) => {
    const record = await requireAgreement(ctx);
    if (!record) return;
    await answerCallback(ctx);
    await transport.show(ctx, topUpScreen(record));
  });
  bot.action(/^top_up_amount:(\d{1,9})$/, async (ctx) => {
    const record = await requireAgreement(ctx);
    if (!record) return;
    const amount = Number(ctx.match[1]);
    if (!isTopUpAmount(amount)) {
      await answerCallback(ctx, 'Эта сумма недоступна. Выберите сумму из списка.');
      await transport.show(ctx, topUpScreen(record));
      return;
    }
    await answerCallback(ctx);
    await transport.show(ctx, topUpMethodScreen(record, amount));
  });
}
