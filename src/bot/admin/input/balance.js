import { adminPromptScreen, adminCreditResultScreen } from '../../../ui/admin/screens.js';
export async function handleBalanceInput(ctx, context, { actor, state, text }) {
  const { store, logger, inputs, showInputResult, USERS_CANCEL } = context;
  if (state.type === 'credit') {
    const match = text.match(/^(@?[A-Za-z0-9_]{1,32}|[1-9]\d{0,19})\s+([1-9]\d{0,11})$/);
    if (!match) {
      await showInputResult(
        ctx,
        state,
        adminPromptScreen(
          'Выдать баланс',
          'Формат: ID или @username и целая сумма в рублях через пробел, например @username 500 или 123456789 500.',
          USERS_CANCEL,
        ),
      );
      return;
    }
    const amount = Number(match[2]);
    if (!Number.isSafeInteger(amount) || amount < 1) {
      await showInputResult(
        ctx,
        state,
        adminPromptScreen(
          'Выдать баланс',
          'Сумма вне допустимого диапазона. Введите меньшую сумму или /cancel.',
          USERS_CANCEL,
        ),
      );
      return;
    }
    inputs.delete(actor);
    const result = store.creditUser(actor, match[1], amount);
    if (result.status === 'credited')
      logger.info?.('Администратор пополнил баланс пользователя.', {
        adminId: actor,
        userId: result.telegramId,
        amount,
        balance: result.balance,
      });
    await showInputResult(
      ctx,
      state,
      adminCreditResultScreen({
        ...result,
        query: match[1],
        telegramId: result.telegramId ?? match[1],
      }),
    );
  }
}
