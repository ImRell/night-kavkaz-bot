import { answerCallback } from './transport.js';
import { randomBytes } from 'node:crypto';
import { broadcastStatusScreen, broadcastJobsScreen } from '../ui/admin/broadcasts.js';
import { discountBroadcastOfferScreen, discountNotificationScreen, discountBroadcastPreviewScreen } from '../ui/admin/discount-notifications.js';
import { adminDiscountsScreen, adminDiscountScreen } from '../ui/admin/discounts.js';
import { parseMoscowEnd } from '../discounts.js';
import {
  adminMenuScreen, adminPromptScreen, adminAdminsScreen, adminCountScreen,
  adminLookupScreen, adminCreditResultScreen, adminBroadcastPreviewScreen,
  adminUsersScreen, adminActionResultScreen,
  adminBanResultScreen, adminReceiptsScreen, topUpAdminCaption, topUpAdminKeyboard,
} from '../ui/admin/screens.js';
import { bannedScreen } from '../ui/screens.js';
import { renderScreen } from '../ui/emoji.js';
import { emoji } from '../ui/emoji.js';

const INPUT_TTL_MS = 10 * 60 * 1000;
const MAX_BROADCAST_LENGTH = 3500;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const validId = value => /^[1-9]\d{0,19}$/.test(value);
const validUserQuery = value => validId(value) || /^@?[A-Za-z0-9_]{1,32}$/.test(value);
// Ввод из вкладки «Пользователи»: отмена возвращает в неё, а не в главное меню панели.
const USER_TOOL_INPUTS = new Set(['lookup', 'credit', 'ban', 'unban']);
const USERS_CANCEL = 'admin_users_cancel';

export function registerAdminHandlers(bot, { store, transport, broadcastQueue, clock = Date.now, logger = console }) {
  const inputs = new Map();
  const drafts = new Map();
  const discountOffers = new Map();
  const admin = ctx => Boolean(ctx.from && ctx.chat?.type === 'private' && store.isAdmin(ctx.from.id));

  async function deny(ctx) {
    await answerCallback(ctx, 'Доступ только для администраторов.', { show_alert: true });
  }
  async function showMenu(ctx) {
    await transport.show(ctx, adminMenuScreen(store.isMaintenanceMode(), store.pendingReceiptCount()));
  }
  async function removeIncomingMessage(ctx) {
    try { await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id); }
    catch { /* Telegram may deny deletion; still deliver the result. */ }
  }
  async function replacePrompt(ctx, state, screen) {
    await removeIncomingMessage(ctx);
    if (state.prompt?.chatId && state.prompt?.messageId && ctx.telegram?.editMessageText) {
      const rendered = renderScreen(screen);
      try {
        await ctx.telegram.editMessageText(state.prompt.chatId, state.prompt.messageId, undefined,
          rendered.text, rendered.extra);
        return;
      } catch (error) {
        if (error.response?.error_code === 400 && /message is not modified/i.test(error.response.description ?? '')) return;
        if (error.response?.error_code === 400 && /custom[_ ]emoji|PREMIUM_ACCOUNT_REQUIRED/i.test(error.response.description ?? '')) {
          try {
            const plain = renderScreen(screen, false);
            await ctx.telegram.editMessageText(state.prompt.chatId, state.prompt.messageId, undefined,
              plain.text, plain.extra);
            return;
          } catch (fallbackError) {
            if (fallbackError.response?.error_code === 400 && /message is not modified/i.test(fallbackError.response.description ?? '')) return;
          }
        }
      }
    }
    await transport.reply(ctx, screen);
  }
  async function startInput(ctx, type, title, instructions, extraState = {}) {
    const message = ctx.callbackQuery?.message;
    const prompt = message ? { chatId: message.chat.id, messageId: message.message_id } : null;
    const state = { type, createdAt: clock(), prompt, ...extraState };
    inputs.set(String(ctx.from.id), state);
    await answerCallback(ctx);
    await transport.show(ctx, adminPromptScreen(title, instructions, state.cancelData));
  }
  async function showInputResult(ctx, state, screen) {
    await replacePrompt(ctx, state, screen);
  }

  bot.action('admin_menu', async ctx => {
    if (!admin(ctx)) return deny(ctx);
    inputs.delete(String(ctx.from.id));
    await answerCallback(ctx);
    await showMenu(ctx);
  });
  bot.action('admin_maintenance_toggle', async ctx => {
    if (!admin(ctx)) return deny(ctx);
    inputs.delete(String(ctx.from.id));
    drafts.delete(String(ctx.from.id));
    const enabled = store.setMaintenanceMode(!store.isMaintenanceMode());
    await answerCallback(ctx, enabled ? 'Технические работы включены.' : 'Технические работы выключены.');
    await showMenu(ctx);
  });
  bot.action('admin_cancel', async ctx => {
    if (!admin(ctx)) return deny(ctx);
    inputs.delete(String(ctx.from.id));
    await answerCallback(ctx);
    await showMenu(ctx);
  });
  // ---------- Временные процентные скидки ----------
  const discountTarget = value => value === 'all' ? null : Number(value);
  async function showDiscounts(ctx, page = 0) {
    if (!admin(ctx)) return deny(ctx);
    inputs.delete(String(ctx.from.id));
    await answerCallback(ctx);
    await transport.show(ctx, adminDiscountsScreen(store, page));
  }
  bot.action('admin_discounts', ctx => showDiscounts(ctx));
  bot.action(/^admin_discounts:(\d{1,6})$/, ctx => showDiscounts(ctx, Number(ctx.match[1])));
  bot.action(/^admin_discount:(all|[1-9]\d{0,14})$/, async ctx => {
    if (!admin(ctx)) return deny(ctx);
    inputs.delete(String(ctx.from.id));
    await answerCallback(ctx);
    await transport.show(ctx, adminDiscountScreen(store, discountTarget(ctx.match[1])));
  });
  bot.action(/^admin_discount_set:(all|[1-9]\d{0,14})$/, async ctx => {
    if (!admin(ctx)) return deny(ctx);
    const productId = discountTarget(ctx.match[1]);
    if (productId !== null && !store.getProduct(productId)) {
      return answerCallback(ctx, 'Товар недоступен.', { show_alert: true });
    }
    discountOffers.delete(String(ctx.from.id));
    if (drafts.get(String(ctx.from.id))?.discountNotice) drafts.delete(String(ctx.from.id));
    await startInput(ctx, 'discount_percent', 'Процент скидки',
      'Введите целый процент от 1 до 100. Следующим шагом укажите окончание скидки по Москве. До завершения обоих шагов текущая скидка не изменится.',
      { productId, cancelData: `admin_discount:${ctx.match[1]}` });
  });
  bot.action(/^admin_discount_off:(all|[1-9]\d{0,14})$/, async ctx => {
    if (!admin(ctx)) return deny(ctx);
    inputs.delete(String(ctx.from.id));
    const productId = discountTarget(ctx.match[1]);
    const changed = store.disableDiscount(ctx.from.id, productId);
    await answerCallback(ctx, changed ? 'Скидка отключена.' : 'Скидка уже отключена.');
    await transport.show(ctx, adminDiscountScreen(store, productId));
  });

  function validDiscountNotice(notice) {
    const current = store.getDiscount(notice.productId);
    return Boolean(current?.active && current.percent === notice.percent && current.endsAt === notice.endsAt &&
      current.updatedAt === notice.updatedAt && current.updatedBy === notice.updatedBy &&
      (notice.productId === null || store.getProduct(notice.productId)));
  }
  async function unavailableNotice(ctx, productId) {
    await answerCallback(ctx, 'Предложение устарело или скидка изменена/отключена. Рассылка не отправлена.', { show_alert: true });
    await transport.show(ctx, adminDiscountScreen(store, productId));
  }
  bot.action(/^admin_discount_notify:(yes|no):([a-f0-9]{12})$/, async ctx => {
    if (!admin(ctx)) return deny(ctx);
    const actor = String(ctx.from.id);
    const offer = discountOffers.get(actor);
    if (!offer || offer.token !== ctx.match[2]) {
      return answerCallback(ctx, 'Это предложение уже закрыто или устарело.', { show_alert: true });
    }
    discountOffers.delete(actor); // Одно предложение нельзя подтвердить повторно.
    if (ctx.match[1] === 'no') {
      await answerCallback(ctx, 'Скидка сохранена без рассылки.');
      await transport.show(ctx, adminDiscountScreen(store, offer.productId));
      return;
    }
    if (offer.createdAt + INPUT_TTL_MS < clock() || !validDiscountNotice(offer)) {
      return unavailableNotice(ctx, offer.productId);
    }
    const notification = discountNotificationScreen(store, offer.productId, offer);
    const rendered = renderScreen(notification, false);
    const recipients = store.listOrdinaryUserIds();
    drafts.set(actor, {
      text: rendered.text, notification, recipients, createdAt: clock(),
      discountNotice: offer, token: offer.token
    });
    await answerCallback(ctx);
    await transport.show(ctx, discountBroadcastPreviewScreen(notification, recipients.length, offer.token));
  });
  bot.action(/^admin_discount_notify_cancel:([a-f0-9]{12})$/, async ctx => {
    if (!admin(ctx)) return deny(ctx);
    const actor = String(ctx.from.id);
    const draft = drafts.get(actor);
    if (!draft?.discountNotice || draft.token !== ctx.match[1]) {
      return answerCallback(ctx, 'Этот предпросмотр уже закрыт или устарел.', { show_alert: true });
    }
    drafts.delete(actor);
    await answerCallback(ctx, 'Рассылка отменена. Скидка сохранена.');
    await transport.show(ctx, adminDiscountScreen(store, draft.discountNotice.productId));
  });
  bot.action(/^admin_discount_send:([a-f0-9]{12})$/, ctx => confirmBroadcast(ctx, ctx.match[1]));

  bot.action('admin_broadcast', async ctx => {
    if (!admin(ctx)) return deny(ctx);
    drafts.delete(String(ctx.from.id));
    discountOffers.delete(String(ctx.from.id));
    await startInput(ctx, 'broadcast', 'Новая рассылка',
      'Отправьте текст для зарегистрированных пользователей. Максимум 3500 символов. Перед отправкой будет предпросмотр.');
  });
  bot.action(/^admin_add:(\d{1,6})$/, async ctx => {
    if (!admin(ctx)) return deny(ctx);
    if (!store.isSystemAdmin(ctx.from.id)) return answerCallback(ctx, 'Добавлять администраторов могут только владельцы, указанные в ADMIN_IDS.', { show_alert: true });
    await startInput(ctx, 'add_admin', 'Добавить администратора',
      'Отправьте Telegram ID или username (с @ или без него). Добавить можно только зарегистрированного пользователя.',
      { returnPage: Number(ctx.match[1]) });
  });
  bot.action(/^admin_remove:(\d{1,6})$/, async ctx => {
    if (!admin(ctx)) return deny(ctx);
    if (!store.isSystemAdmin(ctx.from.id)) return answerCallback(ctx, 'Удалять администраторов могут только владельцы, указанные в ADMIN_IDS.', { show_alert: true });
    await startInput(ctx, 'remove_admin', 'Удалить администратора',
      'Отправьте Telegram ID или username администратора, которого нужно удалить. Владельцев из ADMIN_IDS удалить нельзя.',
      { returnPage: Number(ctx.match[1]) });
  });
  // Старые сообщения с кнопкой из прежней версии остаются безопасными.
  bot.action('admin_add', async ctx => {
    if (!admin(ctx)) return deny(ctx);
    if (!store.isSystemAdmin(ctx.from.id)) return answerCallback(ctx, 'Добавлять администраторов могут только владельцы, указанные в ADMIN_IDS.', { show_alert: true });
    await startInput(ctx, 'add_admin', 'Добавить администратора',
      'Отправьте Telegram ID или username (с @ или без него). Добавить можно только зарегистрированного пользователя.',
      { returnPage: 0 });
  });
  async function showAdmins(ctx, page = 0) {
    ctx.state ??= {};
    ctx.state.adminListRouteHandled = true;
    if (!admin(ctx)) return deny(ctx);
    inputs.delete(String(ctx.from.id));
    await answerCallback(ctx);
    await transport.show(ctx, adminAdminsScreen(store.listAdminPage(page, 5), store.isSystemAdmin(ctx.from.id)));
  }
  bot.action(/^admin_admins_goto:(\d{1,6})$/, async ctx => {
    if (!admin(ctx)) return deny(ctx);
    await startInput(ctx, 'page_admins', 'Перейти к странице администраторов',
      'Отправьте номер страницы, начиная с 1.',
      { returnPage: Number(ctx.match[1]) });
  });
  bot.action('admin_list', ctx => showAdmins(ctx));
  // Compatibility aliases for keyboards created by older builds.
  bot.action('admin_admins', ctx => showAdmins(ctx));
  bot.action('admins', ctx => showAdmins(ctx));
  bot.action(/^admin_admins:(\d{1,6})$/, ctx => showAdmins(ctx, Number(ctx.match[1])));
  bot.action(/^admin_admins_refresh:(\d{1,6})$/, async ctx => {
    if (!admin(ctx)) return deny(ctx);
    inputs.delete(String(ctx.from.id));
    await answerCallback(ctx, 'Данные обновлены.');
    await transport.show(ctx, adminAdminsScreen(store.listAdminPage(Number(ctx.match[1]), 5), store.isSystemAdmin(ctx.from.id)));
  });

  async function showUsers(ctx, page = 0, buyersOnly = false) {
    if (!admin(ctx)) return deny(ctx);
    inputs.delete(String(ctx.from.id));
    await answerCallback(ctx);
    const data = buyersOnly ? store.listBuyers(page, 5) : store.listUsers(page, 5);
    await transport.show(ctx, adminUsersScreen(data, buyersOnly));
  }
  bot.action(/^admin_users_goto:(\d{1,6}):(0|1)$/, async ctx => {
    if (!admin(ctx)) return deny(ctx);
    const buyersOnly = ctx.match[2] === '1';
    await startInput(ctx, buyersOnly ? 'page_buyers' : 'page_users',
      buyersOnly ? 'Перейти к странице покупателей' : 'Перейти к странице пользователей',
      'Отправьте номер страницы, начиная с 1.',
      { returnPage: Number(ctx.match[1]), buyersOnly });
  });
  // Legacy callback remains valid for keyboards from older messages.
  bot.action(/^admin_users_goto:(\d{1,6})$/, async ctx => {
    if (!admin(ctx)) return deny(ctx);
    await startInput(ctx, 'page_users', 'Перейти к странице пользователей',
      'Отправьте номер страницы, начиная с 1.', { returnPage: Number(ctx.match[1]), buyersOnly: false });
  });
  bot.action('admin_users', ctx => showUsers(ctx));
  bot.action('admin_buyers', ctx => showUsers(ctx, 0, true));
  bot.action('admin_user_count', ctx => showUsers(ctx));
  bot.action(/^admin_users:(\d{1,6})$/, ctx => showUsers(ctx, Number(ctx.match[1])));
  bot.action(/^admin_buyers:(\d{1,6})$/, ctx => showUsers(ctx, Number(ctx.match[1]), true));
  bot.action(/^admin_users_refresh:(\d{1,6})$/, async ctx => {
    if (!admin(ctx)) return deny(ctx);
    inputs.delete(String(ctx.from.id));
    await answerCallback(ctx, 'Данные обновлены.');
    await transport.show(ctx, adminUsersScreen(store.listUsers(Number(ctx.match[1]), 5), false));
  });
  bot.action(/^admin_buyers_refresh:(\d{1,6})$/, async ctx => {
    if (!admin(ctx)) return deny(ctx);
    inputs.delete(String(ctx.from.id));
    await answerCallback(ctx, 'Данные обновлены.');
    await transport.show(ctx, adminUsersScreen(store.listBuyers(Number(ctx.match[1]), 5), true));
  });
  bot.action(USERS_CANCEL, ctx => showUsers(ctx));
  bot.action('admin_lookup', async ctx => {
    if (!admin(ctx)) return deny(ctx);
    await startInput(ctx, 'lookup', 'Проверить пользователя',
      'Отправьте Telegram ID или username (с @ или без него).', { cancelData: USERS_CANCEL });
  });
  bot.action('admin_credit', async ctx => {
    if (!admin(ctx)) return deny(ctx);
    await startInput(ctx, 'credit', 'Выдать баланс',
      'Отправьте Telegram ID или username и сумму в рублях через пробел, например: @username 500 или 123456789 500. Начисление доступно только зарегистрированным пользователям.',
      { cancelData: USERS_CANCEL });
  });
  bot.action('admin_ban', async ctx => {
    if (!admin(ctx)) return deny(ctx);
    await startInput(ctx, 'ban', 'Забанить пользователя',
      'Отправьте Telegram ID или username (с @ или без него). Пользователь потеряет доступ к боту, а его чеки на проверке будут отклонены. Заблокировать можно только зарегистрированного пользователя.',
      { cancelData: USERS_CANCEL });
  });
  bot.action('admin_unban', async ctx => {
    if (!admin(ctx)) return deny(ctx);
    await startInput(ctx, 'unban', 'Разбанить пользователя',
      'Отправьте Telegram ID или username (с @ или без него) заблокированного пользователя.',
      { cancelData: USERS_CANCEL });
  });

  // ---------- Непроверенные чеки ----------
  async function showReceipts(ctx, page = 0, notice) {
    if (!admin(ctx)) return deny(ctx);
    inputs.delete(String(ctx.from.id));
    if (notice !== undefined) await answerCallback(ctx, notice);
    else await answerCallback(ctx);
    await transport.show(ctx, adminReceiptsScreen(store.listPendingReceipts(page, 5)));
  }
  bot.action('admin_receipts', ctx => showReceipts(ctx));
  bot.action(/^admin_receipts:(\d{1,6})$/, ctx => showReceipts(ctx, Number(ctx.match[1])));
  bot.action(/^admin_receipts_refresh:(\d{1,6})$/, ctx => showReceipts(ctx, Number(ctx.match[1]), 'Данные обновлены.'));
  bot.action(/^admin_receipt:(\d{1,15}):(\d{1,6})$/, async ctx => {
    if (!admin(ctx)) return deny(ctx);
    const topUp = store.getTopUp(Number(ctx.match[1]));
    const page = Number(ctx.match[2]);
    if (!topUp || topUp.method !== 'card' || topUp.status !== 'pending') {
      await answerCallback(ctx, 'Этот чек уже проверен. Список обновлён.', { show_alert: true });
      await transport.show(ctx, adminReceiptsScreen(store.listPendingReceipts(page, 5)));
      return;
    }
    const extra = {
      caption: topUpAdminCaption(topUp, store.findRegisteredUser(String(topUp.telegramId))),
      reply_markup: topUpAdminKeyboard(topUp.id),
    };
    try {
      const message = topUp.receiptKind === 'photo'
        ? await ctx.telegram.sendPhoto(ctx.chat.id, topUp.receiptFileId, extra)
        : await ctx.telegram.sendDocument(ctx.chat.id, topUp.receiptFileId, extra);
      // Сообщение попадёт в общий список: после решения подпись обновится у всех админов.
      store.addTopUpAdminMessage(topUp.id, ctx.chat.id, message.message_id);
      await answerCallback(ctx, `Чек №${topUp.id} отправлен ниже.`);
    } catch (error) {
      logger.warn('Не удалось открыть чек.', { topUpId: topUp.id, code: error.response?.error_code ?? error.code });
      await answerCallback(ctx, 'Не удалось открыть чек. Попробуйте ещё раз.', { show_alert: true });
    }
  });
  bot.action('admin_broadcast_cancel', async ctx => {
    if (!admin(ctx)) return deny(ctx);
    drafts.delete(String(ctx.from.id));
    inputs.delete(String(ctx.from.id));
    await answerCallback(ctx, 'Рассылка отменена.');
    await showMenu(ctx);
  });
  bot.action('admin_broadcast_confirm', ctx => confirmBroadcast(ctx));
  async function confirmBroadcast(ctx, expectedToken) {
    if (!admin(ctx)) return deny(ctx);
    const actor = String(ctx.from.id);
    inputs.delete(actor);
    const draft = drafts.get(actor);
    if ((expectedToken && (!draft?.discountNotice || draft.token !== expectedToken)) ||
      (!expectedToken && draft?.discountNotice)) {
      return answerCallback(ctx, 'Этот предпросмотр уже закрыт или устарел.', { show_alert: true });
    }
    if (!draft || draft.createdAt + INPUT_TTL_MS < clock()) {
      drafts.delete(actor);
      await answerCallback(ctx, 'Предпросмотр устарел. Создайте рассылку заново.', { show_alert: true });
      await showMenu(ctx);
      return;
    }
    if (draft.discountNotice && !validDiscountNotice(draft.discountNotice)) {
      drafts.delete(actor);
      return unavailableNotice(ctx, draft.discountNotice.productId);
    }
    if (draft.discountNotice && draft.discountNotice.productId !== null) {
      const notification = renderScreen(discountNotificationScreen(store, draft.discountNotice.productId, draft.discountNotice), false);
      if (notification.text !== draft.text) {
        drafts.delete(actor);
        await answerCallback(ctx, 'Цена товара изменилась. Установите скидку заново для нового предпросмотра.', { show_alert: true });
        await transport.show(ctx, adminDiscountScreen(store, draft.discountNotice.productId));
        return;
      }
    }
    const allowed = new Set(store.listOrdinaryUserIds());
    const recipients = draft.recipients.filter(id => allowed.has(id));
    const payload = { text: draft.text };
    if (draft.discountNotice) {
      payload.notification = draft.notification;
      payload.discountNotice = draft.discountNotice;
      if (draft.discountNotice.productId !== null) {
        const product = store.getProduct(draft.discountNotice.productId);
        payload.expectedPrice = product.price;
        payload.expectedBasePrice = product.basePrice;
      }
    }
    // Только постановка в очередь, без ожидания сетевых отправок внутри callback.
    const job = broadcastQueue.enqueue(actor, payload, recipients);
    drafts.delete(actor);
    await answerCallback(ctx, 'Рассылка поставлена в фоновую очередь.');
    await transport.show(ctx, broadcastStatusScreen(job));
  }
  async function showBroadcastJobs(ctx, page = 0) {
    if (!admin(ctx)) return deny(ctx);
    inputs.delete(String(ctx.from.id));
    await answerCallback(ctx);
    await transport.show(ctx, broadcastJobsScreen(store.listBroadcasts(ctx.from.id, page)));
  }
  bot.action('admin_broadcast_jobs', ctx => showBroadcastJobs(ctx));
  bot.action(/^admin_broadcast_jobs:(\d{1,6})$/, ctx => showBroadcastJobs(ctx, Number(ctx.match[1])));
  bot.action(/^admin_broadcast_status:([1-9]\d{0,14})$/, async ctx => {
    if (!admin(ctx)) return deny(ctx);
    const job = store.getBroadcast(Number(ctx.match[1]));
    if (!job || job.actorId !== String(ctx.from.id)) return answerCallback(ctx, 'Рассылка не найдена или принадлежит другому администратору.', { show_alert: true });
    await answerCallback(ctx);
    await transport.show(ctx, broadcastStatusScreen(job));
  });
  bot.action(/^admin_broadcast_stop:([1-9]\d{0,14})$/, async ctx => {
    if (!admin(ctx)) return deny(ctx);
    const id = Number(ctx.match[1]);
    const job = store.getBroadcast(id);
    if (!job || job.actorId !== String(ctx.from.id)) return answerCallback(ctx, 'Рассылка не найдена или принадлежит другому администратору.', { show_alert: true });
    const cancelled = store.cancelBroadcast(id, ctx.from.id);
    await answerCallback(ctx, cancelled ? 'Отправка оставшихся сообщений остановлена.' : 'Рассылка уже закончена.');
    await transport.show(ctx, broadcastStatusScreen(store.getBroadcast(id)));
  });

  bot.on('text', async ctx => {
    if (!admin(ctx)) return;
    const actor = String(ctx.from.id);
    const state = inputs.get(actor);
    if (!state) return;
    const text = ctx.message.text.trim();
    if (state.createdAt + INPUT_TTL_MS < clock()) {
      inputs.delete(actor);
      await showInputResult(ctx, state, { parts: ['Срок действия команды истёк. Откройте раздел заново.'], rows: [[{ text: 'Назад', data: 'admin_menu', icon: emoji('back') }]] });
      return;
    }
    if (text.toLowerCase() === '/cancel') {
      inputs.delete(actor);
      if (state.type === 'discount_percent' || state.type === 'discount_end') {
        return await showInputResult(ctx, state, adminDiscountScreen(store, state.productId));
      }
      if (state.type === 'page_users' || state.type === 'page_buyers') {
        const data = state.buyersOnly ? store.listBuyers(state.returnPage ?? 0, 5) : store.listUsers(state.returnPage ?? 0, 5);
        return await showInputResult(ctx, state, adminUsersScreen(data, Boolean(state.buyersOnly)));
      }
      if (state.type === 'page_admins') return await showInputResult(ctx, state, adminAdminsScreen(store.listAdminPage(state.returnPage ?? 0, 5)));
      if (USER_TOOL_INPUTS.has(state.type)) return await showInputResult(ctx, state, adminUsersScreen(store.listUsers(0, 5), false));
      await showInputResult(ctx, state, adminMenuScreen(store.isMaintenanceMode(), store.pendingReceiptCount()));
      return;
    }
    if (state.type === 'discount_percent') {
      const percent = /^\d{1,3}$/.test(text) ? Number(text) : NaN;
      if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
        await showInputResult(ctx, state, adminPromptScreen('Процент скидки',
          'Введите целое число от 1 до 100 или /cancel.', state.cancelData));
        return;
      }
      inputs.set(actor, { ...state, type: 'discount_end', percent, createdAt: clock() });
      await showInputResult(ctx, state, adminPromptScreen('Окончание скидки',
        `Скидка: ${percent}%. Введите будущую дату и время по Москве в формате ДД.ММ.ГГГГ ЧЧ:ММ (например: 31.12.2027 23:59). Для отмены — /cancel.`, state.cancelData));
      return;
    }
    if (state.type === 'discount_end') {
      let endsAt;
      try {
        endsAt = parseMoscowEnd(text, clock());
        store.setDiscount(actor, state.productId, state.percent, endsAt);
      } catch (error) {
        // Only validation failures are shown; unexpected database errors reach bot.catch.
        if (!(error instanceof TypeError) && error.message !== 'Товар недоступен.') throw error;
        await showInputResult(ctx, state, adminPromptScreen('Окончание скидки',
          error.message + ' Для отмены — /cancel.', state.cancelData));
        return;
      }
      inputs.delete(actor);
      const discount = store.getDiscount(state.productId);
      const token = randomBytes(6).toString('hex');
      drafts.delete(actor);
      discountOffers.set(actor, { ...discount, productId: state.productId, token, createdAt: clock() });
      await showInputResult(ctx, state, discountBroadcastOfferScreen(store, state.productId, token));
      return;
    }
    if (state.type === 'page_users' || state.type === 'page_buyers' || state.type === 'page_admins') {
      const requestedPage = /^[1-9]\d{0,6}$/.test(text) ? Number(text) : NaN;
      const getPage = state.type === 'page_admins' ? page => store.listAdminPage(page, 5)
        : state.type === 'page_buyers' ? page => store.listBuyers(page, 5)
          : page => store.listUsers(page, 5);
      if (!Number.isSafeInteger(requestedPage)) {
        await showInputResult(ctx, state, adminPromptScreen(
          state.type === 'page_admins' ? 'Перейти к странице администраторов'
            : state.type === 'page_buyers' ? 'Перейти к странице покупателей' : 'Перейти к странице пользователей',
          'Введите целый номер страницы от 1 или /cancel.'));
        inputs.set(actor, { ...state, createdAt: clock() });
        return;
      }
      const totalPages = Math.max(1, Math.ceil(getPage(0).total / 5));
      if (requestedPage > totalPages) {
        await showInputResult(ctx, state, adminPromptScreen(
          state.type === 'page_admins' ? 'Перейти к странице администраторов'
            : state.type === 'page_buyers' ? 'Перейти к странице покупателей' : 'Перейти к странице пользователей',
          `Страницы ${requestedPage} нет. Доступны страницы от 1 до ${totalPages}. Введите номер или /cancel.`));
        inputs.set(actor, { ...state, createdAt: clock() });
        return;
      }
      inputs.delete(actor);
      const screen = state.type === 'page_admins'
        ? adminAdminsScreen(getPage(requestedPage - 1))
        : adminUsersScreen(getPage(requestedPage - 1), state.type === 'page_buyers');
      await showInputResult(ctx, state, screen);
      return;
    }
    if (state.type === 'broadcast') {
      if (!text || text.length > MAX_BROADCAST_LENGTH || text.startsWith('/')) {
        await showInputResult(ctx, state, adminPromptScreen('Новая рассылка', `Текст пустой или длиннее ${MAX_BROADCAST_LENGTH} символов. Отправьте обычный текст или /cancel.`));
        return;
      }
      inputs.delete(actor);
      const recipients = store.listOrdinaryUserIds();
      drafts.set(actor, { text, recipients, createdAt: clock() });
      await showInputResult(ctx, state, adminBroadcastPreviewScreen(text, recipients.length));
      return;
    }
    if (state.type === 'add_admin') {
      if (!store.isSystemAdmin(ctx.from.id)) {
        inputs.delete(actor);
        await showInputResult(ctx, state, adminPromptScreen('Недостаточно прав', 'Добавлять администраторов могут только владельцы, указанные в ADMIN_IDS.'));
        return;
      }
      if (!validId(text) && !/^@?[A-Za-z0-9_]{1,32}$/.test(text)) {
        await showInputResult(ctx, state, adminPromptScreen('Добавить администратора', 'Формат не распознан. Отправьте Telegram ID или username (с @ или без него).'));
        return;
      }
      const result = store.addAdmin(text, actor);
      inputs.delete(actor);
      if (result.status === 'added') {
        const notification = {
          parts: [emoji('lock'), ' ', { type: 'bold', text: 'Вас назначили администратором Night Kavkaz.' }, '\n\n',
          emoji('check'), ' Теперь вам доступна админ-панель бота.'],
          rows: [[{ text: 'Открыть панель администратора', data: 'admin_menu', icon: emoji('lock') }]],
        };
        const rendered = renderScreen(notification);
        try { await ctx.telegram.sendMessage(result.telegramId, rendered.text, rendered.extra); }
        catch (error) {
          if (error.response?.error_code === 400 && /custom[_ ]emoji|PREMIUM_ACCOUNT_REQUIRED/i.test(error.response.description ?? '')) {
            try { const plain = renderScreen(notification, false); await ctx.telegram.sendMessage(result.telegramId, plain.text, plain.extra); } catch { /* User may not have opened the bot yet. */ }
          }
        }
      }
      const message = result.status === 'added'
        ? `Администратор ${result.telegramId} добавлен. Уведомление отправлено, если пользователь уже открыл бота.`
        : result.status === 'already_admin' ? `Пользователь ${result.telegramId} уже есть в списке администраторов.`
          : result.status === 'not_found' ? `Пользователь ${text} не зарегистрирован в базе данных. Администратор не добавлен.`
            : 'Недостаточно прав. Изменения не внесены.';
      await showInputResult(ctx, state, adminActionResultScreen(message));
      return;
    }
    if (state.type === 'remove_admin') {
      if (!store.isSystemAdmin(ctx.from.id)) {
        inputs.delete(actor);
        await showInputResult(ctx, state, adminPromptScreen('Недостаточно прав', 'Удалять администраторов могут только владельцы, указанные в ADMIN_IDS.'));
        return;
      }
      if (!validId(text) && !/^@?[A-Za-z0-9_]{1,32}$/.test(text)) {
        await showInputResult(ctx, state, adminPromptScreen('Удалить администратора', 'Формат не распознан. Отправьте Telegram ID или username.'));
        inputs.set(actor, { ...state, createdAt: clock() });
        return;
      }
      const result = store.removeAdmin(text, actor);
      const messages = {
        removed: `Администратор ${result.telegramId} удалён.`,
        not_admin: `Администратор ${text} не найден.`,
        system_admin: `Нельзя удалить владельца ${result.telegramId}, указанного в ADMIN_IDS.`,
        forbidden: 'Недостаточно прав. Изменения не внесены.',
      };
      inputs.delete(actor);
      await showInputResult(ctx, state, adminActionResultScreen(
        messages[result.status] ?? 'Не удалось удалить администратора.'));
      return;
    }
    if (state.type === 'ban' || state.type === 'unban') {
      const banning = state.type === 'ban';
      if (!validUserQuery(text)) {
        await showInputResult(ctx, state, adminPromptScreen(banning ? 'Забанить пользователя' : 'Разбанить пользователя',
          'Формат не распознан. Отправьте Telegram ID или username (с @ или без него) или /cancel.', USERS_CANCEL));
        inputs.set(actor, { ...state, createdAt: clock() });
        return;
      }
      inputs.delete(actor);
      const result = banning ? store.banUser(actor, text) : store.unbanUser(actor, text);
      await showInputResult(ctx, state, adminBanResultScreen(result, text));
      if (result.status !== 'banned' && result.status !== 'unbanned') return;
      if (banning) {
        // Отклонённые при блокировке чеки: убираем кнопки у всех админов.
        const banned = store.findRegisteredUser(result.telegramId);
        const reviewer = store.findRegisteredUser(actor);
        for (const topUp of result.rejectedTopUps ?? []) {
          const caption = topUpAdminCaption(topUp, banned, reviewer);
          for (const { chatId, messageId } of store.listTopUpAdminMessages(topUp.id)) {
            try { await ctx.telegram.editMessageCaption(chatId, messageId, undefined, caption, { reply_markup: { inline_keyboard: [] } }); }
            catch { /* сообщение могли удалить */ }
          }
        }
        try { await transport.send(ctx.telegram, result.telegramId, bannedScreen()); }
        catch { /* пользователь мог заблокировать бота */ }
      }
      const actorInfo = store.findRegisteredUser(actor);
      const target = result.user;
      const targetLabel = `${result.telegramId}${target?.username ? ` (@${target.username})` : ''}`;
      const notice = `Админ ${actor}${actorInfo?.username ? ` (@${actorInfo.username})` : ''} ` +
        `${banning ? 'заблокировал' : 'разблокировал'} пользователя ${targetLabel}.`;
      for (const other of store.listAdmins()) {
        if (String(other.telegramId) === actor) continue;
        try { await ctx.telegram.sendMessage(other.telegramId, notice); }
        catch { /* админ мог не открыть бота */ }
        await sleep(40);
      }
      return;
    }
    if (state.type === 'lookup') {
      const validLookup = validId(text) || /^@?[A-Za-z0-9_]{1,32}$/.test(text);
      if (!validLookup) {
        await showInputResult(ctx, state, adminPromptScreen('Проверить пользователя', 'Формат не распознан. Отправьте Telegram ID или username (с @ или без него).', USERS_CANCEL));
        return;
      }
      inputs.delete(actor);
      await showInputResult(ctx, state, adminLookupScreen(store.findRegisteredUser(text), text));
      return;
    }
    if (state.type === 'credit') {
      const match = text.match(/^(@?[A-Za-z0-9_]{1,32}|[1-9]\d{0,19})\s+([1-9]\d{0,11})$/);
      if (!match) {
        await showInputResult(ctx, state, adminPromptScreen('Выдать баланс', 'Формат: ID или @username и целая сумма в рублях через пробел, например @username 500 или 123456789 500.', USERS_CANCEL));
        return;
      }
      const amount = Number(match[2]);
      if (!Number.isSafeInteger(amount) || amount < 1) {
        await showInputResult(ctx, state, adminPromptScreen('Выдать баланс', 'Сумма вне допустимого диапазона. Введите меньшую сумму или /cancel.', USERS_CANCEL));
        return;
      }
      inputs.delete(actor);
      const result = store.creditUser(actor, match[1], amount);
      await showInputResult(ctx, state, adminCreditResultScreen({ ...result, query: match[1], telegramId: result.telegramId ?? match[1] }));
    }
  });
  // Register catch-all last, or it would consume admin callbacks before their handlers.
  bot.on('callback_query', async ctx => {
    const data = ctx.callbackQuery?.data;
    if (!ctx.state.adminListRouteHandled && ['admin_list', 'admin_admins', 'admins'].includes(data)) {
      return showAdmins(ctx);
    }
    return answerCallback(ctx, 'Кнопка устарела. Откройте нужный раздел заново.');
  });
}
