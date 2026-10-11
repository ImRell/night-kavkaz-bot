import { adminPromptScreen, adminActionResultScreen } from '../../../ui/admin/screens.js';
import { renderScreen, emoji } from '../../../ui/emoji.js';
export async function handleAdminsInput(ctx, context, { actor, state, text }) {
  const { store, clock, inputs, showInputResult, validId } = context;
  if (state.type === 'add_admin') {
    if (!store.isSystemAdmin(ctx.from.id)) {
      inputs.delete(actor);
      await showInputResult(
        ctx,
        state,
        adminPromptScreen(
          'Недостаточно прав',
          'Добавлять администраторов могут только владельцы, указанные в ADMIN_IDS.',
        ),
      );
      return;
    }
    if (!validId(text) && !/^@?[A-Za-z0-9_]{1,32}$/.test(text)) {
      await showInputResult(
        ctx,
        state,
        adminPromptScreen(
          'Добавить администратора',
          'Формат не распознан. Отправьте Telegram ID или username (с @ или без него).',
        ),
      );
      return;
    }
    const result = store.addAdmin(text, actor);
    inputs.delete(actor);
    if (result.status === 'added') {
      const notification = {
        parts: [
          emoji('lock'),
          ' ',
          { type: 'bold', text: 'Вас назначили администратором Night Kavkaz.' },
          '\n\n',
          emoji('check'),
          ' Теперь вам доступна админ-панель бота.',
        ],
        rows: [
          [{ text: 'Открыть панель администратора', data: 'admin_menu', icon: emoji('lock') }],
        ],
      };
      const rendered = renderScreen(notification);
      try {
        await ctx.telegram.sendMessage(result.telegramId, rendered.text, rendered.extra);
      } catch (error) {
        if (
          error.response?.error_code === 400 &&
          /custom[_ ]emoji|PREMIUM_ACCOUNT_REQUIRED/i.test(error.response.description ?? '')
        ) {
          try {
            const plain = renderScreen(notification, false);
            await ctx.telegram.sendMessage(result.telegramId, plain.text, plain.extra);
          } catch {}
        }
      }
    }
    const message =
      result.status === 'added'
        ? `Администратор ${result.telegramId} добавлен. Уведомление отправлено, если пользователь уже открыл бота.`
        : result.status === 'already_admin'
          ? `Пользователь ${result.telegramId} уже есть в списке администраторов.`
          : result.status === 'not_found'
            ? `Пользователь ${text} не зарегистрирован в базе данных. Администратор не добавлен.`
            : 'Недостаточно прав. Изменения не внесены.';
    await showInputResult(ctx, state, adminActionResultScreen(message));
    return;
  }
  if (state.type === 'remove_admin') {
    if (!store.isSystemAdmin(ctx.from.id)) {
      inputs.delete(actor);
      await showInputResult(
        ctx,
        state,
        adminPromptScreen(
          'Недостаточно прав',
          'Удалять администраторов могут только владельцы, указанные в ADMIN_IDS.',
        ),
      );
      return;
    }
    if (!validId(text) && !/^@?[A-Za-z0-9_]{1,32}$/.test(text)) {
      await showInputResult(
        ctx,
        state,
        adminPromptScreen(
          'Удалить администратора',
          'Формат не распознан. Отправьте Telegram ID или username.',
        ),
      );
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
    await showInputResult(
      ctx,
      state,
      adminActionResultScreen(messages[result.status] ?? 'Не удалось удалить администратора.'),
    );
    return;
  }
}
