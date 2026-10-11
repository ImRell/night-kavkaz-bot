export function prepareMaintenanceQueries(db) {
  const getMaintenanceModeQuery = db.prepare(
    "SELECT value FROM app_meta WHERE key = 'maintenance_mode'",
  );
  const setMaintenanceModeQuery =
    db.prepare(`INSERT INTO app_meta (key, value) VALUES ('maintenance_mode', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
  return { getMaintenanceModeQuery, setMaintenanceModeQuery };
}
