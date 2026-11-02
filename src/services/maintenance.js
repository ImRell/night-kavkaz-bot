export function createMaintenanceService(context) {
  const {
    getMaintenanceModeQuery,
    setMaintenanceModeQuery,
    getLastBackupQuery,
    setLastBackupQuery,
    backupQuery,
  } = context.queries;
  return {
    isMaintenanceMode() {
      return getMaintenanceModeQuery.get()?.value === '1';
    },
    setMaintenanceMode(enabled) {
      if (typeof enabled !== 'boolean')
        throw new TypeError('Режим техработ должен быть включён или выключен.');
      setMaintenanceModeQuery.run(enabled ? '1' : '0');
      return enabled;
    },
    getLastBackupAt() {
      return getLastBackupQuery.get()?.value ?? null;
    },
    setLastBackupAt(isoDate) {
      setLastBackupQuery.run(isoDate);
    },
    // VACUUM INTO gives a consistent snapshot; copying the file could miss data still in the WAL.
    backupTo(file) {
      backupQuery.run(file);
    },
  };
}
