export function prepareOrdersQueries(db) {
  const findOpenOrder = db.prepare(`SELECT id FROM orders
      WHERE telegram_id = ? AND product_id = ? AND method = ? AND amount = ? AND status = 'pending'
      ORDER BY id DESC LIMIT 1`);
  const insertOrder = db.prepare(`INSERT INTO orders
      (telegram_id, product_id, product_title, amount, method, stars) VALUES (?, ?, ?, ?, ?, ?)`);
  const getOrderQuery = db.prepare(`SELECT id, telegram_id AS telegramId, product_id AS productId,
      product_title AS productTitle, amount, method, stars, crypto_amount AS cryptoAmount,
      crypto_currency AS cryptoCurrency, external_id AS externalId, pay_url AS payUrl, status,
      payment_id AS paymentId, purchase_id AS purchaseId FROM orders WHERE id = ?`);
  const attachInvoiceQuery = db.prepare(`UPDATE orders
      SET crypto_amount = ?, crypto_currency = ?, external_id = ?, pay_url = ?
      WHERE id = ? AND status = 'pending' AND external_id IS NULL`);
  const markOrderQuery = db.prepare(`UPDATE orders SET status = ?, payment_id = ?, purchase_id = ?,
      paid_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND status = 'pending'`);
  return { findOpenOrder, insertOrder, getOrderQuery, attachInvoiceQuery, markOrderQuery };
}
