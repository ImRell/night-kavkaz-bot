export function prepareTopUpsQueries(db) {
  const findStarsCharge = db.prepare('SELECT id FROM top_ups WHERE telegram_charge_id = ?');
  const insertStarsTopUp = db.prepare(`INSERT INTO top_ups
      (telegram_id, method, amount, stars, status, telegram_charge_id) VALUES (?, 'stars', ?, ?, 'approved', ?)`);
  return { findStarsCharge, insertStarsTopUp };
}
