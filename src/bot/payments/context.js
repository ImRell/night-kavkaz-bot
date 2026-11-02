import { answerCallback } from '../transport.js';
import {
  productsScreen,
  paymentMethodScreen,
  changedPriceText,
  purchaseFailedText,
  duplicatePaymentText,
} from '../../ui/screens.js';
const ORDER_PAYLOAD = /^order:([1-9]\d{0,15})$/;
export function createContext({
  store,
  transport,
  gate,
  delivery,
  channels = {},
  logger = console,
}) {
  const agreed = (id) => {
    const record = store.get(id);
    return gate.isAllowed(record) ? record : null;
  };
  async function requireAgreement(ctx) {
    const record = agreed(ctx.from.id);
    if (record) return record;
    await answerCallback(ctx, gate.noticeFor(ctx.from.id));
    await transport.show(ctx, gate.screenFor(ctx.from.id));
    return null;
  }
  const showProducts = (ctx) =>
    transport.show(
      ctx,
      productsScreen(store.listProducts(), store.listPurchasedProductIds(ctx.from.id)),
    );
  const showMethods = (ctx, productId) =>
    transport.show(ctx, paymentMethodScreen(store.getProduct(productId)));
  // Shared "Buy" step for every payment method: validates the product and opens an order.
  async function openOrder(ctx, method) {
    if (!(await requireAgreement(ctx))) return null;
    const productId = Number(ctx.match[1]);
    const product = store.getProduct(productId);
    // Never take money for a product that cannot be delivered.
    if (product && !channels[product.slug]) {
      logger.error('Для товара не указан ID канала в .env.', { productId });
      await answerCallback(ctx, 'Товар временно недоступен. Попробуйте позже.', {
        show_alert: true,
      });
      return null;
    }
    const result = store.createOrder(ctx.from.id, productId, method, Number(ctx.match[2]));
    if (result.status === 'created') return result;
    if (result.status === 'price_changed') {
      await answerCallback(ctx, changedPriceText(), { show_alert: true });
      await showMethods(ctx, productId);
    } else if (result.status === 'already_owned') {
      await answerCallback(ctx, 'Вы уже приобрели этот товар. Повторная покупка недоступна.', {
        show_alert: true,
      });
      await showProducts(ctx);
    } else if (result.status === 'unavailable') {
      await answerCallback(ctx, 'Товар больше недоступен.', { show_alert: true });
      await showProducts(ctx);
    } else if (result.status === 'method_unavailable') {
      await answerCallback(ctx, 'Этот способ оплаты недоступен для товара.', { show_alert: true });
      await showMethods(ctx, productId);
    } else if (result.status === 'user_not_found') {
      await answerCallback(ctx, 'Не удалось найти ваш профиль. Отправьте /start.', {
        show_alert: true,
      });
    } else {
      await answerCallback(ctx, purchaseFailedText(), { show_alert: true });
    }
    return null;
  }
  function parseOrderPayload(payload) {
    const match = ORDER_PAYLOAD.exec(payload ?? '');
    return match ? Number(match[1]) : null;
  }
  // Common reaction to a confirmed payment, regardless of the provider.
  async function handlePaid(result, { refund } = {}) {
    if (result.status === 'paid') {
      logger.info('Оплата заказа получена.', {
        userId: result.userId,
        orderId: result.orderId,
        purchaseId: result.purchaseId,
        amount: result.amount,
      });
      delivery.deliver(result.purchaseId).catch((error) =>
        logger.error('Ошибка выдачи покупки.', {
          purchaseId: result.purchaseId,
          code: error.code ?? error.name,
        }),
      );
      return true;
    }
    if (result.status === 'already_processed') return true;
    if (result.status === 'duplicate') {
      const refunded = refund
        ? await refund().then(
            () => true,
            () => false,
          )
        : false;
      logger.warn('Повторная оплата уже купленного товара.', {
        userId: result.userId,
        orderId: result.orderId,
        amount: result.amount,
        status: refunded ? 'refunded' : 'manual_refund',
      });
      await delivery.notifyUser(result.userId, duplicatePaymentText(refunded));
      await delivery.notifyAdmins(
        `Повторная оплата заказа №${result.orderId} («${result.productTitle}», ${result.amount} ₽) ` +
          `от пользователя ${result.userId}: товар уже куплен. ` +
          (refunded ? 'Stars возвращены автоматически.' : 'Верните деньги вручную.'),
      );
      return true;
    }
    logger.error('Оплата заказа не принята.', {
      status: result.status,
      userId: result.userId,
      orderId: result.orderId,
      amount: result.amount,
    });
    return false;
  }
  return {
    store,
    transport,
    logger,
    delivery,
    agreed,
    requireAgreement,
    showProducts,
    showMethods,
    openOrder,
    parseOrderPayload,
    handlePaid,
  };
}
