import { answerCallback } from '../transport.js';
export function registerFallbackHandlers(bot, context) {
  const { showAdmins } = context;
  bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery?.data;
    if (
      !ctx.state.adminListRouteHandled &&
      ['admin_list', 'admin_admins', 'admins'].includes(data)
    ) {
      return showAdmins(ctx);
    }
    return answerCallback(ctx, 'Кнопка устарела. Откройте нужный раздел заново.');
  });
}
