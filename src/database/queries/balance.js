export function prepareBalanceQueries(db) {
  const insertCreditAudit = db.prepare(`INSERT INTO admin_balance_transactions
      (telegram_id, admin_id, amount, balance_after) VALUES (?, ?, ?, ?)`);
  const balanceForPurchase = db.prepare('SELECT balance FROM users WHERE telegram_id = ?');
  const debitBalance = db.prepare(`UPDATE users SET balance = balance - ?
      WHERE telegram_id = ? AND balance >= ?`);
  const refundBalance = db.prepare('UPDATE users SET balance = balance + ? WHERE telegram_id = ?');
  const updateBalanceQuery = db.prepare(`UPDATE users SET balance = balance + ?
      WHERE telegram_id = ? AND balance <= ?`);
  const balanceAfterQuery = db.prepare('SELECT balance FROM users WHERE telegram_id = ?');
  return {
    balanceForPurchase,
    debitBalance,
    refundBalance,
    updateBalanceQuery,
    balanceAfterQuery,
    insertCreditAudit,
  };
}
