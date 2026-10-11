import { createContext } from './customer/context.js';
import { registerAccessHandlers } from './customer/access.js';
import { registerNavigationHandlers } from './customer/navigation.js';
import { registerCatalogHandlers } from './customer/catalog.js';
import { registerPurchaseHandlers } from './customer/purchase.js';
import { registerProfileHandlers } from './customer/profile.js';
import { registerTopUpHandlers } from './customer/top-up.js';
import { registerHistoryHandlers } from './customer/history.js';
import { registerErrorsHandlers } from './customer/errors.js';
export function registerHandlers(bot, options) {
  const context = createContext(options);
  registerAccessHandlers(bot, context);
  registerNavigationHandlers(bot, context);
  registerCatalogHandlers(bot, context);
  registerPurchaseHandlers(bot, context);
  registerProfileHandlers(bot, context);
  registerTopUpHandlers(bot, context);
  registerHistoryHandlers(bot, context);
  registerErrorsHandlers(bot, context);
}
