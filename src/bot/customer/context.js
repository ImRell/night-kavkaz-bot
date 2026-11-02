import { answerCallback } from '../transport.js';
export function createContext({
  store,
  transport,
  rulesVersion,
  gate,
  channels = {},
  logger = console,
}) {
  const opensCatalogBelow = (ctx) => {
    if (ctx.callbackQuery?.data === 'discount_products') return true;
    const message = ctx.callbackQuery?.message;
    return (
      ctx.callbackQuery?.data === 'products' &&
      message?.text?.startsWith('Новая скидка!') &&
      Boolean(
        message.reply_markup?.inline_keyboard
          ?.flat()
          .some(
            (button) =>
              button.callback_data === 'products' && button.text?.endsWith('Посмотреть товары'),
          ),
      )
    );
  };
  const hasAgreement = gate.isAllowed;
  const purchasedProductIds = (userId) => store.listPurchasedProductIds?.(userId) ?? [];
  const hasPurchasedProduct = (userId, productId) =>
    store.hasPurchasedProduct?.(userId, productId) ?? false;
  async function requireAgreement(ctx, replyBelow = false) {
    const record = store.get(ctx.from.id);
    if (hasAgreement(record)) return record;
    if (ctx.callbackQuery) await answerCallback(ctx, gate.noticeFor(ctx.from.id));
    const screen = gate.screenFor(ctx.from.id);
    if (replyBelow || !ctx.callbackQuery) await transport.reply(ctx, screen);
    else await transport.show(ctx, screen);
    return null;
  }
  return {
    store,
    transport,
    rulesVersion,
    gate,
    channels,
    logger,
    opensCatalogBelow,
    hasAgreement,
    purchasedProductIds,
    hasPurchasedProduct,
    requireAgreement,
  };
}
