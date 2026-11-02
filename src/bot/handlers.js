import { createContext } from './customer/context.js';
import { registerMembershipHandlers } from './customer/membership.js';
import { registerAccessHandlers } from './customer/access.js';
import { registerNavigationHandlers } from './customer/navigation.js';
import { registerCatalogHandlers } from './customer/catalog.js';
import { registerHistoryHandlers } from './customer/history.js';
import { registerErrorsHandlers } from './customer/errors.js';
export function registerHandlers(bot, options) {
  const context = createContext(options);
  registerMembershipHandlers(bot, context);
  registerAccessHandlers(bot, context);
  registerNavigationHandlers(bot, context);
  registerCatalogHandlers(bot, context);
  registerHistoryHandlers(bot, context);
  registerErrorsHandlers(bot, context);
}
