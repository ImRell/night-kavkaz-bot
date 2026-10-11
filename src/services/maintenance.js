export function createMaintenanceService(context) {
  const { getMaintenanceModeQuery, setMaintenanceModeQuery } = context.queries;
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
  };
}
