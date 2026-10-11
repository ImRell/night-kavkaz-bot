import { discountedPrice } from '../discounts.js';
export function createPricing({ queries, clock }) {
  const { getDiscountQuery } = queries;
  function scopeOf(productId) {
    if (productId === null) return 'all';
    if (!Number.isSafeInteger(productId) || productId < 1)
      throw new TypeError('Некорректный ID товара.');
    return `product:${productId}`;
  }
  function discountState(productId, now = clock()) {
    const row = getDiscountQuery.get(scopeOf(productId));
    return row ? { ...row, active: Boolean(row.enabled && Date.parse(row.endsAt) > now) } : null;
  }
  function applyDiscount(product, now = clock(), global = discountState(null, now)) {
    if (!product) return product;
    const individual = discountState(product.id, now);
    const discount = individual?.active ? individual : global?.active ? global : null;
    if (!discount)
      return { ...product, basePrice: product.price, discountPercent: null, discountEndsAt: null };
    return {
      ...product,
      basePrice: product.price,
      price: discountedPrice(product.price, discount.percent),
      discountPercent: discount.percent,
      discountEndsAt: discount.endsAt,
      discountScope: discount.scope,
    };
  }
  return { scopeOf, discountState, applyDiscount };
}
