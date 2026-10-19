import { welcomeScreen } from '../../ui/screens.js';
import { answerCallback } from '../transport.js';
export function createContext({
  store,
  transport,
  rulesVersion,
  channels = {},
  hooks = {},
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
  const hasAgreement = (record) =>
    Boolean(record?.acceptedAt && record.rulesVersion === rulesVersion);
  const purchasedProductIds = (userId) => store.listPurchasedProductIds?.(userId) ?? [];
  const hasPurchasedProduct = (userId, productId) =>
    store.hasPurchasedProduct?.(userId, productId) ?? false;
  async function requireAgreement(ctx, replyBelow = false) {
    const record = store.get(ctx.from.id);
    if (hasAgreement(record)) return record;
    if (ctx.callbackQuery)
      await answerCallback(ctx, 'Сначала подтвердите возраст и согласие с правилами.');
    if (replyBelow || !ctx.callbackQuery) await transport.reply(ctx, welcomeScreen());
    else await transport.show(ctx, welcomeScreen());
    return null;
  }
  return {
    store,
    transport,
    rulesVersion,
    channels,
    hooks,
    logger,
    opensCatalogBelow,
    hasAgreement,
    purchasedProductIds,
    hasPurchasedProduct,
    requireAgreement,
  };
}
