import { telegramId } from '../domain/telegram-id.js';
export function createCatalogService(context) {
  const { clock, scopeOf, discountState, applyDiscount } = context;
  const { listProducts, getProduct, saveDiscountQuery, disableDiscountQuery, isAdminQuery } =
    context.queries;
  return {
    getDiscount(productId = null) {
      return discountState(productId);
    },
    setDiscount(adminId, productId, percent, endsAt) {
      const actor = telegramId(adminId);
      if (!isAdminQuery.get(actor)) throw new Error('Доступ только для администраторов.');
      const scope = scopeOf(productId);
      if (productId !== null && !getProduct.get(productId)) throw new Error('Товар недоступен.');
      if (!Number.isInteger(percent) || percent < 1 || percent > 100)
        throw new TypeError('Введите целый процент от 1 до 100.');
      const timestamp = typeof endsAt === 'string' ? Date.parse(endsAt) : NaN;
      const now = clock();
      if (!Number.isFinite(timestamp) || timestamp <= now)
        throw new TypeError('Окончание скидки должно быть в будущем.');
      saveDiscountQuery.run(
        scope,
        productId,
        percent,
        new Date(timestamp).toISOString(),
        actor,
        new Date(now).toISOString(),
      );
      return discountState(productId, now);
    },
    disableDiscount(adminId, productId = null) {
      const actor = telegramId(adminId);
      if (!isAdminQuery.get(actor)) throw new Error('Доступ только для администраторов.');
      return (
        disableDiscountQuery.run(actor, new Date(clock()).toISOString(), scopeOf(productId))
          .changes === 1
      );
    },
    listProducts() {
      const now = clock();
      const global = discountState(null, now);
      return {
        items: listProducts.all().map((product) => applyDiscount(product, now, global)),
        hasNext: false,
      };
    },
    getProduct(id) {
      if (!Number.isSafeInteger(id) || id < 1) throw new TypeError('Некорректный ID товара.');
      return applyDiscount(getProduct.get(id));
    },
  };
}
