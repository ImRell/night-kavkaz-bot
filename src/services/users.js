import { telegramId } from '../domain/telegram-id.js';
export function createUsersService(context) {
  const {
    getUser,
    accept,
    userCountQuery,
    userLookupQuery,
    userByUsernameQuery,
    allUserIdsQuery,
    ordinaryUserIdsQuery,
    pageUsersQuery,
    buyersCountQuery,
    pageBuyersQuery,
    updateProfileQuery,
  } = context.queries;
  function pageUsers(buyersOnly, page = 0, pageSize = 5) {
    if (
      !Number.isSafeInteger(page) ||
      page < 0 ||
      !Number.isSafeInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 10 ||
      !Number.isSafeInteger(page * pageSize)
    ) {
      throw new TypeError('Некорректная страница пользователей.');
    }
    const total = (buyersOnly ? buyersCountQuery : userCountQuery).get().count;
    const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);
    const safePage = Math.min(page, lastPage);
    const rows = (buyersOnly ? pageBuyersQuery : pageUsersQuery).all(
      pageSize + 1,
      safePage * pageSize,
    );
    return {
      items: rows.slice(0, pageSize),
      hasPrev: safePage > 0,
      hasNext: rows.length > pageSize,
      page: safePage,
      pageSize,
      total,
    };
  }
  return {
    get(id) {
      return getUser.get(telegramId(id));
    },
    registeredUserCount() {
      return userCountQuery.get().count;
    },
    findRegisteredUser(query) {
      const value = String(query ?? '').trim();
      if (/^[1-9]\d{0,19}$/.test(value)) return userLookupQuery.get(value);
      const username = value.replace(/^@/, '');
      if (!/^[A-Za-z0-9_]{1,32}$/.test(username)) return undefined;
      return userByUsernameQuery.get(username);
    },
    listRegisteredUserIds() {
      return allUserIdsQuery.all().map((row) => row.telegramId);
    },
    listOrdinaryUserIds() {
      return ordinaryUserIdsQuery.all().map((row) => row.telegramId);
    },
    listUsers(page = 0, pageSize = 5) {
      return pageUsers(false, page, pageSize);
    },
    listBuyers(page = 0, pageSize = 5) {
      return pageUsers(true, page, pageSize);
    },
    updateUserProfile(user) {
      const id = telegramId(user?.id);
      const clean = (value) =>
        typeof value === 'string' ? value.trim().slice(0, 256) || null : null;
      updateProfileQuery.run(
        id,
        clean(user.username),
        clean(user.first_name),
        clean(user.last_name),
      );
    },
    accept(id, rulesVersion = 1) {
      if (!Number.isSafeInteger(rulesVersion) || rulesVersion < 1)
        throw new TypeError('Некорректная версия правил.');
      accept.run(telegramId(id), new Date().toISOString(), rulesVersion);
      return getUser.get(telegramId(id));
    },
  };
}
