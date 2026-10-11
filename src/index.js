import 'dotenv/config';
import { createLogger, readLoggerConfig } from './logger.js';
import { readConfig } from './config.js';
import { createStore } from './store.js';
import { createApplication } from './application.js';
import { runApplication } from './lifecycle.js';
let logger = createLogger();
let configured = false;
async function main() {
  logger = createLogger(readLoggerConfig());
  const config = readConfig();
  configured = true;
  logger.info('Запуск бота.');
  const store = await createStore(config.databasePath, {
    legacyPath: config.legacyPath,
    bootstrapAdminIds: config.bootstrapAdminIds,
  });
  let application;
  try {
    application = createApplication(config, store, { logger });
  } catch (error) {
    store.close();
    throw error;
  }
  await runApplication(application, store);
}
main().catch((error) => {
  logger.error(configured ? 'Ошибка инициализации.' : `Ошибка настройки: ${error.message}`, {
    code: error.code ?? error.name ?? 'UNKNOWN',
  });
  process.exitCode = 1;
});
