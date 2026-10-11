import { welcomeScreen, menuScreen } from '../../ui/screens.js';
import { answerCallback } from '../transport.js';
export function registerNavigationHandlers(bot, context) {
  const { store, transport, rulesVersion, logger, hooks, hasAgreement, requireAgreement } = context;
  bot.start((ctx) => {
    hooks.onStart?.(ctx);
    return transport.reply(
      ctx,
      hasAgreement(store.get(ctx.from.id))
        ? menuScreen(ctx.from, store.isAdmin(ctx.from.id))
        : welcomeScreen(),
    );
  });
  bot.action('accept_rules', async (ctx) => {
    await answerCallback(ctx);
    const previous = store.get(ctx.from.id);
    store.accept(ctx.from.id, rulesVersion);
    if (!hasAgreement(previous))
      logger.info?.('Пользователь принял правила.', { userId: ctx.from.id, rulesVersion });
    await transport.show(ctx, menuScreen(ctx.from, store.isAdmin(ctx.from.id)));
  });
  bot.action('main_menu', async (ctx) => {
    if (!(await requireAgreement(ctx))) return;
    await answerCallback(ctx);
    await transport.show(ctx, menuScreen(ctx.from, store.isAdmin(ctx.from.id)));
  });
}
