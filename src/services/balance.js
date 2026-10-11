import { telegramId } from '../domain/telegram-id.js';
export function createBalanceService(context) {
  const { db } = context;
  const {
    isAdminQuery,
    userLookupQuery,
    userByUsernameQuery,
    updateBalanceQuery,
    balanceAfterQuery,
    insertCreditAudit,
  } = context.queries;
  return {
    creditUser(adminId, userQuery, amount) {
      const actor = telegramId(adminId);
      const query = String(userQuery ?? '').trim();
      const idQuery = /^[1-9]\d{0,19}$/.test(query) ? query : null;
      const username = query.replace(/^@/, '');
      const validUsername = !idQuery && /^[A-Za-z0-9_]{1,32}$/.test(username);
      if (!idQuery && !validUsername) throw new TypeError('Некорректный Telegram ID или username.');
      if (!Number.isSafeInteger(amount) || amount < 1 || amount > 9007199254740991) {
        throw new TypeError('Сумма пополнения должна быть положительным целым числом рублей.');
      }
      db.exec('BEGIN IMMEDIATE');
      try {
        if (!isAdminQuery.get(actor)) {
          db.exec('COMMIT');
          return { status: 'forbidden' };
        }
        const registered = idQuery
          ? userLookupQuery.get(idQuery)
          : userByUsernameQuery.get(username);
        if (!registered) {
          db.exec('COMMIT');
          return { status: 'not_found', query };
        }
        const target = registered.telegramId;
        const result = updateBalanceQuery.run(amount, target, 9007199254740991 - amount);
        if (result.changes !== 1) {
          db.exec('COMMIT');
          return { status: 'balance_limit' };
        }
        const balance = balanceAfterQuery.get(target).balance;
        insertCreditAudit.run(target, actor, amount, balance);
        db.exec('COMMIT');
        return { status: 'credited', telegramId: target, amount, balance };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
