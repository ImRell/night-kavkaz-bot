import { telegramId } from '../domain/telegram-id.js';
import { isTopUpAmount } from '../bot/top-up-options.js';
export function createFreeKassaService(context) {
  const { db } = context;
  const {
    balanceForPurchase,
    insertFreeKassaOrder,
    findFreeKassaOrder,
    markFreeKassaOrderPaid,
    updateBalanceQuery,
    balanceAfterQuery,
  } = context.queries;
  const MAX_BALANCE = Number.MAX_SAFE_INTEGER;
  return {
    createFreeKassaOrder(id, amount) {
      const user = telegramId(id);
      if (!isTopUpAmount(amount)) throw new TypeError('Некорректная сумма пополнения.');
      if (!balanceForPurchase.get(user)) return null;
      return Number(insertFreeKassaOrder.run(user, amount).lastInsertRowid);
    },
    // Idempotent: FreeKassa retries notifications until it receives "YES".
    creditFreeKassaOrder(orderId, amount, operationId) {
      if (!Number.isSafeInteger(orderId) || orderId < 1) throw new TypeError('Некорректный заказ.');
      if (typeof operationId !== 'string' || !operationId || operationId.length > 64)
        throw new TypeError('Некорректный ID операции.');
      db.exec('BEGIN IMMEDIATE');
      try {
        const order = findFreeKassaOrder.get(orderId);
        if (!order) {
          db.exec('COMMIT');
          return { status: 'not_found' };
        }
        if (order.status === 'paid') {
          db.exec('COMMIT');
          return order.operationId === operationId
            ? { status: 'already_processed', userId: order.telegramId }
            : { status: 'operation_mismatch', userId: order.telegramId };
        }
        if (order.amount !== amount) {
          db.exec('COMMIT');
          return { status: 'amount_mismatch', userId: order.telegramId, expected: order.amount };
        }
        const credited = updateBalanceQuery.run(amount, order.telegramId, MAX_BALANCE - amount);
        if (credited.changes !== 1) {
          db.exec('COMMIT');
          return { status: 'balance_limit', userId: order.telegramId };
        }
        markFreeKassaOrderPaid.run(operationId, orderId);
        const balance = balanceAfterQuery.get(order.telegramId).balance;
        db.exec('COMMIT');
        return { status: 'credited', userId: order.telegramId, orderId, amount, balance };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
