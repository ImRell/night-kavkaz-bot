import { errorScreen } from '../../ui/screens.js';
import { answerCallback } from '../transport.js';
export function registerErrorsHandlers(bot, context) {
  const { transport, opensCatalogBelow, logger } = context;
  bot.catch(async (error, ctx) => {
    logger.error('Ошибка обработки обновления.', {
      code: error.response?.error_code ?? error.code ?? 'UNKNOWN',
    });
    try {
      if (ctx.callbackQuery) {
        await answerCallback(ctx);
        if (opensCatalogBelow(ctx)) await transport.reply(ctx, errorScreen());
        else await transport.show(ctx, errorScreen());
      } else await transport.reply(ctx, errorScreen());
    } catch {
      logger.error('Не удалось отправить сообщение об ошибке.');
    }
  });
}
