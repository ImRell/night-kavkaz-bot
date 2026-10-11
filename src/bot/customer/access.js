import { maintenanceScreen, bannedScreen } from '../../ui/screens.js';
import { answerCallback } from '../transport.js';
export function registerAccessHandlers(bot, context) {
  const { store, transport, opensCatalogBelow, logger } = context;
  bot.use(async (ctx, next) => {
    if (ctx.preCheckoutQuery) {
      if (store.isMaintenanceMode() && !store.isAdmin(ctx.from?.id)) {
        return ctx.answerPreCheckoutQuery(
          false,
          'Бот временно на технических работах. Попробуйте позже.',
        );
      }
      if (ctx.from && store.isBanned(ctx.from.id) && !store.isAdmin(ctx.from.id)) {
        return ctx.answerPreCheckoutQuery(false, 'Ваш аккаунт заблокирован.');
      }
      return next();
    }
    if (ctx.message?.successful_payment) return next();
    if (ctx.chat?.type !== 'private' || !ctx.from) {
      if (ctx.callbackQuery) await answerCallback(ctx, 'Откройте личный чат с ботом.');
      else if (ctx.message?.text?.startsWith('/start'))
        await ctx.reply(
          'Night Kavkaz работает в личных сообщениях. Откройте чат со мной и нажмите /start.',
        );
      return;
    }
    if (store.isMaintenanceMode() && !store.isAdmin(ctx.from.id)) {
      const message = ctx.callbackQuery?.message || ctx.message;
      if (ctx.callbackQuery) {
        await answerCallback(ctx, 'Бот временно на технических работах.');
        if (opensCatalogBelow(ctx)) await transport.reply(ctx, maintenanceScreen());
        else await transport.show(ctx, maintenanceScreen());
      } else if (message) {
        await transport.reply(ctx, maintenanceScreen());
      }
      return;
    }
    if (store.isBanned(ctx.from.id) && !store.isAdmin(ctx.from.id)) {
      if (ctx.callbackQuery) {
        await answerCallback(ctx, 'Ваш аккаунт заблокирован.', { show_alert: true });
        if (opensCatalogBelow(ctx)) await transport.reply(ctx, bannedScreen());
        else await transport.show(ctx, bannedScreen());
      } else if (ctx.message) {
        await transport.reply(ctx, bannedScreen());
      }
      return;
    }
    const isNewUser = !store.get(ctx.from.id);
    store.updateUserProfile(ctx.from);
    if (isNewUser) logger.info?.('Новый пользователь зарегистрирован.', { userId: ctx.from.id });
    return next();
  });
}
