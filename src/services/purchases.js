import { telegramId } from '../domain/telegram-id.js';
export function createPurchasesService(context) {
  const { db } = context;
  const {
    listPurchases,
    findUserProductPurchase,
    listUserProductIdsQuery,
    productForPurchase,
    insertPurchase,
    pendingPurchase,
    allPendingPurchases,
    completePurchaseQuery,
    isAdminQuery,
    userLookupQuery,
  } = context.queries;
  const purchaseIdOf = (value) => {
    if (!Number.isSafeInteger(value) || value < 1)
      throw new TypeError('Некорректный номер покупки.');
    return value;
  };
  const productIdOf = (value) => {
    if (!Number.isSafeInteger(value) || value < 1) throw new TypeError('Некорректный ID товара.');
    return value;
  };
  return {
    listPurchasedProductIds(id) {
      return listUserProductIdsQuery.all(telegramId(id)).map((row) => row.productId);
    },
    hasPurchasedProduct(id, productId) {
      return Boolean(findUserProductPurchase.get(telegramId(id), productIdOf(productId)));
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
    // Paid purchases that still wait for an invite link.
    getPendingPurchase(purchaseId) {
      return pendingPurchase.get(purchaseIdOf(purchaseId));
    },
    listPendingPurchaseIds() {
      return allPendingPurchases.all().map((row) => row.id);
    },
    completePurchase(purchaseId, inviteLink) {
      if (typeof inviteLink !== 'string' || !/^https:\/\/t\.me\/\S{1,200}$/.test(inviteLink)) {
        throw new TypeError('Некорректная ссылка-приглашение.');
      }
      return completePurchaseQuery.run(inviteLink, purchaseIdOf(purchaseId)).changes === 1;
    },
    grantProduct(adminId, userId, productId) {
      const actor = telegramId(adminId);
      const user = telegramId(userId);
      productIdOf(productId);
      db.exec('BEGIN IMMEDIATE');
      try {
        if (!isAdminQuery.get(actor)) {
          db.exec('COMMIT');
          return { status: 'forbidden' };
        }
        if (!userLookupQuery.get(user)) {
          db.exec('COMMIT');
          return { status: 'user_not_found', telegramId: user };
        }
        const product = productForPurchase.get(productId);
        if (!product) {
          db.exec('COMMIT');
          return { status: 'unavailable', telegramId: user };
        }
        const existing = findUserProductPurchase.get(user, product.id);
        if (existing) {
          db.exec('COMMIT');
          return {
            status: existing.status === 'pending' ? 'redeliver' : 'already_owned',
            telegramId: user,
            productTitle: product.title,
            purchaseId: existing.id,
          };
        }
        const inserted = insertPurchase.run(user, product.id, product.title, 0, 'manual');
        db.exec('COMMIT');
        return {
          status: 'granted',
          telegramId: user,
          productTitle: product.title,
          purchaseId: Number(inserted.lastInsertRowid),
        };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
