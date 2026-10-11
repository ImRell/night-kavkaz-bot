import { telegramId } from '../domain/telegram-id.js';
export function createPurchasesService(context) {
  const { db, applyDiscount } = context;
  const {
    listPurchases,
    findPurchaseByCallback,
    findUserProductPurchase,
    listUserProductIdsQuery,
    productForPurchase,
    balanceForPurchase,
    debitBalance,
    insertPurchase,
    pendingPurchase,
    completePurchaseQuery,
    deletePurchase,
    refundBalance,
  } = context.queries;
  function revertPurchase(purchaseId) {
    const idValue = purchaseIdOf(purchaseId);
    db.exec('BEGIN IMMEDIATE');
    try {
      const pending = pendingPurchase.get(idValue);
      if (!pending) {
        db.exec('COMMIT');
        return { status: 'not_pending' };
      }
      refundBalance.run(pending.total, pending.telegramId);
      deletePurchase.run(idValue);
      const balance = balanceForPurchase.get(pending.telegramId)?.balance ?? 0;
      db.exec('COMMIT');
      return { status: 'reverted', balance, refunded: pending.total };
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  const purchaseIdOf = (value) => {
    if (!Number.isSafeInteger(value) || value < 1)
      throw new TypeError('Некорректный номер покупки.');
    return value;
  };
  return {
    listPurchasedProductIds(id) {
      return listUserProductIdsQuery.all(telegramId(id)).map((row) => row.productId);
    },
    hasPurchasedProduct(id, productId) {
      if (!Number.isSafeInteger(productId) || productId < 1)
        throw new TypeError('Некорректный ID товара.');
      return Boolean(findUserProductPurchase.get(telegramId(id), productId));
    },
    purchaseProduct(id, productId, callbackId, expectedPrice) {
      const user = telegramId(id);
      if (!Number.isSafeInteger(productId) || productId < 1)
        throw new TypeError('Некорректный ID товара.');
      if (typeof callbackId !== 'string' || callbackId.length < 1 || callbackId.length > 256) {
        throw new TypeError('Некорректный ID подтверждения покупки.');
      }
      if (!Number.isSafeInteger(expectedPrice) || expectedPrice < 0) {
        throw new TypeError('Некорректная подтверждённая цена.');
      }
      db.exec('BEGIN IMMEDIATE');
      try {
        const previous = findPurchaseByCallback.get(callbackId);
        if (previous) {
          const balance = balanceForPurchase.get(user)?.balance ?? 0;
          db.exec('COMMIT');
          return { status: 'already_processed', balance: balance, purchaseId: previous.id };
        }
        const product = applyDiscount(productForPurchase.get(productId));
        if (!product) {
          db.exec('COMMIT');
          return { status: 'unavailable' };
        }
        const previousProductPurchase = findUserProductPurchase.get(user, product.id);
        if (previousProductPurchase) {
          db.exec('COMMIT');
          return {
            status: 'already_owned',
            productTitle: product.title,
            purchaseId: previousProductPurchase.id,
          };
        }
        if (product.price !== expectedPrice) {
          const current = balanceForPurchase.get(user);
          db.exec('COMMIT');
          return {
            status: 'price_changed',
            balance: current?.balance ?? 0,
            price: product.price,
            productId: product.id,
          };
        }
        const current = balanceForPurchase.get(user);
        if (!current) {
          db.exec('COMMIT');
          return { status: 'user_not_found' };
        }
        if (current.balance < product.price) {
          db.exec('COMMIT');
          return {
            status: 'insufficient_funds',
            balance: current.balance,
            price: product.price,
            productTitle: product.title,
          };
        }
        const debit = debitBalance.run(product.price, user, product.price);
        if (debit.changes !== 1) {
          const freshBalance = balanceForPurchase.get(user)?.balance ?? 0;
          db.exec('COMMIT');
          return {
            status: 'insufficient_funds',
            balance: freshBalance,
            price: product.price,
            productTitle: product.title,
          };
        }
        const inserted = insertPurchase.run(
          user,
          product.id,
          product.title,
          product.price,
          product.currency,
          callbackId,
        );
        const balance = balanceForPurchase.get(user).balance;
        db.exec('COMMIT');
        return {
          status: 'purchased',
          balance,
          price: product.price,
          currency: product.currency,
          productTitle: product.title,
          productSlug: product.slug,
          purchaseId: Number(inserted.lastInsertRowid),
        };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    listPurchases(id, page = 0, pageSize = 5) {
      if (
        !Number.isSafeInteger(page) ||
        page < 0 ||
        !Number.isSafeInteger(pageSize) ||
        pageSize < 1 ||
        pageSize > 5 ||
        !Number.isSafeInteger(page * pageSize)
      ) {
        throw new TypeError('Некорректная страница покупок.');
      }
      const rows = listPurchases.all(telegramId(id), pageSize + 1, page * pageSize);
      return { items: rows.slice(0, pageSize), hasNext: rows.length > pageSize };
    },
    completePurchase(purchaseId, inviteLink) {
      if (typeof inviteLink !== 'string' || !/^https:\/\/t\.me\/\S{1,200}$/.test(inviteLink)) {
        throw new TypeError('Некорректная ссылка-приглашение.');
      }
      return completePurchaseQuery.run(inviteLink, purchaseIdOf(purchaseId)).changes === 1;
    },
    revertPurchase,
  };
}
