import { telegramId } from '../domain/telegram-id.js';
export function createTopUpsService(context) {
  const { db } = context;
  const {
    balanceForPurchase,
    pendingCardTopUpCount,
    insertCardTopUp,
    getTopUpQuery,
    reviewTopUpQuery,
    insertTopUpMessage,
    listTopUpMessagesQuery,
    findStarsCharge,
    insertStarsTopUp,
    isAdminQuery,
    updateBalanceQuery,
    balanceAfterQuery,
    latestPendingCardTopUp,
    pendingReceiptsCountQuery,
    pagePendingReceiptsQuery,
  } = context.queries;
  const MAX_BALANCE = 9007199254740991;
  return {
    pendingCardTopUp(id) {
      const row = latestPendingCardTopUp.get(telegramId(id));
      return row ? getTopUpQuery.get(row.id) : undefined;
    },
    pendingReceiptCount() {
      return pendingReceiptsCountQuery.get().count;
    },
    listPendingReceipts(page = 0, pageSize = 5) {
      if (
        !Number.isSafeInteger(page) ||
        page < 0 ||
        !Number.isSafeInteger(pageSize) ||
        pageSize < 1 ||
        pageSize > 10 ||
        !Number.isSafeInteger(page * pageSize)
      ) {
        throw new TypeError('Некорректная страница чеков.');
      }
      const total = pendingReceiptsCountQuery.get().count;
      const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);
      const safePage = Math.min(page, lastPage);
      const rows = pagePendingReceiptsQuery.all(pageSize + 1, safePage * pageSize);
      return {
        items: rows.slice(0, pageSize),
        hasPrev: safePage > 0,
        hasNext: rows.length > pageSize,
        page: safePage,
        pageSize,
        total,
      };
    },
    createCardTopUp(id, amount, receiptFileId, receiptKind, maxPending = 1) {
      const user = telegramId(id);
      if (!Number.isSafeInteger(amount) || amount < 1)
        throw new TypeError('Некорректная сумма пополнения.');
      if (typeof receiptFileId !== 'string' || !receiptFileId || receiptFileId.length > 512) {
        throw new TypeError('Некорректный файл чека.');
      }
      if (!['photo', 'document'].includes(receiptKind))
        throw new TypeError('Некорректный тип чека.');
      db.exec('BEGIN IMMEDIATE');
      try {
        if (!balanceForPurchase.get(user)) {
          db.exec('COMMIT');
          return { status: 'user_not_found' };
        }
        if (pendingCardTopUpCount.get(user).count >= maxPending) {
          db.exec('COMMIT');
          return { status: 'too_many' };
        }
        const inserted = insertCardTopUp.run(user, amount, receiptFileId, receiptKind);
        db.exec('COMMIT');
        return { status: 'created', topUp: getTopUpQuery.get(Number(inserted.lastInsertRowid)) };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    getTopUp(topUpId) {
      if (!Number.isSafeInteger(topUpId) || topUpId < 1)
        throw new TypeError('Некорректный номер заявки.');
      return getTopUpQuery.get(topUpId);
    },
    addTopUpAdminMessage(topUpId, chatId, messageId) {
      insertTopUpMessage.run(topUpId, String(chatId), messageId);
    },
    listTopUpAdminMessages(topUpId) {
      return listTopUpMessagesQuery.all(topUpId);
    },
    reviewCardTopUp(topUpId, adminId, decision) {
      const actor = telegramId(adminId);
      if (!Number.isSafeInteger(topUpId) || topUpId < 1)
        throw new TypeError('Некорректный номер заявки.');
      if (!['approved', 'rejected'].includes(decision))
        throw new TypeError('Некорректное решение.');
      db.exec('BEGIN IMMEDIATE');
      try {
        if (!isAdminQuery.get(actor)) {
          db.exec('COMMIT');
          return { status: 'forbidden' };
        }
        const topUp = getTopUpQuery.get(topUpId);
        if (!topUp || topUp.method !== 'card') {
          db.exec('COMMIT');
          return { status: 'not_found' };
        }
        if (topUp.status !== 'pending') {
          db.exec('COMMIT');
          return { status: 'already_reviewed', topUp };
        }
        if (decision === 'approved') {
          const credited = updateBalanceQuery.run(
            topUp.amount,
            topUp.telegramId,
            MAX_BALANCE - topUp.amount,
          );
          if (credited.changes !== 1) {
            db.exec('COMMIT');
            return { status: 'balance_limit', topUp };
          }
        }
        reviewTopUpQuery.run(decision, actor, topUpId);
        const balance = balanceAfterQuery.get(topUp.telegramId)?.balance ?? 0;
        db.exec('COMMIT');
        return { status: decision, topUp: getTopUpQuery.get(topUpId), balance };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    creditStarsTopUp(id, amount, stars, chargeId) {
      const user = telegramId(id);
      if (!Number.isSafeInteger(amount) || amount < 1)
        throw new TypeError('Некорректная сумма пополнения.');
      if (!Number.isSafeInteger(stars) || stars < 1)
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
