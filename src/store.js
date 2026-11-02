import { openDatabase } from './database/connection.js';
import { prepareQueries } from './database/queries/index.js';
import { createBroadcastRepository } from './database/broadcasts.js';
import { telegramId } from './domain/telegram-id.js';
import { createPricing } from './services/pricing.js';
import { createUsersService } from './services/users.js';
import { createAdminsService } from './services/admins.js';
import { createMaintenanceService } from './services/maintenance.js';
import { createModerationService } from './services/moderation.js';
import { createCatalogService } from './services/catalog.js';
import { createPurchasesService } from './services/purchases.js';
import { createOrdersService } from './services/orders.js';
export async function createStore(
  file,
  { legacyPath, bootstrapAdminIds = [], clock = Date.now } = {},
) {
  const db = await openDatabase(file, legacyPath);
  try {
    if (!Array.isArray(bootstrapAdminIds))
      throw new TypeError('Некорректный список администраторов.');
    const systemAdminIds = new Set(bootstrapAdminIds.map(telegramId));
    const seedAdmin = db.prepare(
      `INSERT INTO admins (telegram_id, added_by) VALUES (?, NULL) ON CONFLICT(telegram_id) DO UPDATE SET added_by = NULL`,
    );
    for (const id of bootstrapAdminIds) seedAdmin.run(telegramId(id));
    const queries = prepareQueries(db);
    const context = { db, queries, clock, systemAdminIds, ...createPricing({ queries, clock }) };
    let closed = false;
    return {
      ...createBroadcastRepository(db, clock),
      ...createUsersService(context),
      ...createAdminsService(context),
      ...createMaintenanceService(context),
      ...createModerationService(context),
      ...createCatalogService(context),
      ...createOrdersService(context),
      ...createPurchasesService(context),
      close() {
        if (!closed) {
          db.close();
          closed = true;
        }
      },
    };
  } catch (error) {
    db.close();
    throw error;
  }
}
