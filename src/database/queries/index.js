import { prepareCatalogQueries } from './catalog.js';
import { prepareAdminsQueries } from './admins.js';
import { prepareUsersQueries } from './users.js';
import { preparePurchasesQueries } from './purchases.js';
import { prepareDiscountsQueries } from './discounts.js';
import { prepareMaintenanceQueries } from './maintenance.js';
import { prepareOrdersQueries } from './orders.js';
export function prepareQueries(db) {
  return {
    ...prepareCatalogQueries(db),
    ...prepareAdminsQueries(db),
    ...prepareUsersQueries(db),
    ...preparePurchasesQueries(db),
    ...prepareDiscountsQueries(db),
    ...prepareMaintenanceQueries(db),
    ...prepareOrdersQueries(db),
  };
}
