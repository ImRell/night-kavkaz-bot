export function prepareMaintenanceQueries(db) {
  const getMaintenanceModeQuery = db.prepare(
    "SELECT value FROM app_meta WHERE key = 'maintenance_mode'",
  );
  const setMaintenanceModeQuery =
    db.prepare(`INSERT INTO app_meta (key, value) VALUES ('maintenance_mode', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
  const getLastBackupQuery = db.prepare("SELECT value FROM app_meta WHERE key = 'last_backup_at'");
  const setLastBackupQuery =
    db.prepare(`INSERT INTO app_meta (key, value) VALUES ('last_backup_at', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
  const backupQuery = db.prepare('VACUUM INTO ?');
  return {
    getMaintenanceModeQuery,
    setMaintenanceModeQuery,
    getLastBackupQuery,
    setLastBackupQuery,
    backupQuery,
  };
}
