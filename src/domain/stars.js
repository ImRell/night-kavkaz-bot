export const RUB_PER_STAR = 1.3;
// Telegram caps a single Stars invoice, so expensive products are paid by card only.
export const MAX_STARS_AMOUNT = 13000;
export function isStarsAmount(amount) {
  return Number.isSafeInteger(amount) && amount >= 1 && amount <= MAX_STARS_AMOUNT;
}
export function starsForRub(amount) {
  if (!isStarsAmount(amount)) throw new TypeError('Некорректная сумма для оплаты Stars.');
  const rateCents = Math.round(RUB_PER_STAR * 100);
  return Math.floor((amount * 100 + rateCents - 1) / rateCents);
}
