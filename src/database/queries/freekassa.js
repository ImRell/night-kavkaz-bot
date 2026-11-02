export function prepareFreeKassaQueries(db) {
  const insertFreeKassaOrder = db.prepare(
    'INSERT INTO freekassa_orders (telegram_id, amount) VALUES (?, ?)',
  );
  const findFreeKassaOrder = db.prepare(
    'SELECT id, telegram_id AS telegramId, amount, status, operation_id AS operationId FROM freekassa_orders WHERE id = ?',
  );
  const markFreeKassaOrderPaid = db.prepare(`UPDATE freekassa_orders
      SET status = 'paid', operation_id = ?, paid_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ? AND status = 'pending'`);
  return { insertFreeKassaOrder, findFreeKassaOrder, markFreeKassaOrderPaid };
}
