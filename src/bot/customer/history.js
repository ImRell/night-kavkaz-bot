import { purchasesScreen } from '../../ui/screens.js';
import { answerCallback } from '../transport.js';
export function registerHistoryHandlers(bot, context) {
  const { store, transport, requireAgreement } = context;
  async function showPurchases(ctx, page = 0) {
    if (!(await requireAgreement(ctx))) return;
    await answerCallback(ctx);
    await transport.show(ctx, purchasesScreen(store.listPurchases(ctx.from.id, page), page));
  }
  bot.action('my_purchases', (ctx) => showPurchases(ctx));
  bot.action(/^my_purchases:(\d{1,6})$/, (ctx) => showPurchases(ctx, Number(ctx.match[1])));
}
