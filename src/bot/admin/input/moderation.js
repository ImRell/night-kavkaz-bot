import { adminPromptScreen, adminBanResultScreen } from '../../../ui/admin/screens.js';
import { bannedScreen } from '../../../ui/screens.js';
export async function handleModerationInput(ctx, context, { actor, state, text }) {
  const {
    store,
    logger,
    transport,
    clock,
    inputs,
    showInputResult,
    sleep,
    validUserQuery,
    USERS_CANCEL,
  } = context;
  if (state.type === 'ban' || state.type === 'unban') {
    const banning = state.type === 'ban';
    if (!validUserQuery(text)) {
      await showInputResult(
        ctx,
        state,
        adminPromptScreen(
          banning ? 'Забанить пользователя' : 'Разбанить пользователя',
          'Формат не распознан. Отправьте Telegram ID или username (с @ или без него) или /cancel.',
          USERS_CANCEL,
        ),
      );
      inputs.set(actor, { ...state, createdAt: clock() });
      return;
    }
    inputs.delete(actor);
    const result = banning ? store.banUser(actor, text) : store.unbanUser(actor, text);
    await showInputResult(ctx, state, adminBanResultScreen(result, text));
    if (result.status !== 'banned' && result.status !== 'unbanned') return;
    logger.info?.(banning ? 'Пользователь заблокирован.' : 'Пользователь разблокирован.', {
      adminId: actor,
      userId: result.telegramId,
    });
    if (banning) {
      try {
        await transport.send(ctx.telegram, result.telegramId, bannedScreen());
      } catch {}
    }
    const actorInfo = store.findRegisteredUser(actor);
    const target = result.user;
    const targetLabel = `${result.telegramId}${target?.username ? ` (@${target.username})` : ''}`;
    const notice =
      `Админ ${actor}${actorInfo?.username ? ` (@${actorInfo.username})` : ''} ` +
      `${banning ? 'заблокировал' : 'разблокировал'} пользователя ${targetLabel}.`;
    for (const other of store.listAdmins()) {
      if (String(other.telegramId) === actor) continue;
      try {
        await ctx.telegram.sendMessage(other.telegramId, notice);
      } catch {}
      await sleep(40);
    }
    return;
  }
}
