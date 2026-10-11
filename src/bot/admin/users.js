import { answerCallback } from '../transport.js';
import { adminAdminsScreen, adminUsersScreen } from '../../ui/admin/screens.js';
export function createDirectoryTools(context) {
  const { store, transport, inputs, admin, deny } = context;
  async function showAdmins(ctx, page = 0) {
    ctx.state ??= {};
    ctx.state.adminListRouteHandled = true;
    if (!admin(ctx)) return deny(ctx);
    inputs.delete(String(ctx.from.id));
    await answerCallback(ctx);
    await transport.show(
      ctx,
      adminAdminsScreen(store.listAdminPage(page, 5), store.isSystemAdmin(ctx.from.id)),
    );
  }
  async function showUsers(ctx, page = 0, buyersOnly = false) {
    if (!admin(ctx)) return deny(ctx);
    inputs.delete(String(ctx.from.id));
    await answerCallback(ctx);
    const data = buyersOnly ? store.listBuyers(page, 5) : store.listUsers(page, 5);
    await transport.show(ctx, adminUsersScreen(data, buyersOnly));
  }
  return { showAdmins, showUsers };
}
export function registerUsersHandlers(bot, context) {
  const { store, transport, inputs, admin, deny, startInput, showAdmins, showUsers, USERS_CANCEL } =
    context;
  bot.action(/^admin_add:(\d{1,6})$/, async (ctx) => {
    if (!admin(ctx)) return deny(ctx);
    if (!store.isSystemAdmin(ctx.from.id))
      return answerCallback(
        ctx,
        'Добавлять администраторов могут только владельцы, указанные в ADMIN_IDS.',
        { show_alert: true },
      );
    await startInput(
      ctx,
      'add_admin',
      'Добавить администратора',
      'Отправьте Telegram ID или username (с @ или без него). Добавить можно только зарегистрированного пользователя.',
      { returnPage: Number(ctx.match[1]) },
    );
  });
  bot.action(/^admin_remove:(\d{1,6})$/, async (ctx) => {
    if (!admin(ctx)) return deny(ctx);
    if (!store.isSystemAdmin(ctx.from.id))
      return answerCallback(
        ctx,
        'Удалять администраторов могут только владельцы, указанные в ADMIN_IDS.',
        { show_alert: true },
      );
    await startInput(
      ctx,
      'remove_admin',
      'Удалить администратора',
      'Отправьте Telegram ID или username администратора, которого нужно удалить. Владельцев из ADMIN_IDS удалить нельзя.',
      { returnPage: Number(ctx.match[1]) },
    );
  });
  bot.action('admin_add', async (ctx) => {
    if (!admin(ctx)) return deny(ctx);
    if (!store.isSystemAdmin(ctx.from.id))
      return answerCallback(
        ctx,
        'Добавлять администраторов могут только владельцы, указанные в ADMIN_IDS.',
        { show_alert: true },
      );
    await startInput(
      ctx,
      'add_admin',
      'Добавить администратора',
      'Отправьте Telegram ID или username (с @ или без него). Добавить можно только зарегистрированного пользователя.',
      { returnPage: 0 },
    );
  });
  bot.action(/^admin_admins_goto:(\d{1,6})$/, async (ctx) => {
    if (!admin(ctx)) return deny(ctx);
    await startInput(
      ctx,
      'page_admins',
      'Перейти к странице администраторов',
      'Отправьте номер страницы, начиная с 1.',
      { returnPage: Number(ctx.match[1]) },
    );
  });
  bot.action('admin_list', (ctx) => showAdmins(ctx));
  bot.action('admin_admins', (ctx) => showAdmins(ctx));
  bot.action('admins', (ctx) => showAdmins(ctx));
  bot.action(/^admin_admins:(\d{1,6})$/, (ctx) => showAdmins(ctx, Number(ctx.match[1])));
  bot.action(/^admin_admins_refresh:(\d{1,6})$/, async (ctx) => {
    if (!admin(ctx)) return deny(ctx);
    inputs.delete(String(ctx.from.id));
    await answerCallback(ctx, 'Данные обновлены.');
    await transport.show(
      ctx,
      adminAdminsScreen(
        store.listAdminPage(Number(ctx.match[1]), 5),
        store.isSystemAdmin(ctx.from.id),
      ),
    );
  });
  bot.action(/^admin_users_goto:(\d{1,6}):(0|1)$/, async (ctx) => {
    if (!admin(ctx)) return deny(ctx);
    const buyersOnly = ctx.match[2] === '1';
    await startInput(
      ctx,
      buyersOnly ? 'page_buyers' : 'page_users',
      buyersOnly ? 'Перейти к странице покупателей' : 'Перейти к странице пользователей',
      'Отправьте номер страницы, начиная с 1.',
      { returnPage: Number(ctx.match[1]), buyersOnly },
    );
  });
  bot.action(/^admin_users_goto:(\d{1,6})$/, async (ctx) => {
    if (!admin(ctx)) return deny(ctx);
    await startInput(
      ctx,
      'page_users',
      'Перейти к странице пользователей',
      'Отправьте номер страницы, начиная с 1.',
      { returnPage: Number(ctx.match[1]), buyersOnly: false },
    );
  });
  bot.action('admin_users', (ctx) => showUsers(ctx));
  bot.action('admin_buyers', (ctx) => showUsers(ctx, 0, true));
  bot.action('admin_user_count', (ctx) => showUsers(ctx));
  bot.action(/^admin_users:(\d{1,6})$/, (ctx) => showUsers(ctx, Number(ctx.match[1])));
  bot.action(/^admin_buyers:(\d{1,6})$/, (ctx) => showUsers(ctx, Number(ctx.match[1]), true));
  bot.action(/^admin_users_refresh:(\d{1,6})$/, async (ctx) => {
    if (!admin(ctx)) return deny(ctx);
    inputs.delete(String(ctx.from.id));
    await answerCallback(ctx, 'Данные обновлены.');
    await transport.show(ctx, adminUsersScreen(store.listUsers(Number(ctx.match[1]), 5), false));
  });
  bot.action(/^admin_buyers_refresh:(\d{1,6})$/, async (ctx) => {
    if (!admin(ctx)) return deny(ctx);
    inputs.delete(String(ctx.from.id));
    await answerCallback(ctx, 'Данные обновлены.');
    await transport.show(ctx, adminUsersScreen(store.listBuyers(Number(ctx.match[1]), 5), true));
  });
  bot.action(USERS_CANCEL, (ctx) => showUsers(ctx));
  bot.action('admin_lookup', async (ctx) => {
    if (!admin(ctx)) return deny(ctx);
    await startInput(
      ctx,
      'lookup',
      'Проверить пользователя',
      'Отправьте Telegram ID или username (с @ или без него).',
      { cancelData: USERS_CANCEL },
    );
  });
  bot.action('admin_credit', async (ctx) => {
    if (!admin(ctx)) return deny(ctx);
    await startInput(
      ctx,
      'credit',
      'Выдать баланс',
      'Отправьте Telegram ID или username и сумму в рублях через пробел, например: @username 500 или 123456789 500. Начисление доступно только зарегистрированным пользователям.',
      { cancelData: USERS_CANCEL },
    );
  });
  bot.action('admin_ban', async (ctx) => {
    if (!admin(ctx)) return deny(ctx);
    await startInput(
      ctx,
      'ban',
      'Забанить пользователя',
      'Отправьте Telegram ID или username (с @ или без него). Пользователь потеряет доступ к боту, а его чеки на проверке будут отклонены. Заблокировать можно только зарегистрированного пользователя.',
      { cancelData: USERS_CANCEL },
    );
  });
  bot.action('admin_unban', async (ctx) => {
    if (!admin(ctx)) return deny(ctx);
    await startInput(
      ctx,
      'unban',
      'Разбанить пользователя',
      'Отправьте Telegram ID или username (с @ или без него) заблокированного пользователя.',
      { cancelData: USERS_CANCEL },
    );
  });
}
