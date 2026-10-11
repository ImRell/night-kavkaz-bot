import { answerCallback } from '../transport.js';
import { adminPromptScreen } from '../../ui/admin/screens.js';
import { renderScreen } from '../../ui/emoji.js';
export function createPromptTools(context) {
  const { transport, clock, inputs } = context;
  async function removeIncomingMessage(ctx) {
    try {
      await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
    } catch {}
  }
  async function replacePrompt(ctx, state, screen) {
    await removeIncomingMessage(ctx);
    if (state.prompt?.chatId && state.prompt?.messageId && ctx.telegram?.editMessageText) {
      const rendered = renderScreen(screen);
      try {
        await ctx.telegram.editMessageText(
          state.prompt.chatId,
          state.prompt.messageId,
          undefined,
          rendered.text,
          rendered.extra,
        );
        return;
      } catch (error) {
        if (
          error.response?.error_code === 400 &&
          /message is not modified/i.test(error.response.description ?? '')
        )
          return;
        if (
          error.response?.error_code === 400 &&
          /custom[_ ]emoji|PREMIUM_ACCOUNT_REQUIRED/i.test(error.response.description ?? '')
        ) {
          try {
            const plain = renderScreen(screen, false);
            await ctx.telegram.editMessageText(
              state.prompt.chatId,
              state.prompt.messageId,
              undefined,
              plain.text,
              plain.extra,
            );
            return;
          } catch (fallbackError) {
            if (
              fallbackError.response?.error_code === 400 &&
              /message is not modified/i.test(fallbackError.response.description ?? '')
            )
              return;
          }
        }
      }
    }
    await transport.reply(ctx, screen);
  }
  async function startInput(ctx, type, title, instructions, extraState = {}) {
    const message = ctx.callbackQuery?.message;
    const prompt = message ? { chatId: message.chat.id, messageId: message.message_id } : null;
    const state = { type, createdAt: clock(), prompt, ...extraState };
    inputs.set(String(ctx.from.id), state);
    await answerCallback(ctx);
    await transport.show(ctx, adminPromptScreen(title, instructions, state.cancelData));
  }
  async function showInputResult(ctx, state, screen) {
    await replacePrompt(ctx, state, screen);
  }
  return { removeIncomingMessage, replacePrompt, startInput, showInputResult };
}
