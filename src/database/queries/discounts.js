export function prepareDiscountsQueries(db) {
  const getDiscountQuery = db.prepare(`SELECT scope, percent, ends_at AS endsAt,
      enabled, updated_by AS updatedBy, updated_at AS updatedAt FROM discounts WHERE scope = ?`);
  const saveDiscountQuery = db.prepare(`INSERT INTO discounts
      (scope, product_id, percent, ends_at, enabled, updated_by, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(scope) DO UPDATE SET percent = excluded.percent, ends_at = excluded.ends_at,
        enabled = 1, updated_by = excluded.updated_by, updated_at = excluded.updated_at`);
  const disableDiscountQuery =
    db.prepare(`UPDATE discounts SET enabled = 0, updated_by = ?, updated_at = ?
      WHERE scope = ? AND enabled = 1`);
  return { getDiscountQuery, saveDiscountQuery, disableDiscountQuery };
}
