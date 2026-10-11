export function prepareTopUpsQueries(db) {
  const pendingCardTopUpCount = db.prepare(`SELECT count(*) AS count FROM top_ups
      WHERE telegram_id = ? AND method = 'card' AND status = 'pending'`);
  const insertCardTopUp = db.prepare(`INSERT INTO top_ups
      (telegram_id, method, amount, status, receipt_file_id, receipt_kind) VALUES (?, 'card', ?, 'pending', ?, ?)`);
  const getTopUpQuery =
    db.prepare(`SELECT id, telegram_id AS telegramId, method, amount, stars, status,
      receipt_file_id AS receiptFileId, receipt_kind AS receiptKind, reviewed_by AS reviewedBy,
      reviewed_at AS reviewedAt, created_at AS createdAt FROM top_ups WHERE id = ?`);
  const reviewTopUpQuery = db.prepare(`UPDATE top_ups SET status = ?, reviewed_by = ?,
      reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND status = 'pending'`);
  const insertTopUpMessage =
    db.prepare(`INSERT INTO top_up_admin_messages (top_up_id, chat_id, message_id)
      VALUES (?, ?, ?) ON CONFLICT DO NOTHING`);
  const listTopUpMessagesQuery = db.prepare(`SELECT chat_id AS chatId, message_id AS messageId
      FROM top_up_admin_messages WHERE top_up_id = ?`);
  const findStarsCharge = db.prepare('SELECT id FROM top_ups WHERE telegram_charge_id = ?');
  const insertStarsTopUp = db.prepare(`INSERT INTO top_ups
      (telegram_id, method, amount, stars, status, telegram_charge_id) VALUES (?, 'stars', ?, ?, 'approved', ?)`);
  const pendingCardTopUpIdsOfUser = db.prepare(`SELECT id FROM top_ups
      WHERE telegram_id = ? AND method = 'card' AND status = 'pending' ORDER BY id`);
  const latestPendingCardTopUp = db.prepare(`SELECT id FROM top_ups
      WHERE telegram_id = ? AND method = 'card' AND status = 'pending' ORDER BY id LIMIT 1`);
  const pendingReceiptsCountQuery = db.prepare(`SELECT count(*) AS count FROM top_ups
      WHERE method = 'card' AND status = 'pending'`);
  const pagePendingReceiptsQuery = db.prepare(`SELECT top_ups.id, top_ups.telegram_id AS telegramId,
      top_ups.amount, top_ups.created_at AS createdAt, top_ups.receipt_kind AS receiptKind,
      users.username, users.first_name AS firstName, users.last_name AS lastName
      FROM top_ups LEFT JOIN users ON users.telegram_id = top_ups.telegram_id
      WHERE top_ups.method = 'card' AND top_ups.status = 'pending'
      ORDER BY top_ups.created_at, top_ups.id LIMIT ? OFFSET ?`);
  return {
    pendingCardTopUpCount,
    insertCardTopUp,
    getTopUpQuery,
    reviewTopUpQuery,
    insertTopUpMessage,
    listTopUpMessagesQuery,
    findStarsCharge,
    insertStarsTopUp,
    pendingCardTopUpIdsOfUser,
    latestPendingCardTopUp,
    pendingReceiptsCountQuery,
    pagePendingReceiptsQuery,
  };
}
