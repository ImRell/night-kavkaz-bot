import { profileScreen } from '../../ui/screens.js';
import { answerCallback } from '../transport.js';
export function registerProfileHandlers(bot, context) {
  const { transport, requireAgreement } = context;
  bot.action('profile', async (ctx) => {
    const record = await requireAgreement(ctx);
    if (!record) return;
    await answerCallback(ctx);
    await transport.show(ctx, profileScreen(ctx.from, record));
  });
}
