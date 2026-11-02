import { answerCallback } from '../transport.js';
import {
  adminAdminsScreen,
  adminUsersScreen,
  adminGrantResultScreen,
  adminCleanupConfirmScreen,
  adminCleanupProgressScreen,
  adminCleanupResultScreen,
} from '../../ui/admin/screens.js';
import { createUserCleanup } from './cleanup.js';
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
  const {
    store,
    transport,
    logger,
    inputs,
    admin,
    deny,
    startInput,
    showAdmins,
    showUsers,
    delivery,
    USERS_CANCEL,
  } = context;
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
  const cleanup = createUserCleanup({ store, logger });
  bot.action('admin_users_cleanup', async (ctx) => {
    if (!admin(ctx)) return deny(ctx);
    inputs.delete(String(ctx.from.id));
    await answerCallback(ctx);
    await transport.show(ctx, adminCleanupConfirmScreen(store.listCleanupCandidateIds().length));
  });
  bot.action('admin_users_cleanup_run', async (ctx) => {
    if (!admin(ctx)) return deny(ctx);
    if (cleanup.isRunning())
      return answerCallback(ctx, 'Очистка уже идёт, дождитесь итога.', { show_alert: true });
    await answerCallback(ctx);
    const count = store.listCleanupCandidateIds().length;
    const logFailure = (error) =>
      logger.error('Ошибка очистки пользователей.', { code: error.code ?? error.name });
    const finished = cleanup.run(ctx.telegram).catch(logFailure);
    await transport.show(ctx, adminCleanupProgressScreen(count));
    // Not awaited: a long check must not hold this update past Telegraf's handler timeout.
    // Chained after the progress screen so a quick result is never overwritten by it.
    finished
      .then((result) => result && transport.show(ctx, adminCleanupResultScreen(result)))
      .catch(logFailure);
  });
  bot.action(['admin_grant', 'admin_credit'], async (ctx) => {
    if (!admin(ctx)) return deny(ctx);
    await startInput(
      ctx,
      'grant',
      'Выдать товар',
      'Отправьте Telegram ID или username (с @ или без него). Выдать товар можно только зарегистрированному пользователю.',
      { cancelData: USERS_CANCEL },
    );
  });
  bot.action(/^admin_grant:([1-9]\d{0,19}):(\d{1,15})$/, async (ctx) => {
    if (!admin(ctx)) return deny(ctx);
    inputs.delete(String(ctx.from.id));
    const result = store.grantProduct(ctx.from.id, ctx.match[1], Number(ctx.match[2]));
    const canDeliver = result.status === 'granted' || result.status === 'redeliver';
    await answerCallback(ctx, canDeliver ? 'Выдаю товар…' : undefined);
    const outcome = canDeliver ? await delivery.deliver(result.purchaseId) : null;
    if (canDeliver)
      logger.info('Администратор выдал товар.', {
        adminId: ctx.from.id,
        userId: result.telegramId,
        purchaseId: result.purchaseId,
        status: outcome.status,
      });
    await transport.show(ctx, adminGrantResultScreen({ ...result, delivery: outcome }));
  });
  bot.action('admin_ban', async (ctx) => {
    if (!admin(ctx)) return deny(ctx);
    await startInput(
      ctx,
      'ban',
      'Забанить пользователя',
      'Отправьте Telegram ID или username (с @ или без него). Пользователь потеряет доступ к боту. Заблокировать можно только зарегистрированного пользователя.',
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
