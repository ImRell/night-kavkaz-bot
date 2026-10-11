export function prepareAdminsQueries(db) {
  const seedAdmin = db.prepare(`INSERT INTO admins (telegram_id, added_by) VALUES (?, NULL)
      ON CONFLICT(telegram_id) DO UPDATE SET added_by = NULL`);
  const isAdminQuery = db.prepare('SELECT 1 AS yes FROM admins WHERE telegram_id = ?');
  const isSystemAdminQuery = db.prepare(
    'SELECT 1 AS yes FROM admins WHERE telegram_id = ? AND added_by IS NULL',
  );
  const findAdminTargetById = db.prepare(
    'SELECT telegram_id AS telegramId, added_by AS addedBy FROM admins WHERE telegram_id = ?',
  );
  const findAdminTargetByUsername =
    db.prepare(`SELECT admins.telegram_id AS telegramId, admins.added_by AS addedBy
      FROM admins LEFT JOIN users ON users.telegram_id = admins.telegram_id
      WHERE users.username = ? COLLATE NOCASE LIMIT 1`);
  const deleteManagedAdmin = db.prepare(
    'DELETE FROM admins WHERE telegram_id = ? AND added_by IS NOT NULL',
  );
  const listAdminsQuery =
    db.prepare(`SELECT admins.telegram_id AS telegramId, admins.added_at AS addedAt,
      admins.added_by AS addedBy, users.username, users.first_name AS firstName, users.last_name AS lastName,
      users.registered_at AS registeredAt, users.balance,
      (SELECT count(*) FROM purchases WHERE purchases.telegram_id = admins.telegram_id AND purchases.status = 'completed') AS purchaseCount
      FROM admins LEFT JOIN users ON users.telegram_id = admins.telegram_id
      ORDER BY admins.added_at, admins.telegram_id`);
  const pageAdminsQuery =
    db.prepare(`SELECT admins.telegram_id AS telegramId, admins.added_at AS addedAt,
      admins.added_by AS addedBy, users.username, users.first_name AS firstName, users.last_name AS lastName,
      users.registered_at AS registeredAt, users.balance,
      (SELECT count(*) FROM purchases WHERE purchases.telegram_id = admins.telegram_id AND purchases.status = 'completed') AS purchaseCount
      FROM admins LEFT JOIN users ON users.telegram_id = admins.telegram_id
      ORDER BY admins.added_at, admins.telegram_id LIMIT ? OFFSET ?`);
  const insertAdmin = db.prepare(
    'INSERT INTO admins (telegram_id, added_by) VALUES (?, ?) ON CONFLICT DO NOTHING',
  );
  return {
    seedAdmin,
    isAdminQuery,
    isSystemAdminQuery,
    findAdminTargetById,
    findAdminTargetByUsername,
    deleteManagedAdmin,
    listAdminsQuery,
    pageAdminsQuery,
    insertAdmin,
  };
}
