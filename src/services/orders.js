import { telegramId } from '../domain/telegram-id.js';
import { isStarsAmount, starsForRub } from '../domain/stars.js';
const METHODS = new Set(['stars', 'freekassa']);
export function createOrdersService(context) {
  const { db, applyDiscount } = context;
  const {
    productForPurchase,
    findUserProductPurchase,
    getUser,
    findOpenOrder,
    insertOrder,
    getOrderQuery,
    markOrderQuery,
    insertPurchase,
  } = context.queries;
  const orderIdOf = (value) => {
    if (!Number.isSafeInteger(value) || value < 1)
      throw new TypeError('Некорректный номер заказа.');
    return value;
  };
  return {
    // Reuses an open order with the same terms so repeated "Buy" taps do not pile up rows.
    createOrder(id, productId, method, expectedPrice) {
      const user = telegramId(id);
      if (!Number.isSafeInteger(productId) || productId < 1)
        throw new TypeError('Некорректный ID товара.');
      if (!METHODS.has(method)) throw new TypeError('Некорректный способ оплаты.');
      if (!Number.isSafeInteger(expectedPrice) || expectedPrice < 0)
        throw new TypeError('Некорректная подтверждённая цена.');
      db.exec('BEGIN IMMEDIATE');
      try {
        const product = applyDiscount(productForPurchase.get(productId));
        if (!product || product.price < 1) {
          db.exec('COMMIT');
          return { status: 'unavailable' };
        }
        if (product.price !== expectedPrice) {
          db.exec('COMMIT');
          return { status: 'price_changed', productId: product.id };
        }
        if (!getUser.get(user)) {
          db.exec('COMMIT');
          return { status: 'user_not_found' };
        }
        if (findUserProductPurchase.get(user, product.id)) {
          db.exec('COMMIT');
          return { status: 'already_owned', productId: product.id };
        }
        if (method === 'stars' && !isStarsAmount(product.price)) {
          db.exec('COMMIT');
          return { status: 'method_unavailable', productId: product.id };
        }
        const stars = method === 'stars' ? starsForRub(product.price) : null;
        const open = findOpenOrder.get(user, product.id, method, product.price);
        const orderId = open
          ? open.id
          : Number(
              insertOrder.run(user, product.id, product.title, product.price, method, stars)
                .lastInsertRowid,
            );
        db.exec('COMMIT');
        return {
          status: 'created',
          orderId,
          productId: product.id,
          productTitle: product.title,
          amount: product.price,
          stars,
        };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    getOrder(orderId) {
      const order = getOrderQuery.get(orderIdOf(orderId));
      if (!order) return undefined;
      return {
        ...order,
        owned: Boolean(findUserProductPurchase.get(order.telegramId, order.productId)),
      };
    },
    // Idempotent per payment: payment providers may deliver the same confirmation several times.
    payOrder(orderId, { method, paymentId, amount = null, stars = null }) {
      orderIdOf(orderId);
      if (!METHODS.has(method)) throw new TypeError('Некорректный способ оплаты.');
      if (typeof paymentId !== 'string' || !paymentId || paymentId.length > 256)
        throw new TypeError('Некорректный ID платежа.');
      db.exec('BEGIN IMMEDIATE');
      try {
        const order = getOrderQuery.get(orderId);
        if (!order) {
          db.exec('COMMIT');
          return { status: 'not_found' };
        }
        const base = {
          orderId,
          userId: order.telegramId,
          productId: order.productId,
          productTitle: order.productTitle,
          amount: order.amount,
          stars: order.stars,
        };
        if (order.method !== method) {
          db.exec('COMMIT');
          return { ...base, status: 'method_mismatch' };
        }
        if (order.status !== 'pending') {
          db.exec('COMMIT');
          if (order.paymentId !== paymentId) return { ...base, status: 'payment_mismatch' };
          return { ...base, status: 'already_processed', purchaseId: order.purchaseId };
        }
        if (
          (amount !== null && amount !== order.amount) ||
          (stars !== null && stars !== order.stars)
        ) {
          db.exec('COMMIT');
          return { ...base, status: 'amount_mismatch' };
        }
        // The user may have paid two orders for one product (e.g. Stars and card at once).
        if (findUserProductPurchase.get(order.telegramId, order.productId)) {
          markOrderQuery.run('duplicate', paymentId, null, orderId);
          db.exec('COMMIT');
          return { ...base, status: 'duplicate' };
        }
        const inserted = insertPurchase.run(
          order.telegramId,
          order.productId,
          order.productTitle,
          order.amount,
          method,
        );
        const purchaseId = Number(inserted.lastInsertRowid);
        markOrderQuery.run('paid', paymentId, purchaseId, orderId);
        db.exec('COMMIT');
        return { ...base, status: 'paid', purchaseId };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
