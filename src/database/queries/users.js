export function prepareUsersQueries(db) {
  const BUYER_CONDITION = `(users.balance > 0 OR EXISTS (
        SELECT 1 FROM purchases WHERE purchases.telegram_id = users.telegram_id AND purchases.status = 'completed'
      ))`;
  const getUser = db.prepare(`SELECT telegram_id AS telegramId, accepted_at AS acceptedAt,
      rules_version AS rulesVersion, balance,
      username, first_name AS firstName, last_name AS lastName, registered_at AS registeredAt,
      (SELECT count(*) FROM purchases WHERE purchases.telegram_id = users.telegram_id AND purchases.status = 'completed') AS purchaseCount,
      users.banned_at AS bannedAt
      FROM users WHERE telegram_id = ?`);
  const accept =
    db.prepare(`INSERT INTO users (telegram_id, accepted_at, rules_version, registered_at)
      VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ON CONFLICT (telegram_id) DO UPDATE SET
        accepted_at = CASE WHEN users.accepted_at IS NULL OR users.rules_version <> excluded.rules_version
          THEN excluded.accepted_at ELSE users.accepted_at END,
        rules_version = excluded.rules_version,
        registered_at = COALESCE(users.registered_at, excluded.registered_at)`);
  const adminCountQuery = db.prepare('SELECT count(*) AS count FROM admins');
  const userCountQuery = db.prepare('SELECT count(*) AS count FROM users');
  const userLookupQuery = db.prepare(`SELECT telegram_id AS telegramId, accepted_at AS acceptedAt,
      rules_version AS rulesVersion, balance,
      username, first_name AS firstName, last_name AS lastName, registered_at AS registeredAt,
      (SELECT count(*) FROM purchases WHERE purchases.telegram_id = users.telegram_id AND purchases.status = 'completed') AS purchaseCount,
      users.banned_at AS bannedAt
      FROM users WHERE telegram_id = ?`);
  const userByUsernameQuery =
    db.prepare(`SELECT telegram_id AS telegramId, accepted_at AS acceptedAt,
      rules_version AS rulesVersion, balance, username, first_name AS firstName,
      last_name AS lastName, registered_at AS registeredAt,
      (SELECT count(*) FROM purchases WHERE purchases.telegram_id = users.telegram_id AND purchases.status = 'completed') AS purchaseCount,
      users.banned_at AS bannedAt
      FROM users WHERE username = ? COLLATE NOCASE LIMIT 1`);
  const allUserIdsQuery = db.prepare(
    'SELECT telegram_id AS telegramId FROM users ORDER BY telegram_id',
  );
  const ordinaryUserIdsQuery = db.prepare(`SELECT users.telegram_id AS telegramId FROM users
      WHERE NOT EXISTS (SELECT 1 FROM admins WHERE admins.telegram_id = users.telegram_id)
        AND users.banned_at IS NULL
      ORDER BY users.telegram_id`);
  const pageUsersQuery = db.prepare(`SELECT telegram_id AS telegramId, username,
      first_name AS firstName, last_name AS lastName, balance,
      registered_at AS registeredAt,
      (SELECT count(*) FROM purchases WHERE purchases.telegram_id = users.telegram_id AND purchases.status = 'completed') AS purchaseCount,
      users.banned_at AS bannedAt
      FROM users ORDER BY registered_at, telegram_id LIMIT ? OFFSET ?`);
  const buyersCountQuery = db.prepare(
    `SELECT count(*) AS count FROM users WHERE ${BUYER_CONDITION}`,
  );
  const pageBuyersQuery = db.prepare(`SELECT telegram_id AS telegramId, username,
      first_name AS firstName, last_name AS lastName, balance,
      registered_at AS registeredAt,
      (SELECT count(*) FROM purchases WHERE purchases.telegram_id = users.telegram_id AND purchases.status = 'completed') AS purchaseCount,
      users.banned_at AS bannedAt
      FROM users WHERE ${BUYER_CONDITION}
      ORDER BY registered_at, telegram_id LIMIT ? OFFSET ?`);
  const updateProfileQuery = db.prepare(`INSERT INTO users
      (telegram_id, username, first_name, last_name, registered_at)
      VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ON CONFLICT (telegram_id) DO UPDATE SET
        username = excluded.username, first_name = excluded.first_name, last_name = excluded.last_name`);
  const isBannedQuery = db.prepare(
    'SELECT 1 AS yes FROM users WHERE telegram_id = ? AND banned_at IS NOT NULL',
  );
  const banUserQuery =
    db.prepare(`UPDATE users SET banned_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), banned_by = ?
      WHERE telegram_id = ? AND banned_at IS NULL`);
  const unbanUserQuery = db.prepare(`UPDATE users SET banned_at = NULL, banned_by = NULL
      WHERE telegram_id = ? AND banned_at IS NOT NULL`);
  return {
    getUser,
    accept,
    adminCountQuery,
    userCountQuery,
    userLookupQuery,
    userByUsernameQuery,
    allUserIdsQuery,
    ordinaryUserIdsQuery,
    pageUsersQuery,
    buyersCountQuery,
    pageBuyersQuery,
    updateProfileQuery,
    isBannedQuery,
    banUserQuery,
    unbanUserQuery,
  };
}
