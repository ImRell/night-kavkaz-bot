import { telegramId } from '../domain/telegram-id.js';
export function createAdminsService(context) {
  const { db, systemAdminIds } = context;
  const {
    isAdminQuery,
    isSystemAdminQuery,
    findAdminTargetById,
    findAdminTargetByUsername,
    deleteManagedAdmin,
    listAdminsQuery,
    adminCountQuery,
    pageAdminsQuery,
    insertAdmin,
    userLookupQuery,
    userByUsernameQuery,
  } = context.queries;
  return {
    isAdmin(id) {
      return Boolean(isAdminQuery.get(telegramId(id)));
    },
    isSystemAdmin(id) {
      const adminId = telegramId(id);
      return systemAdminIds.has(adminId) && Boolean(isSystemAdminQuery.get(adminId));
    },
    listAdmins() {
      return listAdminsQuery.all();
    },
    listAdminPage(page = 0, pageSize = 5) {
      if (
        !Number.isSafeInteger(page) ||
        page < 0 ||
        !Number.isSafeInteger(pageSize) ||
        pageSize < 1 ||
        pageSize > 10
      ) {
        throw new TypeError('Некорректная страница администраторов.');
      }
      const total = adminCountQuery.get().count;
      const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);
      const safePage = Math.min(page, lastPage);
      const rows = pageAdminsQuery.all(pageSize + 1, safePage * pageSize);
      return {
        items: rows.slice(0, pageSize),
        hasPrev: safePage > 0,
        hasNext: rows.length > pageSize,
        page: safePage,
        pageSize,
        total,
      };
    },
    addAdmin(userQuery, addedBy) {
      const query = String(userQuery ?? '').trim();
      const targetId = /^[1-9]\d{0,19}$/.test(query) ? query : null;
      const username = query.replace(/^@/, '');
      const validUsername = !targetId && /^[A-Za-z0-9_]{1,32}$/.test(username);
      if (!targetId && !validUsername)
        throw new TypeError('Некорректный Telegram ID или username.');
      const actor = telegramId(addedBy);
      db.exec('BEGIN IMMEDIATE');
      try {
        if (!systemAdminIds.has(actor) || !isSystemAdminQuery.get(actor)) {
          db.exec('COMMIT');
          return { status: 'forbidden' };
        }
        const registered = targetId
          ? userLookupQuery.get(targetId)
          : userByUsernameQuery.get(username);
        if (!registered) {
          db.exec('COMMIT');
          return { status: 'not_found', query };
        }
        const target = registered.telegramId;
        const result = insertAdmin.run(target, actor);
        db.exec('COMMIT');
        return {
          status: result.changes ? 'added' : 'already_admin',
          telegramId: target,
          user: registered,
        };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    removeAdmin(userQuery, removedBy) {
      const query = String(userQuery ?? '').trim();
      const targetId = /^[1-9]\d{0,19}$/.test(query) ? query : null;
      const username = query.replace(/^@/, '');
      const validUsername = !targetId && /^[A-Za-z0-9_]{1,32}$/.test(username);
      if (!targetId && !validUsername)
        throw new TypeError('Некорректный Telegram ID или username.');
      const actor = telegramId(removedBy);
      db.exec('BEGIN IMMEDIATE');
      try {
        if (!systemAdminIds.has(actor) || !isSystemAdminQuery.get(actor)) {
          db.exec('COMMIT');
          return { status: 'forbidden' };
        }
        const target = targetId
          ? findAdminTargetById.get(targetId)
          : findAdminTargetByUsername.get(username);
        if (!target) {
          db.exec('COMMIT');
          return { status: 'not_admin', query };
        }
        if (target.addedBy == null) {
          db.exec('COMMIT');
          return { status: 'system_admin', telegramId: target.telegramId };
        }
        const result = deleteManagedAdmin.run(target.telegramId);
        db.exec('COMMIT');
        return { status: result.changes ? 'removed' : 'not_admin', telegramId: target.telegramId };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
