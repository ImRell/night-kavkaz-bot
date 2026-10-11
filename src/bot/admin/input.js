import { broadcastMenuScreen } from '../../ui/admin/broadcasts.js';
import { adminDiscountScreen } from '../../ui/admin/discounts.js';
import { adminMenuScreen, adminAdminsScreen, adminUsersScreen } from '../../ui/admin/screens.js';
import { emoji } from '../../ui/emoji.js';
import { handleDiscountsInput } from './input/discounts.js';
import { handlePaginationInput } from './input/pagination.js';
import { handleBroadcastInput } from './input/broadcast.js';
import { handleAdminsInput } from './input/admins.js';
import { handleModerationInput } from './input/moderation.js';
import { handleLookupInput } from './input/lookup.js';
import { handleBalanceInput } from './input/balance.js';
const inputHandlers = {
  discount_percent: handleDiscountsInput,
  discount_end: handleDiscountsInput,
  page_users: handlePaginationInput,
  page_buyers: handlePaginationInput,
  page_admins: handlePaginationInput,
  broadcast: handleBroadcastInput,
  add_admin: handleAdminsInput,
  remove_admin: handleAdminsInput,
  ban: handleModerationInput,
  unban: handleModerationInput,
  lookup: handleLookupInput,
  credit: handleBalanceInput,
};
export function registerInputHandlers(bot, context) {
  const { store, clock, inputs, admin, showInputResult, INPUT_TTL_MS, USER_TOOL_INPUTS } = context;
  bot.on('text', async (ctx) => {
    if (!admin(ctx)) return;
    const actor = String(ctx.from.id);
    const state = inputs.get(actor);
    if (!state) return;
    const text = ctx.message.text.trim();
    if (state.createdAt + INPUT_TTL_MS < clock()) {
      inputs.delete(actor);
      await showInputResult(ctx, state, {
        parts: ['Срок действия команды истёк. Откройте раздел заново.'],
        rows: [[{ text: 'Назад', data: 'admin_menu', icon: emoji('back') }]],
      });
      return;
    }
    if (text.toLowerCase() === '/cancel') {
      inputs.delete(actor);
      if (state.type === 'broadcast') {
        return await showInputResult(ctx, state, broadcastMenuScreen());
      }
      if (state.type === 'discount_percent' || state.type === 'discount_end') {
        return await showInputResult(ctx, state, adminDiscountScreen(store, state.productId));
      }
      if (state.type === 'page_users' || state.type === 'page_buyers') {
        const data = state.buyersOnly
          ? store.listBuyers(state.returnPage ?? 0, 5)
          : store.listUsers(state.returnPage ?? 0, 5);
        return await showInputResult(ctx, state, adminUsersScreen(data, Boolean(state.buyersOnly)));
      }
      if (state.type === 'page_admins')
        return await showInputResult(
          ctx,
          state,
          adminAdminsScreen(store.listAdminPage(state.returnPage ?? 0, 5)),
        );
      if (USER_TOOL_INPUTS.has(state.type))
        return await showInputResult(ctx, state, adminUsersScreen(store.listUsers(0, 5), false));
      await showInputResult(
        ctx,
        state,
        adminMenuScreen(store.isMaintenanceMode(), store.pendingReceiptCount()),
      );
      return;
    }
    return inputHandlers[state.type]?.(ctx, context, { actor, state, text });
  });
}
