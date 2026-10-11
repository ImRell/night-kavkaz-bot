import { randomBytes } from 'node:crypto';
import { discountBroadcastOfferScreen } from '../../../ui/admin/discount-notifications.js';
import { parseMoscowEnd } from '../../../discounts.js';
import { adminPromptScreen } from '../../../ui/admin/screens.js';
export async function handleDiscountsInput(ctx, context, { actor, state, text }) {
  const { store, clock, inputs, drafts, discountOffers, showInputResult } = context;
  if (state.type === 'discount_percent') {
    const percent = /^\d{1,3}$/.test(text) ? Number(text) : NaN;
    if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
      await showInputResult(
        ctx,
        state,
        adminPromptScreen(
          'Процент скидки',
          'Введите целое число от 1 до 100 или /cancel.',
          state.cancelData,
        ),
      );
      return;
    }
    inputs.set(actor, { ...state, type: 'discount_end', percent, createdAt: clock() });
    await showInputResult(
      ctx,
      state,
      adminPromptScreen(
        'Окончание скидки',
        `Скидка: ${percent}%. Введите будущую дату и время по Москве в формате ДД.ММ.ГГГГ ЧЧ:ММ (например: 31.12.2027 23:59). Для отмены — /cancel.`,
        state.cancelData,
      ),
    );
    return;
  }
  if (state.type === 'discount_end') {
    let endsAt;
    try {
      endsAt = parseMoscowEnd(text, clock());
      store.setDiscount(actor, state.productId, state.percent, endsAt);
    } catch (error) {
      if (!(error instanceof TypeError) && error.message !== 'Товар недоступен.') throw error;
      await showInputResult(
        ctx,
        state,
        adminPromptScreen(
          'Окончание скидки',
          error.message + ' Для отмены — /cancel.',
          state.cancelData,
        ),
      );
      return;
    }
    inputs.delete(actor);
    const discount = store.getDiscount(state.productId);
    const token = randomBytes(6).toString('hex');
    drafts.delete(actor);
    discountOffers.set(actor, {
      ...discount,
      productId: state.productId,
      token,
      createdAt: clock(),
    });
    await showInputResult(ctx, state, discountBroadcastOfferScreen(store, state.productId, token));
    return;
  }
}
