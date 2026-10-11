import { prepareCatalogQueries } from './catalog.js';
import { prepareBalanceQueries } from './balance.js';
import { prepareAdminsQueries } from './admins.js';
import { prepareUsersQueries } from './users.js';
import { preparePurchasesQueries } from './purchases.js';
import { prepareDiscountsQueries } from './discounts.js';
import { prepareTopUpsQueries } from './top-ups.js';
import { prepareMaintenanceQueries } from './maintenance.js';
export function prepareQueries(db) {
  return {
    ...prepareCatalogQueries(db),
    ...prepareBalanceQueries(db),
    ...prepareAdminsQueries(db),
    ...prepareUsersQueries(db),
    ...preparePurchasesQueries(db),
    ...prepareDiscountsQueries(db),
    ...prepareTopUpsQueries(db),
    ...prepareMaintenanceQueries(db),
  };
}
