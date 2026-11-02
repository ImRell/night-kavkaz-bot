export function preparePurchasesQueries(db) {
  const listPurchases = db.prepare(`SELECT id, product_title AS productTitle, quantity,
      total, currency, purchased_at AS purchasedAt, invite_link AS inviteLink, status
      FROM purchases WHERE telegram_id = ? AND status IN ('completed', 'pending')
      ORDER BY purchased_at DESC, id DESC LIMIT ? OFFSET ?`);
  const findUserProductPurchase = db.prepare(`SELECT id, status, purchased_at AS purchasedAt
      FROM purchases WHERE telegram_id = ? AND product_id = ? ORDER BY id LIMIT 1`);
  const listUserProductIdsQuery = db.prepare(`SELECT DISTINCT product_id AS productId FROM purchases
      WHERE telegram_id = ? AND product_id IS NOT NULL`);
  const insertPurchase = db.prepare(`INSERT INTO purchases
      (telegram_id, product_id, product_title, quantity, total, currency, status, source)
      VALUES (?, ?, ?, 1, ?, 'RUB', 'pending', ?)`);
  const pendingPurchase = db.prepare(`SELECT purchases.id, purchases.telegram_id AS telegramId,
      purchases.product_id AS productId, purchases.product_title AS productTitle,
      purchases.total, purchases.currency, purchases.source, products.slug AS productSlug
      FROM purchases LEFT JOIN products ON products.id = purchases.product_id
      WHERE purchases.id = ? AND purchases.status = 'pending'`);
  const allPendingPurchases = db.prepare(
    "SELECT id FROM purchases WHERE status = 'pending' ORDER BY id",
  );
  const completePurchaseQuery =
    db.prepare(`UPDATE purchases SET status = 'completed', invite_link = ?
      WHERE id = ? AND status = 'pending'`);
  return {
    listPurchases,
    findUserProductPurchase,
    listUserProductIdsQuery,
    insertPurchase,
    pendingPurchase,
    allPendingPurchases,
    completePurchaseQuery,
  };
}
