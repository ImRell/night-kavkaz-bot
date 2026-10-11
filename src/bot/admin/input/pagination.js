import {
  adminPromptScreen,
  adminAdminsScreen,
  adminUsersScreen,
} from '../../../ui/admin/screens.js';
export async function handlePaginationInput(ctx, context, { actor, state, text }) {
  const { store, clock, inputs, showInputResult } = context;
  if (state.type === 'page_users' || state.type === 'page_buyers' || state.type === 'page_admins') {
    const requestedPage = /^[1-9]\d{0,6}$/.test(text) ? Number(text) : NaN;
    const getPage =
      state.type === 'page_admins'
        ? (page) => store.listAdminPage(page, 5)
        : state.type === 'page_buyers'
          ? (page) => store.listBuyers(page, 5)
          : (page) => store.listUsers(page, 5);
    if (!Number.isSafeInteger(requestedPage)) {
      await showInputResult(
        ctx,
        state,
        adminPromptScreen(
          state.type === 'page_admins'
            ? 'Перейти к странице администраторов'
            : state.type === 'page_buyers'
              ? 'Перейти к странице покупателей'
              : 'Перейти к странице пользователей',
          'Введите целый номер страницы от 1 или /cancel.',
        ),
      );
      inputs.set(actor, { ...state, createdAt: clock() });
      return;
    }
    const totalPages = Math.max(1, Math.ceil(getPage(0).total / 5));
    if (requestedPage > totalPages) {
      await showInputResult(
        ctx,
        state,
        adminPromptScreen(
          state.type === 'page_admins'
            ? 'Перейти к странице администраторов'
            : state.type === 'page_buyers'
              ? 'Перейти к странице покупателей'
              : 'Перейти к странице пользователей',
          `Страницы ${requestedPage} нет. Доступны страницы от 1 до ${totalPages}. Введите номер или /cancel.`,
        ),
      );
      inputs.set(actor, { ...state, createdAt: clock() });
      return;
    }
    inputs.delete(actor);
    const screen =
      state.type === 'page_admins'
        ? adminAdminsScreen(getPage(requestedPage - 1))
        : adminUsersScreen(getPage(requestedPage - 1), state.type === 'page_buyers');
    await showInputResult(ctx, state, screen);
    return;
  }
}
