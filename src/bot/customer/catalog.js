import { productsScreen, purchaseConfirmScreen } from '../../ui/screens.js';
import { answerCallback } from '../transport.js';
export function registerCatalogHandlers(bot, context) {
  const {
    store,
    transport,
    opensCatalogBelow,
    purchasedProductIds,
    hasPurchasedProduct,
    requireAgreement,
  } = context;
  async function showProducts(ctx, replyBelow = false) {
    if (!(await requireAgreement(ctx, replyBelow))) return;
    await answerCallback(ctx);
    const screen = productsScreen(store.listProducts(), purchasedProductIds(ctx.from.id));
    if (replyBelow) await transport.reply(ctx, screen);
    else await transport.show(ctx, screen);
  }
  bot.action('products', (ctx) => showProducts(ctx, opensCatalogBelow(ctx)));
  bot.action('discount_products', (ctx) => showProducts(ctx, true));
  bot.action(/^product:(\d{1,15})$/, async (ctx) => {
    if (!(await requireAgreement(ctx))) return;
    const product = store.getProduct(Number(ctx.match[1]));
    if (product && hasPurchasedProduct(ctx.from.id, product.id)) {
      await answerCallback(ctx, 'Вы уже приобрели этот товар. Повторная покупка недоступна.');
      await transport.show(
        ctx,
        productsScreen(store.listProducts(), purchasedProductIds(ctx.from.id)),
      );
      return;
    }
    await answerCallback(ctx);
    const record = store.get(ctx.from.id);
    await transport.show(ctx, purchaseConfirmScreen(product, record?.balance ?? 0));
  });
}
