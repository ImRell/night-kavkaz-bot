import { answerCallback } from '../transport.js';
export function registerNavigationHandlers(bot, context) {
  const { store, logger, inputs, drafts, admin, deny, showMenu } = context;
  bot.action('admin_menu', async (ctx) => {
    if (!admin(ctx)) return deny(ctx);
    inputs.delete(String(ctx.from.id));
    await answerCallback(ctx);
    await showMenu(ctx);
  });
  bot.action('admin_maintenance_toggle', async (ctx) => {
    if (!admin(ctx)) return deny(ctx);
    inputs.delete(String(ctx.from.id));
    drafts.delete(String(ctx.from.id));
    const enabled = store.setMaintenanceMode(!store.isMaintenanceMode());
    logger.info?.(enabled ? 'Технические работы включены.' : 'Технические работы выключены.', {
      adminId: ctx.from.id,
    });
    await answerCallback(
      ctx,
      enabled ? 'Технические работы включены.' : 'Технические работы выключены.',
    );
    await showMenu(ctx);
  });
  bot.action('admin_cancel', async (ctx) => {
    if (!admin(ctx)) return deny(ctx);
    inputs.delete(String(ctx.from.id));
    await answerCallback(ctx);
    await showMenu(ctx);
  });
}
