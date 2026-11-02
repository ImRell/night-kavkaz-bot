import { menuScreen, legacySectionText } from '../../ui/screens.js';
import { answerCallback } from '../transport.js';
export function registerNavigationHandlers(bot, context) {
  const { store, transport, rulesVersion, logger, gate, hasAgreement, requireAgreement } = context;
  const showMenu = (ctx) => transport.show(ctx, menuScreen(ctx.from, store.isAdmin(ctx.from.id)));
  bot.start((ctx) => {
    return transport.reply(
      ctx,
      hasAgreement(store.get(ctx.from.id))
        ? menuScreen(ctx.from, store.isAdmin(ctx.from.id))
        : gate.screenFor(ctx.from.id),
    );
  });
  bot.action('accept_rules', async (ctx) => {
    await answerCallback(ctx);
    const previous = store.get(ctx.from.id);
    store.accept(ctx.from.id, rulesVersion);
    if (!gate.hasAccepted(previous))
      logger.info?.('Пользователь принял правила.', { userId: ctx.from.id, rulesVersion });
    if (hasAgreement(store.get(ctx.from.id))) await showMenu(ctx);
    else await transport.show(ctx, gate.screenFor(ctx.from.id));
  });
  bot.action(/^captcha:([0-9a-f]{8}):(\d{1,3})$/, async (ctx) => {
    const record = store.get(ctx.from.id);
    if (hasAgreement(record)) {
      await answerCallback(ctx);
      return showMenu(ctx);
    }
    if (!gate.hasAccepted(record)) {
      await answerCallback(ctx, gate.noticeFor(ctx.from.id));
      return transport.show(ctx, gate.screenFor(ctx.from.id));
    }
    const result = gate.answer(ctx.from.id, ctx.match[1], Number(ctx.match[2]));
    if (result.status === 'passed') {
      logger.info?.('Пользователь прошёл капчу.', { userId: ctx.from.id });
      await answerCallback(ctx, 'Верно!');
      return showMenu(ctx);
    }
    await answerCallback(
      ctx,
      result.status === 'wrong' ? 'Неверно. Решите новый пример.' : undefined,
    );
    await transport.show(ctx, result.screen);
  });
  bot.action('captcha_retry', async (ctx) => {
    if (!(await requireAgreement(ctx))) return;
    await answerCallback(ctx);
    await showMenu(ctx);
  });
  bot.action('main_menu', async (ctx) => {
    if (!(await requireAgreement(ctx))) return;
    await answerCallback(ctx);
    await showMenu(ctx);
  });
  // Buttons from old messages: profile, balance top-ups and balance purchases no longer exist.
  bot.action(/^(?:profile$|top_up|confirm_purchase:)/, async (ctx) => {
    if (!(await requireAgreement(ctx))) return;
    await answerCallback(ctx, legacySectionText(), { show_alert: true });
    await showMenu(ctx);
  });
}
