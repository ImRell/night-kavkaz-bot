export const TOP_UP_AMOUNTS = Object.freeze([249, 349, 499, 799, 1499]);
export const RUB_PER_STAR = 1.3;
export const MIN_TOP_UP_AMOUNT = 1;
export const MAX_TOP_UP_AMOUNT = 13000;
export function isTopUpAmount(amount) {
  return Number.isSafeInteger(amount) && amount >= MIN_TOP_UP_AMOUNT && amount <= MAX_TOP_UP_AMOUNT;
}
export function parseTopUpAmount(text) {
  const value = String(text ?? '').trim();
  if (!/^[0-9]{1,5}$/.test(value)) return null;
  const amount = Number(value);
  return isTopUpAmount(amount) ? amount : null;
}
export function starsForRub(amount) {
  if (!isTopUpAmount(amount)) throw new TypeError('Некорректная сумма.');
  const rateCents = Math.round(RUB_PER_STAR * 100);
  return Math.floor((amount * 100 + rateCents - 1) / rateCents);
}
