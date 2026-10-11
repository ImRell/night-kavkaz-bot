export function preparePurchasesQueries(db) {
  const listPurchases = db.prepare(`SELECT id, product_title AS productTitle, quantity,
      total, currency, purchased_at AS purchasedAt, invite_link AS inviteLink
      FROM purchases WHERE telegram_id = ? AND status = 'completed' ORDER BY purchased_at DESC, id DESC LIMIT ? OFFSET ?`);
  const findPurchaseByCallback = db.prepare(`SELECT id, total, currency
      FROM purchases WHERE purchase_callback_id = ?`);
  const findUserProductPurchase = db.prepare(`SELECT id, purchased_at AS purchasedAt
      FROM purchases WHERE telegram_id = ? AND product_id = ? ORDER BY id LIMIT 1`);
  const listUserProductIdsQuery = db.prepare(`SELECT DISTINCT product_id AS productId FROM purchases
      WHERE telegram_id = ? AND product_id IS NOT NULL`);
  const insertPurchase = db.prepare(`INSERT INTO purchases
      (telegram_id, product_id, product_title, quantity, total, currency, purchase_callback_id, status)
      VALUES (?, ?, ?, 1, ?, ?, ?, 'pending')`);
  const pendingPurchase = db.prepare(`SELECT id, telegram_id AS telegramId, total
      FROM purchases WHERE id = ? AND status = 'pending'`);
  const allPendingPurchases = db.prepare(
    "SELECT id FROM purchases WHERE status = 'pending' ORDER BY id",
  );
  const completePurchaseQuery =
    db.prepare(`UPDATE purchases SET status = 'completed', invite_link = ?
      WHERE id = ? AND status = 'pending'`);
  const deletePurchase = db.prepare("DELETE FROM purchases WHERE id = ? AND status = 'pending'");
  return {
    listPurchases,
    findPurchaseByCallback,
    findUserProductPurchase,
    listUserProductIdsQuery,
    insertPurchase,
    pendingPurchase,
    allPendingPurchases,
    completePurchaseQuery,
    deletePurchase,
  };
}
