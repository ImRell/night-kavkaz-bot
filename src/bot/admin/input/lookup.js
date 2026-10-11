import { adminPromptScreen, adminLookupScreen } from '../../../ui/admin/screens.js';
export async function handleLookupInput(ctx, context, { actor, state, text }) {
  const { store, inputs, showInputResult, validId, USERS_CANCEL } = context;
  if (state.type === 'lookup') {
    const validLookup = validId(text) || /^@?[A-Za-z0-9_]{1,32}$/.test(text);
    if (!validLookup) {
      await showInputResult(
        ctx,
        state,
        adminPromptScreen(
          'Проверить пользователя',
          'Формат не распознан. Отправьте Telegram ID или username (с @ или без него).',
          USERS_CANCEL,
        ),
      );
      return;
    }
    inputs.delete(actor);
    await showInputResult(ctx, state, adminLookupScreen(store.findRegisteredUser(text), text));
    return;
  }
}
