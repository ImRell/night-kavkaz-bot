import { answerCallback } from '../transport.js';
export function registerBuyHandlers(bot, context) {
  const { store, requireAgreement, showProducts, showMethods } = context;
  bot.action(/^buy:(\d{1,15})$/, async (ctx) => {
    if (!(await requireAgreement(ctx))) return;
    const productId = Number(ctx.match[1]);
    if (store.hasPurchasedProduct(ctx.from.id, productId)) {
      await answerCallback(ctx, 'Вы уже приобрели этот товар. Повторная покупка недоступна.');
      await showProducts(ctx);
      return;
    }
    await answerCallback(ctx);
    await showMethods(ctx, productId);
  });
}
