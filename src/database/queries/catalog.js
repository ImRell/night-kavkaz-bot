export function prepareCatalogQueries(db) {
  const listProducts = db.prepare(`SELECT id, slug, title, description, price, currency
      FROM products WHERE is_active = 1 ORDER BY sort_order, id`);
  const getProduct = db.prepare(`SELECT id, slug, title, description, price, currency
      FROM products WHERE id = ? AND is_active = 1`);
  const productForPurchase = db.prepare(`SELECT id, slug, title, price, currency
      FROM products WHERE id = ? AND is_active = 1`);
  return { listProducts, getProduct, productForPurchase };
}
