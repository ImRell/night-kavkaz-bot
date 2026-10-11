import { telegramId } from '../domain/telegram-id.js';
export function createModerationService(context) {
  const { db } = context;
  const {
    getTopUpQuery,
    reviewTopUpQuery,
    isAdminQuery,
    userLookupQuery,
    userByUsernameQuery,
    isBannedQuery,
    banUserQuery,
    unbanUserQuery,
    pendingCardTopUpIdsOfUser,
  } = context.queries;
  return {
    isBanned(id) {
      return Boolean(isBannedQuery.get(telegramId(id)));
    },
    banUser(adminId, userQuery) {
      const actor = telegramId(adminId);
      const query = String(userQuery ?? '').trim();
      const idQuery = /^[1-9]\d{0,19}$/.test(query) ? query : null;
      const username = query.replace(/^@/, '');
      if (!idQuery && !/^[A-Za-z0-9_]{1,32}$/.test(username))
        throw new TypeError('Некорректный Telegram ID или username.');
      db.exec('BEGIN IMMEDIATE');
      try {
        if (!isAdminQuery.get(actor)) {
          db.exec('COMMIT');
          return { status: 'forbidden' };
        }
        const registered = idQuery
          ? userLookupQuery.get(idQuery)
          : userByUsernameQuery.get(username);
        if (!registered) {
          db.exec('COMMIT');
          return { status: 'not_found', query };
        }
        const target = registered.telegramId;
        if (target === actor) {
          db.exec('COMMIT');
          return { status: 'self', telegramId: target, user: registered };
        }
        if (isAdminQuery.get(target)) {
          db.exec('COMMIT');
          return { status: 'is_admin', telegramId: target, user: registered };
        }
        if (registered.bannedAt) {
          db.exec('COMMIT');
          return { status: 'already_banned', telegramId: target, user: registered };
        }
        banUserQuery.run(actor, target);
        const rejectedIds = pendingCardTopUpIdsOfUser.all(target).map((row) => row.id);
        for (const topUpId of rejectedIds) reviewTopUpQuery.run('rejected', actor, topUpId);
        db.exec('COMMIT');
        return {
          status: 'banned',
          telegramId: target,
          user: registered,
          rejectedTopUps: rejectedIds.map((topUpId) => getTopUpQuery.get(topUpId)),
        };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    unbanUser(adminId, userQuery) {
      const actor = telegramId(adminId);
      const query = String(userQuery ?? '').trim();
      const idQuery = /^[1-9]\d{0,19}$/.test(query) ? query : null;
      const username = query.replace(/^@/, '');
      if (!idQuery && !/^[A-Za-z0-9_]{1,32}$/.test(username))
        throw new TypeError('Некорректный Telegram ID или username.');
      db.exec('BEGIN IMMEDIATE');
      try {
        if (!isAdminQuery.get(actor)) {
          db.exec('COMMIT');
          return { status: 'forbidden' };
        }
        const registered = idQuery
          ? userLookupQuery.get(idQuery)
          : userByUsernameQuery.get(username);
        if (!registered) {
          db.exec('COMMIT');
          return { status: 'not_found', query };
        }
        const result = unbanUserQuery.run(registered.telegramId);
        db.exec('COMMIT');
        return {
          status: result.changes ? 'unbanned' : 'not_banned',
          telegramId: registered.telegramId,
          user: registered,
        };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
