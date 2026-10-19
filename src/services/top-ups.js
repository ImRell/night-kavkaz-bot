import { telegramId } from '../domain/telegram-id.js';
import { isTopUpAmount, starsForRub } from '../bot/top-up-options.js';
export function createTopUpsService(context) {
  const { db } = context;
  const {
    balanceForPurchase,
    findStarsCharge,
    insertStarsTopUp,
    updateBalanceQuery,
    balanceAfterQuery,
  } = context.queries;
  const MAX_BALANCE = Number.MAX_SAFE_INTEGER;
  return {
    creditStarsTopUp(id, amount, stars, chargeId) {
      const user = telegramId(id);
      if (!isTopUpAmount(amount)) throw new TypeError('Некорректная сумма пополнения.');
      if (!Number.isSafeInteger(stars) || stars !== starsForRub(amount))
        throw new TypeError('Некорректное количество звёзд.');
      if (typeof chargeId !== 'string' || !chargeId || chargeId.length > 256)
        throw new TypeError('Некорректный ID платежа.');
      db.exec('BEGIN IMMEDIATE');
      try {
        if (findStarsCharge.get(chargeId)) {
          const balance = balanceAfterQuery.get(user)?.balance ?? 0;
          db.exec('COMMIT');
          return { status: 'already_processed', balance };
        }
        if (!balanceForPurchase.get(user)) {
          db.exec('COMMIT');
          return { status: 'user_not_found' };
        }
        const credited = updateBalanceQuery.run(amount, user, MAX_BALANCE - amount);
        if (credited.changes !== 1) {
          db.exec('COMMIT');
          return { status: 'balance_limit' };
        }
        const inserted = insertStarsTopUp.run(user, amount, stars, chargeId);
        const balance = balanceAfterQuery.get(user).balance;
        db.exec('COMMIT');
        return {
          status: 'credited',
          balance,
          amount,
          stars,
          topUpId: Number(inserted.lastInsertRowid),
        };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
