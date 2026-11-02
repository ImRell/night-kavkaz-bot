import { adminPromptScreen, adminGrantProductsScreen } from '../../../ui/admin/screens.js';
export async function handleGrantInput(ctx, context, { actor, state, text }) {
  const { store, inputs, showInputResult, validUserQuery, USERS_CANCEL } = context;
  if (state.type !== 'grant') return;
  if (!validUserQuery(text)) {
    await showInputResult(
      ctx,
      state,
      adminPromptScreen(
        'Выдать товар',
        'Формат не распознан. Отправьте Telegram ID или username (с @ или без него).',
        USERS_CANCEL,
      ),
    );
    return;
  }
  inputs.delete(actor);
  const user = store.findRegisteredUser(text);
  await showInputResult(
    ctx,
    state,
    adminGrantProductsScreen(
      user,
      text,
      store.listProducts().items,
      user ? store.listPurchasedProductIds(user.telegramId) : [],
    ),
  );
}
